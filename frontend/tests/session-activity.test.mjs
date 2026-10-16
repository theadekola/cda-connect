import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/sessionActivity.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {sessionIdle,IDLE_TIMEOUT_MS}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
test('idle sessions expire exactly at thirty minutes, including time in background',()=>{
 assert.equal(IDLE_TIMEOUT_MS,1800000);
 assert.equal(sessionIdle(1000,1800999),false);
 assert.equal(sessionIdle(1000,1801000),true);
 assert.equal(sessionIdle(1000,7201000),true);
});
test('background expiry signs out before new input can extend the session',async()=>{
 const {watchSessionActivity}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
 const events=new Map();let saved=String(Date.now()-IDLE_TIMEOUT_MS-1),expired=0;
 globalThis.localStorage={getItem:()=>saved,setItem:(_key,value)=>{saved=value}};
 globalThis.window={addEventListener:(event,fn)=>events.set(event,fn),removeEventListener:event=>events.delete(event),setInterval:()=>0};
 globalThis.document={addEventListener:(event,fn)=>events.set(event,fn),removeEventListener:event=>events.delete(event)};
 const original=saved,dispose=watchSessionActivity(()=>expired++);
 events.get('pointerdown')();assert.equal(expired,1);assert.equal(saved,original);
 dispose();assert.equal(events.size,0);
});
test('maximum session expiry requires credentials even with recent activity',async()=>{
 const {watchSessionActivity}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
 globalThis.localStorage={getItem:()=>String(Date.now()),setItem:()=>{}};let expired=0;
 const dispose=watchSessionActivity(()=>expired++,new Date(Date.now()-1000).toISOString());assert.equal(expired,1);dispose();
});
