import { getPool } from './db.js';

/**
 * Community-aware database resolver.
 * Today every community resolves to the primary CDAConnect pool.
 * Later this boundary can consult a CommunityShardMap without changing routes/services.
 */
export async function getCommunityPool(_communityId: string) {
  return getPool();
}

export type CommunityShardResolution = {
  communityId: string;
  shardId: 'primary';
};

export function resolveCommunityShard(communityId: string): CommunityShardResolution {
  return { communityId, shardId: 'primary' };
}
