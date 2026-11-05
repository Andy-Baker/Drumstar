# Tempo-Erkennung: Prüfstand mit echter Musik + Handy-Simulation (ohne Browser, braucht node, numpy, scipy, ffmpeg).
#   python3 tests/tempo-bench.py            # aktueller Stand
#   python3 tests/tempo-bench.py -v         # Fehlschläge einzeln
#   python3 tests/tempo-bench.py ALT.js     # anderen Stand vergleichen (z. B. git show v97:js/tempo-detect.js > /tmp/alt.js)
# Material: synthetische Songs (house, hiphop, rock, dnb, ballad, reggae, techno; bekanntes Tempo) und echte
# Stücke aus github.com/librosa/data (Choice 136, Vibe Ace 130, Let's Go Fishin' 88, Ragtime 145; Lizenzen
# siehe dort, werden nur nach tests/.cache geladen, nicht eingecheckt). Je 15-s-Ausschnitt vier Fassungen:
# clean, mid (Handy: Hochpass 180 Hz, Tiefpass 6 kHz, Hall 0,4 s, Rauschen −25 dB), hard (−15 dB, Hall 0,8 s),
# noisy (−8 dB). Treffer = ±2 % beim Stopp-Wert (½/×2 extra gezählt, dafür gibt es die Knöpfe).
# Stand v98: 101/112 genau, 108/112 inkl. ½/×2 (v97: 72/112 bzw. 89/112). Mindestwert unten: MIN_OK.
import os, sys, json, glob, subprocess, wave
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); CACHE=os.path.join(ROOT,'tests','.cache'); os.makedirs(CACHE,exist_ok=True)
ALGO=next((a for a in sys.argv[1:] if a.endswith('.js')), os.path.join(ROOT,'js','tempo-detect.js'))
MIN_OK=95; sr=48000
REAL=[('admiralbob77_-_Choice_-_Drum-bass',136,[0,8]),('Kevin_MacLeod_-_Vibe_Ace',130,[0,15,30,45]),
      ('Karissa_Hobbs_-_Lets_Go_Fishin',88,[0,20,40,60,80,100]),('442789__lena-orsa__happy-music-pistachio-ice-cream-ragtime',145,[0,20,40,55])]
def wr(p,x):
  with wave.open(p,'wb') as w: w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((np.clip(x,-1,1)*32767).astype('<i2').tobytes())
def rd(p):
  with wave.open(p) as w: return np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(np.float32)/32768
def fetch():
  d=os.path.join(CACHE,'librosa-data')
  if not os.path.isdir(os.path.join(d,'audio')):
    subprocess.run(['git','clone','--depth','1','--filter=blob:none','--sparse','https://github.com/librosa/data',d],check=True)
    subprocess.run(['git','-C',d,'sparse-checkout','set','--no-cone']+['/audio/%s.ogg'%n for n,_,_ in REAL],check=True)
  out={}
  for n,_,_ in REAL:
    w=os.path.join(CACHE,n[:24]+'.wav')
    if not os.path.exists(w): subprocess.run(['ffmpeg','-loglevel','error','-y','-i',os.path.join(d,'audio',n+'.ogg'),'-ac','1','-ar',str(sr),w],check=True)
    out[n]=rd(w)
  return out
rng=np.random.default_rng(5)
def kick(a=1): t=np.arange(int(sr*.35))/sr; f=50+120*np.exp(-t*35); return a*np.sin(2*np.pi*np.cumsum(f)/sr)*np.exp(-t*9)
def snare(a=.6): t=np.arange(int(sr*.25))/sr; return a*(0.6*rng.uniform(-1,1,len(t))*np.exp(-t*18)+0.4*np.sin(2*np.pi*190*t)*np.exp(-t*25))
def hat(a=.25,dec=60): t=np.arange(int(sr*.15))/sr; n=rng.uniform(-1,1,len(t)); n=np.diff(np.r_[0,n]); return a*n*np.exp(-t*dec)
def tone(f,dur,a=.2,dec=3,saw=False):
  t=np.arange(int(sr*dur))/sr; s=sum(np.sin(2*np.pi*f*k*t)/k for k in range(1,8)) if saw else np.sin(2*np.pi*f*t)+.3*np.sin(4*np.pi*f*t)
  return a*s*np.minimum(1,t/.01)*np.exp(-t*dec)
def place(x,s,t,jit=.004):
  i=max(0,int((t+rng.normal(0,jit))*sr))
  if i>=len(x): return
  e=min(len(x),i+len(s)); x[i:e]+=s[:e-i]
