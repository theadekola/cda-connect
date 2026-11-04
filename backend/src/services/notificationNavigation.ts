import type {CommunityNotificationJob} from '../queues/index.js';

// Delivery category and destination kind differ for scheduled meeting reminders.
export function notificationNavigation(job:CommunityNotificationJob){
 const type=job.type==='EVENT_REMINDER'&&job.data?.type==='MEETING'?'MEETING':job.type;
 return {...job.data,requiresPermission:job.data?.requiresPermission,type,preference:job.preference,communityId:job.communityId,entityId:job.entityId,eventId:job.eventId,conversationId:job.conversationId,actorUserId:job.actorUserId};
}
