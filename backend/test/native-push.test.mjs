import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(40),JWT_REFRESH_SECRET:'b'.repeat(40)});
const {env}=await import('../dist/config/env.js');
const {nativePushReady,nativePayload,sendNativePush}=await import('../dist/services/nativePush.js');
test('native push requires configuration and preserves notification destinations',async()=>{
 env.FCM_SERVICE_ACCOUNT_FILE=undefined;env.APNS_KEY_FILE=undefined;
 assert.equal(nativePushReady('android'),false);assert.equal(nativePushReady('ios'),false);
 await assert.rejects(sendNativePush({to:'fcm:test-token'}),/not configured/);
 assert.equal(nativePayload({to:'fcm:test',data:{}}).data.destination,'/notifications');
});
test('Firebase delivery authenticates, sends native payloads and classifies retired tokens',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'cda-fcm-test-')),path=join(dir,'account.json');
 const {privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 writeFileSync(path,JSON.stringify({project_id:'test-project',client_email:'test@example.invalid',private_key:privateKey.export({format:'pem',type:'pkcs8'})}));env.FCM_SERVICE_ACCOUNT_FILE=path;
 const original=globalThis.fetch;let sends=0;
 globalThis.fetch=async(url,options)=>{if(String(url).includes('oauth2.googleapis.com')){assert.match(String(options.body),/assertion=/);return Response.json({access_token:'test-access',expires_in:3600})}assert.equal(options.headers.authorization,'Bearer test-access');const {message}=JSON.parse(options.body);assert.equal(message.token,'test-device');assert.equal(message.data.destination,'/notifications');assert.equal(message.android.notification.channel_id,'default');sends++;return sends===1?Response.json({name:'accepted'}):Response.json({error:{details:[{errorCode:'UNREGISTERED'}]}},{status:404})};
 try{assert.deepEqual(await sendNativePush({to:'fcm:test-device'}),{status:'ok'});assert.deepEqual(await sendNativePush({to:'fcm:test-device'}),{status:'error',details:{error:'DeviceNotRegistered'}})}finally{globalThis.fetch=original;env.FCM_SERVICE_ACCOUNT_FILE=undefined;rmSync(dir,{recursive:true,force:true})}
});
