import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(new URL('../sql/super-admin-security-v2.sql',import.meta.url),'utf8');
const legacyMigration=fs.readFileSync(new URL('../sql/protected-super-admin.sql',import.meta.url),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../sql/migrations.json',import.meta.url),'utf8'));
const setup=fs.readFileSync(new URL('../scripts/setup-super-admin.mjs',import.meta.url),'utf8');
const advanced=fs.readFileSync(new URL('../src/routes/advanced.ts',import.meta.url),'utf8');
const permissions=fs.readFileSync(new URL('../src/services/permissions.ts',import.meta.url),'utf8');
const platform=fs.readFileSync(new URL('../src/routes/platform.ts',import.meta.url),'utf8');
const middleware=fs.readFileSync(new URL('../src/middleware/superAdmin.ts',import.meta.url),'utf8');
const router=fs.readFileSync(new URL('../src/routes/superAdmin.ts',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const moderationMigration=fs.readFileSync(new URL('../sql/platform-moderation-controls.sql',import.meta.url),'utf8');
const platformGuard=fs.readFileSync(new URL('../src/middleware/communityPlatformStatus.ts',import.meta.url),'utf8');
const socket=fs.readFileSync(new URL('../src/socket.ts',import.meta.url),'utf8');
const worker=fs.readFileSync(new URL('../src/workers/worker.ts',import.meta.url),'utf8');

test('normal migration creates protection structures without personal bootstrap data',()=>{
 assert.doesNotMatch(migration,/@outlook\.com|@gmail\.com/i);
 assert.doesNotMatch(migration,/UPDATE dbo\.Users\s+SET IsSuperAdmin/i);
 assert.match(migration,/CREATE OR ALTER TRIGGER dbo\.TR_Users_ProtectSuperAdmin/);
 assert.match(migration,/newRow\.Id IS NULL/);
 assert.match(migration,/newRow\.IsSuperAdmin<>1/);
 assert.match(migration,/newRow\.AccountStatus<>'ACTIVE'/);
 assert.match(migration,/SuperAdminAccessGrants/);
 assert.match(migration,/ReauthenticatedAt/);
});

test('superseded legacy migration contains no personal bootstrap identity',()=>{
 assert.doesNotMatch(legacyMigration,/@outlook\.com|@gmail\.com/i);
 assert.doesNotMatch(legacyMigration,/UPDATE dbo\.Users\s+SET IsSuperAdmin/i);
 assert.equal(manifest.find(item=>item.version==='0045')?.sha256,'0a3d6374ab3c2b15a4ff8d5cb76c0b47f0da62dfc1ab1378a74362ebc340216b');
 assert.equal(manifest.find(item=>item.version==='0045')?.supersededBy,'0047');
 assert.equal(manifest.find(item=>item.version==='0046')?.supersededBy,'0047');
 assert.equal(manifest.find(item=>item.version==='0047')?.file,'super-admin-security-v2.sql');
 assert.ok(migration.indexOf("ADD ReauthenticatedAt")<migration.indexOf('CREATE OR ALTER VIEW dbo.AuditSecurity'));
});

test('protected setup is parameterized, transactional and refuses a second protected account',()=>{
 assert.match(setup,/SUPER_ADMIN_EMAIL/);
 assert.match(setup,/SUPER_ADMIN_PASSWORD/);
 assert.match(setup,/bcrypt\.hash\(password,12\)/);
 assert.match(setup,/SERIALIZABLE/);
 assert.match(setup,/A different protected Super Admin already exists/);
 assert.match(setup,/PROTECTED_SUPER_ADMIN_CONFIGURED/);
 assert.doesNotMatch(setup,/@outlook\.com|@gmail\.com/i);
});

test('all legacy account closing routes use the application guard',()=>{
 for(const route of ['/me/delete-account-request','/me/deactivate','/me/deactivate-secure','/me/delete-account']){
  const start=advanced.indexOf(`advancedRouter.post('${route}'`);assert.notEqual(start,-1);
  assert.match(advanced.slice(start,start+500),/assertAccountCanClose/);
 }
});

test('super-admin uses dedicated database-backed authorization and no community bypass',()=>{
 assert.match(permissions,/AccountStatus='ACTIVE' AND IsSuperAdmin=1/);
 assert.doesNotMatch(permissions,/EXISTS\(SELECT 1 FROM Users WHERE Id=@u AND AccountStatus='ACTIVE' AND IsSuperAdmin=1\) OR EXISTS/);
 assert.match(permissions,/permission==='ATTENDANCE_MANAGE'/);
 assert.match(permissions,/accessGrant\.AccessMode='BREAK_GLASS'/);
 assert.match(permissions,/accessGrant\.CommunityId=@c/);
 assert.match(permissions,/permission==='MEMBER_APPROVE'/);
 assert.match(platform,/await isSuperAdmin\(req\.user!\.id\)/);
 for(const name of ['requireSuperAdmin','requireSuperAdminPermission','requireRecentAuthentication'])assert.match(middleware,new RegExp(`export (?:async function|function) ${name}`));
 assert.match(router,/superAdminRouter\.use\(requireSuperAdmin\)/);
 assert.match(router,/superAdminRouter\.post\('\/mfa\/challenge'/);
 assert.match(router,/superAdminRouter\.post\('\/mfa\/verify'/);
 assert.match(router,/TwoFactorEnabled/);
 assert.match(router,/SET ReauthenticatedAt=NULL/);
 assert.match(router,/SUPER_ADMIN_MFA_VERIFIED/);
 assert.match(router,/superAdminRouter\.use\(requireRecentAuthentication\)/);
 assert.ok(router.indexOf("post('/mfa/verify'")<router.indexOf('use(requireRecentAuthentication)'));
 assert.ok(router.indexOf('use(requireRecentAuthentication)')<router.indexOf("post('/access'"));
 assert.match(router,/SUPER_ADMIN_ACCESS_STARTED/);
 assert.match(app,/app\.use\('\/api\/v1\/super-admin', superAdminRouter\)/);
});

test('attendance requires owner/admin or an explicitly assigned permission',()=>{
 assert.match(permissions,/p\.Code=@p OR community\.OwnerUserId=@u OR r\.Name IN \('Owner','Admin'\)/);
 assert.doesNotMatch(permissions,/EXISTS\(SELECT 1 FROM CommunityMembers WHERE UserId=@u AND CommunityId=@c AND Status='ACTIVE'\)/);
});

test('dangerous account actions require confirmation, protect administrators, audit, notify and revoke access',()=>{
 assert.match(router,/reason:z\.string\(\)\.trim\(\)\.min\(8\)\.max\(1000\)/);
 assert.match(router,/You cannot suspend or reactivate your own account/);
 assert.match(router,/SUPER_ADMIN_MANAGE/);
 assert.match(router,/previousStatus:target\.AccountStatus,newStatus:body\.status/);
 assert.match(router,/sendEmailRecipient/);
 assert.match(router,/disconnectUserSockets\(id\)/);
 assert.match(router,/DELETE UserDevices WHERE UserId=@id/);
});

test('community lifecycle is migrated and enforced across HTTP, sockets and notification workers',()=>{
 for(const column of ['PlatformStatus','SuspendedAt','SuspendedBy','SuspensionReason','UpdatedAt'])assert.match(moderationMigration,new RegExp(column));
 for(const status of ['ACTIVE','RESTRICTED','SUSPENDED','ARCHIVED'])assert.match(moderationMigration,new RegExp(`'{1,2}${status}'{1,2}`));
 assert.match(router,/patch\('\/communities\/:communityId\/status'/);
 assert.match(router,/SUPER_ADMIN_COMMUNITY_STATUS_CHANGED/);
 assert.match(platformGuard,/COMMUNITY_PLATFORM_RESTRICTED/);
 assert.match(socket,/community\.PlatformStatus='ACTIVE'/);
 assert.match(worker,/COMMUNITY_'\+platform\.PlatformStatus/);
 assert.equal(manifest.find(item=>item.version==='0049')?.file,'platform-moderation-controls.sql');
});
