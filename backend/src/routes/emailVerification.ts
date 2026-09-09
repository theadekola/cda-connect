import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import {Router} from 'express';
import {z} from 'zod';
import {env} from '../config/env.js';
import {getRedis} from '../config/redis.js';
import {getPool,sql} from '../config/db.js';
import {AppError,asyncHandler} from '../utils/errors.js';
import {sendEmailBatch} from '../services/notifications.js';
export const emailVerificationRouter=Router();
const emailSchema=z.string().trim().toLowerCase().email().max(255);
const keyFor=(email:string)=>'registration-email:'+crypto.createHash('sha256').update(email).digest('hex');
const hash=(email:string,code:string)=>crypto.createHmac('sha256',env.JWT_ACCESS_SECRET).update(email+':'+code).digest('hex');
const verifyScript=`
local expected=redis.call('HGET',KEYS[1],'hash')
if not expected then return 0 end
local attempts=redis.call('HINCRBY',KEYS[1],'attempts',1)
if attempts>5 then return -1 end
if expected~=ARGV[1] then return 0 end
redis.call('DEL',KEYS[1])
return 1`;
emailVerificationRouter.post('/email-verification/request',asyncHandler(async(req,res)=>{
 const {email}=z.object({email:emailSchema}).parse(req.body),redis=getRedis(),key=keyFor(email);
 // Fail closed on Redis errors; limit requests per source as well as per email address.
 const source='registration-email-ip:'+crypto.createHash('sha256').update(req.ip||'unknown').digest('hex');
 const requests=Number(await redis.eval("local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],600) end;return n",1,source));
 if(requests>10)throw new AppError(429,'Too many email requests. Please try again in ten minutes.');
 const pool=await getPool(),existing=await pool.request().input('email',sql.NVarChar(255),email).query('SELECT Id FROM Users WHERE Email=@email');
 if(existing.recordset.length)throw new AppError(409,'This email address is already registered');
 if(!await redis.set(key+':cooldown','1','EX',env.SMS_RESEND_SECONDS,'NX'))throw new AppError(429,`Please wait ${env.SMS_RESEND_SECONDS} seconds before requesting another code`);
 const code=crypto.randomInt(100000,1000000).toString(),digest=hash(email,code);
 await redis.multi().hset(key,'hash',digest,'attempts','0').expire(key,env.SMS_CODE_EXPIRES_MINUTES*60).exec();
 try{const sent=await sendEmailBatch([{to:email,subject:'Your CDA Connect verification code',text:`Your CDA Connect verification code is ${code}. It expires in ${env.SMS_CODE_EXPIRES_MINUTES} minutes. If you did not request this, ignore this email.`}]);if(sent.skipped)throw new AppError(503,'Email verification is not configured')}
 catch(error){await redis.eval("if redis.call('HGET',KEYS[1],'hash')==ARGV[1] then return redis.call('DEL',KEYS[1]) end;return 0",1,key,digest);throw error}
 res.status(202).json({success:true,resendAfterSeconds:env.SMS_RESEND_SECONDS});
}));
emailVerificationRouter.post('/email-verification/verify',asyncHandler(async(req,res)=>{
 const {email,code}=z.object({email:emailSchema,code:z.string().regex(/^\d{6}$/)}).parse(req.body);
 const result=Number(await getRedis().eval(verifyScript,1,keyFor(email),hash(email,code)));
 if(result===-1)throw new AppError(429,'Too many incorrect attempts. Request a new code.');
 if(result!==1)throw new AppError(400,'Verification code is incorrect or expired.');
 res.json({verificationToken:jwt.sign({purpose:'email-verification',email},env.JWT_ACCESS_SECRET,{algorithm:'HS256',expiresIn:'15m'})});
}));
