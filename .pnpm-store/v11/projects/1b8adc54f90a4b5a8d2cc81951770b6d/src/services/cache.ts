import { getRedis } from '../config/redis.js';

export async function getCachedJson<T>(key: string): Promise<T | null> {
  const raw = await getRedis().get(key);
  return raw ? JSON.parse(raw) as T : null;
}
export async function setCachedJson(key: string, value: unknown, ttlSeconds = 60) {
  await getRedis().set(key, JSON.stringify(value), 'EX', ttlSeconds);
}
export async function deleteCacheByPrefix(prefix: string) {
  const redis = getRedis();
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 200);
    cursor = next;
    if (keys.length) await redis.del(...keys);
  } while (cursor !== '0');
}
