import {type Queue,type JobsOptions} from 'bullmq';
// Call only for work protected by a durable delivery claim (or an idempotent dispatcher).
export async function ensureRunnable(queue:Queue,name:string,data:any,options:JobsOptions){
 if(!options.jobId)throw Error('Recovery requires a stable job ID');
 let job=await queue.getJob(options.jobId);
 if(job){const state=await job.getState();if(state==='failed'||state==='completed'){await job.updateData(data);await job.retry(state);}else if(state==='waiting'||state==='delayed')await job.updateData(data);}
 else job=await queue.add(name,data,options);
 const state=await job.getState();
 if(!['waiting','delayed','active','prioritized'].includes(state))throw Error(`Job ${options.jobId} is not runnable: ${state}`);
 return {job,state,status:state==='active'?'PROCESSING':'QUEUED'};
}
