import {visibleContent} from '../services/privacy.js';
import {getRedis} from '../config/redis.js';
import {Router} from 'express';
import {z} from 'zod';
import bcrypt from 'bcryptjs';
import {getPool,sql} from '../config/db.js';
import {asyncHandler,AppError} from '../utils/errors.js';

export const accountRouter=Router();
accountRouter.get('/account',asyncHandler(async(req,res)=>{
 const pool=await getPool();
 const r=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query(`SELECT u.Id,u.FirstName,u.LastName,u.Email,u.Phone,u.DateOfBirth,u.Address,u.Country,u.State,u.LGA,u.Postcode,u.ProfileImage,u.CreatedAt,u.AccountStatus,a.Username,COALESCE(a.PrivateAccount,1) PrivateAccount,COALESCE(a.AllowFollowers,0) AllowFollowers,COALESCE(a.EmailUpdates,0) EmailUpdates,COALESCE(a.PersonalizedExperience,1) PersonalizedExperience,COALESCE(p.ShowOnlineStatus,1) ShowOnlineStatus FROM Users u LEFT JOIN AccountSettings a ON a.UserId=u.Id LEFT JOIN PrivacyPreferences p ON p.UserId=u.Id WHERE u.Id=@u`);
 res.json(r.recordset[0]);
}));
accountRouter.put('/account/username',asyncHandler(async(req,res)=>{
 const {username}=z.object({username:z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9_]{2,29}$/,'Use 3–30 letters, numbers or underscores, starting with a letter')}).parse(req.body);
 const pool=await getPool();
 try{await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('name',sql.NVarChar(30),username).query(`MERGE AccountSettings WITH(HOLDLOCK) t USING(SELECT @u UserId)s ON t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET Username=@name,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(UserId,Username) VALUES(@u,@name);`)}catch(error:any){const number=error?.number??error?.originalError?.info?.number;if(number===2601||number===2627)throw new AppError(409,'This username is already in use');throw error}
 res.json({success:true,username});
}));
accountRouter.put('/account/email',asyncHandler(async()=>{throw new AppError(403,'Your registered email address is locked and cannot be changed.')}));
accountRouter.get('/account/export',asyncHandler(async(req,res)=>{
 const pool=await getPool();
 const queries:Record<string,string>={securityPreferences:'SELECT LoginAlerts,PasswordChangedAt,LastLoginAlertAt,LastLoginAlertStatus FROM Users WHERE Id=@u',languagePreferences:'SELECT * FROM LanguagePreferences WHERE UserId=@u',communityPreferences:'SELECT * FROM CommunityPreferences WHERE UserId=@u',profile:'SELECT Id,FirstName,LastName,Email,Phone,Address,Country,State,LGA,Postcode,DateOfBirth,CreatedAt FROM Users WHERE Id=@u',account:'SELECT * FROM AccountSettings WHERE UserId=@u',privacy:'SELECT * FROM PrivacyPreferences WHERE UserId=@u',communications:'SELECT * FROM CommunicationSettings WHERE UserId=@u',syncedContacts:'SELECT ContactUserId FROM SyncedContacts WHERE UserId=@u',privacySafety:'SELECT * FROM PrivacySafetySettings WHERE UserId=@u',hiddenUsers:'SELECT HiddenUserId FROM HiddenUsers WHERE UserId=@u',restrictedWords:'SELECT Phrase FROM RestrictedWords WHERE UserId=@u',notifications:'SELECT * FROM NotificationPreferences WHERE UserId=@u',memberships:'SELECT CommunityId,Status,JoinedAt FROM CommunityMembers WHERE UserId=@u',posts:'SELECT Id,CommunityId,Body,CreatedAt FROM CommunityPosts WHERE CreatedBy=@u',comments:'SELECT Id,PostId,Body,CreatedAt FROM PostComments WHERE UserId=@u',messages:'SELECT Id,ConversationId,MessageText,CreatedAt FROM Messages WHERE SenderUserId=@u'};
 const data:Record<string,unknown>={exportedAt:new Date().toISOString(),description:'Personal profile, preferences, memberships and content authored by this account. Authentication secrets and other members’ content are excluded.'};
 for(const [key,query] of Object.entries(queries))data[key]=(await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query(query)).recordset;
 res.set('Cache-Control','no-store').json(data);
}));
accountRouter.post('/account/deactivate',asyncHandler(async(req,res)=>{
 const {password}=z.object({password:z.string().min(1)}).parse(req.body),pool=await getPool();
 const r=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query('SELECT PasswordHash FROM Users WHERE Id=@u');
 if(!r.recordset[0]||!await bcrypt.compare(password,r.recordset[0].PasswordHash))throw new AppError(400,'Current password is incorrect');
 await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query(`SET XACT_ABORT ON;BEGIN TRANSACTION;UPDATE Users SET AccountStatus='DEACTIVATED',UpdatedAt=SYSUTCDATETIME() WHERE Id=@u;DELETE FROM UserSessions WHERE UserId=@u;DELETE FROM UserDevices WHERE UserId=@u;IF OBJECT_ID('WebPushSubscriptions','U') IS NOT NULL DELETE FROM WebPushSubscriptions WHERE UserId=@u;COMMIT;`);
 res.json({success:true});
}));
accountRouter.patch('/account/preferences',asyncHandler(async(req,res)=>{
 const {key,value}=z.object({key:z.enum(['privateAccount','allowFollowers','emailUpdates','personalizedExperience','showOnlineStatus']),value:z.boolean()}).parse(req.body),pool=await getPool();
 if(key==='showOnlineStatus')await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('v',sql.Bit,value).query(`MERGE PrivacyPreferences WITH(HOLDLOCK) t USING(SELECT @u UserId)s ON t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET ShowOnlineStatus=@v,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(UserId,ShowOnlineStatus) VALUES(@u,@v);`);
 else{const column={privateAccount:'PrivateAccount',allowFollowers:'AllowFollowers',emailUpdates:'EmailUpdates',personalizedExperience:'PersonalizedExperience'}[key];await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('v',sql.Bit,value).query(`MERGE AccountSettings WITH(HOLDLOCK) t USING(SELECT @u UserId)s ON t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET ${column}=@v,UpdatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(UserId,${column}) VALUES(@u,@v);`)}
 res.json({success:true});
}));
accountRouter.post('/account/presence',asyncHandler(async(req,res)=>{await getRedis().set('account:online:'+req.user!.id,'1','EX',90);res.json({success:true})}));

