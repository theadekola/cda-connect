import {env} from '../config/env.js';
import {AppError} from '../utils/errors.js';

export function normalizePhone(value:string){
  const phone=value.replace(/[\s()-]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(phone)) throw new AppError(400,'Enter a valid international phone number, for example +2348012345678');
  return phone;
}

export async function sendVerificationSms(phone:string,code:string){
  const{TWILIO_ACCOUNT_SID:sid,TWILIO_AUTH_TOKEN:token,TWILIO_FROM_NUMBER:from}=env;
  if(!sid||!token||!from) throw new AppError(503,'SMS verification is not configured');
  const body=new URLSearchParams({To:phone,From:from,Body:`Your CDA Connect verification code is ${code}. It expires in ${env.SMS_CODE_EXPIRES_MINUTES} minutes.`});
  const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body});
  if(!response.ok){const detail=await response.text();console.error('Twilio SMS failed',response.status,detail.slice(0,500));throw new AppError(502,'SMS provider could not deliver the verification code')}
}
