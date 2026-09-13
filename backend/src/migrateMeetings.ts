import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {getPool,sql} from './config/db.js';

// This fixed v1 migration may already have been applied by a database administrator.
// The runtime account should not need ALTER permission on every deployment.
const readinessQuery=`SELECT CASE WHEN
 COL_LENGTH('dbo.Meetings','SettingsJson') IS NOT NULL
 AND COL_LENGTH('dbo.Meetings','CreateRequestId') IS NOT NULL
 AND COL_LENGTH('dbo.MeetingAgendaItems','DurationMinutes') IS NOT NULL
 AND OBJECT_ID('dbo.MeetingContributions','U') IS NOT NULL
 AND OBJECT_ID('dbo.MeetingAgendaVotes','U') IS NOT NULL
 AND OBJECT_ID('dbo.CanViewMeeting','FN') IS NOT NULL
 AND OBJECT_ID('dbo.CanAttendMeeting','FN') IS NOT NULL
 AND EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.Meetings') AND name='UX_Meetings_CreateRequest' AND is_unique=1 AND is_disabled=0)
 THEN 1 ELSE 0 END Ready`;
async function verifyRuntimeAccess(pool:sql.ConnectionPool){
 // Compile the required columns and call the functions using the actual app account.
 await pool.request().query(`SELECT TOP 0 Id,MeetingId,UserId,Kind,Body,CreatedAt FROM dbo.MeetingContributions;
 SELECT TOP 0 AgendaId,UserId,Choice FROM dbo.MeetingAgendaVotes;
 SELECT TOP 0 SettingsJson,CreateRequestId FROM dbo.Meetings;
 SELECT dbo.CanViewMeeting(NULL,NULL) CanView,dbo.CanAttendMeeting(NULL,NULL) CanAttend;`);
}
export async function ensureMeetingSchema(pool:sql.ConnectionPool,loadMigration:()=>Promise<string>){
 const ready=(await pool.request().query(readinessQuery)).recordset[0]?.Ready;
 if(ready===1){await verifyRuntimeAccess(pool);return 'verified' as const;}
 const context=(await pool.request().query(`SELECT DB_NAME() DatabaseName,USER_NAME() DatabaseUser,
 OBJECT_ID('dbo.CanViewMeeting','FN') ViewFunction,OBJECT_ID('dbo.CanAttendMeeting','FN') AttendFunction,
 COL_LENGTH('dbo.Meetings','SettingsJson') SettingsColumn,COL_LENGTH('dbo.Meetings','CreateRequestId') RequestColumn,
 OBJECT_ID('dbo.MeetingContributions','U') ContributionsTable,OBJECT_ID('dbo.MeetingAgendaVotes','U') VotesTable,
 CASE WHEN IS_MEMBER('db_owner')=1 OR HAS_PERMS_BY_NAME(DB_NAME(),'DATABASE','CONTROL')=1 THEN 1 ELSE 0 END CanMigrate`)).recordset[0];
 if(context?.CanMigrate!==1)throw new Error('Meeting schema is incomplete or hidden from the app account. No ALTER was attempted. Database diagnostics: '+JSON.stringify(context)+'. An administrator must apply meeting-wizard.sql and grant EXECUTE on dbo.CanViewMeeting and dbo.CanAttendMeeting, plus access to the meeting tables, to this DatabaseUser.');
 const migration=await loadMigration(),tx=new sql.Transaction(pool);let begun=false;
 try{await tx.begin();begun=true;for(const batch of migration.split(/^GO\s*$/im).filter(s=>s.trim()))await new sql.Request(tx).batch(batch);await tx.commit();begun=false;}
 catch(error){if(begun)await tx.rollback().catch(()=>{});throw error;}
 await verifyRuntimeAccess(pool);return 'installed' as const;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 let pool:sql.ConnectionPool|undefined;
 try{pool=await getPool();const result=await ensureMeetingSchema(pool,()=>readFile(new URL('../sql/meeting-wizard.sql',import.meta.url),'utf8'));console.log(result==='verified'?'Meeting wizard schema already installed; runtime access verified.':'Meeting wizard schema installed and verified.');}
 catch(error){console.error('Meeting schema verification failed; the application release was not switched. If the schema is missing, have a database administrator run backend/sql/meeting-wizard.sql in the configured application database. The app account also needs access to the meeting tables and functions.',error);process.exitCode=1;}
 finally{await pool?.close();}
}
