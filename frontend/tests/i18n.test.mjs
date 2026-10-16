import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText).toString('base64');
const packs=compile(fs.readFileSync(new URL('../src/interfaceTranslations.ts',import.meta.url),'utf8'));
const source=fs.readFileSync(new URL('../src/i18n.ts',import.meta.url),'utf8').replace("import {useSyncExternalStore} from 'react';",'const useSyncExternalStore=()=>{};').replace("'./interfaceTranslations'",JSON.stringify(packs));
const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};globalThis.document={documentElement:{}};
const {applyLanguage,getLocale,interfaceText}=await import(compile(source));
test('all core packs switch immediately, persist and use the correct reading direction',()=>{
 for(const [code,home] of [['fr','Accueil'],['es','Inicio'],['ar','الرئيسية'],['ha','Gida'],['yo','Ilé'],['ig','Ụlọ'],['pt','Início'],['de','Startseite'],['en-US','Home'],['en-GB','Home']]){applyLanguage(code);assert.equal(getLocale(),code);assert.equal(interfaceText('Home'),home);assert.equal(document.documentElement.dir,code==='ar'?'rtl':'ltr');assert.equal(saved.get('cda-interface-language'),code)}
});
test('unknown locales do not corrupt the current language and specialist text is retained',()=>{applyLanguage('fr');applyLanguage('invalid');assert.equal(getLocale(),'fr');assert.equal(interfaceText('  Home  '),'  Accueil  ');assert.equal(interfaceText('Uncatalogued specialist label'),'Uncatalogued specialist label')});
test('request IDs fall back to secure random bytes on older WebViews',async()=>{const {newRequestId}=await import(compile(fs.readFileSync(new URL('../src/requestId.ts',import.meta.url),'utf8')));const original=globalThis.crypto;Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:array=>original.getRandomValues(array)}});try{const ids=new Set(Array.from({length:50},()=>newRequestId()));assert.equal(ids.size,50);for(const id of ids)assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)}finally{Object.defineProperty(globalThis,'crypto',{configurable:true,value:original})}});
