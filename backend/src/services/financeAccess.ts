import {getPool,sql} from '../config/db.js';
export async function canManageFinance(userId:string,communityId:string){
 const pool=await getPool();const result=await pool.request().input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId).query(`SELECT TOP 1 1 Allowed FROM CommunityMembers cm JOIN Communities c ON c.Id=cm.CommunityId WHERE cm.CommunityId=@c AND cm.UserId=@u AND cm.Status='ACTIVE' AND (c.OwnerUserId=@u OR EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN Roles r ON r.Id=mr.RoleId WHERE mr.CommunityMemberId=cm.Id AND r.Name IN ('Owner','Admin','Moderator')) OR EXISTS(SELECT 1 FROM CommunityExecutiveMembers ex WHERE ex.CommunityId=@c AND ex.UserId=@u AND ex.Status='ACTIVE' AND ex.AppointedDate<=CONVERT(date,SYSUTCDATETIME()) AND (ex.TenureEndDate IS NULL OR ex.TenureEndDate>=CONVERT(date,SYSUTCDATETIME()))))`);
 return !!result.recordset[0];
}
