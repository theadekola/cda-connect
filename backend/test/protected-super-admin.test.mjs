import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(new URL('../sql/protected-super-admin.sql',import.meta.url),'utf8');
const advanced=fs.readFileSync(new URL('../src/routes/advanced.ts',import.meta.url),'utf8');
const permissions=fs.readFileSync(new URL('../src/services/permissions.ts',import.meta.url),'utf8');
const platform=fs.readFileSync(new URL('../src/routes/platform.ts',import.meta.url),'utf8');

test('Adekola account is promoted by stable email and protected in the database',()=>{
 assert.match(migration,/adekola750@outlook\.com/i);
 assert.match(migration,/IsSuperAdmin=1,IsProtectedAccount=1,AccountStatus='ACTIVE'/);
 assert.match(migration,/CREATE OR ALTER TRIGGER dbo\.TR_Users_ProtectSuperAdmin/);
 assert.match(migration,/newRow\.Id IS NULL/);
 assert.match(migration,/newRow\.IsSuperAdmin<>1/);
 assert.match(migration,/newRow\.AccountStatus<>'ACTIVE'/);
});

test('all legacy account closing routes use the application guard',()=>{
 for(const route of ['/me/delete-account-request','/me/deactivate','/me/deactivate-secure','/me/delete-account']){
  const start=advanced.indexOf(`advancedRouter.post('${route}'`);assert.notEqual(start,-1);
  assert.match(advanced.slice(start,start+500),/assertAccountCanClose/);
 }
});

test('central permission checks recognize active super-admin authority',()=>{
 assert.match(permissions,/AccountStatus='ACTIVE' AND IsSuperAdmin=1/);
 assert.match(permissions,/permission==='ATTENDANCE_MANAGE'/);
 assert.match(permissions,/permission==='MEMBER_APPROVE'/);
 assert.match(platform,/await isSuperAdmin\(req\.user!\.id\)/);
});
