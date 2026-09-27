import {processLevyCycles} from '../services/levyCycles.js';
import {hasPermission} from '../services/permissions.js';
import {deliverSecurityMail} from '../services/securityMail.js';
import {discordAlert} from '../services/operationalHealth.js';
import {ensureRunnable} from '../queues/recovery.js';
import {deliveryNeedsQueue,recordDeliveryJob,planDelivery,claimDelivery,finishDelivery,completeOutbox,destinationHash,type Target} from '../services/deliveryLedger.js';
import {expireExecutiveTerms} from '../services/executiveTerms.js';
import {queuePollReminders} from '../services/pollNotifications.js';
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
import { getPushReceipts,sendEmailRecipient,sendPushBatch } from '../services/notifications.js';
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

async function processEmergency(job:Job<EmergencyData>){
 await setAudit(job.data.auditId,'PROCESSING',{attempts:job.attemptsMade+1});const pool=await getPool();
 const alert=(await pool.request().input('a',sql.UniqueIdentifier,job.data.alertId).query('SELECT * FROM EmergencyAlerts WHERE Id=@a')).recordset[0];if(!alert)throw Error('Emergency alert not found');
 const recipients=await pool.request().input('c',sql.UniqueIdentifier,alert.CommunityId).query(`SELECT cm.UserId,CASE WHEN u.EmailVerified=1 AND COALESCE(a.EmailUpdates,0)=1 THEN u.Email END Email,d.DeviceToken,d.Platform FROM CommunityMembers cm JOIN Users u ON u.Id=cm.UserId LEFT JOIN UserDevices d ON d.UserId=cm.UserId LEFT JOIN AccountSettings a ON a.UserId=cm.UserId WHERE cm.CommunityId=@c AND cm.Status='ACTIVE' AND u.AccountStatus='ACTIVE'`);
 const users=new Set<string>();for(const row of recipients.recordset){if(!await deliveryAllowed(row.UserId,'EMERGENCY_ALERT'))continue;users.add(row.UserId);
 for(const [channel,destination] of [['PUSH',row.DeviceToken],['EMAIL',row.Email]]){if(!destination)continue;
 const hash=destinationHash(String(destination)),request=()=>pool.request().input('alert',sql.UniqueIdentifier,alert.Id).input('user',sql.UniqueIdentifier,row.UserId).input('channel',sql.NVarChar(20),channel).input('hash',sql.Char(64),hash);
 await request().query(`INSERT INTO EmergencyNotificationDeliveries(AlertId,UserId,Channel,DestinationHash) SELECT @alert,@user,@channel,@hash WHERE NOT EXISTS(SELECT 1 FROM EmergencyNotificationDeliveries WITH(UPDLOCK,HOLDLOCK) WHERE AlertId=@alert AND UserId=@user AND Channel=@channel AND DestinationHash=@hash)`);
 const claimed=await request().query(`UPDATE EmergencyNotificationDeliveries SET Status='PROCESSING',UpdatedAt=SYSUTCDATETIME(),AttemptCount=AttemptCount+1 OUTPUT INSERTED.Id WHERE AlertId=@alert AND UserId=@user AND Channel=@channel AND DestinationHash=@hash AND Status='PENDING'`);if(!claimed.recordset.length)continue;
 let status='UNKNOWN',reason:string|undefined,providerId:string|undefined;
 if(channel==='EMAIL'){const result=await sendEmailRecipient({to:String(destination),subject:'Emergency alert: '+alert.Title,text:alert.Message},`emergency_${alert.Id}_${row.UserId}_${hash}`);status=result.status;reason=result.reason;providerId=result.providerId;}
 else{try{const result=await sendPushBatch([{to:destination,platform:row.Platform,title:'Emergency: '+alert.Title,body:alert.Message,data:{type:'EMERGENCY_ALERT',alertId:alert.Id,communityId:alert.CommunityId,severity:alert.Severity}}]),ticket=result.tickets[0];status=ticket?.status==='ok'?'SENT':ticket?.status==='error'?'FAILED':'UNKNOWN';providerId=ticket?.id;reason=ticket?.message;}catch{reason='Push provider acceptance could not be confirmed'}}
 // Persist immediately. A crash after acceptance leaves PROCESSING, which the watchdog marks UNKNOWN, never resends.
 await request().input('s',sql.NVarChar(30),status).input('r',sql.NVarChar(2000),reason??null).input('provider',sql.NVarChar(250),providerId??null).query(`UPDATE EmergencyNotificationDeliveries SET Status=CASE WHEN @s='FAILED' AND AttemptCount<3 THEN 'PENDING' ELSE @s END,LastError=@r,ProviderMessageId=@provider,UpdatedAt=SYSUTCDATETIME(),SentAt=CASE WHEN @s='SENT' THEN SYSUTCDATETIME() ELSE NULL END WHERE AlertId=@alert AND UserId=@user AND Channel=@channel AND DestinationHash=@hash AND Status='PROCESSING'`);
 }}
 const pending=(await pool.request().input('a',sql.UniqueIdentifier,alert.Id).query(`SELECT COUNT(*) n FROM EmergencyNotificationDeliveries WHERE AlertId=@a AND Status IN('PENDING','PROCESSING')`)).recordset[0]?.n;
 if(pending)throw Error('Emergency deliveries still awaiting terminal outcomes');
 await pool.request().input('a',sql.UniqueIdentifier,alert.Id).input('n',sql.Int,users.size).query(`UPDATE EmergencyAlerts SET NotificationQueuedAt=COALESCE(NotificationQueuedAt,SYSUTCDATETIME()),NotificationTargetCount=@n WHERE Id=@a`);
 await setAudit(job.data.auditId,'COMPLETED',{attempts:job.attemptsMade+1});return {recipients:users.size};
}

