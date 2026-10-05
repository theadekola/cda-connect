import {Router} from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {env} from '../config/env.js';
import {requireAuth} from '../middleware/auth.js';
import {hasSuperAdminPermission,requireRecentAuthentication,requireRecentPassword,requireSuperAdmin,requireSuperAdminPermission} from '../middleware/superAdmin.js';
import {operationalHealth} from '../services/operationalHealth.js';
import {sendEmailRecipient} from '../services/notifications.js';
import {disconnectCommunitySockets,disconnectUserSockets} from '../socket.js';
import {asyncHandler,AppError} from '../utils/errors.js';

export const superAdminRouter=Router();
superAdminRouter.use(requireAuth);
superAdminRouter.use(requireSuperAdmin);

const base32Decode=(input:string)=>{let bits=0,value=0;const out:number[]=[];for(const char of input.replace(/=|\s/g,'').toUpperCase()){const index='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.indexOf(char);if(index<0)continue;value=(value<<5)|index;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8}}return Buffer.from(out)};
const totp=(secret:string,time=Date.now())=>{const counter=Math.floor(time/30000),buffer=Buffer.alloc(8);buffer.writeBigUInt64BE(BigInt(counter));const digest=crypto.createHmac('sha1',base32Decode(secret)).update(buffer).digest(),offset=digest[19]&15;return (((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0'))};
const verifyTotp=(secret:string,code:string)=>[-1,0,1].some(step=>{const actual=Buffer.from(totp(secret,Date.now()+step*30000)),supplied=Buffer.from(code);return actual.length===supplied.length&&crypto.timingSafeEqual(actual,supplied)});
const decryptSecret=(value:string)=>{const[iv,tag,data]=value.split('.'),key=crypto.createHash('sha256').update(env.JWT_ACCESS_SECRET).digest(),decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8')};
const sets=(result:{recordsets:unknown})=>result.recordsets as Record<string,unknown>[][];
const normalized=(value:string)=>value.trim().replace(/\s+/g,' ').toLocaleLowerCase();
const dangerousAction=z.object({reason:z.string().trim().min(8).max(1000),confirmationName:z.string().trim().min(2).max(250)});

superAdminRouter.get('/mfa/status',asyncHandler(async(req,res)=>{
 const row=(await (await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).input('family',sql.UniqueIdentifier,req.user!.sessionId??null).query(`SELECT u.TwoFactorEnabled,u.TwoFactorMethod,CASE WHEN EXISTS(SELECT 1 FROM UserSessions s WHERE s.UserId=u.Id AND s.FamilyId=@family AND s.RevokedAt IS NULL AND s.ExpiresAt>SYSUTCDATETIME() AND s.ReauthenticatedAt>=DATEADD(minute,-10,SYSUTCDATETIME())) THEN 1 ELSE 0 END Verified FROM Users u WHERE u.Id=@u`)).recordset[0];
 res.set('Cache-Control','no-store').json({enabled:Boolean(row?.TwoFactorEnabled),method:row?.TwoFactorMethod??null,verified:Boolean(row?.Verified)});
}));

superAdminRouter.post('/mfa/challenge',asyncHandler(async(req,res)=>{
 const pool=await getPool(),row=(await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query("SELECT TwoFactorEnabled,TwoFactorMethod,TwoFactorSecret FROM Users WHERE Id=@u AND AccountStatus='ACTIVE' AND IsSuperAdmin=1")).recordset[0];
 if(!row?.TwoFactorEnabled||row.TwoFactorMethod!=='authenticator'||!row.TwoFactorSecret)return res.json({enabled:false,requiredMethod:'authenticator',verified:false});
 await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('family',sql.UniqueIdentifier,req.user!.sessionId??null).query('UPDATE UserSessions SET ReauthenticatedAt=NULL WHERE UserId=@u AND FamilyId=@family AND RevokedAt IS NULL');
 res.json({enabled:true,method:'authenticator',verified:false});
}));

superAdminRouter.post('/mfa/verify',asyncHandler(async(req,res)=>{
 const body=z.object({code:z.string().regex(/^\d{6}$/),challengeId:z.string().uuid().optional()}).parse(req.body),pool=await getPool();
 const row=(await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query("SELECT TwoFactorEnabled,TwoFactorMethod,TwoFactorSecret FROM Users WHERE Id=@u AND AccountStatus='ACTIVE' AND IsSuperAdmin=1")).recordset[0];
 if(!row?.TwoFactorEnabled||row.TwoFactorMethod!=='authenticator'||!row.TwoFactorSecret)throw new AppError(403,'Authenticator-app MFA must be enabled before opening the Super Admin dashboard');
 if(!verifyTotp(decryptSecret(row.TwoFactorSecret),body.code))throw new AppError(400,'Authenticator code is incorrect');
 const updated=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('family',sql.UniqueIdentifier,req.user!.sessionId??null).query('UPDATE UserSessions SET ReauthenticatedAt=SYSUTCDATETIME() OUTPUT INSERTED.Id WHERE UserId=@u AND FamilyId=@family AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME()');
 if(!updated.recordset[0])throw new AppError(401,'Current session is no longer active');
 await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,Details) VALUES(NULL,@u,'SUPER_ADMIN_MFA_VERIFIED','UserSession',N'{\"windowMinutes\":10}')");
 res.json({success:true,validForMinutes:10});
}));

superAdminRouter.use(requireRecentAuthentication);

superAdminRouter.post('/password/confirm',asyncHandler(async(req,res)=>{
 const {password}=z.object({password:z.string().min(1).max(500)}).parse(req.body),pool=await getPool();
 const row=(await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query("SELECT PasswordHash FROM Users WHERE Id=@u AND AccountStatus='ACTIVE' AND IsSuperAdmin=1")).recordset[0];
 if(!row||!(await bcrypt.compare(password,row.PasswordHash)))throw new AppError(401,'Password confirmation failed');
 const updated=await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('family',sql.UniqueIdentifier,req.user!.sessionId??null).query('UPDATE UserSessions SET PasswordConfirmedAt=SYSUTCDATETIME() OUTPUT INSERTED.Id WHERE UserId=@u AND FamilyId=@family AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME()');
 if(!updated.recordset[0])throw new AppError(401,'Current session is no longer active');
 await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,Details) VALUES(NULL,@u,'SUPER_ADMIN_PASSWORD_CONFIRMED','UserSession',N'{\"windowMinutes\":10}')");
 res.json({success:true,validForMinutes:10});
}));

superAdminRouter.get('/overview',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{
 const result=await (await getPool()).request().query(`SELECT (SELECT COUNT(*) FROM Users) TotalUsers,(SELECT COUNT(*) FROM Users WHERE AccountStatus='ACTIVE') ActiveUsers,(SELECT COUNT(*) FROM Communities) Communities,(SELECT COUNT(*) FROM CommunityVerificationRequests WHERE Status='PENDING') PendingVerifications,(SELECT COUNT(*) FROM PostReports WHERE Status='OPEN') UnresolvedReports,(SELECT COUNT(*) FROM NotificationOutbox WHERE Status='FAILED') QueueFailures,(SELECT COUNT(*) FROM SupportTickets WHERE Status='OPEN') OpenTickets,(SELECT COUNT(*) FROM SOSRequests WHERE Status='OPEN') ActiveEmergencies;SELECT TOP 12 a.Id,a.Action,a.EntityType,a.EntityId,a.CreatedAt,u.AuditId UserId FROM AuditLogs a JOIN Users u ON u.Id=a.UserId ORDER BY a.CreatedAt DESC`);
 const data=sets(result);res.set('Cache-Control','no-store').json({summary:data[0][0],activity:data[1]});
}));

superAdminRouter.get('/users',requireSuperAdminPermission('USER_PII_VIEW'),asyncHandler(async(req,res)=>{
 const search=z.string().trim().max(100).catch('').parse(req.query.search),status=z.enum(['ALL','ACTIVE','SUSPENDED','DEACTIVATED','DELETED']).catch('ALL').parse(req.query.status);
 const result=await (await getPool()).request().input('search',sql.NVarChar(102),`%${search.replaceAll('%','[%]').replaceAll('_','[_]')}%`).input('status',sql.NVarChar(30),status).query("SELECT TOP 200 Id,AuditId,FirstName,LastName,Email,Phone,AccountStatus,EmailVerified,PhoneVerified,TwoFactorEnabled,TwoFactorMethod,IsSuperAdmin,IsProtectedAccount,CreatedAt FROM Users WHERE (@status='ALL' OR AccountStatus=@status) AND (@search='%%' OR FirstName LIKE @search OR LastName LIKE @search OR Email LIKE @search) ORDER BY CreatedAt DESC");
 res.set('Cache-Control','no-store').json(result.recordset);
}));

superAdminRouter.get('/users/:userId',requireSuperAdminPermission('USER_PII_VIEW'),asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.userId),result=await (await getPool()).request().input('id',sql.UniqueIdentifier,id).query(`SELECT Id,AuditId,FirstName,LastName,Email,Phone,Country,State,LGA,Postcode,Address,DateOfBirth,AccountStatus,EmailVerified,PhoneVerified,TwoFactorEnabled,TwoFactorMethod,IsSuperAdmin,IsProtectedAccount,CreatedAt,UpdatedAt FROM Users WHERE Id=@id;SELECT TOP 50 Id,FamilyId,CreatedAt,ExpiresAt,RevokedAt,TrustedName,ReauthenticatedAt,PasswordConfirmedAt FROM UserSessions WHERE UserId=@id ORDER BY CreatedAt DESC;SELECT TOP 50 c.Id,c.Name,cm.Status,cm.JoinedAt FROM CommunityMembers cm JOIN Communities c ON c.Id=cm.CommunityId WHERE cm.UserId=@id ORDER BY cm.JoinedAt DESC;SELECT TOP 50 Action,EntityType,EntityId,CreatedAt FROM AuditLogs WHERE UserId=@id ORDER BY CreatedAt DESC`);
 const data=sets(result);if(!data[0][0])throw new AppError(404,'User not found');res.set('Cache-Control','no-store').json({user:data[0][0],sessions:data[1],communities:data[2],audit:data[3]});
}));

superAdminRouter.patch('/users/:userId/status',requireRecentPassword,requireSuperAdminPermission('SECURITY_AUDIT_VIEW'),asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.userId),body=dangerousAction.extend({status:z.enum(['ACTIVE','SUSPENDED'])}).parse(req.body),pool=await getPool();
 if(id===req.user!.id)throw new AppError(400,'You cannot suspend or reactivate your own account');
 const tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 let target:any;
 try{
  target=(await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).query('SELECT Id,FirstName,LastName,Email,AccountStatus,IsSuperAdmin,IsProtectedAccount FROM Users WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id')).recordset[0];
  if(!target)throw new AppError(404,'User not found');
  if(target.IsProtectedAccount)throw new AppError(403,'Protected accounts cannot be suspended or reactivated here');
  if(target.IsSuperAdmin&&!(await hasSuperAdminPermission(req.user!.id,'SUPER_ADMIN_MANAGE')))throw new AppError(403,'SUPER_ADMIN_MANAGE permission is required to manage another Super Admin');
  const fullName=`${target.FirstName} ${target.LastName}`.trim();
  if(normalized(body.confirmationName)!==normalized(fullName))throw new AppError(400,`Type ${fullName} to confirm this action`);
  if(target.AccountStatus===body.status)throw new AppError(409,`Account is already ${body.status.toLowerCase()}`);
  await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).input('status',sql.NVarChar(30),body.status).query("UPDATE Users SET AccountStatus=@status,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id;IF @status<>'ACTIVE' BEGIN UPDATE UserSessions SET RevokedAt=COALESCE(RevokedAt,SYSUTCDATETIME()),TrustedName=NULL WHERE UserId=@id;DELETE UserDevices WHERE UserId=@id;END");
  await new sql.Request(tx).input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,id).input('details',sql.NVarChar(sql.MAX),JSON.stringify({reason:body.reason,previousStatus:target.AccountStatus,newStatus:body.status})).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(NULL,@u,'SUPER_ADMIN_USER_STATUS_CHANGED','User',@id,@details)");
  await tx.commit();
 }catch(error){await tx.rollback().catch(()=>{});throw error}
 if(body.status!=='ACTIVE')disconnectUserSockets(id);
 const email=await sendEmailRecipient({to:target.Email,subject:`Your CDA Connect account is ${body.status==='ACTIVE'?'active again':'suspended'}`,text:`Hello ${target.FirstName},\n\nYour CDA Connect account status changed from ${target.AccountStatus} to ${body.status}.\nReason: ${body.reason}\n\nIf you believe this is incorrect, contact CDA Connect support.`},`user-status-${id}-${body.status}`);
 await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,id).input('details',sql.NVarChar(sql.MAX),JSON.stringify({status:body.status,emailDelivery:email.status,emailReason:email.reason??null})).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(NULL,@u,'SUPER_ADMIN_USER_STATUS_NOTICE','User',@id,@details)");
 res.json({success:true,status:body.status,message:`${target.FirstName} ${target.LastName} is now ${body.status.toLowerCase()}.`,emailDelivery:email.status});
}));

