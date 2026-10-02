import type {Server} from 'socket.io';
let server:Server|undefined;
export function setConversationEventServer(value:Server){server=value}
export function emitConversationEvent(conversationId:string,event:string,payload:unknown){server?.to(`conversation:${conversationId}`).emit(event,payload)}
