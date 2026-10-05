import fs from 'node:fs/promises';
import sql from 'mssql';

// Administrative credentials are provided only to this process, never to the API.
const command = process.argv[2];
if (!['init', 'protect', 'verify', 'backup', 'log-backup'].includes(command)) {
  throw new Error('Usage: node scripts/database.mjs init|protect|verify|backup|log-backup');
}
const database = 'CDAConnect';
const literal = value => "N'" + String(value).replaceAll("'", "''") + "'";
const required = name => { if (!process.env[name]) throw new Error(`Set ${name}`); return process.env[name]; };
const pool = await new sql.ConnectionPool({
  server: required('DB_SERVER'), port: Number(process.env.DB_PORT || 1433),
  user: required('DB_ADMIN_USER'), password: required('DB_ADMIN_PASSWORD'), database: 'master',
  connectionTimeout: 15000, requestTimeout: 600000,
  options: { encrypt: true, trustServerCertificate: process.env.DB_TRUST_CERT === 'true' }
}).connect();
try {
  if (command === 'init' || command === 'protect') {
    if (required('APP_DB_PASSWORD').length < 8) throw new Error('APP_DB_PASSWORD must contain at least 8 characters.');
    const preflight=await pool.request().query("SELECT SUSER_ID(N'community_app') LoginId, IS_SRVROLEMEMBER('sysadmin') IsAdmin");
    if(preflight.recordset[0].IsAdmin!==1)throw new Error('A SQL sysadmin is required to install server deletion guards.');
    if(preflight.recordset[0].LoginId!=null)throw new Error('community_app already exists. Refusing to change an existing login automatically; have your DBA review it first.');
  }
  if (command === 'init') {
    const exists = await pool.request().query("SELECT DB_ID(N'CDAConnect') Id");
    if (exists.recordset[0].Id != null) throw new Error('CDAConnect already exists. Refusing to overwrite or rerun the fresh schema. Back up and review migrations separately.');
    await pool.request().query('CREATE DATABASE [CDAConnect]');
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    let aborted = false;
    transaction.on('rollback', () => { aborted = true; });
    try {
      await new sql.Request(transaction).batch('USE [CDAConnect]; SET XACT_ABORT ON;');
      const source = await fs.readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
      for (const batch of source.split(/^\s*GO\s*$/mi).filter(part => part.trim())) {
        await new sql.Request(transaction).batch(batch);
      }
      await transaction.commit();
      console.log('Fresh schema installed atomically.');
    } catch (error) {
      if (!aborted) await transaction.rollback().catch(() => {});
      throw new Error(`Schema installation failed; no existing database was overwritten. The new database remains for inspection. ${error.message}`);
    }
    await pool.request().batch('ALTER DATABASE [CDAConnect] SET RECOVERY FULL; ALTER DATABASE [CDAConnect] SET PAGE_VERIFY CHECKSUM;');
  }
  if (command === 'protect' || command === 'init') {
    const password = required('APP_DB_PASSWORD');
    if (password.length < 8) throw new Error('APP_DB_PASSWORD must contain at least 8 characters.');
    await pool.request().batch(`
      IF SUSER_ID(N'community_app') IS NULL
        CREATE LOGIN [community_app] WITH PASSWORD=${literal(password)}, CHECK_POLICY=ON;
      ELSE
        THROW 51010, 'community_app already exists. Refusing to rotate or modify an unverified existing login. Review its permissions manually.', 1;
      USE [CDAConnect];
      CREATE USER [community_app] FOR LOGIN [community_app] WITH DEFAULT_SCHEMA=[dbo];
      CREATE ROLE [cda_runtime];
      GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[dbo] TO [cda_runtime];
      DENY ALTER, TAKE OWNERSHIP ON SCHEMA::[dbo] TO [cda_runtime];
      DENY CREATE TABLE, CREATE VIEW, CREATE PROCEDURE, CREATE FUNCTION TO [cda_runtime];
      ALTER ROLE [cda_runtime] ADD MEMBER [community_app];
      USE [master];
      DENY ALTER ANY DATABASE TO [community_app];
    `);
    const protection = await fs.readFile(new URL('../sql/protect-database.sql', import.meta.url), 'utf8');
    let scope='master';
    for (const batch of protection.split(/^\s*GO\s*$/mi).filter(part => part.trim())) {
      const use=batch.trim().match(/^USE \[([^\]]+)\];$/i);
      if(use){scope=use[1];continue;}
      await pool.request().batch(`USE [${scope}]; EXEC(${literal(batch)});`);
    }
    console.log('Runtime login and deletion guards installed. Administrative accounts can deliberately disable guards.');
  }
  if (command === 'backup' || command === 'log-backup' || command === 'init') {
    const directory = process.env.SQL_BACKUP_DIRECTORY || '/var/opt/mssql/backup';
    if (!directory.startsWith('/') || directory.includes('..')) throw new Error('Use an absolute Linux backup directory without parent traversal.');
    const log = command === 'log-backup';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destination = `${directory}/${database}_${stamp}${log ? '.trn' : '.bak'}`;
    // No INIT, FORMAT or automatic deletion. Existing backups are never overwritten.
    await pool.request().batch(`BACKUP ${log ? 'LOG' : 'DATABASE'} [CDAConnect] TO DISK=${literal(destination)} WITH CHECKSUM, STATS=10;
      RESTORE VERIFYONLY FROM DISK=${literal(destination)} WITH CHECKSUM;`);
    console.log(`Backup and checksum verification completed on SQL VM: ${destination}`);
  }
  if (command === 'verify' || command === 'init') {
    const source = await fs.readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
    const expected = [...new Set([...source.matchAll(/CREATE TABLE\s+(?:dbo\.)?(\w+)/gi)].map(match => match[1]))];
    const actual = await pool.request().batch('USE [CDAConnect]; SELECT name FROM sys.tables; SELECT name,is_disabled FROM sys.triggers WHERE parent_class=0;');
    const names = new Set(actual.recordsets[0].map(row => row.name.toLowerCase()));
    const missing = expected.filter(name => !names.has(name.toLowerCase()));
    if (missing.length) throw new Error(`Missing tables: ${missing.join(', ')}`);
    const checks = await pool.request().batch(`USE [CDAConnect];
      SELECT COL_LENGTH('Polls','ImageUrl') PollImage, COL_LENGTH('MarketplaceListings','ItemCondition') MarketplaceCondition;
      SELECT name,recovery_model_desc,page_verify_option_desc FROM sys.databases WHERE name=N'CDAConnect';
      SELECT TOP 5 type,backup_start_date,backup_finish_date,has_backup_checksums FROM msdb.dbo.backupset WHERE database_name=N'CDAConnect' ORDER BY backup_finish_date DESC;
      DBCC CHECKDB ([CDAConnect]) WITH NO_INFOMSGS;
    `);
    console.log(JSON.stringify({ expectedTables: expected.length, missing, databaseTriggers: actual.recordsets[1], checks: checks.recordsets }, null, 2));
  }
} finally { await pool.close(); }
