import {audit} from '../services/audit.js';
import {Router} from 'express';
import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {requireAuth} from '../middleware/auth.js';
import {requireCommunityMember,requirePermission,hasPermission} from '../services/permissions.js';
import {asyncHandler,AppError} from '../utils/errors.js';
export const servicesRouter=Router();servicesRouter.use(requireAuth);
const input=z.object({name:z.string().trim().min(2).max(200),category:z.string().trim().min(2).max(100),description:z.string().max(3000).optional(),phone:z.string().max(40).optional(),email:z.string().email().or(z.literal('')).optional(),website:z.string().url().refine(value=>value.startsWith('https://'),'Use an HTTPS website').or(z.literal('')).optional(),area:z.string().max(200).optional()}).strict();
async function provider(user:string,id:string,community?:string){
 z.string().uuid().parse(id);const row=(await(await getPool()).request().input('id',sql.UniqueIdentifier,id).query("SELECT * FROM ServiceProviders WHERE Id=@id AND Status='ACTIVE'")).recordset[0];
 if(!row||(community&&String(row.CommunityId).toLowerCase()!==community.toLowerCase()))throw new AppError(404,'Service not found');
 await requireCommunityMember(user,row.CommunityId);return row;
}
servicesRouter.get('/communities/:communityId/services',asyncHandler(async(req,res)=>{
 await requireCommunityMember(req.user!.id,req.params.communityId);const category=z.string().max(100).parse(req.query.category??'');const r=await(await getPool()).request().input('c',sql.UniqueIdentifier,req.params.communityId).input('cat',sql.NVarChar(100),category).query("SELECT s.*,CAST(ISNULL((SELECT AVG(CAST(Rating AS FLOAT)) FROM ServiceReviews r WHERE r.ProviderId=s.Id),0) AS DECIMAL(3,1)) Rating,(SELECT COUNT(*) FROM ServiceReviews r WHERE r.ProviderId=s.Id) ReviewCount FROM ServiceProviders s WHERE s.CommunityId=@c AND s.Status='ACTIVE' AND (@cat='' OR s.Category=@cat) ORDER BY s.IsVerified DESC,Rating DESC,s.Name");res.json(r.recordset);
}));
for(const method of ['post','patch'] as const)servicesRouter[method]('/communities/:communityId/services'+(method==='patch'?'/:providerId':''),asyncHandler(async(req,res)=>{
 await requireCommunityMember(req.user!.id,req.params.communityId);const d=input.parse(req.body);
 if(method==='patch'){const row=await provider(req.user!.id,req.params.providerId,req.params.communityId);if(String(row.CreatedBy).toLowerCase()!==req.user!.id.toLowerCase()&&!await hasPermission(req.user!.id,row.CommunityId,'DIRECTORY_MANAGE'))throw new AppError(403,'You cannot edit this service')}
 const request=(await getPool()).request().input('c',sql.UniqueIdentifier,req.params.communityId).input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,req.params.providerId??null).input('n',sql.NVarChar(200),d.name).input('cat',sql.NVarChar(100),d.category).input('d',sql.NVarChar(3000),d.description||null).input('p',sql.NVarChar(40),d.phone||null).input('e',sql.NVarChar(255),d.email||null).input('w',sql.NVarChar(500),d.website||null).input('a',sql.NVarChar(200),d.area||null);
 const r=await request.query(method==='post'?"INSERT INTO ServiceProviders(CommunityId,CreatedBy,Name,Category,Description,Phone,Email,Website,Area) OUTPUT INSERTED.* VALUES(@c,@u,@n,@cat,@d,@p,@e,@w,@a)":"UPDATE ServiceProviders SET Name=@n,Category=@cat,Description=@d,Phone=@p,Email=@e,Website=@w,Area=@a,IsVerified=0 OUTPUT INSERTED.* WHERE Id=@id AND CommunityId=@c AND Status='ACTIVE'");if(!r.recordset[0])throw new AppError(404,'Service not found');await audit(req.params.communityId,req.user!.id,method==='post'?'SERVICE_CREATED':'SERVICE_UPDATED','ServiceProvider',r.recordset[0].Id);res.status(method==='post'?201:200).json(r.recordset[0]);
}));
servicesRouter.delete('/communities/:communityId/services/:providerId',asyncHandler(async(req,res)=>{
 const row=await provider(req.user!.id,req.params.providerId,req.params.communityId);if(String(row.CreatedBy).toLowerCase()!==req.user!.id.toLowerCase()&&!await hasPermission(req.user!.id,row.CommunityId,'DIRECTORY_MANAGE'))throw new AppError(403,'You cannot remove this service');await(await getPool()).request().input('id',sql.UniqueIdentifier,row.Id).query("UPDATE ServiceProviders SET Status='INACTIVE' WHERE Id=@id");await audit(row.CommunityId,req.user!.id,'SERVICE_REMOVED','ServiceProvider',row.Id);res.status(204).end();
}));
servicesRouter.patch('/communities/:communityId/services/:providerId/verification',asyncHandler(async(req,res)=>{
 const row=await provider(req.user!.id,req.params.providerId,req.params.communityId);await requirePermission(req.user!.id,row.CommunityId,'DIRECTORY_MANAGE');const d=z.object({isVerified:z.boolean()}).strict().parse(req.body);await(await getPool()).request().input('id',sql.UniqueIdentifier,row.Id).input('v',sql.Bit,d.isVerified).query('UPDATE ServiceProviders SET IsVerified=@v WHERE Id=@id');await audit(row.CommunityId,req.user!.id,d.isVerified?'SERVICE_VERIFIED':'SERVICE_UNVERIFIED','ServiceProvider',row.Id);res.json({success:true});
}));
servicesRouter.get('/services/:providerId/reviews',asyncHandler(async(req,res)=>{const row=await provider(req.user!.id,req.params.providerId);const result=await(await getPool()).request().input('id',sql.UniqueIdentifier,row.Id).query('SELECT TOP 100 r.Id,r.Rating,r.Comment,r.CreatedAt,u.FirstName,u.LastName FROM ServiceReviews r JOIN Users u ON u.Id=r.UserId WHERE r.ProviderId=@id ORDER BY r.CreatedAt DESC');res.json(result.recordset)}));
servicesRouter.post('/services/:providerId/reviews',asyncHandler(async(req,res)=>{
 const row=await provider(req.user!.id,req.params.providerId),d=z.object({rating:z.number().int().min(1).max(5),comment:z.string().max(2000).optional()}).strict().parse(req.body);if(String(row.CreatedBy).toLowerCase()===req.user!.id.toLowerCase())throw new AppError(400,'You cannot review your own service');await(await getPool()).request().input('p',sql.UniqueIdentifier,row.Id).input('u',sql.UniqueIdentifier,req.user!.id).input('r',sql.TinyInt,d.rating).input('c',sql.NVarChar(2000),d.comment??null).query('MERGE ServiceReviews WITH(HOLDLOCK) AS t USING(SELECT @p ProviderId,@u UserId)s ON t.ProviderId=s.ProviderId AND t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET Rating=@r,Comment=@c,CreatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(ProviderId,UserId,Rating,Comment) VALUES(@p,@u,@r,@c);');res.json({success:true});
}));
