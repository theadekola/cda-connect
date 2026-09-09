// Cache no authenticated content. Offline launch displays only this public fallback.
const CACHE='cda-v2-public-v1';
self.addEventListener('install',event=>event.waitUntil(Promise.all([caches.open(CACHE).then(cache=>cache.add('/offline.html')),self.skipWaiting()])));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cda-v2-public-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'&&event.request.method==='GET')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')))});

self.addEventListener('push',event=>{
 event.waitUntil(self.registration.showNotification('CDA Connect',{
  body:'You have a new notification. Open CDA Connect to read it.',
  icon:'/icon-192.png',badge:'/icon-192.png',tag:'cda-updates',data:{url:'/notifications'}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL('/notifications',self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(target);return client.focus()}}
  return self.clients.openWindow(target);
 }));
});
