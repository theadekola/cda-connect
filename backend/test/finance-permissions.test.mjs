import test,{after} from 'node:test';import assert from 'node:assert/strict';import express from 'express';import sql from 'mssql';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {levyRouter}=await import('../dist/routes/levies.js'),{advancedRouter}=await import('../dist/routes/advanced.js');
let grants=new Set(),requested=[];const original={connect:sql.ConnectionPool.prototype.connect,query:sql.Request.prototype.query};
sql.ConnectionPool.prototype.connect=async function(){return this};sql.Request.prototype.query=async function(text){
 if(text.includes('CommunityShardMap'))return{recordset:[]};
 if(text.includes('SELECT TOP 1 Id FROM CommunityMembers'))return{recordset:[{Id:'member'}]};
 if(text.includes('1 Allowed FROM')){const p=this.parameters.permission.value;requested.push(p);assert.match(text,/cm.Status='ACTIVE'/);assert.match(text,/account.AccountStatus='ACTIVE'/);assert.match(text,/ex.AppointedDate<=/);assert.match(text,/ex.TenureEndDate>=/);assert.match(text,/p.Code=@permission/);return{recordset:grants.has(p)?[{Allowed:1}]:[]}}
 if(text.includes('FROM StoredObjects o')){assert.match(text,/o.UploadedBy=@u OR/);assert.match(text,/s.CommunityId=@c/);return{recordset:[]}}
 return{recordset:[],recordsets:[[{Balance:0}],[{OutstandingAmount:0}]]};
};
const app=express();app.use(express.json(),(req,res,next)=>{req.user={id:'member'};next()},levyRouter);for(const layer of advancedRouter.stack){if(layer.route?.path.includes('/finance/')){const method=Object.keys(layer.route.methods)[0];app[method](layer.route.path,layer.route.stack.at(-1).handle)}}app.use((e,req,res,next)=>res.status(e.status||(e.name==='ZodError'?400:500)).json({error:e.message}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));after(()=>{Object.assign(sql.ConnectionPool.prototype,{connect:original.connect});sql.Request.prototype.query=original.query;server.closeAllConnections();server.close()});
const routes=[['GET','payment-submissions','PAYMENT_REVIEW',200],['GET','unpaid-members','PAYMENT_REVIEW',200],['PATCH','payment-submissions/payment','PAYMENT_REVIEW',400],['PUT','bank-account','BANK_ACCOUNT_MANAGE',400],['POST','dues-plans','LEVY_MANAGE',400],['POST','transactions','FINANCE_MANAGE',400],['GET','summary','FINANCE_VIEW',200]];
const call=(method,path)=>fetch(`http://127.0.0.1:${server.address().port}/communities/community/finance/${path}`,{method,headers:{'content-type':'application/json'},...(method==='GET'?{}:{body:'{}'})});
for(const [method,path,permission,allowed] of routes)test(`${method} ${path} enforces only ${permission}`,async()=>{
 grants=new Set(['PAYMENT_REVIEW']);requested=[];assert.equal((await call(method,path)).status,permission==='PAYMENT_REVIEW'?allowed:403);assert.deepEqual(requested,[permission]);
 grants=new Set([permission]);requested=[];assert.equal((await call(method,path)).status,allowed);assert.deepEqual(requested,[permission]);
 grants=new Set();assert.equal((await call(method,path)).status,403);
});
test('evidence checks separate evidence authority and retains the uploader-scoped fallback',async()=>{grants=new Set();requested=[];assert.equal((await call('GET','evidence/object')).status,404);assert.deepEqual(requested,['PAYMENT_EVIDENCE_VIEW'])});
