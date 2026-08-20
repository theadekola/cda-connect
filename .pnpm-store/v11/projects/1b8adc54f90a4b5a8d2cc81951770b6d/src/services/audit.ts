import { getPool, sql } from '../config/db.js';
export async function audit(communityId: string|null, userId: string, action: string, entityType: string, entityId?: string|null, details?: unknown) {
  const pool = await getPool();
  await pool.request()
    .input('CommunityId', sql.UniqueIdentifier, communityId)
    .input('UserId', sql.UniqueIdentifier, userId)
    .input('Action', sql.NVarChar(200), action)
    .input('EntityType', sql.NVarChar(100), entityType)
    .input('EntityId', sql.UniqueIdentifier, entityId ?? null)
    .input('Details', sql.NVarChar(sql.MAX), details ? JSON.stringify(details) : null)
    .query(`INSERT INTO AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(@CommunityId,@UserId,@Action,@EntityType,@EntityId,@Details)`);
}
