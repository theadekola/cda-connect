import { Queue } from 'bullmq';
import crypto from 'node:crypto';
import { createRedisConnection } from '../config/redis.js';
import { getPool, sql } from '../config/db.js';

export const emergencyQueue = new Queue('emergency-broadcasts', { connection: createRedisConnection() });
export const notificationQueue = new Queue('notifications', { connection: createRedisConnection() });
export const backgroundQueue = new Queue('background-jobs', { connection: createRedisConnection() });

export type CommunityNotificationJob={communityId:string;actorUserId?:string;conversationId?:string;targetUserId?:string;type:string;title:string;body:string;entityId?:string;preference?:'DirectMessages'|'Mentions'|'CommunityPosts'|'Polls'|'Events'|'Marketplace'|'BusinessPromotions';data?:Record<string,string>};

export async function enqueueCommunityNotification(message:CommunityNotificationJob){
  try{
    await notificationQueue.add('community-activity',message,{jobId:`push:${message.type}:${message.entityId??crypto.randomUUID()}`,attempts:4,backoff:{type:'exponential',delay:1500},removeOnComplete:1000,removeOnFail:1000});
  }catch(error){console.error('Unable to queue push notification',error);}
}

export async function enqueueEmergencyBroadcast(alertId: string, communityId: string) {
  const pool = await getPool();
  const audit = await pool.request()
    .input('q', sql.NVarChar(100), 'emergency-broadcasts')
    .input('k', sql.NVarChar(200), `emergency:${alertId}`)
    .input('c', sql.UniqueIdentifier, communityId)
    .input('e', sql.UniqueIdentifier, alertId)
    .query(`INSERT INTO AsyncJobAudit(QueueName,JobKey,CommunityId,EntityId,Status)
            OUTPUT INSERTED.Id VALUES(@q,@k,@c,@e,'QUEUING')`);
  const auditId = audit.recordset[0].Id as string;
  try {
    await emergencyQueue.add('broadcast', { alertId, communityId, auditId }, {
      jobId: `emergency:${alertId}`,
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 1000
    });
    await pool.request().input('id',sql.UniqueIdentifier,auditId).query(`UPDATE AsyncJobAudit SET Status='QUEUED' WHERE Id=@id`);
    return { auditId, status: 'QUEUED' as const };
  } catch (error) {
    await pool.request().input('id',sql.UniqueIdentifier,auditId).input('err',sql.NVarChar(2000),String(error)).query(`UPDATE AsyncJobAudit SET Status='PENDING_RETRY',LastError=@err WHERE Id=@id`);
    return { auditId, status: 'PENDING_RETRY' as const };
  }
}
