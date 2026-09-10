import {visibleContent} from '../services/privacy.js';
import {Router} from 'express';
import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {asyncHandler,AppError} from '../utils/errors.js';
export const privacyRouter=Router();
privacyRouter.get('/privacy',asyncHandler(async(req,res)=>{
 const pool=await getPool(),r=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query(`SELECT COALESCE(a.PrivateAccount,1) PrivateAccount,COALESCE(a.AllowFollowers,0) AllowFollowers,COALESCE(p.EmailVisibility,'ADMINS') EmailVisibility,COALESCE(p.PhoneVisibility,'ADMINS') PhoneVisibility,COALESCE(s.CommentAudience,'EVERYONE') CommentAudience,COALESCE(s.MentionAudience,'EVERYONE') MentionAudience,COALESCE(s.TagApproval,1) TagApproval,COALESCE(s.AllowDownloads,0) AllowDownloads,u.TwoFactorEnabled FROM Users u LEFT JOIN AccountSettings a ON a.UserId=u.Id LEFT JOIN PrivacyPreferences p ON p.UserId=u.Id LEFT JOIN PrivacySafetySettings s ON s.UserId=u.Id WHERE u.Id=@u`);
 res.set('Cache-Control','no-store').json(r.recordset[0]);
}));
privacyRouter.patch('/privacy',asyncHandler(async(req,res)=>{
 const d=z.discriminatedUnion('key',[
 z.object({key:z.enum(['showEmail','showPhone','tagApproval','allowDownloads']),value:z.boolean()}),
 z.object({key:z.enum(['commentAudience','mentionAudience']),value:z.enum(['EVERYONE','COMMUNITIES','NOBODY'])})]).parse(req.body);
 const contact=d.key==='showEmail'||d.key==='showPhone',column={showEmail:'EmailVisibility',showPhone:'PhoneVisibility',tagApproval:'TagApproval',allowDownloads:'AllowDownloads',commentAudience:'CommentAudience',mentionAudience:'MentionAudience'}[d.key],table=contact?'PrivacyPreferences':'PrivacySafetySettings';
 const value=contact?(d.value?'MEMBERS':'NOBODY'):d.value,pool=await getPool();
 await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('v',typeof value==='boolean'?sql.Bit:sql.NVarChar(20),value).query(`MERGE ${table} WITH(HOLDLOCK) t USING(SELECT @u UserId)s ON t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET ${column}=@v,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(UserId,${column}) VALUES(@u,@v);`);
 res.json({success:true});
}));
privacyRouter.get('/privacy/people',asyncHandler(async(req,res)=>{
 const term=z.string().trim().min(2).max(80).parse(req.query.q),pool=await getPool();
 const r=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('q',sql.NVarChar(80),term).query(`SELECT DISTINCT TOP 30 u.Id,u.FirstName,u.LastName,a.Username FROM Users u LEFT JOIN AccountSettings a ON a.UserId=u.Id JOIN CommunityMembers theirs ON theirs.UserId=u.Id AND theirs.Status='ACTIVE' JOIN CommunityMembers mine ON mine.CommunityId=theirs.CommunityId AND mine.UserId=@u AND mine.Status='ACTIVE' WHERE u.Id<>@u AND u.AccountStatus='ACTIVE' AND (CHARINDEX(LOWER(@q),LOWER(CONCAT(u.FirstName,' ',u.LastName)))>0 OR CHARINDEX(LOWER(@q),LOWER(a.Username))>0) ORDER BY u.FirstName,u.LastName`);res.json(r.recordset);
}));
for(const kind of ['blocked','hidden'] as const){
 const table=kind==='blocked'?'BlockedUsers':'HiddenUsers',column=kind==='blocked'?'BlockedUserId':'HiddenUserId';
 privacyRouter.get('/privacy/'+kind,asyncHandler(async(req,res)=>{const pool=await getPool(),r=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query(`SELECT u.Id,u.FirstName,u.LastName FROM ${table} b JOIN Users u ON u.Id=b.${column} WHERE b.UserId=@u ORDER BY u.FirstName,u.LastName`);res.json(r.recordset)}));
 privacyRouter.put('/privacy/'+kind+'/:id',asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id),{enabled}=z.object({enabled:z.boolean()}).parse(req.body);if(id===req.user!.id)throw new AppError(400,'Choose another member');
 const pool=await getPool();await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,id).input('enabled',sql.Bit,enabled).query(`IF @enabled=0 DELETE FROM ${table} WHERE UserId=@u AND ${column}=@id; ELSE MERGE ${table} WITH(HOLDLOCK) t USING(SELECT @u UserId,@id TargetId)s ON t.UserId=s.UserId AND t.${column}=s.TargetId WHEN NOT MATCHED THEN INSERT(UserId,${column}) VALUES(@u,@id);`);res.json({success:true});
 }));
}
privacyRouter.get('/privacy/words',asyncHandler(async(req,res)=>{const pool=await getPool();res.json((await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query('SELECT Phrase FROM RestrictedWords WHERE UserId=@u ORDER BY Phrase')).recordset)}));
privacyRouter.put('/privacy/words',asyncHandler(async(req,res)=>{
 const {phrase,enabled}=z.object({phrase:z.string().trim().toLowerCase().min(1).max(100),enabled:z.boolean()}).parse(req.body),pool=await getPool();
 await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('p',sql.NVarChar(100),phrase).input('enabled',sql.Bit,enabled).query(`IF @enabled=0 DELETE FROM RestrictedWords WHERE UserId=@u AND Phrase=@p; ELSE BEGIN IF (SELECT COUNT(*) FROM RestrictedWords WHERE UserId=@u)>=100 THROW 50002,'You can save up to 100 phrases.',1; MERGE RestrictedWords WITH(HOLDLOCK) t USING(SELECT @u UserId,@p Phrase)s ON t.UserId=s.UserId AND t.Phrase=s.Phrase WHEN NOT MATCHED THEN INSERT(UserId,Phrase) VALUES(@u,@p); END`);res.json({success:true});
}));
privacyRouter.get('/privacy/reports',asyncHandler(async(req,res)=>{const pool=await getPool();res.json((await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query(`SELECT Id,Reason Title,Details,Status,CreatedAt FROM PostReports WHERE ReportedBy=@u UNION ALL SELECT Id,Subject Title,Message Details,Status,CreatedAt FROM SupportTickets WHERE UserId=@u AND Category='SAFETY' ORDER BY CreatedAt DESC`)).recordset)}));
privacyRouter.get('/privacy/tags',asyncHandler(async(req,res)=>{const pool=await getPool();res.json((await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query(`SELECT t.PostId Id,t.Status,p.Body,p.CreatedAt FROM ProfileTags t JOIN CommunityPosts p ON p.Id=t.PostId WHERE t.UserId=@u AND p.IsDeleted=0 AND ${visibleContent('p.CreatedBy','p.Body')} AND EXISTS(SELECT 1 FROM CommunityMembers cm WHERE cm.CommunityId=p.CommunityId AND cm.UserId=@u AND cm.Status='ACTIVE') ORDER BY p.CreatedAt DESC`)).recordset)}));
privacyRouter.put('/privacy/tags/:id',asyncHandler(async(req,res)=>{const id=z.string().uuid().parse(req.params.id),{status}=z.object({status:z.enum(['APPROVED','REJECTED'])}).parse(req.body),pool=await getPool();const r=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,id).input('s',sql.NVarChar(20),status).query(`UPDATE ProfileTags SET Status=@s OUTPUT INSERTED.PostId WHERE UserId=@u AND PostId=@id`);if(!r.recordset[0])throw new AppError(404,'Tag not found');res.json({success:true})}));
