import {meetingSettings} from '../services/meetingSettings.js';
import {queueDueReminders} from '../services/notificationReminders.js';
import {categoryColumn,deliveryAllowed} from '../services/notificationSettings.js';
import {communicationSettings,dndActive} from '../services/communications.js';
import {sendTransactionalSms} from '../services/sms.js';
import { Worker, type Job } from 'bullmq';
import crypto from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { createRedisConnection,getRedis } from '../config/redis.js';
import { env } from '../config/env.js';
import { getPool, sql } from '../config/db.js';
import { getPushReceipts,sendEmailBatch,sendPushBatch } from '../services/notifications.js';
import { emergencyQueue,notificationQueue,type CommunityNotificationJob,type NotificationPreference } from '../queues/index.js';

type EmergencyData = { alertId:string; communityId:string; auditId:string };

async function setAudit(auditId:string,status:string,extra?:{error?:string;attempts?:number}) {
  const pool=await getPool();
  await pool.request().input('id',sql.UniqueIdentifier,auditId).input('s',sql.NVarChar(30),status)
    .input('e',sql.NVarChar(2000),extra?.error??null).input('a',sql.Int,extra?.attempts??0)
    .query(`UPDATE AsyncJobAudit SET Status=@s,LastError=@e,Attempts=CASE WHEN @a>0 THEN @a ELSE Attempts END,
      StartedAt=CASE WHEN @s='PROCESSING' AND StartedAt IS NULL THEN SYSUTCDATETIME() ELSE StartedAt END,
      CompletedAt=CASE WHEN @s='COMPLETED' THEN SYSUTCDATETIME() ELSE CompletedAt END WHERE Id=@id`);
}

