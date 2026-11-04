import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';
import {memberApprovalSql} from './permissions.js';

export async function reviewCommunityJoin(actor:string,communityId:string,requestId:string,decision:unknown){
 const outcome=z.enum(['APPROVE','REJECT']).parse(decision);
 z.string().uuid().parse(communityId);z.string().uuid().parse(requestId);
 const pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
  // Match the join-request lock order: community, then membership/request state.
  const community=(await new sql.Request(tx).input('c',sql.UniqueIdentifier,communityId).query('SELECT Name,PlatformStatus FROM Communities WITH(UPDLOCK,HOLDLOCK) WHERE Id=@c')).recordset[0];
  if(!community)throw new AppError(404,'Community not found');
  if(community.PlatformStatus!=='ACTIVE')throw new AppError(423,'This community is not accepting membership changes');
  const permission=(await new sql.Request(tx).input('u',sql.UniqueIdentifier,actor).input('c',sql.UniqueIdentifier,communityId).query(memberApprovalSql)).recordset[0];
  if(!permission)throw new AppError(403,'Missing permission: MEMBER_APPROVE');
  const pending=(await new sql.Request(tx).input('r',sql.UniqueIdentifier,requestId).input('c',sql.UniqueIdentifier,communityId).query(`SELECT jr.UserId,u.AccountStatus,CONCAT(u.FirstName,' ',u.LastName) MemberName FROM CommunityJoinRequests jr WITH(UPDLOCK,HOLDLOCK) JOIN Users u ON u.Id=jr.UserId WHERE jr.Id=@r AND jr.CommunityId=@c AND jr.Status='PENDING'`)).recordset[0];
  if(!pending)throw new AppError(409,'This join request is no longer pending. Refresh the requests list.');
  const userId=String(pending.UserId);
  if(outcome==='APPROVE'){
   if(pending.AccountStatus!=='ACTIVE')throw new AppError(409,'This account is not active and cannot join the community');
   const membership=(await new sql.Request(tx).input('c',sql.UniqueIdentifier,communityId).input('u',sql.UniqueIdentifier,userId).query('SELECT Id,Status FROM CommunityMembers WITH(UPDLOCK,HOLDLOCK) WHERE CommunityId=@c AND UserId=@u')).recordset[0];
   if(membership&&!['LEFT','INACTIVE','PENDING'].includes(membership.Status))throw new AppError(409,membership.Status==='ACTIVE'?'This person is already a member':'Lift this member ban before approving a join request');
   const member=(await new sql.Request(tx).input('c',sql.UniqueIdentifier,communityId).input('u',sql.UniqueIdentifier,userId).query(`IF EXISTS(SELECT 1 FROM CommunityMembers WHERE CommunityId=@c AND UserId=@u) BEGIN UPDATE CommunityMembers SET Status='ACTIVE',JoinedAt=SYSUTCDATETIME() WHERE CommunityId=@c AND UserId=@u; SELECT Id FROM CommunityMembers WHERE CommunityId=@c AND UserId=@u; END ELSE INSERT INTO CommunityMembers(CommunityId,UserId) OUTPUT INSERTED.Id VALUES(@c,@u)`)).recordset[0];
   await new sql.Request(tx).input('m',sql.UniqueIdentifier,member.Id).query(`DELETE FROM CommunityMemberRoles WHERE CommunityMemberId=@m; INSERT INTO CommunityMemberRoles(CommunityMemberId,RoleId) SELECT @m,Id FROM Roles WHERE Name='Member'`);
   await new sql.Request(tx).input('c',sql.UniqueIdentifier,communityId).input('u',sql.UniqueIdentifier,userId).query(`UPDATE member SET IsActive=1 FROM ConversationMembers member JOIN Conversations cv ON cv.Id=member.ConversationId WHERE cv.CommunityId=@c AND cv.Type='COMMUNITY' AND member.UserId=@u; INSERT INTO ConversationMembers(ConversationId,UserId) SELECT cv.Id,@u FROM Conversations cv WHERE cv.CommunityId=@c AND cv.Type='COMMUNITY' AND NOT EXISTS(SELECT 1 FROM ConversationMembers x WHERE x.ConversationId=cv.Id AND x.UserId=@u)`);
  }
  const status=outcome==='APPROVE'?'APPROVED':'REJECTED';
  const reviewed=await new sql.Request(tx).input('r',sql.UniqueIdentifier,requestId).input('c',sql.UniqueIdentifier,communityId).input('a',sql.UniqueIdentifier,actor).input('s',sql.NVarChar(30),status).query(`UPDATE CommunityJoinRequests SET Status=@s,ReviewedBy=@a,ReviewedAt=SYSUTCDATETIME() OUTPUT INSERTED.Id WHERE Id=@r AND CommunityId=@c AND Status='PENDING'`);
  if(!reviewed.recordset.length)throw new AppError(409,'This join request is no longer pending');
  await new sql.Request(tx).input('c',sql.UniqueIdentifier,communityId).input('u',sql.UniqueIdentifier,actor).input('id',sql.UniqueIdentifier,requestId).input('action',sql.NVarChar(100),outcome==='APPROVE'?'JOIN_REQUEST_APPROVED':'JOIN_REQUEST_REJECTED').query(`INSERT INTO AuditLogs(CommunityId,UserId,Action,EntityType,EntityId) VALUES(@c,@u,@action,'CommunityJoinRequest',@id)`);
  await tx.commit();return{status,userId,communityName:String(community.Name),memberName:String(pending.MemberName)};
 }catch(error){await tx.rollback();throw error}
}
