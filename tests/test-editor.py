# Drumstar-Test (Playwright, headless): Noteneditor, Klaviatur, Klang-Sheet, Harmonie, Querformat.
# Start über tests/run.py (bereitet index.html vor und startet den Server).
# Direkt: python3 test-editor.py URL AUSGABEORDNER
import asyncio, sys, json
from playwright.async_api import async_playwright
URL=sys.argv[1]; OUT=sys.argv[2]
res=[]
def ok(n,c,extra=''): res.append(('PASS ' if c else 'FAIL ')+n+(' '+str(extra) if extra else '')); print(res[-1],flush=True)
PINCH="""([f,g])=>{const vp=document.getElementById('prView'),r=vp.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
const ev=(t,id,x,y)=>vp.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:x,clientY:y,bubbles:true}));
ev('pointerdown',11,cx-50,cy-40);ev('pointerdown',12,cx+50,cy+40);
for(let i=1;i<=5;i++){const kx=1+(f-1)*i/5,ky=1+(g-1)*i/5;ev('pointermove',11,cx-50*kx,cy-40*ky);ev('pointermove',12,cx+50*kx,cy+40*ky);}
ev('pointerup',11,0,0);ev('pointerup',12,0,0);return document.getElementById('prZoomL').textContent;}"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg=await b.new_page(viewport={'width':390,'height':844}); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:300])); pg.on('console',lambda m: m.type=='error' and errs.append(m.text[:200]))
    await pg.goto(URL,wait_until='domcontentloaded'); await pg.wait_for_timeout(1500)
    s=lambda n: pg.screenshot(path=f'{OUT}/{n}.png')
    async def grp(n):
        await pg.click('#grpBtn'); await pg.click(f'#grpMenu button:has-text("{n}")'); await pg.wait_for_timeout(200)
    ev=lambda: pg.evaluate("__T[__sel()].events.map(e=>[e.s,e.n,e.l,+e.v.toFixed(2),!!e.a,!!e.sl])")
    await grp('ACID')
    await pg.evaluate("document.getElementById('taClearBtn').click()"); await pg.wait_for_timeout(100)
    await s('00_pattern_acid')
    ok('Spur-Zeile: nur ein Klang-Button', await pg.evaluate("!document.getElementById('tbSynth') && !!document.getElementById('tbSound').offsetParent"))
    await pg.click('#prPv'); await pg.wait_for_timeout(500); await s('01_editor_empty')
    ok('Editor offen', await pg.evaluate("document.getElementById('prWin').classList.contains('open')"))
    ok('Zoom 100%', (await pg.text_content('#prZoomL')).strip()=='100%', await pg.text_content('#prZoomL'))
    vb=await pg.locator('#prView').bounding_box()
    # Tippen: Note setzen (Step 3)
    cw=vb['width']/16
    await pg.mouse.click(vb['x']+cw*2.5, vb['y']+vb['height']*0.5); await pg.wait_for_timeout(150)
    e1=await ev(); ok('Tippen setzt Note', len(e1)==1 and e1[0][0]==2, e1)
    ok('Notenleiste zeigt Auswahl', await pg.evaluate("!!document.querySelector('#prFoot .pr-info')"))
    await s('02_note_selected')
    # leer tippen bei Auswahl = abwählen, nicht setzen
    await pg.mouse.click(vb['x']+cw*8.5, vb['y']+vb['height']*0.3); await pg.wait_for_timeout(150)
    ok('Mit Auswahl leer tippen = abwählen', len(await ev())==1 and not await pg.evaluate("!!document.querySelector('#prFoot .pr-info')"))
    await pg.mouse.click(vb['x']+cw*8.5, vb['y']+vb['height']*0.3); await pg.wait_for_timeout(150)
    ok('zweite Note gesetzt', len(await ev())==2)
    # Note ziehen: zweite Note um 2 Steps nach rechts
    n=pg.locator('#prNotes .prn.sel'); bb=await n.bounding_box()
    await pg.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2); await pg.mouse.down(); await pg.mouse.move(bb['x']+bb['width']/2+cw*2,bb['y']+bb['height']/2,steps=6); await pg.mouse.up(); await pg.wait_for_timeout(150)
    e=await ev(); ok('Note verschieben', any(x[0]==10 for x in e), e)
    # Länge: Griff ziehen
    h=pg.locator('#prNotes .prn.sel .prhd'); hb=await h.bounding_box()
    await pg.mouse.move(hb['x']+12,hb['y']+12); await pg.mouse.down(); await pg.mouse.move(hb['x']+12+cw*2,hb['y']+12,steps=5); await pg.mouse.up(); await pg.wait_for_timeout(150)
    e=await ev(); ok('Länge per Griff', any(x[0]==10 and x[2]==3 for x in e), e)
    # Accent / Slide / Duplizieren
    await pg.click('#prFoot [data-pa=acc]'); await pg.click('#prFoot [data-pa=sld]'); await pg.wait_for_timeout(100)
    e=await ev(); ok('Accent+Slide', any(x[0]==10 and x[4] and x[5] for x in e), e)
    await pg.click('#prFoot [data-pa=dup]'); await pg.wait_for_timeout(100)
    e=await ev(); ok('Duplizieren', len(e)==3 and any(x[0]==13 for x in e), e)
    await pg.click('#prFoot [data-pa=del]'); await pg.wait_for_timeout(100)
    ok('Löschen', len(await ev())==2)
    await pg.click('#prTool [data-pa=undo]'); await pg.wait_for_timeout(150)
    ok('Rückgängig', len(await ev())==3)
    # Velocity
    vr=await pg.locator('#prVel').bounding_box()
    await pg.mouse.click(vr['x']+cw*2.5, vr['y']+vr['height']*0.8); await pg.wait_for_timeout(100)
    e=await ev(); ok('Velocity setzen', any(x[0]==2 and x[3]<0.4 for x in e), e)
    # Pinch Zoom + Pan
    z=await pg.evaluate(PINCH,[0.5,1]); ok('Pinch raus bleibt bei 16 Steps = 100% (Minimum)', z.strip()=='100%', z)
    z=await pg.evaluate(PINCH,[3,1.5]); ok('Pinch rein', int(z.strip('%'))>120, z)
    sx0=await pg.evaluate("__T[__sel()]._prv.sx")
    await pg.mouse.move(vb['x']+300,vb['y']+300); await pg.mouse.down(); await pg.mouse.move(vb['x']+100,vb['y']+250,steps=6); await pg.mouse.up(); await pg.wait_for_timeout(100)
    sx1=await pg.evaluate("__T[__sel()]._prv.sx"); ok('Ein Finger leer = scrollen', sx1>sx0, (sx0,sx1)); ok('Scrollen setzt keine Note', len(await ev())==3)
    await s('03_zoomed')
    await pg.click('#prTool [data-pa=fit]'); await pg.wait_for_timeout(150); await s('04_fit')
    # Abspielen + Playhead + Pos
    await pg.click('#prFoot [data-pa=play]'); await pg.wait_for_timeout(1500)
    ok('Playhead sichtbar', await pg.evaluate("getComputedStyle(document.getElementById('prPh')).display!=='none'"))
    ok('Position läuft', (await pg.text_content('#prPos'))!='1.1.1', await pg.text_content('#prPos'))
    await s('05_playing')
    await pg.click('#prFoot [data-pa=play]'); await pg.wait_for_timeout(200)
    # Solo
    await pg.click('#prFoot [data-pa=solo]'); ok('Solo an', await pg.evaluate("!!__T[__sel()].solo")); await pg.click('#prFoot [data-pa=solo]')
    # Klaviatur
    await pg.click('#prTool [data-pm=play]'); await pg.wait_for_timeout(400); await s('06_keys')
    nk=await pg.evaluate("document.querySelectorAll('#prKb .pkw').length"); ok('11 weiße Tasten', nk==11, nk)
    mw=await pg.locator('#prMw').bounding_box(); lab0=await pg.text_content('#prZoomL')
    await pg.mouse.move(mw['x']+mw['width']-4,mw['y']+15); await pg.mouse.down(); await pg.mouse.move(mw['x']+mw['width']+40,mw['y']+15,steps=4); await pg.mouse.up(); await pg.wait_for_timeout(150)
    nk2=await pg.evaluate("document.querySelectorAll('#prKb .pkw').length"); ok('Rand ziehen = mehr Tasten', nk2>nk, nk2)
    mw=await pg.locator('#prMw').bounding_box()
    await pg.mouse.move(mw['x']+mw['width']/2,mw['y']+15); await pg.mouse.down(); await pg.mouse.move(mw['x']+mw['width']/2+50,mw['y']+15,steps=4); await pg.mouse.up(); await pg.wait_for_timeout(150)
    ok('Fenster ziehen = Lage', (await pg.text_content('#prZoomL'))!=lab0, await pg.text_content('#prZoomL'))
    k=pg.locator('#prKb .pkw').nth(3); kb=await k.bounding_box(); await pg.mouse.click(kb['x']+kb['width']/2,kb['y']+kb['height']*0.8)
    ok('Taste spielbar (kein Fehler)', not errs, errs)
    # Rec: im Bearbeiten-Modus -> wechselt zu Spielen
    await pg.click('#prTool [data-pm=edit]'); await pg.wait_for_timeout(200)
    await pg.click('#prFoot [data-pa=rec]'); await pg.wait_for_timeout(200)
    ok('Rec schaltet auf Klaviatur', await pg.evaluate("document.getElementById('prWin').classList.contains('play')"))
    await pg.click('#prFoot [data-pa=rec]'); await pg.click('#prTool [data-pm=edit]'); await pg.wait_for_timeout(200)
    # Klang-Sheet
    await pg.click('#prTop [data-pa=klang]'); await pg.wait_for_timeout(350); await s('07_klang_sound')
    ok('Klang Sound: Filter-Regler', await pg.evaluate("document.querySelectorAll('#klRows .srow').length")==5)
    await pg.click('#klTabs [data-t=fx]'); await pg.wait_for_timeout(150); await s('08_klang_fx')
    await pg.click('#klTabs [data-t=key]'); await pg.wait_for_timeout(150); await s('09_klang_key')
    await pg.click('#klRows .kl-keys button:has-text("C")'); await pg.wait_for_timeout(150)
    ok('Grundton C', await pg.evaluate("__T[__sel()].rootNote")==3)
    await pg.click('#klRows .kl-scales button:has-text("Dorisch")'); await pg.wait_for_timeout(150)
    ok('Skala Dorisch', await pg.evaluate("__T[__sel()].scale")=='dorian')
    await pg.click('#klX'); await pg.wait_for_timeout(250)
    await pg.click('#prTop [data-pa=opt]'); await pg.wait_for_timeout(350); await s('10_opt')
    await pg.click('#prShRows .pr-orow:nth-of-type(2) button:has-text("AUS")'); await pg.wait_for_timeout(150)
    ok('Nur Skalentöne aus -> mehr Zeilen', await pg.evaluate("document.querySelectorAll('#prCv .prr').length")>60, await pg.evaluate("document.querySelectorAll('#prCv .prr').length"))
    await pg.click('#prShX'); await pg.wait_for_timeout(250); await s('11_chromatic')
    # Cosmic + Harmonie: gestrichelt, anfassen = umwandeln
    await pg.click('#prIBtn'); await pg.click('#prMenu button:has-text("COSMIC")'); await pg.wait_for_timeout(300)
    await pg.click('#prBack'); await pg.wait_for_timeout(200)
    await pg.evaluate("document.querySelector('#hmPanel button')?.click()"); await pg.wait_for_timeout(200)
    await pg.evaluate("[...document.querySelectorAll('#hmModes button')].find(b=>b.textContent.trim()==='Akkord')?.click()"); await pg.wait_for_timeout(200)
    await pg.click('#prPv'); await pg.wait_for_timeout(500); await s('12_cosmic_harmony')
    g=await pg.evaluate("document.querySelectorAll('#prNotes .prn.gen').length"); ok('Harmonie-Noten gestrichelt', g>0, g)
    ok('Harmonie-Hinweis', await pg.evaluate("getComputedStyle(document.getElementById('prHmB')).display!=='none'"))
    n=pg.locator('#prNotes .prn').first; bb=await n.bounding_box(); await pg.mouse.click(bb['x']+bb['width']/2,bb['y']+bb['height']/2); await pg.wait_for_timeout(200)
    ok('Anfassen = eigene Noten', await pg.evaluate("document.querySelectorAll('#prNotes .prn.gen').length")==0)
    await s('13_cosmic_converted')
    # Keys: Klang-Sheet Instrument
    await pg.click('#prIBtn'); await pg.click('#prMenu button:has-text("KEYS")'); await pg.wait_for_timeout(300)
    await pg.click('#prTop [data-pa=klang]'); await pg.click('#klTabs [data-t=sound]'); await pg.wait_for_timeout(300); await s('14_keys_klang')
    await pg.click('#klRows .am-seg button:has-text("RHODES")'); await pg.wait_for_timeout(200)
    ok('Keys -> Rhodes', await pg.evaluate("__T.find(t=>t.id==='piano').sound")=='rhodes'); ok('Kopf zeigt RHODES', (await pg.text_content('#prSub'))=='RHODES')
    await pg.click('#klX'); await pg.wait_for_timeout(250)
    # Querformat
    await pg.set_viewport_size({'width':844,'height':390}); await pg.wait_for_timeout(600); await s('15_land_edit')
    ok('Quer: Kopfzeile enthält Werkzeug', await pg.evaluate("document.querySelectorAll('#prLand [data-pm]').length")==2)
    await pg.click('#prLand [data-pm=play]'); await pg.wait_for_timeout(400); await s('16_land_keys')
    nk=await pg.evaluate("document.querySelectorAll('#prKb .pkw').length"); ok('Quer: 15 Tasten', nk==15, nk)
    await pg.click('#prLand [data-pm=edit]'); await pg.wait_for_timeout(300)
    vb=await pg.locator('#prView').bounding_box(); await pg.mouse.click(vb['x']+vb['width']*0.3, vb['y']+vb['height']*0.5); await pg.wait_for_timeout(200); await s('17_land_sel')
    ok('Quer: Notenleiste in Kopfzeile', await pg.evaluate("!!document.querySelector('#prLand .pr-info')"))
    await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(500)
    await pg.click('#prBack'); await pg.wait_for_timeout(300)
    # Drums: Klang-Sheet ohne Reiter
    await grp('DRUMS'); await pg.click('#tbSound'); await pg.wait_for_timeout(300); await s('18_drums_klang')
    ok('Drums: keine Reiter, Tune da', await pg.evaluate("getComputedStyle(document.getElementById('klTabs')).display==='none' && [...document.querySelectorAll('#klRows label')].some(l=>l.textContent==='Tune')"))
    ok('Keine Konsolenfehler', not errs, errs)
    await b.close()
  print('\n'+str(sum(1 for r in res if r.startswith('PASS')))+'/'+str(len(res)))
  sys.exit(0 if all(r.startswith('PASS') for r in res) else 1)
asyncio.run(main())