superAdminRouter.delete('/users/:userId/sessions',requireRecentPassword,requireSuperAdminPermission('SECURITY_AUDIT_VIEW'),asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.userId),body=dangerousAction.parse(req.body),pool=await getPool();if(id===req.user!.id)throw new AppError(400,'Use My Account to revoke your other sessions');
 const target=(await pool.request().input('id',sql.UniqueIdentifier,id).query('SELECT FirstName,LastName,Email,IsSuperAdmin,IsProtectedAccount FROM Users WHERE Id=@id')).recordset[0];if(!target)throw new AppError(404,'User not found');if(target.IsProtectedAccount)throw new AppError(403,'Protected-account sessions require the dedicated account security workflow');if(target.IsSuperAdmin&&!(await hasSuperAdminPermission(req.user!.id,'SUPER_ADMIN_MANAGE')))throw new AppError(403,'SUPER_ADMIN_MANAGE permission is required to manage another Super Admin');
 const fullName=`${target.FirstName} ${target.LastName}`.trim();if(normalized(body.confirmationName)!==normalized(fullName))throw new AppError(400,`Type ${fullName} to confirm this action`);
 const result=await pool.request().input('id',sql.UniqueIdentifier,id).query('UPDATE UserSessions SET RevokedAt=COALESCE(RevokedAt,SYSUTCDATETIME()),TrustedName=NULL OUTPUT INSERTED.Id WHERE UserId=@id AND RevokedAt IS NULL;DELETE UserDevices WHERE UserId=@id');disconnectUserSockets(id);
 await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,id).input('details',sql.NVarChar(sql.MAX),JSON.stringify({reason:body.reason,revokedSessions:result.recordset.length})).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(NULL,@u,'SUPER_ADMIN_USER_SESSIONS_REVOKED','User',@id,@details)");
 const email=await sendEmailRecipient({to:target.Email,subject:'Your CDA Connect sessions were revoked',text:`Hello ${target.FirstName},\n\nA CDA Connect security administrator revoked your active sessions and trusted devices.\nReason: ${body.reason}\n\nSign in again and contact support if you did not expect this action.`},`user-session-revoke-${id}-${Date.now()}`);
 res.json({success:true,revoked:result.recordset.length,message:`Sessions and trusted devices revoked for ${fullName}.`,emailDelivery:email.status});
}));

