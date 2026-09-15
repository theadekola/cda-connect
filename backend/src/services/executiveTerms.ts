import {getPool,sql} from '../config/db.js';
// A term remains current through its end date (UTC); history is never deleted.
export async function expireExecutiveTerms(communityId?:string){const pool=await getPool();return pool.request().input('community',sql.UniqueIdentifier,communityId??null).query(`UPDATE CommunityExecutiveMembers SET Status='INACTIVE',UpdatedAt=SYSUTCDATETIME() WHERE Status='ACTIVE' AND TenureEndDate IS NOT NULL AND TenureEndDate<CAST(SYSUTCDATETIME() AS DATE) AND (@community IS NULL OR CommunityId=@community)`)}
