import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/chatViewport.ts',import.meta.url),'utf8');
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {chatViewportBounds}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
test('iOS keyboard panning keeps the entire chat within the visible viewport',()=>{
 assert.deepEqual(chatViewportBounds({height:460,offsetTop:180,scale:1},844),{height:460,top:180,keyboard:true});
});
test('keyboard dismissal discards stale iOS offsets and restores the bottom safe area',()=>{
 assert.deepEqual(chatViewportBounds({height:844,offsetTop:180,scale:1},844),{height:844,top:0,keyboard:false});
});
test('browser toolbar changes do not count as a keyboard, and pinch zoom retains normal panning',()=>{
 assert.deepEqual(chatViewportBounds({height:790,offsetTop:0,scale:1},844),{height:790,top:0,keyboard:false});
 assert.deepEqual(chatViewportBounds({height:400,offsetTop:240,scale:2},844),{height:844,top:0,keyboard:false});
});
test('missing and transient invalid viewport dimensions fall back to the layout viewport',()=>{
 assert.deepEqual(chatViewportBounds(null,844),{height:844,top:0,keyboard:false});
 assert.deepEqual(chatViewportBounds({height:0,offsetTop:100,scale:1},844),{height:844,top:0,keyboard:false});
});
