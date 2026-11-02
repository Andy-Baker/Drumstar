# Drumstar-Test (Playwright, headless): Service Worker — App-Dateien (index.html + js/ + css/) im Cache, Start offline,
# Update nur als Ganzes (neue index.html nie mit alten Skripten; scheitert eine Datei, bleibt der alte Stand).
# Start über tests/run.py (ändert Dateien in der Temp-Kopie). Direkt: python3 test-sw.py URL AUSGABEORDNER SITE-ORDNER
import asyncio, sys, re, pathlib
from playwright.async_api import async_playwright
URL=sys.argv[1].replace('127.0.0.1','localhost')   # Service Worker nur über https oder localhost
OUT=sys.argv[2]; SITE=pathlib.Path(sys.argv[3])
res=[]
def ok(n,c,extra=''): res.append(('PASS ' if c else 'FAIL ')+n+(' '+str(extra) if extra else '')); print(res[-1],flush=True)
CACHED="""async()=>{ const ks=await caches.keys(); if(!ks.length) return null; const c=await caches.open(ks[0]);
  const idx=await c.match('index.html'), main=await c.match('js/main.js');
  return {keys:ks, urls:(await c.keys()).map(r=>new URL(r.url).pathname.replace(/^.*?\\/(js|css)\\//,'$1/')),
          idx:idx?await idx.text():'', main:main?await main.text():''}; }"""
async def main():
  files=sorted(re.findall(r'(?:src|href)="\./((?:js|css)/[^"]+)"',(SITE/'index.html').read_text(encoding='utf8')))
  ok('index.html verlinkt js/ und css/', len(files)>5 and any(f.startswith('css/') for f in files), len(files))
  cache=re.search(r"const CACHE='mrm44-v(\d+)'",(SITE/'sw.js').read_text(encoding='utf8')).group(1)
  vs={f.split('?v=')[1] if '?v=' in f else None for f in files}
  ok('Alle js/css-Links tragen ?v= gleich der Cache-Nummer in sw.js', vs=={cache}, (vs,cache))
  files=[f.split('?')[0] for f in files]
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--host-resolver-rules=MAP localhost 127.0.0.1'])
    ctx=await b.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:300]))
    async def boot(n):
      await pg.reload(wait_until='domcontentloaded') if n else await pg.goto(URL,wait_until='domcontentloaded')
      await pg.wait_for_function('window.__T && __T.length>0',timeout=15000)
    async def cached(): return await pg.evaluate(CACHED)
    async def wait_cache(pred,ms=10000):
      for _ in range(ms//250):
        c=await cached()
        if c and pred(c): return c
        await pg.wait_for_timeout(250)
      return await cached()
    await boot(0)
    await pg.evaluate("navigator.serviceWorker.ready.then(()=>1)")
    await boot(1)
    ok('Seite wird vom Service Worker gesteuert', await pg.evaluate("!!navigator.serviceWorker.controller"))
    c=await wait_cache(lambda c: all(f in c['urls'] for f in files))
    ok('Alle App-Dateien im Cache', c and all(f in c['urls'] for f in files), [f for f in files if not c or f not in c['urls']])
    # --- Offline starten
    await ctx.set_offline(True); errs.clear(); await boot(1)
    ok('Start offline ohne Fehler', not errs, errs[:3])
    await ctx.set_offline(False)
    # --- Update: index.html + main.js ändern → erster Start alt, danach beides neu
    idx=SITE/'index.html'; mainjs=SITE/'js/main.js'; base=SITE/'js/base.js'
    i0, m0 = idx.read_text(encoding='utf8'), mainjs.read_text(encoding='utf8')
    idx.write_text(i0.replace('?v=','?v=t2-').replace('</body>','<!-- sw-v2 -->\n</body>'),encoding='utf8'); mainjs.write_text(m0+'\nwindow.__swv=2;\n',encoding='utf8')
    await boot(1)
    ok('Erster Start nach Update noch aus dem Cache (alter Stand)', await pg.evaluate("window.__swv===undefined"))
    c=await wait_cache(lambda c: 'sw-v2' in c['idx'])
    ok('Neuer Stand im Cache: index.html und Skript gemeinsam', c and 'sw-v2' in c['idx'] and '__swv=2' in c['main'])
    await pg.wait_for_timeout(300)
    vt=await pg.evaluate("($id('appVer')||{}).textContent||''")
    ok('Versionsnummer zeigt alten Stand + „Update da“', vt.startswith('v') and 't2-' not in vt and 'Update da' in vt, vt)
    errs.clear(); await boot(1)
    ok('Zweiter Start: neue Skripte laufen', await pg.evaluate("window.__swv===2") and not errs, errs[:3])
    vt=await pg.evaluate("($id('appVer')||{}).textContent||''")
    ok('Versionsnummer zeigt neuen Stand', vt.startswith('vt2-') and 'Update' not in vt, vt)
    # --- Update scheitert (eine Datei fehlt) → alter, stimmiger Stand bleibt
    idx.write_text(i0.replace('?v=','?v=t3-').replace('</body>','<!-- sw-v3 -->\n</body>'),encoding='utf8'); mainjs.write_text(m0+'\nwindow.__swv=3;\n',encoding='utf8')
    hidden=base.with_suffix('.weg'); base.rename(hidden)
    try:
      await boot(1); await pg.wait_for_timeout(2500)
      c=await cached()
      ok('Gescheitertes Update ändert den Cache nicht', c and 'sw-v2' in c['idx'] and 'sw-v3' not in c['idx'] and '__swv=2' in c['main'])
      errs.clear(); await boot(1)
      ok('Start danach weiter mit dem alten Stand', await pg.evaluate("window.__swv===2") and not errs, errs[:3])
    finally:
      hidden.rename(base); idx.write_text(i0,encoding='utf8'); mainjs.write_text(m0,encoding='utf8')
    await pg.screenshot(path=f'{OUT}/sw.png')
    await b.close()
  fails=[r for r in res if r.startswith('FAIL')]
  print(f'\n{len(res)-len(fails)}/{len(res)} bestanden'); sys.exit(1 if fails else 0)
asyncio.run(main())
