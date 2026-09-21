import fs from 'node:fs/promises';import crypto from 'node:crypto';import sql from 'mssql';
const root=new URL('../sql/',import.meta.url),manifest=JSON.parse(await fs.readFile(new URL('migrations.json',root),'utf8'));
export const checksum=text=>crypto.createHash('sha256').update(text.replaceAll('\r\n','\n')).digest('hex');
export async function validateManifest(){const seen=new Set();for(const migration of manifest){if(!/^\d{4}$/.test(migration.version)||seen.has(migration.version)||!/^[-a-z0-9]+\.sql$/.test(migration.file))throw Error('Invalid migration manifest');seen.add(migration.version);const text=await fs.readFile(new URL(migration.file,root),'utf8');if(checksum(text)!==migration.sha256)throw Error('Immutable migration changed: '+migration.file)}const files=(await fs.readdir(root)).filter(x=>x.endsWith('.sql'));if(files.some(file=>!manifest.some(m=>m.file===file)))throw Error('Unversioned SQL migration');}
const mode=process.argv[2]||'verify';await validateManifest();if(mode==='validate'){console.log('Migration manifest and immutable checksums verified');process.exit(0)}
if(!['apply','verify'].includes(mode))throw Error('Use apply, verify or validate');
const admin=mode==='apply',user=admin?process.env.DB_ADMIN_USER:process.env.DB_USER,password=admin?process.env.DB_ADMIN_PASSWORD:process.env.DB_PASSWORD;
if(!user||!password)throw Error(admin?'Configure the deployment-only DB_ADMIN_USER and DB_ADMIN_PASSWORD':'Configure runtime database credentials');
if(admin&&user===process.env.DB_USER)throw Error('Migration identity must differ from the runtime identity');
const database=process.env.DB_NAME;if(!database||!/^[A-Za-z0-9_-]+$/.test(database))throw Error('Invalid DB_NAME');
const pool=await new sql.ConnectionPool({server:process.env.DB_SERVER,port:Number(process.env.DB_PORT||1433),database,user,password,requestTimeout:600000,options:{encrypt:true,trustServerCertificate:process.env.DB_TRUST_CERT==='true'}}).connect();
try{
 if(admin){await pool.request().batch(`IF OBJECT_ID('dbo.SchemaMigrations','U') IS NULL CREATE TABLE dbo.SchemaMigrations(Version varchar(4) NOT NULL PRIMARY KEY,FileName nvarchar(200) NOT NULL,Checksum char(64) NOT NULL,AppliedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),AppliedBy nvarchar(200) NOT NULL DEFAULT ORIGINAL_LOGIN(),Mode varchar(30) NOT NULL);`);
 for(const m of manifest){const tx=new sql.Transaction(pool);await tx.begin();let committed=false;try{
 await new sql.Request(tx).query(`DECLARE @result int;EXEC @result=sp_getapplock @Resource='cda-schema-migrations',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=60000;IF @result<0 THROW 51000,'Migration lock unavailable',1;`);
 const previous=(await new sql.Request(tx).input('v',sql.VarChar(4),m.version).query('SELECT Checksum FROM dbo.SchemaMigrations WHERE Version=@v')).recordset[0];
 if(previous){if(previous.Checksum!==m.sha256)throw Error('Migration checksum mismatch '+m.version);await tx.commit();committed=true;continue;}
 const exists=m.file==='schema.sql'&&(await new sql.Request(tx).query("SELECT OBJECT_ID('dbo.Users','U') Id")).recordset[0].Id;
 if(exists&&process.env.MIGRATION_ADOPT_EXISTING!=='true')throw Error('Existing database has no baseline ledger. Set MIGRATION_ADOPT_EXISTING=true in the deployment-only environment after backup and review.');
 if(exists){for(const table of ['Users','Communities','CommunityMembers','CommunityPosts','UserSessions','FormalBallots','KnowledgeDocuments','StoredObjects'])if(!(await new sql.Request(tx).input('t',sql.NVarChar(200),'dbo.'+table).query("SELECT OBJECT_ID(@t,'U') Id")).recordset[0].Id)throw Error('Baseline missing '+table);}
 else{const text=await fs.readFile(new URL(m.file,root),'utf8');for(let batch of text.split(/^\s*GO\s*$/im).filter(x=>x.trim())){batch=batch.replace(/^\s*USE\s+\[?CDAConnect\]?;?\s*$/gim,'USE ['+database+'];').replace("= N'CDAConnect'","= N'"+database+"'");if(batch.trim())await new sql.Request(tx).batch(batch);}}
 await new sql.Request(tx).batch('USE ['+database+'];');
 await new sql.Request(tx).input('v',sql.VarChar(4),m.version).input('f',sql.NVarChar(200),m.file).input('hash',sql.Char(64),m.sha256).input('mode',sql.VarChar(30),exists?'BASELINE_EXISTING':'APPLIED').query('INSERT INTO dbo.SchemaMigrations(Version,FileName,Checksum,Mode) VALUES(@v,@f,@hash,@mode)');
 await tx.commit();committed=true;console.log('Migration '+m.version+' '+m.file+' verified');
 }catch(e){if(!committed)await tx.rollback().catch(()=>{});throw e}}
 }
 if(admin){const runtime=process.env.DB_USER;if(!runtime||!/^[A-Za-z0-9_-]+$/.test(runtime))throw Error('Configure a dedicated runtime SQL user');await pool.request().batch(`IF USER_ID('${runtime}') IS NULL THROW 51000,'Create the dedicated runtime SQL user before migration',1; DENY ALTER ON SCHEMA::dbo TO [${runtime}]; DENY CREATE TABLE,CREATE PROCEDURE,CREATE FUNCTION,CREATE VIEW,ALTER ANY SCHEMA TO [${runtime}]; DENY INSERT,UPDATE,DELETE ON dbo.SchemaMigrations TO [${runtime}];`);}
 const applied=(await pool.request().query('SELECT Version,Checksum FROM dbo.SchemaMigrations')).recordset;
 for(const m of manifest)if(!applied.some(x=>x.Version===m.version&&x.Checksum===m.sha256))throw Error('Missing required schema version '+m.version);
 if(!admin){const rights=(await pool.request().query("SELECT HAS_PERMS_BY_NAME('dbo','SCHEMA','ALTER') CanAlter,IS_SRVROLEMEMBER('sysadmin') IsAdmin,HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','ALTER') CanAlterDatabase,HAS_PERMS_BY_NAME('dbo.SchemaMigrations','OBJECT','UPDATE') CanEditLedger")).recordset[0];if(rights.CanAlter||rights.IsAdmin||rights.CanAlterDatabase||rights.CanEditLedger)throw Error('Runtime identity must not have schema alteration rights');}
 await pool.request().query(`SELECT TOP 0 FamilyId,RotatedAt FROM UserSessions;SELECT TOP 0 SecurityHoldUntil FROM Users;SELECT TOP 0 JobId,Status FROM NotificationDeliveries;SELECT TOP 0 Stage FROM EmailChangeRequests;SELECT TOP 0 RequestKey,AssignedResponderId,AcknowledgedAt,ResolutionNote FROM SOSRequests;SELECT TOP 0 IsArchived FROM KnowledgeDocuments;SELECT dbo.CanViewMeeting(NULL,NULL) AccessCheck;`);
 console.log('Required schema versions and compatibility checks passed');
}finally{await pool.close()}
