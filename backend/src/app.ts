import {operationalHealth} from './services/operationalHealth.js';
import {protectCookieMutation} from './services/sessionCookies.js';
import express from 'express';
import path from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { communitiesRouter } from './routes/communities.js';
import { contentRouter } from './routes/content.js';
import { chatRouter } from './routes/chat.js';
import { feedRouter } from './routes/feed.js';
import { mediaRouter } from './routes/media.js';
import { platformRouter } from './routes/platform.js';
import { safetyRouter } from './routes/safety.js';
import { advancedRouter } from './routes/advanced.js';
import { errorHandler, notFound } from './utils/errors.js';
import { distributedRateLimit } from './middleware/rateLimit.js';
import { getRedis } from './config/redis.js';
import { getPool } from './config/db.js';

export const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),credentials:true }));
app.use(express.json({ limit: '2mb' }));
app.use('/api/',protectCookieMutation);
app.use((_req,res,next)=>{res.set('Permissions-Policy','camera=(self), microphone=(self), geolocation=(self), payment=(), usb=()');next()});
if (env.STORAGE_DRIVER === 'local') app.use('/uploads', express.static(path.resolve('uploads')));
app.use('/api/', distributedRateLimit);

app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = { api: 'ok' };
  try { await (await getPool()).request().query('SELECT 1 ok'); checks.mssql = 'ok'; } catch { checks.mssql = 'error'; }
  try { checks.redis = (await getRedis().ping()) === 'PONG' ? 'ok' : 'error'; } catch { checks.redis = 'error'; }
  let operations;try{operations=await operationalHealth();checks.worker=operations.workerOk?'ok':'stale'}catch{checks.worker='error'}
  const ok = Object.values(checks).every(v => v === 'ok');
  res.status(ok ? 200 : 503).json({ ok, service: 'cda-connect-api', checks,operations });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/communities', communitiesRouter);
app.use('/api/v1', contentRouter);
app.use('/api/v1', chatRouter);
app.use('/api/v1', feedRouter);
app.use('/api/v1', mediaRouter);
app.use('/api/v1', platformRouter);
app.use('/api/v1', safetyRouter);
app.use('/api/v1', advancedRouter);
app.use(notFound);
app.use(errorHandler);
