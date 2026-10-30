// MRM-44 / Drumstar Service Worker
// - App-Dateien: sofort aus dem Cache, im Hintergrund aktualisiert (stale-while-revalidate) -> neue Version ist spätestens beim zweiten Start da,
//   auch wenn die Cache-Nummer einmal vergessen wird. Cache-Nummer trotzdem bei größeren Änderungen hochzählen.
// - Schriften/Bilder: Cache zuerst.
// - Offline-Fallback nur für Seitenaufrufe (und dann für die richtige Seite, nicht immer die App).
const CACHE='mrm44-v80';
const CORE=['./','./index.html','./manifest.webmanifest'];            // Pflicht: fehlt eine Datei, schlägt die Installation fehl
const OPTIONAL=['./impressum.html','./datenschutz.html','./fonts.css',
  './icons/icon-192.png','./icons/icon-512.png','./icons/logo-drumstar.png',
  './fonts/Rajdhani-Medium.woff','./fonts/Rajdhani-SemiBold.woff','./fonts/Rajdhani-Bold.woff','./fonts/VT323-Regular.woff',
  './fonts/JetBrainsMono-Regular.woff','./fonts/JetBrainsMono-Bold.woff'];  // Optional: fehlende Dateien werden übersprungen

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async c=>{
    await c.addAll(CORE);
    await Promise.all(OPTIONAL.map(u=>c.add(u).catch(()=>{})));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
function store(req,res){
  if(res && res.ok && res.type==='basic'){ const copy=res.clone(); caches.open(CACHE).then(c=>c.put(req,copy)); }
  return res;
}
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  if(req.cache==='only-if-cached' && req.mode!=='same-origin') return;
  const url=new URL(req.url);
  if(url.origin!==location.origin) return;           // Fremd-Anfragen nicht anfassen
  if(req.cache==='no-store') return;                 // z. B. default-beats.json: immer frisch vom Netz
  const isFile=/\.(?:woff2?|ttf|png|jpg|jpeg|svg|ico|mp3)$/i.test(url.pathname);
  if(isFile){
    event.respondWith(caches.match(req).then(c=>c||fetch(req).then(r=>store(req,r))));
    return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(req,{ignoreSearch:true});
    const net=fetch(req).then(r=>store(req,r)).catch(()=>null);
    if(cached){ event.waitUntil(net); return cached; }
    const fresh=await net;
    if(fresh) return fresh;
    if(req.mode==='navigate') return (await caches.match('./index.html')) || Response.error();
    return Response.error();
  })());
});
