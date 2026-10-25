import type { RequestHandler } from 'express';
import { verifyAccess } from '../utils/auth.js';
import { env } from '../config/env.js';
import { getRedis } from '../config/redis.js';

export function rateLimitSubject(raw:string|undefined,ip:string|undefined){
 // Only a verified access-token identity can select a per-account bucket.
 if(raw?.startsWith('Bearer ')){try{return 'user:'+verifyAccess(raw.slice(7)).id}catch{}}
 return 'ip:'+(ip??'unknown');
}

export const distributedRateLimit: RequestHandler = async (req, res, next) => {
  try {
    const subject=rateLimitSubject(req.headers.authorization,req.ip);
    const bucket = Math.floor(Date.now() / (env.RATE_LIMIT_WINDOW_SECONDS * 1000));
    const key = `ratelimit:${subject}:${bucket}`;
    const redis = getRedis();
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, env.RATE_LIMIT_WINDOW_SECONDS + 2);
    res.setHeader('X-RateLimit-Limit', String(env.RATE_LIMIT_MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, env.RATE_LIMIT_MAX_REQUESTS - current)));
    if (current > env.RATE_LIMIT_MAX_REQUESTS) return res.set('Retry-After',String(env.RATE_LIMIT_WINDOW_SECONDS)).status(429).json({ error: 'Too many requests. Please try again shortly.' });
    next();
  } catch (error) {
    // Redis problems should not take down the main API.
    console.error('Rate limiter degraded', error);
    next();
  }
};
