import type {NextFunction,Request,Response} from 'express';
import {getPool,sql} from '../config/db.js';

const uuidSource='[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const uuid=new RegExp(`^${uuidSource}$`,'i');

type CommunityLookup={pattern:RegExp;query:string};

// These mutation routes identify a community-owned record instead of putting
// the community ID in the URL, so resolve the owning community first.
const entityLookups:CommunityLookup[]=[
 {pattern:new RegExp(`/governance/proposals/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM GovernanceProposals e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/governance/actions/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM GovernanceActions e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/formal-ballots/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM FormalBallots e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/documents/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM KnowledgeDocuments e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/moderation-queue/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM ModerationQueue e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/conversations/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM Conversations e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/meetings/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM Meetings e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/polls/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM Polls e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/posts/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM CommunityPosts e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/comments/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM PostComments e JOIN CommunityPosts p ON p.Id=e.PostId JOIN Communities c ON c.Id=p.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/alerts/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM EmergencyAlerts e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/services/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM ServiceProviders e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/marketplace/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM MarketplaceListings e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/opportunities/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM CommunityOpportunities e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/events/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM CommunityEvents e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/verification/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM CommunityVerificationRequests e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/media/uploads/(${uuidSource})(?:/|$)`,'i'),query:'SELECT c.PlatformStatus FROM StoredObjects e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'},
 {pattern:new RegExp(`/community-preferences/managed/(${uuidSource})(?:/|$)`,'i'),query:'SELECT PlatformStatus FROM Communities WHERE Id=@id'}
];

const contentLookups:Record<string,string>={
 post:'SELECT c.PlatformStatus FROM CommunityPosts e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id',
 comment:'SELECT c.PlatformStatus FROM PostComments e JOIN CommunityPosts p ON p.Id=e.PostId JOIN Communities c ON c.Id=p.CommunityId WHERE e.Id=@id',
 announcement:'SELECT c.PlatformStatus FROM Announcements e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id'
};

function directCommunityId(req:Request){
 const pathMatch=req.path.match(new RegExp(`/communities/(${uuidSource})(?:/|$)`,'i'));
 const supplied=pathMatch?.[1]??req.body?.communityId??req.body?.CommunityId??req.query.communityId;
 return typeof supplied==='string'&&uuid.test(supplied)?supplied:null;
}

async function platformStatusForMutation(req:Request){
 const pool=await getPool(),direct=directCommunityId(req);
 if(direct)return (await pool.request().input('id',sql.UniqueIdentifier,direct).query('SELECT PlatformStatus FROM Communities WHERE Id=@id')).recordset[0];

 const conversationId=req.query.conversationId;
 if(typeof conversationId==='string'&&uuid.test(conversationId))return (await pool.request().input('id',sql.UniqueIdentifier,conversationId).query('SELECT c.PlatformStatus FROM Conversations e JOIN Communities c ON c.Id=e.CommunityId WHERE e.Id=@id')).recordset[0];

 const content=req.path.match(new RegExp(`/content/(post|comment|announcement)/(${uuidSource})/transform(?:/|$)`,'i'));
 if(content)return (await pool.request().input('id',sql.UniqueIdentifier,content[2]).query(contentLookups[content[1].toLowerCase()])).recordset[0];

 for(const lookup of entityLookups){const match=req.path.match(lookup.pattern);if(match)return (await pool.request().input('id',sql.UniqueIdentifier,match[1]).query(lookup.query)).recordset[0]}
 return null;
}

export async function requireActiveCommunityMutation(req:Request,res:Response,next:NextFunction){
 try{
  if(['GET','HEAD','OPTIONS'].includes(req.method)||/\/(sos|emergenc)/i.test(req.path))return next();
  const row=await platformStatusForMutation(req);
  if(!row||row.PlatformStatus==='ACTIVE')return next();
  return res.status(423).json({error:`This community is ${String(row.PlatformStatus).toLowerCase()}. New posts, chats, polls, meetings, documents, payments and membership changes are unavailable.`,code:'COMMUNITY_PLATFORM_RESTRICTED',platformStatus:row.PlatformStatus});
 }catch(error){next(error)}
}
