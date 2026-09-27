import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('audit identifiers are additive, indexed and keep UUID relationships intact',async()=>{
 const sql=await readFile(new URL('../sql/audit-identifiers.sql',import.meta.url),'utf8');
 for(const table of ['Users','Communities','LevyPaymentSubmissions']){
  assert.match(sql,new RegExp(`ALTER TABLE dbo\\.${table} ADD AuditId BIGINT IDENTITY\\(1,1\\) NOT NULL`));
  assert.match(sql,new RegExp(`CREATE UNIQUE NONCLUSTERED INDEX UX_${table}_AuditId`));
 }
 assert.doesNotMatch(sql,/DROP\s+(?:COLUMN|CONSTRAINT|TABLE|INDEX)/i);
 assert.doesNotMatch(sql,/ALTER\s+COLUMN\s+Id/i);
});

test('audit views use numeric identifiers and exclude authentication and evidence secrets',async()=>{
 const sql=await readFile(new URL('../sql/audit-identifiers.sql',import.meta.url),'utf8');
 for(const view of ['AuditUsers','AuditCommunities','AuditContributions']){
  assert.match(sql,new RegExp(`CREATE OR ALTER VIEW dbo\\.${view}`));
  assert.match(sql,new RegExp(`GRANT SELECT ON dbo\\.${view} TO cda_audit_reader`));
 }
 assert.match(sql,/CREATE ROLE cda_audit_reader/);
 const views=sql.slice(sql.indexOf('CREATE OR ALTER VIEW dbo.AuditUsers'));
 assert.doesNotMatch(views,/PasswordHash|TwoFactorSecret|EvidenceUrl/);
});
