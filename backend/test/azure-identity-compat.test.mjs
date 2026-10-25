import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {dirname} from 'node:path';
const require=createRequire(import.meta.url),tedious=require.resolve('tedious',{paths:[dirname(require.resolve('mssql'))]}),identity=require.resolve('@azure/identity',{paths:[dirname(tedious)]});
const {ClientSecretCredential}=require(identity),{createHttpHeaders}=require(require.resolve('@azure/core-rest-pipeline',{paths:[dirname(identity)]}));
test('SQL Azure identity adapter remains compatible with the patched MSAL client',async()=>{
 const calls=[];const tenant='11111111-1111-4111-8111-111111111111';const origin='https://login.microsoftonline.com';
 const credential=new ClientSecretCredential(tenant,'22222222-2222-4222-8222-222222222222','fixture-secret',{disableInstanceDiscovery:true,httpClient:{sendRequest:async request=>{
  calls.push({url:request.url,method:request.method});
  const metadata={authorization_endpoint:origin+'/'+tenant+'/oauth2/v2.0/authorize',token_endpoint:origin+'/'+tenant+'/oauth2/v2.0/token',end_session_endpoint:origin+'/'+tenant+'/oauth2/v2.0/logout',issuer:origin+'/'+tenant+'/v2.0',jwks_uri:origin+'/'+tenant+'/discovery/v2.0/keys'};
  const body=request.url.includes('openid-configuration')?metadata:{token_type:'Bearer',expires_in:3600,access_token:'fixture-sql-access-token'};
  return{request,status:200,headers:createHttpHeaders({'content-type':'application/json'}),bodyAsText:JSON.stringify(body)}
 }}});
 const token=await credential.getToken('https://database.windows.net/.default');assert.equal(token.token,'fixture-sql-access-token');assert.ok(calls.some(call=>call.method==='POST'&&new URL(call.url).pathname.endsWith('/oauth2/v2.0/token')));assert.ok(calls.every(call=>call.url.startsWith(origin+'/')));
});
