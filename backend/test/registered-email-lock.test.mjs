import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';

const migrationUrl=new URL('../sql/registered-email-lock.sql',import.meta.url);
const migration=fs.readFileSync(migrationUrl,'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../sql/migrations.json',import.meta.url),'utf8'));

test('registered email lock applies to every existing account while preserving erasure anonymisation',()=>{
 assert.match(migration,/ISNULL\(newRow\.Email,''\)<>ISNULL\(oldRow\.Email,''\)/);
 assert.doesNotMatch(migration,/IsProtectedAccount=1\s+AND ISNULL\(newRow\.Email/);
 assert.match(migration,/newRow\.AccountStatus='DELETED'/);
 assert.match(migration,/deleted-%@deleted\.invalid/);
 assert.match(migration,/newRow\.IsProtectedAccount<>1 OR newRow\.IsSuperAdmin<>1 OR newRow\.AccountStatus<>'ACTIVE'/);
});

test('registered email lock migration is the next immutable manifest entry',()=>{
 const entry=manifest.find(item=>item.version==='0050');
 assert.equal(entry?.file,'registered-email-lock.sql');
 assert.equal(entry?.sha256,crypto.createHash('sha256').update(fs.readFileSync(migrationUrl)).digest('hex'));
});
