import { Worker, type Job } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { env } from '../config/env.js';
import { getPool, sql } from '../config/db.js';
import { sendEmailBatch, sendPushBatch } from '../services/notifications.js';
import { emergencyQueue } from '../queues/index.js';

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
    SELECT cm.UserId,u.Email,d.DeviceToken,d.Platform
    FROM CommunityMembers cm
    JOIN Users u ON u.Id=cm.UserId
    LEFT JOIN UserDevices d ON d.UserId=cm.UserId
    WHERE cm.CommunityId=@c AND cm.Status='ACTIVE'
  `);
  const rows = recipients.recordset;
  const uniqueUsers = new Set(rows.map(x=>String(x.UserId)));
  const batchSize = Math.max(100, env.EMERGENCY_BATCH_SIZE);
  let processed = 0;
  for (let i=0;i<rows.length;i+=batchSize) {
    const batch = rows.slice(i,i+batchSize);
    const seenTokens=new Set<string>();
    const seenEmails=new Set<string>();
    const push = batch.filter(x=>x.DeviceToken && !seenTokens.has(String(x.DeviceToken)) && seenTokens.add(String(x.DeviceToken))).map(x=>({
      to:x.DeviceToken, platform:x.Platform, title:`🚨 ${alert.Title}`, body:alert.Message,
      data:{type:'EMERGENCY_ALERT',alertId:alert.Id,communityId:alert.CommunityId,severity:alert.Severity}
    }));
    const email = batch.filter(x=>x.Email && !seenEmails.has(String(x.Email)) && seenEmails.add(String(x.Email))).map(x=>({to:x.Email,subject:`Emergency alert: ${alert.Title}`,text:alert.Message}));
    await Promise.all([sendPushBatch(push), sendEmailBatch(email)]);
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
        await emergencyQueue.add('broadcast',{alertId:row.EntityId,communityId:row.CommunityId,auditId:row.Id},{jobId:`emergency:${row.EntityId}`,attempts:5,backoff:{type:'exponential',delay:2000},removeOnComplete:500,removeOnFail:1000});
        await pool.request().input('id',sql.UniqueIdentifier,row.Id).query(`UPDATE AsyncJobAudit SET Status='QUEUED',LastError=NULL WHERE Id=@id`);
      }catch(error){console.error('Unable to recover pending emergency job',row.Id,error);}
    }
  }catch(error){console.error('Pending job recovery failed',error);}
}

const emergencyWorker = new Worker<EmergencyData>('emergency-broadcasts', processEmergency, { connection: createRedisConnection(), concurrency: 4 });
const notificationWorker = new Worker('notifications', async job => ({ accepted: true, type: job.name, data: job.data }), { connection: createRedisConnection(), concurrency: 20 });
const backgroundWorker = new Worker('background-jobs', async job => ({ accepted: true, type: job.name, data: job.data }), { connection: createRedisConnection(), concurrency: 8 });

emergencyWorker.on('failed', async (job,error) => {
  console.error(`Worker failed emergency-broadcasts:${job?.id}`, error);
  if(job?.data?.auditId && job.attemptsMade >= (job.opts.attempts ?? 1)) await setAudit(job.data.auditId,'FAILED',{error:String(error),attempts:job.attemptsMade});
});
for (const worker of [emergencyWorker, notificationWorker, backgroundWorker]) {
  worker.on('completed', job => console.log(`Worker completed ${worker.name}:${job.id}`));
  worker.on('failed', (job,error) => console.error(`Worker failed ${worker.name}:${job?.id}`, error));
}
await recoverPendingEmergencyJobs();
setInterval(recoverPendingEmergencyJobs,30_000).unref();
console.log('CDA Connect workers running');
