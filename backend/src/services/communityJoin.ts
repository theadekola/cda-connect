import {getPool,sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';
export async function requestCommunityJoin(userId:string,communityId:string,message?:string,inviteCode?:string){
 const result=await(await getPool()).request().input('u',sql.UniqueIdentifier,userId).input('c',sql.UniqueIdentifier,communityId).input('message',sql.NVarChar(500),message??null).input('invite',sql.NVarChar(20),inviteCode??null).query(`SET XACT_ABORT ON;BEGIN TRANSACTION;
 DECLARE @approval bit,@private bit,@name nvarchar(200),@state nvarchar(30),@mid uniqueidentifier,@code nvarchar(20),@platformStatus nvarchar(20);
 SELECT @approval=RequireMemberApproval,@private=IsPrivate,@name=Name,@code=JoinCode,@platformStatus=PlatformStatus FROM Communities WITH(UPDLOCK,HOLDLOCK) WHERE Id=@c;
 SELECT @state=Status,@mid=Id FROM CommunityMembers WITH(UPDLOCK,HOLDLOCK) WHERE CommunityId=@c AND UserId=@u;
 IF @name IS NULL SELECT 'MISSING' Result;
 ELSE IF @platformStatus<>'ACTIVE' SELECT 'PLATFORM_RESTRICTED' Result,@c Id,@name Name;
 ELSE IF @state='ACTIVE' SELECT 'ACTIVE' Result,@c Id,@name Name;
 ELSE IF @private=1 AND (@invite IS NULL OR @invite<>@code) SELECT 'INVITE_REQUIRED' Result;
 ELSE IF @state IS NOT NULL AND @state NOT IN('LEFT','INACTIVE','PENDING') SELECT 'BLOCKED' Result;
 ELSE BEGIN
 MERGE CommunityJoinRequests WITH(HOLDLOCK) t USING(SELECT @c CommunityId,@u UserId)s ON t.CommunityId=s.CommunityId AND t.UserId=s.UserId WHEN MATCHED THEN UPDATE SET Status='PENDING',Message=@message,ReviewedBy=NULL,ReviewedAt=NULL,CreatedAt=SYSUTCDATETIME() WHEN NOT MATCHED THEN INSERT(CommunityId,UserId,Message) VALUES(@c,@u,@message);
 SELECT 'PENDING' Result,@c Id,@name Name,(SELECT Id FROM CommunityJoinRequests WHERE CommunityId=@c AND UserId=@u) RequestId;
 END;COMMIT;`);
 const row=result.recordset[0];if(row?.Result==='INVITE_REQUIRED')throw new AppError(403,'A valid invite code or invite link is required for this private community');if(row?.Result==='MISSING')throw new AppError(404,'Community not found');if(row?.Result==='PLATFORM_RESTRICTED')throw new AppError(423,'This community is not accepting join requests');if(row?.Result==='BLOCKED')throw new AppError(403,'Contact the community administrator about your membership');
 if(row?.Result==='PENDING'&&row.RequestId){const profile=(await(await getPool()).request().input('u',sql.UniqueIdentifier,userId).query("SELECT CONCAT(FirstName,' ',LastName) Name FROM Users WHERE Id=@u")).recordset[0],{enqueueCommunityNotification}=await import('../queues/index.js');void enqueueCommunityNotification({communityId,actorUserId:userId,type:'MEMBER',title:'New membership request',body:`${profile?.Name||'A person'} requested to join ${row.Name}.`,entityId:row.RequestId,data:{type:'MEMBER',communityId,requiresPermission:'MEMBER_APPROVE',url:'/community/'+communityId+'/members?tab=pending'}}).catch(error=>console.error('Join request notification failed',error));}
 return{...row,status:row.Result,success:true};
}
