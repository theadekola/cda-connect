import {getPool} from '../config/db.js';
import {getRedis} from '../config/redis.js';
import {env} from '../config/env.js';
export async function discordAlert(key:string,message:string){
 if(!env.DISCORD_WEBHOOK_URL)return;
 try{const redis=getRedis();if(!await redis.set('ops-alert:'+key,'1','EX',300,'NX'))return;
 const r=await fetch(env.DISCORD_WEBHOOK_URL,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({content:message,allowed_mentions:{parse:[]}}),signal:AbortSignal.timeout(10000)});
 if(!r.ok){await redis.del('ops-alert:'+key);throw Error('Webhook rejected')}}catch{console.error('Operational alert could not be delivered')}
}
type MetricsRedis=Pick<ReturnType<typeof getRedis>,'get'|'llen'|'zcard'>;
export async function collectOperationalHealth(redis:MetricsRedis,readOutbox:()=>Promise<number>,alert=discordAlert,now=Date.now()){
 const stamp=Number(await redis.get('cda:worker:heartbeat')),workerAgeSeconds=stamp&&stamp<=now+30000?Math.max(0,Math.floor((now-stamp)/1000)):null,queues:Record<string,unknown>={};
 for(const name of ['notifications','emergency-broadcasts','background-jobs']){const prefix='bull:'+name+':';const [waiting,delayed,active,failed,stalled]=await Promise.all([redis.llen(prefix+'wait'),redis.zcard(prefix+'delayed'),redis.llen(prefix+'active'),redis.zcard(prefix+'failed'),redis.get('cda:stalled:'+name)]);queues[name]={waiting,delayed,active,failed,stalled:Number(stalled||0)};if(failed)await alert('failed-'+name,`CDA Connect: ${failed} retained failed jobs in ${name}. Review worker logs and delivery outcomes.`)}
 const workerOk=workerAgeSeconds!==null&&workerAgeSeconds<90;if(!workerOk)await alert('worker-stale','CDA Connect worker heartbeat is stale or missing. Notification processing may be stopped.');
 return {workerOk,workerAgeSeconds,queues,oldestPendingOutboxSeconds:await readOutbox()};
}
export async function operationalHealth(){return collectOperationalHealth(getRedis(),async()=>{const row=(await(await getPool()).request().query(`SELECT COALESCE(MAX(DATEDIFF(second,CreatedAt,SYSUTCDATETIME())),0) Age FROM NotificationOutbox WHERE Status IN('PENDING','PENDING_RETRY','QUEUED','PROCESSING','DISPATCHED')`)).recordset[0];return Number(row?.Age||0)})}
