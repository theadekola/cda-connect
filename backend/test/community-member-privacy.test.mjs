import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sql from 'mssql';

Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {communitiesRouter}=await import('../dist/routes/communities.js');
const viewer='a9b1c630-0be5-426c-b145-578eb4da9181',community='bd6c205a-8085-4236-a5ac-d476f0b03cec';
let admin=false,queries=[];
const originalConnect=sql.ConnectionPool.prototype.connect,originalQuery=sql.Request.prototype.query;
sql.ConnectionPool.prototype.connect=async()=>({connected:true,config:{},request(){return new sql.Request()}});
sql.Request.prototype.query=async function(query){
 const params=Object.fromEntries(Object.entries(this.parameters).map(([key,value])=>[key,value.value]));queries.push({query,params});
 if(query.startsWith('SELECT TOP 1 Id FROM CommunityMembers'))return{recordset:[{Id:'membership'}]};
 if(query.startsWith('SELECT CASE WHEN EXISTS'))return{recordset:[{Allowed:admin?1:0}]};
 if(query.startsWith('SELECT cm.Id MembershipId'))return{recordset:[{MembershipId:'member',UserId:'target',FirstName:'Private',LastName:'Member',ProfileImage:null,Email:null,Phone:null}]};
 return{recordset:[]};
};
const route=communitiesRouter.stack.find(layer=>layer.route?.path==='/:id/members'&&layer.route.methods.get);
const app=express();app.use((req,_res,next)=>{req.user={id:viewer};next()});app.get('/:id/members',...route.route.stack.map(layer=>layer.handle));
app.use((error,_req,res,_next)=>res.status(error.status??500).json({error:error.message}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
after(()=>{sql.ConnectionPool.prototype.connect=originalConnect;sql.Request.prototype.query=originalQuery;server.closeAllConnections();server.close()});

test('community member list applies contact and profile-photo privacy before returning rows',async()=>{
 queries=[];admin=false;const response=await fetch(`http://127.0.0.1:${server.address().port}/${community}/members`);assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/private/);assert.match(response.headers.get('cache-control')||'',/no-store/);
 const rows=await response.json();assert.equal(rows[0].Email,null);assert.equal(rows[0].Phone,null);assert.equal(rows[0].ProfileImage,null);
 const listing=queries.find(item=>item.query.startsWith('SELECT cm.Id MembershipId'));assert.ok(listing);assert.equal(listing.params.viewer,viewer);assert.equal(listing.params.admin,false);assert.match(listing.query,/LEFT JOIN PrivacyPreferences pp/);assert.match(listing.query,/pp\.ShowProfilePhoto=0/);assert.match(listing.query,/COALESCE\(pp\.EmailVisibility,'ADMINS'\)='MEMBERS'/);assert.match(listing.query,/COALESCE\(pp\.PhoneVisibility,'ADMINS'\)='MEMBERS'/);assert.equal(listing.query.startsWith('SELECT cm.Id MembershipId,u.Id UserId,u.FirstName,u.LastName,u.Email'),false);
});

test('community administrator status is passed explicitly to the privacy projection',async()=>{
 queries=[];admin=true;assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/${community}/members`)).status,200);const listing=queries.find(item=>item.query.startsWith('SELECT cm.Id MembershipId'));assert.equal(listing.params.admin,true);
});
