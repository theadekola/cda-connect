import {emailVerificationRouter} from './emailVerification.js';
import {verifyRegistrationIdentity} from '../utils/registration.js';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getPool, sql } from '../config/db.js';
import { asyncHandler, AppError } from '../utils/errors.js';
import { hashToken, signAccess, signRefresh, verifyRefresh } from '../utils/auth.js';
import { env } from '../config/env.js';
import {normalizePhone,sendVerificationSms} from '../services/sms.js';
import {sendEmailBatch} from '../services/notifications.js';
import {requireAuth} from '../middleware/auth.js';

export const authRouter=Router();
authRouter.use(emailVerificationRouter);
const verificationHash=(phone:string,code:string)=>hashToken(`${phone}:${code}:${env.JWT_ACCESS_SECRET}`);
const base32Alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32Encode=(input:Buffer)=>{let bits=0,value=0,out='';for(const byte of input){value=(value<<8)|byte;bits+=8;while(bits>=5){out+=base32Alphabet[(value>>>(bits-5))&31];bits-=5}}if(bits)out+=base32Alphabet[(value<<(5-bits))&31];return out};
const base32Decode=(input:string)=>{let bits=0,value=0;const out:number[]=[];for(const char of input.replace(/=|\s/g,'').toUpperCase()){const index=base32Alphabet.indexOf(char);if(index<0)continue;value=(value<<5)|index;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8}}return Buffer.from(out)};
const totp=(secret:string,time=Date.now())=>{const counter=Math.floor(time/30000);const buffer=Buffer.alloc(8);buffer.writeBigUInt64BE(BigInt(counter));const digest=crypto.createHmac('sha1',base32Decode(secret)).update(buffer).digest();const offset=digest[19]&15;return (((digest.readUInt32BE(offset)&0x7fffffff)%1000000).toString().padStart(6,'0'))};
const verifyTotp=(secret:string,code:string)=>[-1,0,1].some(step=>{const actual=Buffer.from(totp(secret,Date.now()+step*30000));const supplied=Buffer.from(code);return actual.length===supplied.length&&crypto.timingSafeEqual(actual,supplied)});
const secretKey=()=>crypto.createHash('sha256').update(env.JWT_ACCESS_SECRET).digest();
const encryptSecret=(value:string)=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secretKey(),iv),encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`};
const decryptSecret=(value:string)=>{const[iv,tag,data]=value.split('.');const decipher=crypto.createDecipheriv('aes-256-gcm',secretKey(),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8')};
async function createSmsChallenge(pool:any,userId:string,phone:string,purpose:string){const code=crypto.randomInt(100000,1000000).toString(),expires=new Date(Date.now()+env.SMS_CODE_EXPIRES_MINUTES*60000);const result=await pool.request().input('uid',sql.UniqueIdentifier,userId).input('purpose',sql.NVarChar(30),purpose).input('hash',sql.NVarChar(64),verificationHash(userId,code)).input('expires',sql.DateTime2,expires).query('INSERT INTO TwoFactorChallenges(UserId,Purpose,CodeHash,ExpiresAt) OUTPUT INSERTED.Id VALUES(@uid,@purpose,@hash,@expires)');const challengeId=result.recordset[0].Id as string;try{await sendVerificationSms(phone,code)}catch(error){await pool.request().input('id',sql.UniqueIdentifier,challengeId).query('DELETE FROM TwoFactorChallenges WHERE Id=@id');throw error}return challengeId}
async function verifySmsChallenge(pool:any,userId:string,challengeId:string,purpose:string,code:string){const result=await pool.request().input('id',sql.UniqueIdentifier,challengeId).input('uid',sql.UniqueIdentifier,userId).input('purpose',sql.NVarChar(30),purpose).query('SELECT CodeHash,Attempts,ExpiresAt,ConsumedAt FROM TwoFactorChallenges WHERE Id=@id AND UserId=@uid AND Purpose=@purpose');const row=result.recordset[0];if(!row||row.ConsumedAt||new Date(row.ExpiresAt)<=new Date())throw new AppError(400,'Verification code is invalid or expired');if(row.Attempts>=5)throw new AppError(429,'Too many incorrect attempts');const actual=Buffer.from(verificationHash(userId,code),'hex'),expected=Buffer.from(row.CodeHash,'hex');if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected)){await pool.request().input('id',sql.UniqueIdentifier,challengeId).query('UPDATE TwoFactorChallenges SET Attempts=Attempts+1 WHERE Id=@id');throw new AppError(400,'Verification code is incorrect')}await pool.request().input('id',sql.UniqueIdentifier,challengeId).query('UPDATE TwoFactorChallenges SET ConsumedAt=SYSUTCDATETIME() WHERE Id=@id')}
async function issueSession(pool:any,row:any){if(row.AccountStatus!=='ACTIVE')throw new AppError(403,'Account is not active');const user={id:row.Id,email:row.Email},accessToken=signAccess(user),refreshToken=signRefresh(user);await pool.request().input('uid',sql.UniqueIdentifier,user.id).input('hash',sql.NVarChar(64),hashToken(refreshToken)).input('exp',sql.DateTime2,new Date(Date.now()+env.JWT_REFRESH_EXPIRES_DAYS*86400000)).query('INSERT INTO UserSessions(UserId,RefreshTokenHash,ExpiresAt) VALUES(@uid,@hash,@exp)');delete row.PasswordHash;delete row.TwoFactorSecret;return{user:row,accessToken,refreshToken}}

authRouter.post('/phone-verification/request',asyncHandler(async(req,res)=>{
  const phone=normalizePhone(z.object({phone:z.string().min(8).max(30)}).parse(req.body).phone);const pool=await getPool();
  const existing=await pool.request().input('phone',sql.NVarChar(30),phone).query('SELECT Id FROM Users WHERE Phone=@phone');
  if(existing.recordset[0]) throw new AppError(409,'This phone number is already registered');
  const previous=await pool.request().input('phone',sql.NVarChar(30),phone).query('SELECT SentAt FROM PhoneVerificationCodes WHERE Phone=@phone AND ConsumedAt IS NULL');
  if(previous.recordset[0]){const wait=env.SMS_RESEND_SECONDS-Math.floor((Date.now()-new Date(previous.recordset[0].SentAt).getTime())/1000);if(wait>0) throw new AppError(429,`Please wait ${wait} seconds before requesting another code`)}
  const code=crypto.randomInt(100000,1000000).toString();const expires=new Date(Date.now()+env.SMS_CODE_EXPIRES_MINUTES*60000);
  await pool.request().input('phone',sql.NVarChar(30),phone).input('hash',sql.NVarChar(64),verificationHash(phone,code)).input('expires',sql.DateTime2,expires).query(`MERGE PhoneVerificationCodes AS t USING(SELECT @phone Phone)s ON t.Phone=s.Phone WHEN MATCHED THEN UPDATE SET CodeHash=@hash,Attempts=0,SentAt=SYSUTCDATETIME(),ExpiresAt=@expires,ConsumedAt=NULL WHEN NOT MATCHED THEN INSERT(Phone,CodeHash,ExpiresAt) VALUES(@phone,@hash,@expires);`);
  try{await sendVerificationSms(phone,code)}catch(error){await pool.request().input('phone',sql.NVarChar(30),phone).query('DELETE FROM PhoneVerificationCodes WHERE Phone=@phone AND ConsumedAt IS NULL');throw error}
  res.status(202).json({success:true,expiresInSeconds:env.SMS_CODE_EXPIRES_MINUTES*60,resendAfterSeconds:env.SMS_RESEND_SECONDS});
}));

authRouter.post('/phone-verification/verify',asyncHandler(async(req,res)=>{
  const d=z.object({phone:z.string().min(8).max(30),code:z.string().regex(/^\d{6}$/)}).parse(req.body);const phone=normalizePhone(d.phone);const pool=await getPool();
  const result=await pool.request().input('phone',sql.NVarChar(30),phone).query('SELECT CodeHash,Attempts,ExpiresAt,ConsumedAt FROM PhoneVerificationCodes WHERE Phone=@phone');const row=result.recordset[0];
  if(!row||row.ConsumedAt||new Date(row.ExpiresAt)<=new Date()) throw new AppError(400,'Verification code is invalid or expired');
  if(row.Attempts>=5) throw new AppError(429,'Too many incorrect attempts. Request a new code');
  const actual=Buffer.from(verificationHash(phone,d.code),'hex');const expected=Buffer.from(row.CodeHash,'hex');
  if(actual.length!==expected.length||!crypto.timingSafeEqual(actual,expected)){await pool.request().input('phone',sql.NVarChar(30),phone).query('UPDATE PhoneVerificationCodes SET Attempts=Attempts+1 WHERE Phone=@phone');throw new AppError(400,'Verification code is incorrect')}
  await pool.request().input('phone',sql.NVarChar(30),phone).query('UPDATE PhoneVerificationCodes SET ConsumedAt=SYSUTCDATETIME() WHERE Phone=@phone');
  const verificationToken=jwt.sign({purpose:'phone-verification',phone},env.JWT_ACCESS_SECRET,{expiresIn:'15m'});res.json({success:true,verificationToken});
}));

const registerSchema=z.object({firstName:z.string().trim().min(2).max(100),lastName:z.string().trim().min(2).max(100),email:z.string().trim().toLowerCase().email(),phone:z.string().trim().min(8).max(30).optional(),verificationMethod:z.enum(['sms','email']).default('sms'),phoneVerificationToken:z.string().min(1).optional(),emailVerificationToken:z.string().min(1).optional(),country:z.string().trim().min(2).max(100),state:z.string().trim().min(1).max(100),lga:z.string().trim().min(1).max(150).optional(),postcode:z.string().trim().min(1).max(30).optional(),address:z.string().trim().min(2,'Enter your area or community').max(500),dateOfBirth:z.coerce.date().max(new Date()),password:z.string().min(8).max(200)});
authRouter.post('/register',asyncHandler(async(req,res)=>{
  const d=registerSchema.parse(req.body); const pool=await getPool(); const email=d.email.trim().toLowerCase();const phone=d.phone?normalizePhone(d.phone):null;
  const verified=verifyRegistrationIdentity({...d,email,phone});
  const exists=await pool.request().input('email',sql.NVarChar(255),email).input('phone',sql.NVarChar(30),phone).query('SELECT TOP 1 Email,Phone FROM Users WHERE Email=@email OR Phone=@phone');
  if(exists.recordset[0]?.Email?.toLowerCase()===email) throw new AppError(409,'This email address is already registered');
  if(exists.recordset[0]?.Phone===phone) throw new AppError(409,'This phone number is already registered');
  const passwordHash=await bcrypt.hash(d.password,12);
  const tx=new sql.Transaction(pool);await tx.begin();
  try{
    const request=new sql.Request(tx).input('first',sql.NVarChar(100),d.firstName.trim()).input('last',sql.NVarChar(100),d.lastName.trim()).input('email',sql.NVarChar(255),email).input('phone',sql.NVarChar(30),phone).input('country',sql.NVarChar(100),d.country.trim()).input('state',sql.NVarChar(100),d.state.trim()).input('lga',sql.NVarChar(150),d.lga?.trim()??null).input('postcode',sql.NVarChar(30),d.postcode?.trim()??null).input('address',sql.NVarChar(500),d.address.trim()).input('dob',sql.Date,d.dateOfBirth).input('hash',sql.NVarChar(500),passwordHash).input('phoneVerified',sql.Bit,verified.phoneVerified?1:0).input('emailVerified',sql.Bit,verified.emailVerified?1:0);
    const r=await request.query(`INSERT INTO Users(FirstName,LastName,Email,Phone,Country,State,LGA,Postcode,Address,DateOfBirth,PasswordHash,PhoneVerified,EmailVerified) OUTPUT INSERTED.Id,INSERTED.FirstName,INSERTED.LastName,INSERTED.Email,INSERTED.Phone,INSERTED.ProfileImage,INSERTED.CoverImage,INSERTED.Country,INSERTED.State,INSERTED.LGA,INSERTED.Postcode,INSERTED.Address,INSERTED.DateOfBirth,INSERTED.CreatedAt VALUES(@first,@last,@email,@phone,@country,@state,@lga,@postcode,@address,@dob,@hash,@phoneVerified,@emailVerified)`);
    const user={id:r.recordset[0].Id,email:r.recordset[0].Email}; const accessToken=signAccess(user); const refreshToken=signRefresh(user);
    await new sql.Request(tx).input('uid',sql.UniqueIdentifier,user.id).input('hash',sql.NVarChar(64),hashToken(refreshToken)).input('exp',sql.DateTime2,new Date(Date.now()+env.JWT_REFRESH_EXPIRES_DAYS*86400000)).query('INSERT INTO UserSessions(UserId,RefreshTokenHash,ExpiresAt) VALUES(@uid,@hash,@exp)');
    await tx.commit();res.status(201).json({user:r.recordset[0],accessToken,refreshToken});
  }catch(error:any){await tx.rollback();const number=Number(error?.number??error?.originalError?.info?.number);if(number===2601||number===2627){const duplicatePhone=String(error?.message??'').toLowerCase().includes('phone');throw new AppError(409,duplicatePhone?'This phone number is already registered':'This email address is already registered')}throw error}
}));
const loginSchema=z.object({email:z.string().email(),password:z.string().min(1)});
authRouter.post('/login',asyncHandler(async(req,res)=>{
  const d=loginSchema.parse(req.body); const pool=await getPool(); const r=await pool.request().input('email',sql.NVarChar(255),d.email.toLowerCase()).query(`SELECT TOP 1 Id,FirstName,LastName,Email,Phone,PasswordHash,ProfileImage,CoverImage,Country,State,LGA,Postcode,Address,DateOfBirth,CreatedAt,AccountStatus,TwoFactorEnabled,TwoFactorMethod FROM Users WHERE Email=@email`);
  const row=r.recordset[0]; if(!row||!(await bcrypt.compare(d.password,row.PasswordHash))) throw new AppError(401,'Invalid email or password'); if(row.AccountStatus!=='ACTIVE') throw new AppError(403,'Account is not active');
  if(row.TwoFactorEnabled){let challengeId:string|undefined;if(row.TwoFactorMethod==='sms'){if(!row.Phone)throw new AppError(400,'No phone number is available for SMS verification');challengeId=await createSmsChallenge(pool,row.Id,row.Phone,'login')}const challengeToken=jwt.sign({purpose:'two-factor-login',id:row.Id,email:row.Email,method:row.TwoFactorMethod,challengeId},env.JWT_ACCESS_SECRET,{expiresIn:'10m'});return res.json({requiresTwoFactor:true,method:row.TwoFactorMethod,challengeToken})}
  res.json(await issueSession(pool,row));
}));
authRouter.post('/login/two-factor',asyncHandler(async(req,res)=>{const d=z.object({challengeToken:z.string(),code:z.string().regex(/^\d{6}$/)}).parse(req.body);let challenge:{purpose?:string;id?:string;method?:string;challengeId?:string};try{challenge=jwt.verify(d.challengeToken,env.JWT_ACCESS_SECRET) as typeof challenge}catch{throw new AppError(401,'Two-factor challenge has expired')}if(challenge.purpose!=='two-factor-login'||!challenge.id)throw new AppError(401,'Invalid two-factor challenge');const pool=await getPool(),result=await pool.request().input('uid',sql.UniqueIdentifier,challenge.id).query('SELECT TOP 1 Id,FirstName,LastName,Email,Phone,PasswordHash,ProfileImage,CoverImage,Country,State,LGA,Postcode,Address,DateOfBirth,CreatedAt,AccountStatus,TwoFactorEnabled,TwoFactorMethod,TwoFactorSecret FROM Users WHERE Id=@uid'),row=result.recordset[0];if(!row||!row.TwoFactorEnabled||row.TwoFactorMethod!==challenge.method)throw new AppError(401,'Two-factor authentication is no longer active');if(row.TwoFactorMethod==='sms')await verifySmsChallenge(pool,row.Id,challenge.challengeId||'', 'login',d.code);else if(!row.TwoFactorSecret||!verifyTotp(decryptSecret(row.TwoFactorSecret),d.code))throw new AppError(400,'Authenticator code is incorrect');res.json(await issueSession(pool,row))}));

authRouter.post('/password-reset/request',asyncHandler(async(req,res)=>{
  const phone=normalizePhone(z.object({phone:z.string().min(8).max(30)}).parse(req.body).phone),pool=await getPool();
  const result=await pool.request().input('phone',sql.NVarChar(30),phone).query("SELECT TOP 1 Id,Phone FROM Users WHERE Phone=@phone AND AccountStatus='ACTIVE'");
  const user=result.recordset[0];
  if(!user)return res.status(202).json({success:true,expiresInSeconds:env.SMS_CODE_EXPIRES_MINUTES*60,resendAfterSeconds:env.SMS_RESEND_SECONDS,resetToken:jwt.sign({purpose:'password-reset-unavailable'},env.JWT_ACCESS_SECRET,{expiresIn:'10m'})});
  const recent=await pool.request().input('uid',sql.UniqueIdentifier,user.Id).input('purpose',sql.NVarChar(30),'password-reset').query('SELECT TOP 1 CreatedAt FROM TwoFactorChallenges WHERE UserId=@uid AND Purpose=@purpose AND ConsumedAt IS NULL ORDER BY CreatedAt DESC');
  if(recent.recordset[0]){const wait=env.SMS_RESEND_SECONDS-Math.floor((Date.now()-new Date(recent.recordset[0].CreatedAt).getTime())/1000);if(wait>0)throw new AppError(429,`Please wait ${wait} seconds before requesting another code`)}
  const challengeId=await createSmsChallenge(pool,user.Id,phone,'password-reset');
  const resetToken=jwt.sign({purpose:'password-reset',id:user.Id,phone,challengeId},env.JWT_ACCESS_SECRET,{expiresIn:`${env.SMS_CODE_EXPIRES_MINUTES}m`});
  res.status(202).json({success:true,expiresInSeconds:env.SMS_CODE_EXPIRES_MINUTES*60,resendAfterSeconds:env.SMS_RESEND_SECONDS,resetToken});
}));

authRouter.post('/password-reset/complete',asyncHandler(async(req,res)=>{
  const d=z.object({resetToken:z.string().min(1),code:z.string().regex(/^\d{6}$/),newPassword:z.string().min(8).max(200).regex(/[A-Z]/,'Password requires an uppercase letter').regex(/[a-z]/,'Password requires a lowercase letter').regex(/\d/,'Password requires a number').regex(/[^A-Za-z0-9]/,'Password requires a special character')}).parse(req.body);
  let challenge:{purpose?:string;id?:string;challengeId?:string};try{challenge=jwt.verify(d.resetToken,env.JWT_ACCESS_SECRET) as typeof challenge}catch{throw new AppError(400,'Reset code has expired. Request a new code')}
  if(challenge.purpose!=='password-reset'||!challenge.id||!challenge.challengeId)throw new AppError(400,'Reset code is invalid or expired');
  const pool=await getPool();await verifySmsChallenge(pool,challenge.id,challenge.challengeId,'password-reset',d.code);
  const passwordHash=await bcrypt.hash(d.newPassword,12);
  await pool.request().input('uid',sql.UniqueIdentifier,challenge.id).input('hash',sql.NVarChar(500),passwordHash).query("UPDATE Users SET PasswordHash=@hash,UpdatedAt=SYSUTCDATETIME() WHERE Id=@uid AND AccountStatus='ACTIVE'; UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE UserId=@uid AND RevokedAt IS NULL");
  res.json({success:true});
}));
authRouter.post('/refresh',asyncHandler(async(req,res)=>{
  const token=z.object({refreshToken:z.string()}).parse(req.body).refreshToken; let payload; try { payload=verifyRefresh(token); } catch { throw new AppError(401,'Refresh token invalid'); } const pool=await getPool();
  const r=await pool.request().input('hash',sql.NVarChar(64),hashToken(token)).query("SELECT s.Id,s.RevokedAt,s.ExpiresAt FROM UserSessions s JOIN Users u ON u.Id=s.UserId WHERE s.RefreshTokenHash=@hash AND u.AccountStatus='ACTIVE'");
  const s=r.recordset[0]; if(!s||s.RevokedAt||new Date(s.ExpiresAt)<new Date()) throw new AppError(401,'Refresh token invalid');
  res.json({accessToken:signAccess({id:payload.id,email:payload.email})});
}));
authRouter.post('/logout',asyncHandler(async(req,res)=>{const token=z.object({refreshToken:z.string()}).parse(req.body).refreshToken; const pool=await getPool(); await pool.request().input('hash',sql.NVarChar(64),hashToken(token)).query('UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE RefreshTokenHash=@hash');res.status(204).end();}));

authRouter.get('/security',requireAuth,asyncHandler(async(req,res)=>{
  const pool=await getPool();
  const [userResult,sessionsResult]=await Promise.all([
    pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT Email,Phone,EmailVerified,PhoneVerified,CreatedAt FROM Users WHERE Id=@uid'),
    pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('current',sql.NVarChar(64),hashToken(String(req.headers['x-refresh-token']||''))).query('SELECT Id,CreatedAt,ExpiresAt,CASE WHEN RefreshTokenHash=@current THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END IsCurrent FROM UserSessions WHERE UserId=@uid AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME() ORDER BY CreatedAt DESC')
  ]);
  const user=userResult.recordset[0];if(!user)throw new AppError(404,'Account not found');
  res.json({email:user.Email,phone:user.Phone,emailVerified:Boolean(user.EmailVerified),phoneVerified:Boolean(user.PhoneVerified),accountCreatedAt:user.CreatedAt,activeSessions:sessionsResult.recordset});
}));

authRouter.post('/account-verification/request',requireAuth,asyncHandler(async(req,res)=>{
  const {method}=z.object({method:z.enum(['email','phone'])}).parse(req.body),pool=await getPool();
  const result=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT Email,Phone,EmailVerified,PhoneVerified FROM Users WHERE Id=@uid');const user=result.recordset[0];
  if(!user)throw new AppError(404,'Account not found');if(method==='email'&&user.EmailVerified)return res.json({alreadyVerified:true});if(method==='phone'&&user.PhoneVerified)return res.json({alreadyVerified:true});
  const destination=method==='email'?user.Email:user.Phone;if(!destination)throw new AppError(400,`Add an ${method==='email'?'email address':'phone number'} before verification`);
  const purpose=`verify-${method}`,recent=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('purpose',sql.NVarChar(30),purpose).query('SELECT TOP 1 CreatedAt FROM TwoFactorChallenges WHERE UserId=@uid AND Purpose=@purpose AND ConsumedAt IS NULL ORDER BY CreatedAt DESC');
  if(recent.recordset[0]){const wait=env.SMS_RESEND_SECONDS-Math.floor((Date.now()-new Date(recent.recordset[0].CreatedAt).getTime())/1000);if(wait>0)throw new AppError(429,`Please wait ${wait} seconds before requesting another code`)}
  const code=crypto.randomInt(100000,1000000).toString(),expires=new Date(Date.now()+env.SMS_CODE_EXPIRES_MINUTES*60000),challenge=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('purpose',sql.NVarChar(30),purpose).input('hash',sql.NVarChar(64),verificationHash(req.user!.id,code)).input('expires',sql.DateTime2,expires).query('INSERT INTO TwoFactorChallenges(UserId,Purpose,CodeHash,ExpiresAt) OUTPUT INSERTED.Id VALUES(@uid,@purpose,@hash,@expires)');
  try{if(method==='phone')await sendVerificationSms(destination,code);else{const sent=await sendEmailBatch([{to:destination,subject:'Your CDA Connect verification code',text:`Your CDA Connect verification code is ${code}. It expires in ${env.SMS_CODE_EXPIRES_MINUTES} minutes.`}]);if(sent.skipped)throw new Error('Email delivery is not configured')}}catch(error){await pool.request().input('id',sql.UniqueIdentifier,challenge.recordset[0].Id).query('DELETE FROM TwoFactorChallenges WHERE Id=@id');throw error}
  res.status(202).json({challengeId:challenge.recordset[0].Id,expiresInSeconds:env.SMS_CODE_EXPIRES_MINUTES*60});
}));

authRouter.post('/account-verification/verify',requireAuth,asyncHandler(async(req,res)=>{
  const d=z.object({method:z.enum(['email','phone']),challengeId:z.string().uuid(),code:z.string().regex(/^\d{6}$/)}).parse(req.body),pool=await getPool();
  await verifySmsChallenge(pool,req.user!.id,d.challengeId,`verify-${d.method}`,d.code);
  await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query(`UPDATE Users SET ${d.method==='email'?'EmailVerified':'PhoneVerified'}=1,UpdatedAt=SYSUTCDATETIME() WHERE Id=@uid`);
  res.json({success:true});
}));

authRouter.post('/sessions/:sessionId/revoke',requireAuth,asyncHandler(async(req,res)=>{
  const d=z.object({refreshToken:z.string().min(1)}).parse(req.body),pool=await getPool(),current=hashToken(d.refreshToken);
  const result=await pool.request().input('id',sql.UniqueIdentifier,req.params.sessionId).input('uid',sql.UniqueIdentifier,req.user!.id).input('current',sql.NVarChar(64),current).query('UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() OUTPUT INSERTED.Id WHERE Id=@id AND UserId=@uid AND RefreshTokenHash<>@current AND RevokedAt IS NULL');
  if(!result.recordset[0])throw new AppError(400,'This session is already signed out or is your current device');res.json({success:true});
}));

authRouter.get('/two-factor',requireAuth,asyncHandler(async(req,res)=>{const pool=await getPool(),result=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT TwoFactorEnabled,TwoFactorMethod,Phone,PhoneVerified FROM Users WHERE Id=@uid'),row=result.recordset[0];if(!row)throw new AppError(404,'Account not found');res.json({enabled:Boolean(row.TwoFactorEnabled),method:row.TwoFactorMethod,phone:row.Phone,phoneVerified:Boolean(row.PhoneVerified)})}));
authRouter.post('/two-factor/setup',requireAuth,asyncHandler(async(req,res)=>{const d=z.object({method:z.enum(['authenticator','sms']),password:z.string().min(1)}).parse(req.body),pool=await getPool(),result=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT Email,Phone,PhoneVerified,PasswordHash FROM Users WHERE Id=@uid'),row=result.recordset[0];if(!row||!(await bcrypt.compare(d.password,row.PasswordHash)))throw new AppError(400,'Current password is incorrect');if(d.method==='sms'){if(!row.Phone||!row.PhoneVerified)throw new AppError(400,'Verify a mobile number in your profile before enabling SMS authentication');const challengeId=await createSmsChallenge(pool,req.user!.id,row.Phone,'enable');return res.json({method:'sms',challengeId,maskedPhone:`••••${String(row.Phone).slice(-4)}`})}const secret=base32Encode(crypto.randomBytes(20)),issuer='CDA Connect',label=encodeURIComponent(`${issuer}:${row.Email}`),otpauthUri=`otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;res.json({method:'authenticator',secret,otpauthUri})}));
authRouter.post('/two-factor/enable',requireAuth,asyncHandler(async(req,res)=>{const d=z.object({method:z.enum(['authenticator','sms']),password:z.string().min(1),code:z.string().regex(/^\d{6}$/),secret:z.string().optional(),challengeId:z.string().uuid().optional(),refreshToken:z.string().min(1)}).parse(req.body),pool=await getPool(),result=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT PasswordHash FROM Users WHERE Id=@uid'),row=result.recordset[0];if(!row||!(await bcrypt.compare(d.password,row.PasswordHash)))throw new AppError(400,'Current password is incorrect');let encrypted:string|null=null;if(d.method==='sms'){if(!d.challengeId)throw new AppError(400,'SMS challenge is required');await verifySmsChallenge(pool,req.user!.id,d.challengeId,'enable',d.code)}else{if(!d.secret||!verifyTotp(d.secret,d.code))throw new AppError(400,'Authenticator code is incorrect');encrypted=encryptSecret(d.secret)}await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('method',sql.NVarChar(20),d.method).input('secret',sql.NVarChar(1000),encrypted).query('UPDATE Users SET TwoFactorEnabled=1,TwoFactorMethod=@method,TwoFactorSecret=@secret,UpdatedAt=SYSUTCDATETIME() WHERE Id=@uid');await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('current',sql.NVarChar(64),hashToken(d.refreshToken)).query('UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE UserId=@uid AND RefreshTokenHash<>@current AND RevokedAt IS NULL');res.json({success:true,method:d.method})}));
authRouter.post('/two-factor/disable',requireAuth,asyncHandler(async(req,res)=>{const d=z.object({password:z.string().min(1),code:z.string().regex(/^\d{6}$/),challengeId:z.string().uuid().optional(),refreshToken:z.string().min(1)}).parse(req.body),pool=await getPool(),result=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT PasswordHash,TwoFactorEnabled,TwoFactorMethod,TwoFactorSecret FROM Users WHERE Id=@uid'),row=result.recordset[0];if(!row||!(await bcrypt.compare(d.password,row.PasswordHash)))throw new AppError(400,'Current password is incorrect');if(!row.TwoFactorEnabled)throw new AppError(400,'Two-factor authentication is already disabled');if(row.TwoFactorMethod==='sms'){if(!d.challengeId)throw new AppError(400,'SMS challenge is required');await verifySmsChallenge(pool,req.user!.id,d.challengeId,'disable',d.code)}else if(!row.TwoFactorSecret||!verifyTotp(decryptSecret(row.TwoFactorSecret),d.code))throw new AppError(400,'Authenticator code is incorrect');await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('UPDATE Users SET TwoFactorEnabled=0,TwoFactorMethod=NULL,TwoFactorSecret=NULL,UpdatedAt=SYSUTCDATETIME() WHERE Id=@uid');await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('current',sql.NVarChar(64),hashToken(d.refreshToken)).query('UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE UserId=@uid AND RefreshTokenHash<>@current AND RevokedAt IS NULL');res.json({success:true})}));
authRouter.post('/two-factor/sms-code',requireAuth,asyncHandler(async(req,res)=>{const purpose=z.object({purpose:z.enum(['disable'])}).parse(req.body).purpose,pool=await getPool(),result=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT Phone,PhoneVerified,TwoFactorEnabled,TwoFactorMethod FROM Users WHERE Id=@uid'),row=result.recordset[0];if(!row?.Phone||!row.PhoneVerified||!row.TwoFactorEnabled||row.TwoFactorMethod!=='sms')throw new AppError(400,'SMS two-factor authentication is not active');const challengeId=await createSmsChallenge(pool,req.user!.id,row.Phone,purpose);res.json({challengeId,maskedPhone:`••••${String(row.Phone).slice(-4)}`})}));

authRouter.put('/password',requireAuth,asyncHandler(async(req,res)=>{
  const d=z.object({currentPassword:z.string().min(1),newPassword:z.string().min(8).max(200),refreshToken:z.string().min(1)}).parse(req.body);
  if(!/[A-Z]/.test(d.newPassword)||!/\d/.test(d.newPassword)||!/[^A-Za-z0-9]/.test(d.newPassword))throw new AppError(400,'New password must include an uppercase letter, number and special character');
  const pool=await getPool();const result=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT PasswordHash FROM Users WHERE Id=@uid');const user=result.recordset[0];
  if(!user||!(await bcrypt.compare(d.currentPassword,user.PasswordHash)))throw new AppError(400,'Current password is incorrect');
  const nextHash=await bcrypt.hash(d.newPassword,12);const currentHash=hashToken(d.refreshToken);
  await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('password',sql.NVarChar(500),nextHash).query('UPDATE Users SET PasswordHash=@password,UpdatedAt=SYSUTCDATETIME() WHERE Id=@uid');
  await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('current',sql.NVarChar(64),currentHash).query('UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() WHERE UserId=@uid AND RefreshTokenHash<>@current AND RevokedAt IS NULL');
  res.json({success:true});
}));

authRouter.post('/sign-out-other-sessions',requireAuth,asyncHandler(async(req,res)=>{
  const refreshToken=z.object({refreshToken:z.string().min(1)}).parse(req.body).refreshToken;const pool=await getPool();
  const result=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('current',sql.NVarChar(64),hashToken(refreshToken)).query('UPDATE UserSessions SET RevokedAt=SYSUTCDATETIME() OUTPUT INSERTED.Id WHERE UserId=@uid AND RefreshTokenHash<>@current AND RevokedAt IS NULL');
  res.json({success:true,signedOut:result.recordset.length});
}));

