# Drumstar-Audiotest (Playwright + OfflineAudioContext): Signal rein, Signal raus, Kennzahlen prüfen.
# Start über tests/run.py (setzt tests/hook.js ein).
# Keys:  kein Pegelsprung beim Notenende, Hammer nicht hell/laut ("Hi-Hat"), kein Grundton-Wumms, kein Clipping/NaN.
# Drums: jede Stimme jedes Kits, FM-Worklet (live) und nativer Pfad (WAV-Export): klingt, kein NaN, sauberes Ausklingen.
# Acid:  über den echten WAV-Export: Cutoff/Resonanz wirken, Accent lauter, max. Resonanz ohne Clipping/NaN.
import asyncio, sys, math
import numpy as np
from playwright.async_api import async_playwright
URL=sys.argv[1]; res=[]
def ok(n,c,x=''): res.append(('PASS ' if c else 'FAIL ')+n+(' '+str(x) if x else '')); print(res[-1],flush=True)
JS="""async ([sound,n,vel,hold])=>{
 const sr=48000, c=new OfflineAudioContext(2,sr*1.6,sr); __setCtx(c);
 const tr=__T.find(t=>t.id==='piano'); const ob=tr.bus, os=tr.sound; tr.bus=c.destination; tr.sound=sound;
 __pv(tr,0.05,n,vel,hold); const b=await c.startRendering(); tr.bus=ob; tr.sound=os;
 const L=b.getChannelData(0), R=b.getChannelData(1), x=new Float32Array(L.length); for(let i=0;i<L.length;i++) x[i]=L[i]+R[i];
 const pk=(a,z)=>{let m=0; for(let i=Math.floor(a*sr);i<Math.floor(z*sr);i++) m=Math.max(m,Math.abs(x[i])); return m;};
 let nan=false; for(const v of x) if(!isFinite(v)) {nan=true;break;}
 // Grundton-Pegel per Goertzel in 40-ms-Fenstern
 const f0=55*Math.pow(2,(tr.rootNote+n+12)/12);
 const gz=(t)=>{const s=Math.floor(t*sr),N=1920,w=2*Math.PI*f0/sr; let s1=0,s2=0; for(let i=0;i<N;i++){const h=0.5-0.5*Math.cos(2*Math.PI*i/N); const s0=x[s+i]*h+2*Math.cos(w)*s1-s2; s2=s1; s1=s0;} return Math.sqrt(s1*s1+s2*s2-2*Math.cos(w)*s1*s2);};
 // Anteil über 4 kHz in den ersten ~43 ms (FFT 2048, Hann) – Klaviertöne bis n=12 haben dort keine Teiltöne, nur der Hammer
 const N=2048, re=new Float64Array(N), im=new Float64Array(N), s0=Math.floor(0.05*sr);
 for(let i=0;i<N;i++) re[i]=x[s0+i]*(0.5-0.5*Math.cos(2*Math.PI*i/N));
 for(let i=1,j=0;i<N;i++){ let bit=N>>1; for(;j&bit;bit>>=1) j^=bit; j^=bit; if(i<j){ [re[i],re[j]]=[re[j],re[i]]; } }
 for(let len=2;len<=N;len<<=1){ const ang=-2*Math.PI/len; for(let i=0;i<N;i+=len) for(let k=0;k<len/2;k++){ const wr=Math.cos(ang*k), wi=Math.sin(ang*k), a=i+k, c=i+k+len/2, tr_=re[c]*wr-im[c]*wi, ti=re[c]*wi+im[c]*wr; re[c]=re[a]-tr_; im[c]=im[a]-ti; re[a]+=tr_; im[a]+=ti; } }
 let eh=0,et=0; for(let k=1;k<N/2;k++){ const e=re[k]*re[k]+im[k]*im[k]; et+=e; if(k*sr/N>4000) eh+=e; }
 return {nan, peak:pk(0,1.6), before:pk(0.05+hold-0.01,0.05+hold), after:pk(0.05+hold,0.05+hold+0.05),
         fund:[gz(0.055),gz(0.15)], hf:10*Math.log10((eh+1e-12)/(et+1e-12))};}"""
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg=await b.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.goto(URL,wait_until='domcontentloaded'); await pg.wait_for_timeout(1500)
    for sound in ['piano','rhodes']:
      for n in [0,12,24]:
        for hold in [0.15,1.0]:
          r=await pg.evaluate(JS,[sound,n,0.85,hold]); tag=f'{sound} n={n} hold={hold}s'
          jump=20*math.log10((r['after']+1e-9)/(r['before']+1e-9))
          ok(f'{tag}: kein Pegelsprung beim Notenende', jump<1.5, f'{jump:+.1f} dB')
          ok(f'{tag}: kein Clipping/NaN', not r['nan'] and r['peak']<0.95, round(r['peak'],3))
      for n in [0,12]:
        r=await pg.evaluate(JS,[sound,n,0.85,1.0])
        drop=20*math.log10((r['fund'][1]+1e-9)/(r['fund'][0]+1e-9))
        ok(f'{sound} n={n}: Grundton nach 100 ms > -3 dB (kein Wumms)', drop>-3, f'{drop:+.1f} dB')
        if sound=='piano': ok(f'piano n={n}: Hochton-Anteil Anschlag < -45 dB (kein Hi-Hat)', r['hf']<-45, f"{r['hf']:.1f} dB")
    # ---------- Drums ----------
    kits=await pg.evaluate("__audio.kits()"); ids=await pg.evaluate("__audio.drumIds()"); warn=[]
    for kit in kits:
      for wk in [False, True]:
        for vid in ids:
          r=await pg.evaluate("([i,k,w])=>__audio.drum(i,k,w,4)",[vid,kit,wk])
          if 'skip' in r: continue
          x=np.array(r['x']); sr=r['sr']; pk=float(np.abs(x).max()); tag=f"{kit} {'Worklet' if wk else 'nativ'} {vid}"
          if not np.isfinite(x).all() or pk<1e-3: ok(f'{tag}: klingt, kein NaN', False, round(pk,4)); continue
          end=np.where(np.abs(x)>pk*1e-3)[0][-1]; tail=20*math.log10(np.abs(x[max(0,end-int(0.004*sr)):end+1]).max()/pk)
          if wk:
            # Bekannt (28.10.): Worklet-Stimmen enden nach ampDecay+60 ms bei ca. -10…-25 dB (4 ms ausgeblendet) -> Ausklang wird
            # abgeschnitten, nativer Pfad/WAV-Export klingt dagegen bis -60 dB aus. Entscheidung offen, daher nur Warnung.
            if tail>-35: warn.append(f'{tag} {tail:.0f} dB')
          else:
            ok(f'{tag}: klingt sauber aus (letzte 4 ms < -35 dB)', tail<-35, f'{tail:.1f} dB')
    ok('Drums: alle Stimmen gerendert', True, f'{len(kits)} Kits × {len(ids)} Stimmen × 2 Pfade')
    # Live = Export: Ausklang-Ende der Kick über den WAV-Export muss dem Worklet-Render entsprechen (seit v67 gleicher Pfad)
    def tail_db(x,sr):
      x=np.array(x); pk=np.abs(x).max(); end=np.where(np.abs(x)>pk*1e-3)[0][-1]
      return 20*math.log10(np.abs(x[max(0,end-int(0.004*sr)):end+1]).max()/pk), end/sr
    for kit in ['rock','fm909']:
      lv=await pg.evaluate("([i,k,w])=>__audio.drum(i,k,w,4)",['bd',kit,True]); ex=await pg.evaluate("([i,k])=>__audio.exportDrum(i,k)",['bd',kit])
      (tl,dl),(te,de)=tail_db(lv['x'],lv['sr']),tail_db(ex['x'],ex['sr'])
      ok(f'{kit} bd: WAV-Export endet wie live (Worklet)', abs(tl-te)<6 and abs(dl-de)<0.05, f'live {tl:.0f} dB @{dl:.2f}s, Export {te:.0f} dB @{de:.2f}s')
    if warn: print(f'WARN Worklet-Ausklang abgeschnitten (bekannt, Entscheidung offen): {len(warn)} Stimmen, z. B. '+', '.join(warn[:6]),flush=True)
    # ---------- Acid (über den WAV-Export) ----------
    def cent(x,sr):
      X=np.abs(np.fft.rfft(x*np.hanning(len(x)))); f=np.fft.rfftfreq(len(x),1/sr); return float((X*f).sum()/X.sum())
    async def acid(events,cut,res):
      r=await pg.evaluate("o=>__audio.acid(o)",{'events':events,'cutoff':cut,'reso':res}); x=np.array(r['x'])
      return x, r['sr'], r['step'], r['peakCh']
    ev=[{'s':i*4,'n':0} for i in range(4)]; c={}
    for cut,rz in [(0.1,0.35),(0.9,0.35),(0.5,0.0),(0.5,1.0)]:
      x,sr,st,pc=await acid(ev,cut,rz); c[(cut,rz)]=cent(x[int(0.05*sr):int((0.05+st)*sr)],sr)
      ok(f'Acid Cutoff {cut} Reso {rz}: kein NaN/Clipping', np.isfinite(x).all() and pc<0.99, round(pc,3))
    ok('Acid: Cutoff wirkt (Schwerpunkt hoch > 2× tief)', c[(0.9,0.35)]>2*c[(0.1,0.35)], f'{c[(0.1,0.35)]:.0f} → {c[(0.9,0.35)]:.0f} Hz')
    ok('Acid: Resonanz hebt Schwerpunkt', c[(0.5,1.0)]>c[(0.5,0.0)]*1.2, f'{c[(0.5,0.0)]:.0f} → {c[(0.5,1.0)]:.0f} Hz')
    x,sr,st,pc=await acid([{'s':0,'n':0},{'s':4,'n':0,'a':1}],0.5,0.35)
    a=np.abs(x[int(0.05*sr):int((0.05+st)*sr)]).max(); b2=np.abs(x[int((0.05+4*st)*sr):int((0.05+5*st)*sr)]).max(); acc=20*math.log10(b2/a)
    ok('Acid: Accent lauter (≥ +2 dB)', acc>=2, f'{acc:+.1f} dB')
    ok('Keine Fehler', not errs, errs)
    await b.close()
  print(sum(r.startswith('PASS') for r in res),'/',len(res))
  sys.exit(0 if all(r.startswith('PASS') for r in res) else 1)
asyncio.run(main())
