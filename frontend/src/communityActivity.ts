import {str,type RecordData} from './api';

const typeSections:Record<string,string>={
 ANNOUNCEMENT:'announcements',CHAT_MESSAGE:'conversations',INVITATION:'conversations',POST:'feed',COMMENT:'feed',MENTION:'feed',
 EVENT:'events',EVENT_REMINDER:'events',MEETING:'meetings',POLL:'polls',EMERGENCY_ALERT:'alerts',MEMBER:'members',MEMBERSHIP:'members',
 MARKETPLACE:'marketplace',SERVICE:'services',DOCUMENT:'documents',FINANCE:'finance',ISSUE:'issues',EXECUTIVE:'excos'
};

export function communityActivitySection(item:RecordData){
 const destination=str(item.Destination),communityId=str(item.CommunityId),data=item.NavigationData&&typeof item.NavigationData==='object'?item.NavigationData as RecordData:{};
 const communityMatch=destination.match(/^\/community\/[^/]+\/([^/?#]+)/);
 if(communityMatch)return communityMatch[1];
 if(destination.startsWith('/chat/'))return 'conversations';
 if(destination.startsWith('/post/'))return 'feed';
 if(destination.startsWith('/poll/'))return 'polls';
 const dataType=str(data.type).toUpperCase(),notificationType=str(item.NotificationType).toUpperCase();
 if(dataType==='MEETING')return 'meetings';
 if(dataType==='EVENT')return 'events';
 if(communityId)return typeSections[dataType]||typeSections[notificationType]||'';
 return '';
}

export function isUnreadCommunityActivity(item:RecordData,communityId:string,section?:string){
 return str(item.CommunityId).toLowerCase()===communityId.toLowerCase()&&!item.IsRead&&!item.ReadAt&&(!section||communityActivitySection(item)===section);
}

export function notificationPath(r:RecordData){const destination=str(r.Destination);return destination.startsWith('/')&&!destination.startsWith('//')&&!destination.includes('\\')?destination:r.CommunityId?'/community/'+r.CommunityId+'/feed':'/notifications'}
export function notificationGroupKey(r:RecordData){const data=r.NavigationData&&typeof r.NavigationData==='object'?r.NavigationData as RecordData:{},actor=str(data.actorUserId);return actor?JSON.stringify([actor,str(r.CommunityId),str(r.NotificationType),notificationPath(r)]):str(r.Id)}
