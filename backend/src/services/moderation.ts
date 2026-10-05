import {getPool,sql} from '../config/db.js';
import {requireCommunityMember,requirePermission} from './permissions.js';
import {AppError} from '../utils/errors.js';
export type EntityType='POST'|'COMMENT'|'MARKETPLACE';
export async function moderationTarget(tx:sql.Transaction,type:EntityType,id:string,community:string){
 const queries={POST:`SELECT CommunityId FROM CommunityPosts WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id AND CommunityId=@c AND IsDeleted=0`,
 COMMENT:`SELECT p.CommunityId FROM PostComments x WITH(UPDLOCK,HOLDLOCK) JOIN CommunityPosts p WITH(UPDLOCK,HOLDLOCK) ON p.Id=x.PostId WHERE x.Id=@id AND p.CommunityId=@c AND x.IsDeleted=0 AND p.IsDeleted=0`,
 MARKETPLACE:`SELECT CommunityId FROM MarketplaceListings WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id AND CommunityId=@c AND Status<>'REMOVED'`};
 if(!Object.hasOwn(queries,type))throw new AppError(400,'Invalid moderation entity');
 const target=(await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).input('c',sql.UniqueIdentifier,community).query(queries[type])).recordset[0];
 if(!target||String(target.CommunityId).toLowerCase()!==community.toLowerCase())throw new AppError(404,'Content not found in this community');return target;
}
export async function reportContent(user:string,community:string,d:{entityType:EntityType;entityId:string;reasonCode:string;confidence?:number;explanation?:string}){
 await requireCommunityMember(user,community);const tx=new sql.Transaction(await getPool());await tx.begin();
 try{const target=await moderationTarget(tx,d.entityType,d.entityId,community);
 const r=await new sql.Request(tx).input('c',sql.UniqueIdentifier,target.CommunityId).input('et',sql.NVarChar(40),d.entityType).input('ei',sql.UniqueIdentifier,d.entityId).input('rc',sql.NVarChar(80),d.reasonCode).input('cf',sql.Decimal(5,4),d.confidence??null).input('ex',sql.NVarChar(2000),d.explanation??null).query(`INSERT INTO ModerationQueue(CommunityId,EntityType,EntityId,ReasonCode,Confidence,Explanation) OUTPUT INSERTED.* VALUES(@c,@et,@ei,@rc,@cf,@ex)`);
 await tx.commit();return r.recordset[0]}catch(e){await tx.rollback();throw e}
}
export async function reviewContent(user:string,id:string,decision:'APPROVE'|'REMOVE',notes?:string){
 const tx=new sql.Transaction(await getPool());await tx.begin();try{
 const item=(await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).query(`SELECT * FROM ModerationQueue WITH(UPDLOCK,HOLDLOCK) WHERE Id=@id`)).recordset[0];
 if(!item)throw new AppError(404,'Moderation item not found');await requirePermission(user,item.CommunityId,'MODERATION_REVIEW');
 if(item.Status!=='PENDING_REVIEW')throw new AppError(409,'Moderation item already reviewed');
 await moderationTarget(tx,item.EntityType,item.EntityId,item.CommunityId);
 if(decision==='REMOVE'){
 const queries:Record<EntityType,string>={POST:`UPDATE CommunityPosts SET IsDeleted=1,DeletedAt=SYSUTCDATETIME() WHERE Id=@id AND CommunityId=@c`,COMMENT:`UPDATE x SET IsDeleted=1,DeletedAt=SYSUTCDATETIME(),DeletedBy=@u FROM PostComments x JOIN CommunityPosts p ON p.Id=x.PostId WHERE x.Id=@id AND p.CommunityId=@c`,MARKETPLACE:`UPDATE MarketplaceListings SET Status='REMOVED' WHERE Id=@id AND CommunityId=@c`};
 await new sql.Request(tx).input('id',sql.UniqueIdentifier,item.EntityId).input('c',sql.UniqueIdentifier,item.CommunityId).input('u',sql.UniqueIdentifier,user).query(queries[item.EntityType as EntityType]);}
 await new sql.Request(tx).input('id',sql.UniqueIdentifier,id).input('u',sql.UniqueIdentifier,user).input('s',sql.NVarChar(30),decision==='REMOVE'?'REMOVED':'APPROVED').input('n',sql.NVarChar(2000),notes??null).query(`UPDATE ModerationQueue SET Status=@s,ReviewedBy=@u,ReviewedAt=SYSUTCDATETIME(),ResolutionNotes=@n WHERE Id=@id`);
 await tx.commit();return {success:true,decision};}catch(e){await tx.rollback();throw e}
}
