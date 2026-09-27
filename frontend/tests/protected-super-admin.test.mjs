import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const help=fs.readFileSync(new URL('../src/HelpSupport.tsx',import.meta.url),'utf8');
const deletion=fs.readFileSync(new URL('../src/DeleteAccount.tsx',import.meta.url),'utf8');
const settings=fs.readFileSync(new URL('../src/settings.tsx',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../src/SuperAdminDashboard.tsx',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');

test('protected super-admin does not receive the delete-account link',()=>{
 assert.match(help,/account\.isSuccess&&!account\.data\.IsProtectedAccount/);
 assert.match(help,/queryKey:\['\/users\/account'\]/);
});

test('protected super-admin cannot open the delete-account page directly',()=>{
 assert.match(deletion,/if\(account\.data\.IsProtectedAccount\)return <Navigate to="\/settings\/support" replace\/>/);
 assert.match(deletion,/queryKey:\['\/users\/account'\]/);
});

test('only a super-admin sees the admin button and the dashboard has its own protected shell',()=>{
 assert.match(settings,/isSuperAdmin=Boolean\(current\?\.user\.IsSuperAdmin\)/);
 assert.match(settings,/group\.name==='Account settings'&&isSuperAdmin/);
 assert.match(settings,/nav\('\/super-admin'/);
 assert.match(admin,/if\(!current\?\.user\.IsSuperAdmin\)return <Navigate to="\/home" replace\/>/);
 assert.match(admin,/api\.get<RecordData>\('\/super-admin\/mfa\/status'/);
 assert.match(admin,/api\.send\('\/super-admin\/mfa\/verify'/);
 assert.match(admin,/status\.data\.method!==\'authenticator\'/);
 assert.match(admin,/className="admin-sidebar"/);
 assert.match(admin,/className="admin-mobile-nav"/);
 assert.match(main,/path="\/super-admin" element={<SuperAdminShell\/>}/);
 assert.match(main,/path="\/super-admin\/login" element={<SuperAdminLogin\/>}/);
});
