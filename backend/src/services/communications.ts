import {getPool,sql} from '../config/db.js';
import {AppError} from '../utils/errors.js';
export function dndActive(until:unknown,now=Date.now()){return !!until&&new Date(String(until)).getTime()>now}
export async function communicationSettings(user:string){const pool=await getPool();return (await pool.request().input('u',sql.UniqueIdentifier,user).query('SELECT * FROM CommunicationSettings WHERE UserId=@u')).recordset[0]??{}}
export async function allowDirectMessage(actor:string,owner:string){
 const pool=await getPool(),r=await pool.request().input('actor',sql.UniqueIdentifier,actor).input('owner',sql.UniqueIdentifier,owner).query(`SELECT COALESCE(s.InAppMessages,1) InAppMessages,COALESCE(p.WhoCanMessage,'MEMBERS') WhoCanMessage,
 CASE WHEN EXISTS(SELECT 1 FROM CommunityMembers a JOIN CommunityMembers b ON b.CommunityId=a.CommunityId JOIN CommunityMemberRoles mr ON mr.CommunityMemberId=a.Id JOIN Roles role ON role.Id=mr.RoleId WHERE a.UserId=@actor AND b.UserId=@owner AND a.Status='ACTIVE' AND b.Status='ACTIVE' AND role.Name IN ('Owner','Admin','Moderator')) THEN 1 ELSE 0 END IsAdmin FROM Users u LEFT JOIN CommunicationSettings s ON s.UserId=u.Id LEFT JOIN PrivacyPreferences p ON p.UserId=u.Id WHERE u.Id=@owner`);
 const row=r.recordset[0];if(!row||row.InAppMessages===false||row.InAppMessages===0||row.WhoCanMessage==='NOBODY'||(row.WhoCanMessage==='ADMINS'&&!row.IsAdmin))throw new AppError(403,'This member is not accepting direct messages from you');
}
export async function allowCall(user:string){const s=await communicationSettings(user);return s.VoiceCalls!==false&&s.VoiceCalls!==0&&!dndActive(s.DoNotDisturbUntil)}
export async function requireCallParticipants(actor:string,conversation:string){
 const pool=await getPool(),r=await pool.request().input('cv',sql.UniqueIdentifier,conversation).query(`SELECT c.Type,cm.UserId FROM Conversations c JOIN ConversationMembers cm ON cm.ConversationId=c.Id AND cm.IsActive=1 WHERE c.Id=@cv`);
 if(!await allowCall(actor))throw new AppError(403,'Voice calls are turned off or Do Not Disturb is active');
 if(r.recordset[0]?.Type==='DIRECT')for(const row of r.recordset)if(!await allowCall(row.UserId))throw new AppError(403,'This member is not accepting calls');
}