async function processEmergency(job: Job<EmergencyData>) {
  await setAudit(job.data.auditId,'PROCESSING',{attempts:job.attemptsMade+1});
  const pool = await getPool();
  const alertResult = await pool.request().input('a', sql.UniqueIdentifier, job.data.alertId).query(`SELECT * FROM EmergencyAlerts WHERE Id=@a`);
  const alert = alertResult.recordset[0];
  if (!alert) throw new Error('Emergency alert not found');

  const recipients = await pool.request().input('c', sql.UniqueIdentifier, job.data.communityId).query(`
    SELECT cm.UserId,CASE WHEN u.EmailVerified=1 AND COALESCE(a.EmailUpdates,0)=1 THEN u.Email END Email,d.DeviceToken,d.Platform
    FROM CommunityMembers cm
    JOIN Users u ON u.Id=cm.UserId
    LEFT JOIN UserDevices d ON d.UserId=cm.UserId LEFT JOIN AccountSettings a ON a.UserId=cm.UserId
    WHERE cm.CommunityId=@c AND cm.Status='ACTIVE' AND u.AccountStatus='ACTIVE'
  `);
  const rows=[];for(const row of recipients.recordset)if(await deliveryAllowed(row.UserId,'EMERGENCY_ALERT'))rows.push(row);
  const destinationHash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
  for(const row of rows){
    for(const [channel,destination] of [['PUSH',row.DeviceToken],['EMAIL',row.Email]] as const){
      if(!destination)continue;
      await pool.request().input('alert',sql.UniqueIdentifier,alert.Id).input('user',sql.UniqueIdentifier,row.UserId).input('channel',sql.NVarChar(20),channel).input('hash',sql.Char(64),destinationHash(String(destination))).query(`IF NOT EXISTS(SELECT 1 FROM EmergencyNotificationDeliveries WHERE AlertId=@alert AND UserId=@user AND Channel=@channel AND DestinationHash=@hash) INSERT INTO EmergencyNotificationDeliveries(AlertId,UserId,Channel,DestinationHash) VALUES(@alert,@user,@channel,@hash)`);
    }
  }
  const completed=await pool.request().input('alert',sql.UniqueIdentifier,alert.Id).query(`SELECT UserId,Channel,DestinationHash FROM EmergencyNotificationDeliveries WHERE AlertId=@alert AND Status='SENT'`);
  const sentTargets=new Set(completed.recordset.map(row=>`${row.UserId}:${row.Channel}:${row.DestinationHash}`));
  const uniqueUsers = new Set(rows.map(x=>String(x.UserId)));
  const batchSize = Math.max(100, env.EMERGENCY_BATCH_SIZE);
  let processed = 0;
  for (let i=0;i<rows.length;i+=batchSize) {
    const batch = rows.slice(i,i+batchSize);
    const seenTokens=new Set<string>();
    const seenEmails=new Set<string>();
    const pushRows=batch.filter(x=>x.DeviceToken&&!sentTargets.has(`${x.UserId}:PUSH:${destinationHash(String(x.DeviceToken))}`)&&!seenTokens.has(String(x.DeviceToken))&&seenTokens.add(String(x.DeviceToken)));
    const emailRows=batch.filter(x=>x.Email&&!sentTargets.has(`${x.UserId}:EMAIL:${destinationHash(String(x.Email))}`)&&!seenEmails.has(String(x.Email))&&seenEmails.add(String(x.Email)));
    const push = pushRows.map(x=>({
      to:x.DeviceToken, platform:x.Platform, title:`🚨 ${alert.Title}`, body:alert.Message,
      data:{type:'EMERGENCY_ALERT',alertId:alert.Id,communityId:alert.CommunityId,severity:alert.Severity}
    }));
    const email = emailRows.map(x=>({to:x.Email,subject:`Emergency alert: ${alert.Title}`,text:alert.Message}));
    const [pushResult]=await Promise.all([sendPushBatch(push), sendEmailBatch(email)]);
    for(let index=0;index<pushRows.length;index++){const row=pushRows[index],ticket=pushResult.tickets[index],sent=ticket?.status!=='error';await pool.request().input('alert',sql.UniqueIdentifier,alert.Id).input('user',sql.UniqueIdentifier,row.UserId).input('hash',sql.Char(64),destinationHash(String(row.DeviceToken))).input('status',sql.NVarChar(30),sent?'SENT':'FAILED').input('error',sql.NVarChar(2000),sent?null:String(ticket?.message||ticket?.details?.error||'Push provider rejected delivery')).query(`UPDATE EmergencyNotificationDeliveries SET Status=@status,SentAt=CASE WHEN @status='SENT' THEN SYSUTCDATETIME() ELSE SentAt END,AttemptCount=AttemptCount+1,LastError=@error WHERE AlertId=@alert AND UserId=@user AND Channel='PUSH' AND DestinationHash=@hash AND Status<>'SENT'`)}
    for(const row of emailRows)await pool.request().input('alert',sql.UniqueIdentifier,alert.Id).input('user',sql.UniqueIdentifier,row.UserId).input('hash',sql.Char(64),destinationHash(String(row.Email))).query(`UPDATE EmergencyNotificationDeliveries SET Status='SENT',SentAt=SYSUTCDATETIME(),AttemptCount=AttemptCount+1,LastError=NULL WHERE AlertId=@alert AND UserId=@user AND Channel='EMAIL' AND DestinationHash=@hash AND Status<>'SENT'`);
    processed += batch.length;
    await job.updateProgress(Math.round((processed / Math.max(1,rows.length))*100));
  }
  await pool.request().input('a',sql.UniqueIdentifier,job.data.alertId).input('n',sql.Int,uniqueUsers.size).query(`UPDATE EmergencyAlerts SET NotificationQueuedAt=COALESCE(NotificationQueuedAt,SYSUTCDATETIME()), NotificationTargetCount=@n WHERE Id=@a`);
  await setAudit(job.data.auditId,'COMPLETED',{attempts:job.attemptsMade+1});
  return { recipients: uniqueUsers.size };
}

