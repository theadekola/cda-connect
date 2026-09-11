import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../src/storagePolicy.ts',import.meta.url),'utf8');const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;const {storageDefaults,canLoadMedia,canRefresh}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
test('Wi-Fi-only automatic media refuses cellular and unknown networks',()=>{for(const network of ['cellular','unknown','none'])assert.equal(canLoadMedia(storageDefaults,'photos',network),false);assert.equal(canLoadMedia(storageDefaults,'photos','wifi'),true);assert.equal(canLoadMedia(storageDefaults,'documents','ethernet'),true)});
test('data saver pauses every automatic media type, regardless of its media policy',()=>{for(const kind of ['photos','videos','documents','audio'])assert.equal(canLoadMedia({...storageDefaults,dataSaver:true,[kind]:'ALWAYS'},kind,'wifi'),false)});
test('never and always media policies override network type correctly',()=>{assert.equal(canLoadMedia(storageDefaults,'videos','wifi'),false);assert.equal(canLoadMedia(storageDefaults,'audio','cellular'),true);assert.equal(canLoadMedia({...storageDefaults,photos:'ALWAYS'},'photos','unknown'),true)});
test('mobile sync opt-out pauses polling on cellular and unknown connections',()=>{for(const connection of ['cellular','unknown'])assert.equal(canRefresh({...storageDefaults,syncMobile:false},connection),false);assert.equal(canRefresh({...storageDefaults,syncMobile:false},'wifi'),true);assert.equal(canRefresh(storageDefaults,'unknown'),true)});
