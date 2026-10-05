import {getPool,sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';
// Every read path binds @u and aliases the document as d. Role restrictions apply even to admins.
export const documentVisibility=`d.IsArchived=0 AND EXISTS (
 SELECT 1 FROM CommunityMembers viewerMember
 JOIN Users viewer ON viewer.Id=viewerMember.UserId AND viewer.AccountStatus='ACTIVE'
 JOIN Communities viewerCommunity ON viewerCommunity.Id=viewerMember.CommunityId
 WHERE viewerMember.CommunityId=d.CommunityId AND viewerMember.UserId=@u AND viewerMember.Status='ACTIVE'
 AND (d.Visibility='MEMBERS' OR (d.Visibility='ADMINS' AND (
 viewerCommunity.OwnerUserId=@u OR EXISTS(SELECT 1 FROM CommunityMemberRoles mr
 JOIN Roles role ON role.Id=mr.RoleId LEFT JOIN RolePermissions rp ON rp.RoleId=mr.RoleId
 LEFT JOIN Permissions permission ON permission.Id=rp.PermissionId
 WHERE mr.CommunityMemberId=viewerMember.Id AND (role.Name IN('Owner','Admin') OR permission.Code='DOCUMENT_MANAGE')))))
 AND (NOT EXISTS(SELECT 1 FROM KnowledgeDocumentAccess WHERE DocumentId=d.Id)
 OR EXISTS(SELECT 1 FROM KnowledgeDocumentAccess accessRule JOIN CommunityMemberRoles accessRole
 ON accessRole.RoleId=accessRule.RoleId AND accessRole.CommunityMemberId=viewerMember.Id
 WHERE accessRule.DocumentId=d.Id AND accessRule.CanView=1)))`;
export async function requireDocumentView(userId:string,documentId:string){
 const p=await getPool(),document=(await p.request().input('id',sql.UniqueIdentifier,documentId).input('u',sql.UniqueIdentifier,userId)
 .query(`SELECT d.* FROM KnowledgeDocuments d WHERE d.Id=@id AND ${documentVisibility}`)).recordset[0];
 if(!document)throw new AppError(404,'Document not found');return document;
}
