import crypto from 'node:crypto';
const id=(x:unknown)=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x)?x:null;
export function notificationDestination(data:Record<string,unknown>={}){const community=id(data.communityId),entity=id(data.entityId);switch(data.type){
 case 'POST':case 'COMMENT':case 'MENTION':{const post=id(data.postId)||entity;return post?'/post/'+post+(data.type==='COMMENT'?'#comments':''):'/notifications'}
 case 'CHAT_MESSAGE':return id(data.conversationId)?'/chat/'+data.conversationId:'/notifications';
 case 'POLL':return community&&(id(data.pollId)||entity)?'/poll/'+community+'/'+(id(data.pollId)||entity):'/notifications';
 case 'MEETING':case 'EVENT_REMINDER':case 'EVENT':{const meeting=data.type==='MEETING',target=entity||id(meeting?data.meetingId:data.eventId);return community&&target?'/community/'+community+'/'+(meeting?'meetings?meeting=':'events?event=')+target:'/notifications'}
 case 'MEMBER':case 'MEMBERSHIP':return community?typeof data.url==='string'&&data.url.startsWith('/community/'+community+'/')?data.url:'/community/'+community+'/members':'/notifications';
 case 'EMERGENCY_ALERT':{const sos=id(data.sosStatusId)||id(data.sosId);if(community&&sos)return '/community/'+community+'/alerts?view=sos-status&sos='+sos;return community&&(id(data.alertId)||entity)?'/community/'+community+'/alerts?alert='+(id(data.alertId)||entity):'/notifications';}
 default:return '/notifications';}}
export function notificationTag(data:Record<string,unknown>={}){return 'cda-'+(id(data.eventId)||id(data.notificationId)||id(data.alertId)||crypto.randomUUID())}
