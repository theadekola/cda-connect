import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sql from 'mssql';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {accountRouter}=await import('../dist/routes/account.js');
const hash=await bcrypt.hash('CorrectPassword1!',4),viewer='a9b1c630-0be5-426c-b145-578eb4da9181',target='bd6c205a-8085-4236-a5ac-d476f0b03cec';
let queries=[],mode='default';
const pool={connected:true,request(){const params={};return{input(k,_type,value){params[k]=value;return this},async query(query){queries.push({query,params});if(mode==='duplicate'&&query.includes('MERGE AccountSettings'))throw{number:2601};if(query.startsWith('SELECT PasswordHash'))return{recordset:[{PasswordHash:hash}]};if(query.includes('COALESCE(a.AllowFollowers'))return{recordset:mode==='denied'?[]:[{Id:target,AllowFollowers:false,ShowOnlineStatus:false}]};return{recordset:[]}}}}};
const connect=sql.ConnectionPool.prototype.connect;sql.ConnectionPool.prototype.connect=async()=>pool;
const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:viewer,email:'member@example.com'};next()});app.use(accountRouter);app.use((e,_req,res,_next)=>res.status(e.status??(e.name==='ZodError'?400:500)).json({error:e.message||'failure'}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
after(()=>{sql.ConnectionPool.prototype.connect=connect;server.closeAllConnections();server.close()});
async function call(path,method='GET',data){return fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined})}
test('username validates input, normalises case and returns conflict for duplicate',async()=>{
 queries=[];assert.equal((await call('/account/username','PUT',{username:'../bad'})).status,400);assert.equal(queries.length,0);
 assert.equal((await call('/account/username','PUT',{username:' Test_Member '})).status,200);assert.equal(queries.at(-1).params.name,'test_member');
 mode='duplicate';assert.equal((await call('/account/username','PUT',{username:'test_member'})).status,409);mode='default';
});
test('preference keys cannot become arbitrary SQL identifiers',async()=>{
 queries=[];assert.equal((await call('/account/preferences','PATCH',{key:'PasswordHash',value:true})).status,400);assert.equal(queries.length,0);
 assert.equal((await call('/account/preferences','PATCH',{key:'privateAccount',value:true})).status,200);assert.equal(queries.at(-1).params.u,viewer);assert.equal(queries.at(-1).params.v,true);
});
test('unavailable profiles fail before posts are loaded; follow opt-out is enforced',async()=>{
 mode='denied';queries=[];assert.equal((await call('/members/'+target)).status,404);assert.ok(!queries.some(q=>q.query.includes('FROM CommunityPosts')));
 mode='default';queries=[];assert.equal((await call('/members/'+target+'/follow','PUT',{following:true})).status,403);assert.ok(!queries.some(q=>q.query.includes('MERGE UserFollows')));
 assert.equal((await call('/members/'+viewer+'/follow','PUT',{following:true})).status,400);
});
test('registered email stays locked even with valid verification proof and password',async()=>{
 const proof=email=>jwt.sign({purpose:'email-verification',email},process.env.JWT_ACCESS_SECRET,{expiresIn:'15m'});
 for(const data of [
  {},
  {email:'new@example.com',emailVerificationToken:proof('different@example.com'),password:'CorrectPassword1!'},
  {email:'new@example.com',emailVerificationToken:proof('new@example.com'),password:'wrong'},
  {email:'new@example.com',emailVerificationToken:proof('new@example.com'),password:'CorrectPassword1!'}
 ]){
  queries=[];
  const response=await call('/account/email','PUT',data);
  assert.equal(response.status,403);
  assert.match((await response.json()).error,/registered email address is locked/i);
  assert.equal(queries.length,0,'Locked email must not access the database or revoke sessions');
 }
});
test('deactivation checks password before revoking devices and sessions',async()=>{
 queries=[];assert.equal((await call('/account/deactivate','POST',{password:'wrong'})).status,400);assert.equal(queries.length,1);
 assert.equal((await call('/account/deactivate','POST',{password:'CorrectPassword1!'})).status,200);assert.ok(queries.at(-1).query.includes("AccountStatus='DEACTIVATED'"));assert.ok(queries.at(-1).query.includes('DELETE FROM UserDevices'));
});
test('data export scopes queries to the signed-in user and excludes authentication secrets',async()=>{
 queries=[];const response=await call('/account/export');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(queries.every(q=>q.params.u===viewer));assert.ok(queries.every(q=>!/(PasswordHash|UserSessions|TwoFactorSecret|SELECT \* FROM Users)/i.test(q.query)));
});
