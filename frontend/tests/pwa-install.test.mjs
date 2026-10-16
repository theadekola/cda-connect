import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('iOS install metadata selects standard status chrome and the actual logo',()=>{
 const html=read('index.html');
 assert.match(html,/name="apple-mobile-web-app-status-bar-style" content="default"/);
 assert.match(html,/rel="apple-touch-icon" sizes="192x192" href="\/apple-touch-icon-v2.png"/);
 for(const name of ['apple-touch-icon.png','apple-touch-icon-v2.png'])assert.deepEqual(readFileSync(new URL('../public/'+name,import.meta.url)),readFileSync(new URL('../public/icon-192.png',import.meta.url)));
 assert.equal(JSON.parse(read('public/manifest.webmanifest')).theme_color,'#FFFFFF');
});
test('www redirects to the website origin and retains the destination path',()=>{
 const nginx=read('../deploy/nginx-cda-connect.conf');
 assert.match(nginx,/server_name www\.cdaconnect\.org;\s*return 308 https:\/\/cdaconnect\.org\$request_uri;/);
});
