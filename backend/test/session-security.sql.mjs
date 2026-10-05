import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
if(process.env.SQL_TEST_MODE!=='1'||!process.env.DB_NAME?.endsWith('Test'))throw Error('Disposable SQL test database required');
Object.assign(process.env,{NODE_ENV:'test',JWT_ACCESS_SECRET:'ci-access-secret-'.repeat(4),JWT_REFRESH_SECRET:'ci-refresh-secret-'.repeat(4)});
const {getPool,sql}=await import('../dist/config/db.js'),{rotateSession}=await import('../dist/services/refreshSession.js'),{signRefresh,hashToken}=await import('../dist/utils/auth.js');
test('real SQL serializes concurrent refreshes and revokes a replayed family',async()=>{const pool=await getPool(),id=randomUUID(),family=randomUUID(),token=signRefresh({id,email:'test@example.test',sessionId:family});try{
 await pool.request().input('id',sql.UniqueIdentifier,id).input('email',sql.NVarChar(255),id+'@example.test').query("INSERT INTO Users(Id,FirstName,LastName,Email,PasswordHash) VALUES(@id,'CI','Member',@email,'unused-test-hash')");
 await pool.request().input('u',sql.UniqueIdentifier,id).input('f',sql.UniqueIdentifier,family).input('h',sql.NVarChar(64),hashToken(token)).query('INSERT INTO UserSessions(UserId,FamilyId,RefreshTokenHash,ExpiresAt) VALUES(@u,@f,@h,DATEADD(day,1,SYSUTCDATETIME()))');
 const results=await Promise.allSettled([rotateSession(token),rotateSession(token)]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
 const active=await pool.request().input('f',sql.UniqueIdentifier,family).query('SELECT COUNT(*) Count FROM UserSessions WHERE FamilyId=@f AND RevokedAt IS NULL');assert.equal(active.recordset[0].Count,0);
 await assert.rejects(pool.request().query("UPDATE SchemaMigrations SET Mode='TAMPERED' WHERE 1=0"));await assert.rejects(pool.request().query('CREATE TABLE dbo.ForbiddenRuntimeDDL(Id int)'));
 }finally{await pool.request().input('id',sql.UniqueIdentifier,id).query('DELETE FROM UserSessions WHERE UserId=@id;DELETE FROM Users WHERE Id=@id');await pool.close()}});
