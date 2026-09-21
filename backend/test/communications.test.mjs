import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sql from 'mssql';
import {Redis} from 'ioredis';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {communicationsRouter}=await import('../dist/routes/communications.js');
const {chatRouter}=await import('../dist/routes/chat.js');
const {requireAudience}=await import('../dist/services/privacy.js');
const {allowDirectMessage,allowCall,dndActive}=await import('../dist/services/communications.js');
const viewer='a9b1c630-0be5-426c-b145-578eb4da9181',owner='bd6c205a-8085-4236-a5ac-d476f0b03cec';
let queries=[],prefs={},verified=true,policy={InAppMessages:true,WhoCanMessage:'MEMBERS',IsAdmin:0},validMessage=true;
const pool={connected:true,request(){const params={};return{input(k,_type,v){params[k]=v;return this},async query(query){queries.push({query,params});if(query.includes(' END Denied'))return{recordset:[{Denied:0,Shared:1,CommentAudience:'EVERYONE',MentionAudience:'EVERYONE'}]};if(query.startsWith('SELECT Phone,PhoneVerified'))return{recordset:[{Phone:'+447700900123',PhoneVerified:verified}]};if(query.startsWith('SELECT EmailVerified'))return{recordset:[{EmailVerified:verified}]};if(query.startsWith('SELECT * FROM CommunicationSettings'))return{recordset:[prefs]};if(query.includes('IsAdmin FROM Users'))return{recordset:[policy]};if(query.startsWith('SELECT m.CreatedAt'))return{recordset:validMessage?[{CreatedAt:new Date('2026-09-10T10:00:00Z')}]:[]};return{recordset:[]}}}}};
const connect=sql.ConnectionPool.prototype.connect;sql.ConnectionPool.prototype.connect=async()=>pool;
const original={connect:Redis.prototype.connect,incr:Redis.prototype.incr,expire:Redis.prototype.expire};Redis.prototype.connect=async()=>{};Redis.prototype.incr=async()=>1;Redis.prototype.expire=async()=>1;
const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:viewer};next()});app.use(communicationsRouter);
// Only mount the handler under test; the production router's authentication remains unchanged.
const readLayer=chatRouter.stack.find(x=>x.route?.path==='/conversations/:conversationId/read');app.post('/read/:conversationId',...readLayer.route.stack.map(x=>x.handle));
app.use((e,_req,res,_next)=>res.status(e.status??(e.name==='ZodError'?400:500)).json({error:e.message}));const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
after(()=>{sql.ConnectionPool.prototype.connect=connect;Object.assign(Redis.prototype,original);server.closeAllConnections();server.close()});
const call=(path,method='GET',data)=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
test('switch mutations validate key and boolean types and scope writes to the authenticated member',async()=>{
 queries=[];assert.equal((await call('/communications','PATCH',{key:'PasswordHash',value:true})).status,400);assert.equal((await call('/communications','PATCH',{key:'readReceipts',value:'yes'})).status,400);assert.equal(queries.length,0);
 for(const key of ['readReceipts','typingIndicators','messagePreviews','inAppMessages','voiceCalls']){assert.equal((await call('/communications','PATCH',{key,value:false})).status,200);assert.equal(queries.at(-1).params.u,viewer);assert.equal(queries.at(-1).params.v,false)}
});
test('SMS and email updates require verified contact details before enabling',async()=>{
 verified=false;queries=[];for(const key of ['smsUpdates','emailUpdates'])assert.equal((await call('/communications','PATCH',{key,value:true})).status,400);assert.ok(!queries.some(q=>q.query.includes('MERGE')));verified=true;
 assert.equal((await call('/communications','PATCH',{key:'smsUpdates',value:true})).status,200);
});
test('DND is bounded, persists a server deadline and can be cleared',async()=>{
 assert.equal((await call('/communications','PATCH',{key:'dndMinutes',value:10081})).status,400);const start=Date.now();assert.equal((await call('/communications','PATCH',{key:'dndMinutes',value:60})).status,200);assert.ok(queries.at(-1).params.v.getTime()>=start+3600000);await call('/communications','PATCH',{key:'dndMinutes',value:0});assert.equal(queries.at(-1).params.v,null);assert.equal(dndActive('invalid'),false);assert.equal(dndActive(new Date(2000),1000),true);assert.equal(dndActive(new Date(500),1000),false);
});
test('incoming message and voice-call choices are enforced',async()=>{
 policy={InAppMessages:false,WhoCanMessage:'MEMBERS',IsAdmin:0};await assert.rejects(allowDirectMessage(viewer,owner),e=>e.status===403);policy.InAppMessages=true;policy.WhoCanMessage='ADMINS';await assert.rejects(allowDirectMessage(viewer,owner));policy.IsAdmin=1;await allowDirectMessage(viewer,owner);prefs={VoiceCalls:false};assert.equal(await allowCall(owner),false);prefs={VoiceCalls:true,DoNotDisturbUntil:new Date(Date.now()+60000)};assert.equal(await allowCall(owner),false);prefs={VoiceCalls:true};assert.equal(await allowCall(owner),true);
});
test('contact matching retains only eligible member IDs and disable removes matches',async()=>{
 queries=[];assert.equal((await call('/communications/contacts','POST',{phones:['bad']})).status,400);assert.equal((await call('/communications/contacts','POST',{phones:['+447700900123']})).status,200);const q=queries.at(-1);assert.equal(q.params.u,viewer);assert.match(q.query,/PhoneVerified=1/);assert.match(q.query,/PhoneVisibility='MEMBERS'/);assert.match(q.query,/BlockedUsers/);assert.match(q.query,/HiddenUsers/);assert.match(q.query,/INSERT INTO SyncedContacts\(UserId,ContactUserId\)/);assert.doesNotMatch(q.query,/INSERT INTO.*PhoneNumber/);
 await call('/communications/contacts','DELETE');assert.match(queries.at(-1).query,/DELETE FROM SyncedContacts WHERE UserId=@u/);assert.match(queries.at(-1).query,/ContactSync=0/);
});
test('read receipts require an accessible message and clear personal unread state while respecting sharing opt-out',async()=>{
 queries=[];validMessage=false;assert.equal((await call('/read/'+owner,'POST',{messageId:owner})).status,403);assert.ok(!queries.some(q=>q.query.includes('MERGE')));validMessage=true;prefs={ReadReceipts:false};queries=[];const off=await call('/read/'+owner,'POST',{messageId:owner});assert.equal((await off.json()).shared,false);assert.ok(queries.some(q=>q.query.includes('MERGE ConversationReadReceipts')));prefs={ReadReceipts:true};await call('/read/'+owner,'POST',{messageId:owner});assert.match(queries.at(-1).query,/t.LastReadAt<@read/);assert.equal(queries.at(-1).params.u,viewer);
});

test('voice-call privacy does not inherit the direct-message channel opt-out',async()=>{policy={InAppMessages:false,WhoCanMessage:'NOBODY',IsAdmin:0};queries=[];await requireAudience(viewer,owner,'call');assert.ok(!queries.some(q=>q.query.includes('IsAdmin FROM Users')));await assert.rejects(requireAudience(viewer,owner,'contact'),e=>e.status===403)});
