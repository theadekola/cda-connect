import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sql from 'mssql';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {privacyRouter}=await import('../dist/routes/privacy.js');
const {requireAudience,mentionTargets,visibleContent,requireConversationContact}=await import('../dist/services/privacy.js');
const viewer='a9b1c630-0be5-426c-b145-578eb4da9181',owner='bd6c205a-8085-4236-a5ac-d476f0b03cec';
let queries=[],policy={Denied:0,Shared:1,CommentAudience:'EVERYONE',MentionAudience:'EVERYONE'},mentions=[],direct=[];
const pool={connected:true,request(){const params={};return {input(k,_type,v){params[k]=v;return this},async query(query){queries.push({query,params});if(query.includes('IsAdmin FROM Users'))return{recordset:[{InAppMessages:true,WhoCanMessage:'MEMBERS',IsAdmin:0}]};if(query.includes('CommentAudience')&&query.includes('Denied'))return {recordset:[policy]};if(query.includes('OPENJSON'))return{recordset:mentions};if(query.includes("c.Type='DIRECT'"))return{recordset:direct};if(query.includes('OUTPUT INSERTED.PostId'))return{recordset:[{PostId:owner}]};return{recordset:[]}}}}};
const connect=sql.ConnectionPool.prototype.connect;sql.ConnectionPool.prototype.connect=async()=>pool;
const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:viewer};next()});app.use(privacyRouter);app.use((e,_req,res,_next)=>res.status(e.status??(e.name==='ZodError'?400:500)).json({error:e.message}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
after(()=>{sql.ConnectionPool.prototype.connect=connect;server.closeAllConnections();server.close()});
const call=(path,method='GET',data)=>fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});
test('privacy mutations reject unknown fields and wrong value types before SQL',async()=>{
 queries=[];assert.equal((await call('/privacy','PATCH',{key:'PasswordHash',value:true})).status,400);assert.equal((await call('/privacy','PATCH',{key:'showEmail',value:'true'})).status,400);assert.equal((await call('/privacy','PATCH',{key:'commentAudience',value:'PUBLIC_ADMIN'})).status,400);assert.equal(queries.length,0);
});
test('email and phone switches save only the authenticated account and preserve other preferences',async()=>{
 queries=[];assert.equal((await call('/privacy','PATCH',{key:'showEmail',value:true})).status,200);assert.equal(queries.at(-1).params.v,'MEMBERS');assert.equal(queries.at(-1).params.u,viewer);assert.match(queries.at(-1).query,/UPDATE SET EmailVisibility=@v/);assert.doesNotMatch(queries.at(-1).query,/PhoneVisibility=/);
 assert.equal((await call('/privacy','PATCH',{key:'showPhone',value:false})).status,200);assert.equal(queries.at(-1).params.v,'NOBODY');
});
test('tag approval and download choices are persisted as booleans',async()=>{
 for(const key of ['tagApproval','allowDownloads']){assert.equal((await call('/privacy','PATCH',{key,value:false})).status,200);assert.equal(queries.at(-1).params.v,false);assert.match(queries.at(-1).query,/MERGE PrivacySafetySettings WITH\(HOLDLOCK\)/)}
});
test('comment and mention audience checks reject blocked, nobody and non-community viewers',async()=>{
 for(const kind of ['comment','mention']){policy={Denied:1,Shared:1,CommentAudience:'EVERYONE',MentionAudience:'EVERYONE'};await assert.rejects(requireAudience(viewer,owner,kind),e=>e.status===403);policy={Denied:0,Shared:1,CommentAudience:'NOBODY',MentionAudience:'NOBODY'};await assert.rejects(requireAudience(viewer,owner,kind),e=>e.status===403);policy={Denied:0,Shared:0,CommentAudience:'COMMUNITIES',MentionAudience:'COMMUNITIES'};await assert.rejects(requireAudience(viewer,owner,kind),e=>e.status===403);policy.Shared=1;await requireAudience(viewer,owner,kind);await requireAudience(owner,owner,kind)}
});
test('mention creation and established direct chat both enforce target privacy',async()=>{
 mentions=[{Id:owner}];policy={Denied:0,Shared:1,CommentAudience:'EVERYONE',MentionAudience:'NOBODY'};await assert.rejects(mentionTargets(viewer,owner,'Hello @member'),e=>e.status===403);
 direct=[{UserId:owner}];policy.Denied=1;await assert.rejects(requireConversationContact(viewer,owner),e=>e.status===403);policy.Denied=0;await requireConversationContact(viewer,owner);
});
test('block and hide are idempotent and cannot target self; phrases are parameterised',async()=>{
 for(const kind of ['blocked','hidden']){assert.equal((await call('/privacy/'+kind+'/'+viewer,'PUT',{enabled:true})).status,400);assert.equal((await call('/privacy/'+kind+'/'+owner,'PUT',{enabled:true})).status,200);assert.match(queries.at(-1).query,/MERGE/);assert.equal(queries.at(-1).params.u,viewer);assert.equal(queries.at(-1).params.id,owner)}
 assert.equal((await call('/privacy/words','PUT',{phrase:" Test ' % ",enabled:true})).status,200);assert.equal(queries.at(-1).params.p,"test ' %");assert.ok(!queries.at(-1).query.includes("test ' %"));
});
test('tag review and report reads are owner scoped; filters use literal substring matching',async()=>{
 assert.equal((await call('/privacy/tags/'+owner,'PUT',{status:'APPROVED'})).status,200);assert.match(queries.at(-1).query,/WHERE UserId=@u AND PostId=@id/);assert.equal(queries.at(-1).params.u,viewer);
 await call('/privacy/reports');assert.match(queries.at(-1).query,/ReportedBy=@u/);assert.match(queries.at(-1).query,/UserId=@u/);
 const clause=visibleContent('p.CreatedBy','p.Body');assert.match(clause,/BlockedUsers/);assert.match(clause,/HiddenUsers/);assert.match(clause,/RestrictedWords/);assert.match(clause,/CHARINDEX/);assert.doesNotMatch(clause,/LIKE/);
});
