import {sql} from '../config/db.js';
import {env} from '../config/env.js';
import {sendEmailBatch} from './notifications.js';

export function loginEmailAvailable(){return env.EMAIL_PROVIDER==='smtp'?Boolean(env.SMTP_USER&&env.SMTP_PASSWORD):Boolean(env.EMAIL_PROVIDER_URL)}
export function securityFindings(user:any){
 const findings:string[]=[];
 if(!user.TwoFactorEnabled)findings.push('Enable two-factor authentication.');
 if(!user.EmailVerified)findings.push('Verify your email address.');
 if(!user.PhoneVerified)findings.push('Verify a phone number for SMS account recovery.');
 if(!user.LoginAlerts)findings.push('Enable email alerts for new sign-ins.');
 if(user.LoginAlerts&&!loginEmailAvailable())findings.push('Email delivery is not configured on the server.');
 if(user.LastLoginAlertStatus==='FAILED')findings.push('The last login alert could not be delivered.');
 return findings;
}

// A delivery failure must never prevent the member from signing in.
// No automatic retries: an uncertain SMTP result may already have been accepted.
export async function notifyNewLogin(pool:any,userId:string,send=sendEmailBatch){
 const r=await pool.request().input('uid',sql.UniqueIdentifier,userId).query('SELECT Email,EmailVerified,LoginAlerts FROM Users WHERE Id=@uid');
 const u=r.recordset[0];if(!u?.LoginAlerts||!u.EmailVerified)return;
 await pool.request().input('uid',sql.UniqueIdentifier,userId).query("UPDATE Users SET LastLoginAlertAt=SYSUTCDATETIME(),LastLoginAlertStatus='PENDING' WHERE Id=@uid");
 let status='FAILED';
 try{const result=await send([{to:u.Email,subject:'New sign-in to CDA Connect',text:`A new sign-in to your CDA Connect account completed at ${new Date().toISOString()} (UTC). If this was not you, open CDA Connect, go to Settings > Security, change your password and revoke other sessions. Never share verification codes.`}]);if(!result.skipped)status='ACCEPTED'}catch{}
 await pool.request().input('uid',sql.UniqueIdentifier,userId).input('status',sql.NVarChar(20),status).query('UPDATE Users SET LastLoginAlertAt=SYSUTCDATETIME(),LastLoginAlertStatus=@status WHERE Id=@uid');
}
