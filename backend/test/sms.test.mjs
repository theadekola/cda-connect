import test from 'node:test';
import assert from 'node:assert/strict';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64),SMS_PROVIDER:'termii',TERMII_API_KEY:'test-key',TERMII_BASE_URL:'https://api.ng.termii.com/api/',TERMII_SENDER_ID:'CDAConnect'});
const {env}=await import('../dist/config/env.js');
const {sendVerificationSms}=await import('../dist/services/sms.js');
test('Termii sends a canonical international number and app OTP on the transactional route',async t=>{
 let count=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{count++;assert.equal(String(url),'https://api.ng.termii.com/api/sms/send');const body=JSON.parse(options.body);assert.equal(body.to,'447700900123');assert.equal(body.channel,'dnd');assert.equal(body.api_key,'test-key');assert.equal(body.from,'CDAConnect');assert.match(body.sms,/123456/);assert.equal(options.redirect,'error');assert.ok(options.signal);return new Response(JSON.stringify({code:'ok',message_id:'test-id'}))});
 await sendVerificationSms('+44 7700 900123','123456');assert.equal(count,1);
});
test('Termii rejects HTTP failures, provider errors and malformed responses without leaking them',async t=>{
 t.mock.method(console,'error',()=>{});
 for(const [status,body] of [[401,'secret-api-key'],[200,JSON.stringify({code:'failed',message:'secret-api-key'})],[200,'not json']]){
  const mock=t.mock.method(globalThis,'fetch',async()=>new Response(body,{status}));
  await assert.rejects(sendVerificationSms('+2348012345678','123456'),e=>e.status===502&&!e.message.includes('secret-api-key'));mock.mock.restore();
 }
});
test('Termii handles network failure without retrying the SMS',async t=>{
 let count=0;t.mock.method(console,'error',()=>{});t.mock.method(globalThis,'fetch',async()=>{count++;throw Error('secret')});
 await assert.rejects(sendVerificationSms('+2348012345678','123456'),e=>e.status===502);assert.equal(count,1);
});
test('Termii refuses missing credentials and unsafe endpoints before sending',async t=>{
 t.mock.method(globalThis,'fetch',()=>{throw Error('Should not send')});
 const saved=env.TERMII_BASE_URL,key=env.TERMII_API_KEY;
 try{for(const base of ['http://api.ng.termii.com','https://example.com','https://api.ng.termii.com?api_key=secret']){env.TERMII_BASE_URL=base;await assert.rejects(sendVerificationSms('+2348012345678','123456'),e=>e.status===503)}env.TERMII_BASE_URL=saved;env.TERMII_API_KEY='';await assert.rejects(sendVerificationSms('+2348012345678','123456'),e=>e.status===503)}finally{env.TERMII_BASE_URL=saved;env.TERMII_API_KEY=key}
});