superAdminRouter.get('/communities',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 200 c.Id,c.AuditId,c.Name,c.CommunityType,c.Country,c.City,c.IsPrivate,c.IsVerified,c.PlatformStatus,c.SuspensionReason,c.CreatedAt,u.AuditId OwnerUserId,COUNT(cm.UserId) MemberCount FROM Communities c JOIN Users u ON u.Id=c.OwnerUserId LEFT JOIN CommunityMembers cm ON cm.CommunityId=c.Id AND cm.Status='ACTIVE' GROUP BY c.Id,c.AuditId,c.Name,c.CommunityType,c.Country,c.City,c.IsPrivate,c.IsVerified,c.PlatformStatus,c.SuspensionReason,c.CreatedAt,u.AuditId ORDER BY c.CreatedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/communities/:communityId',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(req,res)=>{const id=z.string().uuid().parse(req.params.communityId),result=await (await getPool()).request().input('id',sql.UniqueIdentifier,id).query(`SELECT c.Id,c.AuditId,c.Name,c.Description,c.CommunityType,c.Country,c.City,c.IsPrivate,c.IsVerified,c.PlatformStatus,c.SuspendedAt,c.SuspensionReason,c.CreatedAt,u.AuditId OwnerUserId,u.Id OwnerId,CONCAT(u.FirstName,' ',u.LastName) OwnerName,u.Email OwnerEmail FROM Communities c JOIN Users u ON u.Id=c.OwnerUserId WHERE c.Id=@id;SELECT TOP 100 u.AuditId UserId,u.FirstName,u.LastName,STRING_AGG(r.Name,', ') Roles,cm.Status,cm.JoinedAt FROM CommunityMembers cm JOIN Users u ON u.Id=cm.UserId LEFT JOIN CommunityMemberRoles cmr ON cmr.CommunityMemberId=cm.Id LEFT JOIN Roles r ON r.Id=cmr.RoleId WHERE cm.CommunityId=@id GROUP BY u.AuditId,u.FirstName,u.LastName,cm.Status,cm.JoinedAt ORDER BY cm.JoinedAt DESC;SELECT TOP 100 Action,EntityType,EntityId,Details,CreatedAt FROM AuditLogs WHERE CommunityId=@id ORDER BY CreatedAt DESC`),data=sets(result);if(!data[0][0])throw new AppError(404,'Community not found');res.set('Cache-Control','no-store').json({community:data[0][0],members:data[1],audit:data[2]})}));

superAdminRouter.patch('/communities/:communityId/status',requireRecentPassword,requireSuperAdminPermission('COMMUNITY_MANAGE'),asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.communityId),body=dangerousAction.extend({status:z.enum(['ACTIVE','RESTRICTED','SUSPENDED','ARCHIVED'])}).parse(req.body),pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);let community:any,recipients:any[]=[];
 try{
  community=(await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).query(`SELECT c.Id,c.Name,c.PlatformStatus,c.OwnerUserId,u.FirstName,u.Email OwnerEmail FROM Communities c WITH(UPDLOCK,HOLDLOCK) JOIN Users u ON u.Id=c.OwnerUserId WHERE c.Id=@id`)).recordset[0];
  if(!community)throw new AppError(404,'Community not found');
  if(normalized(body.confirmationName)!==normalized(community.Name))throw new AppError(400,`Type ${community.Name} to confirm this action`);
  if(community.PlatformStatus===body.status)throw new AppError(409,`Community is already ${body.status.toLowerCase()}`);
  await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).input('u',sql.UniqueIdentifier,req.user!.id).input('status',sql.NVarChar(20),body.status).input('reason',sql.NVarChar(1000),body.reason).query(`UPDATE Communities SET PlatformStatus=@status,SuspendedAt=CASE WHEN @status IN('RESTRICTED','SUSPENDED','ARCHIVED') THEN SYSUTCDATETIME() ELSE NULL END,SuspendedBy=CASE WHEN @status IN('RESTRICTED','SUSPENDED','ARCHIVED') THEN @u ELSE NULL END,SuspensionReason=CASE WHEN @status IN('RESTRICTED','SUSPENDED','ARCHIVED') THEN @reason ELSE NULL END,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id;IF @status IN('SUSPENDED','ARCHIVED') UPDATE NotificationOutbox SET Status='CANCELLED',CompletionReason='COMMUNITY_'+@status,CompletedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE CommunityId=@id AND Status IN('PENDING','PENDING_RETRY','QUEUED','DELAYED') AND NotificationType NOT LIKE '%EMERGENCY%' AND NotificationType NOT LIKE '%SOS%'`);
  recipients=(await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).query(`SELECT DISTINCT u.Id,u.FirstName,u.Email FROM CommunityMembers cm JOIN Users u ON u.Id=cm.UserId LEFT JOIN CommunityMemberRoles cmr ON cmr.CommunityMemberId=cm.Id LEFT JOIN Roles r ON r.Id=cmr.RoleId JOIN Communities c ON c.Id=cm.CommunityId WHERE cm.CommunityId=@id AND cm.Status='ACTIVE' AND u.Email IS NOT NULL AND (c.OwnerUserId=u.Id OR r.Name IN('Owner','Admin'))`)).recordset;
  await new sql.Request(tx).input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,id).input('details',sql.NVarChar(sql.MAX),JSON.stringify({reason:body.reason,previousStatus:community.PlatformStatus,newStatus:body.status})).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(@id,@u,'SUPER_ADMIN_COMMUNITY_STATUS_CHANGED','Community',@id,@details)");
  await tx.commit();
 }catch(error){await tx.rollback().catch(()=>{});throw error}
 if(body.status!=='ACTIVE')disconnectCommunitySockets(id);
 const emailResults=await Promise.all(recipients.map(recipient=>sendEmailRecipient({to:recipient.Email,subject:`${community.Name} is ${body.status.toLowerCase()}`,text:`Hello ${recipient.FirstName},\n\nThe platform status of ${community.Name} changed from ${community.PlatformStatus} to ${body.status}.\nReason: ${body.reason}\n\nExisting records remain available. Contact CDA Connect support if you need help.`},`community-status-${id}-${body.status}-${recipient.Id}`)));
 res.json({success:true,status:body.status,message:`${community.Name} is now ${body.status.toLowerCase()}.`,notices:{sent:emailResults.filter(x=>x.status==='SENT').length,total:emailResults.length}});
}));

