import {Router} from 'express';
import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {asyncHandler,AppError} from '../utils/errors.js';
import {loginEmailAvailable,securityFindings} from '../services/securitySettings.js';

export const securitySettingsRouter=Router();
securitySettingsRouter.get('/security-settings',asyncHandler(async(req,res)=>{
 const pool=await getPool();
 const r=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT Email,Phone,EmailVerified,PhoneVerified,TwoFactorEnabled,TwoFactorMethod,LoginAlerts,PasswordChangedAt,LastLoginAlertAt,LastLoginAlertStatus FROM Users WHERE Id=@uid');
 const u=r.recordset[0];if(!u)throw new AppError(404,'Account not found');
 res.set('Cache-Control','no-store').json({...u,emailAvailable:loginEmailAvailable(),checkedAt:new Date().toISOString(),findings:securityFindings(u)});
}));
securitySettingsRouter.patch('/security-settings',asyncHandler(async(req,res)=>{
 const {loginAlerts}=z.object({loginAlerts:z.boolean()}).strict().parse(req.body),pool=await getPool();
 if(loginAlerts){
  if(!loginEmailAvailable())throw new AppError(503,'Email delivery is not configured');
  const r=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT EmailVerified FROM Users WHERE Id=@uid');
  if(!r.recordset[0]?.EmailVerified)throw new AppError(400,'Verify your email address before enabling login alerts');
 }
 await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).input('enabled',sql.Bit,loginAlerts).query('UPDATE Users SET LoginAlerts=@enabled WHERE Id=@uid');
 res.json({success:true});
}));
securitySettingsRouter.get('/login-activity',asyncHandler(async(req,res)=>{
 const pool=await getPool(),r=await pool.request().input('uid',sql.UniqueIdentifier,req.user!.id).query('SELECT TOP 100 Id,CreatedAt,ExpiresAt,RevokedAt,TrustedName FROM UserSessions WHERE UserId=@uid ORDER BY CreatedAt DESC');
 res.set('Cache-Control','no-store').json(r.recordset);
}));
