import {z} from 'zod';
import {getPool,sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';

export const groupCreationInput=z.object({name:z.string().trim().min(2).max(200),type:z.literal('GROUP').default('GROUP'),memberUserIds:z.array(z.string().uuid()).min(1).max(99)});
export async function createChatGroup(userId:string,communityId:string,body:unknown){
 const data=groupCreationInput.parse(body),actor=userId.toLowerCase(),members=[...new Set(data.memberUserIds.map(id=>id.toLowerCase()))].filter(id=>id!==actor);
 if(!members.length)throw new AppError(400,'Select at least one other active community member.');
 const pool=await getPool(),tx=new sql.Transaction(pool);await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
 try{
  // Serialize account-wide quotas and community-wide duplicate names in the same lock order.
  for(const resource of ['group-create-user:'+actor,'group-create-community:'+communityId.toLowerCase()])await new sql.Request(tx).input('resource',sql.NVarChar(255),resource).query(`DECLARE @result int;EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;IF @result<0 THROW 50001,'Group creation is busy, retry',1;`);
  const creator=(await new sql.Request(tx).input('u',sql.UniqueIdentifier,actor).input('c',sql.UniqueIdentifier,communityId).query(`SELECT TOP 1 u.EmailVerified,u.AccountStatus,c.PlatformStatus,
   CASE WHEN c.OwnerUserId=@u OR c.AllowMemberDiscussions=1 OR EXISTS(SELECT 1 FROM CommunityMemberRoles mr JOIN Roles r ON r.Id=mr.RoleId WHERE mr.CommunityMemberId=m.Id AND r.Name IN('Owner','Admin')) THEN 1 ELSE 0 END CanCreate
   FROM Users u WITH(HOLDLOCK) JOIN CommunityMembers m WITH(HOLDLOCK) ON m.UserId=u.Id AND m.CommunityId=@c AND m.Status='ACTIVE' JOIN Communities c WITH(HOLDLOCK) ON c.Id=m.CommunityId WHERE u.Id=@u`)).recordset[0];
  if(!creator||creator.AccountStatus!=='ACTIVE'||!creator.EmailVerified||!creator.CanCreate)throw new AppError(403,'Group creation requires a verified active account and permission from the community.');
  if(creator.PlatformStatus!=='ACTIVE')throw new AppError(423,'This community must be approved and active before creating groups.');
  const usage=(await new sql.Request(tx).input('u',sql.UniqueIdentifier,actor).query(`SELECT COUNT(*) CreatedToday FROM Conversations WHERE CreatedBy=@u AND Type='GROUP' AND CreatedAt>DATEADD(hour,-24,SYSUTCDATETIME())`)).recordset[0];
  if(Number(usage?.CreatedToday||0)>=3)throw new AppError(429,'You can create up to three chat groups in 24 hours. Please try again later.');
  const duplicate=(await new sql.Request(tx).input('c',sql.UniqueIdentifier,communityId).input('name',sql.NVarChar(200),data.name).query(`SELECT TOP 1 Id FROM Conversations WHERE CommunityId=@c AND Type='GROUP' AND LOWER(LTRIM(RTRIM(Name)))=LOWER(LTRIM(RTRIM(@name)))`)).recordset[0];
  if(duplicate)throw new AppError(409,'A chat group with this name already exists in this community.');
  const available=(await new sql.Request(tx).input('c',sql.UniqueIdentifier,communityId).input('u',sql.UniqueIdentifier,actor).input('members',sql.NVarChar(sql.MAX),JSON.stringify(members)).query(`SELECT m.UserId FROM CommunityMembers m WITH(HOLDLOCK) JOIN Users u WITH(HOLDLOCK) ON u.Id=m.UserId AND u.AccountStatus='ACTIVE'
   WHERE m.CommunityId=@c AND m.Status='ACTIVE' AND m.UserId IN(SELECT TRY_CONVERT(uniqueidentifier,value) FROM OPENJSON(@members))
   AND NOT EXISTS(SELECT 1 FROM BlockedUsers b WHERE (b.UserId=@u AND b.BlockedUserId=m.UserId) OR (b.UserId=m.UserId AND b.BlockedUserId=@u))
   AND NOT EXISTS(SELECT 1 FROM HiddenUsers h WHERE h.UserId=m.UserId AND h.HiddenUserId=@u)`)).recordset;
  const allowed=new Set(available.map(row=>String(row.UserId).toLowerCase()));
  if(members.some(id=>!allowed.has(id)))throw new AppError(403,'One or more selected members are unavailable for this group. Review your selection.');
  const conversation=(await new sql.Request(tx).input('c',sql.UniqueIdentifier,communityId).input('n',sql.NVarChar(200),data.name).input('u',sql.UniqueIdentifier,actor).query(`INSERT INTO Conversations(CommunityId,Name,Type,CreatedBy) OUTPUT INSERTED.* VALUES(@c,@n,'GROUP',@u)`)).recordset[0];
  for(const id of [actor,...members])await new sql.Request(tx).input('cv',sql.UniqueIdentifier,conversation.Id).input('u',sql.UniqueIdentifier,id).query('INSERT INTO ConversationMembers(ConversationId,UserId) VALUES(@cv,@u)');
  await new sql.Request(tx).input('c',sql.UniqueIdentifier,communityId).input('u',sql.UniqueIdentifier,actor).input('id',sql.UniqueIdentifier,conversation.Id).input('details',sql.NVarChar(sql.MAX),JSON.stringify({memberCount:members.length+1})).query(`INSERT INTO AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(@c,@u,'CHAT_GROUP_CREATED','Conversation',@id,@details)`);
  await tx.commit();return{conversation,memberUserIds:members};
 }catch(error){await tx.rollback();throw error}
}
