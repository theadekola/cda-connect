import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

test('web and native requests use the website backend, including the authenticated AI gateway',async()=>{
 globalThis.window={location:{origin:'https://cdaconnect.org'}};
 globalThis.localStorage={removeItem(){}};globalThis.sessionStorage={removeItem(){}};
 for(const native of [false,true]){
  let source=fs.readFileSync(new URL('../src/api.ts',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replaceAll('import.meta.env',"({VITE_API_URL:'/api/v1',PROD:true})");
  source=`const Capacitor={isNativePlatform:()=>${native}};const resolveAssetUrl=v=>v;\n`+source;
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const {api,socketOrigin}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
  for(const path of ['/auth/login','/auth/refresh','/communities','/communities/example/assistant/ask'])assert.equal(new URL(api.url(path),window.location.origin).href,'https://cdaconnect.org/api/v1'+path);
  assert.equal(socketOrigin(),'https://cdaconnect.org');
 }
});
