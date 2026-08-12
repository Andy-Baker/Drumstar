const CACHE='mrm44-v1';
const APP_SHELL=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  // App shell: cache-first. External fonts/assets remain network-first and
  // fall back naturally if unavailable.
  if(url.origin===location.origin){
    event.respondWith(caches.match(event.request).then(cached=>{
      return cached || fetch(event.request).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(event.request,copy));
        return res;
      });
    }).catch(()=>caches.match('./index.html')));
  }
});
