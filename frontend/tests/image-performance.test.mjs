import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('authentication pages use compact WebP artwork',()=>{
 for(const [file,limit] of [['welcome-community.webp',350000],['login-community.webp',350000],['brand-logo.webp',75000],['brand-wordmark.webp',40000]])assert.ok(statSync(new URL('../public/'+file,import.meta.url)).size<limit,file+' exceeds its performance budget');
 const source=read('src/auth.tsx')+read('src/styles/controls.css')+read('index.html');
 assert.match(source,/welcome-community\.webp/);
 assert.match(source,/login-community\.webp/);
 assert.doesNotMatch(source,/(?:welcome-community|login-community|brand-logo|brand-wordmark)\.png/);
});

test('public authentication routes render before session restoration finishes',()=>{
 const source=read('src/main.tsx');
 assert.match(source,/if\(publicPath\)\{render\(\);void restoreSession\(\)\}/);
});
