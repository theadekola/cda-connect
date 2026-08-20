import { Redis } from 'ioredis';
import { env } from './env.js';

let client: Redis | null = null;
export function getRedis() {
  if (!client) {
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false
    });
    client.on('error', (error: Error) => console.error('Redis error', error));
  }
  return client;
}

export function createRedisConnection() {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });
}