async function recoverPendingEmergencyJobs() {
  try {
    const pool=await getPool();
    await pool.request().query(`UPDATE EmergencyNotificationDeliveries SET Status='UNKNOWN',LastError='Worker stopped before acceptance was recorded',UpdatedAt=SYSUTCDATETIME() WHERE Status='PROCESSING' AND UpdatedAt<DATEADD(minute,-30,SYSUTCDATETIME())`);
    const r=await pool.request().query(`SELECT TOP 100 Id,CommunityId,EntityId FROM AsyncJobAudit WHERE QueueName='emergency-broadcasts' AND (Status IN('PENDING_RETRY','FAILED') OR (Status IN('QUEUED','PROCESSING') AND COALESCE(StartedAt,CreatedAt)<DATEADD(minute,-30,SYSUTCDATETIME()))) AND Attempts<20 ORDER BY CreatedAt`);
    for(const row of r.recordset){
      try{
        const queued=await ensureRunnable(emergencyQueue,'broadcast',{alertId:row.EntityId,communityId:row.CommunityId,auditId:row.Id},{jobId:`emergency_${row.EntityId}`,attempts:5,backoff:{type:'exponential',delay:2000},removeOnComplete:500,removeOnFail:1000});
        await pool.request().input('id',sql.UniqueIdentifier,row.Id).input('s',sql.NVarChar(30),queued.status).query(`UPDATE AsyncJobAudit SET Status=@s,LastError=NULL WHERE Id=@id AND Status<>'COMPLETED'`);
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
 const emergency=/EMERGENCY|SOS/i.test(d.type)||Boolean(d.data?.sosId||d.data?.sosStatusId),platform=(await pool.request().input('community',sql.UniqueIdentifier,d.communityId).query('SELECT PlatformStatus FROM Communities WHERE Id=@community')).recordset[0];
 if(!platform||(!emergency&&platform.PlatformStatus!=='ACTIVE')){await pool.request().input('id',sql.UniqueIdentifier,d.notificationId).input('reason',sql.NVarChar(100),platform?'COMMUNITY_'+platform.PlatformStatus:'COMMUNITY_MISSING').query("UPDATE NotificationOutbox SET Status='CANCELLED',CompletionReason=@reason,CompletedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@id AND Status<>'COMPLETED'");return{skipped:true,reason:platform?.PlatformStatus??'MISSING'}}
 const recipientJoin=d.conversationId?"JOIN ConversationMembers recipient ON recipient.UserId=cm.UserId AND recipient.ConversationId=@conversation AND recipient.IsActive=1":'';
 let meetingFilter='';let meetingSms=true;if(d.type==='MEETING'||d.data?.type==='MEETING'){const meeting=(await pool.request().input('meeting',sql.UniqueIdentifier,d.entityId??null).query('SELECT SettingsJson FROM Meetings WHERE Id=@meeting')).recordset[0];if(!meeting){await completeOutbox(d.notificationId,true);return{skipped:true}};meetingFilter='AND dbo.CanViewMeeting(@meeting,cm.UserId)=1';meetingSms=meetingSettings(meeting.SettingsJson).smsReminders;}
 const targetFilter=d.targetUserId?'AND cm.UserId=@target':'';
 const result=await pool.request().input('community',sql.UniqueIdentifier,d.communityId).input('actor',sql.UniqueIdentifier,d.actorUserId??null).input('occurred',sql.DateTime2,d.occurredAt?new Date(d.occurredAt):null).input('conversation',sql.UniqueIdentifier,d.conversationId??null).input('target',sql.UniqueIdentifier,d.targetUserId??null).input('meeting',sql.UniqueIdentifier,d.entityId??null).input('requiredPermission',sql.NVarChar(100),d.data?.requiresPermission??null).query(`SELECT DISTINCT cm.UserId,devices.DeviceToken,CONVERT(varchar(20),preferences.${column}) PreferenceValue,preferences.Enabled,preferences.QuietHoursEnabled,CONVERT(varchar(5),preferences.QuietStart,108) QuietStart,CONVERT(varchar(5),preferences.QuietEnd,108) QuietEnd,COALESCE(app.TimeZone,'UTC') TimeZone,COALESCE(app.NotificationPreviewsEnabled,0) NotificationPreviewsEnabled FROM CommunityMembers cm JOIN Communities community ON community.Id=cm.CommunityId ${recipientJoin} JOIN Users recipientUser ON recipientUser.Id=cm.UserId LEFT JOIN UserDevices devices ON devices.UserId=cm.UserId LEFT JOIN NotificationPreferences preferences ON preferences.UserId=cm.UserId LEFT JOIN UserAppPreferences app ON app.UserId=cm.UserId WHERE cm.CommunityId=@community AND cm.Status='ACTIVE' AND recipientUser.AccountStatus='ACTIVE' AND (@occurred IS NULL OR cm.JoinedAt<=@occurred) AND (@actor IS NULL OR cm.UserId<>@actor) AND (@actor IS NULL OR NOT EXISTS(SELECT 1 FROM BlockedUsers b WHERE (b.UserId=cm.UserId AND b.BlockedUserId=@actor) OR (b.UserId=@actor AND b.BlockedUserId=cm.UserId))) AND (@actor IS NULL OR NOT EXISTS(SELECT 1 FROM HiddenUsers h WHERE h.UserId=@actor AND h.HiddenUserId=cm.UserId)) AND (@requiredPermission IS NULL OR EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN RolePermissions rp ON rp.RoleId=mr.RoleId JOIN Permissions permission ON permission.Id=rp.PermissionId WHERE mr.CommunityMemberId=cm.Id AND permission.Code=@requiredPermission)) ${targetFilter} ${meetingFilter}`);
 const immediate:Delivery['messages']=[],persistedUsers=new Set<string>(),redis=getRedis();
 const outbox=(await pool.request().input('id',sql.UniqueIdentifier,d.notificationId).query('SELECT Status,DispatchComplete FROM NotificationOutbox WHERE NotificationId=@id')).recordset[0];if(outbox?.Status==='COMPLETED')return {completed:true};
 for(const row of result.recordset){const userId=String(row.UserId),preference=d.data?.sosId?'ON':String(row.PreferenceValue).toUpperCase(),token=String(row.DeviceToken||''),pushTarget:Target={notificationId:d.notificationId,userId,channel:'PUSH',destination:token||'NO_DEVICE'};
 if(d.data?.sosId&&!await hasPermission(userId,d.communityId,'EMERGENCY_MANAGE'))continue;
 const navigation={...d.data,type:d.type,preference:d.preference,communityId:d.communityId,entityId:d.entityId,eventId:d.eventId,conversationId:d.conversationId,actorUserId:d.actorUserId};const privateBody=d.type==='CHAT_MESSAGE'&&!row.NotificationPreviewsEnabled?'New message':safe(d.body,500);
 const firstForUser=!persistedUsers.has(userId);if(firstForUser){persistedUsers.add(userId);
 await pool.request().input('notification',sql.UniqueIdentifier,d.notificationId).input('user',sql.UniqueIdentifier,userId).input('type',sql.NVarChar(100),d.type).input('title',sql.NVarChar(180),safe(d.title,180)).input('body',sql.NVarChar(500),privateBody).input('community',sql.UniqueIdentifier,d.communityId).input('entity',sql.UniqueIdentifier,d.entityId??null).input('data',sql.NVarChar(2000),JSON.stringify(navigation)).query(`IF NOT EXISTS(SELECT 1 FROM UserNotifications WITH(UPDLOCK,HOLDLOCK) WHERE NotificationId=@notification AND UserId=@user) INSERT INTO UserNotifications(NotificationId,UserId,NotificationType,Title,Body,CommunityId,EntityId,NavigationData,DeliveryStatus) VALUES(@notification,@user,@type,@title,@body,@community,@entity,@data,'SENT')`);
 await planDelivery({notificationId:d.notificationId,userId,channel:'IN_APP'},'SENT');
 }
 const muted=!d.data?.sosId&&(row.Enabled===false||row.Enabled===0||preference==='OFF'||preference==='0'||(d.conversationId&&await redis.scard(`presence:conversation:${d.conversationId}:user:${userId}`)>0));
 if(muted){await planDelivery(pushTarget,'MUTED','Outbound delivery preferences or conversation presence');continue;}
 if(firstForUser&&preference!=='DAILY'&&preference!=='WEEKLY')for(const channel of ['EMAIL',...(meetingSms?['SMS']:[])]){
 const channelTarget={notificationId:d.notificationId,userId,channel};await planDelivery(channelTarget);if(!await deliveryNeedsQueue(channelTarget))continue;
 const queuedChannel=await ensureRunnable(notificationQueue,channel==='EMAIL'?'account-email':'account-sms',{notificationId:d.notificationId,userId,sosId:d.data?.sosId,sosStatusId:d.data?.sosStatusId,communityId:d.communityId,type:d.type,preference:d.preference,entityId:d.entityId,conversationId:d.conversationId,actorUserId:d.actorUserId},{jobId:`account_${channel.toLowerCase()}_${d.notificationId}_${userId}`,attempts:3,backoff:{type:'exponential',delay:5000},removeOnComplete:1000,removeOnFail:1000});await recordDeliveryJob(channelTarget,queuedChannel.job.id!);}
 if(preference==='DAILY'||preference==='WEEKLY'){
 if(firstForUser)await pool.request().input('notification',sql.UniqueIdentifier,d.notificationId).input('user',sql.UniqueIdentifier,userId).input('frequency',sql.NVarChar(20),preference).input('title',sql.NVarChar(180),safe(d.title,180)).input('body',sql.NVarChar(500),privateBody).input('data',sql.NVarChar(2000),JSON.stringify(navigation)).query(`IF NOT EXISTS(SELECT 1 FROM NotificationDigestItems WITH(UPDLOCK,HOLDLOCK) WHERE NotificationId=@notification AND UserId=@user) INSERT INTO NotificationDigestItems(NotificationId,UserId,Frequency,Title,Body,Data) VALUES(@notification,@user,@frequency,@title,@body,@data)`);
 await planDelivery(pushTarget,'SKIPPED','Deferred to '+preference+' digest');continue;}
 if(!token){await planDelivery(pushTarget,'NO_DEVICE','No push subscription');continue;}
 await planDelivery(pushTarget);if(!await deliveryNeedsQueue(pushTarget))continue;const delay=!d.data?.sosId&&row.QuietHoursEnabled?quietDelay(row.TimeZone,row.QuietStart,row.QuietEnd):0;
 const entry={userId,token,message:{to:token,sound:'default',title:safe(d.title,180),body:privateBody,data:navigation,channelId:'default',priority:d.priority??'normal'}};immediate.push(entry);
 const queuedPush=await ensureRunnable(notificationQueue,'notification-delivery',{notificationId:d.notificationId,eventId:d.eventId,batch:0,messages:[entry]},{jobId:`push_delivery_${d.notificationId}_${userId}_${destinationHash(token)}`,delay,attempts:4,backoff:{type:'exponential',delay:2000},removeOnComplete:1000,removeOnFail:1000});await recordDeliveryJob(pushTarget,queuedPush.job.id!);
 }
 await pool.request().input('id',sql.UniqueIdentifier,d.notificationId).query(`UPDATE NotificationOutbox SET Status='DISPATCHED',DispatchedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@id AND Status<>'COMPLETED'`);
 await completeOutbox(d.notificationId,true);return {devices:immediate.length,users:persistedUsers.size};
}
// Recheck audience at send time: queued work must not bypass membership or meeting/conversation changes.
async function stillEligible(user:string,data:any){if(data.sosStatusId){const owner=(await (await getPool()).request().input("id",sql.UniqueIdentifier,data.sosStatusId).input("u",sql.UniqueIdentifier,user).input("c",sql.UniqueIdentifier,data.communityId).query("SELECT Id FROM SOSRequests WHERE Id=@id AND UserId=@u AND CommunityId=@c")).recordset[0];if(!owner)return false;}if(data.sosId&&!await hasPermission(user,data.communityId,'EMERGENCY_MANAGE'))return false;const emergency=Boolean(data.sosId||data.sosStatusId)||/EMERGENCY|SOS/i.test(String(data.type||'')),pool=await getPool();const row=(await pool.request().input('u',sql.UniqueIdentifier,user).input('c',sql.UniqueIdentifier,data.communityId).input('emergency',sql.Bit,emergency).input('meeting',sql.UniqueIdentifier,data.type==='MEETING'?data.entityId??null:null).input('cv',sql.UniqueIdentifier,data.conversationId??null).input('actor',sql.UniqueIdentifier,data.actorUserId??null).query(`SELECT cm.Id FROM CommunityMembers cm JOIN Communities community ON community.Id=cm.CommunityId JOIN Users u ON u.Id=cm.UserId WHERE cm.UserId=@u AND cm.CommunityId=@c AND cm.Status='ACTIVE' AND u.AccountStatus='ACTIVE' AND (@emergency=1 OR community.PlatformStatus='ACTIVE') AND (@meeting IS NULL OR dbo.CanViewMeeting(@meeting,@u)=1) AND (@cv IS NULL OR EXISTS(SELECT 1 FROM ConversationMembers cv WHERE cv.ConversationId=@cv AND cv.UserId=@u AND cv.IsActive=1 AND (cv.MutedUntil IS NULL OR cv.MutedUntil<=SYSUTCDATETIME()))) AND (@actor IS NULL OR NOT EXISTS(SELECT 1 FROM BlockedUsers b WHERE (b.UserId=@u AND b.BlockedUserId=@actor) OR (b.UserId=@actor AND b.BlockedUserId=@u))) AND (@actor IS NULL OR NOT EXISTS(SELECT 1 FROM HiddenUsers h WHERE h.UserId=@actor AND h.HiddenUserId=@u))`)).recordset[0];return !!row;}

async function deliverBatch(d:Delivery){let sent=0;const pool=await getPool();for(const entry of d.messages){const target:Target={notificationId:d.notificationId,userId:entry.userId,channel:'PUSH',destination:entry.token};
 const data=entry.message?.data||{};
 if(!await stillEligible(entry.userId,data)){await finishDelivery(target,'SKIPPED','Recipient no longer eligible');continue;}
 if(!data.sosId&&(!await deliveryAllowed(entry.userId,data.type||'',data.preference)||dndActive((await communicationSettings(entry.userId)).DoNotDisturbUntil))){await finishDelivery(target,'MUTED','Delivery muted');continue;}
 const app=(await pool.request().input('u',sql.UniqueIdentifier,entry.userId).query('SELECT NotificationPreviewsEnabled FROM UserAppPreferences WHERE UserId=@u')).recordset[0];if(data.type==='CHAT_MESSAGE'&&!app?.NotificationPreviewsEnabled)entry.message={...entry.message,body:'New message'};
 if(!(await pool.request().input('u',sql.UniqueIdentifier,entry.userId).input('token',sql.NVarChar(500),entry.token).query('SELECT Id FROM UserDevices WHERE UserId=@u AND DeviceToken=@token')).recordset[0]){await finishDelivery(target,'NO_DEVICE','Device subscription removed');continue;}
 if(!await claimDelivery(target))continue;
 let ticket:any;try{ticket=(await sendPushBatch([entry.message])).tickets[0]}catch{await finishDelivery(target,'UNKNOWN','Push acceptance could not be confirmed');continue;}
 if(ticket?.status==='error'&&ticket?.details?.error==='DeviceNotRegistered')await pool.request().input('token',sql.NVarChar(500),entry.token).query('DELETE FROM UserDevices WHERE DeviceToken=@token');
 await finishDelivery(target,ticket?.status==='ok'?'SENT':ticket?.status==='error'?'FAILED':'UNKNOWN',ticket?.message||ticket?.details?.error,ticket?.id);
 if(ticket?.status==='ok'){sent++;if(ticket.id)await ensureRunnable(notificationQueue,'notification-receipts',{notificationId:d.notificationId,ids:[ticket.id],receiptTokens:{[ticket.id]:entry.token},targets:{[ticket.id]:target}},{jobId:`push_receipts_${d.notificationId}_${destinationHash(ticket.id)}`,delay:15*60_000,attempts:3,removeOnComplete:1000,removeOnFail:1000});}
 }await completeOutbox(d.notificationId);return {sent};}
async function processReceipts(d:{notificationId:string;ids:string[];receiptTokens:Record<string,string>;targets?:Record<string,Target>}){const pool=await getPool(),receipts=await getPushReceipts(d.ids);for(const[id,receipt]of Object.entries(receipts) as [string,any][]){if(receipt?.status==='error'){
 if(receipt?.details?.error==='DeviceNotRegistered'&&d.receiptTokens[id])await pool.request().input('token',sql.NVarChar(500),d.receiptTokens[id]).query('DELETE FROM UserDevices WHERE DeviceToken=@token');
 const target=d.targets?.[id];if(target)await pool.request().input('n',sql.UniqueIdentifier,d.notificationId).input('u',sql.UniqueIdentifier,target.userId).input('hash',sql.Char(64),destinationHash(target.destination||'PUSH')).input('r',sql.NVarChar(2000),String(receipt.message||receipt.details?.error)).query(`UPDATE NotificationDeliveries SET Status='FAILED',Reason=@r,UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@n AND UserId=@u AND Channel='PUSH' AND DestinationHash=@hash AND Status='SENT'`);
 }}await completeOutbox(d.notificationId);return {receipts:Object.keys(receipts).length};}
type AccountDelivery={sosStatusId?:string;sosId?:string;notificationId:string;userId:string;communityId:string;type?:string;preference?:string};
async function sendAccountChannel(d:AccountDelivery,channel:'EMAIL'|'SMS'){
 const target:Target={notificationId:d.notificationId,userId:d.userId,channel};
 if(!await stillEligible(d.userId,d)){await finishDelivery(target,'SKIPPED','Recipient no longer eligible');return;}
 if(!d.sosId&&!await deliveryAllowed(d.userId,d.type||'',d.preference)){await finishDelivery(target,'MUTED','Notification preferences');return;}
 const prefs=await communicationSettings(d.userId);if(!d.sosId&&dndActive(prefs.DoNotDisturbUntil)){await finishDelivery(target,'MUTED','Do not disturb');return;}
 const pool=await getPool(),u=(await pool.request().input('u',sql.UniqueIdentifier,d.userId).query(`SELECT u.Email,u.EmailVerified,u.Phone,u.PhoneVerified,a.EmailUpdates FROM Users u LEFT JOIN AccountSettings a ON a.UserId=u.Id WHERE u.Id=@u AND u.AccountStatus='ACTIVE'`)).recordset[0];
 if(!u||(channel==='EMAIL'?(!u.EmailVerified||!u.EmailUpdates||!u.Email):(!u.PhoneVerified||!prefs.SmsUpdates||!u.Phone))){await finishDelivery(target,'SKIPPED','Channel not enabled or destination not verified');return;}
 if(channel==='SMS'&&!await getRedis().set('routine-sms:'+d.userId,'1','EX',3600,'NX')){await finishDelivery(target,'SKIPPED','Routine SMS hourly limit');return;}
 if(!await claimDelivery(target))return;
 if(channel==='EMAIL'){const result=await sendEmailRecipient({to:u.Email,subject:'New CDA Connect community update',text:`You have a new community update. Sign in at ${env.PUBLIC_BASE_URL}/notifications to read it. Manage email updates in Account Settings.`},`notification_${d.notificationId}_${d.userId}`);await finishDelivery(target,result.status,result.reason,result.providerId);}
 else{try{await sendTransactionalSms(u.Phone,`You have new CDA Connect updates. Sign in at ${env.PUBLIC_BASE_URL}/notifications. Manage SMS updates in Communications settings.`)}catch{await finishDelivery(target,'UNKNOWN','SMS acceptance could not be confirmed');return;}await finishDelivery(target,'SENT');}
}

async function processNotification(job:Job){if(job.name==='account-sms')return sendAccountChannel(job.data,'SMS');if(job.name==='account-email')return sendAccountChannel(job.data,'EMAIL');if(job.name==='notification-dispatch')return dispatchNotification(job.data);if(job.name==='notification-delivery')return deliverBatch(job.data as Delivery);if(job.name==='notification-receipts')return processReceipts(job.data);throw new Error(`Unknown notification job ${job.name}`)}

const notificationWorker = new Worker('notifications', processNotification, { connection: createRedisConnection(), concurrency: 6,lockDuration:60000 });
const backgroundWorker = new Worker('background-jobs', async job => ({ accepted: true, type: job.name, data: job.data }), { connection: createRedisConnection(), concurrency: 8 });

emergencyWorker.on('failed', async (job,error) => {
  console.error(`Worker failed emergency-broadcasts:${job?.id}`, error);
  if(job?.data?.auditId && job.attemptsMade >= (job.opts.attempts ?? 1)) await setAudit(job.data.auditId,'FAILED',{error:String(error),attempts:job.attemptsMade});
});
for (const worker of [emergencyWorker, notificationWorker, backgroundWorker]) {
  worker.on('completed', job => console.log(`Worker completed ${worker.name}:${job.id}`));
  worker.on('failed', (job,error) => {console.error(`Worker failed ${worker.name}:${job?.id}`,error);void discordAlert('failed-'+worker.name,'CDA Connect: failed job in '+worker.name)});
  worker.on('stalled',jobId=>{console.warn('Worker job stalled',{queue:worker.name,jobId});void getRedis().incr('cda:stalled:'+worker.name);void discordAlert('stalled-'+worker.name,'CDA Connect: stalled job in '+worker.name)});
  worker.on('error',error=>console.error('Worker error',{queue:worker.name,error}));
}
notificationWorker.on('failed',async(job,error)=>{const notificationId=job?.data?.notificationId;if(!notificationId)return;try{const pool=await getPool();await pool.request().input('id',sql.UniqueIdentifier,notificationId).input('error',sql.NVarChar(2000),String(error)).query(`UPDATE NotificationOutbox SET Status='PENDING_RETRY',LastError=@error,AttemptCount=AttemptCount+1 WHERE NotificationId=@id AND Status<>'COMPLETED'`)}catch(updateError){console.error('Unable to record notification failure',{notificationId,updateError})}});
async function recoverNotificationOutbox(){try{const pool=await getPool();
 // A worker can die after provider acceptance. Never automatically resend an uncertain claim.
 await pool.request().query(`UPDATE NotificationDeliveries SET Status='UNKNOWN',Reason='Worker stopped before acceptance was recorded',UpdatedAt=SYSUTCDATETIME() WHERE Status='PROCESSING' AND UpdatedAt<DATEADD(minute,-30,SYSUTCDATETIME());
 UPDATE d SET Status='FAILED',Reason='Delivery recovery deadline exceeded',UpdatedAt=SYSUTCDATETIME() FROM NotificationDeliveries d JOIN NotificationOutbox o ON o.NotificationId=d.NotificationId WHERE d.Status='QUEUED' AND o.CreatedAt<DATEADD(day,-2,SYSUTCDATETIME());`);
 const rows=await pool.request().query(`SELECT TOP 100 NotificationId,EventId,NotificationType,Payload,AttemptCount FROM NotificationOutbox WHERE Status IN('PENDING','PENDING_RETRY') OR (Status IN('QUEUED','PROCESSING','DISPATCHED') AND UpdatedAt<DATEADD(minute,-30,SYSUTCDATETIME())) ORDER BY CreatedAt`);
 for(const row of rows.recordset){try{
 await completeOutbox(row.NotificationId);
 const current=(await pool.request().input('id',sql.UniqueIdentifier,row.NotificationId).query('SELECT Status,DispatchComplete FROM NotificationOutbox WHERE NotificationId=@id')).recordset[0];if(current?.Status==='COMPLETED')continue;
 if(current?.DispatchComplete){
 const pending=await pool.request().input('id',sql.UniqueIdentifier,row.NotificationId).query(`SELECT JobId,Status FROM NotificationDeliveries WHERE NotificationId=@id AND Status IN('QUEUED','PROCESSING')`);
 let healthy=pending.recordset.length>0;
 for(const target of pending.recordset){if(target.Status==='PROCESSING')continue;const job=target.JobId?await notificationQueue.getJob(target.JobId):null;const state=job?await job.getState():'missing';if(!['waiting','delayed','active','prioritized'].includes(state)){healthy=false;break;}}
 if(healthy){await pool.request().input('id',sql.UniqueIdentifier,row.NotificationId).query(`UPDATE NotificationOutbox SET UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@id`);continue;}
 }
 if(row.AttemptCount>=10){await pool.request().input('id',sql.UniqueIdentifier,row.NotificationId).query(`UPDATE NotificationDeliveries SET Status='FAILED',Reason='Recovery attempts exhausted',UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@id AND Status='QUEUED';UPDATE NotificationOutbox SET Status='FAILED',CompletionReason='RECOVERY_EXHAUSTED',CompletedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@id`);await completeOutbox(row.NotificationId);continue;}
 const queued=await ensureRunnable(notificationQueue,'notification-dispatch',JSON.parse(row.Payload),{jobId:`push_${String(row.NotificationType).replace(/[^a-zA-Z0-9_-]/g,'_')}_${row.EventId}`,attempts:4,backoff:{type:'exponential',delay:1500},removeOnComplete:1000,removeOnFail:1000});
 await pool.request().input('id',sql.UniqueIdentifier,row.NotificationId).input('status',sql.NVarChar(30),queued.status).query(`UPDATE NotificationOutbox SET Status=@status,QueuedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME(),AttemptCount=AttemptCount+1 WHERE NotificationId=@id AND Status<>'COMPLETED'`);
 }catch(error){console.error('Unable to recover notification',{notificationId:row.NotificationId,error});await pool.request().input('id',sql.UniqueIdentifier,row.NotificationId).input('error',sql.NVarChar(2000),String(error).slice(0,2000)).query(`UPDATE NotificationOutbox SET AttemptCount=AttemptCount+1,Status='PENDING_RETRY',LastError=@error,UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@id AND Status<>'COMPLETED'`);}}
 }catch(error){console.error('Notification outbox recovery failed',{error})}}

await processLevyCycles().catch(error=>console.error('Levy cycles failed',error));
setInterval(()=>void processLevyCycles().catch(error=>console.error('Levy cycles failed',error)),60_000).unref();
await queueDueReminders().catch(error=>console.error('Event reminders failed',error));
setInterval(()=>void queueDueReminders().catch(error=>console.error('Event reminders failed',error)),60_000).unref();
await recoverNotificationOutbox();setInterval(recoverNotificationOutbox,30_000).unref();
setInterval(async()=>{try{const counts=await notificationQueue.getJobCounts('waiting','active','delayed','failed','completed');console.info('Notification queue metrics',{...counts,timestamp:new Date().toISOString()})}catch(error){console.error('Unable to read notification queue metrics',{error})}},60_000).unref();
await recoverPendingEmergencyJobs();
setInterval(recoverPendingEmergencyJobs,30_000).unref();
console.log('CDA Connect workers running');
await getRedis().set('cda:worker:heartbeat',String(Date.now()),'EX',120);await writeFile('/tmp/cda-worker-ready',new Date().toISOString());
setInterval(async()=>{try{await Promise.all([getRedis().ping(),(await getPool()).request().query('SELECT 1 ok')]);await getRedis().set('cda:worker:heartbeat',String(Date.now()),'EX',120);await writeFile('/tmp/cda-worker-ready',new Date().toISOString())}catch(error){console.error('Worker health check failed',error)}},30000).unref();
let shuttingDown=false;
async function shutdown(signal:string){if(shuttingDown)return;shuttingDown=true;console.log(`Worker shutdown requested: ${signal}`);await Promise.allSettled([emergencyWorker.close(),notificationWorker.close(),backgroundWorker.close(),emergencyQueue.close(),notificationQueue.close(),getRedis().quit()]);process.exit(0)}
process.once('SIGTERM',()=>{void shutdown('SIGTERM')});
process.once('SIGINT',()=>{void shutdown('SIGINT')});

await queuePollReminders().catch(console.error);setInterval(()=>void queuePollReminders().catch(console.error),60000).unref();

await expireExecutiveTerms().catch(error=>console.error('Executive term expiry failed',error));
setInterval(()=>void expireExecutiveTerms().catch(error=>console.error('Executive term expiry failed',error)),60_000).unref();

await deliverSecurityMail().catch(()=>console.error('Security email dispatch failed'));setInterval(()=>void deliverSecurityMail().catch(()=>console.error('Security email dispatch failed')),30000).unref();
