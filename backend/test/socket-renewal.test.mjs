import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {io as client} from 'socket.io-client';
import {Server} from 'socket.io';
import jwt from 'jsonwebtoken';
import sql from 'mssql';
import {Redis} from 'ioredis';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
let active=true;const originalConnect=sql.ConnectionPool.prototype.connect,originalQuery=sql.Request.prototype.query,originalRedis={};
sql.ConnectionPool.prototype.connect=async()=>({connected:true,request:()=>new sql.Request()});
sql.Request.prototype.query=async text=>({recordset:text.startsWith('SELECT CommunityId FROM CommunityMembers')?[]:active?[{Id:'member'}]:[]});
for(const name of ['connect','sadd','srem','expire','set','scard','info','hset','client']){originalRedis[name]=Redis.prototype[name];Redis.prototype[name]=async function(){if(name==='connect'){this.status='ready';this.emit('ready')}return name==='info'?'redis_version:7.0.0\r\nmaxmemory_policy:noeviction':name==='scard'?0:1}}
const {configureSocket}=await import('../dist/socket.js');
const queues=await import('../dist/queues/index.js');
const {getRedis}=await import('../dist/config/redis.js');
const http=createServer(),io=new Server(http);configureSocket(io);await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
const token=(seconds,sessionId='family',id='member')=>jwt.sign({id,email:'member@example.test',sessionId,purpose:'access'},process.env.JWT_ACCESS_SECRET,{expiresIn:seconds});
async function open(access){const socket=client('http://127.0.0.1:'+http.address().port,{auth:{token:access},transports:['websocket'],reconnection:false});await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject)});return socket}
after(async()=>{await new Promise(resolve=>io.close(resolve));await Promise.all([queues.emergencyQueue.disconnect(),queues.notificationQueue.disconnect(),queues.backgroundQueue.disconnect()]);getRedis().disconnect();Object.assign(Redis.prototype,originalRedis);sql.ConnectionPool.prototype.connect=originalConnect;sql.Request.prototype.query=originalQuery});
test('credential renewal preserves socket identity and call rooms beyond the old token expiry',async()=>{
 const socket=await open(token(2));try{const id=socket.id,server=io.sockets.sockets.get(id);await server.join('call:existing');
  const response=await socket.timeout(1000).emitWithAck('session:refresh',{token:token(20)});assert.equal(response.ok,true);
  await new Promise(resolve=>setTimeout(resolve,2200));assert.equal(socket.connected,true);assert.equal(socket.id,id);assert.equal(server.rooms.has('call:existing'),true);
 }finally{socket.disconnect()}
});
test('renewal rejects another session family and revoked sessions',async()=>{
 for(const mismatch of ['family','revoked']){active=true;const socket=await open(token(20));const disconnected=new Promise(resolve=>socket.once('disconnect',resolve));if(mismatch==='revoked')active=false;
  socket.emit('session:refresh',{token:token(20,mismatch==='family'?'other-family':'family')});await disconnected;assert.equal(socket.connected,false);socket.disconnect();active=true;
 }
});
