import {getPool,sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';
export async function requestCommunityJoin(userId:string,communityId:string,message?:string){
 const result=await(await getPool()).request().input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId).input('message',sql.NVarChar(500),message??null).query(`SET XACT_ABORT ON;BEGIN TRANSACTION;
 DECLARE @approval bit,@private bit,@name nvarchar(200),@state nvarchar(30),@mid uniqueidentifier;
 SELECT @approval=RequireMemberApproval,@private=IsPrivate,@name=Name FROM Communities WITH(UPDLOCK,HOLDLOCK) WHERE Id=@c;
 SELECT @state=Status,@mid=Id FROM CommunityMembers WITH(UPDLOCK,HOLDLOCK) WHERE CommunityId=@c AND UserId=@u;
 IF @name IS NULL SELECT 'MISSING' Result;
 ELSE IF @state='ACTIVE' SELECT 'ACTIVE' Result,@c Id,@name Name;
 ELSE IF @state IS NOT NULL AND @state NOT IN('LEFT','INACTIVE','PENDING') SELECT 'BLOCKED' Result;
 ELSE IF COALESCE(@approval,1)=1 OR @private=1 BEGIN
 MERGE CommunityJoinRequests WITH(HOLDLOCK) t USING(SELECT @c CommunityId,@u UserId)s ON t.CommunityId=s.CommunityId AND t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET Status='PENDING',Message=@message,ReviewedBy=NULL,ReviewedAt=NULL,CreatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(CommunityId,UserId,Message) VALUES(@c,@u,@message);
 SELECT 'PENDING' Result,@c Id,@name Name;
 END ELSE BEGIN
 IF @mid IS NULL BEGIN SET @mid=NEWID();INSERT INTO CommunityMembers(Id,CommunityId,UserId,Status) VALUES(@mid,@c,@u,'ACTIVE');END ELSE UPDATE CommunityMembers SET Status='ACTIVE',JoinedAt=SYSUTCDATETIME() WHERE Id=@mid;
 IF NOT EXISTS(SELECT 1 FROM CommunityMemberRoles cmr JOIN Roles r ON r.Id=cmr.RoleId WHERE cmr.CommunityMemberId=@mid AND r.Name='Member') INSERT INTO CommunityMemberRoles(CommunityMemberId,RoleId) SELECT @mid,Id FROM Roles WHERE Name='Member';
 INSERT INTO ConversationMembers(ConversationId,UserId) SELECT Id,@u FROM Conversations cv WHERE CommunityId=@c AND Type='COMMUNITY' AND NOT EXISTS(SELECT 1 FROM ConversationMembers cm WHERE cm.ConversationId=cv.Id AND cm.UserId=@u);
 UPDATE CommunityJoinRequests SET Status='APPROVED',ReviewedAt=SYSUTCDATETIME() WHERE CommunityId=@c AND UserId=@u;
 SELECT 'ACTIVE' Result,@c Id,@name Name;END;COMMIT;`);
 const row=result.recordset[0];if(row?.Result==='MISSING')throw new AppError(404,'Community not found');if(row?.Result==='BLOCKED')throw new AppError(403,'Contact the community administrator about your membership');return{...row,status:row.Result,success:true};
}
