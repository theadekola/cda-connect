import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sql from 'mssql';

Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {requireActiveCommunityMutation}=await import('../dist/middleware/communityPlatformStatus.js');
const id='bd6c205a-8085-4236-a5ac-d476f0b03cec';
let status='SUSPENDED',queries=[];
const pool={connected:true,config:{},request(){return new sql.Request()}};
const originals={connect:sql.ConnectionPool.prototype.connect,query:sql.Request.prototype.query};
sql.ConnectionPool.prototype.connect=async()=>pool;
sql.Request.prototype.query=async function(query){queries.push(query);return{recordset:[{PlatformStatus:status}]}};

const app=express();app.use(express.json());app.use(requireActiveCommunityMutation);app.all('*path',(req,res)=>res.json({ok:true}));
const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
after(()=>{sql.ConnectionPool.prototype.connect=originals.connect;sql.Request.prototype.query=originals.query;server.closeAllConnections();server.close()});
const request=(path,method='POST',body)=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});

test('blocks direct and body-supplied community mutations when the community is suspended',async()=>{
 for(const args of [[`/communities/${id}/feed`,'POST'],['/media/upload','POST',{communityId:id}]]){const response=await request(...args);assert.equal(response.status,423);assert.equal((await response.json()).code,'COMMUNITY_PLATFORM_RESTRICTED')}
});

test('resolves every alternate community-owned mutation route before allowing it',async()=>{
 const paths=[`/governance/proposals/${id}/discussion`,`/governance/actions/${id}`,`/formal-ballots/${id}/vote`,`/documents/${id}/versions`,`/moderation-queue/${id}/review`,`/conversations/${id}/read`,`/meetings/${id}/rsvp`,`/polls/${id}/vote`,`/posts/${id}/reaction`,`/comments/${id}/reaction`,`/alerts/${id}/respond`,`/services/${id}/reviews`,`/marketplace/${id}/save`,`/opportunities/${id}/save`,`/events/${id}/rsvp`,`/verification/${id}/review`,`/media/uploads/${id}`,`/content/announcement/${id}/transform`,`/media/upload?purpose=chat&conversationId=${id}`,`/users/community-preferences/managed/${id}`];
 for(const path of paths){queries=[];const response=await request(path,path.startsWith('/media/uploads/')?'DELETE':'POST');assert.equal(response.status,423,path);assert.ok(queries.some(query=>query.includes('Communities')),path)}
});

test('allows active community mutations and non-mutating reads',async()=>{
 status='ACTIVE';assert.equal((await request(`/polls/${id}/vote`)).status,200);status='SUSPENDED';queries=[];assert.equal((await request(`/communities/${id}`,'GET')).status,200);assert.equal(queries.length,0);
});

test('keeps emergency and SOS operations available',async()=>{
 queries=[];assert.equal((await request(`/communities/${id}/emergency-contacts`)).status,200);assert.equal((await request(`/communities/${id}/sos`)).status,200);assert.equal(queries.length,0);
});
