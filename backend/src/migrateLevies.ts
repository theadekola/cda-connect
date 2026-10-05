import {readFile} from 'node:fs/promises';
import {getPool} from './config/db.js';
const pool=await getPool();try{
 const c=(await pool.request().query(`SELECT DB_NAME() DatabaseName,USER_NAME() DatabaseUser,COL_LENGTH('dbo.MemberDuesPlans','AllowPartial') PartialColumn,COL_LENGTH('dbo.MemberDuesPlans','LatePenalty') PenaltyColumn,COL_LENGTH('dbo.MemberDuesPlans','DueDay') DayColumn,COL_LENGTH('dbo.MemberDuesLedger','CycleDate') CycleColumn,COL_LENGTH('dbo.MemberDuesLedger','PenaltyApplied') AppliedColumn,OBJECT_ID('dbo.CommunityPaymentAccounts','U') AccountsTable,CASE WHEN EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('dbo.MemberDuesLedger') AND name='UX_Dues_Cycle') THEN 1 ELSE 0 END CycleIndex,IS_MEMBER('db_owner') CanMigrate`)).recordset[0];
 if(!(c.PartialColumn&&c.PenaltyColumn&&c.DayColumn&&c.CycleColumn&&c.AppliedColumn&&c.AccountsTable&&c.CycleIndex)){
  if(c.CanMigrate!==1)throw Error('A database administrator must apply backend/sql/levy-flow.sql and grant the app account SELECT, INSERT, UPDATE on CommunityPaymentAccounts and access to the existing finance tables. No ALTER attempted. Diagnostics: '+JSON.stringify(c));
  for(const batch of (await readFile(new URL('../sql/levy-flow.sql',import.meta.url),'utf8')).split(/^GO\s*$/im).filter(x=>x.trim()))await pool.request().batch(batch);
 }
 await pool.request().query('SELECT TOP 0 AllowPartial,LatePenalty,DueDay FROM MemberDuesPlans;SELECT TOP 0 CycleDate,PenaltyApplied FROM MemberDuesLedger;SELECT TOP 0 BankName FROM CommunityPaymentAccounts');console.log('Levy flow schema ready; runtime access verified.');
}catch(e){console.error(e);process.exitCode=1}finally{await pool.close()}
