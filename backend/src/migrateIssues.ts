import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {getPool,sql} from './config/db.js';
export async function ensureIssueSchema(pool:sql.ConnectionPool,load:()=>Promise<string>){
 const c=(await pool.request().query(`SELECT DB_NAME() DatabaseName,USER_NAME() DatabaseUser,OBJECT_ID('dbo.CommunityIssues','U') IssuesTable,OBJECT_ID('dbo.CommunityIssueUpdates','U') UpdatesTable,COL_LENGTH('dbo.CommunityIssues','ReportDetails') DetailsColumn,CASE WHEN IS_MEMBER('db_owner')=1 OR HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL')=1 THEN 1 ELSE 0 END CanMigrate`)).recordset[0];
 if(!(c?.IssuesTable&&c?.UpdatesTable&&c?.DetailsColumn!=null)){
  if(c?.CanMigrate!==1)throw new Error('Issue schema is missing or hidden. No schema changes attempted. Database diagnostics: '+JSON.stringify(c)+'. A database administrator must apply backend/sql/issue-report-details.sql in this database and grant this DatabaseUser SELECT, INSERT, UPDATE on dbo.CommunityIssues and dbo.CommunityIssueUpdates.');
  const tx=new sql.Transaction(pool);await tx.begin();try{for(const batch of (await load()).split(/^GO\s*$/im).filter(s=>s.trim()))await new sql.Request(tx).batch(batch);await tx.commit()}catch(e){await tx.rollback().catch(()=>{});throw e}
 }
 await pool.request().query('SELECT TOP 0 Id,ReportDetails,Status,ResolutionNote FROM dbo.CommunityIssues; SELECT TOP 0 Id,IssueId,Note FROM dbo.CommunityIssueUpdates;');
 return 'Issue report schema ready; runtime access verified.';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let pool:sql.ConnectionPool|undefined;
 try{pool=await getPool();console.log(await ensureIssueSchema(pool,()=>readFile(new URL('../sql/issue-report-details.sql',import.meta.url),'utf8')))}
 catch(error){console.error('Issue schema verification failed; release was not switched.',error instanceof Error?error.message:error);process.exitCode=1}
 finally{await pool?.close()}
}
