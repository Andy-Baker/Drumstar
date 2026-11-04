# Drumstar-Test (Playwright, headless): Tempo erkennen (#53).
# Mikro = Chromium-Fake-Gerät mit erzeugter WAV (4/4-Beat, 124 BPM, Rauschen).
# Start über tests/run.py; direkt: python3 test-tempo.py URL AUSGABEORDNER
import asyncio, sys, math, random, struct, wave, tempfile, os
from playwright.async_api import async_playwright
URL=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8768/index.html'; OUT=sys.argv[2] if len(sys.argv)>2 else '.'; res=[]
def ok(n,c,x=''): res.append(('PASS ' if c else 'FAIL ')+n+(' '+str(x) if x else '')); print(res[-1],flush=True)

def make_wav(path, bpm=124, sec=30, sr=48000):
  random.seed(3); n=sr*sec; x=[0.04*(random.random()*2-1) for _ in range(n)]; beat=60/bpm
  def hit(t,f,dec,a,noise=False):
    s=int(t*sr)
    for i in range(int(sr*0.25)):
      if s+i>=n: break
      tt=i/sr; e=math.exp(-tt/dec)*a
      x[s+i]+=e*((random.random()*2-1) if noise else math.sin(2*math.pi*f*tt*(1+2*math.exp(-tt*30))))
  b=0
  while b*beat<sec:
    t=b*beat; hit(t,55,0.12,0.8); hit(t+beat/2,0,0.03,0.25,True)
    if b%2: hit(t,200,0.08,0.5,True)
    b+=1
  with wave.open(path,'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b''.join(struct.pack('<h',max(-32767,min(32767,int(v*20000)))) for v in x))

# Synthetischer Beat im Browser → BpmDetector direkt (ohne Mikro)
CORE_JS="""(bpm)=>{ const sr=48000, sec=10, n=sr*sec, x=new Float32Array(n), beat=60/bpm; let seed=7;
  const rnd=()=>((seed=seed*16807%2147483647)/2147483647)*2-1;
  for(let i=0;i<n;i++) x[i]=0.05*rnd();
  const hit=(t,f,dec,a,nz)=>{ const s=Math.round(t*sr); for(let i=0;i<sr*0.25&&s+i<n;i++){ const tt=i/sr,e=Math.exp(-tt/dec)*a; x[s+i]+=e*(nz?rnd():Math.sin(2*Math.PI*f*tt*(1+2*Math.exp(-tt*30)))); } };
  for(let b=0;b*beat<sec;b++){ const t=b*beat; hit(t,55,0.12,0.8); hit(t+beat/2,0,0.03,0.25,1); if(b%2) hit(t,200,0.08,0.5,1); }
  const d=BpmDetector(sr); for(let i=0;i<n;i+=128) d.push(x.subarray(i,i+128)); return d.estimate().bpm; }"""

async def main():
  wav=os.path.join(tempfile.mkdtemp(prefix='drumstar-tempo-'),'beat.wav'); make_wav(wav)
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+wav])
    ctx=await b.new_context(viewport={'width':360,'height':780}); await ctx.grant_permissions(['microphone'])
    pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.goto(URL,wait_until='domcontentloaded'); await pg.wait_for_timeout(1500)
    for t in (90,100,120,128,140):
      v=await pg.evaluate(CORE_JS,t); ok(f'Erkennung synthetisch {t}', abs(v-t)<=1, round(v,2))
    for t in (72,170): # Ränder: halbes/doppeltes Tempo erlaubt (dafür ½ / ×2)
      v=await pg.evaluate(CORE_JS,t); ok(f'Erkennung synthetisch {t} (oder ½/×2)', min(abs(v-t),abs(2*v-t),abs(v/2-t))<=1, round(v,2))
    await pg.click('#tempoControl'); await pg.wait_for_timeout(300)
    r=await pg.evaluate("""(()=>{ const row=document.getElementById('tempoOverlayRow'), o=document.getElementById('tempoOverlay');
      const bs=[...row.children].map(e=>e.getBoundingClientRect()); return {ids:[...row.children].map(e=>e.id).join(),
      fits:bs.every(r=>r.left>=0&&r.right<=innerWidth), hscroll:o.scrollWidth>o.clientWidth,
      res:document.getElementById('tdRes').offsetHeight, rec:document.getElementById('tdRecRow').hidden}; })()""")
    ok('Reihe − TAP HÖREN +', r['ids']=='tempoOverlayMinus,tempoOverlayTap,tempoOverlayHear,tempoOverlayPlus', r['ids'])
    ok('Reihe passt auf 360 px', r['fits'], r)
    ok('Vor dem Hören: keine Ergebnis- und Aufnahmezeile', r['res']==0 and r['rec'], r)
    await pg.screenshot(path=OUT+'/tempo_start.png')
    # Transport läuft → Hören stoppt ihn
    await pg.click('#tempoOverlayCloseBtn'); await pg.click('#playBtn'); await pg.wait_for_timeout(300)
    await pg.click('#tempoControl'); await pg.wait_for_timeout(200)
    await pg.click('#tempoOverlayHear'); await pg.wait_for_timeout(600)
    ok('Hören stoppt den Transport', not await pg.evaluate('isPlaying'))
    ok('Hört mit (Anzeige)', await pg.evaluate("document.getElementById('tdTag').textContent")=='HÖRT MIT')
    await pg.wait_for_timeout(4500); await pg.screenshot(path=OUT+'/tempo_listen.png')
    # Fenster schließen = abbrechen
    await pg.click('#tempoOverlayCloseBtn'); await pg.wait_for_timeout(300)
    ok('Schließen bricht ab', not await pg.evaluate('tdOn') and await pg.evaluate("document.getElementById('tdRes').hidden"))
    # Ganzer Durchlauf
    await pg.click('#tempoControl'); await pg.wait_for_timeout(200)
    await pg.click('#tempoOverlayHear')
    try: await pg.wait_for_selector('#tdRes:not([hidden])',timeout=17000); done=True
    except Exception: done=False
    ok('Ergebnis kommt (≤ 15 s)', done)
    big=int(await pg.inner_text('#tdBig') or 0); ok('Erkannt 124 ± 1 übers Mikro', abs(big-124)<=1, big)
    ok('Aufnahmezeile nach dem Hören', await pg.evaluate("!document.getElementById('tdRecRow').hidden && document.getElementById('tdRecInfo').textContent"))
    ok('½ angeboten', await pg.evaluate("[...document.querySelectorAll('#tdAlt button')].map(b=>b.dataset.m).join()")=='0.5,1')
    await pg.screenshot(path=OUT+'/tempo_result.png',full_page=True)
    await pg.click('#tdCheck'); await pg.wait_for_timeout(700); ok('Mitklicken an', await pg.evaluate('!!tdCheckTimer'))
    await pg.click('#tdAlt button[data-m="0.5"]'); await pg.wait_for_timeout(100)
    ok('½ wählt halbes Tempo', abs(int(await pg.inner_text('#tdBig'))-62)<=1)
    await pg.click('#tdAlt button[data-m="1"]'); await pg.click('#tdTake'); await pg.wait_for_timeout(100)
    ok('Übernehmen setzt Tempo', await pg.evaluate('bpm')==big and await pg.inner_text('#tempoChipVal')==str(big), await pg.evaluate('bpm'))
    ok('Mitklicken aus nach Übernehmen', not await pg.evaluate('!!tdCheckTimer'))
    # Als Sample: neuer Durchlauf, dann Aufnahme in den Sample-Editor
    await pg.click('#tempoOverlayHear'); await pg.wait_for_selector('#tdRes:not([hidden])',timeout=17000)
    await pg.click('#tdKeep'); await pg.wait_for_timeout(500)
    r=await pg.evaluate("({open:document.getElementById('sampleEditorOverlay').classList.contains('open'), st:document.getElementById('seStatus').textContent, d:seWorkingBuffer&&seWorkingBuffer.duration})")
    ok('Als Sample → Sample-Editor mit Aufnahme', r['open'] and 'Tempo erkennen' in r['st'] and r['d']>3, r)
    await pg.screenshot(path=OUT+'/tempo_sample.png')
    ok('Keine JS-Fehler', not errs, errs)
    await b.close()
  print(f"\n{sum(1 for r in res if r.startswith('PASS'))}/{len(res)} bestanden")
  sys.exit(0 if all(r.startswith('PASS') for r in res) else 1)
asyncio.run(main())
