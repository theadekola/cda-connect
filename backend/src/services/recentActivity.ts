import {getPool,sql} from '../config/db.js';
import {visibleContent} from './privacy.js';
import {pollAudienceSql} from './pollSettings.js';
import {activityAfter,decodeActivityCursor,activityPage} from './activityCursor.js';
export const recentActivitySql=`WITH activity AS (
 SELECT 'feed' Kind,p.Id,p.CommunityId,p.CreatedAt,CAST('Community post' AS nvarchar(500)) Title,CAST(p.Body AS nvarchar(max)) Body FROM CommunityPosts p
 LEFT JOIN CommunityPreferences pref ON pref.UserId=@u
 WHERE p.IsDeleted=0 AND ${visibleContent('p.CreatedBy','p.Body')}
 AND (COALESCE(pref.HideSensitive,1)=0 OR p.IsSensitive=0)
 AND (NOT EXISTS(SELECT 1 FROM OPENJSON(COALESCE(pref.ContentTypes,'[]'))) OR p.PostType IN(SELECT value FROM OPENJSON(pref.ContentTypes)))
 AND NOT EXISTS(SELECT 1 FROM PostHashtags tag JOIN OPENJSON(COALESCE(pref.MutedTags,'[]')) muted ON LOWER(tag.Tag)=LOWER(muted.value) WHERE tag.PostId=p.Id)
 UNION ALL SELECT 'announcements',a.Id,a.CommunityId,a.CreatedAt,a.Title,a.Body FROM Announcements a
 UNION ALL SELECT 'meetings',m.Id,m.CommunityId,m.CreatedAt,m.Title,m.Description FROM Meetings m WHERE dbo.CanViewMeeting(m.Id,@u)=1
 UNION ALL SELECT 'events',e.Id,e.CommunityId,e.CreatedAt,e.Title,e.Description FROM CommunityEvents e
 UNION ALL SELECT 'marketplace',m.Id,m.CommunityId,m.CreatedAt,m.Title,m.Description FROM MarketplaceListings m WHERE m.Status='ACTIVE' AND m.ModerationStatus='APPROVED'
 UNION ALL SELECT 'polls',p.Id,p.CommunityId,p.CreatedAt,p.Question,p.Description FROM Polls p WHERE ${pollAudienceSql} OR p.CreatedBy=@u
 OR EXISTS(SELECT 1 FROM CommunityMembers cm JOIN Communities c ON c.Id=cm.CommunityId JOIN CommunityMemberRoles mr ON mr.CommunityMemberId=cm.Id JOIN Roles r ON r.Id=mr.RoleId LEFT JOIN RolePermissions rp ON rp.RoleId=r.Id LEFT JOIN Permissions permission ON permission.Id=rp.PermissionId WHERE cm.UserId=@u AND cm.CommunityId=p.CommunityId AND cm.Status='ACTIVE' AND (c.OwnerUserId=@u OR r.Name IN('Owner','Admin','Moderator') OR permission.Code='POLL_CREATE')) OR EXISTS(SELECT 1 FROM CommunityExecutiveMembers ex WHERE ex.CommunityId=p.CommunityId AND ex.UserId=@u AND ex.Status='ACTIVE' AND ex.AppointedDate<=CONVERT(date,SYSUTCDATETIME()) AND (ex.TenureEndDate IS NULL OR ex.TenureEndDate>=CONVERT(date,SYSUTCDATETIME())))
), visible AS (
 SELECT a.*,c.Name CommunityName FROM activity a JOIN Communities c ON c.Id=a.CommunityId
 WHERE EXISTS(SELECT 1 FROM Users u WHERE u.Id=@u AND u.AccountStatus='ACTIVE')
 AND EXISTS(SELECT 1 FROM CommunityMembers cm WHERE cm.CommunityId=a.CommunityId AND cm.UserId=@u AND cm.Status='ACTIVE')
)
SELECT TOP 21 *,CONVERT(varchar(33),CreatedAt,126) CursorAt FROM visible
WHERE CreatedAt IS NOT NULL AND ${activityAfter} AND (@q='' OR CHARINDEX(@q,Title)>0 OR CHARINDEX(@q,Body)>0 OR CHARINDEX(@q,CommunityName)>0)
ORDER BY CreatedAt DESC,Kind,Id`;
export async function recentActivity(user:string,search:string,cursor?:string){
 const key=decodeActivityCursor(cursor),pool=await getPool();const result=await pool.request().input('u',sql.UniqueIdentifier,user).input('q',sql.NVarChar(200),search)
 .input('at',sql.VarChar(33),key?.at??null).input('cursorKind',sql.NVarChar(20),key?.kind??null).input('cursorId',sql.UniqueIdentifier,key?.id??null).query(recentActivitySql);
 return activityPage(result.recordset);
}
