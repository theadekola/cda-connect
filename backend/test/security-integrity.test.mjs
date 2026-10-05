import test,{after} from 'node:test';import assert from 'node:assert/strict';import express from 'express';import sql from 'mssql';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {advancedRouter}=await import('../dist/routes/advanced.js');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',ID='00000000-0000-4000-8000-000000000003';
let targetCommunity=B,type='POST',log=[],commits=0,rollbacks=0,ballotStatus='SCHEDULED',closes=new Date(Date.now()-1000),optionMatches=true,auditFails=false;
const orig={connect:sql.ConnectionPool.prototype.connect,query:sql.Request.prototype.query,begin:sql.Transaction.prototype.begin,commit:sql.Transaction.prototype.commit,rollback:sql.Transaction.prototype.rollback};
sql.ConnectionPool.prototype.connect=async()=>({connected:true,config:{},request:()=>new sql.Request()});sql.Transaction.prototype.begin=async()=>{};sql.Transaction.prototype.commit=async()=>{commits++};sql.Transaction.prototype.rollback=async()=>{rollbacks++};
sql.Request.prototype.query=async function(text){const p=Object.fromEntries(Object.entries(this.parameters).map(([k,v])=>[k,v.value]));log.push({text,p,transaction:this.parent instanceof sql.Transaction});
 if(text.includes('SELECT TOP 1 Id FROM CommunityMembers'))return {recordset:[{Id:ID}]};
 if(text.includes('SELECT TOP 1 1 ok'))return {recordset:[{ok:1}]};
 if(text.includes('SELECT * FROM ModerationQueue'))return {recordset:[{Id:ID,CommunityId:A,EntityType:type,EntityId:ID,Status:'PENDING_REVIEW'}]};
 if((text.includes('SELECT CommunityId')||text.includes('SELECT p.CommunityId'))&&text.includes('UPDLOCK'))return {recordset:targetCommunity===p.c?[{CommunityId:targetCommunity}]:[]};
 if(text.includes('SELECT * FROM FormalBallots'))return {recordset:[{Id:ID,CommunityId:A,Status:ballotStatus,OpensAt:new Date(Date.now()-86400000),ClosesAt:closes,IsAnonymous:true,QuorumPercent:50}]};
 if(text.includes('SELECT Eligible FROM'))return {recordset:[{Eligible:1}]};
 if(text.includes('SELECT Id FROM FormalBallotOptions'))return {recordset:optionMatches?[{Id:ID}]:[]};
 if(text.includes('EligibleCount'))return {recordset:[{EligibleCount:2,VoteCount:1}]};
 if(text.includes('INSERT INTO AuditLogs')&&auditFails)throw Error('Audit unavailable');
 return {recordset:[{Id:ID,CommunityId:A}]};};
const app=express();app.use(express.json(),(req,res,next)=>{req.user={id:ID};next()});
for(const path of ['/communities/:communityId/moderation-queue','/moderation-queue/:itemId/review','/formal-ballots/:ballotId/vote','/formal-ballots/:ballotId/finalize']){const route=advancedRouter.stack.find(x=>x.route?.path===path&&(!path.includes('communities')||x.route.methods.post)).route;app[Object.keys(route.methods)[0]](path,route.stack.at(-1).handle)}
app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const send=(path,body={},method='POST')=>fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
after(()=>{Object.assign(sql.ConnectionPool.prototype,{connect:orig.connect});Object.assign(sql.Request.prototype,{query:orig.query});Object.assign(sql.Transaction.prototype,{begin:orig.begin,commit:orig.commit,rollback:orig.rollback});server.closeAllConnections();server.close()});
for(const entityType of ['POST','COMMENT','MARKETPLACE']){
 test(entityType+' cross-community report cannot be inserted',async()=>{type=entityType;targetCommunity=B;log=[];const r=await send('/communities/'+A+'/moderation-queue',{entityType,entityId:ID,reasonCode:'abuse'});assert.equal(r.status,404);assert.ok(!log.some(x=>x.text.includes('INSERT INTO ModerationQueue')))});
 test(entityType+' forged existing report cannot remove foreign content',async()=>{type=entityType;targetCommunity=B;log=[];const r=await send('/moderation-queue/'+ID+'/review',{decision:'REMOVE'},'PATCH');assert.equal(r.status,404);assert.ok(!log.some(x=>x.text.startsWith('UPDATE')));assert.ok(log.find(x=>x.text.includes('SELECT * FROM ModerationQueue')).transaction)});
 test(entityType+' local report can be removed with a scoped mutation',async()=>{type=entityType;targetCommunity=A;log=[];const r=await send('/moderation-queue/'+ID+'/review',{decision:'REMOVE'},'PATCH');assert.equal(r.status,200);const mutation=log.find(x=>x.text.startsWith('UPDATE')&&!x.text.includes('UPDATE ModerationQueue'));assert.match(mutation.text,/CommunityId=@c/);assert.equal(mutation.p.c,A);assert.equal(mutation.transaction,true)});
}
test('ballot option from a different ballot fails before receipt or vote writes',async()=>{closes=new Date(Date.now()+86400000);optionMatches=false;log=[];assert.equal((await send('/formal-ballots/'+ID+'/vote',{optionId:B})).status,400);assert.ok(!log.some(x=>x.text.includes('INSERT INTO FormalBallot')));assert.match(log.find(x=>x.text.includes('SELECT Id FROM FormalBallotOptions')).text,/Id=@o AND BallotId=@b/)});
test('early, repeated and invalid-state finalization all reject',async()=>{for(const [status,date]of [['SCHEDULED',Date.now()+86400000],['FINAL',Date.now()-1000],['CANCELLED',Date.now()-1000]]){ballotStatus=status;closes=new Date(date);log=[];assert.equal((await send('/formal-ballots/'+ID+'/finalize')).status,409);assert.ok(!log.some(x=>x.text.startsWith('UPDATE FormalBallots')))}});
test('finalization audit is in the same transaction, with rollback on audit failure',async()=>{ballotStatus='SCHEDULED';closes=new Date(Date.now()-1000);auditFails=true;const before=commits;assert.equal((await send('/formal-ballots/'+ID+'/finalize')).status,500);assert.equal(commits,before);assert.ok(rollbacks>0);auditFails=false;log=[];assert.equal((await send('/formal-ballots/'+ID+'/finalize')).status,200);assert.ok(log.find(x=>x.text.includes('INSERT INTO AuditLogs')).transaction);assert.match(log.find(x=>x.text.includes('SELECT * FROM FormalBallots')).text,/UPDLOCK,HOLDLOCK/)});
