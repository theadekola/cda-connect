import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('password recovery uses email delivery and keeps account lookup private',async()=>{
 const source=await readFile(new URL('../src/routes/auth.ts',import.meta.url),'utf8');
 const start=source.indexOf("authRouter.post('/password-reset/request'");
 const end=source.indexOf("authRouter.post('/password-reset/complete'",start);
 const route=source.slice(start,end);
 assert.match(route,/z\.string\(\)\.trim\(\)\.toLowerCase\(\)\.email\(\)/);
 assert.match(route,/WHERE Email=@email/);
 assert.match(route,/sendEmailBatch/);
 assert.match(route,/password reset code/);
 assert.doesNotMatch(route,/createSmsChallenge|sendVerificationSms|WHERE Phone=@phone/);
 assert.match(route,/password-reset-unavailable/);
});
