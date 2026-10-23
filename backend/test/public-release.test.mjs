import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyPublic,publicCheckOptions} from '../../deploy/verify-public.mjs';
const html='<meta name="apple-mobile-web-app-status-bar-style" content="default"><link href="/apple-touch-icon-v2.png"><script src="/assets/app-abcdefgh.js"></script>';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
const mock=async(value)=>{
 const url=new URL(value);
 if(url.hostname.startsWith('www.'))return new Response(null,{status:308,headers:{location:'https://app.example.test/login?next=%2Fhome'}});
 if(url.pathname==='/')return new Response(html);
 if(url.pathname==='/health')return json({ok:true,checks:{api:'ok',mssql:'ok',redis:'ok',worker:'ok'}});
 if(url.pathname==='/api/v1/auth/login')return json({field:'email'},400);
 if(url.pathname==='/manifest.webmanifest')return json({theme_color:'#FFFFFF',icons:[{src:'/icon-192.png'}]});
 if(url.pathname.endsWith('.png'))return new Response(new Uint8Array(1500),{headers:{'content-type':'image/png'}});
 if(url.pathname.endsWith('apple-app-site-association'))return json({applinks:{details:[{appIDs:['TESTTEAM12.org.cdaconnect.app']}]}});
 if(url.pathname.endsWith('assetlinks.json'))return json([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'org.cdaconnect.app',sha256_cert_fingerprints:[Array(32).fill('AB').join(':')]}}]);
 return new Response('',{status:404});
};
test('production verification detects healthy same-origin routing and the exact built bundle',async()=>{
 const results=await verifyPublic('https://app.example.test',{fetcher:mock,native:true,localHtml:html});
 assert.equal(results.length,8);assert.ok(results.every(result=>result.ok));
});
test('production verification rejects stale deployment, wrong login route and missing native configuration',async()=>{
 const results=await verifyPublic('https://app.example.test',{localHtml:html.replace('abcdefgh','outdated'),native:true,fetcher:async(url,options)=>{
  if(new URL(url).pathname==='/api/v1/auth/login')return new Response('<html>SPA fallback</html>');
  if(new URL(url).pathname.startsWith('/.well-known/'))return json({error:'not configured'},503);
  return mock(url,options);
 }});
 for(const name of ['Deployed JavaScript matches this release','Same-origin sign-in API validation','iOS universal links','Android app links'])assert.equal(results.find(result=>result.name===name).ok,false,name);
});
test('production verification refuses origins containing credentials',async()=>{await assert.rejects(verifyPublic('https://user:secret@app.example.test'),/without a path or credentials/)});

test('native diagnostics work with the default origin and reject unknown CLI flags',()=>{assert.deepEqual(publicCheckOptions(['--native']),{origin:'https://cdaconnect.org',native:true});assert.deepEqual(publicCheckOptions(['https://app.example.test','--native']),{origin:'https://app.example.test',native:true});assert.throws(()=>publicCheckOptions(['--wrong']),/Usage/)});

test('source verification accepts rebuilt asset names but rejects mismatched HTML or metadata',async()=>{
 const id='a'.repeat(64),other='b'.repeat(64),localRelease={schema:1,sourceId:id,version:'1.0.0'};
 async function results(metaId,htmlId){return verifyPublic('https://app.example.test',{localRelease,fetcher:async(url,options)=>{
  const path=new URL(url).pathname;
  if(path==='/release.json')return json({...localRelease,sourceId:metaId});
  if(path==='/')return new Response(html.replace('abcdefgh','different')+`<meta name="cda-source-id" content="${htmlId}">`);
  return mock(url,options);
 }})}
 assert.equal((await results(id,id)).find(x=>x.name==='Deployed source matches this release').ok,true);
 for(const pair of [[other,id],[id,other]])assert.equal((await results(...pair)).find(x=>x.name==='Deployed source matches this release').ok,false);
});

test('native diagnostics reject association files for another app',async()=>{
 const results=await verifyPublic('https://app.example.test',{native:true,fetcher:async(url,options)=>{
  if(new URL(url).pathname.endsWith('apple-app-site-association'))return json({applinks:{details:[{appIDs:['TESTTEAM12.other.app']}]}});
  if(new URL(url).pathname.endsWith('assetlinks.json'))return json([{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:'other.app',sha256_cert_fingerprints:[Array(32).fill('AB').join(':')]}}]);
  return mock(url,options);
 }});
 assert.equal(results.find(x=>x.name==='iOS universal links').ok,false);
 assert.equal(results.find(x=>x.name==='Android app links').ok,false);
});
