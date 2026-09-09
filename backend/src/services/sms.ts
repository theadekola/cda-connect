import {env} from '../config/env.js';
import {AppError} from '../utils/errors.js';

export function normalizePhone(value:string){
  const phone=value.replace(/[\s()-]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(phone)) throw new AppError(400,'Enter a valid international phone number, for example +2348012345678');
  return phone;
}

export async function sendVerificationSms(phone:string,code:string){
  const to=normalizePhone(phone);
  const message=`Your CDA Connect verification code is ${code}. It expires in ${env.SMS_CODE_EXPIRES_MINUTES} minutes.`;
  if(env.SMS_PROVIDER==='termii'){
    const key=env.TERMII_API_KEY?.trim(),from=env.TERMII_SENDER_ID?.trim(),base=env.TERMII_BASE_URL?.trim();
    if(!key||!from||!base)throw new AppError(503,'SMS verification is not configured');
    let endpoint:URL;
    try{
      endpoint=new URL(base);
      if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||!/(^|\.)termii\.com$/i.test(endpoint.hostname)||!['','/','/api','/api/'].includes(endpoint.pathname))throw Error();
      endpoint.pathname='/api/sms/send';
    }catch{throw new AppError(503,'SMS provider URL is not configured correctly')}
    if(from.length<3||from.length>11)throw new AppError(503,'SMS sender ID is not configured correctly');
    let response:Response;
    try{
      response=await fetch(endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,to:to.slice(1),from,sms:message,type:'plain',channel:'dnd'})});
    }catch{console.error('Termii SMS request failed or timed out');throw new AppError(502,'SMS provider is unavailable. Please try again shortly.')}
    const result=await response.json().catch(()=>null) as {code?:string}|null;
    if(!response.ok||result?.code!=='ok'){
      // Never log provider response bodies: they may contain credentials, phone numbers or OTPs.
      console.error('Termii SMS request rejected',response.status);
      throw new AppError(502,'SMS provider could not accept the verification code. Please try again later.');
    }
    return;
  }
  const{TWILIO_ACCOUNT_SID:sid,TWILIO_AUTH_TOKEN:token,TWILIO_FROM_NUMBER:from}=env;
  if(!sid||!token||!from) throw new AppError(503,'SMS verification is not configured');
  const body=new URLSearchParams({To:to,From:from,Body:message});
  let response:Response;
  try{response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body})}
  catch{throw new AppError(502,'SMS provider is unavailable. Please try again shortly.')}
  if(!response.ok){console.error('Twilio SMS failed',response.status);throw new AppError(502,'SMS provider could not deliver the verification code')}
}
