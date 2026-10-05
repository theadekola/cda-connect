import crypto from 'node:crypto';
import {getPool,sql} from '../config/db.js';
export type DeliveryStatus='QUEUED'|'PROCESSING'|'SENT'|'FAILED'|'SKIPPED'|'MUTED'|'NO_DEVICE'|'UNKNOWN';
export type Target={notificationId:string;userId:string;channel:string;destination?:string};
export const destinationHash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
async function request(t:Target){return (await getPool()).request().input('n',sql.UniqueIdentifier,t.notificationId).input('u',sql.UniqueIdentifier,t.userId).input('ch',sql.VarChar(20),t.channel).input('hash',sql.Char(64),destinationHash(t.destination||t.channel))}
export async function planDelivery(t:Target,status:DeliveryStatus='QUEUED',reason?:string){
 await (await request(t)).input('s',sql.VarChar(20),status).input('r',sql.NVarChar(2000),reason??null).query(`INSERT INTO NotificationDeliveries(NotificationId,UserId,Channel,DestinationHash,Status,Reason) SELECT @n,@u,@ch,@hash,@s,@r WHERE NOT EXISTS(SELECT 1 FROM NotificationDeliveries WITH(UPDLOCK,HOLDLOCK) WHERE NotificationId=@n AND UserId=@u AND Channel=@ch AND DestinationHash=@hash)`);
}
export async function claimDelivery(t:Target){const r=await(await request(t)).query(`UPDATE NotificationDeliveries SET Status='PROCESSING',AttemptCount=AttemptCount+1,UpdatedAt=SYSUTCDATETIME() OUTPUT INSERTED.UserId WHERE NotificationId=@n AND UserId=@u AND Channel=@ch AND DestinationHash=@hash AND Status='QUEUED'`);return !!r.recordset[0]}
export async function finishDelivery(t:Target,status:DeliveryStatus,reason?:string,providerId?:string){
 await(await request(t)).input('s',sql.VarChar(20),status).input('r',sql.NVarChar(2000),reason?.slice(0,2000)??null).input('provider',sql.NVarChar(250),providerId??null).query(`UPDATE NotificationDeliveries SET Status=CASE WHEN @s='FAILED' AND AttemptCount<3 THEN 'QUEUED' ELSE @s END,Reason=@r,ProviderMessageId=COALESCE(@provider,ProviderMessageId),UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@n AND UserId=@u AND Channel=@ch AND DestinationHash=@hash AND Status IN('QUEUED','PROCESSING')`);
 if(status==='FAILED'&&await deliveryNeedsQueue(t))throw new Error('Definite provider rejection; retry with queue backoff');
 await completeOutbox(t.notificationId);
}
export async function completeOutbox(id:string,seal=false){
 const pool=await getPool();await pool.request().input('n',sql.UniqueIdentifier,id).input('seal',sql.Bit,seal).query(`
 UPDATE o SET DispatchComplete=CASE WHEN @seal=1 THEN 1 ELSE DispatchComplete END,ExpectedCount=x.Expected,TerminalCount=x.Terminal,
 Status=CASE WHEN (DispatchComplete=1 OR @seal=1) AND x.Expected=x.Terminal THEN 'COMPLETED' ELSE Status END,
 CompletedAt=CASE WHEN (DispatchComplete=1 OR @seal=1) AND x.Expected=x.Terminal THEN COALESCE(CompletedAt,SYSUTCDATETIME()) ELSE CompletedAt END,
 CompletionReason=CASE WHEN (DispatchComplete=1 OR @seal=1) AND x.Expected=x.Terminal THEN CASE WHEN x.Expected=0 THEN 'NO_ELIGIBLE_RECIPIENTS' WHEN x.Problems>0 THEN 'FINISHED_WITH_DELIVERY_FAILURES_OR_UNKNOWN_OUTCOMES' ELSE 'ALL_CHANNELS_TERMINAL' END ELSE CompletionReason END,
 UpdatedAt=SYSUTCDATETIME() FROM NotificationOutbox o CROSS APPLY(SELECT COUNT(*) Expected,COUNT(CASE WHEN Status NOT IN('QUEUED','PROCESSING') THEN 1 END) Terminal,COUNT(CASE WHEN Status IN('FAILED','UNKNOWN') THEN 1 END) Problems FROM NotificationDeliveries WHERE NotificationId=@n)x WHERE o.NotificationId=@n;`);
}

export async function deliveryNeedsQueue(t:Target){return !!(await(await request(t)).query(`SELECT UserId FROM NotificationDeliveries WHERE NotificationId=@n AND UserId=@u AND Channel=@ch AND DestinationHash=@hash AND Status='QUEUED'`)).recordset[0]}
export async function recordDeliveryJob(t:Target,jobId:string){await(await request(t)).input('job',sql.VarChar(200),jobId).query(`UPDATE NotificationDeliveries SET JobId=@job,UpdatedAt=SYSUTCDATETIME() WHERE NotificationId=@n AND UserId=@u AND Channel=@ch AND DestinationHash=@hash AND Status='QUEUED'`)}
