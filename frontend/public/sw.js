// Cache no authenticated content. Offline launch displays only this public fallback.
const CACHE='cda-v2-public-v1';
self.addEventListener('install',event=>event.waitUntil(Promise.all([caches.open(CACHE).then(cache=>cache.add('/offline.html')),self.skipWaiting()])));
self.addEventListener('activate',event=>event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cda-v2-public-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('message',event=>{if(event.data==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('fetch',event=>{if(event.request.mode==='navigate'&&event.request.method==='GET')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')))});

function safeDestination(value){if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\x00-\x1f]/.test(value))return '/notifications';try{const url=new URL(value,self.location.origin);return url.origin===self.location.origin?url.pathname+url.search+url.hash:'/notifications'}catch{return '/notifications'}}
self.addEventListener('push',event=>{
 let content={};try{content=event.data?.json()||{}}catch{}
 event.waitUntil(self.registration.showNotification(typeof content.title==='string'?content.title.slice(0,180):'CDA Connect',{
  body:typeof content.body==='string'?content.body.slice(0,500):'You have a new notification. Open CDA Connect to read it.',
  icon:'/icon-192.png',badge:'/icon-192.png',tag:typeof content.tag==='string'&&/^cda-[a-z0-9-]{1,80}$/i.test(content.tag)?content.tag:'cda-'+crypto.randomUUID(),data:{url:safeDestination(content.url)}
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(safeDestination(event.notification.data?.url),self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.navigate(target);return client.focus()}}
  return self.clients.openWindow(target);
 }));
});
