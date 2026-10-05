import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import crypto from 'node:crypto';
import fs from 'node:fs';
import sql from 'mssql';
import webpush from 'web-push';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64),VAPID_PUBLIC_KEY:'public',VAPID_PRIVATE_KEY:'private'});
const {allowedPushEndpoint,pushSubscriptionSchema,sendWebPush}=await import('../dist/services/webPush.js');
const {sendPushBatch}=await import('../dist/services/notifications.js');
const id='a9b1c630-0be5-426c-b145-578eb4da9181';
let queries=[];
const row={Endpoint:'https://fcm.googleapis.com/fcm/send/test',P256dh:'a'.repeat(87),Auth:'b'.repeat(22)};
const fakePool={connected:true,request(){return {input(){return this},async query(q){queries.push(q);return{recordset:q.startsWith('SELECT')?[row]:[]}}}}};
test('push endpoint validation rejects arbitrary URLs and malformed keys',()=>{
 for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user:pass@fcm.googleapis.com/x','https://fcm.googleapis.com:444/x'])assert.equal(allowedPushEndpoint(endpoint),false);
 for(const endpoint of [row.Endpoint,'https://web.push.apple.com/x','https://updates.push.services.mozilla.com/x'])assert.equal(allowedPushEndpoint(endpoint),true);
 assert.equal(pushSubscriptionSchema.safeParse({endpoint:row.Endpoint,keys:{auth:'bad',p256dh:'bad'}}).success,false);
});
test('mixed browser/native batches preserve ticket order and hide account previews',async t=>{
 t.mock.method(sql.ConnectionPool.prototype,'connect',async()=>fakePool);
 t.mock.method(webpush,'sendNotification',async(sub,payload,options)=>{assert.equal(sub.endpoint,row.Endpoint);assert.ok(!payload.includes('Private message'));assert.equal(options.timeout,10000);return{statusCode:201}});
 t.mock.method(globalThis,'fetch',async(_url,options)=>{assert.deepEqual(JSON.parse(options.body).map(m=>m.to),['ExponentPushToken[test]']);return{ok:true,json:async()=>({data:[{status:'ok',id:'native-receipt'}]})}});
 const result=await sendPushBatch([{to:'webpush:'+id,body:'Private message'},{to:'ExponentPushToken[test]'}]);
 assert.deepEqual(result.tickets,[{status:'ok'},{status:'ok',id:'native-receipt'}]);
 assert.deepEqual((await sendPushBatch([])).tickets,[]);
});
test('expired subscriptions are removed; transient errors retry without exposing endpoints',async t=>{
 queries=[];
 t.mock.method(webpush,'sendNotification',async()=>{throw{statusCode:410}});
 assert.equal((await sendWebPush('webpush:'+id)).details.error,'DeviceNotRegistered');
 assert.ok(queries.some(q=>q.includes('DELETE FROM WebPushSubscriptions')));
 t.mock.method(webpush,'sendNotification',async()=>{throw Error(row.Endpoint)});
 await assert.rejects(sendWebPush('webpush:'+id),{message:'Web push delivery failed; retry required'});
});
test('service worker always displays a notification and opens a safe same-origin destination',async()=>{
 const listeners={};let shown,opened,closed=false,pending;
 const self={location:{origin:'https://cdaconnect.org'},addEventListener:(name,fn)=>listeners[name]=fn,registration:{showNotification:async(...args)=>{shown=args}},clients:{matchAll:async()=>[],openWindow:async url=>{opened=url}}};
 vm.runInNewContext(fs.readFileSync(new URL('../../frontend/public/sw.js',import.meta.url),'utf8'),{self,URL,crypto});
 listeners.push({data:{json:()=>({url:'https://evil.test'})},waitUntil:p=>pending=p});await pending;
 assert.equal(shown[0],'CDA Connect');
 listeners.notificationclick({notification:{data:{url:'https://evil.test'},close:()=>{closed=true}},waitUntil:p=>pending=p});await pending;
 assert.ok(closed);assert.equal(opened,'https://cdaconnect.org/notifications');
 for(const url of ['//evil.test','/\\evil.test','https://cdaconnect.org/post/x','javascript:alert(1)']){
 listeners.notificationclick({notification:{data:{url},close(){}},waitUntil:p=>pending=p});await pending;assert.equal(opened,'https://cdaconnect.org/notifications');}
 listeners.notificationclick({notification:{data:{url:'/post/123#comments'},close(){}},waitUntil:p=>pending=p});await pending;assert.equal(opened,'https://cdaconnect.org/post/123#comments');
 const first=shown[1].tag;listeners.push({data:{json:()=>({})},waitUntil:p=>pending=p});await pending;assert.notEqual(first,shown[1].tag);
});

test('web push reveals previews only after explicit opt-in',async t=>{
 t.mock.method(webpush,'sendNotification',async(_sub,payload)=>{assert.equal(JSON.parse(payload).body,'Allowed preview');return{statusCode:201}});
 row.Previews=1;try{assert.equal((await sendWebPush('webpush:'+id,{title:'New message',body:'Allowed preview'})).status,'ok')}finally{delete row.Previews}
});