superAdminRouter.patch('/communities/:communityId/verification',requireRecentPassword,requireSuperAdminPermission('COMMUNITY_MANAGE'),asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.communityId),body=dangerousAction.extend({verified:z.boolean()}).parse(req.body),pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);let community:any;
 try{community=(await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).query("SELECT c.Name,c.IsVerified,u.FirstName,u.Email OwnerEmail FROM Communities c WITH(UPDLOCK,HOLDLOCK) JOIN Users u ON u.Id=c.OwnerUserId WHERE c.Id=@id")).recordset[0];if(!community)throw new AppError(404,'Community not found');if(normalized(body.confirmationName)!==normalized(community.Name))throw new AppError(400,`Type ${community.Name} to confirm this action`);if(Boolean(community.IsVerified)===body.verified)throw new AppError(409,`Verification is already ${body.verified?'active':'revoked'}`);
  await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).input('verified',sql.Bit,body.verified).query("UPDATE Communities SET IsVerified=@verified,VerifiedAt=CASE WHEN @verified=1 THEN SYSUTCDATETIME() ELSE NULL END,UpdatedAt=SYSUTCDATETIME() WHERE Id=@id");
  await new sql.Request(tx).input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,id).input('details',sql.NVarChar(sql.MAX),JSON.stringify({reason:body.reason,previousVerified:Boolean(community.IsVerified),newVerified:body.verified})).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(@id,@u,'SUPER_ADMIN_COMMUNITY_VERIFICATION_CHANGED','Community',@id,@details)");await tx.commit();
 }catch(error){await tx.rollback().catch(()=>{});throw error}
 const email=await sendEmailRecipient({to:community.OwnerEmail,subject:`${community.Name} verification ${body.verified?'restored':'revoked'}`,text:`Hello ${community.FirstName},\n\nPlatform verification for ${community.Name} was ${body.verified?'restored':'revoked'}.\nReason: ${body.reason}\n\nContact CDA Connect support if you need help.`},`community-verification-${id}-${body.verified}`);
 res.json({success:true,verified:body.verified,message:`Verification ${body.verified?'restored for':'revoked from'} ${community.Name}.`,emailDelivery:email.status});
}));

