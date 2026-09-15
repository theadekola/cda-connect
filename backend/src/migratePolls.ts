import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {getPool,sql} from './config/db.js';
export async function ensurePollSchema(pool:sql.ConnectionPool,load:()=>Promise<string>){
 const c=(await pool.request().query(`SELECT DB_NAME() DatabaseName,USER_NAME() DatabaseUser,
 OBJECT_ID('dbo.PollComments','U') CommentsTable,OBJECT_ID('dbo.Polls','U') PollsTable,OBJECT_ID('dbo.PollOptions','U') OptionsTable,OBJECT_ID('dbo.PollVotes','U') VotesTable,
 COL_LENGTH('dbo.Polls','SettingsJson') SettingsColumn,COL_LENGTH('dbo.Polls','CreateRequestId') RequestColumn,COL_LENGTH('dbo.PollVotes','OtherText') OtherColumn,
 CASE WHEN IS_MEMBER('db_owner')=1 OR HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL')=1 THEN 1 ELSE 0 END CanMigrate`)).recordset[0];
 if(!(c?.CommentsTable&&c?.PollsTable&&c?.OptionsTable&&c?.VotesTable&&c?.SettingsColumn!=null&&c?.RequestColumn!=null&&c?.OtherColumn!=null)){
  if(c?.CanMigrate!==1)throw Error('Poll schema is incomplete or hidden. No ALTER was attempted. Database diagnostics: '+JSON.stringify(c)+'. A database administrator must apply backend/sql/poll-wizard.sql in this database and grant the DatabaseUser the required SELECT, INSERT, UPDATE, DELETE permissions on dbo.Polls, dbo.PollOptions, dbo.PollVotes and dbo.PollComments.');
  if(!(c.PollsTable&&c.OptionsTable&&c.VotesTable))throw Error('Base poll tables are missing. Check the configured database and base schema. Database diagnostics: '+JSON.stringify(c));
  // The SQL file owns its transaction, including when executed manually by a DBA.
  for(const batch of (await load()).split(/^GO\s*$/im).filter(s=>s.trim()))await pool.request().batch(batch);
 }
 await pool.request().query('SELECT TOP 0 Id,SettingsJson,CreateRequestId FROM dbo.Polls; SELECT TOP 0 Id,PollId FROM dbo.PollOptions; SELECT TOP 0 Id,OtherText FROM dbo.PollVotes; SELECT TOP 0 Id,Body FROM dbo.PollComments;');
 return 'Poll settings schema ready; runtime access verified.';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let pool:sql.ConnectionPool|undefined;
 try{pool=await getPool();console.log(await ensurePollSchema(pool,()=>readFile(new URL('../sql/poll-wizard.sql',import.meta.url),'utf8')))}
 catch(error){console.error('Poll schema verification failed; release was not switched.',error instanceof Error?error.message:error);process.exitCode=1}
 finally{await pool?.close()}
}