async function recoverPendingEmergencyJobs() {
  try {
    const pool=await getPool();
    const r=await pool.request().query(`SELECT TOP 100 Id,CommunityId,EntityId FROM AsyncJobAudit WHERE QueueName='emergency-broadcasts' AND Status='PENDING_RETRY' ORDER BY CreatedAt`);
    for(const row of r.recordset){
      try{
        await emergencyQueue.add('broadcast',{alertId:row.EntityId,communityId:row.CommunityId,auditId:row.Id},{jobId:`emergency_${row.EntityId}`,attempts:5,backoff:{type:'exponential',delay:2000},removeOnComplete:500,removeOnFail:1000});
        await pool.request().input('id',sql.UniqueIdentifier,row.Id).query(`UPDATE AsyncJobAudit SET Status='QUEUED',LastError=NULL WHERE Id=@id`);
      }catch(error){console.error('Unable to recover pending emergency job',row.Id,error);}
    }
  }catch(error){console.error('Pending job recovery failed',error);}
}

const emergencyWorker = new Worker<EmergencyData>('emergency-broadcasts', processEmergency, { connection: createRedisConnection(), concurrency: 4 });
const notificationSchema=z.object({notificationId:z.string().uuid(),eventId:z.string().uuid(),communityId:z.string().uuid(),occurredAt:z.string().datetime().optional(),actorUserId:z.string().uuid().optional(),conversationId:z.string().uuid().optional(),targetUserId:z.string().uuid().optional(),type:z.string().min(1).max(100),title:z.string().min(1),body:z.string(),entityId:z.string().uuid().optional(),preference:z.enum(['Initiatives','DirectMessages','Mentions','CommunityPosts','Polls','Events','Marketplace','BusinessPromotions']).optional(),priority:z.enum(['normal','high']).optional(),data:z.record(z.string(),z.string()).optional()});
type Delivery={notificationId:string;eventId:string;batch:number;messages:Array<{userId:string;token:string;message:any}>};
const preferenceColumns:Record<NotificationPreference,string>={Initiatives:'Initiatives',DirectMessages:'DirectMessages',Mentions:'Mentions',CommunityPosts:'CommunityPosts',Polls:'Polls',Events:'Events',Marketplace:'Marketplace',BusinessPromotions:'BusinessPromotions'};
const safe=(value:string,max:number)=>Array.from(value).slice(0,max).join('');
function quietDelay(timezone:string,start?:string,end?:string){try{if(!start||!end)return 0;const parts=new Intl.DateTimeFormat('en-GB',{timeZone:timezone||'UTC',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const now=Number(parts.find(x=>x.type==='hour')?.value)*60+Number(parts.find(x=>x.type==='minute')?.value),[sh,sm]=start.split(':').map(Number),[eh,em]=end.split(':').map(Number),s=sh*60+sm,e=eh*60+em,inQuiet=s<=e?now>=s&&now<e:now>=s||now<e;if(!inQuiet)return 0;const minutes=(e-now+1440)%1440;return Math.max(60_000,minutes*60_000)}catch{return 0}}

async function dispatchNotification(raw:unknown){
 const d=notificationSchema.parse(raw) as CommunityNotificationJob,pool=await getPool(),column=categoryColumn(d.type,d.preference);
 const recipientJoin=d.conversationId?"JOIN ConversationMembers recipient ON recipient.UserId=cm.UserId AND recipient.ConversationId=@conversation AND recipient.IsActive=1 AND (recipient.MutedUntil IS NULL OR recipient.MutedUntil<=SYSUTCDATETIME())":'';
 let meetingFilter='';let meetingSms=true;if(d.type==='MEETING'||d.data?.type==='MEETING'){const meeting=(await pool.request().input('meeting',sql.UniqueIdentifier,d.entityId??null).query('SELECT SettingsJson FROM Meetings WHERE Id=@meeting')).recordset[0];if(!meeting)return{skipped:true};meetingFilter='AND dbo.CanViewMeeting(@meeting,cm.UserId)=1';meetingSms=meetingSettings(meeting.SettingsJson).smsReminders;}
 const targetFilter=d.targetUserId?'AND cm.UserId=@target':'';
 const result=await pool.request().input('community',sql.UniqueIdentifier,d.communityId).input('actor',sql.UniqueIdentifier,d.actorUserId??null).input('occurred',sql.DateTime2,d.occurredAt?new Date(d.occurredAt):null).input('conversation',sql.UniqueIdentifier,d.conversationId??null).input('target',sql.UniqueIdentifier,d.targetUserId??null).input('meeting',sql.UniqueIdentifier,d.entityId??null).query(`SELECT DISTINCT cm.UserId,devices.DeviceToken,CONVERT(varchar(20),preferences.${column}) PreferenceValue,preferences.Enabled,preferences.QuietHoursEnabled,CONVERT(varchar(5),preferences.QuietStart,108) QuietStart,CONVERT(varchar(5),preferences.QuietEnd,108) QuietEnd,COALESCE(app.TimeZone,'UTC') TimeZone,COALESCE(app.NotificationPreviewsEnabled,0) NotificationPreviewsEnabled FROM CommunityMembers cm ${recipientJoin} JOIN Users recipientUser ON recipientUser.Id=cm.UserId LEFT JOIN UserDevices devices ON devices.UserId=cm.UserId LEFT JOIN NotificationPreferences preferences ON preferences.UserId=cm.UserId LEFT JOIN UserAppPreferences app ON app.UserId=cm.UserId WHERE cm.CommunityId=@community AND cm.Status='ACTIVE' AND recipientUser.AccountStatus='ACTIVE' AND (@occurred IS NULL OR cm.JoinedAt<=@occurred) AND (@actor IS NULL OR cm.UserId<>@actor) AND (@actor IS NULL OR NOT EXISTS(SELECT 1 FROM BlockedUsers b WHERE (b.UserId=cm.UserId AND b.BlockedUserId=@actor) OR (b.UserId=@actor AND b.BlockedUserId=cm.UserId))) AND (@actor IS NULL OR NOT EXISTS(SELECT 1 FROM HiddenUsers h WHERE h.UserId=@actor AND h.HiddenUserId=cm.UserId)) ${targetFilter} ${meetingFilter}`);
 const immediate:any[]=[],digestUsers=new Set<string>(),seenTokens=new Set<string>();
 const persistedUsers=new Set<string>(),redis=getRedis();
 for(const row of result.recordset){const preference=String(row.PreferenceValue).toUpperCase(),userId=String(row.UserId);if(row.Enabled===false||row.Enabled===0||preference==='OFF'||preference==='0')continue;if(d.conversationId&&await redis.scard(`presence:conversation:${d.conversationId}:user:${userId}`)>0)continue;const navigation={...d.data,type:d.type,preference:d.preference,communityId:d.communityId,entityId:d.entityId,eventId:d.eventId};const privateBody=d.type==='CHAT_MESSAGE'&&!row.NotificationPreviewsEnabled?'New message':safe(d.body,500);if(!persistedUsers.has(userId)){persistedUsers.add(userId);if(meetingSms)await notificationQueue.add('account-sms',{userId,communityId:d.communityId,type:d.type,preference:d.preference},{jobId:`account_sms_${d.notificationId}_${userId}`,attempts:1,removeOnComplete:1000,removeOnFail:1000});await notificationQueue.add('account-email',{userId,communityId:d.communityId,type:d.type,preference:d.preference},{jobId:`account_email_${d.notificationId}_${userId}`,attempts:3,backoff:{type:'exponential',delay:5000},removeOnComplete:1000,removeOnFail:1000});await pool.request().input('notification',sql.UniqueIdentifier,d.notificationId).input('user',sql.UniqueIdentifier,userId).input('type',sql.NVarChar(100),d.type).input('title',sql.NVarChar(180),safe(d.title,180)).input('body',sql.NVarChar(500),privateBody).input('community',sql.UniqueIdentifier,d.communityId).input('entity',sql.UniqueIdentifier,d.entityId??null).input('data',sql.NVarChar(2000),JSON.stringify(navigation)).query(`IF NOT EXISTS(SELECT 1 FROM UserNotifications WHERE NotificationId=@notification AND UserId=@user) INSERT INTO UserNotifications(NotificationId,UserId,NotificationType,Title,Body,CommunityId,EntityId,NavigationData) VALUES(@notification,@user,@type,@title,@body,@community,@entity,@data)`)}if(preference==='DAILY'||preference==='WEEKLY'){const digestKey=`${userId}:${preference}`;if(!digestUsers.has(digestKey)){digestUsers.add(digestKey);await pool.request().input('notification',sql.UniqueIdentifier,d.notificationId).input('user',sql.UniqueIdentifier,userId).input('frequency',sql.NVarChar(20),preference).input('title',sql.NVarChar(180),safe(d.title,180)).input('body',sql.NVarChar(500),privateBody).input('data',sql.NVarChar(2000),JSON.stringify(navigation)).query(`IF NOT EXISTS(SELECT 1 FROM NotificationDigestItems WHERE NotificationId=@notification AND UserId=@user) INSERT INTO NotificationDigestItems(NotificationId,UserId,Frequency,Title,Body,Data) VALUES(@notification,@user,@frequency,@title,@body,@data)`)}continue}const token=row.DeviceToken?String(row.DeviceToken):'';if(!token||seenTokens.has(token))continue;seenTokens.add(token);const delay=row.QuietHoursEnabled?quietDelay(row.TimeZone,row.QuietStart,row.QuietEnd):0;immediate.push({userId,token,delay,message:{to:token,sound:'default',title:safe(d.title,180),body:privateBody,data:navigation,channelId:'default',priority:d.priority??'normal'}})}
 const groups=new Map<number,typeof immediate>();for(const item of immediate){const bucket=Math.ceil(item.delay/60000)*60000;groups.set(bucket,[...(groups.get(bucket)??[]),item])}let batch=0;for(const[delay,items]of groups)for(let i=0;i<items.length;i+=100){const payload:Delivery={notificationId:d.notificationId,eventId:d.eventId,batch,messages:items.slice(i,i+100)};await notificationQueue.add('notification-delivery',payload,{jobId:`push_delivery_${d.eventId}_${batch}`,delay,attempts:4,backoff:{type:'exponential',delay:2000},removeOnComplete:1000,removeOnFail:1000});batch++}
 await pool.request().input('id',sql.UniqueIdentifier,d.notificationId).query(`UPDATE NotificationOutbox SET Status='DISPATCHED',DispatchedAt=SYSUTCDATETIME() WHERE NotificationId=@id;UPDATE UserNotifications SET DeliveryStatus=CASE WHEN DeliveryStatus='PENDING' THEN 'QUEUED' ELSE DeliveryStatus END WHERE NotificationId=@id`);return{devices:immediate.length,users:persistedUsers.size,digestUsers:digestUsers.size,batches:batch};
}
async function deliverBatch(d:Delivery){const pool=await getPool();const eligible:Delivery['messages']=[];for(const entry of d.messages){if(!await deliveryAllowed(entry.userId,entry.message?.data?.type||'',entry.message?.data?.preference))continue;const prefs=await communicationSettings(entry.userId);if(dndActive(prefs.DoNotDisturbUntil))continue;const app=(await pool.request().input('u',sql.UniqueIdentifier,entry.userId).query('SELECT NotificationPreviewsEnabled FROM UserAppPreferences WHERE UserId=@u')).recordset[0];if(entry.message?.data?.type==='CHAT_MESSAGE'&&!app?.NotificationPreviewsEnabled)entry.message={...entry.message,body:'New message'};eligible.push(entry)}d={...d,messages:eligible};if(!d.messages.length)return{sent:0,muted:true};const result=await sendPushBatch(d.messages.map(x=>x.message)),receiptIds:string[]=[],receiptTokens:Record<string,string>={};for(let i=0;i<result.tickets.length;i++){const ticket=result.tickets[i],entry=d.messages[i];if(ticket?.status==='error'&&ticket?.details?.error==='DeviceNotRegistered')await pool.request().input('token',sql.NVarChar(500),entry.token).query(`DELETE FROM UserDevices WHERE DeviceToken=@token`);if(ticket?.id){receiptIds.push(ticket.id);receiptTokens[ticket.id]=entry.token}}await pool.request().input('id',sql.UniqueIdentifier,d.notificationId).query(`UPDATE UserNotifications SET DeliveryStatus='SENT' WHERE NotificationId=@id`);if(receiptIds.length)await notificationQueue.add('notification-receipts',{notificationId:d.notificationId,ids:receiptIds,receiptTokens},{jobId:`push_receipts_${d.eventId}_${d.batch}`,delay:15*60_000,attempts:3,backoff:{type:'exponential',delay:5000},removeOnComplete:1000,removeOnFail:1000});return{sent:d.messages.length,receipts:receiptIds.length}}
async function processReceipts(d:{notificationId:string;ids:string[];receiptTokens:Record<string,string>}){const pool=await getPool(),receipts=await getPushReceipts(d.ids);for(const[id,receipt]of Object.entries(receipts) as [string,any][])if(receipt?.status==='error'&&receipt?.details?.error==='DeviceNotRegistered'&&d.receiptTokens[id])await pool.request().input('token',sql.NVarChar(500),d.receiptTokens[id]).query(`DELETE FROM UserDevices WHERE DeviceToken=@token`);await pool.request().input('id',sql.UniqueIdentifier,d.notificationId).query(`UPDATE NotificationOutbox SET Status='COMPLETED',CompletedAt=SYSUTCDATETIME() WHERE NotificationId=@id`);return{receipts:Object.keys(receipts).length}}
async function sendAccountEmail(d:{userId:string;communityId:string;type?:string;preference?:string}){
 if(!await deliveryAllowed(d.userId,d.type||'',d.preference))return{skipped:true};
 const pool=await getPool();const r=await pool.request().input('u',sql.UniqueIdentifier,d.userId).input('c',sql.UniqueIdentifier,d.communityId).query(`SELECT u.Email FROM Users u JOIN AccountSettings a ON a.UserId=u.Id WHERE u.Id=@u AND u.AccountStatus='ACTIVE' AND u.EmailVerified=1 AND a.EmailUpdates=1 AND EXISTS(SELECT 1 FROM CommunityMembers cm WHERE cm.UserId=@u AND cm.CommunityId=@c AND cm.Status='ACTIVE')`);
 if(!r.recordset[0]||dndActive((await communicationSettings(d.userId)).DoNotDisturbUntil))return{skipped:true};
 const result=await sendEmailBatch([{to:r.recordset[0].Email,subject:'New CDA Connect community update',text:'You have a new community update. Sign in at https://cdaconnect.org/notifications to read it. Manage email updates in Account Settings.'}]);
 if(result.skipped)throw Error('Community email delivery is not configured');return result;
}
async function sendAccountSms(d:{userId:string;communityId:string;type?:string;preference?:string}){
 if(!await deliveryAllowed(d.userId,d.type||'',d.preference))return{skipped:true};
 const prefs=await communicationSettings(d.userId);if(!prefs.SmsUpdates||dndActive(prefs.DoNotDisturbUntil))return{skipped:true};
 const pool=await getPool(),u=(await pool.request().input('u',sql.UniqueIdentifier,d.userId).input('c',sql.UniqueIdentifier,d.communityId).query(`SELECT Phone FROM Users u WHERE Id=@u AND PhoneVerified=1 AND AccountStatus='ACTIVE' AND EXISTS(SELECT 1 FROM CommunityMembers cm WHERE cm.UserId=@u AND cm.CommunityId=@c AND cm.Status='ACTIVE')`)).recordset[0];if(!u?.Phone)return{skipped:true};
 // At most one routine update per hour; no automatic SMS retry after an uncertain provider response.
 if(!await getRedis().set('routine-sms:'+d.userId,'1','EX',3600,'NX'))return{skipped:true};
 await sendTransactionalSms(u.Phone,'You have new CDA Connect updates. Sign in at https://cdaconnect.org/notifications. Manage SMS updates in Communications settings.');return{sent:1};
}
async function processNotification(job:Job){if(job.name==='account-sms')return sendAccountSms(job.data);if(job.name==='account-email')return sendAccountEmail(job.data);if(job.name==='notification-dispatch')return dispatchNotification(job.data);if(job.name==='notification-delivery')return deliverBatch(job.data as Delivery);if(job.name==='notification-receipts')return processReceipts(job.data);throw new Error(`Unknown notification job ${job.name}`)}

const notificationWorker = new Worker('notifications', processNotification, { connection: createRedisConnection(), concurrency: 6,lockDuration:60000 });
const backgroundWorker = new Worker('background-jobs', async job => ({ accepted: true, type: job.name, data: job.data }), { connection: createRedisConnection(), concurrency: 8 });

emergencyWorker.on('failed', async (job,error) => {
  console.error(`Worker failed emergency-broadcasts:${job?.id}`, error);
  if(job?.data?.auditId && job.attemptsMade >= (job.opts.attempts ?? 1)) await setAudit(job.data.auditId,'FAILED',{error:String(error),attempts:job.attemptsMade});
});
for (const worker of [emergencyWorker, notificationWorker, backgroundWorker]) {
  worker.on('completed', job => console.log(`Worker completed ${worker.name}:${job.id}`));
  worker.on('failed', (job,error) => console.error(`Worker failed ${worker.name}:${job?.id}`, error));
  worker.on('stalled',jobId=>console.warn('Worker job stalled',{queue:worker.name,jobId}));
  worker.on('error',error=>console.error('Worker error',{queue:worker.name,error}));
}
notificationWorker.on('failed',async(job,error)=>{const notificationId=job?.data?.notificationId;if(!notificationId)return;try{const pool=await getPool();await pool.request().input('id',sql.UniqueIdentifier,notificationId).input('error',sql.NVarChar(2000),String(error)).query(`UPDATE NotificationOutbox SET Status='PENDING_RETRY',LastError=@error,AttemptCount=AttemptCount+1 WHERE NotificationId=@id`)}catch(updateError){console.error('Unable to record notification failure',{notificationId,updateError})}});
async function recoverNotificationOutbox(){try{const pool=await getPool(),rows=await pool.request().query(`SELECT TOP 100 NotificationId,EventId,NotificationType,Payload FROM NotificationOutbox WHERE Status IN('PENDING','PENDING_RETRY') AND AttemptCount<10 ORDER BY CreatedAt`);for(const row of rows.recordset){try{await notificationQueue.add('notification-dispatch',JSON.parse(row.Payload),{jobId:`push_${String(row.NotificationType).replace(/[^a-zA-Z0-9_-]/g,'_')}_${row.EventId}`,attempts:4,backoff:{type:'exponential',delay:1500},removeOnComplete:1000,removeOnFail:1000});await pool.request().input('id',sql.UniqueIdentifier,row.NotificationId).query(`UPDATE NotificationOutbox SET Status='QUEUED',QueuedAt=SYSUTCDATETIME() WHERE NotificationId=@id`)}catch(error){console.error('Unable to recover notification',{notificationId:row.NotificationId,eventId:row.EventId,error})}}}catch(error){console.error('Notification outbox recovery failed',{error})}}
await queueDueReminders().catch(error=>console.error('Event reminders failed',error));
setInterval(()=>void queueDueReminders().catch(error=>console.error('Event reminders failed',error)),60_000).unref();
await recoverNotificationOutbox();setInterval(recoverNotificationOutbox,30_000).unref();
setInterval(async()=>{try{const counts=await notificationQueue.getJobCounts('waiting','active','delayed','failed','completed');console.info('Notification queue metrics',{...counts,timestamp:new Date().toISOString()})}catch(error){console.error('Unable to read notification queue metrics',{error})}},60_000).unref();
await recoverPendingEmergencyJobs();
setInterval(recoverPendingEmergencyJobs,30_000).unref();
console.log('CDA Connect workers running');
await writeFile('/tmp/cda-worker-ready',new Date().toISOString());
setInterval(async()=>{try{await Promise.all([getRedis().ping(),(await getPool()).request().query('SELECT 1 ok')]);await writeFile('/tmp/cda-worker-ready',new Date().toISOString())}catch(error){console.error('Worker health check failed',error)}},30000).unref();
let shuttingDown=false;
async function shutdown(signal:string){if(shuttingDown)return;shuttingDown=true;console.log(`Worker shutdown requested: ${signal}`);await Promise.allSettled([emergencyWorker.close(),notificationWorker.close(),backgroundWorker.close(),emergencyQueue.close(),notificationQueue.close(),getRedis().quit()]);process.exit(0)}
process.once('SIGTERM',()=>{void shutdown('SIGTERM')});
process.once('SIGINT',()=>{void shutdown('SIGINT')});
