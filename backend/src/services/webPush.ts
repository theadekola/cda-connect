import webpush from 'web-push';
import {z} from 'zod';
import {env} from '../config/env.js';
import {getPool,sql} from '../config/db.js';

export function allowedPushEndpoint(value:string){
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.hash&&(!u.port||u.port==='443')&&(
    u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.push.apple.com')||u.hostname.endsWith('.notify.windows.com'))}catch{return false}
}
export const pushSubscriptionSchema=z.object({endpoint:z.string().max(2048).refine(allowedPushEndpoint,'Unsupported push endpoint'),keys:z.object({p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/)})});
export const webPushReady=()=>Boolean(env.VAPID_PUBLIC_KEY&&env.VAPID_PRIVATE_KEY);
export async function sendWebPush(token:string,payload?:{title?:string;body?:string}){
  const id=token.slice(8);
  if(!z.string().uuid().safeParse(id).success)return {status:'error',details:{error:'DeviceNotRegistered'}};
  const pool=await getPool();
  const r=await pool.request().input('id',sql.UniqueIdentifier,id).query('SELECT w.Endpoint,w.P256dh,w.Auth,COALESCE(p.NotificationPreviewsEnabled,0) Previews FROM WebPushSubscriptions w LEFT JOIN UserAppPreferences p ON p.UserId=w.UserId WHERE w.Id=@id');
  const row=r.recordset[0];
  if(!row)return {status:'error',details:{error:'DeviceNotRegistered'}};
  if(!webPushReady())throw Error('Web push is not configured');
  const subscription=pushSubscriptionSchema.parse({endpoint:row.Endpoint,keys:{p256dh:row.P256dh,auth:row.Auth}});
  try{
    // Include content only when the current subscription owner has enabled previews.
    await webpush.sendNotification(subscription,JSON.stringify({title:row.Previews&&payload?.title?String(payload.title).slice(0,180):'CDA Connect',body:row.Previews&&payload?.body?String(payload.body).slice(0,500):'You have a new notification. Open CDA Connect to read it.'}),{TTL:3600,timeout:10000,vapidDetails:{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY!,privateKey:env.VAPID_PRIVATE_KEY!}});
    return {status:'ok'};
  }catch(error:any){
    if(error?.statusCode===404||error?.statusCode===410){
      await pool.request().input('id',sql.UniqueIdentifier,id).input('token',sql.NVarChar(500),token).query('DELETE FROM UserDevices WHERE DeviceToken=@token; DELETE FROM WebPushSubscriptions WHERE Id=@id');
      return {status:'error',details:{error:'DeviceNotRegistered'}};
    }
    // Throw a sanitized error so BullMQ retries without logging subscription endpoints/keys.
    throw Error('Web push delivery failed; retry required');
  }
}
