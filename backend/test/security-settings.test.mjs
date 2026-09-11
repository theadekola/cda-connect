import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sql from 'mssql';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64),EMAIL_PROVIDER:'smtp',SMTP_USER:'support@example.com',SMTP_PASSWORD:'test'});
const {authRouter}=await import('../dist/routes/auth.js');
const {securitySettingsRouter}=await import('../dist/routes/securitySettings.js');
const {notifyNewLogin,securityFindings}=await import('../dist/services/securitySettings.js');
const viewer='a9b1c630-0be5-426c-b145-578eb4da9181';
let queries=[],user={Email:'member@example.com',EmailVerified:true,PhoneVerified:true,LoginAlerts:true,TwoFactorEnabled:true};
const pool={connected:true,request(){const params={};return{input(k,t,v){params[k]=v;return this},async query(query){queries.push({query,params});return{recordset:query.includes('FROM Users')?[user]:query.includes('FROM UserSessions')?[{Id:'session',CreatedAt:'2026-09-10T08:00:00Z'}]:[]}}}}};
const connect=sql.ConnectionPool.prototype.connect;sql.ConnectionPool.prototype.connect=async()=>pool;
const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:viewer};next()});app.use('/fullauth',authRouter);app.use(securitySettingsRouter);app.use((e,req,res,next)=>res.status(e.status??(e.name==='ZodError'?400:500)).json({error:e.message}));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
after(()=>{sql.ConnectionPool.prototype.connect=connect;server.closeAllConnections();server.close()});
const call=(path,body)=>fetch(base+path,{method:body?'PATCH':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
test('security status and retained login history are user-scoped and exclude secrets',async()=>{
 queries=[];let r=await call('/security-settings');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.deepEqual((await r.json()).findings,[]);
 r=await call('/login-activity');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.ok(queries.every(x=>x.params.uid===viewer));assert.ok(queries.every(x=>!/(PasswordHash|TwoFactorSecret|RefreshTokenHash)/.test(x.query)));
});
test('login-alert switch strictly validates and refuses unverified email before writes',async()=>{
 queries=[];assert.equal((await call('/security-settings',{loginAlerts:'true'})).status,400);assert.equal((await call('/security-settings',{loginAlerts:true,UserId:'other'})).status,400);assert.equal(queries.length,0);
 user.EmailVerified=false;assert.equal((await call('/security-settings',{loginAlerts:true})).status,400);assert.ok(!queries.some(x=>x.query.startsWith('UPDATE')));
 assert.equal((await call('/security-settings',{loginAlerts:false})).status,200);assert.equal(queries.at(-1).params.uid,viewer);assert.equal(queries.at(-1).params.enabled,false);user.EmailVerified=true;
});
test('login-alert opt-out and unverified email suppress provider calls',async()=>{
 let calls=0;const send=async()=>{calls++;return{skipped:false}};
 user.LoginAlerts=false;await notifyNewLogin(pool,viewer,send);user.LoginAlerts=true;user.EmailVerified=false;await notifyNewLogin(pool,viewer,send);user.EmailVerified=true;assert.equal(calls,0);
});
test('completed-login alert records provider acceptance and failures without exposing secrets',async()=>{
 queries=[];await notifyNewLogin(pool,viewer,async messages=>{assert.equal(messages[0].to,user.Email);assert.match(messages[0].text,/Settings > Security/);assert.ok(!messages[0].text.includes('refreshToken'));return{skipped:false}});assert.equal(queries.at(-1).params.status,'ACCEPTED');
 await notifyNewLogin(pool,viewer,async()=>{throw Error('provider failed')});assert.equal(queries.at(-1).params.status,'FAILED');
 await notifyNewLogin(pool,viewer,async()=>({skipped:true}));assert.equal(queries.at(-1).params.status,'FAILED');
});
test('security check reports missing protection and failed delivery without claiming password strength',()=>{
 const findings=securityFindings({});assert.equal(findings.length,4);assert.ok(findings.every(x=>!x.includes('strong')));assert.ok(securityFindings({...user,LastLoginAlertStatus:'FAILED'}).some(x=>x.includes('last login alert')));
});

test('production security routes reject unauthenticated requests before database access',async()=>{queries=[];assert.equal((await call('/fullauth/security-settings')).status,401);assert.equal((await call('/fullauth/login-activity')).status,401);assert.equal((await call('/fullauth/security-settings',{loginAlerts:true})).status,401);assert.equal(queries.length,0)});
