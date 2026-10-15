import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sql from 'mssql';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {chatRouter}=await import('../dist/routes/chat.js');
const {advancedRouter}=await import('../dist/routes/advanced.js');
const {appleAssociation,androidAssociation}=await import('../dist/services/linkAssociations.js');
const C='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
let allowed=true,related=true,failDecision=false,log=[],commits=0,rollbacks=0;
const original={connect:sql.ConnectionPool.prototype.connect,query:sql.Request.prototype.query,begin:sql.Transaction.prototype.begin,commit:sql.Transaction.prototype.commit,rollback:sql.Transaction.prototype.rollback};
sql.ConnectionPool.prototype.connect=async()=>({connected:true,config:{},request:()=>new sql.Request()});
sql.Transaction.prototype.begin=async()=>{};sql.Transaction.prototype.commit=async()=>{commits++};sql.Transaction.prototype.rollback=async()=>{rollbacks++};
sql.Request.prototype.query=async function(text){
 const params=Object.fromEntries(Object.entries(this.parameters).map(([key,value])=>[key,value.value]));log.push({text,params,transaction:this.parent instanceof sql.Transaction});
 if(text.startsWith('SELECT 1 ok FROM ConversationMembers'))return{recordset:allowed?[{ok:1}]:[]};
 if(text.startsWith('SELECT TOP 101'))return{recordset:Array.from({length:101},(_,index)=>({Id:'message-'+(101-index)}))};
 if(text.includes('SELECT TOP 1 1 ok'))return{recordset:allowed?[{ok:1}]:[]};
 if(text.includes('SELECT TOP 1 Id FROM CommunityMembers'))return{recordset:allowed?[{Id:P}]:[]};
 if(text.startsWith('SELECT Id FROM GovernanceProposals WHERE'))return{recordset:related?[{Id:P}]:[]};
 if(text.startsWith('SELECT CommunityId FROM GovernanceProposals'))return{recordset:[{CommunityId:C}]};
 if(text.startsWith('SELECT * FROM GovernanceProposals'))return{recordset:[{Id:P,CommunityId:C,Title:'Improve lighting',Status:'VOTING'}]};
 if(text.startsWith('SELECT * FROM FormalBallots'))return{recordset:[{Id:P,CommunityId:C,Status:'OPEN',IsAnonymous:true,OpensAt:new Date(Date.now()-60000),ClosesAt:new Date(Date.now()+60000)}]};
 if(text.startsWith('SELECT Eligible FROM FormalBallotEligibility'))return{recordset:[{Eligible:true}]};
 if(text.startsWith('SELECT Id FROM FormalBallotOptions'))return{recordset:[{Id:C}]};
 if(text.startsWith('IF EXISTS(SELECT 1 FROM DecisionRegister')&&failDecision)throw Error('Decision write failed');
 if(text.startsWith('INSERT INTO GovernanceActions'))return{recordset:[{Id:P}]};
 return{recordset:[]};
};
const app=express();app.use(express.json(),(req,_res,next)=>{req.user={id:P};next()});
for(const router of [chatRouter,advancedRouter])for(const layer of router.stack){if(!layer.route)continue;for(const method of Object.keys(layer.route.methods))app[method](layer.route.path,...layer.route.stack.map(handler=>handler.handle))}
app.use((error,_req,res,_next)=>res.status(error.status||(error.name==='ZodError'?400:500)).json({error:error.message}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
after(()=>{Object.assign(sql.ConnectionPool.prototype,{connect:original.connect});Object.assign(sql.Request.prototype,{query:original.query});Object.assign(sql.Transaction.prototype,{begin:original.begin,commit:original.commit,rollback:original.rollback});server.closeAllConnections();server.close()});
const send=(path,data,method='POST')=>fetch(base+path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(data)});
test('chat pages return a bounded window and a cursor with deterministic timestamp ties',async()=>{
 log=[];const result=await(await fetch(base+'/conversations/'+C+'/messages?paged=1&before='+P)).json();
 assert.equal(result.items.length,100);assert.equal(result.items[0].Id,'message-2');assert.equal(result.nextCursor,'message-2');
 const query=log.find(entry=>entry.text.startsWith('SELECT TOP 101'));assert.equal(query.params.before,P);assert.match(query.text,/anchor.ConversationId=@cv/);assert.match(query.text,/m.CreatedAt=anchor.CreatedAt AND m.Id<anchor.Id/);assert.match(query.text,/ORDER BY m.CreatedAt DESC,m.Id DESC/);
 assert.equal((await(await fetch(base+'/conversations/'+C+'/messages')).json()).length,100);
});
test('chat history requires membership and rejects malformed cursors before reading messages',async()=>{
 allowed=false;log=[];assert.equal((await fetch(base+'/conversations/'+C+'/messages?paged=1')).status,403);assert.ok(!log.some(entry=>entry.text.startsWith('SELECT TOP 101')));allowed=true;
 log=[];assert.equal((await fetch(base+'/conversations/'+C+'/messages?before=invalid')).status,400);assert.equal(log.length,0);
});
test('governance actions reject proposals outside the community before inserting',async()=>{
 related=false;log=[];assert.equal((await send('/communities/'+C+'/governance/actions',{proposalId:P,title:'Repair lights'})).status,400);assert.ok(!log.some(entry=>entry.text.startsWith('INSERT INTO GovernanceActions')));related=true;
});
test('decisions require text and roll back the proposal stage when register persistence fails',async()=>{
 assert.equal((await send('/governance/proposals/'+P+'/status',{status:'DECIDED'},'PATCH')).status,400);
 const count=commits;failDecision=true;assert.equal((await send('/governance/proposals/'+P+'/status',{status:'DECIDED',decisionText:'Approve new lights'},'PATCH')).status,500);assert.equal(commits,count);assert.ok(rollbacks>0);failDecision=false;
 log=[];assert.equal((await send('/governance/proposals/'+P+'/status',{status:'DECIDED',decisionText:'Approve new lights'},'PATCH')).status,200);assert.ok(log.filter(entry=>entry.text.startsWith('UPDATE GovernanceProposals')||entry.text.startsWith('IF EXISTS(SELECT 1 FROM DecisionRegister')).every(entry=>entry.transaction));
});
test('association files require real signing identities and advertise only supported link paths',()=>{
 assert.throws(()=>androidAssociation(''),/Configure/);assert.throws(()=>androidAssociation('not-a-certificate'),/Configure/);
 const fingerprint=Array(32).fill('AB').join(':');assert.deepEqual(androidAssociation(fingerprint)[0].target.sha256_cert_fingerprints,[fingerprint]);
 assert.equal(appleAssociation('TEAM123.org.cdaconnect.app').applinks.details[0].appID,'TEAM123.org.cdaconnect.app');assert.throws(()=>appleAssociation(''),/Configure/);
});
test('anonymous vote tokens cannot be joined to the voter receipt',async()=>{
 log=[];const response=await send('/formal-ballots/'+P+'/vote',{optionId:C});assert.equal(response.status,200);
 const {receipt}=await response.json(),vote=log.find(entry=>entry.text.includes('INSERT INTO FormalBallotVotes'));
 assert.equal(vote.params.u,null);assert.equal(typeof vote.params.h,'string');assert.notEqual(vote.params.h,receipt);
});
