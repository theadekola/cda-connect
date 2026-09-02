import { getPool, sql } from '../config/db.js';
import { enqueueCommunityNotification,type CommunityNotificationJob } from '../queues/index.js';

const pushActions=new Set(['MEETING_CREATED','POLL_CREATED','POLL_UPDATED','POLL_STOPPED','COMMUNITY_UPDATED','PROPOSAL_CREATED','ISSUE_UPDATED','EXCO_APPOINTED','EXCO_STATUS_CHANGED','EXCO_REMOVED','OPPORTUNITY_PUBLISHED','SERVICE_VERIFIED','MEMBER_ROLES_CHANGED']);
function preferenceFor(action:string):CommunityNotificationJob['preference']{
  if(action.includes('POLL'))return'Polls';
  if(action.includes('MEETING')||action.includes('EVENT'))return'Events';
  if(action.includes('MARKETPLACE')||action.includes('OPPORTUNITY')||action.includes('SERVICE'))return'Marketplace';
  return'CommunityPosts';
}
function readable(action:string){return action.toLowerCase().split('_').map(word=>word[0]?.toUpperCase()+word.slice(1)).join(' ')}
export async function audit(communityId: string|null, userId: string, action: string, entityType: string, entityId?: string|null, details?: unknown) {
  const pool = await getPool();
  await pool.request()
    .input('CommunityId', sql.UniqueIdentifier, communityId)
    .input('UserId', sql.UniqueIdentifier, userId)
    .input('Action', sql.NVarChar(200), action)
    .input('EntityType', sql.NVarChar(100), entityType)
    .input('EntityId', sql.UniqueIdentifier, entityId ?? null)
    .input('Details', sql.NVarChar(sql.MAX), details ? JSON.stringify(details) : null)
    .query(`INSERT INTO AuditLogs(CommunityId,UserId,Action,EntityType,EntityId,Details) VALUES(@CommunityId,@UserId,@Action,@EntityType,@EntityId,@Details)`);
  if(communityId&&pushActions.has(action))await enqueueCommunityNotification({communityId,actorUserId:userId,type:action,title:readable(action),body:`There is a new ${entityType.replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase()} update in your community.`,entityId:entityId??undefined,preference:preferenceFor(action)});
}
