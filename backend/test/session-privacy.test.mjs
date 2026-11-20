import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import sql from 'mssql';

const origin='https://app.example.test';
Object.assign(process.env,{
 NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',
 JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64),CORS_ORIGIN:origin
});
const {authRouter}=await import('../dist/routes/auth.js');
const {usersRouter}=await import('../dist/routes/users.js');
const {protectCookieMutation}=await import('../dist/services/sessionCookies.js');
const {verifyAccess,verifySocketTicket}=await import('../dist/utils/auth.js');
const member={
 Id:'11111111-1111-4111-8111-111111111111',FirstName:'Jordan',LastName:'Example',
 Email:'member@example.test',Phone:'+441234000000',Address:'Test address',Postcode:'TE1 1ST',
 DateOfBirth:'2000-01-01',ProfileImage:null,IsSuperAdmin:false,IsProtectedAccount:false,
 AccountStatus:'ACTIVE',PasswordHash:await bcrypt.hash('test password',4)
};
const savedConnect=sql.ConnectionPool.prototype.connect;
sql.ConnectionPool.prototype.connect=async()=>({
 connected:true,
 request(){
  return {
   input(){return this},
   async query(statement){
    if(statement.includes('WHERE Email=@email'))return {recordset:[{...member}]};
    if(statement.includes('SecurityHoldUntil,Email FROM Users'))return {recordset:[{Id:member.Id}]};
    if(statement.includes('FROM Users WHERE Id=@id')){
     const columns=statement.match(/SELECT (.+) FROM Users WHERE Id=@id/)[1].split(',');
     return {recordset:[Object.fromEntries(columns.map(column=>[column,member[column]??null]))]};
    }
    if(statement.includes('LEFT JOIN AccountSettings a'))return {recordset:[{Email:member.Email,Phone:member.Phone,Address:member.Address,DateOfBirth:member.DateOfBirth}]};
    return {recordset:[]};
   }
  };
 }
});
const app=express();
app.use(express.json());
app.use('/api/v1',protectCookieMutation);
app.use('/api/v1/auth',authRouter);
app.use('/api/v1/users',usersRouter);
app.use((error,_req,res,_next)=>res.status(error.status??500).json({error:error.message}));
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const base='http://127.0.0.1:'+server.address().port+'/api/v1';
after(()=>{
 sql.ConnectionPool.prototype.connect=savedConnect;
 server.closeAllConnections();
 server.close();
});

const login=(requestOrigin,client)=>fetch(base+'/auth/login',{
 method:'POST',headers:{origin:requestOrigin,'x-cda-client':client,'content-type':'application/json'},
 body:JSON.stringify({email:member.Email,password:'test password'})
});
test('browser login uses HttpOnly cookies even for an old web client header',async()=>{
 const response=await login(origin,'app');
 assert.equal(response.status,200);
 assert.equal(response.headers.get('cache-control'),'no-store');
 const body=await response.json();
 assert.deepEqual(Object.keys(body).sort(),['sessionExpiresAt','user']);
 assert.deepEqual(Object.keys(body.user).sort(),['FirstName','Id','IsProtectedAccount','IsSuperAdmin','LastName','ProfileImage']);
 const cookies=response.headers.getSetCookie();
 for(const name of ['cda-access','cda-refresh']){
  const cookie=cookies.find(value=>value.startsWith(name+'='));
  assert.match(cookie,/HttpOnly/i);
  assert.match(cookie,/SameSite=Strict/i);
 }
 const cookie=cookies.map(value=>value.split(';')[0]).join('; ');
 const profile=await fetch(base+'/users/me',{headers:{cookie}});
 assert.equal(profile.status,200);
 assert.equal(profile.headers.get('cache-control'),'no-store');
 assert.deepEqual(Object.keys(await profile.json()).sort(),['Country','CoverImage','CreatedAt','FirstName','Id','LGA','LastName','ProfileImage','State']);
 const account=await fetch(base+'/users/account',{headers:{cookie}});
 assert.equal(account.status,200);
 assert.equal(account.headers.get('cache-control'),'no-store');
 assert.equal((await account.json()).Phone,member.Phone);
 const ticketResponse=await fetch(base+'/auth/socket-ticket',{headers:{cookie}});
 const {ticket}=await ticketResponse.json();
 assert.equal(verifySocketTicket(ticket).id,member.Id);
 assert.throws(()=>verifyAccess(ticket));
 assert.equal((await fetch(base+'/users/me',{headers:{authorization:'Bearer '+ticket}})).status,401);
 assert.equal((await fetch(base+'/users/me',{method:'PATCH',headers:{cookie,origin:'https://other.example.test'}})).status,403);
 const logout=await fetch(base+'/auth/logout',{method:'POST',headers:{cookie,origin}});
 assert.equal(logout.status,204);
 assert.equal(logout.headers.getSetCookie().filter(value=>/^cda-(access|refresh)=;/.test(value)).length,2);
});
test('native sign-in retains bearer support and returns the same filtered user',async()=>{
 const response=await login('capacitor://localhost','app');
 assert.equal(response.status,200);
 const {accessToken,user}=await response.json();
 assert.equal(user.Email,undefined);
 assert.equal(user.Phone,undefined);
 assert.equal(verifyAccess(accessToken).id,member.Id);
 assert.equal(jwt.decode(accessToken).email,undefined);
 const profile=await fetch(base+'/users/me',{headers:{authorization:'Bearer '+accessToken}});
 assert.equal(profile.status,200);
});
