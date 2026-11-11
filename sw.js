// MRM-44 / Drumstar Service Worker
// - App = index.html + alle darin verlinkten ./js/*.js und ./css/*.css. Die App wird nur als Ganzes aktualisiert:
//   Start aus dem Cache, im Hintergrund wird index.html geprüft; hat sie sich geändert, werden index.html und ALLE verlinkten
//   Dateien frisch geladen und erst dann gemeinsam in den Cache gelegt (schlägt eine fehl, bleibt der alte, stimmige Stand).
//   So läuft nie eine neue index.html mit alten Skripten. Neue Version ist beim nächsten Start da, auch ohne neue Cache-Nummer.
//   Die Dateiliste kommt aus index.html selbst — neue Skripte nur dort eintragen, nicht hier.
//   Links in index.html tragen ?v=<Cache-Nummer> (sonst nimmt der Browser beim Neuladen evtl. Skripte aus dem Speicher-Cache);
//   bei jedem Deploy CACHE hier und alle ?v= in index.html gemeinsam erhöhen (tests/test-sw.py prüft das).
// - Schriften/Bilder/Samples: Cache zuerst.
// - Übrige Seiten (Impressum …): stale-while-revalidate. Offline-Fallback nur für Seitenaufrufe.
const CACHE='mrm44-v113';
const OPTIONAL=['./impressum.html','./datenschutz.html','./fonts.css',
  './icons/icon-192.png','./icons/icon-512.png','./icons/logo-drumstar.png',
  './fonts/Rajdhani-Medium.woff','./fonts/Rajdhani-SemiBold.woff','./fonts/Rajdhani-Bold.woff','./fonts/VT323-Regular.woff',
  './fonts/JetBrainsMono-Regular.woff','./fonts/JetBrainsMono-Bold.woff'];  // Optional: fehlende Dateien werden übersprungen
const BASE=new URL('./',self.location).href;
const IDX=BASE+'index.html';

// Verlinkte App-Dateien aus dem HTML (src="./js/…", href="./css/…")
function appFiles(html){
  const out=new Set();
  for(const m of html.matchAll(/(?:src|href)="\.\/((?:js|css)\/[^"?#]+)[^"]*"/g)) out.add(BASE+m[1]);
  return [...out];
}
// Lädt index.html + alle verlinkten Dateien frisch und legt sie gemeinsam ab. Alles oder nichts.
async function installApp(c, idxRes){
  idxRes=idxRes||await fetch(IDX,{cache:'no-cache'});
  if(!idxRes.ok) throw new Error('index.html '+idxRes.status);
  const html=await idxRes.clone().text();
  const urls=[BASE+'manifest.webmanifest',...appFiles(html)];
  const got=await Promise.all(urls.map(u=>fetch(u,{cache:'no-cache'}).then(r=>{ if(!r.ok) throw new Error(u+' '+r.status); return [u,r]; })));
  await Promise.all(got.map(([u,r])=>c.put(u,r)));
  await c.put(BASE,idxRes.clone()); await c.put(IDX,idxRes);   // index.html zuletzt: erst dann gilt der neue Stand
}
let checking=null;
function checkUpdate(){                // höchstens eine Prüfung gleichzeitig
  if(checking) return checking;
  checking=(async()=>{
    const c=await caches.open(CACHE);
    const res=await fetch(IDX,{cache:'no-cache'}); if(!res.ok) return;
    const old=await c.match(IDX);
    if(old && await old.text()===await res.clone().text()) return;
    await installApp(c,res);
    (await self.clients.matchAll()).forEach(cl=>cl.postMessage({type:'update-ready'})); // Seite zeigt „neu laden“ an der Versionsnummer
  })().catch(()=>{}).finally(()=>{ checking=null; });
  return checking;
}

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(async c=>{
    await installApp(c);
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
  const path=url.origin+url.pathname;
  // App-Start: aus dem Cache, Update im Hintergrund als Ganzes
  if(path===BASE || path===IDX){
    event.respondWith((async()=>{
      const cached=await caches.match(IDX);
      if(cached){ event.waitUntil(checkUpdate()); return cached; }
      try{ return await fetch(req); } catch(e){ return Response.error(); }
    })());
    return;
  }
  // App-Dateien und Dateien: Cache zuerst (App-Dateien werden nur über checkUpdate erneuert)
  const isApp=path.startsWith(BASE+'js/') || path.startsWith(BASE+'css/');
  const isFile=/\.(?:woff2?|ttf|png|jpg|jpeg|svg|ico|mp3)$/i.test(url.pathname);
  if(isApp || isFile){
    event.respondWith(caches.match(req,{ignoreSearch:isApp}).then(c=>c||fetch(req).then(r=>store(req,r))));
    return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(req,{ignoreSearch:true});
    const net=fetch(req).then(r=>store(req,r)).catch(()=>null);
    if(cached){ event.waitUntil(net); return cached; }
    const fresh=await net;
    if(fresh) return fresh;
    if(req.mode==='navigate') return (await caches.match(IDX)) || Response.error();
    return Response.error();
  })());
});
