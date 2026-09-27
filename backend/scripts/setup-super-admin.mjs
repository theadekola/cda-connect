import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import sql from 'mssql';

const email=(process.env.SUPER_ADMIN_EMAIL||'').trim().toLowerCase();
const password=process.env.SUPER_ADMIN_PASSWORD||'';
const firstName=(process.env.SUPER_ADMIN_FIRST_NAME||'').trim();
const lastName=(process.env.SUPER_ADMIN_LAST_NAME||'').trim();
const allowed=new Set(['PLATFORM_AUDIT_VIEW','USER_PII_VIEW','FINANCE_AUDIT_VIEW','SECURITY_AUDIT_VIEW']);
const permissions=(process.env.SUPER_ADMIN_PERMISSIONS||'PLATFORM_AUDIT_VIEW,USER_PII_VIEW,FINANCE_AUDIT_VIEW,SECURITY_AUDIT_VIEW').split(',').map(x=>x.trim()).filter(Boolean);

if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Set SUPER_ADMIN_EMAIL to a valid email address');
if(password.length<14||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)||!/[^A-Za-z0-9]/.test(password))throw Error('SUPER_ADMIN_PASSWORD must be at least 14 characters and include upper, lower, number and symbol');
if(permissions.some(code=>!allowed.has(code)))throw Error('SUPER_ADMIN_PERMISSIONS contains an unknown permission');

const database=process.env.DB_NAME;
const user=process.env.DB_ADMIN_USER;
const dbPassword=process.env.DB_ADMIN_PASSWORD;
if(!database||!user||!dbPassword)throw Error('Configure DB_NAME, DB_ADMIN_USER and DB_ADMIN_PASSWORD');

const pool=await new sql.ConnectionPool({server:process.env.DB_SERVER,port:Number(process.env.DB_PORT||1433),database,user,password:dbPassword,options:{encrypt:process.env.DB_ENCRYPT!=='false',trustServerCertificate:process.env.DB_TRUST_CERT==='true'}}).connect();
const tx=new sql.Transaction(pool);
try{
 await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 const request=()=>new sql.Request(tx);
 const protectedAccount=(await request().query("SELECT TOP 1 Id,Email FROM Users WITH(UPDLOCK,HOLDLOCK) WHERE IsProtectedAccount=1 AND IsSuperAdmin=1")).recordset[0];
 if(protectedAccount&&String(protectedAccount.Email).toLowerCase()!==email)throw Error('A different protected Super Admin already exists; refusing to continue');
 let account=(await request().input('email',sql.NVarChar(255),email).query('SELECT TOP 1 Id,PasswordHash,IsSuperAdmin,IsProtectedAccount FROM Users WITH(UPDLOCK,HOLDLOCK) WHERE LOWER(Email)=@email')).recordset[0];
 let created=false;
 if(account){
  if(!(await bcrypt.compare(password,account.PasswordHash)))throw Error('Password confirmation failed for the existing account');
 }else{
  if(firstName.length<2||lastName.length<2)throw Error('Set SUPER_ADMIN_FIRST_NAME and SUPER_ADMIN_LAST_NAME when creating a new account');
  const id=crypto.randomUUID(),hash=await bcrypt.hash(password,12);
  account=(await request().input('id',sql.UniqueIdentifier,id).input('first',sql.NVarChar(100),firstName).input('last',sql.NVarChar(100),lastName).input('email',sql.NVarChar(255),email).input('hash',sql.NVarChar(500),hash)
   .query("INSERT Users(Id,FirstName,LastName,Email,PasswordHash,AccountStatus,EmailVerified,IsSuperAdmin,IsProtectedAccount) OUTPUT INSERTED.Id,INSERTED.PasswordHash,INSERTED.IsSuperAdmin,INSERTED.IsProtectedAccount VALUES(@id,@first,@last,@email,@hash,'ACTIVE',1,1,1)")).recordset[0];
  created=true;
 }
 if(!created)await request().input('id',sql.UniqueIdentifier,account.Id).query("UPDATE Users SET IsSuperAdmin=1,IsProtectedAccount=1,AccountStatus='ACTIVE',UpdatedAt=SYSUTCDATETIME() WHERE Id=@id");
 for(const code of permissions)await request().input('u',sql.UniqueIdentifier,account.Id).input('code',sql.NVarChar(100),code).query('IF NOT EXISTS(SELECT 1 FROM SuperAdminPermissionAssignments WHERE UserId=@u AND PermissionCode=@code) INSERT SuperAdminPermissionAssignments(UserId,PermissionCode,GrantedBy) VALUES(@u,@code,@u)');
 await request().input('u',sql.UniqueIdentifier,account.Id).input('details',sql.NVarChar(sql.MAX),JSON.stringify({email,created,permissions})).query("INSERT AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(NULL,@u,'PROTECTED_SUPER_ADMIN_CONFIGURED','User',@u,@details)");
 await tx.commit();
 console.log(created?'Protected Super Admin created':'Existing account promoted to protected Super Admin');
}catch(error){
 await tx.rollback().catch(()=>{});throw error;
}finally{await pool.close()}