def song(kind,bpm,sec=16):
  x=np.zeros(sr*sec); b=60/bpm; chords=[[220,277,330],[196,247,294],[175,220,262],[196,247,294]]
  for i in range(int(sec/b)+1):
    t=i*b; pos=i%4; ch=chords[(i//4)%4]
    if kind=='house':
      place(x,kick(),t); place(x,hat(.3,25),t+b/2)
      if pos in(1,3): place(x,snare(.5),t)
      place(x,tone(ch[0]/4,b/2,.35,6,True),t+b/2)
      if pos==0: [place(x,tone(f,b*4,.08,.6,True),t) for f in ch]
    if kind=='hiphop':
      if pos==0: place(x,kick(),t); place(x,kick(.7),t+b*0.75)
      if pos==2: place(x,kick(.8),t+b/2)
      if pos in(1,3): place(x,snare(.8),t)
      place(x,hat(.2),t); place(x,hat(.12),t+b/2*0.62)
      if pos==0: [place(x,tone(f*2,b*4,.06,.4),t) for f in ch]
    if kind=='rock':
      if pos in(0,2): place(x,kick(.9),t)
      if pos==2: place(x,kick(.6),t+b/2)
      if pos in(1,3): place(x,snare(.9),t)
      place(x,hat(.2),t); place(x,hat(.15),t+b/2)
      for k in range(2): place(x,tone(ch[0]/2,b/2,.15,4,True),t+k*b/2); [place(x,tone(f,b/2,.05,4,True),t+k*b/2) for f in ch]
    if kind=='dnb':
      if pos==0: place(x,kick(),t)
      if pos==2: place(x,kick(.8),t+b/2)
      if pos in(1,3): place(x,snare(.9),t)
      for k in range(4): place(x,hat(.12),t+k*b/4)
      if pos==0: place(x,tone(ch[0]/4,b*4,.4,.3,True),t)
    if kind=='ballad':
      if pos==0: [place(x,tone(f,b*4,.15,.8),t) for f in ch]
      place(x,tone(ch[pos%3]*2,b,.15,3),t)
      if pos in(1,3): place(x,snare(.25),t)
    if kind=='reggae':
      if pos==2: place(x,kick(),t); place(x,snare(.6),t)
      place(x,tone(ch[1]*2,b/4,.1,10,True),t+b/2); [place(x,tone(f*2,b/4,.06,10,True),t+b/2) for f in ch]
      place(x,hat(.1),t); place(x,hat(.06),t+b/2); place(x,tone(ch[0]/2,b*.8,.3,2),t+(b/2 if pos%2 else 0))
    if kind=='techno':
      place(x,kick(),t); place(x,hat(.25,40),t+b/2)
      for k in range(4): place(x,hat(.08),t+k*b/4)
      place(x,tone(ch[0]/2,b/4,.15,8,True),t+b*0.75)
  return x/np.max(np.abs(x))/1.1
prng=np.random.default_rng(11)
def ir(rt):
  n=int(sr*rt*3); t=np.arange(n)/sr; h=prng.standard_normal(n)*np.exp(-t*6.9/rt); h[:int(sr*.008)]=0; h/=np.sqrt(np.sum(h**2)); h*=0.7; h[0]=1; return h
def phone(x,snr_db,rt):
  x=sosfilt(butter(4,180,'hp',fs=sr,output='sos'),x); x=sosfilt(butter(2,6000,'lp',fs=sr,output='sos'),x)
  x=fftconvolve(x,ir(rt))[:len(x)]; x=x/np.max(np.abs(x))*0.08
  rms=np.sqrt(np.mean(x**2)); n=sosfilt(butter(1,300,'hp',fs=sr,output='sos'),prng.standard_normal(len(x)))
  return x+n*rms/10**(snr_db/20)/np.sqrt(np.mean(n**2))
def main():
  clips=os.path.join(CACHE,'clips'); os.makedirs(clips,exist_ok=True); meta=[]
  src=[('syn_%s_%d'%(k,b),b,[0],song(k,b)) for k,b in [('house',124),('house',118),('hiphop',90),('hiphop',96),('rock',110),('rock',140),('dnb',174),('ballad',72),('reggae',76),('techno',132),('techno',145),('rock',100)]]
  try: real=fetch(); src+=[(n[:24],t,offs,real[n]) for n,t,offs in REAL]
  except Exception as e: print('Echte Stücke nicht ladbar, nur synthetisch:',e)
  for name,t,offs,x in src:
    for o in offs:
      c=x[o*sr:o*sr+sr*15]
      for v,(snr,rt) in {'clean':(None,0),'mid':(25,.4),'hard':(15,.8),'noisy':(8,.4)}.items():
        p=os.path.join(clips,'%s_%d_%s.wav'%(name,o,v))
        if not os.path.exists(p): wr(p,c if snr is None else phone(c,snr,rt))
        meta.append({'f':p,'bpm':t,'v':v})
  mp=os.path.join(clips,'meta.json'); json.dump(meta,open(mp,'w'))
  r=subprocess.run(['node',os.path.join(ROOT,'tests','tempo-bench.js'),ALGO,mp,'--json']+(['-v'] if '-v' in sys.argv else []),capture_output=True,text=True)
  out=[l for l in r.stdout.splitlines() if not l.startswith('JSON')]; print('\n'.join(out)); print(r.stderr,end='')
  j=json.loads(next(l for l in r.stdout.splitlines() if l.startswith('JSON'))[4:])
  ok=j['stop']>=MIN_OK*j['n']/112
  print(('PASS' if ok else 'FAIL'),f"Stopp-Wert genau {j['stop']}/{j['n']} (Mindestens {MIN_OK*j['n']/112:.0f})")
  sys.exit(0 if ok else 1)
main()
