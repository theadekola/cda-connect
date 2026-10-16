import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import ts from 'typescript';
let count=0;
async function module(){
 let source=fs.readFileSync(new URL('../src/api.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('import.meta.env',"({VITE_API_URL:'https://api.example.test/api/v1',PROD:true})");
 source='const Capacitor={isNativePlatform:()=>false};const resolveAssetUrl=v=>v;\n'+source+'\n// fixture '+count++;
 globalThis.window={location:{origin:'https://example.test'}};globalThis.localStorage={removeItem(){}};globalThis.sessionStorage={removeItem(){}};
 return import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'));
}
const identity={accessToken:'old-fixture',user:{Id:'member',Email:'member@example.test'}};
test('network and provider failures while refreshing retain the signed-in session',async()=>{
 for(const status of [0,503]){const {api,session}=await module();session.set(identity);globalThis.fetch=async url=>{if(url.endsWith('/auth/refresh')){if(!status)throw TypeError('offline');return new Response('{}',{status})}return new Response('{}',{status:401})};await assert.rejects(api.get('/users/me'));assert.equal(session.get()?.user.Id,'member')}
});
test('confirmed refresh rejection ends the session',async()=>{const {api,session}=await module();session.set(identity);globalThis.fetch=async()=>new Response('{}',{status:401});await assert.rejects(api.get('/users/me'));assert.equal(session.get(),null)});
test('an old request cannot clear a newer signed-in account',async()=>{const {api,session}=await module();session.set(identity);globalThis.fetch=async url=>{if(url.endsWith('/auth/refresh')){session.set({accessToken:'new-fixture',user:{Id:'other',Email:'other@example.test'}});return new Response('{}',{status:401})}return new Response('{}',{status:401})};await assert.rejects(api.get('/users/me'));assert.equal(session.get()?.user.Id,'other')});
test('public share links remain on the website when API uses its own subdomain',async()=>{
 let source=fs.readFileSync(new URL('../src/api.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('import.meta.env',"({VITE_API_URL:'https://api.cdaconnect.org/api/v1',PROD:true})");source='const Capacitor={isNativePlatform:()=>false};const resolveAssetUrl=v=>v;\n'+source;
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {publicOrigin}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));assert.equal(publicOrigin(),'https://cdaconnect.org');
});
test('an old account request is never replayed under a newly signed-in account',async()=>{const {api,session}=await module();session.set(identity);let requests=0;globalThis.fetch=async()=>{requests++;session.set({accessToken:'new-fixture',user:{Id:'other',Email:'other@example.test'}});return new Response('{}',{status:401})};await assert.rejects(api.send('/example-action',{value:1}));assert.equal(requests,1);assert.equal(session.get()?.user.Id,'other')});
test('requests work without AbortSignal.timeout and keep caller cancellation',async()=>{const timeout=AbortSignal.timeout;Object.defineProperty(AbortSignal,'timeout',{configurable:true,writable:true,value:undefined});try{const {api}=await module();let received;globalThis.fetch=async(_url,options)=>{received=options.signal;return new Response('{}',{status:200})};const controller=new AbortController();controller.abort();await api.get('/example',controller.signal);assert.equal(received.aborted,true);await api.get('/example');assert.equal(received.aborted,false)}finally{AbortSignal.timeout=timeout}});
test('media uploads receive a longer bounded deadline than ordinary requests',async()=>{const {api}=await module(),original=globalThis.setTimeout;const deadlines=[];globalThis.setTimeout=(fn,ms,...args)=>{deadlines.push(ms);return original(fn,ms,...args)};globalThis.fetch=async()=>new Response('{}',{status:200});try{await api.send('/example');await api.upload('/media/upload',new FormData());assert.deepEqual(deadlines,[20000,120000])}finally{globalThis.setTimeout=original}});
