# Drumstar-Test (Playwright, headless): Noteneditor, Klaviatur, Klang-Sheet, Harmonie, Querformat.
# Start über tests/run.py (bereitet index.html vor und startet den Server).
# Direkt: python3 test-editor.py URL AUSGABEORDNER
import asyncio, sys, json
from playwright.async_api import async_playwright
URL=sys.argv[1]; OUT=sys.argv[2]
res=[]
from fzscan import FzScan
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
    fz=FzScan()
    async def s(n): await pg.screenshot(path=f'{OUT}/{n}.png'); await fz(pg,n)
    async def grp(n):
        await pg.click('#grpBtn'); await pg.click(f'#grpMenu button:has-text("{n}")'); await pg.wait_for_timeout(200)
    ev=lambda: pg.evaluate("__T[__sel()].events.map(e=>[e.s,e.n,e.l,+e.v.toFixed(2),!!e.a,!!e.sl])")
    await grp('ACID')
    await pg.evaluate("document.getElementById('taClearBtn').click()"); await pg.wait_for_timeout(100)
    await s('00_pattern_acid')
    ok('Spur-Zeile: nur ein Klang-Button', await pg.evaluate("!document.getElementById('tbSynth') && !!document.getElementById('tbSound').offsetParent"))
    await pg.click('#prPv'); await pg.wait_for_timeout(500); await s('01_editor_empty')
    ok('Editor offen', await pg.evaluate("document.getElementById('prWin').classList.contains('open')"))
    # Klaviatur-Leiste (#57): Tasten statt Namen, 48 px, Name nur bei C, Tonart-Zeilen getönt
    kb=await pg.evaluate("""(()=>{ const L=document.getElementById('prLbl'), col=document.getElementById('prLblCol');
      const w=L.querySelectorAll('.pkl.w').length, b=L.querySelectorAll('.pkl.b').length, names=[...L.querySelectorAll('.pkn')].map(e=>e.textContent);
      const row=document.querySelector('#prCv .prr:not(.rt):not(.ox)'), bg=row?getComputedStyle(row).backgroundColor:'';
      return {w,b,names,cw:col.getBoundingClientRect().width,bg}; })()""")
    ok('Klaviatur: Tasten da', kb['w']>=5, kb)
    ok('Klaviatur: schwarze Tasten ab Werk (#59)', kb['b']>=3, kb['b'])
    ok('Klaviatur: 48 px breit', abs(kb['cw']-48)<1, kb['cw'])
    ok('Klaviatur: Namen nur bei C', len(kb['names'])>=1 and all(n.startswith('C') and not n.startswith('C#') for n in kb['names']), kb['names'])
    ok('Tonart-Zeilen getönt', kb['bg'] not in ('','rgba(0, 0, 0, 0)','transparent'), kb['bg'])
    w0=await pg.evaluate("document.getElementById('prLblCol').getBoundingClientRect().width")
    hh=await pg.evaluate("prV(prTr).rh")
    await pg.evaluate(PINCH,[1,0.6]); await pg.wait_for_timeout(150)
    w1=await pg.evaluate("document.getElementById('prLblCol').getBoundingClientRect().width"); h1=await pg.evaluate("prV(prTr).rh")
    k1=await pg.evaluate("Math.round(document.querySelector('#prLbl .pkl.w').getBoundingClientRect().width)")
    ok('Pinch: Tastenbreite bleibt, Höhe zoomt', w1==w0 and k1==48 and h1!=hh, (w0,w1,k1,hh,h1))
    pv=await pg.evaluate("""(()=>{ let got=null; const o=window.pitchPreview; window.pitchPreview=(t,n,v)=>{ got=n; };
      const k=document.querySelector('#prLbl .pkl.w'), r=k.getBoundingClientRect();
      k.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.right-4,clientY:r.top+r.height/2,pointerId:21}));
      window.pitchPreview=o; return [got, +k.dataset.n, k.classList.contains('on')]; })()""")
    ok('Taste antippen spielt Ton', pv[0] is not None and pv[0]==pv[1] and pv[2], pv)
    await pg.evaluate("prV(prTr).fit=true; prRender()"); await pg.wait_for_timeout(200)
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
    ok('Nur Skalentöne ab Werk aus (#59): alle Töne', await pg.evaluate("document.querySelectorAll('#prCv .prr').length")>60, await pg.evaluate("document.querySelectorAll('#prCv .prr').length"))
    await pg.click('#prShRows .pr-orow:nth-of-type(2) button:has-text("AN")'); await pg.wait_for_timeout(150)
    ok('Nur Skalentöne an -> weniger Zeilen', await pg.evaluate("document.querySelectorAll('#prCv .prr').length")<60, await pg.evaluate("document.querySelectorAll('#prCv .prr').length"))
    await pg.click('#prShRows .pr-orow:nth-of-type(2) button:has-text("AUS")'); await pg.wait_for_timeout(150)
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
    await pg.click('#klX'); await pg.wait_for_timeout(250)
    # Seite kopieren (#69): nur die gewählte Spur, andere bleiben; Rückgängig im Toast
    r=await pg.evaluate("""(()=>{ setPatternLength(32); currentPage=0; renderPageNav(); renderAllForPage();
      const T=id=>TRACKS.find(t=>t.id===id), bd=T('bd'), sd=T('sd');
      for(let i=0;i<32;i++){ bd.steps[i]=i<16&&i%4===0?VEL_NORMAL:VEL_OFF; sd.steps[i]=i<16&&i%8===4?VEL_NORMAL:(i===20?VEL_NORMAL:VEL_OFF); }
      selectTrack(TRACKS.indexOf(bd)); renderAllForPage(); return 1; })()""")
    await pg.click('#pageCopyBtn'); await pg.wait_for_timeout(250)
    r=await pg.evaluate("""(()=>{ const T=id=>TRACKS.find(t=>t.id===id), bd=T('bd'), sd=T('sd');
      return {bd:bd.steps.slice(16,32).map(v=>v?1:0).join(''), sd:sd.steps.slice(16,32).map(v=>v?1:0).join(''), page:currentPage, toast:document.querySelector('#hmToast span').textContent}; })()""")
    ok('Seite kopieren: nur gewählte Spur (BD), SD bleibt', r['bd']=='1000100010001000' and r['sd']=='0000100000000000' and r['page']==1 and 'Seite 1 → 2' in r['toast'], r)
    await pg.click('#hmToast button'); await pg.wait_for_timeout(250)
    r=await pg.evaluate("({bd:TRACKS.find(t=>t.id==='bd').steps.slice(16,32).some(v=>v), page:currentPage})")
    ok('Seite kopieren: Rückgängig', not r['bd'] and r['page']==0, r)
    await pg.evaluate("setPatternLength(16); currentPage=0; renderPageNav(); renderAllForPage()")
    # Instrument-Register (#24): Eigenschaften, eigene Felder speichern/laden, Klang-Sheet nach Register
    r=await pg.evaluate("""(()=>{ const T=id=>TRACKS.find(t=>t.id===id), A=T('arp'), C=T('cosmic'), P=T('piano');
      const meta=[A,C,P].map(t=>[prName(t),isPoly(t),trOct(t),trInst(t).grp]).concat([[trInst(T('bd'))]]);
      C.cosmicWidth=.33; P.sound='rhodes'; P.tremolo=.4; const d=JSON.parse(JSON.stringify(collectPatternData('t','t')));
      const sv=id=>d.tracks.find(t=>t.id===id), foreign=('cosmicWidth' in sv('arp'))||('cosmicWidth' in sv('piano'))||('sound' in sv('cosmic'));
      C.cosmicWidth=.9; P.sound='piano'; P.tremolo=0; applyTrackAndFillData(d); const back=[C.cosmicWidth,P.sound,P.tremolo];
      const bad=JSON.parse(JSON.stringify(d)); bad.tracks.find(t=>t.id==='piano').sound='gibtsnicht'; delete bad.tracks.find(t=>t.id==='cosmic').cosmicAir; applyTrackAndFillData(bad); const fix=[P.sound, C.cosmicAir];
      const old=JSON.parse(JSON.stringify(d)); old.tracks=old.tracks.filter(t=>t.id!=='cosmic'); C.cosmicWidth=.1; C.vol=.2; applyTrackAndFillData(old);
      const sheet=id=>{ klTr=T(id); klTab='sound'; klView.length=0; klMode='klang'; renderKlang(); const s=$id('klSheet');
        return {cos:s.classList.contains('cos'), pno:s.classList.contains('pno'), xy:!!$id('klXy'), lab:[...document.querySelectorAll('#klRows label')].map(l=>l.textContent), seg:document.querySelectorAll('#klRows .am-seg button').length}; };
      return {meta, foreign, back, fix, fresh:[C.cosmicWidth, C.vol, C.events.length], a:sheet('arp'), c:sheet('cosmic'), p:sheet('piano'), grp:[!!grpSoundTr('piano'), !!grpSoundTr('cosmic'), !!grpSoundTr('drums')]}; })()""")
    ok('Register: Name/Akkorde/Oktave/Gruppe je Instrument, Drums ohne', r['meta']==[['ACID',False,0,'acid'],['COSMIC',True,24,'cosmic'],['KEYS',True,12,'piano'],[None]], r['meta'])
    ok('Register: nur eigene Felder gespeichert und zurückgeladen', not r['foreign'] and r['back']==[.33,'rhodes',.4], r)
    ok('Register: ungültiger Keys-Klang/fehlendes Cosmic-Feld → Standard', r['fix']==['piano',.18], r['fix'])
    ok('Register: Pattern ohne Cosmic → Cosmic leer mit Werksklang', r['fresh']==[.62,.68,0], r['fresh'])
    ok('Register: Klang-Sheet je Instrument (Acid XY+Accent, Cosmic Width, Keys Klangwahl)',
       r['a']['xy'] and 'Accent' in r['a']['lab'] and not r['a']['cos'] and r['c']['cos'] and not r['c']['xy'] and 'Width' in r['c']['lab'] and 'Accent' not in r['c']['lab']
       and r['p']['pno'] and r['p']['seg']>=3 and 'Ton' in r['p']['lab'], r)
    ok('Register: Klang-Auswahl an der Kit-Taste nur bei Keys', r['grp']==[True,False,False], r['grp'])
    # Spuren hinzufügen (#13): Kopieren/Anlegen, Umbenennen, Löschen + Rückgängig, Speichern/Laden (mel), alte Stände, Song-Clips, Beats je Instrument
    r=await pg.evaluate("""(async()=>{ const L=()=>TRACKS.filter(trInst).map(t=>t.id+':'+trTitle(t)).join(' ');
      const base=JSON.parse(JSON.stringify(collectPatternData('t0','t0'))); const P=TRACKS.find(t=>t.id==='piano');
      P.events=[{s:0,n:0,l:4,v:.9,a:false},{s:8,n:7,l:4,v:.8,a:false}]; P._idx=null; evTouch(P);
      const R=trAddNew({k:'piano',sound:'rhodes',label:'RHODES',src:P,notes:true}), C=trAddNew({k:'cosmic',label:'PAD'});
      const add=[L(), R.sound, R.events.length, TRACKS[activeTrackIdx]===C, ARR_GROUPS.map(g=>g.id).join(',')];
      trRename(R,'E-PIANO'); const ren=[trTitle(R), R.short, ARR_GROUPS.find(g=>g.id==='piano2').label, melNameFree('KEYS'), melNameFree('DRUMS'), melNameFree('keys 9')];
      arr.bars=8; arrStamp('piano2',0); const d=JSON.parse(JSON.stringify(songCollect('s','s')));
      trDelete(TRACKS.find(t=>t.id==='arp')); const del=[L(), ARR_GROUPS.some(g=>g.id==='acid')]; hmToastFn(); const und=L();
      trDelete(TRACKS.find(t=>t.id==='arp')); const d2=JSON.parse(JSON.stringify(collectPatternData('x','x')));
      const old=JSON.parse(JSON.stringify(d)); delete old.mel; applyPatternData(old); const lo=L();
      songApply(d); const ls=[L(), (arr.clips.piano2||[]).length, TRACKS.find(t=>t.id==='piano2').sound, TRACKS.find(t=>t.id==='piano2').events.length];
      applyPatternData(d2); const ld=L();
      selectTrack(TRACKS.findIndex(t=>t.id==='piano2')); const bt=beatCollect('piano','b'); selectTrack(TRACKS.findIndex(t=>t.id==='cosmic'));
      await beatApply(bt,false); const ba=TRACKS.find(t=>t.id==='piano').events.length;
      const ab=JSON.parse(JSON.stringify(bt)); ab.group='acid'; ab.tracks[0].events=[{s:0,n:0,l:1,v:.85,a:false,sl:false}]; await beatApply(ab,false); const ac=L();
      let full=0; while(melCount()<MEL_MAX){ trAddNew({k:'arp',label:melSuggest('ACID')}); full++; } trAddSheet(null); const go=$id('trGo').disabled; closeSheets();
      applyPatternData(base); const back=L();
      grpSelRender(); const menu=document.querySelectorAll('#grpMenu .grp-dots').length+'/'+!!document.querySelector('#grpMenu .grp-add');
      ovRender(); const song=document.querySelectorAll('#ovRows .ar-lab.tap').length+'/'+!!document.querySelector('#ovRows .ov-add');
      return {add,ren,del,und,lo,ls,ld,ba,ac,full,go,back,menu,song}; })()""")
    ok('#13 Spur kopieren/anlegen: hinter Original, Klang, Noten, Auswahl', r['add'][0]=='arp:ACID cosmic:COSMIC cosmic2:PAD piano:KEYS piano2:RHODES' and r['add'][1:4]==['rhodes',2,True]
       and r['add'][4]=='drums,perc,acid,cosmic,cosmic2,piano,piano2', r['add'])
    ok('#13 Umbenennen + Namensprüfung', r['ren']==['E-PIANO','E-P','E-PIANO',False,False,True], r['ren'])
    ok('#13 Original löschen + Rückgängig', r['del']==['cosmic:COSMIC cosmic2:PAD piano:KEYS piano2:E-PIANO',False] and r['und'].startswith('arp:ACID '), [r['del'],r['und']])
    ok('#13 alter Stand ohne mel → ACID, COSMIC, KEYS', r['lo']=='arp:ACID cosmic:COSMIC piano:KEYS', r['lo'])
    ok('#13 Song laden: Spuren, Clips, Klang, Noten', r['ls']==['arp:ACID cosmic:COSMIC cosmic2:PAD piano:KEYS piano2:E-PIANO',1,'rhodes',2], r['ls'])
    ok('#13 gelöschte Original-Spur bleibt beim Laden weg', r['ld']=='cosmic:COSMIC cosmic2:PAD piano:KEYS piano2:E-PIANO', r['ld'])
    ok('#13 Keys-Beat lädt in Keys-Spur, Acid-Beat legt fehlende Acid-Spur an', r['ba']==2 and r['ac'].endswith('arp:ACID'), [r['ba'],r['ac']])
    ok('#13 höchstens 7 Melodiespuren', r['go'] is True, r)
    ok('#13 Standard laden → 3 Melodiespuren; Menü/Song mit Aktionen', r['back']=='arp:ACID cosmic:COSMIC piano:KEYS' and r['menu']=='5/true' and r['song']=='5/true', [r['back'],r['menu'],r['song']])
    # Weitere Drum-/Perc-Spuren (#70): Zeilen wählen, Stimme ab Werk, eigenes Kit/Gruppe, Choke je Spur, Fill-Schichtung, Beats/Sets, Speichern/Laden, Löschen
    r=await pg.evaluate("""(async()=>{ const G=()=>ARR_GROUPS.map(g=>g.id+'('+g.ids.length+')').join(','), T=id=>TRACKS.find(t=>t.id===id);
      const base=JSON.parse(JSON.stringify(collectPatternData('t0','t0'))); const D=dtById('drums');
      const d2=dtAddNew({kind:'drums',name:'DRUMS 2',kit:'fm909',rows:['bd','sd','ch','oh'],src:D,notes:true});
      const add=[G(), d2.rows.map(r=>trVoice(T(r))+':'+trRole(T(r))+':'+trShort(T(r))+':'+voiceKitId(r)).join(' '), T('bd_2').steps.join()===T('bd').steps.join(), patternGroup, trGrp(T('sd_2')), GRP_KEYS.join(',')];
      setPatternGroup('drums2',true); applyStandardKit('fm808'); const kit=[D.kit,d2.kit]; updateKitLabel();
      const bt=beatCollect('drums','b'); const beat=[bt.tracks.map(x=>x.id).join(','), bt.kitId];
      fillIntensity=.7; const f=generateFillOverride(8); const fill=['bd_2','sd_2'].every(k=>f[k] && JSON.stringify(f[k])===JSON.stringify(f[rowBase(k)]));
      drumSet.voices.sd_2={t:'syn',kitId:'fm909',v:'rs'}; d2.set={id:null,name:null,dirty:false};
      const p2=dtAddNew({kind:'perc',name:'CONGA',kit:'latin',rows:['hc','cb']}); const perc=p2.rows.map(r=>trVoice(T(r))).join(',');
      arr.bars=8; arrStamp('drums2',4,4); const sd=JSON.parse(JSON.stringify(songCollect('s','s')));
      dtDelete(d2); const del=[G(), GRP_KEYS.indexOf('drums2'), Object.keys(drumSet.voices).filter(k=>/_2$/.test(k)&&!/^(hc|cb)/.test(k)).length]; hmToastFn(); const und=[G(), (dtById('drums2')||{}).kit, (T('bd_2')||{steps:[]}).steps.filter(v=>v>0).length];
      const old=JSON.parse(JSON.stringify(sd)); delete old.drt; applyPatternData(old); const lo=G();
      songApply(sd); const ls=[G(), dtById('drums2').kit, JSON.stringify(drumSet.voices.sd_2), (arr.clips.bd_2||[]).length, dtById('perc2').name];
      let n=0; while(dtExtras().length<DT_MAX_EXTRA){ dtAddNew({kind:'drums',name:'X'+(n++),rows:['bd']}); } dtAddSheet('drums'); const full=$id('trGo').disabled; closeSheets();
      grpSelRender(); const menu=[...document.querySelectorAll('#grpMenu > button')].filter(b=>b.querySelector('.grp-dots')).length;
      dtActSheet(dtById('drums')); const orig=!!trSheet.querySelector('[data-a=del][disabled]') && !trSheet.querySelector('[data-a=ren]'); closeSheets();
      // Choke nur innerhalb der Spur: Nachklang der offenen Hi-Hat (DRUMS) nach Closed Hat von DRUMS 2 bzw. DRUMS
      applyPatternData(base); const c2=dtAddNew({kind:'drums',name:'DRUMS 2',kit:'rock',rows:['ch']}); D.kit='rock';
      TRACKS.forEach(t=>{ if(t.steps) t.steps.fill(0); if(t.type==='arp'){ t.events=[]; t._idx=null; evTouch(t); } t.muted=false; t.solo=false; });
      const tail=async()=>{ const b=await renderPatternToWav(), L=b.getChannelData(0), sr=b.sampleRate; let e=0; for(let i=Math.floor(sr*.55);i<Math.floor(sr*1.2);i++) e+=L[i]*L[i]; return e; };
      T('oh').steps[0]=VEL_NORMAL; const oh=await tail(); T('ch_2').steps[2]=VEL_NORMAL; const other=await tail(); T('ch_2').steps[2]=0; T('ch').steps[2]=VEL_NORMAL; const same=await tail();
      applyPatternData(base); const back=[G(), GRP_KEYS.join(',')];
      return {add,kit,beat,fill,perc,del,und,lo,ls,full,menu,orig,choke:[oh,other,same],back}; })()""")
    ok('#70 Drum-Spur mit gewählten Zeilen: Stimme/Rolle/Name ab Werk, eigenes Kit, Noten kopiert, eigene Gruppe',
       r['add'][0]=='drums(8),drums2(4),perc(5),acid(1),cosmic(1),piano(1)' and r['add'][1]=='bd:kick:BD:fm909 sd:snare:SD:fm909 ch:hat:CH:fm909 oh:openhat:OH:fm909'
       and r['add'][2] is True and r['add'][3]=='drums2' and r['add'][4]=='drums2' and r['add'][5]=='drums,perc,drums2', r['add'])
    ok('#70 Kit-Taste wirkt nur auf die gewählte Drum-Spur', r['kit']==['rock','fm808'], r['kit'])
    ok('#70 DRUMS-Beat aus DRUMS 2 speichert Stimmen ab Werk + Kit', r['beat']==['bd,sd,ch,oh','fm808'], r['beat'])
    ok('#70 Fill von DRUMS auf DRUMS 2 geschichtet', r['fill'] is True, r)
    ok('#70 Perc-Spur mit Latin-Kit spielt Conga/Bongo', r['perc']=='cgh,bgh', r['perc'])
    ok('#70 Löschen räumt Gruppe/Tausch ab, Rückgängig stellt Kit + Noten her', r['del'][1]==-1 and r['del'][2]==0 and 'drums2' not in r['del'][0] and r['und'][1]=='fm808' and r['und'][2]>0, [r['del'],r['und']])
    ok('#70 alter Stand ohne drt → keine weiteren Drum-Spuren', r['lo']=='drums(8),perc(5),acid(1),cosmic(1),piano(1)', r['lo'])
    ok('#70 Song laden: Spuren, Kit, Tausch, Clips, Name', r['ls'][0]=='drums(8),drums2(4),perc(5),perc2(2),acid(1),cosmic(1),piano(1)' and r['ls'][1]=='fm808'
       and r['ls'][2]=='{"t":"syn","kitId":"fm909","v":"rs"}' and r['ls'][3]==1 and r['ls'][4]=='CONGA', r['ls'])
    ok('#70 höchstens 3 zusätzliche; DRUMS/PERC ab Werk nicht löschbar', r['full'] is True and r['orig'] is True, r)
    ok('#70 Hi-Hat-Choke nur innerhalb der Spur', r['choke'][0]>0 and r['choke'][1]>0.8*r['choke'][0] and r['choke'][2]<0.1*r['choke'][0], r['choke'])
    ok('#70 Standard laden → nur DRUMS/PERC', r['back']==['drums(8),perc(5),acid(1),cosmic(1),piano(1)','drums,perc'], r['back'])
    # Sampler (#8): Spur nur über „Spur hinzufügen“, Akkord, Grundton am Sample, Speichern/Laden, alte SAMPLE-Spur → Sampler, Beats
    r=await pg.evaluate("""(async()=>{ const L=()=>TRACKS.filter(trInst).map(t=>t.id+':'+trTitle(t)).join(' ');
      const base=JSON.parse(JSON.stringify(collectPatternData('t0','t0')));
      const def=[L(), TRACKS.some(t=>t.id==='mc'), ARR_GROUPS.some(g=>g.id==='sample'), trTiles().some(o=>o.k==='sampler')];
      const S=trAddNew({k:'sampler',label:melSuggest('SAMPLER')}); S.events=[0,4,7].map(n=>({s:0,n,l:4,v:.9,a:false})).concat([{s:8,n:12,l:2,v:.8,a:false}]); S._idx=null; evTouch(S);
      const add=[L(), isPoly(S), S.smp, prSubName(S), groupOfTrack(S), S.color];
      await samplerSync(); const kb0=samplerGet('kb'); await kb0.p; const st=samplerGet('str'); const werk=[st.state, Object.keys(SMP_INSTR).join(), smpSlot(st,60,0.2).l, smpSlot(st,60,1.3).l, smpSlot(st,61,0.85).root, smpSlot(samplerGet('kb'),40,0.15).l, samplerGet('kb').state];
      await samplerSync(); const freed=[!!SMPL.kb, !!SMPL.str];
      klTr=S; klTab='sound'; klView.length=0; klMode='klang'; renderKlang();
      const sheet=[$id('klSheet').classList.contains('smp'), document.querySelectorAll('#klRows .smp-chip').length, [...document.querySelectorAll('#klRows label')].map(l=>l.textContent).join(','), !!document.querySelector('#klRows .smp-root')];
      S.smp='glas'; S.smpRel=.5; const d=JSON.parse(JSON.stringify(collectPatternData('s','s'))); const sv=d.tracks.find(t=>t.id===S.id);
      const saved=[d.mel.map(e=>e.inst).join(','), sv.smp, sv.smpRel, sv.events.length, 'sound' in sv];
      applyPatternData(base); const gone=L(); applyPatternData(d); const T=TRACKS.find(t=>t.id==='sampler');
      const back=[L(), T.smp, T.smpRel, T.events.length];
      const bad=JSON.parse(JSON.stringify(d)); bad.tracks.find(t=>t.id==='sampler').smp=7; applyPatternData(bad); const fix=TRACKS.find(t=>t.id==='sampler').smp;
      // Grundton am Sample: Note auf Grundton = Originaltonhöhe; Erkennen auf Werksample
      const W=samplerGet('vox'), Ba=samplerGet('bass'), sr=44100, tb=new AudioBuffer({length:sr,numberOfChannels:1,sampleRate:sr}), td=tb.getChannelData(0);
      for(let i=0;i<sr;i++){ const t=i/sr; let v=0; for(let k=1;k<=12;k++) v+=Math.sin(2*Math.PI*329.63*k*t)/k; td[i]=0.3*v*Math.exp(-t*2); } // E4 mit Obertönen (wie Saite)
      const det=[smpDetect(W), smpDetect({buf:tb,off:0}), smpDetect(Ba)];
      // alte SAMPLE-Spur: mit Sample-Zuordnung → Sampler-Spur „SAMPLE“, ohne → weg
      localStorage.setItem('mrm44_sampleTrackId','p_test');
      const old=JSON.parse(JSON.stringify(base)); delete old.mel; old.tracks.push({id:'mc',steps:[0,0,0.85,0,1.3,0,0,0,0,0,0,0,0,0,0,0],vol:.7,tune:.5,reverbAmount:.1});
      old.kind='song'; old.arrangement={enabled:true,bars:4,clips:{mc:[{start:1,bars:1,steps:[0.85,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]}]}};
      songApply(old); const M=TRACKS.find(t=>t.id==='sampler');
      const mig=M ? [L(), M.smp, M.vol, M.events.map(e=>e.s+':'+(33+M.rootNote+e.n+12)+(e.a?'A':'')).join(' '), (arr.clips.sampler||[]).map(c=>c.start+':'+c.events.length).join(), !!arr.clips.mc] : null;
      localStorage.removeItem('mrm44_sampleTrackId');
      const old2=JSON.parse(JSON.stringify(base)); delete old2.mel; old2.tracks.push({id:'mc',steps:[0.85,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],vol:.9,tune:.5}); applyPatternData(old2); const nomig=L();
      const ob=mcBeat({id:'b1',kind:'beat',group:'sample',name:'alt',length:16,sampleId:'p_x',tracks:[{id:'mc',steps:[0.85,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],vol:.8,tune:.5}]});
      const beat=[ob.group, ob.tracks.length, ob.tracks[0].smp, ob.tracks[0].events.length, 'sampleId' in ob];
      applyPatternData(base);
      return {def,add,werk,freed,sheet,saved,gone,back,fix,det,mig,nomig,beat}; })()""")
    ok('#8 Sampler nicht ab Werk, keine SAMPLE-Spur mehr, Kachel in „Spur hinzufügen“', r['def']==['arp:ACID cosmic:COSMIC piano:KEYS',False,False,True], r['def'])
    ok('#8 Sampler-Spur: mehrstimmig, Standard STREICHER, eigene Gruppe, grün', r['add']==['arp:ACID cosmic:COSMIC piano:KEYS sampler:SAMPLER',True,'str','STREICHER','sampler','#8be86a'], r['add'])
    ok('#61 Werk-Instrumente geladen, Stufe nach Velocity, nächste Zone', r['werk']==['ok','str,piz,kb,kba',0,1,62,0,'ok'], r['werk'])
    ok('#61 Instrument ohne Spur wird freigegeben', r['freed']==[False,True], r['freed'])
    ok('#8 Klang-Sheet: Sample-Chips (Instrumente + Werksamples), Attack/Release', r['sheet'][0] and r['sheet'][1]>=8 and r['sheet'][2]=='Attack,Release' and not r['sheet'][3], r['sheet'])
    ok('#8 Speichern: mel + eigene Felder, kein Keys-Klang', r['saved']==['arp,cosmic,piano,sampler','glas',.5,4,False], r['saved'])
    ok('#8 Laden: Standard ohne Sampler, Beat mit Sampler stellt ihn her', r['gone']=='arp:ACID cosmic:COSMIC piano:KEYS' and r['back']==['arp:ACID cosmic:COSMIC piano:KEYS sampler:SAMPLER','glas',.5,4], [r['gone'],r['back']])
    ok('#8 ungültiges Sample → Standard STREICHER', r['fix']=='str', r['fix'])
    ok('#8 Tonhöhe erkennen: VOX A3 (ohne Grundton im Spektrum), Saite E4, BASS C2', r['det']==[57,64,36], r['det'])
    ok('#8 alte SAMPLE-Spur → Sampler „SAMPLE“: Sample, Laut, Noten auf C4, Song-Clips', r['mig'] is not None and r['mig'][0]=='arp:ACID cosmic:COSMIC piano:KEYS sampler:SAMPLE'
       and r['mig'][1:4]==['lib:p_test',.7,'2:60 4:60A'] and r['mig'][4]=='1:1' and r['mig'][5] is False, r['mig'])
    ok('#8 alte SAMPLE-Spur ohne Sample (war stumm) → entfällt', r['nomig']=='arp:ACID cosmic:COSMIC piano:KEYS', r['nomig'])
    ok('#8 Beat aus Reiter „Sample“ → Sampler-Beat', r['beat']==['sampler',1,'lib:p_x',1,False], r['beat'])
    # #9 Sample-Editor: Griff-Leiste (S links an der Linie, E rechts), relatives Ziehen, Feinmodus, Lupe, Einrasten, ein Undo je Zug
    await pg.evaluate("""(()=>{ const sr=44100, n=sr*2, b=new AudioBuffer({length:n,numberOfChannels:1,sampleRate:sr}), d=b.getChannelData(0);
      for(let i=0;i<n;i++) d[i]=0.6*Math.sin(2*Math.PI*100*i/sr+0.3); openSampleEditor({buffer:b,label:'Test'}); })()""")
    await pg.wait_for_timeout(400)
    await pg.evaluate("document.getElementById('seWaveWrap').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200)
    TABS="""(()=>{ const r=e=>{const q=e.getBoundingClientRect(); return {l:q.left,r:q.right,t:q.top,b:q.bottom,w:q.width,h:q.height,cx:q.left+q.width/2,cy:q.top+q.height/2};};
      const S=document.querySelector('.se-tab[data-h=start]'), E=document.querySelector('.se-tab[data-h=end]'), W=document.getElementById('seWaveWrap');
      const hit=t=>{const q=r(t); return document.elementFromPoint(q.cx,q.cy)?.closest('.se-tab')===t;};
      return {S:r(S),E:r(E),W:r(W),hitS:hit(S),hitE:hit(E),ts:seTrimStart,te:seTrimEnd,iw:seInnerWidth(),undo:seUndoStack.length,
        nud:document.querySelector('.se-nudge').getBoundingClientRect().width, snap:!!document.getElementById('seSnapBtn').offsetParent}; })()"""
    g=await pg.evaluate(TABS)
    ok('#9 Griff-Tasten groß, in der Welle, nicht übereinander', g['S']['w']>=44 and g['S']['h']>=38 and g['S']['l']>=g['W']['l']-1 and g['E']['r']<=g['W']['r']+1 and g['S']['r']<=g['E']['l']+.5 and g['hitS'] and g['hitE'], g)
    ok('#9 ±-Tasten 36 px, Knackfrei-Schalter auch beim Zuschneiden', abs(g['nud']-36)<1 and g['snap'], [g['nud'],g['snap']])
    await s('se_grip')
    # Antippen ohne Bewegung: nichts springt
    await pg.mouse.move(g['S']['cx'],g['S']['cy']); await pg.mouse.down(); await pg.mouse.up()
    g1=await pg.evaluate(TABS)
    ok('#9 Antippen verschiebt nichts', g1['ts']==0 and g1['undo']==0, g1['ts'])
    # Ziehen um 80 px (mehrere Schritte) → S ≈ 80/iw·dur, eingerastet auf Nulldurchgang, Lupe sichtbar, ein Undo-Schritt
    await pg.mouse.move(g['S']['cx'],g['S']['cy']); await pg.mouse.down()
    for i in range(1,9): await pg.mouse.move(g['S']['cx']+10*i,g['S']['cy'])
    lp=await pg.evaluate("(()=>{const l=document.getElementById('seLoupe'); return {vis:getComputedStyle(l).display!=='none', txt:l.querySelector('span').textContent, top:l.getBoundingClientRect().top};})()")
    await s('se_drag_loupe')
    await pg.mouse.up()
    g2=await pg.evaluate(TABS); want=80/g2['iw']*2
    zc=await pg.evaluate("(()=>{const d=seWorkingBuffer.getChannelData(0), i=Math.round(seTrimStart*44100); return (d[i-1]<=0&&d[i]>0)||(d[i-1]>=0&&d[i]<0);})()")
    ok('#9 Ziehen relativ (kein Sprung unter den Finger)', abs(g2['ts']-want)<0.012, [g2['ts'],want])
    ok('#9 S rastet auf Nulldurchgang ein', zc)
    ok('#9 Lupe beim Ziehen mit Zeit, danach weg', lp['vis'] and lp['txt'].startswith('S') and ' s' in lp['txt'] and lp['top']>=0
       and await pg.evaluate("getComputedStyle(document.getElementById('seLoupe')).display")=='none', lp)
    ok('#9 ein Undo-Schritt pro Zug', g2['undo']==1, g2['undo'])
    # Feinmodus: Finger 140 px unter die Welle → 1/10
    await pg.evaluate("document.getElementById('seSnapBtn').click()")
    t0=g2['ts']; E0=g2['E']
    await pg.mouse.move(E0['cx'],E0['cy']); await pg.mouse.down()
    await pg.mouse.move(E0['cx'],g2['W']['b']+140,steps=4); await pg.mouse.move(E0['cx']-100,g2['W']['b']+140,steps=10)
    fine=await pg.evaluate("document.getElementById('seLoupe').classList.contains('fine') && document.querySelector('#seLoupe i').textContent")
    await pg.mouse.up()
    g3=await pg.evaluate(TABS); wantE=2-100*0.1/g3['iw']*2
    ok('#9 Feinmodus: Finger nach unten = 1/10', abs(g3['te']-wantE)<0.004 and fine=='FEIN 1/10', [g3['te'],wantE,fine])
    # S und E fast übereinander: beide Tasten greifbar, E-Taste rechts von S
    await pg.evaluate("seTrimStart=1.0; seTrimEnd=1.03; updateSETrimUI()")
    g4=await pg.evaluate(TABS)
    ok('#9 S≈E: beide greifbar, S links, E rechts', g4['hitS'] and g4['hitE'] and g4['S']['r']<=g4['E']['l']+.5, [g4['S'],g4['E']])
    await s('se_grip_close')
    # Am Rand: Ende = Schluss → E-Taste bleibt in der Welle
    await pg.evaluate("seTrimStart=1.97; seTrimEnd=2; updateSETrimUI()")
    g5=await pg.evaluate(TABS)
    ok('#9 Griffe am Rand bleiben ganz in der Welle', g5['E']['r']<=g5['W']['r']+1 and g5['S']['l']>=g5['W']['l']-1 and g5['hitS'] and g5['hitE'], [g5['S'],g5['E']])
    # Loop-Modus: L1/L2-Tasten statt S/E
    await pg.evaluate("document.getElementById('seSnapBtn').click(); document.getElementById('seModeLoop').click()")
    lpm=await pg.evaluate("[...document.querySelectorAll('.se-tab')].filter(t=>t.offsetParent).map(t=>t.dataset.h).join()")
    ok('#9 Loop-Modus zeigt L1/L2-Tasten', lpm=='l1,l2', lpm)
    await pg.evaluate("closeSampleEditor()")
    ok('Schrift überall ≥ 11 px (#19)', not fz.bad, fz.bad)
    ok('Keine Konsolenfehler', not errs, errs)
    await b.close()
  print('\n'+str(sum(1 for r in res if r.startswith('PASS')))+'/'+str(len(res)))
  sys.exit(0 if all(r.startswith('PASS') for r in res) else 1)
asyncio.run(main())
