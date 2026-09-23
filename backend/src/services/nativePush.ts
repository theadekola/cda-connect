import {notificationDestination} from './notificationDestination.js';
import {readFileSync,existsSync} from 'node:fs';
import {connect} from 'node:http2';
import jwt from 'jsonwebtoken';
import {env} from '../config/env.js';
export type NativeMessage={to:string;title?:string;body?:string;data?:Record<string,unknown>};
export function nativePushReady(platform:string){return platform==='android'?Boolean(env.FCM_SERVICE_ACCOUNT_FILE&&existsSync(env.FCM_SERVICE_ACCOUNT_FILE)):Boolean(env.APNS_KEY_FILE&&existsSync(env.APNS_KEY_FILE)&&env.APNS_KEY_ID&&env.APNS_TEAM_ID)}
let googleToken:{value:string;expires:number}|undefined;
async function accessToken(){
 if(googleToken&&googleToken.expires>Date.now()+60000)return googleToken.value;
 const account=JSON.parse(readFileSync(env.FCM_SERVICE_ACCOUNT_FILE!,'utf8'));
 const assertion=jwt.sign({scope:'https://www.googleapis.com/auth/firebase.messaging'},account.private_key,{algorithm:'RS256',issuer:account.client_email,audience:'https://oauth2.googleapis.com/token',expiresIn:'1h'});
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 const data:any=await response.json();if(!response.ok||!data.access_token)throw Error('Firebase authentication failed');
 googleToken={value:data.access_token,expires:Date.now()+Number(data.expires_in||3600)*1000};return googleToken.value;
}
export function nativePayload(message:NativeMessage){return {notification:{title:message.title||'CDA Connect',body:message.body||''},data:{...Object.fromEntries(Object.entries(message.data||{}).map(([key,value])=>[key,String(value)])),destination:notificationDestination(message.data)}}}
export async function sendNativePush(message:NativeMessage){
 const android=message.to.startsWith('fcm:');
 if(!nativePushReady(android?'android':'ios'))throw Error('Native push delivery is not configured');
 const payload=nativePayload(message);
 if(android){
  const account=JSON.parse(readFileSync(env.FCM_SERVICE_ACCOUNT_FILE!,'utf8'));
  const response=await fetch('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(account.project_id)+'/messages:send',{method:'POST',signal:AbortSignal.timeout(20000),headers:{authorization:'Bearer '+await accessToken(),'content-type':'application/json'},body:JSON.stringify({message:{token:message.to.slice(4),...payload,android:{priority:'high',notification:{channel_id:'default'}}}})});
  const result:any=await response.json();if(response.ok)return {status:'ok'};
  if(result.error?.details?.some((d:any)=>d.errorCode==='UNREGISTERED'))return {status:'error',details:{error:'DeviceNotRegistered'}};
  throw Error('Firebase delivery failed (HTTP '+response.status+')');
 }
 const sandbox=message.to.startsWith('apns-sandbox:'),token=message.to.slice(message.to.indexOf(':')+1);
 if(!/^[a-f0-9]{64}$/i.test(token))throw Error('Invalid Apple device token');
 const authorization=jwt.sign({},readFileSync(env.APNS_KEY_FILE!,'utf8'),{algorithm:'ES256',issuer:env.APNS_TEAM_ID,keyid:env.APNS_KEY_ID});
 return await new Promise<{status:string;details?:{error:string}}>((resolve,reject)=>{
  const client=connect(sandbox?'https://api.sandbox.push.apple.com':'https://api.push.apple.com');
  const timer=setTimeout(()=>{client.destroy();reject(Error('Apple push delivery timed out'))},20000);
  const finish=()=>{clearTimeout(timer);client.close()};client.on('error',()=>{finish();reject(Error('Apple push connection failed'))});
  const request=client.request({':method':'POST',':path':'/3/device/'+token,authorization:'bearer '+authorization,'apns-topic':env.APNS_BUNDLE_ID,'apns-push-type':'alert','apns-priority':'10'});let status=0,body='';
  request.on('response',headers=>{status=Number(headers[':status'])});request.setEncoding('utf8');request.on('data',chunk=>{body+=chunk});request.on('error',()=>{finish();reject(Error('Apple push request failed'))});
  request.on('end',()=>{finish();if(status===200){resolve({status:'ok'});return}let reason='';try{reason=JSON.parse(body).reason}catch{}if(status===410||reason==='Unregistered')resolve({status:'error',details:{error:'DeviceNotRegistered'}});else reject(Error('Apple push delivery failed (HTTP '+status+')'))});
  request.end(JSON.stringify({...payload.data,aps:{alert:payload.notification,sound:'default'}}));
 });
}