superAdminRouter.post('/communities/:communityId/emergencies/end',requireRecentPassword,requireSuperAdminPermission('COMMUNITY_MANAGE'),asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.communityId),body=dangerousAction.parse(req.body),pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);let community:any,count=0;
 try{community=(await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).query('SELECT Name FROM Communities WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id')).recordset[0];if(!community)throw new AppError(404,'Community not found');if(normalized(body.confirmationName)!==normalized(community.Name))throw new AppError(400,`Type ${community.Name} to confirm this action`);
  const result=await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).input('reason',sql.NVarChar(2000),body.reason).query("UPDATE SOSRequests SET Status='RESOLVED',ResolvedAt=SYSUTCDATETIME(),ResolutionNote=@reason OUTPUT INSERTED.Id WHERE CommunityId=@id AND Status NOT IN('RESOLVED','CANCELLED')");count=result.recordset.length;
  await new sql.Request(tx).input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,id).input('details',sql.NVarChar(sql.MAX),JSON.stringify({reason:body.reason,resolvedBroadcasts:count})).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(@id,@u,'SUPER_ADMIN_EMERGENCIES_ENDED','Community',@id,@details)");await tx.commit();
 }catch(error){await tx.rollback().catch(()=>{});throw error}
 res.json({success:true,resolved:count,message:`${count} active emergency broadcast${count===1?'':'s'} ended for ${community.Name}.`});
}));
superAdminRouter.get('/verifications',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 200 v.Id,c.AuditId CommunityId,c.Name CommunityName,v.OrganisationName,v.RegistrationNumber,v.Status,v.ReviewNotes,v.ReviewedAt,v.CreatedAt FROM CommunityVerificationRequests v JOIN Communities c ON c.Id=v.CommunityId ORDER BY CASE WHEN v.Status='PENDING' THEN 0 ELSE 1 END,v.CreatedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/moderation',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 200 q.Id,q.CommunityId,q.EntityType,q.EntityId,q.ReasonCode,q.Confidence,q.Status,q.ReviewedAt,q.CreatedAt FROM ModerationQueue q ORDER BY CASE WHEN q.Status='PENDING_REVIEW' THEN 0 ELSE 1 END,q.CreatedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/finance',requireSuperAdminPermission('FINANCE_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 200 * FROM AuditContributions ORDER BY SubmittedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/finance/payments/:paymentId',requireSuperAdminPermission('FINANCE_AUDIT_VIEW'),asyncHandler(async(req,res)=>{const id=z.coerce.number().int().positive().parse(req.params.paymentId),result=await (await getPool()).request().input('id',sql.BigInt,id).query(`SELECT TOP 1 * FROM AuditContributions WHERE ContributionId=@id`);if(!result.recordset[0])throw new AppError(404,'Payment record not found');res.json(result.recordset[0])}));
superAdminRouter.get('/emergencies',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 200 s.Id,c.AuditId CommunityId,s.Message,s.ApproximateArea,s.Status,s.ResolvedAt,s.CreatedAt FROM SOSRequests s JOIN Communities c ON c.Id=s.CommunityId ORDER BY CASE WHEN s.Status='OPEN' THEN 0 ELSE 1 END,s.CreatedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/notifications',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 200 NotificationId,NotificationType,Status,AttemptCount,LastError,QueuedAt,DispatchedAt,CompletedAt,CreatedAt FROM NotificationOutbox ORDER BY CreatedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/queues',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{res.json(await operationalHealth())}));
superAdminRouter.get('/system-health',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const started=Date.now();await (await getPool()).request().query('SELECT 1 ok');res.json({api:'healthy',database:'healthy',responseMs:Date.now()-started,...await operationalHealth()})}));
superAdminRouter.get('/support',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 200 t.Id,u.AuditId UserId,t.Category,t.Subject,t.Status,t.CreatedAt,t.UpdatedAt FROM SupportTickets t JOIN Users u ON u.Id=t.UserId ORDER BY CASE WHEN t.Status='OPEN' THEN 0 ELSE 1 END,t.UpdatedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/audit-logs',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 500 a.Id,u.AuditId UserId,a.Action,a.EntityType,a.EntityId,a.CommunityId,a.CreatedAt FROM AuditLogs a JOIN Users u ON u.Id=a.UserId ORDER BY a.CreatedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/security',requireSuperAdminPermission('SECURITY_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 300 s.Id,u.AuditId UserId,s.TrustedName,s.CreatedAt,s.ExpiresAt,s.RevokedAt,s.ReauthenticatedAt,s.PasswordConfirmedAt FROM UserSessions s JOIN Users u ON u.Id=s.UserId ORDER BY s.CreatedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/administrators',requireSuperAdminPermission('SECURITY_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT u.Id,u.AuditId,u.FirstName,u.LastName,u.Email,u.AccountStatus,u.TwoFactorEnabled,u.TwoFactorMethod,u.IsProtectedAccount,u.CreatedAt FROM Users u WHERE u.IsSuperAdmin=1 ORDER BY u.IsProtectedAccount DESC,u.CreatedAt`);res.json(result.recordset)}));
superAdminRouter.get('/roles',requireSuperAdminPermission('SECURITY_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT p.UserId,u.AuditId,u.FirstName,u.LastName,p.PermissionCode,p.GrantedAt FROM SuperAdminPermissionAssignments p JOIN Users u ON u.Id=p.UserId ORDER BY u.AuditId,p.PermissionCode`);res.json(result.recordset)}));
superAdminRouter.get('/privacy',requireSuperAdminPermission('USER_PII_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT TOP 200 d.Id,u.AuditId UserId,d.Status,d.CreatedAt,d.CompletedAt,d.ExpiresAt FROM DataExportRequests d JOIN Users u ON u.Id=d.UserId ORDER BY d.CreatedAt DESC`);res.json(result.recordset)}));
superAdminRouter.get('/analytics',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{const result=await (await getPool()).request().query(`SELECT CONVERT(date,CreatedAt) [Date],COUNT(*) Registrations FROM Users WHERE CreatedAt>=DATEADD(day,-30,SYSUTCDATETIME()) GROUP BY CONVERT(date,CreatedAt) ORDER BY [Date];SELECT CONVERT(date,CreatedAt) [Date],COUNT(*) Communities FROM Communities WHERE CreatedAt>=DATEADD(day,-30,SYSUTCDATETIME()) GROUP BY CONVERT(date,CreatedAt) ORDER BY [Date]`),data=sets(result);res.json({registrations:data[0],communities:data[1]})}));
superAdminRouter.get('/settings',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{res.json({registration:'enabled',maintenanceMode:false,uploadStorage:env.STORAGE_DRIVER,publicBaseUrl:env.PUBLIC_BASE_URL})}));
superAdminRouter.get('/integrations',requireSuperAdminPermission('SECURITY_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{res.json({database:{configured:true},redis:{configured:Boolean(env.REDIS_URL)},email:{configured:Boolean(env.SMTP_USER||env.EMAIL_PROVIDER_URL)},sms:{configured:Boolean(env.TWILIO_ACCOUNT_SID||env.TERMII_API_KEY)},push:{configured:Boolean(env.VAPID_PUBLIC_KEY||env.FCM_SERVICE_ACCOUNT_FILE)},storage:{provider:env.STORAGE_DRIVER,configured:env.STORAGE_DRIVER==='local'||Boolean(env.STORAGE_BUCKET)},turn:{configured:env.RTC_ICE_SERVERS.includes('turn:')}})}));
superAdminRouter.get('/account',asyncHandler(async(req,res)=>{const result=await (await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).input('family',sql.UniqueIdentifier,req.user!.sessionId??null).query(`SELECT Id,AuditId,FirstName,LastName,Email,AccountStatus,TwoFactorEnabled,TwoFactorMethod,IsProtectedAccount,CreatedAt FROM Users WHERE Id=@u;SELECT Id,TrustedName,CreatedAt,ExpiresAt,RevokedAt,ReauthenticatedAt,PasswordConfirmedAt,CASE WHEN FamilyId=@family THEN 1 ELSE 0 END IsCurrent FROM UserSessions WHERE UserId=@u ORDER BY CreatedAt DESC;SELECT TOP 50 Action,EntityType,EntityId,CreatedAt FROM AuditLogs WHERE UserId=@u ORDER BY CreatedAt DESC`),data=sets(result);res.json({user:data[0][0],sessions:data[1],activity:data[2]})}));
superAdminRouter.delete('/account/sessions',requireRecentPassword,asyncHandler(async(req,res)=>{const result=await (await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).input('family',sql.UniqueIdentifier,req.user!.sessionId??null).query('UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() OUTPUT INSERTED.Id WHERE UserId=@u AND FamilyId<>@family AND RevokedAt IS NULL');res.json({success:true,revoked:result.recordset.length})}));
superAdminRouter.put('/account/password',requireRecentPassword,asyncHandler(async(req,res)=>{const {password}=z.object({password:z.string().min(12).max(200).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/)}).parse(req.body),pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin();try{const hash=await bcrypt.hash(password,12),request=new sql.Request(tx);await request.input('u',sql.UniqueIdentifier,req.user!.id).input('family',sql.UniqueIdentifier,req.user!.sessionId??null).input('hash',sql.NVarChar(500),hash).query(`EXEC sys.sp_set_session_context @key=N'ProtectedAccountSecurityChange',@value=1;UPDATE Users SET PasswordHash=@hash,UpdatedAt=SYSUTCDATETIME() WHERE Id=@u AND IsProtectedAccount=1;UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE UserId=@u AND FamilyId<>@family;EXEC sys.sp_set_session_context @key=N'ProtectedAccountSecurityChange',@value=NULL;`);await new sql.Request(tx).input('u',sql.UniqueIdentifier,req.user!.id).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType) VALUES(NULL,@u,'PROTECTED_ACCOUNT_PASSWORD_CHANGED','User')");await tx.commit();res.json({success:true})}catch(error){await tx.rollback();throw error}}));

superAdminRouter.post('/access',requireRecentAuthentication,requireRecentPassword,asyncHandler(async(req,res)=>{
 const body=z.object({mode:z.enum(['SUPPORT','BREAK_GLASS']),communityId:z.string().uuid().optional(),reason:z.string().trim().min(12).max(1000)}).parse(req.body);
 if(body.mode==='BREAK_GLASS'&&!body.communityId)throw new AppError(400,'Break-glass access must be limited to one community');
 const pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
  const expiresAt=new Date(Date.now()+(body.mode==='SUPPORT'?30:15)*60_000);
  const grant=(await new sql.Request(tx).input('u',sql.UniqueIdentifier,req.user!.id).input('c',sql.UniqueIdentifier,body.communityId??null).input('mode',sql.NVarChar(20),body.mode).input('reason',sql.NVarChar(1000),body.reason).input('expires',sql.DateTime2,expiresAt)
   .query("INSERT SuperAdminAccessGrants(UserId,CommunityId,AccessMode,Reason,ConfirmedAt,ExpiresAt) OUTPUT INSERTED.Id,INSERTED.AccessMode,INSERTED.CommunityId,INSERTED.ExpiresAt VALUES(@u,@c,@mode,@reason,SYSUTCDATETIME(),@expires)")).recordset[0];
  await new sql.Request(tx).input('u',sql.UniqueIdentifier,req.user!.id).input('c',sql.UniqueIdentifier,body.communityId??null).input('id',sql.UniqueIdentifier,grant.Id).input('details',sql.NVarChar(sql.MAX),JSON.stringify({mode:body.mode,reason:body.reason,expiresAt:expiresAt.toISOString()}))
   .query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(@c,@u,'SUPER_ADMIN_ACCESS_STARTED','SuperAdminAccessGrant',@id,@details)");
  await tx.commit();res.status(201).json(grant);
 }catch(error){await tx.rollback();throw error}
}));

superAdminRouter.get('/access',asyncHandler(async(req,res)=>{
 const result=await (await getPool()).request().input('u',sql.UniqueIdentifier,req.user!.id).query('SELECT Id,CommunityId,AccessMode,Reason,ConfirmedAt,ExpiresAt,RevokedAt,CreatedAt FROM SuperAdminAccessGrants WHERE UserId=@u ORDER BY CreatedAt DESC');
 res.set('Cache-Control','no-store').json(result.recordset);
}));

superAdminRouter.delete('/access/:grantId',requireRecentAuthentication,asyncHandler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.grantId),pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin();
 try{
  const grant=(await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).input('u',sql.UniqueIdentifier,req.user!.id).query('UPDATE SuperAdminAccessGrants SET RevokedAt=SYSUTCDATETIME() OUTPUT INSERTED.CommunityId WHERE Id=@id AND UserId=@u AND RevokedAt IS NULL')).recordset[0];
  if(!grant)throw new AppError(404,'Active access grant not found');
  await new sql.Request(tx).input('u',sql.UniqueIdentifier,req.user!.id).input('c',sql.UniqueIdentifier,grant.CommunityId??null).input('id',sql.UniqueIdentifier,id).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,EntityId) VALUES(@c,@u,'SUPER_ADMIN_ACCESS_REVOKED','SuperAdminAccessGrant',@id)");
  await tx.commit();res.json({success:true});
 }catch(error){await tx.rollback();throw error}
}));

superAdminRouter.get('/audit/users',requireSuperAdminPermission('PLATFORM_AUDIT_VIEW'),asyncHandler(async(_req,res)=>{
 const result=await (await getPool()).request().query('SELECT TOP 500 * FROM AuditUsers ORDER BY CreatedAt DESC');res.set('Cache-Control','no-store').json(result.recordset);
}));
superAdminRouter.get('/audit/users/pii',requireSuperAdminPermission('USER_PII_VIEW','SUPPORT'),asyncHandler(async(_req,res)=>{
 const result=await (await getPool()).request().query('SELECT TOP 500 * FROM AuditUserPII ORDER BY UserId DESC');res.set('Cache-Control','no-store').json(result.recordset);
}));
superAdminRouter.get('/audit/finance/:communityId',requireSuperAdminPermission('FINANCE_AUDIT_VIEW','SUPPORT'),asyncHandler(async(req,res)=>{
 const result=await (await getPool()).request().input('c',sql.UniqueIdentifier,req.params.communityId).query('SELECT TOP 500 a.* FROM AuditContributions a JOIN AuditCommunities c ON c.CommunityId=a.CommunityId WHERE c.InternalId=@c ORDER BY a.SubmittedAt DESC');res.set('Cache-Control','no-store').json(result.recordset);
}));
superAdminRouter.get('/audit/security',requireSuperAdminPermission('SECURITY_AUDIT_VIEW','SUPPORT'),asyncHandler(async(_req,res)=>{
 const result=await (await getPool()).request().query('SELECT TOP 500 * FROM AuditSecurity ORDER BY CreatedAt DESC');res.set('Cache-Control','no-store').json(result.recordset);
}));