async function memberView(viewer:string,target:string){
 const pool=await getPool();
 const r=await pool.request().input('u',sql.UniqueIdentifier,target).input('viewer',sql.UniqueIdentifier,viewer).query(`SELECT u.Id,u.FirstName,u.LastName,CASE WHEN p.ShowProfilePhoto=0 AND u.Id<>@viewer THEN NULL ELSE u.ProfileImage END ProfileImage,u.CreatedAt,CASE WHEN u.Id=@viewer OR (p.EmailVisibility='MEMBERS' AND EXISTS(SELECT 1 FROM CommunityMembers mine JOIN CommunityMembers theirs ON mine.CommunityId=theirs.CommunityId WHERE mine.UserId=@viewer AND theirs.UserId=u.Id AND mine.Status='ACTIVE' AND theirs.Status='ACTIVE')) THEN u.Email ELSE NULL END Email,CASE WHEN u.Id=@viewer OR (p.PhoneVisibility='MEMBERS' AND EXISTS(SELECT 1 FROM CommunityMembers mine JOIN CommunityMembers theirs ON mine.CommunityId=theirs.CommunityId WHERE mine.UserId=@viewer AND theirs.UserId=u.Id AND mine.Status='ACTIVE' AND theirs.Status='ACTIVE')) THEN u.Phone ELSE NULL END Phone,a.Username,COALESCE(a.AllowFollowers,0) AllowFollowers,COALESCE(p.ShowOnlineStatus,1) ShowOnlineStatus FROM Users u LEFT JOIN AccountSettings a ON a.UserId=u.Id LEFT JOIN PrivacyPreferences p ON p.UserId=u.Id WHERE u.Id=@u AND u.AccountStatus='ACTIVE' AND (u.Id=@viewer OR NOT EXISTS(SELECT 1 FROM BlockedUsers b WHERE (b.UserId=@viewer AND b.BlockedUserId=@u) OR (b.UserId=@u AND b.BlockedUserId=@viewer))) AND NOT EXISTS(SELECT 1 FROM HiddenUsers h WHERE h.UserId=u.Id AND h.HiddenUserId=@viewer) AND (u.Id=@viewer OR COALESCE(a.PrivateAccount,1)=0 OR EXISTS(SELECT 1 FROM CommunityMembers mine JOIN CommunityMembers theirs ON theirs.CommunityId=mine.CommunityId WHERE mine.UserId=@viewer AND theirs.UserId=@u AND mine.Status='ACTIVE' AND theirs.Status='ACTIVE'))`);
 if(!r.recordset[0])throw new AppError(404,'This profile is not available to you');
 return r.recordset[0];
}
accountRouter.get('/members/:id',asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id),profile=await memberView(req.user!.id,id),pool=await getPool();
 const posts=await pool.request().input('u',sql.UniqueIdentifier,id).input('viewer',sql.UniqueIdentifier,req.user!.id).query(`SELECT TOP 50 p.Id,p.Body,p.CreatedAt,c.Name CommunityName,CASE WHEN p.CreatedBy=@u THEN 0 ELSE 1 END IsTagged,CONCAT(author.FirstName,' ',author.LastName) AuthorName FROM CommunityPosts p JOIN Communities c ON c.Id=p.CommunityId JOIN Users author ON author.Id=p.CreatedBy WHERE (p.CreatedBy=@u OR EXISTS(SELECT 1 FROM ProfileTags t WHERE t.PostId=p.Id AND t.UserId=@u AND t.Status='APPROVED')) AND p.IsDeleted=0 AND ${visibleContent('p.CreatedBy','p.Body','@viewer')} AND (p.CreatedBy=@viewer OR c.IsPrivate=0 OR EXISTS(SELECT 1 FROM CommunityMembers cm WHERE cm.CommunityId=p.CommunityId AND cm.UserId=@viewer AND cm.Status='ACTIVE')) ORDER BY p.CreatedAt DESC`);
 const follow=await pool.request().input('u',sql.UniqueIdentifier,id).input('viewer',sql.UniqueIdentifier,req.user!.id).query('SELECT 1 Following FROM UserFollows WHERE FollowerId=@viewer AND FollowedId=@u');
 const online=profile.ShowOnlineStatus?Boolean(await getRedis().get('account:online:'+id)):null;
 res.json({profile,posts:posts.recordset,following:Boolean(follow.recordset[0]),online});
}));
accountRouter.put('/members/:id/follow',asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id),{following}=z.object({following:z.boolean()}).parse(req.body),pool=await getPool();
 if(id===req.user!.id)throw new AppError(400,'You cannot follow yourself');
 if(following){const profile=await memberView(req.user!.id,id);if(!profile.AllowFollowers)throw new AppError(403,'This member is not accepting followers');await pool.request().input('u',sql.UniqueIdentifier,id).input('viewer',sql.UniqueIdentifier,req.user!.id).query(`MERGE UserFollows WITH(HOLDLOCK) t USING(SELECT @viewer FollowerId,@u FollowedId)s ON t.FollowerId=s.FollowerId AND t.FollowedId=s.FollowedId WHEN NOT MATCHED THEN INSERT(FollowerId,FollowedId) VALUES(@viewer,@u);`)}
 else await pool.request().input('u',sql.UniqueIdentifier,id).input('viewer',sql.UniqueIdentifier,req.user!.id).query('DELETE FROM UserFollows WHERE FollowerId=@viewer AND FollowedId=@u');
 res.json({success:true});
}));
accountRouter.get('/account/following',asyncHandler(async(req,res)=>{
 const pool=await getPool();const r=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query(`SELECT f.FollowedId Id,u.FirstName,u.LastName FROM UserFollows f JOIN Users u ON u.Id=f.FollowedId JOIN AccountSettings a ON a.UserId=u.Id WHERE f.FollowerId=@u AND a.AllowFollowers=1 AND u.AccountStatus='ACTIVE' AND NOT EXISTS(SELECT 1 FROM BlockedUsers b WHERE (b.UserId=@u AND b.BlockedUserId=u.Id) OR (b.UserId=u.Id AND b.BlockedUserId=@u)) AND (a.PrivateAccount=0 OR EXISTS(SELECT 1 FROM CommunityMembers mine JOIN CommunityMembers theirs ON mine.CommunityId=theirs.CommunityId WHERE mine.UserId=@u AND theirs.UserId=u.Id AND mine.Status='ACTIVE' AND theirs.Status='ACTIVE'))`);res.json(r.recordset);
}));
