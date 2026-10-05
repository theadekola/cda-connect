import {getPool,sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';
export type FinancePermission='PAYMENT_REVIEW'|'PAYMENT_EVIDENCE_VIEW'|'LEVY_MANAGE'|'FINANCE_MANAGE'|'FINANCE_VIEW'|'BANK_ACCOUNT_MANAGE';
const activeExco=`ex.CommunityId=@c AND ex.UserId=@u AND ex.Status='ACTIVE' AND ex.AppointedDate<=CONVERT(date,SYSUTCDATETIME()) AND (ex.TenureEndDate IS NULL OR ex.TenureEndDate>=CONVERT(date,SYSUTCDATETIME()))`;
export async function hasFinancePermission(userId:string,communityId:string,permission:FinancePermission,tx?:sql.Transaction){
 const request=tx?new sql.Request(tx):(await getPool()).request();
 const result=await request.input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId).input('permission',sql.NVarChar(100),permission).query(`SELECT TOP 1 1 Allowed FROM CommunityMembers cm JOIN Communities c ON c.Id=cm.CommunityId JOIN Users account ON account.Id=cm.UserId WHERE cm.CommunityId=@c AND cm.UserId=@u AND cm.Status='ACTIVE' AND account.AccountStatus='ACTIVE' AND (
 c.OwnerUserId=@u OR EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN Roles r ON r.Id=mr.RoleId WHERE mr.CommunityMemberId=cm.Id AND r.Name IN('Owner','Admin'))
 OR EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN RolePermissions rp ON rp.RoleId=mr.RoleId JOIN Permissions p ON p.Id=rp.PermissionId WHERE mr.CommunityMemberId=cm.Id AND p.Code=@permission)
 OR (@permission IN('PAYMENT_REVIEW','PAYMENT_EVIDENCE_VIEW') AND (EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN Roles r ON r.Id=mr.RoleId WHERE mr.CommunityMemberId=cm.Id AND r.Name='Moderator') OR EXISTS(SELECT 1 FROM CommunityExecutiveMembers ex WHERE ${activeExco})))
 OR (@permission='PAYMENT_EVIDENCE_VIEW' AND EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN RolePermissions rp ON rp.RoleId=mr.RoleId JOIN Permissions p ON p.Id=rp.PermissionId WHERE mr.CommunityMemberId=cm.Id AND p.Code='PAYMENT_REVIEW'))
 OR (@permission IN('LEVY_MANAGE','FINANCE_VIEW') AND EXISTS(SELECT 1 FROM CommunityExecutiveMembers ex WHERE ${activeExco} AND LOWER(LTRIM(RTRIM(ex.Position))) IN('treasurer','financial secretary')))
 )`);return !!result.recordset[0];
}
export const canReviewPayments=(userId:string,communityId:string,tx?:sql.Transaction)=>hasFinancePermission(userId,communityId,'PAYMENT_REVIEW',tx);
export async function requireFinancePermission(userId:string,communityId:string,permission:FinancePermission,tx?:sql.Transaction){if(!await hasFinancePermission(userId,communityId,permission,tx))throw new AppError(403,'Missing permission: '+permission)}
export async function paymentReviewerRoles(userId:string,communityId:string,tx:sql.Transaction){
 const result=await new sql.Request(tx).input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId).query(`SELECT 'Owner' RoleName FROM Communities WHERE Id=@c AND OwnerUserId=@u UNION SELECT r.Name RoleName FROM CommunityMembers cm JOIN CommunityMemberRoles mr ON mr.CommunityMemberId=cm.Id JOIN Roles r ON r.Id=mr.RoleId WHERE cm.CommunityId=@c AND cm.UserId=@u AND cm.Status='ACTIVE' UNION SELECT CONCAT('EXCO: ',ex.Position) RoleName FROM CommunityExecutiveMembers ex WHERE ${activeExco}`);
 return result.recordset.map((r:{RoleName:string})=>r.RoleName);
}
