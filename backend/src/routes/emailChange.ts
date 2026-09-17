import {Router} from 'express';
import crypto from 'node:crypto';import bcrypt from 'bcryptjs';import {z} from 'zod';
import {getPool,sql} from '../config/db.js';import {env} from '../config/env.js';import {AppError,asyncHandler} from '../utils/errors.js';
import {sendEmailRecipient} from '../services/notifications.js';import {sendVerificationSms} from '../services/sms.js';
export const emailChangeRouter=Router();
const digest=(id:string,stage:string,code:string)=>crypto.createHmac('sha256',env.JWT_ACCESS_SECRET).update(id+':'+stage+':'+code).digest('hex');
async function mail(to:string,code:string,id:string){const r=await sendEmailRecipient({to,subject:'Confirm your CDA Connect email change',text:`Your email-change code is ${code}. It expires in 10 minutes. Do not share it.`},id);if(r.status!=='SENT')throw new AppError(503,'Verification email could not be confirmed. Start again in one minute.');}
emailChangeRouter.post('/account/email/start',asyncHandler(async(req,res)=>{
 const d=z.object({password:z.string().min(1).max(200),newEmail:z.string().trim().toLowerCase().email().max(255),method:z.enum(['email','phone']).default('email')}).parse(req.body),pool=await getPool();
 const u=(await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).query('SELECT Email,PasswordHash,Phone,PhoneVerified FROM Users WHERE Id=@u')).recordset[0];
 if(!u||!await bcrypt.compare(d.password,u.PasswordHash))throw new AppError(400,'Current password is incorrect');
 if(u.Email.toLowerCase()===d.newEmail)throw new AppError(400,'Enter a different email address');
 if(d.method==='phone'&&(!u.Phone||!u.PhoneVerified))throw new AppError(400,'Recovery needs an already-verified phone. Contact support if neither destination is accessible.');
 const id=crypto.randomUUID(),code=crypto.randomInt(100000,1000000).toString();
 try{await pool.request().input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,id).input('old',sql.NVarChar(255),u.Email).input('new',sql.NVarChar(255),d.newEmail).input('phone',sql.NVarChar(30),d.method==='phone'?u.Phone:null).input('hash',sql.Char(64),digest(id,'CURRENT',code)).query(`SET XACT_ABORT ON;BEGIN TRANSACTION;
 IF EXISTS(SELECT 1 FROM EmailChangeRequests WITH(UPDLOCK,HOLDLOCK) WHERE UserId=@u AND CreatedAt>DATEADD(second,-60,SYSUTCDATETIME())) THROW 51000,'Wait one minute before requesting another change',1;
 UPDATE EmailChangeRequests SET Stage='CANCELLED' WHERE UserId=@u AND CompletedAt IS NULL;
 INSERT INTO EmailChangeRequests(Id,UserId,OldEmail,NewEmail,RecoveryPhone,CodeHash,ExpiresAt) VALUES(@id,@u,@old,@new,@phone,@hash,DATEADD(minute,10,SYSUTCDATETIME()));COMMIT;`)}catch(e:any){if(e.number===51000)throw new AppError(429,'Wait one minute before requesting another change');throw e}
 if(d.method==='phone')await sendVerificationSms(u.Phone,code);else await mail(u.Email,code,id+'_current');
 res.status(202).json({requestId:id,stage:'CURRENT',destination:d.method==='phone'?'your verified phone':'your current email'});
}));
emailChangeRouter.post('/account/email/verify',asyncHandler(async(req,res)=>{
 const d=z.object({requestId:z.string().uuid(),code:z.string().regex(/^\d{6}$/)}).parse(req.body),pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin();let committed=false,newCode:string|undefined,row:any;
 try{row=(await new sql.Request(tx).input('id',sql.UniqueIdentifier,d.requestId).input('u',sql.UniqueIdentifier,req.user!.id).query(`SELECT r.* FROM EmailChangeRequests r WITH(UPDLOCK,HOLDLOCK) JOIN Users u ON u.Id=r.UserId WHERE r.Id=@id AND r.UserId=@u AND r.OldEmail=u.Email AND (r.RecoveryPhone IS NULL OR (u.Phone=r.RecoveryPhone AND u.PhoneVerified=1))`)).recordset[0];
 if(!row||!['CURRENT','NEW'].includes(row.Stage)||row.CompletedAt||new Date(row.ExpiresAt)<=new Date()||row.Attempts>=5)throw new AppError(400,'Verification expired or unavailable. Start again.');
 if(!crypto.timingSafeEqual(Buffer.from(row.CodeHash,'hex'),Buffer.from(digest(d.requestId,row.Stage,d.code),'hex'))){await new sql.Request(tx).input('id',sql.UniqueIdentifier,d.requestId).query('UPDATE EmailChangeRequests SET Attempts=Attempts+1 WHERE Id=@id');await tx.commit();committed=true;throw new AppError(400,'Incorrect verification code');}
 if(row.Stage==='CURRENT'){newCode=crypto.randomInt(100000,1000000).toString();await new sql.Request(tx).input('id',sql.UniqueIdentifier,d.requestId).input('hash',sql.Char(64),digest(d.requestId,'NEW',newCode)).query(`UPDATE EmailChangeRequests SET Stage='NEW',Attempts=0,CodeHash=@hash,ExpiresAt=DATEADD(minute,10,SYSUTCDATETIME()) WHERE Id=@id`);}
 else{await new sql.Request(tx).input('u',sql.UniqueIdentifier,req.user!.id).input('id',sql.UniqueIdentifier,d.requestId).input('new',sql.NVarChar(255),row.NewEmail).input('old',sql.NVarChar(255),row.OldEmail).input('family',sql.UniqueIdentifier,req.user!.sessionId).query(`UPDATE Users SET Email=@new,EmailVerified=1,SecurityHoldUntil=DATEADD(hour,24,SYSUTCDATETIME()),UpdatedAt=SYSUTCDATETIME() WHERE Id=@u;
 UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE UserId=@u AND (FamilyId<>@family OR FamilyId IS NULL) AND RevokedAt IS NULL;
 UPDATE EmailChangeRequests SET Stage='COMPLETED',CompletedAt=SYSUTCDATETIME() WHERE Id=@id;
 INSERT INTO SecurityMailOutbox(UserId,Destination,Subject,Body) VALUES(@u,@old,'Your CDA Connect email address changed','Your account email was changed after verification. Sensitive account actions are paused for 24 hours. If you did not request this, contact support immediately.');
 INSERT INTO AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(NULL,@u,'EMAIL_CHANGED','User',@u,'Verified email change; other sessions revoked; 24-hour security hold');`);}
 await tx.commit();committed=true;
 }catch(e){if(!committed)await tx.rollback();throw e}
 if(newCode){await mail(row.NewEmail,newCode,d.requestId+'_new');res.json({stage:'NEW'})}else res.json({stage:'COMPLETED',success:true,coolingOffHours:24});
}));
