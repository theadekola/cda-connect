import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../public/google-tag.js',import.meta.url),'utf8');
const property='G-HT1Y2WF4S7';
function browser(consent=null,{storageUnavailable=false}={}){
 const initial={event:'existing'},scripts=[],cookieWrites=[],listeners=new Map();
 const window={dataLayer:[initial],addEventListener(type,listener){listeners.set(type,listener)}};
 const document={
  querySelector(){return scripts[0]||null},
  querySelectorAll(){return [...scripts]},
  createElement(){const script={dataset:{},remove(){const index=scripts.indexOf(script);if(index>=0)scripts.splice(index,1)}};return script},
  head:{append(script){scripts.push(script)}},
  get cookie(){return '_ga=sample; _ga_TEST=sample; session=keep'},
  set cookie(value){cookieWrites.push(value)}
 };
 const localStorage={getItem(key){assert.equal(key,'cda-analytics-consent');if(storageUnavailable)throw Error('Storage unavailable');return consent}};
 runInNewContext(source,{window,document,localStorage,location:{hostname:'app.example.test'},Date});
 return {window,initial,scripts,cookieWrites,choose(value){consent=value;listeners.get('cda-analytics-consent')()}};
}

test('analytics stays disabled without explicit consent, including unavailable storage',()=>{
 for(const consent of [null,'denied','invalid']){
  const b=browser(consent);assert.equal(b.scripts.length,0);assert.equal(b.window['ga-disable-'+property],true);assert.deepEqual(b.window.dataLayer,[b.initial]);
 }
 const b=browser(null,{storageUnavailable:true});assert.equal(b.scripts.length,0);assert.equal(b.window['ga-disable-'+property],true);
});

test('consented analytics preserves the queue and configures the property only once',()=>{
 const b=browser('granted');assert.equal(b.window.dataLayer[0],b.initial);assert.equal(b.scripts.length,1);assert.equal(b.scripts[0].src,'https://www.googletagmanager.com/gtag/js?id='+property);assert.equal(b.scripts[0].async,true);
 const commands=b.window.dataLayer.slice(1).map(item=>Array.from(item));assert.equal(commands[0][0],'consent');assert.equal(commands[0][2].analytics_storage,'granted');assert.equal(commands[0][2].ad_storage,'denied');assert.equal(commands[1][0],'js');assert.equal(commands[2][0],'config');assert.equal(commands[2][1],property);assert.equal(commands[2][2].allow_google_signals,false);assert.equal(commands[2][2].allow_ad_personalization_signals,false);
 b.choose('granted');assert.equal(b.scripts.length,1);assert.equal(b.window.dataLayer.length,4);
});

test('accepting consent later starts analytics; withdrawal disables it and removes analytics cookies',()=>{
 const b=browser();b.choose('granted');assert.equal(b.scripts.length,1);assert.equal(b.window['ga-disable-'+property],false);
 const commandCount=b.window.dataLayer.length;b.cookieWrites.length=0;b.choose('denied');assert.equal(b.scripts.length,0);assert.equal(b.window['ga-disable-'+property],true);assert.equal(b.window.dataLayer.length,commandCount);
 for(const name of ['_ga','_ga_TEST'])assert.ok(b.cookieWrites.some(value=>value===name+'=; Max-Age=0; path=/'));
 assert.ok(b.cookieWrites.some(value=>value.includes('domain=.example.test')));assert.ok(b.cookieWrites.every(value=>value.startsWith('_ga')));
});

test('HTML does not bypass consent by loading the remote analytics script',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/src="\/google-tag\.js"/);assert.doesNotMatch(html,/<script[^>]+src=["'][^"']*(googletagmanager|google-analytics)\.com/i);
});
