# CDA Connect scalable backend architecture

CDA Connect now keeps the API stateless and separates durable, temporary, binary and asynchronous workloads.

```text
Web / Android / iOS
        |
   HTTPS / WSS
        |
 Load balancer
   |        |
 API-1    API-2          Node.js + TypeScript
   |        |
   +---+----+
       |
       +--> MSSQL        durable transactional records
       +--> Redis        cache, presence, rate limits, Socket.IO fan-out
       +--> BullMQ       emergency, notification and background queues
       +--> S3/MinIO     photos, videos, voice, documents and attachments
                |
              Workers
       push / email / background processing
```

## Data placement

MSSQL remains the system of record for users, communities, memberships, permissions, governance, polls/votes, events, finance, issue reports, emergency incidents, document metadata and media metadata. Redis is not the source of truth for those records.

Redis stores short-lived and rebuildable data such as presence, distributed rate-limit counters, Socket.IO adapter messages, queue state and future application caches.

Object storage contains binary files. `StoredObjects` in MSSQL records the storage key, URL, MIME type, size and uploader. Do not put photo/video bytes in user or post rows.

## Emergency delivery

Creating an emergency alert writes the incident to MSSQL first. A durable `AsyncJobAudit` record is then created and the delivery is queued in BullMQ. If Redis is temporarily unavailable the audit is marked `PENDING_RETRY`; the worker reconciles those rows after Redis returns.

Workers query active members, split delivery into batches and call configured push/email providers. The API request does not wait for the full broadcast.

## Horizontal API scaling

All API instances can share the same MSSQL, Redis, queues and object store. Socket.IO uses the Redis adapter so a member connected to API-1 can receive events produced by API-2.

Presence is keyed in Redis as `presence:user:<userId>:sockets`. Rate-limit counters use `ratelimit:<subject>:<window>`.

## Shard-ready boundary

`CommunityShardMap` exists in MSSQL and every newly created community is assigned to `primary`. `getCommunityPool(communityId)` is the routing boundary. It currently returns the primary connection pool. Later it can look up a shard assignment without requiring route-level rewrites.

Do not physically shard until observed database size, latency or operational load justifies it. Large/high-traffic communities can later be moved independently instead of relying on fixed numeric ranges.

## Important indexes

The main schema includes query-pattern indexes for community membership/status, conversation messages ordered by time, feed posts ordered by pin/time, active emergency alerts, audit history, sessions, devices and storage metadata.

## Docker deployment

`docker-compose.infrastructure.yml` runs the API, worker, Redis and MinIO. MSSQL is intentionally external so it can remain on a dedicated database VM/server.

1. Copy `backend/.env.example` to `backend/.env`.
2. Point `DB_SERVER` to the MSSQL host.
3. Set `REDIS_URL=redis://redis:6379` when using Compose.
4. Set `STORAGE_DRIVER=s3`, `STORAGE_ENDPOINT=http://minio:9000`, and the MinIO credentials.
5. Set `STORAGE_PUBLIC_BASE_URL` to the externally reachable object-storage/CDN URL.
6. Run `docker compose -f docker-compose.infrastructure.yml up -d --build`.

For production, keep MinIO/Redis management ports private, use strong secrets, TLS at the ingress, backups, monitoring and an off-host/object-storage replication plan.
