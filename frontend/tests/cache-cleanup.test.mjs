import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';import vm from 'node:vm';
test('clearing public cache preserves offline launch and never touches unrelated caches',async()=>{
 const entries=new Map([['https://example.test/offline.html',new Response('offline')],['https://example.test/obsolete',new Response('old')]]);const touched=[];
 const cache={keys:async()=>[...entries.keys()].map(url=>({url})),delete:async request=>entries.delete(request.url)};
 const source=fs.readFileSync(new URL('../src/storageLocal.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
 const context={exports:{},URL,window:{caches:{}},caches:{keys:async()=>['cda-v2-public-v1','unrelated'],open:async name=>{touched.push(name);return cache}}};vm.createContext(context);vm.runInContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);
 assert.equal(await context.exports.clearPublicCache(),1);assert.deepEqual(touched,['cda-v2-public-v1']);assert.equal(entries.size,1);assert.ok(entries.has('https://example.test/offline.html'));
});
test('offline navigation still returns a response if the cache was evicted by the OS',async()=>{
 const events={};const context={self:{addEventListener:(name,fn)=>events[name]=fn},fetch:async()=>{throw Error('offline')},caches:{match:async()=>undefined},Response};vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../public/sw.js',import.meta.url),'utf8'),context);
 let pending;events.fetch({request:{mode:'navigate',method:'GET'},respondWith:response=>pending=response});const response=await pending;assert.equal(response.status,200);assert.match(await response.text(),/You are offline/);
});
test('native cleanup removes only temporary account exports and coalesces concurrent cleanup',async()=>{
 const deleted=[];let reads=0;const source=fs.readFileSync(new URL('../src/storageLocal.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'');const context={exports:{},Capacitor:{isNativePlatform:()=>true},require:()=>({Directory:{Cache:'cache'},Filesystem:{readdir:async()=>{reads++;return{files:['cda-connect-my-data.json','cda-connect-my-data-part-0001.json','cda-media-photo.png','user-saved.json'].map(name=>({name}))}},deleteFile:async({path})=>deleted.push(path)}})};vm.createContext(context);vm.runInContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);await Promise.all([context.exports.clearTemporaryExports(),context.exports.clearTemporaryExports()]);assert.equal(reads,1);assert.deepEqual(deleted.sort(),['cda-connect-my-data-part-0001.json','cda-connect-my-data.json']);
});
