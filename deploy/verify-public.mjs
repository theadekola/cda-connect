// Read-only deployment diagnostics. No passwords or authenticated records are used.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function verifyPublic(origin,{fetcher=fetch,native=false,localHtml}={}){
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.username||base.password||base.pathname!=='/'||base.search||base.hash)throw Error('Provide an HTTPS origin without a path or credentials.');
 const results=[];
 async function check(name,run){try{await run();results.push({name,ok:true})}catch{results.push({name,ok:false})}}
 async function request(path,options={}){return fetcher(new URL(path,base),{...options,redirect:'manual',signal:AbortSignal.timeout(20000)})}
 let html='';
 await check('Website and iOS install metadata',async()=>{
  const response=await request('/');if(response.status!==200)throw Error();html=await response.text();
  if(!/name="apple-mobile-web-app-status-bar-style" content="default"/.test(html)||!html.includes('/apple-touch-icon-v2.png'))throw Error();
 });
 if(localHtml)await check('Deployed JavaScript matches this release',async()=>{const asset=text=>text.match(/src="(\/assets\/app-[^"]+\.js)"/)?.[1];if(!asset(html)||asset(html)!==asset(localHtml))throw Error()});
 await check('Website API and database, Redis and worker health',async()=>{
  const response=await request('/health'),data=await response.json();
  if(response.status!==200||data.ok!==true||!['api','mssql','redis','worker'].every(key=>data.checks?.[key]==='ok'))throw Error();
 });
 await check('Same-origin sign-in API validation',async()=>{
  const response=await request('/api/v1/auth/login',{method:'POST',headers:{Origin:base.origin,'content-type':'application/json','x-cda-client':'app'},body:'{}'});
  const data=await response.json();if(response.status!==400||data.field!=='email')throw Error();
 });
 await check('PWA manifest and logo assets',async()=>{
  const manifestResponse=await request('/manifest.webmanifest');if(manifestResponse.status!==200)throw Error();
  const manifest=await manifestResponse.json();if(manifest.theme_color?.toUpperCase()!=='#FFFFFF'||!manifest.icons?.length)throw Error();
  for(const path of new Set(['/apple-touch-icon-v2.png',...manifest.icons.map(icon=>icon.src)])){
   const url=new URL(path,base);if(url.origin!==base.origin)throw Error();
   const response=await request(url);const bytes=new Uint8Array(await response.arrayBuffer());
   if(response.status!==200||!/^image\//.test(response.headers.get('content-type')||'')||bytes.length<1000)throw Error();
  }
 });
 await check('Canonical www redirect preserves links',async()=>{
  const url=new URL('/login?next=%2Fhome',base);url.hostname='www.'+base.hostname.replace(/^www\./,'');
  const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(![301,308].includes(response.status)||response.headers.get('location')!==base.origin+'/login?next=%2Fhome')throw Error();
 });
 if(native)for(const [name,path,valid] of [
  ['iOS universal links','/.well-known/apple-app-site-association',data=>data.applinks?.details?.some(item=>item.appIDs?.length||item.appID)],
  ['Android app links','/.well-known/assetlinks.json',data=>Array.isArray(data)&&data.some(item=>item.target?.sha256_cert_fingerprints?.length)],
 ])await check(name,async()=>{const response=await request(path);if(response.status!==200||!valid(await response.json()))throw Error()});
 return results;
}
export function publicCheckOptions(args){
 if(args.some(arg=>arg.startsWith('--')&&arg!=='--native')||args.filter(arg=>!arg.startsWith('--')).length>1)throw Error('Usage: node deploy/verify-public.mjs [https://cdaconnect.org] [--native]');
 return{origin:args.find(arg=>!arg.startsWith('--'))||'https://cdaconnect.org',native:args.includes('--native')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const {origin,native}=publicCheckOptions(process.argv.slice(2));let localHtml;
 try{localHtml=await readFile(new URL('../frontend/dist/index.html',import.meta.url),'utf8')}catch(error){if(error.code!=='ENOENT')throw error}
 const results=await verifyPublic(origin,{native,localHtml});
 for(const result of results)console.log(`${result.ok?'PASS':'FAIL'} ${result.name}`);
 console.log('Device calls, push delivery, signing and store declarations require separate verification.');
 if(results.some(result=>!result.ok))process.exitCode=1;
}
