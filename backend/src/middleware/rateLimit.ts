import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { getRedis } from '../config/redis.js';

export const distributedRateLimit: RequestHandler = async (req, res, next) => {
  try {
    const subject = req.user?.id ?? req.ip ?? 'unknown';
    const bucket = Math.floor(Date.now() / (env.RATE_LIMIT_WINDOW_SECONDS * 1000));
    const key = `ratelimit:${subject}:${bucket}`;
    const redis = getRedis();
    const current = await redis.incr(key);
    if (current === 1) await redis.expire(key, env.RATE_LIMIT_WINDOW_SECONDS + 2);
    res.setHeader('X-RateLimit-Limit', String(env.RATE_LIMIT_MAX_REQUESTS));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, env.RATE_LIMIT_MAX_REQUESTS - current)));
    if (current > env.RATE_LIMIT_MAX_REQUESTS) return res.status(429).json({ message: 'Too many requests' });
    next();
  } catch (error) {
    // Redis problems should not take down the main API.
    console.error('Rate limiter degraded', error);
    next();
  }
};
