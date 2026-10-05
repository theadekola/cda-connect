import {allowDirectMessage} from './communications.js';
import {getPool,sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';

// SQL fragments accept only source-code aliases, never request input.
export function visibleContent(author:string,body:string,viewer='@u'){
 return `(${author}=${viewer} OR (NOT EXISTS(SELECT 1 FROM BlockedUsers b WHERE (b.UserId=${viewer} AND b.BlockedUserId=${author}) OR (b.UserId=${author} AND b.BlockedUserId=${viewer})) AND NOT EXISTS(SELECT 1 FROM HiddenUsers h WHERE h.UserId=${author} AND h.HiddenUserId=${viewer}) AND NOT EXISTS(SELECT 1 FROM RestrictedWords w WHERE w.UserId=${viewer} AND CHARINDEX(LOWER(w.Phrase),LOWER(COALESCE(${body},'')))>0)))`;
}
export async function requireAudience(actor:string,owner:string,kind:'comment'|'mention'|'contact'|'call'){
 if(actor===owner)return;
 if(kind==='contact')await allowDirectMessage(actor,owner);
 const pool=await getPool();
 const r=await pool.request().input('actor',sql.UniqueIdentifier,actor).input('owner',sql.UniqueIdentifier,owner).query(`SELECT COALESCE(s.CommentAudience,'EVERYONE') CommentAudience,COALESCE(s.MentionAudience,'EVERYONE') MentionAudience,
 CASE WHEN EXISTS(SELECT 1 FROM BlockedUsers b WHERE (b.UserId=@actor AND b.BlockedUserId=@owner) OR (b.UserId=@owner AND b.BlockedUserId=@actor)) OR EXISTS(SELECT 1 FROM HiddenUsers h WHERE h.UserId=@owner AND h.HiddenUserId=@actor) THEN 1 ELSE 0 END Denied,
 CASE WHEN EXISTS(SELECT 1 FROM CommunityMembers a JOIN CommunityMembers b ON b.CommunityId=a.CommunityId WHERE a.UserId=@actor AND b.UserId=@owner AND a.Status='ACTIVE' AND b.Status='ACTIVE') THEN 1 ELSE 0 END Shared
 FROM Users u LEFT JOIN PrivacySafetySettings s ON s.UserId=u.Id WHERE u.Id=@owner AND u.AccountStatus='ACTIVE'`);
 const row=r.recordset[0],audience=kind==='comment'?row?.CommentAudience:kind==='mention'?row?.MentionAudience:'EVERYONE';
 if(!row||row.Denied||audience==='NOBODY'||(audience==='COMMUNITIES'&&!row.Shared))throw new AppError(403,'This member’s privacy settings do not allow this action');
}
export async function mentionTargets(actor:string,community:string,text:string){
 const labels=[...new Set((text.match(/@[\p{L}\p{N}_.-]+/gu)||[]).map(x=>x.slice(1).toLowerCase()))].slice(0,20);
 if(!labels.length)return [] as string[];
 const pool=await getPool();
 const r=await pool.request().input('c',sql.UniqueIdentifier,community).input('labels',sql.NVarChar(sql.MAX),JSON.stringify(labels)).query(`SELECT DISTINCT u.Id FROM Users u JOIN CommunityMembers cm ON cm.UserId=u.Id AND cm.CommunityId=@c AND cm.Status='ACTIVE' LEFT JOIN AccountSettings a ON a.UserId=u.Id WHERE u.AccountStatus='ACTIVE' AND EXISTS(SELECT 1 FROM OPENJSON(@labels) l WHERE LOWER(a.Username)=l.value OR LOWER(REPLACE(CONCAT(u.FirstName,u.LastName),' ',''))=l.value)`);
 for(const row of r.recordset)await requireAudience(actor,row.Id,'mention');
 return r.recordset.map(row=>String(row.Id));
}
export async function requireConversationContact(actor:string,conversation:string,kind:'contact'|'call'='contact'){
 const pool=await getPool(),r=await pool.request().input('cv',sql.UniqueIdentifier,conversation).input('u',sql.UniqueIdentifier,actor).query(`SELECT cm.UserId FROM Conversations c JOIN ConversationMembers cm ON cm.ConversationId=c.Id AND cm.IsActive=1 WHERE c.Id=@cv AND c.Type='DIRECT' AND cm.UserId<>@u`);
 for(const row of r.recordset)await requireAudience(actor,row.UserId,kind);
}
