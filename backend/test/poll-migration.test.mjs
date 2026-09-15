import test from 'node:test';
import assert from 'node:assert/strict';
Object.assign(process.env,{NODE_ENV:'test',DB_SERVER:'localhost',DB_NAME:'test',DB_USER:'test',DB_PASSWORD:'test',JWT_ACCESS_SECRET:'a'.repeat(64),JWT_REFRESH_SECRET:'b'.repeat(64)});
const {ensurePollSchema}=await import('../dist/migratePolls.js');
const ready={CommentsTable:4,PollsTable:1,OptionsTable:2,VotesTable:3,SettingsColumn:-1,RequestColumn:16,OtherColumn:1000,CanMigrate:0};
test('installed poll schema verifies without ALTER',async()=>{let n=0;const pool={request:()=>({query:async()=>({recordset:[n++===0?ready:{}]})})};await ensurePollSchema(pool,()=>{throw Error('No DDL allowed')});assert.equal(n,2)});
test('restricted account gets diagnostics without attempting ALTER',async()=>{const pool={request:()=>({query:async()=>({recordset:[{CanMigrate:0,DatabaseName:'CDAConnect',DatabaseUser:'community_app'}]})})};await assert.rejects(ensurePollSchema(pool,()=>{throw Error('No DDL allowed')}),/No ALTER was attempted.*community_app/)});
test('missing base tables fail even for administrator',async()=>{const pool={request:()=>({query:async()=>({recordset:[{CanMigrate:1}]})})};await assert.rejects(ensurePollSchema(pool,()=>{throw Error('No DDL allowed')}),/Base poll tables are missing/)});
test('administrator installs missing columns then verifies',async()=>{let applied=false,verified=false;const pool={request:()=>({query:async text=>{if(text.includes('DatabaseName'))return {recordset:[{...ready,SettingsColumn:null,CanMigrate:1}]};verified=true;return{recordset:[]}},batch:async text=>{assert.equal(text,'migration');applied=true}})};await ensurePollSchema(pool,async()=> 'migration');assert.ok(applied&&verified)});
