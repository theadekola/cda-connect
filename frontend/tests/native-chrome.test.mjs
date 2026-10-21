import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
test('native chrome uses light icons on authenticated headers and dark icons on public pages, in navigation order',async()=>{
 const calls=[];
 globalThis.__chromeTest={Capacitor:{isNativePlatform:()=>true},SystemBars:{setStyle:async options=>{calls.push(options)}},SystemBarsStyle:{Dark:'DARK',Light:'LIGHT'},SystemBarType:{StatusBar:'StatusBar',NavigationBar:'NavigationBar'}};
 const source=readFileSync(new URL('../src/nativeChrome.ts',import.meta.url),'utf8').replace(/^import .*;\n/,'const {Capacitor,SystemBars,SystemBarsStyle,SystemBarType}=globalThis.__chromeTest;\n');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const {updateNativeChrome}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 try{
  updateNativeChrome(true);updateNativeChrome(false);await new Promise(setImmediate);
  assert.deepEqual(calls,[{bar:'StatusBar',style:'DARK'},{bar:'NavigationBar',style:'LIGHT'},{bar:'StatusBar',style:'LIGHT'},{bar:'NavigationBar',style:'LIGHT'}]);
  globalThis.__chromeTest.Capacitor.isNativePlatform=()=>false;updateNativeChrome(true);await new Promise(setImmediate);assert.equal(calls.length,4);
 }finally{delete globalThis.__chromeTest}
});
