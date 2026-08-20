import type { Server } from 'socket.io';
import { verifyAccess } from './utils/auth.js';
import { getPool, sql } from './config/db.js';
import { getRedis } from './config/redis.js';

export function configureSocket(io: Server) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string;
      socket.data.user = verifyAccess(token);
      next();
    } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', async socket => {
    const user = socket.data.user as { id: string };
    socket.join(`user:${user.id}`);
    const redis = getRedis();
    await redis.sadd(`presence:user:${user.id}:sockets`, socket.id);
    await redis.expire(`presence:user:${user.id}:sockets`, 3600);
    await redis.set(`presence:user:${user.id}:lastSeen`, new Date().toISOString(), 'EX', 86400 * 30);

    socket.on('conversation:join', async ({ conversationId }) => {
      const pool = await getPool();
      const r = await pool.request().input('cv', sql.UniqueIdentifier, conversationId).input('u', sql.UniqueIdentifier, user.id)
        .query('SELECT 1 ok FROM ConversationMembers WHERE ConversationId=@cv AND UserId=@u');
      if (r.recordset[0]) socket.join(`conversation:${conversationId}`);
    });

    socket.on('typing:start', ({ conversationId }) => socket.to(`conversation:${conversationId}`).emit('typing:start', { conversationId, userId: user.id }));
    socket.on('typing:stop', ({ conversationId }) => socket.to(`conversation:${conversationId}`).emit('typing:stop', { conversationId, userId: user.id }));

    socket.on('message:send', async (payload, ack) => {
      try {
        const d = { conversationId: String(payload.conversationId), messageText: String(payload.messageText ?? '').trim(), messageType: String(payload.messageType ?? 'TEXT') };
        if (!d.messageText) return ack?.({ ok: false, error: 'Message is empty' });
        const pool = await getPool();
        const member = await pool.request().input('cv', sql.UniqueIdentifier, d.conversationId).input('u', sql.UniqueIdentifier, user.id)
          .query('SELECT 1 ok FROM ConversationMembers WHERE ConversationId=@cv AND UserId=@u');
        if (!member.recordset[0]) return ack?.({ ok: false, error: 'Forbidden' });
        const r = await pool.request().input('cv', sql.UniqueIdentifier, d.conversationId).input('u', sql.UniqueIdentifier, user.id)
          .input('type', sql.NVarChar(30), d.messageType).input('text', sql.NVarChar(sql.MAX), d.messageText)
          .query('INSERT INTO Messages(ConversationId,SenderUserId,MessageType,MessageText) OUTPUT INSERTED.* VALUES(@cv,@u,@type,@text)');
        const msg = r.recordset[0];
        io.to(`conversation:${d.conversationId}`).emit('message:new', msg);
        ack?.({ ok: true, message: msg });
      } catch (e) { console.error(e); ack?.({ ok: false, error: 'Unable to send message' }); }
    });

    socket.on('disconnect', async () => {
      await redis.srem(`presence:user:${user.id}:sockets`, socket.id);
      const count = await redis.scard(`presence:user:${user.id}:sockets`);
      if (count === 0) await redis.set(`presence:user:${user.id}:lastSeen`, new Date().toISOString(), 'EX', 86400 * 30);
    });
  });
}
