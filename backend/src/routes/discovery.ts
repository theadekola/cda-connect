import {Router} from 'express';
import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {asyncHandler,AppError} from '../utils/errors.js';
import {requirePermission,hasPermission} from '../services/permissions.js';
export const discoveryRouter=Router();
// Requests appear in the directory without granting access to member content.
discoveryRouter.get('/mine/status',asyncHandler(async(req,res)=>{
 const result=await(await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).query(`
 SELECT c.Id,c.Name,c.Description,c.LogoUrl,c.IsPrivate,c.IsVerified,c.City,c.LGA,c.State,c.Country,
 (SELECT COUNT(*) FROM CommunityMembers m WHERE m.CommunityId=c.Id AND m.Status='ACTIVE') MemberCount,
 CASE WHEN cm.Status IN ('BANNED','REMOVED') THEN 'BANNED' WHEN cm.Status='ACTIVE' THEN 'MEMBER' ELSE jr.Status END JoinStatus
 FROM Communities c
 LEFT JOIN CommunityMembers cm ON cm.CommunityId=c.Id AND cm.UserId=@u
 LEFT JOIN CommunityJoinRequests jr ON jr.CommunityId=c.Id AND jr.UserId=@u
 WHERE cm.Status='ACTIVE' OR jr.Status IN ('PENDING','REJECTED')
 ORDER BY CASE WHEN cm.Status='ACTIVE' THEN 1 ELSE 0 END,c.Name`);
 await Promise.all(result.recordset.map(async community=>{
  if(community.JoinStatus==='MEMBER'&&await hasPermission(req.user!.id,community.Id,'MEMBER_APPROVE')){
   const pending=await(await getPool()).request().input('c',sql.UniqueIdentifier,community.Id).query("SELECT COUNT(*) Total FROM CommunityJoinRequests WHERE CommunityId=@c AND Status='PENDING'");
   community.PendingRequestCount=pending.recordset[0].Total;
  }
 }));
 res.set('Cache-Control','no-store').json(result.recordset);
}));
discoveryRouter.get('/:id/preview',asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id),r=await(await getPool()).request().input('c',sql.UniqueIdentifier,id).input('u',sql.UniqueIdentifier,req.user!.id).query(`SELECT c.Id,c.Name,c.Description,c.LogoUrl,c.BannerUrl,c.CreatedAt,c.CommunityType,c.Guidelines,c.Tags,c.SpecificArea,c.Category,c.Country,c.State,c.City,c.LGA,c.IsPrivate,c.IsVerified,(SELECT COUNT(*) FROM CommunityMembers m WHERE m.CommunityId=c.Id AND m.Status='ACTIVE') MemberCount,CASE WHEN cm.Status IN ('BANNED','REMOVED') THEN 'BANNED' WHEN cm.Status='ACTIVE' THEN 'MEMBER' WHEN jr.Status='PENDING' THEN 'PENDING' ELSE 'AVAILABLE' END JoinStatus FROM Communities c LEFT JOIN CommunityMembers cm ON cm.CommunityId=c.Id AND cm.UserId=@u LEFT JOIN CommunityJoinRequests jr ON jr.CommunityId=c.Id AND jr.UserId=@u WHERE c.Id=@c`);
 if(!r.recordset[0])throw new AppError(404,'Community not found');res.set('Cache-Control','no-store').json(r.recordset[0]);
}));
const filters=z.object({q:z.string().trim().max(200).default(''),area:z.string().trim().max(150).default(''),category:z.string().trim().max(80).default(''),saved:z.union([z.boolean(),z.enum(['true','false','1','0'])]).transform(v=>v===true||v==='true'||v==='1').default(false),offset:z.coerce.number().int().min(0).max(100000).default(0),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional(),radius:z.coerce.number().min(1).max(200).default(25)}).refine(d=>(d.latitude===undefined)===(d.longitude===undefined),'Provide both coordinates');
for(const method of ['get','post'] as const)discoveryRouter[method]('/discover/search',asyncHandler(async(req,res)=>{
 const d=filters.parse(method==='post'?req.body:req.query),pool=await getPool(),nearby=d.latitude!==undefined&&!d.q;
 if(!nearby&&!d.q)return res.set('Cache-Control','no-store').json([]);
 if(nearby){const pref=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query('SELECT ShareLocation FROM PrivacySafetySettings WHERE UserId=@u');if(!pref.recordset[0]?.ShareLocation)throw new AppError(403,'Enable location sharing in profile privacy first.')}
 const r=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('q',sql.NVarChar(200),d.q).input('area',sql.NVarChar(150),d.area).input('category',sql.NVarChar(80),d.category).input('saved',sql.Bit,d.saved).input('offset',sql.Int,d.offset).input('lat',sql.Float,nearby?d.latitude:null).input('lng',sql.Float,nearby?d.longitude:null).input('radius',sql.Float,d.radius).query(`
 SELECT c.Id,c.Name,c.Description,c.LogoUrl,c.Category,c.Country,c.State,c.City,c.LGA,c.IsPrivate,c.IsVerified,c.CreatedAt,
 CAST(CASE WHEN saved.UserId IS NULL THEN 0 ELSE 1 END AS BIT) IsSaved,
 counts.MemberCount,counts.NewMembers,
 CASE WHEN counts.MemberCount>counts.NewMembers THEN ROUND(100.0*counts.NewMembers/(counts.MemberCount-counts.NewMembers),1) ELSE NULL END GrowthPercent,
 distance.DistanceKm,
 CASE WHEN cm.Status IN ('BANNED','REMOVED') THEN 'BANNED' WHEN cm.Status='ACTIVE' THEN 'MEMBER' WHEN jr.Status='PENDING' THEN 'PENDING' ELSE 'AVAILABLE' END JoinStatus
 FROM Communities c
 LEFT JOIN CommunityMembers cm ON cm.CommunityId=c.Id AND cm.UserId=@u
 LEFT JOIN CommunityJoinRequests jr ON jr.CommunityId=c.Id AND jr.UserId=@u
 LEFT JOIN SavedCommunities saved ON saved.CommunityId=c.Id AND saved.UserId=@u
 CROSS APPLY (SELECT COUNT(*) MemberCount,COALESCE(SUM(CASE WHEN x.JoinedAt>=DATEADD(day,-7,SYSUTCDATETIME()) THEN 1 ELSE 0 END),0) NewMembers FROM CommunityMembers x WHERE x.CommunityId=c.Id AND x.Status='ACTIVE') counts
 CROSS APPLY (SELECT CASE WHEN @lat IS NOT NULL AND c.Latitude BETWEEN -90 AND 90 AND c.Longitude BETWEEN -180 AND 180 THEN geography::Point(COALESCE(c.Latitude,0),COALESCE(c.Longitude,0),4326).STDistance(geography::Point(COALESCE(@lat,0),COALESCE(@lng,0),4326))/1000.0 ELSE NULL END DistanceKm) distance
 WHERE (@q='' OR CHARINDEX(LOWER(@q),LOWER(c.Name))>0)
 AND (@area='' OR CHARINDEX(LOWER(@area),LOWER(CONCAT(c.City,' ',c.State,' ',c.LGA,' ',c.Country,' ',c.Postcode)))>0)
 AND (@category='' OR c.Category=@category OR (@category='Residents' AND c.Category='CDA / Residents'))
 AND (@saved=0 OR saved.UserId IS NOT NULL)
 AND (@lat IS NULL OR distance.DistanceKm<=@radius)
 ORDER BY CASE WHEN distance.DistanceKm IS NULL THEN 1 ELSE 0 END,distance.DistanceKm,c.IsVerified DESC,counts.MemberCount DESC,c.Id
 OFFSET @offset ROWS FETCH NEXT 60 ROWS ONLY`);
 res.set('Cache-Control','no-store').json(r.recordset);
}));
discoveryRouter.put('/:id/saved',asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id),{saved}=z.object({saved:z.boolean()}).parse(req.body),pool=await getPool();
 await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('c',sql.UniqueIdentifier,id).input('saved',sql.Bit,saved).query(`IF NOT EXISTS(SELECT 1 FROM Communities WHERE Id=@c) THROW 50001,'Community not found',1; IF @saved=0 DELETE FROM SavedCommunities WHERE UserId=@u AND CommunityId=@c; ELSE MERGE SavedCommunities WITH(HOLDLOCK) t USING(SELECT @u UserId,@c CommunityId)s ON t.UserId=s.UserId AND t.CommunityId=s.CommunityId WHEN NOT MATCHED THEN INSERT(UserId,CommunityId) VALUES(@u,@c);`);res.json({success:true});
}));
discoveryRouter.patch('/:id/location',asyncHandler(async(req,res)=>{
 await requirePermission(req.user!.id,req.params.id,'MEMBER_ROLE_CHANGE');
 const d=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}).parse(req.body);
 await(await getPool()).request().input('c',sql.UniqueIdentifier,req.params.id).input('lat',sql.Decimal(10,7),d.latitude).input('lng',sql.Decimal(10,7),d.longitude).query('UPDATE Communities SET Latitude=@lat,Longitude=@lng WHERE Id=@c');res.json({success:true});
}));

