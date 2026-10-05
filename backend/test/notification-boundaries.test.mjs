import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('audit logging cannot dispatch notifications',async()=>{
  const source=await readFile(new URL('../src/services/audit.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/enqueueCommunityNotification|notificationQueue/);
});

test('notification job IDs use the colon-free event format',async()=>{
  const source=await readFile(new URL('../src/queues/index.ts',import.meta.url),'utf8');
  assert.match(source,/jobId:`push_\$\{message\.type/);
  assert.doesNotMatch(source,/jobId:`push:/);
});

test('feed post notifications cover every supported core post presentation',async()=>{
  const source=await readFile(new URL('../src/routes/feed.ts',import.meta.url),'utf8');
  for(const postType of ['TEXT','PHOTO','VIDEO','DOCUMENT','POLL','EVENT']) assert.match(source,new RegExp(`'${postType}'`));
  assert.match(source,/isAnnouncement:z\.boolean\(\)/);
  assert.match(source,/type:'POST'/);
  assert.doesNotMatch(source,/type:d\.isAnnouncement\?'ANNOUNCEMENT':'POST'/);
});

test('post push body is contextual and never includes the full post body',async()=>{
  const source=await readFile(new URL('../src/routes/feed.ts',import.meta.url),'utf8');
  assert.match(source,/shared a new post in/);
  assert.doesNotMatch(source,/body:d\.body\|\|d\.caption/);
  assert.match(source,/data:\{type:'POST',communityId:req\.params\.communityId,postId\}/);
});

test('comment notifications use comment identity and complete navigation data',async()=>{
  const source=await readFile(new URL('../src/routes/feed.ts',import.meta.url),'utf8');
  assert.match(source,/entityId:comment\.Id/);
  assert.match(source,/data:\{type:'COMMENT',communityId:p\.CommunityId,postId:req\.params\.postId,commentId:comment\.Id\}/);
  assert.match(source,/Parent comment must belong to this post/);
  assert.match(source,/recipients=new Map/);
});

test('notification previews remove URLs, markup, and line breaks',async()=>{
  const source=await readFile(new URL('../src/routes/feed.ts',import.meta.url),'utf8');
  assert.match(source,/https\?:\\\/\\\/\\S\+/);
  assert.match(source,/replace\(\/\<\[\^\>\]\*\>/);
  assert.match(source,/replace\(\/\[\\r\\n\]\+\//);
});

test('delayed dispatch excludes late joiners, blocked users, and suspended accounts',async()=>{
  const source=await readFile(new URL('../src/workers/worker.ts',import.meta.url),'utf8');
  assert.match(source,/cm\.JoinedAt<=@occurred/);
  assert.match(source,/recipientUser\.AccountStatus='ACTIVE'/);
  assert.match(source,/BlockedUsers/);
});

test('chat reconnects are idempotent and acknowledgements do not wait for notifications',async()=>{
  const source=await readFile(new URL('../src/socket.ts',import.meta.url),'utf8');
  assert.match(source,/ClientMessageId/);
  assert.match(source,/UPDLOCK,HOLDLOCK/);
  assert.match(source,/duplicate:true/);
  const acknowledgement=source.indexOf("ack?.({ ok: true, message: msg })");
  const notification=source.indexOf('void enqueueCommunityNotification',acknowledgement);
  assert.ok(acknowledgement>=0&&notification>acknowledgement);
});

test('chat eligibility includes active memberships, mute, blocks and active-view suppression',async()=>{
  const socket=await readFile(new URL('../src/socket.ts',import.meta.url),'utf8');
  const worker=await readFile(new URL('../src/workers/worker.ts',import.meta.url),'utf8');
  assert.match(socket,/member\.IsActive=1/);
  assert.match(socket,/communityMember\.Status='ACTIVE'/);
  assert.match(worker,/cv\.MutedUntil/);
  assert.match(worker,/BlockedUsers/);
  assert.match(worker,/presence:conversation:/);
});

test('formal announcement produces one bounded notification event with navigation',async()=>{
  const source=await readFile(new URL('../src/routes/content.ts',import.meta.url),'utf8');
  const route=source.slice(source.indexOf("contentRouter.post('/communities/:communityId/announcements'"),source.indexOf("contentRouter.get('/communities/:communityId/meetings'"));
  assert.match(route,/ANNOUNCEMENT_CREATE/);
  assert.equal((route.match(/enqueueCommunityNotification/g)||[]).length,1);
  assert.match(route,/notificationPreview\(d\.body\)/);
  assert.match(route,/announcementId:announcement\.Id/);
  assert.doesNotMatch(route,/body:d\.body/);
});

test('persisted notification history and server read state are used',async()=>{
  const worker=await readFile(new URL('../src/workers/worker.ts',import.meta.url),'utf8');
  const routes=await readFile(new URL('../src/routes/advanced.ts',import.meta.url),'utf8');
  assert.match(worker,/INSERT INTO UserNotifications/);
  assert.match(routes,/FROM UserNotifications n/);
  assert.match(routes,/notifications\/read-all/);
  assert.match(routes,/This content is no longer available\./);
});

test('call signalling preserves media mode and supports ringing, decline and cancellation',async()=>{
  const socket=await readFile(new URL('../src/socket.ts',import.meta.url),'utf8');
  const chat=await readFile(new URL('../src/routes/chat.ts',import.meta.url),'utf8');
  assert.match(socket,/mode:callMode/);
  assert.match(socket,/call:decline/);
  assert.match(socket,/call:cancelled/);
  assert.match(socket,/call:answered/);
  assert.match(socket,/CallerName/);
  assert.match(socket,/MessageType='CALL'/);
  assert.match(socket,/createCallMessage/);
  assert.match(socket,/connectCallMessage/);
  assert.match(socket,/finishCallMessage/);
  assert.match(socket,/message:updated/);
  assert.match(socket,/e instanceof AppError \? e\.message : 'Unable to join call'/);
  assert.match(chat,/calls\/ice/);
  assert.match(chat,/Cache-Control','private, no-store/);
});

test('join checks do not open notification queue connections before a request is created',async()=>{
  const source=await readFile(new URL('../src/services/communityJoin.ts',import.meta.url),'utf8');
  const routes=await readFile(new URL('../src/routes/communities.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/^import \{enqueueCommunityNotification\}/m);
  assert.match(source,/await import\('\.\.\/queues\/index\.js'\)/);
  assert.match(source,/row\?\.Result==='PENDING'&&row\.RequestId/);
  assert.doesNotMatch(routes,/^import \{enqueueCommunityNotification\}/m);
  assert.match(routes,/async function enqueueCommunityNotification/);
});

test('in-app activity is persisted before outbound preferences can mute delivery',async()=>{
  const worker=await readFile(new URL('../src/workers/worker.ts',import.meta.url),'utf8');
  const persisted=worker.indexOf('INSERT INTO UserNotifications');
  const muted=worker.indexOf("'MUTED','Outbound delivery preferences or conversation presence'");
  assert.ok(persisted>0&&muted>persisted);
  assert.match(worker,/requiredPermission/);
  assert.match(worker,/permission\.Code=@requiredPermission/);
});

test('document reads share authoritative visibility and role access checks',async()=>{
  const source=await readFile(new URL('../src/routes/advanced.ts',import.meta.url),'utf8');
  const access=await readFile(new URL('../src/services/documentAccess.ts',import.meta.url),'utf8');
  assert.match(source,/documentVisibility/);
  assert.match(access,/d\.Visibility='ADMINS'/);
  assert.match(access,/DOCUMENT_MANAGE/);
  assert.match(access,/KnowledgeDocumentAccess/);
  assert.match(access,/AccountStatus='ACTIVE'/);
  assert.match(source,/get\('\/documents\/:documentId\/history'/);
});

test('document APIs use stored object IDs and never return permanent URLs',async()=>{
  const source=await readFile(new URL('../src/routes/advanced.ts',import.meta.url),'utf8');
  const documentBlock=source.slice(source.indexOf("advancedRouter.get('/communities/:communityId/documents'"),source.indexOf('// Personal preferences'));
  assert.match(documentBlock,/storedObjectId:z\.string\(\)\.uuid\(\)/);
  assert.match(documentBlock,/download-url/);
  assert.doesNotMatch(documentBlock,/fileUrl:z\.string/);
  assert.doesNotMatch(documentBlock,/SELECT d\.\*,v\.FileUrl/);
  assert.match(documentBlock,/attachment\.DeletedAt IS NULL/);
});

test('general upload rejects archives, executable content, broad text and octet-stream MIME',async()=>{
  const source=await readFile(new URL('../src/routes/media.ts',import.meta.url),'utf8');
  assert.doesNotMatch(source,/application\/octet-stream/);
  assert.doesNotMatch(source,/mimetype\.startsWith\('text\/'\)/);
  assert.doesNotMatch(source,/application\/zip|x-rar|x-7z/);
  assert.match(source,/matchesSignature/);
  assert.match(source,/UploadState/);
  assert.match(source,/CommunityFiles>=250/);
  assert.match(source,/attempts>5/);
});

test('document list metadata remains deterministic when attachments are missing or deleted',async()=>{
  const source=await readFile(new URL('../src/routes/advanced.ts',import.meta.url),'utf8');
  assert.match(source,/LEFT JOIN StoredObjects attachment ON attachment\.Id=versionRow\.StoredObjectId/);
  assert.match(source,/ORDER BY d\.UpdatedAt DESC,d\.Id/);
  assert.match(source,/OriginalName FileName/);
  assert.match(source,/SizeBytes/);
  assert.match(source,/UploaderFirstName/);
});

test('membership cards are revocable, replaceable credentials and scans reveal minimal data',async()=>{
  const platform=await readFile(new URL('../src/routes/platform.ts',import.meta.url),'utf8');
  const communities=await readFile(new URL('../src/routes/communities.ts',import.meta.url),'utf8');
  const migration=await readFile(new URL('../sql/membership-card-exco-lifecycle.sql',import.meta.url),'utf8');
  assert.match(platform,/mc\.IsActive=1/);
  assert.match(platform,/mc\.ExpiresAt IS NULL OR mc\.ExpiresAt>SYSUTCDATETIME/);
  assert.match(platform,/cm\.Status='ACTIVE'/);
  assert.match(platform,/u\.AccountStatus='ACTIVE'/);
  assert.match(platform,/membership-scan:/);
  assert.match(platform,/ISOLATION_LEVEL\.SERIALIZABLE/);
  assert.match(platform,/alreadyCheckedIn/);
  assert.match(communities,/UPDATE MembershipCards SET IsActive=0/);
  assert.match(migration,/UX_MembershipCards_Active_Membership/);
  assert.doesNotMatch(platform,/member:\{[^}]*Email/);
});

test('membership card presentation does not expose its QR credential',async()=>{
  const source=await readFile(new URL('../../frontend/src/card.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(source,/>\s*\{str\(r\.(QrToken|QrPayload)\)\}/);
  assert.match(source,/<QRCodeSVG value=\{qr\}/);
  assert.match(source,/gcTime:0/);
  assert.doesNotMatch(source,/Replace card<|Edit profile</);
  assert.match(source,/retry:false/);
});

test('executive history permits only one active appointment per user',async()=>{
  const migration=await readFile(new URL('../sql/membership-card-exco-lifecycle.sql',import.meta.url),'utf8');
  const platform=await readFile(new URL('../src/routes/platform.ts',import.meta.url),'utf8');
  assert.match(migration,/WHERE Status='ACTIVE'/);
  assert.match(platform,/ex\.UserId=cm\.UserId/);
  assert.match(platform,/ORDER BY ex\.AppointedDate DESC,ex\.Id/);
});

test('poll and meeting creation each enqueue one bounded navigation event',async()=>{
  const source=await readFile(new URL('../src/routes/content.ts',import.meta.url),'utf8');
  const meeting=source.slice(source.indexOf("contentRouter.post('/communities/:communityId/meetings'"),source.indexOf("contentRouter.post('/meetings/:meetingId/rsvp'"));
  const poll=await readFile(new URL('../src/routes/polls.ts',import.meta.url),'utf8');
  const dispatch=await readFile(new URL('../src/services/pollNotifications.ts',import.meta.url),'utf8');
  assert.equal((meeting.match(/enqueueCommunityNotification/g)||[]).length,1);
  assert.match(meeting,/meetingId:r\.recordset\[0\]\.Id/);
  assert.doesNotMatch(meeting,/body:d\.description/);
  assert.equal(poll.split('await pollNotifications(tx,poll)').length-1,1);
  assert.match(dispatch,/targetUserId:member.UserId/);
  assert.ok(dispatch.includes('if(!reminder&&!settings.notify)return'));
  assert.ok(dispatch.includes('WITH(UPDLOCK,HOLDLOCK)'));
  assert.match(dispatch,/pollId:poll.Id/);
  assert.match(poll,/Poll options must be unique/);
});

test('emergency broadcasts are durable, idempotent and separate from ordinary preferences',async()=>{
  const queue=await readFile(new URL('../src/queues/index.ts',import.meta.url),'utf8');
  const worker=await readFile(new URL('../src/workers/worker.ts',import.meta.url),'utf8');
  const content=await readFile(new URL('../src/routes/content.ts',import.meta.url),'utf8');
  const migration=await readFile(new URL('../sql/emergency-delivery-reliability.sql',import.meta.url),'utf8');
  assert.match(queue,/jobId: `emergency_\$\{alertId\}`/);
  assert.doesNotMatch(queue,/jobId: `emergency:/);
  assert.match(queue,/UPDLOCK,HOLDLOCK/);
  assert.match(worker,/EmergencyNotificationDeliveries/);
  assert.match(worker,/Status='SENT'/);
  assert.match(migration,/UQ_EmergencyNotificationDeliveries_Target/);
  const responseRoute=content.slice(content.indexOf("contentRouter.post('/alerts/:alertId/respond'"));
  assert.doesNotMatch(responseRoute,/enqueueEmergencyBroadcast/);
  assert.doesNotMatch(worker,/EmergencyAlerts.*CommunityPosts|CommunityPosts.*EmergencyAlerts/);
});

test('native deployment runs isolated API, worker and loopback Redis services',async()=>{
  const worker=await readFile(new URL('../src/workers/worker.ts',import.meta.url),'utf8');
  const apiUnit=await readFile(new URL('../../deploy/cda-api.service',import.meta.url),'utf8');
  const workerUnit=await readFile(new URL('../../deploy/cda-worker.service',import.meta.url),'utf8');
  const installer=await readFile(new URL('../../deploy/install-native.sh',import.meta.url),'utf8');
  assert.match(worker,/SIGTERM/);
  assert.match(worker,/emergencyWorker\.close\(\)/);
  assert.match(apiUnit,/User=cda-app/);
  assert.match(apiUnit,/ProtectSystem=strict/);
  assert.match(workerUnit,/dist\/workers\/worker.js/);
  assert.match(installer,/bind 127\.0\.0\.1/);
  assert.match(installer,/appendonly yes/);
  assert.match(installer,/requirepass/);
});

test('registration retains an optional postal code field',async()=>{
  const source=await readFile(new URL('../../frontend/src/auth.tsx',import.meta.url),'utf8');
  assert.match(source,/postcode/);
});

test('current UI disables forms and buttons during submission',async()=>{
  const source=await readFile(new URL('../../frontend/src/ui.tsx',import.meta.url),'utf8');
  assert.match(source,/fieldset disabled=\{busy\}/);
  assert.match(source,/button[^>]*disabled=\{busy\}/);
  assert.match(source,/if\(busy\)return/);
});

test('public media uploads return a URL while private document, chat, issue and levy uploads do not',async()=>{
  const media=await readFile(new URL('../src/routes/media.ts',import.meta.url),'utf8');
  const api=await readFile(new URL('../../frontend/src/assetUrl.ts',import.meta.url),'utf8');
  assert.match(media,/\.\.\.\(documentUpload\|\|chatUpload\|\|issueUpload\|\|levyUpload\?\{\}:\{url:stored\.url\}\)/);
  assert.match(api,/localhost','127\.0\.0\.1','0\.0\.0\.0/);
  assert.match(api,/new URL\(url\.pathname\+url\.search\+url\.hash,apiUrl\.origin\)/);
  assert.match(api,/url\.pathname\.startsWith\('\/uploads\/'\)/);
});


