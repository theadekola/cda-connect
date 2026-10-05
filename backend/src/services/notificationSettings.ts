import {getPool,sql} from '../config/db.js';
export const notificationColumns={initiatives:'Initiatives',enabled:'Enabled',communityUpdates:'CommunityUpdates',newPosts:'CommunityPosts',comments:'Comments',mentions:'Mentions',messages:'DirectMessages',events:'Events',invitations:'Invitations',polls:'Polls',emergency:'EmergencyEnabled',marketplace:'Marketplace',businessPromotions:'BusinessPromotions'} as const;
export function categoryColumn(type:string,preference?:string):string {
 if(type==='POST'&&preference==='Initiatives')return 'Initiatives';
 const types:Record<string,string>={ANNOUNCEMENT:'CommunityUpdates',POST:'CommunityPosts',COMMENT:'Comments',MENTION:'Mentions',CHAT_MESSAGE:'DirectMessages',INVITATION:'Invitations',EMERGENCY_ALERT:'EmergencyEnabled',EVENT:'Events',MEETING:'Events',EVENT_REMINDER:'Events',POLL:'Polls'};
 return types[type]??(Object.values(notificationColumns).includes(preference as any)?preference!:'CommunityUpdates');
}
export function categoryEnabled(p:Record<string,any>,type:string,preference?:string){const value=p[categoryColumn(type,preference)];return p.Enabled!==false&&p.Enabled!==0&&value!==false&&value!==0&&value!=='OFF'}
export function quietNow(p:Record<string,any>,now=new Date()){
 if(!p.QuietHoursEnabled||!p.QuietStart||!p.QuietEnd)return false;
 try {const parts=new Intl.DateTimeFormat('en-GB',{timeZone:p.TimeZone||'UTC',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now),time=parts.find(x=>x.type==='hour')!.value+':'+parts.find(x=>x.type==='minute')!.value;return p.QuietStart<p.QuietEnd?time>=p.QuietStart&&time<p.QuietEnd:time>=p.QuietStart||time<p.QuietEnd}catch{return false}
}
export async function readNotificationSettings(userId:string){return (await(await getPool()).request().input('u',sql.UniqueIdentifier,userId).query(`SELECT n.UserId,n.Initiatives,n.Enabled,n.CommunityUpdates,n.CommunityPosts,n.Comments,n.Mentions,n.DirectMessages,n.Events,n.Invitations,n.Polls,n.EmergencyEnabled,n.Marketplace,n.BusinessPromotions,n.QuietHoursEnabled,CONVERT(varchar(5),n.QuietStart,108) QuietStart,CONVERT(varchar(5),n.QuietEnd,108) QuietEnd,COALESCE(a.TimeZone,'UTC') TimeZone FROM Users u LEFT JOIN NotificationPreferences n ON n.UserId=u.Id LEFT JOIN UserAppPreferences a ON a.UserId=u.Id WHERE u.Id=@u`)).recordset[0]??{}}
export async function deliveryAllowed(userId:string,type:string,preference?:string){const p=await readNotificationSettings(userId);return categoryEnabled(p,type,preference)&&(type==='EMERGENCY_ALERT'||!quietNow(p))}
