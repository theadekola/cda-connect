import {ensureRunnable} from './recovery.js';
import { Queue } from 'bullmq';
import crypto from 'node:crypto';
import { createRedisConnection } from '../config/redis.js';
import { getPool, sql } from '../config/db.js';

export const emergencyQueue = new Queue('emergency-broadcasts', { connection: createRedisConnection() });
export const notificationQueue = new Queue('notifications', { connection: createRedisConnection() });
export const backgroundQueue = new Queue('background-jobs', { connection: createRedisConnection() });

export type NotificationPreference='Initiatives'|'DirectMessages'|'Mentions'|'CommunityPosts'|'Polls'|'Events'|'Marketplace'|'BusinessPromotions';
export type CommunityNotificationRequest={communityId:string;eventId?:string;occurredAt?:string;actorUserId?:string;conversationId?:string;targetUserId?:string;type:string;title:string;body:string;entityId?:string;preference?:NotificationPreference;priority?:'normal'|'high';data?:Record<string,string>};
export type CommunityNotificationJob=CommunityNotificationRequest&{notificationId:string;eventId:string};

export async function enqueueCommunityNotification(message:CommunityNotificationRequest){
  const notificationId=crypto.randomUUID(),eventId=message.eventId??crypto.randomUUID(),job:CommunityNotificationJob={...message,notificationId,eventId};let pool;
  try{pool=await getPool();await pool.request().input('id',sql.UniqueIdentifier,notificationId).input('event',sql.UniqueIdentifier,eventId).input('community',sql.UniqueIdentifier,message.communityId).input('type',sql.NVarChar(100),message.type).input('payload',sql.NVarChar(sql.MAX),JSON.stringify(job)).query(`INSERT INTO NotificationOutbox(NotificationId,EventId,CommunityId,NotificationType,Payload,Status) VALUES(@id,@event,@community,@type,@payload,'PENDING')`)}catch(error){console.error('Unable to record notification outbox event',{communityId:message.communityId,type:message.type,entityId:message.entityId,eventId,notificationId,error});return{notificationId,eventId,status:'OUTBOX_FAILED' as const}}
  try{
    const queued=await ensureRunnable(notificationQueue,'notification-dispatch',job,{jobId:`push_${message.type.replace(/[^a-zA-Z0-9_-]/g,'_')}_${eventId}`,attempts:4,backoff:{type:'exponential',delay:1500},removeOnComplete:1000,removeOnFail:1000});
    await pool.request().input('id',sql.UniqueIdentifier,notificationId).input('status',sql.NVarChar(30),queued.status).query(`UPDATE NotificationOutbox SET Status=@status,QueuedAt=SYSUTCDATETIME(),UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@id AND Status IN('PENDING','PENDING_RETRY')`);
  }catch(error){
    await pool.request().input('id',sql.UniqueIdentifier,notificationId).input('error',sql.NVarChar(2000),String(error)).query(`UPDATE NotificationOutbox SET Status='PENDING_RETRY',LastError=@error,AttemptCount=AttemptCount+1 WHERE NotificationId=@id AND Status<>'COMPLETED'`);
    console.error('Unable to queue notification',{communityId:message.communityId,type:message.type,entityId:message.entityId,eventId,notificationId,error});
  }
  return{notificationId,eventId,status:'RECORDED' as const};
}

export async function enqueueEmergencyBroadcast(alertId: string, communityId: string) {
  const pool = await getPool();
  const audit = await pool.request()
    .input('q', sql.NVarChar(100), 'emergency-broadcasts')
    .input('k', sql.NVarChar(200), `emergency:${alertId}`)
    .input('c', sql.UniqueIdentifier, communityId)
    .input('e', sql.UniqueIdentifier, alertId)
    .query(`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
            BEGIN TRANSACTION;
            IF EXISTS(SELECT 1 FROM AsyncJobAudit WITH(UPDLOCK,HOLDLOCK) WHERE QueueName=@q AND JobKey=@k)
              SELECT TOP 1 Id,Status FROM AsyncJobAudit WHERE QueueName=@q AND JobKey=@k;
            ELSE
              INSERT INTO AsyncJobAudit(QueueName,JobKey,CommunityId,EntityId,Status) OUTPUT INSERTED.Id VALUES(@q,@k,@c,@e,'QUEUING');
            COMMIT TRANSACTION;`);
  const auditId = audit.recordset[0].Id as string;
  if(audit.recordset[0].Status==='COMPLETED')return {auditId,status:'COMPLETED' as const};
  try {
    const queued=await ensureRunnable(emergencyQueue,'broadcast', { alertId, communityId, auditId }, {
      jobId: `emergency_${alertId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 1000
    });
    await pool.request().input('id',sql.UniqueIdentifier,auditId).input('status',sql.NVarChar(30),queued.status).query(`UPDATE AsyncJobAudit SET Status=@status WHERE Id=@id AND Status NOT IN('PROCESSING','COMPLETED')`);
    return {auditId,status:queued.status};
  } catch (error) {
    await pool.request().input('id',sql.UniqueIdentifier,auditId).input('err',sql.NVarChar(2000),String(error)).query(`UPDATE AsyncJobAudit SET Status='PENDING_RETRY',LastError=@err WHERE Id=@id`);
    return { auditId, status: 'PENDING_RETRY' as const };
  }
}
