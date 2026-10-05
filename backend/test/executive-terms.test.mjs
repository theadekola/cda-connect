import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
test('expiry binds community scope and retains historical dates',async()=>{
 const source=await readFile(new URL('../src/services/executiveTerms.ts',import.meta.url),'utf8');
 const js=ts.transpile(source.replace(/^import[^\n]+\n/,'').replace('export async','async'),{target:ts.ScriptTarget.ES2022});
 const calls=[];const request={input(...args){calls.push(args);return this},async query(query){calls.push(query)}};
 const expire=new Function('getPool','sql',js+';return expireExecutiveTerms;')(async()=>({request:()=>request}),{UniqueIdentifier:'uuid'});
 await expire('community-id');assert.deepEqual(calls[0],['community','uuid','community-id']);assert.match(calls[1],/TenureEndDate<CAST\(SYSUTCDATETIME\(\) AS DATE\)/);assert.match(calls[1],/Status='ACTIVE'/);assert.match(calls[1],/@community IS NULL OR CommunityId=@community/);assert.doesNotMatch(calls[1],/DELETE|SET TenureEndDate/i);
 calls.length=0;await expire();assert.deepEqual(calls[0],['community','uuid',null]);
});
