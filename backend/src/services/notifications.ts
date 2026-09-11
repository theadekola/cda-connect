import {sendWebPush} from './webPush.js';
import { env } from '../config/env.js';
import nodemailer from 'nodemailer';
import {z} from 'zod';
import {AppError} from '../utils/errors.js';

async function postJson(url: string, token: string | undefined, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Provider failed with ${response.status}`);
  return response.json().catch(()=>null);
}

export async function sendPushBatch(messages: unknown[]) {
  const tickets:any[]=new Array(messages.length);
  const native:{index:number;message:unknown}[]=[];
  for(let index=0;index<messages.length;index++){
    const message=messages[index] as {to?:string;title?:string;body?:string};
    if(typeof message.to==='string'&&message.to.startsWith('webpush:'))tickets[index]=await sendWebPush(message.to,message);
    else native.push({index,message});
  }
  if(native.length){
    const payload=native.map(item=>item.message);
    const response=env.PUSH_PROVIDER_URL?await postJson(env.PUSH_PROVIDER_URL,env.PUSH_PROVIDER_TOKEN,{messages:payload}):await postJson('https://exp.host/--/api/v2/push/send',env.PUSH_PROVIDER_TOKEN,payload);
    if(!Array.isArray(response?.data)||response.data.length!==native.length)throw Error('Push provider returned incomplete delivery results');
    native.forEach((item,i)=>{tickets[item.index]=response.data[i]});
  }
  return {skipped:false,count:messages.length,tickets};
}

export async function getPushReceipts(ids:string[]){
  if(!ids.length||env.PUSH_PROVIDER_URL)return{} as Record<string,any>;
  const response=await postJson('https://exp.host/--/api/v2/push/getReceipts',env.PUSH_PROVIDER_TOKEN,{ids});
  return(response?.data??{}) as Record<string,any>;
}

export async function sendEmailBatch(messages: unknown[]) {
  if(env.EMAIL_PROVIDER==='smtp'){
    if(!env.SMTP_USER||!env.SMTP_PASSWORD)throw new AppError(503,'Email verification is not configured');
    const mail=z.array(z.object({to:z.string().email(),subject:z.string().max(250),text:z.string()})).parse(messages);
    const transporter=nodemailer.createTransport({host:env.SMTP_HOST,port:env.SMTP_PORT,secure:env.SMTP_PORT===465,requireTLS:true,auth:{user:env.SMTP_USER,pass:env.SMTP_PASSWORD},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,tls:{minVersion:'TLSv1.2'}});
    try{for(const message of mail){const result=await transporter.sendMail({...message,from:{name:'CDA Connect',address:env.SMTP_FROM},disableFileAccess:true,disableUrlAccess:true});if(!result.accepted.length||result.rejected.length)throw Error('Recipient rejected')}}
    catch{throw new AppError(502,'Email provider could not accept the message. Please try again later.')}
    finally{transporter.close()}
    return {skipped:false,count:mail.length};
  }
  if (!env.EMAIL_PROVIDER_URL) return { skipped: true, count: messages.length };
  await postJson(env.EMAIL_PROVIDER_URL, env.EMAIL_PROVIDER_TOKEN, { messages });
  return { skipped: false, count: messages.length };
}
