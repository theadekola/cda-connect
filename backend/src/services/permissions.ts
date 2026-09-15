import { sql } from '../config/db.js';
import { getCommunityPool } from '../config/communityDb.js';
import { AppError } from '../utils/errors.js';

export async function requireCommunityMember(userId: string, communityId: string) {
  const pool = await getCommunityPool(communityId);
  const r = await pool.request().input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId)
    .query(`SELECT TOP 1 Id FROM CommunityMembers WHERE UserId=@u AND CommunityId=@c AND Status='ACTIVE'`);
  if (!r.recordset[0]) throw new AppError(403,'You are not an active member of this community');
  return r.recordset[0].Id as string;
}
export async function hasPermission(userId: string, communityId: string, permission: string) {
  const pool=await getCommunityPool(communityId);
  if(permission==='ATTENDANCE_MANAGE'||permission==='MEMBER_APPROVE'){
    const result=await pool.request().input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId).query(`SELECT TOP 1 1 ok FROM CommunityMembers cm JOIN Communities c ON c.Id=cm.CommunityId WHERE cm.UserId=@u AND cm.CommunityId=@c AND cm.Status='ACTIVE' AND (c.OwnerUserId=@u OR EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN Roles r ON r.Id=mr.RoleId WHERE mr.CommunityMemberId=cm.Id AND r.Name IN ('Owner','Admin','Moderator')) OR EXISTS(SELECT 1 FROM CommunityExecutiveMembers ex WHERE ex.CommunityId=@c AND ex.UserId=@u AND ex.Status='ACTIVE' AND ex.AppointedDate<=CONVERT(date,SYSUTCDATETIME()) AND (ex.TenureEndDate IS NULL OR ex.TenureEndDate>=CONVERT(date,SYSUTCDATETIME()))))`);
    return !!result.recordset[0];
  }

  const r=await pool.request().input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId).input('p',sql.NVarChar(100),permission).query(`
    SELECT TOP 1 1 ok
    FROM CommunityMembers cm
    JOIN Communities community ON community.Id=cm.CommunityId
    JOIN CommunityMemberRoles cmr ON cmr.CommunityMemberId=cm.Id
    JOIN Roles r ON r.Id=cmr.RoleId
    LEFT JOIN RolePermissions rp ON rp.RoleId=cmr.RoleId
    LEFT JOIN Permissions p ON p.Id=rp.PermissionId
    WHERE cm.UserId=@u AND cm.CommunityId=@c AND cm.Status='ACTIVE'
      AND (
        p.Code=@p
        OR community.OwnerUserId=@u
        OR r.Name IN ('Owner','Admin')
        OR (@p IN ('MEMBER_ROLE_CHANGE','MEMBER_REMOVE') AND r.Name IN ('Owner','Admin','Moderator'))
      )`);
  return !!r.recordset[0];
}
export async function requirePermission(userId:string, communityId:string, permission:string){
  const memberContributionPermissions=new Set(['CHAT_CREATE','EVENT_CREATE','OPPORTUNITY_MANAGE']);
  if(memberContributionPermissions.has(permission)){
    await requireCommunityMember(userId,communityId);
    if(permission==='CHAT_CREATE'||permission==='EVENT_CREATE'){
      const pool=await getCommunityPool(communityId);const r=await pool.request().input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId).input('p',sql.NVarChar(100),permission).query(`SELECT TOP 1 1 ok FROM Communities c WHERE c.Id=@c AND (c.OwnerUserId=@u OR EXISTS(SELECT 1 FROM CommunityMembers m JOIN CommunityMemberRoles mr ON mr.CommunityMemberId=m.Id JOIN Roles role ON role.Id=mr.RoleId WHERE m.CommunityId=@c AND m.UserId=@u AND m.Status='ACTIVE' AND role.Name IN ('Owner','Admin')) OR (@p='EVENT_CREATE' AND c.AllowMemberEvents=1) OR (@p='CHAT_CREATE' AND c.AllowMemberDiscussions=1))`);
      if(!r.recordset[0])throw new AppError(403,'Community preferences do not allow members to create this content');
    }
    return;
  }
  if(!(await hasPermission(userId,communityId,permission))) throw new AppError(403,`Missing permission: ${permission}`);
}
