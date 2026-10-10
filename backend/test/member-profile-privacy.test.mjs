import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('public member profiles never return or render private contact details',async()=>{
 const route=await readFile(new URL('../src/routes/account.ts',import.meta.url),'utf8');
 const projection=route.slice(route.indexOf('async function memberView'),route.indexOf("accountRouter.get('/members/:id'"));
 assert.doesNotMatch(projection,/u\.(?:Email|Phone|Address|Postcode|DateOfBirth)/);
 const frontend=await readFile(new URL('../../frontend/src/account.tsx',import.meta.url),'utf8');
 const profile=frontend.slice(frontend.indexOf('export function MemberProfile'));
 assert.doesNotMatch(profile,/p\.(?:Email|Phone|CoverImage)|mailto:|tel:|Copy profile link/);
});
