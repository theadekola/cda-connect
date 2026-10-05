import {communicationSettings,allowCall,requireCallParticipants} from './services/communications.js';
import {requireConversationContact} from './services/privacy.js';
import type { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { verifyAccess } from './utils/auth.js';
import { getPool, sql } from './config/db.js';
import { getRedis } from './config/redis.js';
import { enqueueCommunityNotification } from './queues/index.js';
import {AppError} from './utils/errors.js';

let activeSocketServer:Server|undefined;
export function disconnectUserSockets(userId:string){activeSocketServer?.in(`user:${userId}`).disconnectSockets(true)}
export function disconnectCommunitySockets(communityId:string){activeSocketServer?.in(`community:${communityId}`).disconnectSockets(true)}

export function configureSocket(io: Server) {
  activeSocketServer=io;
  async function createCallMessage(conversationId:string,userId:string,mode:'audio'|'video'){
    const text=JSON.stringify({mode,status:'RINGING',durationSeconds:0});
    const result=await (await getPool()).request().input('cv',sql.UniqueIdentifier,conversationId).input('u',sql.UniqueIdentifier,userId).input('text',sql.NVarChar(sql.MAX),text).query(`INSERT Messages(ConversationId,SenderUserId,MessageType,MessageText) OUTPUT INSERTED.* VALUES(@cv,@u,'CALL',@text)`);
    const message=result.recordset[0];io.to(`conversation:${conversationId}`).emit('message:new',message);return message;
  }
  async function connectCallMessage(messageId:string,conversationId:string,connectedAt:number){
    const result=await (await getPool()).request().input('id',sql.UniqueIdentifier,messageId).input('connected',sql.NVarChar(40),new Date(connectedAt).toISOString()).query(`UPDATE Messages SET MessageText=JSON_MODIFY(JSON_MODIFY(MessageText,'$.status','CONNECTED'),'$.connectedAt',@connected) OUTPUT INSERTED.* WHERE Id=@id AND MessageType='CALL' AND ISJSON(MessageText)=1 AND JSON_VALUE(MessageText,'$.status')='RINGING'`);
    if(result.recordset[0])io.to(`conversation:${conversationId}`).emit('message:updated',result.recordset[0]);
  }
  async function finishCallMessage(messageId:string|undefined,conversationId:string,status:'ENDED'|'NO_ANSWER',connectedAt?:number){
    if(!messageId)return;const durationSeconds=connectedAt?Math.max(0,Math.floor((Date.now()-connectedAt)/1000)):0;
    const result=await (await getPool()).request().input('id',sql.UniqueIdentifier,messageId).input('status',sql.NVarChar(20),status).input('duration',sql.Int,durationSeconds).query(`UPDATE Messages SET MessageText=JSON_MODIFY(JSON_MODIFY(MessageText,'$.status',@status),'$.durationSeconds',@duration) OUTPUT INSERTED.* WHERE Id=@id AND MessageType='CALL' AND ISJSON(MessageText)=1 AND JSON_VALUE(MessageText,'$.status') IN ('RINGING','CONNECTED')`);
    if(result.recordset[0])io.to(`conversation:${conversationId}`).emit('message:updated',result.recordset[0]);
  }
  function clearCallData(socket:{data:Record<string,any>}){socket.data.callMessageId=undefined;socket.data.callStartedAt=undefined;socket.data.callConnectedAt=undefined;socket.data.callMode=undefined;socket.data.callInvitees=undefined;socket.data.callConversationId=undefined}
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string;
      socket.data.user = verifyAccess(token);
      const account = await (await getPool()).request().input('id', sql.UniqueIdentifier, socket.data.user.id).input('family',sql.UniqueIdentifier,socket.data.user.sessionId??null)
        .query("SELECT Id FROM Users WHERE Id=@id AND AccountStatus='ACTIVE' AND EXISTS(SELECT 1 FROM UserSessions WHERE UserId=@id AND FamilyId=@family AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME())");
      if (!account.recordset[0]) return next(new Error('unauthorized'));
      socket.data.tokenExpiresAt = (jwt.decode(token) as jwt.JwtPayload).exp! * 1000;
      next();
    } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', async socket => {
    const user = socket.data.user as { id: string };
    const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(0, socket.data.tokenExpiresAt - Date.now()));
    expiryTimer.unref();
    const sessionTimer=setInterval(async()=>{try{const rows=await(await getPool()).request().input('u',sql.UniqueIdentifier,user.id).input('family',sql.UniqueIdentifier,socket.data.user.sessionId??null).query('SELECT TOP 1 Id FROM UserSessions WHERE UserId=@u AND FamilyId=@family AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME()');if(!rows.recordset[0])socket.disconnect(true)}catch{socket.disconnect(true)}},15000);sessionTimer.unref();
    socket.once('disconnect', () => {clearTimeout(expiryTimer);clearInterval(sessionTimer)});
    socket.use(async (_packet, next) => {
      try {
        if(!_packet[1]||typeof _packet[1]!=='object')throw new Error('Invalid socket payload');
        verifyAccess(socket.handshake.auth.token);
        const account = await (await getPool()).request().input('id', sql.UniqueIdentifier, user.id).input('family',sql.UniqueIdentifier,socket.data.user.sessionId??null)
          .query("SELECT Id FROM Users WHERE Id=@id AND AccountStatus='ACTIVE' AND EXISTS(SELECT 1 FROM UserSessions WHERE UserId=@id AND FamilyId=@family AND RevokedAt IS NULL AND ExpiresAt>SYSUTCDATETIME())");
        if (!account.recordset[0]) throw new Error('unauthorized');
        next();
      } catch { next(new Error('unauthorized')); socket.disconnect(true); }
    });
    socket.join(`user:${user.id}`);
    const communities=await (await getPool()).request().input('u',sql.UniqueIdentifier,user.id).query("SELECT CommunityId FROM CommunityMembers WHERE UserId=@u AND Status='ACTIVE'");
    for(const community of communities.recordset)socket.join(`community:${community.CommunityId}`);
    const redis = getRedis();
    await redis.sadd(`presence:user:${user.id}:sockets`, socket.id);
    await redis.expire(`presence:user:${user.id}:sockets`, 3600);
    await redis.set(`presence:user:${user.id}:lastSeen`, new Date().toISOString(), 'EX', 86400 * 30);

    const activeConversations=new Set<string>();
    socket.on('conversation:join', async ({ conversationId }) => {
      try{await requireConversationContact(user.id,String(conversationId))}catch{return}
      const pool = await getPool();
      const r = await pool.request().input('cv', sql.UniqueIdentifier, conversationId).input('u', sql.UniqueIdentifier, user.id)
        .query(`SELECT 1 ok FROM ConversationMembers member JOIN Conversations conversation ON conversation.Id=member.ConversationId JOIN Communities community ON community.Id=conversation.CommunityId AND community.PlatformStatus='ACTIVE' JOIN CommunityMembers communityMember ON communityMember.CommunityId=conversation.CommunityId AND communityMember.UserId=member.UserId WHERE member.ConversationId=@cv AND member.UserId=@u AND member.IsActive=1 AND communityMember.Status='ACTIVE'`);
      if(r.recordset[0]){socket.join(`conversation:${conversationId}`);activeConversations.add(String(conversationId));await redis.sadd(`presence:conversation:${conversationId}:user:${user.id}`,socket.id);await redis.expire(`presence:conversation:${conversationId}:user:${user.id}`,3600)}
    });
    socket.on('conversation:leave',async({conversationId})=>{socket.leave(`conversation:${conversationId}`);activeConversations.delete(String(conversationId));await redis.srem(`presence:conversation:${conversationId}:user:${user.id}`,socket.id)});

    socket.on('typing:start', async ({ conversationId }) => { try{const preferences=await communicationSettings(user.id);if(preferences.TypingIndicators===false||preferences.TypingIndicators===0)return;await requireConversationContact(user.id,String(conversationId))}catch{return} if(activeConversations.has(String(conversationId))) socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId: user.id }); });
    socket.on('typing:stop', async ({ conversationId }) => { try{await requireConversationContact(user.id,String(conversationId))}catch{return} if(activeConversations.has(String(conversationId))) socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId: user.id }); });

    socket.on('message:send', async (payload, ack) => {
      try {
        const d = { conversationId: String(payload.conversationId),clientMessageId:String(payload.clientMessageId??''), messageText: String(payload.messageText ?? '').trim(), messageType: String(payload.messageType ?? 'TEXT').toUpperCase(), mediaUrl: payload.mediaUrl ? String(payload.mediaUrl) : null,replyToMessageId:payload.replyToMessageId?String(payload.replyToMessageId):null };
        if (!d.messageText && !d.mediaUrl) return ack?.({ ok: false, error: 'Message is empty' });
        if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.clientMessageId))return ack?.({ok:false,error:'A valid client message ID is required'});
        const pool = await getPool();
        const member = await pool.request().input('cv', sql.UniqueIdentifier, d.conversationId).input('u', sql.UniqueIdentifier, user.id)
          .query(`SELECT conversation.CommunityId,conversation.Name FROM ConversationMembers member JOIN Conversations conversation ON conversation.Id=member.ConversationId JOIN Communities community ON community.Id=conversation.CommunityId AND community.PlatformStatus='ACTIVE' JOIN CommunityMembers communityMember ON communityMember.CommunityId=conversation.CommunityId AND communityMember.UserId=member.UserId WHERE member.ConversationId=@cv AND member.UserId=@u AND member.IsActive=1 AND communityMember.Status='ACTIVE'`);
        if (!member.recordset[0]) return ack?.({ ok: false, error: 'Forbidden' });
        await requireConversationContact(user.id,d.conversationId);
        if(d.mediaUrl){
          const objectId=d.mediaUrl.startsWith('chat-attachment:')?d.mediaUrl.slice(16):'';
          if(!/^[0-9a-f-]{36}$/i.test(objectId))return ack?.({ok:false,error:'Upload a chat attachment first'});
          const file=(await pool.request().input('o',sql.UniqueIdentifier,objectId).input('u',sql.UniqueIdentifier,user.id).input('c',sql.UniqueIdentifier,member.recordset[0].CommunityId).query(`SELECT Id FROM StoredObjects WHERE Id=@o AND UploadedBy=@u AND CommunityId=@c AND IsPrivate=1 AND UploadState='AVAILABLE' AND DeletedAt IS NULL`)).recordset[0];
          if(!file)return ack?.({ok:false,error:'Attachment is unavailable'});
        }
        if(d.replyToMessageId){const reply=(await pool.request().input('m',sql.UniqueIdentifier,d.replyToMessageId).input('cv',sql.UniqueIdentifier,d.conversationId).query('SELECT Id FROM Messages WHERE Id=@m AND ConversationId=@cv AND IsDeleted=0')).recordset[0];if(!reply)return ack?.({ok:false,error:'The message you are replying to is unavailable'})}
        const r = await pool.request().input('cv', sql.UniqueIdentifier, d.conversationId).input('u', sql.UniqueIdentifier, user.id).input('client',sql.UniqueIdentifier,d.clientMessageId)
          .input('type', sql.NVarChar(30), d.messageType).input('text', sql.NVarChar(sql.MAX), d.messageText).input('media', sql.NVarChar(1500), d.mediaUrl).input('reply',sql.UniqueIdentifier,d.replyToMessageId)
          .query(`SET XACT_ABORT ON;BEGIN TRANSACTION;IF EXISTS(SELECT 1 FROM Messages WITH(UPDLOCK,HOLDLOCK) WHERE SenderUserId=@u AND ClientMessageId=@client) SELECT *,CAST(1 AS bit) Duplicate FROM Messages WHERE SenderUserId=@u AND ClientMessageId=@client;ELSE INSERT INTO Messages(ConversationId,SenderUserId,ClientMessageId,MessageType,MessageText,MediaUrl,ReplyToMessageId) OUTPUT INSERTED.*,CAST(0 AS bit) Duplicate VALUES(@cv,@u,@client,@type,@text,@media,@reply);COMMIT TRANSACTION;`);
        const msg = r.recordset[0];
        if(msg.Duplicate)return ack?.({ok:true,message:msg,duplicate:true});
        io.to(`conversation:${d.conversationId}`).emit('message:new', msg);
        ack?.({ ok: true, message: msg });
        const mediaPreview:Record<string,string>={PHOTO:'Sent a photo',IMAGE:'Sent a photo',VIDEO:'Sent a video',DOCUMENT:'Sent a document',VOICE:'Sent a voice message',AUDIO:'Sent a voice message'};
        void enqueueCommunityNotification({communityId:member.recordset[0].CommunityId,occurredAt:new Date(msg.CreatedAt).toISOString(),conversationId:d.conversationId,actorUserId:user.id,type:'CHAT_MESSAGE',title:member.recordset[0].Name||'New message',body:mediaPreview[d.messageType]??d.messageText,entityId:msg.Id,preference:'DirectMessages',data:{type:'CHAT_MESSAGE',communityId:member.recordset[0].CommunityId,conversationId:d.conversationId,messageId:msg.Id}}).then(result=>{if(result.status==='OUTBOX_FAILED')console.error('Message saved but notification outbox failed',{messageId:msg.Id})}).catch(error=>console.error('Message saved but notification queue failed',{messageId:msg.Id,error}));
      } catch (e) { console.error(e); ack?.({ ok: false, error: 'Unable to send message' }); }
    });

    socket.on('call:join', async ({ conversationId, mode }, ack) => {
      try {
        const callMode=mode==='video'?'video':'audio';
        if(socket.data.callConversationId&&socket.data.callConversationId!==conversationId)return ack?.({ok:false,error:'End the current call first'});
        const callAttempt=(socket.data.callJoinVersion??0)+1;socket.data.callJoinVersion=callAttempt;
        await requireConversationContact(user.id,String(conversationId),'call');
        await requireCallParticipants(user.id,String(conversationId));
        const pool = await getPool();
        const member = await pool.request().input('cv', sql.UniqueIdentifier, conversationId).input('u', sql.UniqueIdentifier, user.id)
          .query("SELECT 1 ok FROM ConversationMembers cm JOIN Conversations cv ON cv.Id=cm.ConversationId JOIN Communities community ON community.Id=cv.CommunityId AND community.PlatformStatus='ACTIVE' JOIN CommunityMembers membership ON membership.CommunityId=cv.CommunityId AND membership.UserId=cm.UserId WHERE cm.ConversationId=@cv AND cm.UserId=@u AND cm.IsActive=1 AND membership.Status='ACTIVE'");
        if (!member.recordset[0]) return ack?.({ ok: false, error: 'Forbidden' });
        if(socket.data.callJoinVersion!==callAttempt)return ack?.({ok:false,error:'Call cancelled'});
        const room = `call:${conversationId}`;
        const peers = [...(io.sockets.adapter.rooms.get(room) ?? [])];
        socket.join(room);
        socket.data.callConversationId = conversationId;
        socket.data.callMode=callMode;
        if(peers.length){
          const host=peers.map(peerId=>io.sockets.sockets.get(peerId)).find(peerSocket=>peerSocket?.data.callMessageId);
          const connectedAt=host?.data.callConnectedAt??Date.now();
          socket.data.callMessageId=host?.data.callMessageId;socket.data.callStartedAt=host?.data.callStartedAt;socket.data.callConnectedAt=connectedAt;
          for(const peerId of peers){const peerSocket=io.sockets.sockets.get(peerId);if(peerSocket){peerSocket.data.callConnectedAt=connectedAt;peerSocket.data.callInvitees=undefined}}
          if(socket.data.callMessageId)await connectCallMessage(socket.data.callMessageId,String(conversationId),connectedAt);
          io.to(`user:${user.id}`).emit('call:answered',{conversationId});
        }else{
          const message=await createCallMessage(String(conversationId),user.id,callMode);socket.data.callMessageId=message.Id;socket.data.callStartedAt=Date.now();
        }
        socket.to(room).emit('call:participant-joined', { conversationId, socketId: socket.id, userId: user.id });
        if (peers.length === 0) {
          const members = await pool.request().input('cv', sql.UniqueIdentifier, conversationId).input('u', sql.UniqueIdentifier, user.id)
            .query("SELECT cm.UserId,CONCAT(caller.FirstName,' ',caller.LastName) CallerName,cv.Name ConversationName FROM ConversationMembers cm JOIN Conversations cv ON cv.Id=cm.ConversationId JOIN CommunityMembers membership ON membership.CommunityId=cv.CommunityId AND membership.UserId=cm.UserId JOIN Users recipient ON recipient.Id=cm.UserId JOIN Users caller ON caller.Id=@u WHERE cm.ConversationId=@cv AND cm.UserId<>@u AND cm.IsActive=1 AND membership.Status='ACTIVE' AND recipient.AccountStatus='ACTIVE'");
          if(socket.data.callJoinVersion!==callAttempt)return ack?.({ok:false,error:'Call cancelled'});
          const invitees:string[]=[];
          for (const member of members.recordset) if(await allowCall(member.UserId)){invitees.push(member.UserId);io.to(`user:${member.UserId}`).emit('call:incoming',{conversationId,callerUserId:user.id,callerName:member.CallerName,conversationName:member.ConversationName,mode:callMode})}
          socket.data.callInvitees=invitees;
        }
        ack?.({ ok: true, socketId: socket.id, peers });
      } catch (e) { console.error(e); ack?.({ ok: false, error: e instanceof AppError ? e.message : 'Unable to join call' }); }
    });

    socket.on('call:decline', async ({conversationId}) => {
      try{await requireConversationContact(user.id,String(conversationId),'call');await requireCallParticipants(user.id,String(conversationId))}catch{return}
      const callSockets=await io.in(`call:${conversationId}`).fetchSockets(),host=callSockets.find(callSocket=>callSocket.data.callMessageId);
      await finishCallMessage(host?.data.callMessageId,String(conversationId),'NO_ANSWER',host?.data.callConnectedAt);
      io.to(`call:${conversationId}`).emit('call:declined',{conversationId,userId:user.id});
      io.to(`user:${user.id}`).emit('call:answered',{conversationId});
      for(const callSocket of callSockets){const liveSocket=io.sockets.sockets.get(callSocket.id);if(liveSocket){clearCallData(liveSocket);liveSocket.leave(`call:${conversationId}`)}}
    });

    socket.on('call:signal', async ({ conversationId, targetSocketId, signal }) => {
      if (socket.data.callConversationId !== conversationId) return;
      try{await requireConversationContact(user.id,String(conversationId),'call')}catch{return}
      const peers=await io.in(`call:${conversationId}`).allSockets();
      if(!peers.has(String(targetSocketId)))return;
      try{await requireCallParticipants(user.id,String(conversationId))}catch{return}
      io.to(String(targetSocketId)).emit('call:signal', { conversationId, fromSocketId: socket.id, signal });
    });

    socket.on('call:leave', async ({ conversationId }) => {
      socket.data.callJoinVersion=(socket.data.callJoinVersion??0)+1;
      const room = `call:${conversationId}`;
      await finishCallMessage(socket.data.callMessageId,String(conversationId),socket.data.callConnectedAt?'ENDED':'NO_ANSWER',socket.data.callConnectedAt);
      socket.leave(room);
      socket.to(room).emit('call:participant-left', { conversationId, socketId: socket.id });
      for(const invitee of socket.data.callInvitees??[])io.to(`user:${invitee}`).emit('call:cancelled',{conversationId});
      clearCallData(socket);
      for(const peerId of [...(io.sockets.adapter.rooms.get(room)??[])]){const peerSocket=io.sockets.sockets.get(peerId);if(peerSocket){clearCallData(peerSocket);peerSocket.leave(room)}}
    });

    socket.on('disconnect', async () => {
      if(socket.data.callConversationId){const conversationId=String(socket.data.callConversationId),room=`call:${conversationId}`;await finishCallMessage(socket.data.callMessageId,conversationId,socket.data.callConnectedAt?'ENDED':'NO_ANSWER',socket.data.callConnectedAt);socket.to(room).emit('call:participant-left',{conversationId,socketId:socket.id});for(const invitee of socket.data.callInvitees??[])io.to(`user:${invitee}`).emit('call:cancelled',{conversationId});clearCallData(socket);for(const peerId of [...(io.sockets.adapter.rooms.get(room)??[])]){const peerSocket=io.sockets.sockets.get(peerId);if(peerSocket){clearCallData(peerSocket);peerSocket.leave(room)}}}
      for(const conversationId of activeConversations)await redis.srem(`presence:conversation:${conversationId}:user:${user.id}`,socket.id);
      await redis.srem(`presence:user:${user.id}:sockets`, socket.id);
      const count = await redis.scard(`presence:user:${user.id}:sockets`);
      if (count === 0) await redis.set(`presence:user:${user.id}:lastSeen`, new Date().toISOString(), 'EX', 86400 * 30);
    });
  });
}
