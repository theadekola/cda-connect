import http from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { app } from './app.js';
import { env } from './config/env.js';
import { getPool } from './config/db.js';
import { createRedisConnection } from './config/redis.js';
import { configureSocket } from './socket.js';

await getPool();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') } });
const pubClient = createRedisConnection();
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));
configureSocket(io);
server.listen(env.PORT, env.HOST, () => console.log(`CDA Connect API listening on ${env.HOST}:${env.PORT}`));
