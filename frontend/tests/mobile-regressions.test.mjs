import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=name=>readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
async function compile(source){const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;return import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))}
const {safeReturnPath,nativeLinkPath}=await compile(read('navigation.ts'));
test('shared destinations retain query strings and membership-card fragments across sign-in',()=>{
 for(const path of ['/post/123#comments','/chat/123?incoming=video','/community/123/membership-card#member=abc','/invite/ABCDEF'])assert.equal(safeReturnPath(path),path);
 for(const path of ['https://evil.invalid/post/1','//evil.invalid','/\\evil.invalid','/%2f%2fevil.invalid','/post/../login','/post/%2e%2e/login','/login','/super-admin','/post/1\n'])assert.equal(safeReturnPath(path),'');
});
test('native links accept only the owned HTTPS domain or the app scheme',()=>{
 assert.equal(nativeLinkPath('https://cdaconnect.org/post/123#comments'),'/post/123#comments');
 assert.equal(nativeLinkPath('org.cdaconnect.app://open/invite/ABCDEF'),'/invite/ABCDEF');
 for(const url of ['https://cdaconnect.org.evil.invalid/post/1','https://user@cdaconnect.org/post/1','http://cdaconnect.org/post/1','https://cdaconnect.org:444/post/1','javascript:alert(1)'])assert.equal(nativeLinkPath(url),'');
});
test('native token rotation updates the current account and stops after disconnect',async()=>{
 const listeners=new Map(),requests=[],values=new Map();let token='first-token';
 globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const emit=value=>{for(const listener of listeners.get('registration')||[])listener({value})};
 globalThis.__cdaPushTest={Capacitor:{getPlatform:()=> 'android'},session:{get:()=>({user:{Id:'member'}})},NativeDevice:{pushConfiguration:async()=>({configured:true})},api:{get:async()=>({android:true,ios:true}),send:async(path,body,method='POST')=>{requests.push({path,body,method})}},PushNotifications:{checkPermissions:async()=>({receive:'granted'}),createChannel:async()=>{},addListener:async(name,callback)=>{if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(callback);return{remove:async()=>listeners.get(name).delete(callback)}},register:async()=>emit(token),unregister:async()=>{},removeAllDeliveredNotifications:async()=>{}}};
 const source=read('nativePush.tsx').replace(/^import .*;\n/gm,'');
 const module=await compile('const {Capacitor,session,NativeDevice,api,PushNotifications}=globalThis.__cdaPushTest;\n'+source);
 try{
  await module.enableNativePush();assert.equal(listeners.get('registration').size,1);
  emit('rotated-token');await new Promise(setImmediate);
  assert.equal(JSON.parse(values.get('cda-native-push')).token,'fcm:rotated-token');
  assert.ok(requests.some(request=>request.method==='DELETE'&&request.body.deviceToken==='fcm:first-token'));
  await module.disconnectNativePush();const count=requests.length;emit('late-token');await new Promise(setImmediate);assert.equal(requests.length,count);assert.equal(values.has('cda-native-push'),false);
 }finally{delete globalThis.__cdaPushTest;delete globalThis.localStorage}
});
test('socket credential rotation renews the existing connection without disconnecting',async()=>{
 const listeners=new Set(),events=[],handlers=new Map();let current={accessToken:'fixture-one',user:{Id:'member'}},disconnects=0;
 const socket={connected:true,on:(name,callback)=>handlers.set(name,callback),off:()=>{},timeout(){return this},emit(name,payload,ack){events.push({name,payload});ack(null,{ok:true})},disconnect(){disconnects++}};
 globalThis.document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
 globalThis.__cdaSocketTest={io:()=>socket,socketOrigin:()=> 'https://example.test',refreshSession:async()=>{},session:{get:()=>current,subscribe:callback=>{listeners.add(callback);return()=>listeners.delete(callback)}}};
 const source=read('socketSession.ts').replace(/^import .*;\n/gm,'');
 const {authenticatedSocket}=await compile('const {io,socketOrigin,refreshSession,session}=globalThis.__cdaSocketTest;\n'+source);
 const connection=authenticatedSocket();
 try{current={...current,accessToken:'fixture-two'};for(const callback of listeners)callback();await new Promise(setImmediate);assert.equal(connection.socket,socket);assert.equal(disconnects,0);assert.ok(events.some(event=>event.name==='session:refresh'&&event.payload.token==='fixture-two'))}finally{connection.dispose();delete globalThis.document;delete globalThis.__cdaSocketTest}
 assert.equal(disconnects,1);assert.equal(listeners.size,0);
});
