import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64),EMAIL_PROVIDER:'smtp',SMTP_USER:'support@cdaconnect.org',SMTP_PASSWORD:'test-password'});
const {env}=await import('../dist/config/env.js');
const {verifyRegistrationIdentity}=await import('../dist/utils/registration.js');
const {sendEmailBatch}=await import('../dist/services/notifications.js');
const email='person@example.com';
const sign=claims=>jwt.sign(claims,env.JWT_ACCESS_SECRET,{expiresIn:'15m'});
test('email signup marks only email verified and does not require a phone',()=>{
 assert.deepEqual(verifyRegistrationIdentity({verificationMethod:'email',email,emailVerificationToken:sign({purpose:'email-verification',email})}),{emailVerified:true,phoneVerified:false});
});
test('registration rejects a different address, wrong purpose, missing and expired proofs',()=>{
 for(const token of [undefined,sign({purpose:'email-verification',email:'another@example.com'}),sign({purpose:'phone-verification',email}),sign({purpose:'access',email}),jwt.sign({purpose:'email-verification',email},env.JWT_ACCESS_SECRET,{expiresIn:-1})])assert.throws(()=>verifyRegistrationIdentity({verificationMethod:'email',email,emailVerificationToken:token}));
});
test('phone verification proof cannot be used to register an account',()=>{
 const phone='+2348012345678',token=sign({purpose:'phone-verification',phone});
 assert.throws(()=>verifyRegistrationIdentity({verificationMethod:'sms',email,phone,phoneVerificationToken:token}));
});
test('Namecheap SMTP uses encryption, server credentials and the configured sender',async t=>{
 let closed=false;
 t.mock.method(nodemailer,'createTransport',options=>{assert.equal(options.host,'mail.privateemail.com');assert.equal(options.port,465);assert.equal(options.secure,true);assert.equal(options.requireTLS,true);return{sendMail:async mail=>{assert.equal(mail.from.address,'support@cdaconnect.org');assert.equal(mail.to,email);assert.equal(mail.disableFileAccess,true);return{accepted:[email],rejected:[]}},close:()=>{closed=true}}});
 assert.deepEqual(await sendEmailBatch([{to:email,subject:'Code',text:'123456'}]),{skipped:false,count:1});assert.ok(closed);
});
test('SMTP rejection is reported without exposing mailbox credentials',async t=>{
 t.mock.method(nodemailer,'createTransport',()=>({sendMail:async()=>{throw Error('test-password')},close:()=>{}}));
 await assert.rejects(sendEmailBatch([{to:email,subject:'Code',text:'123456'}]),e=>e.status===502&&!e.message.includes('test-password'));
});
