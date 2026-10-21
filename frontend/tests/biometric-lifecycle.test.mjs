import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
let sequence=0;
async function fixture({deferAvailability=false}={}){
 let current={user:{Id:'member'}},complete,reject,calls=0,finishAvailability;
 const availability={isAvailable:true,deviceIsSecure:true};
 const values=new Map([['cda-biometric-unlock','true']]);
 globalThis.localStorage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
 globalThis.__bioFixture={Capacitor:{isNativePlatform:()=>true},BiometryType:{},session:{get:()=>current},BiometricAuth:{checkBiometry:()=>deferAvailability?new Promise(resolve=>{finishAvailability=()=>resolve(availability)}):Promise.resolve(availability),authenticate:()=>{calls++;return new Promise((resolve,fail)=>{complete=resolve;reject=fail})}}};
 const source=readFileSync(new URL('../src/sessionSecurity.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const js=ts.transpileModule('const {Capacitor,BiometricAuth,BiometryType,session}=globalThis.__bioFixture;\n'+source+'\n// fixture '+sequence++,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const module=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 return{...module,available:()=>finishAvailability(),complete:()=>complete(),reject:()=>reject(Error('User cancelled')),calls:()=>calls,account:value=>{current=value}};
}
const tick=()=>new Promise(setImmediate);
test('a biometric result cannot override a newer explicit lock',async()=>{const f=await fixture(),pending=f.authenticateBiometric();await tick();f.biometricLock.lock();f.complete();await assert.rejects(pending);assert.equal(f.biometricLock.get(),true)});
test('a biometric result cannot unlock a different account',async()=>{const f=await fixture(),pending=f.authenticateBiometric();await tick();f.account({user:{Id:'other'}});f.complete();await assert.rejects(pending);assert.equal(f.biometricLock.get(),true)});
test('an expired session cannot be unlocked using a pending biometric result',async()=>{const f=await fixture(),pending=f.authenticateBiometric();await tick();f.account({user:{Id:'member'},sessionExpiresAt:new Date(Date.now()-1000).toISOString()});f.complete();await assert.rejects(pending);assert.equal(f.biometricLock.get(),true)});
test('verification completed in the background stays covered until the account resumes',async()=>{const f=await fixture(),pending=f.authenticateBiometric();await tick();f.biometricLock.setForeground(false);f.complete();await pending;assert.equal(f.biometricLock.get(),true);f.biometricLock.setForeground(true);assert.equal(f.biometricLock.get(),false)});
test('account changes invalidate a verification pending foreground resume',async()=>{const f=await fixture(),pending=f.authenticateBiometric();await tick();f.biometricLock.setForeground(false);f.complete();await pending;f.account({user:{Id:'other'}});f.biometricLock.setForeground(true);assert.equal(f.biometricLock.get(),true)});
test('an old background verification is not reused after a long suspension',async()=>{const original=Date.now;let now=original();Date.now=()=>now;try{const f=await fixture(),pending=f.authenticateBiometric();await tick();f.biometricLock.setForeground(false);f.complete();await pending;now+=30001;f.biometricLock.setForeground(true);assert.equal(f.biometricLock.get(),true)}finally{Date.now=original}});
test('concurrent callers share a prompt and cancellation allows another attempt',async()=>{const f=await fixture(),first=f.authenticateBiometric(),second=f.authenticateBiometric();assert.equal(first,second);await tick();assert.equal(f.calls(),1);f.reject();await assert.rejects(first,/cancel/);assert.equal(f.biometricLock.get(),true);const next=f.authenticateBiometric();await tick();assert.equal(f.calls(),2);f.complete();await next;assert.equal(f.biometricLock.get(),false)});
test('credential sign-in invalidates an old prompt even for the same account',async()=>{const f=await fixture(),pending=f.authenticateBiometric();await tick();f.biometricLock.unlock();f.biometricLock.lock();f.complete();await assert.rejects(pending);assert.equal(f.biometricLock.get(),true)});
test('a lock during availability lookup prevents opening an obsolete native prompt',async()=>{const f=await fixture({deferAvailability:true}),pending=f.authenticateBiometric();await tick();f.biometricLock.lock();f.available();await assert.rejects(pending);assert.equal(f.calls(),0);assert.equal(f.biometricLock.get(),true)});
test('backgrounding during availability lookup prevents opening a native prompt',async()=>{const f=await fixture({deferAvailability:true}),pending=f.authenticateBiometric();await tick();f.biometricLock.setForeground(false);f.available();await assert.rejects(pending);assert.equal(f.calls(),0);assert.equal(f.biometricLock.get(),true)});
