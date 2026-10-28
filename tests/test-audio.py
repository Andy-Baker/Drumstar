# Drumstar-Audiotest (Playwright + OfflineAudioContext): rendert Keys-Stimmen offline und misst den Klang.
# Start über tests/run.py.  Direkt: python3 test-audio.py URL
# Prüft: kein Pegelsprung beim Notenende (Release), Hammer nicht hell/laut (kein "Hi-Hat"),
#        Grundton fällt nach dem Anschlag nicht schnell ab (kein "Bassdrum"-Wumms), kein Clipping/NaN.
import asyncio, sys, math
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
    b=await p.chromium.launch(); pg=await b.new_page(); errs=[]
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
    ok('Keine Fehler', not errs, errs)
    await b.close()
  print(sum(r.startswith('PASS') for r in res),'/',len(res))
  sys.exit(0 if all(r.startswith('PASS') for r in res) else 1)
asyncio.run(main())
