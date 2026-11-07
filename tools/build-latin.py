# Latin-Perc bauen (#60): Conga, Tumba, Bongos, Timbales, Schellenkranz -> samples/latin/<stimme>.mp3
# Format wie die Sample-Kits (samples/README.md): Sync-Klick, dann 12 Slots (Layer 1..4 x RR 1..3) zu je LEN[stimme] s.
# Quellen (CC0): Virtuosity Drums (sfzinstruments/virtuosity_drums, Aux-Perc aus VSCO 2 Pro, Timbales von Karoryfer)
#               VCSL (sgossner/VCSL) für Bongos gedämpft und Schellenkranz Schlag/Wirbel.
# Aufruf: VD=/pfad/virtuosity_drums VCSL=/pfad/VCSL python3 tools/build-latin.py [stimme,…]
#   Beide als blobless Klon (git clone --filter=blob:none --no-checkout); Dateien kommen per `git show HEAD:<pfad>`.
# Lautheit: Akzent-Stufe (60 ms ab Anschlag) auf die Studio-Stimme REF abgeglichen, Spitze höchstens −0,3 dB (Peak-Limiter, max. 3 dB (Anschlag bleibt knackig)).
import os, sys, json, subprocess, numpy as np
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT=ROOT+'/samples/latin'; SR=44100
VD=os.environ.get('VD',''); VC=os.environ.get('VCSL','')
LEN={'cgh':1.2,'cgm':0.5,'tu':1.4,'bgh':0.8,'bgm':0.4,'bgl':0.9,'bglm':0.45,'tih':1.6,'til':1.8,'tb':0.6,'tbh':0.9,'tbr':1.6}
REF={'cgh':'lt','cgm':'ht','tu':'lt','bgh':'ht','bgm':'ht','bgl':'ht','bglm':'ht','tih':'sd','til':'sd','tb':'ch','tbh':'ch','tbr':'ch'}
P='Samples/perc/'; BG='Membranophones/Struck Membranophones/Bongos/'; T1='Idiophones/Struck Idiophones/Tambourine 1/'
def vd(inst,name,rr,mics=(('close','Close',1.0),('mid','Mid',0.5))):  # Virtuosity: Nah- + Raum-Mikro, ausgerichtet gemischt
    return [[(VD,f'{P}{m}/{inst}/{name}_rr{r}_{s}.wav',g) for m,s,g in mics] for r in rr]
def vdoh(inst,name,rr): return [[(VD,f'{P}oh/{inst}/{name}_rr{r}.wav',1.0)] for r in rr]
def vc(path,rr): return [[(VC,path.format(r=r),1.0)] for r in rr]
R8=range(1,9)
# Stimme -> Lautstärke-Stufen (leise -> laut), je Stufe Round-Robin-Liste aus Mikro-Listen
SPEC={
 'cgh':[vd('conga','Conga_22_HitN_1_50',R8),vd('conga','Conga_22_HitN_51_100',R8),vd('conga','Conga_22_HitN_101_127',R8)],
 'cgm':[vd('conga','Conga_17_HitHM1_1_70',R8),vd('conga','Conga_17_HitHM1_71_127',R8)],
 'tu':[vd('tumba',f'Tumba_24_HitN_{v}',R8) for v in ('1_40','41_70','71_100','101_127')],
 'bgh':[vd('bongoh',f'BongoH_Hit1_v{v}',R8) for v in (1,2,3)],
 'bgl':[vd('bongol',f'BongoL_Hit1_v{v}',R8) for v in (1,2,3)],
 'bgm':[vc(BG+f'BongoH_HitMuted1_v{v}'+'_rr{r}_Mid.wav',(1,2)) for v in (1,2,3)],
 'bglm':[vc(BG+f'BongoL_HitMuted2_v{v}'+'_rr{r}_Mid.wav',(1,2)) for v in (1,2,3)],
 'tih':[vdoh('timbales',f'timb13_vl{v}',range(1,5)) for v in range(1,6)],
 'til':[vdoh('timbales',f'timb14_vl{v}',range(1,5)) for v in range(1,5)],
 'tb':[vd('tambourine','Tamb1_Shake',range(1,11),mics=(('mid','Mid',1.0),))],
 'tbh':[vc(T1+f'Tamb1_Hit_v{v}'+'_rr{r}_Mid.wav',(1,)) for v in (1,2)],
 'tbr':[vc(T1+f'Tamb1_Roll_v{v}'+'_rr{r}_Mid.wav',(1,)) for v in (1,2,3)],
}
TARGET=[-19,-12,-5,0]
SLEN={'bd':0.9,'sd':0.7,'rs':0.6,'ch':0.5,'lt':2.0,'ht':1.8}
def run(cmd,**k): return subprocess.run(cmd,capture_output=True,**k)
CACHE={}
def load(repo,path):
    if (repo,path) in CACHE: return CACHE[(repo,path)]
    raw=run(['git','-C',repo,'show','HEAD:'+path]).stdout
    if not raw: raise SystemExit('fehlt: '+path)
    x=np.frombuffer(run(['ffmpeg','-v','error','-i','-','-ac','1','-f','f32le','-ar',str(SR),'-'],input=raw).stdout,dtype=np.float32).copy()
    CACHE[(repo,path)]=x; return x
def loadmp3(p): return np.frombuffer(run(['ffmpeg','-v','error','-i',p,'-ac','1','-f','f32le','-ar',str(SR),'-']).stdout,dtype=np.float32)
def onset(x):
    pk=np.abs(x).max(); i=int(np.argmax(np.abs(x)>pk*0.05)); return max(0,i-int(0.001*SR))
def align(ref,y):
    o=onset(ref); w=int(0.03*SR); a=ref[o:o+w]; best=(0,1,-1)
    for lag in range(-int(0.002*SR),int(0.012*SR)):
        s=o+lag
        if s<0 or s+w>len(y): continue
        b=y[s:s+w]; c=float(np.dot(a,b))/(np.linalg.norm(a)*np.linalg.norm(b)+1e-9)
        if abs(c)>best[2]: best=(lag,1 if c>=0 else -1,abs(c))
    lag,pol,_=best
    y=np.roll(y,-lag) if lag>=0 else np.concatenate([np.zeros(-lag,np.float32),y[:lag]])
    return y*pol
def limit(x,thr):
    la=int(0.0015*SR); a=np.abs(x); m=np.maximum.reduce([np.roll(a,-k) for k in range(la)]); rel=np.exp(-1/(0.06*SR)); e=0.0; env=np.zeros_like(a)
    for i in range(len(m)):
        e=m[i] if m[i]>e else e*rel+m[i]*(1-rel); env[i]=e
    return x*np.minimum(1.0,thr/(env+1e-9))
def rms60(x): o=onset(x); return float(np.sqrt((x[o:o+int(0.06*SR)]**2).mean()))
def ref_rms(v):  # Akzent, 1. Round Robin der Studio-Stimme
    d=loadmp3(ROOT+f'/samples/studio/{v}.mp3'); c=0
    while c<len(d) and c<SR*0.3 and abs(d[c])<0.4: c+=1
    n=int(SLEN[v]*SR); s=c+int(0.1*SR)+9*n; return rms60(d[s:s+n])
def hit(mics,n):
    base=load(*mics[0][:2]); o=onset(base); x=np.zeros(n,np.float32); b=base[o:o+n]*mics[0][2]; x[:len(b)]+=b
    for repo,p,g in mics[1:]:
        y=align(base,load(repo,p)); y=y[o:o+n]*g; x[:len(y)]+=y
    return x
def build(vid):
    n=int(LEN[vid]*SR); L=SPEC[vid]
    acc=[hit(L[i][0],n) for i in range(len(L))]
    pk=np.array([20*np.log10(np.abs(a).max()+1e-9) for a in acc]); top=pk.max()
    picks=[int(np.argmin(np.abs(pk-(top+t)))) for t in TARGET]
    slots=[]
    for li,v in enumerate(picks):
        att=10**((TARGET[li]-(pk[v]-top))/20) if (pk[v]-top)>TARGET[li]+2 else 1.0
        rrs=list(L[v]); rrs=[rrs[(li*3+k)%len(rrs)] for k in range(3)] if len(rrs)>=3 else (rrs*3)[:3]  # Stufen nutzen verschiedene RR
        for m in rrs: slots.append((li,hit(m,n)*att))
    a3=[x for li,x in slots if li==3]
    g=10**(-1/20)/max(np.abs(x).max() for x in a3)
    want=ref_rms(REF[vid])/(rms60(a3[0]*g)+1e-9); peak_ok=10**(-0.3/20)/(max(np.abs(x).max() for x in a3)*g); lim_db=0.0
    if want>peak_ok:
        lim=min(want/peak_ok,10**(3/20)); thr=10**(-0.5/20)/(g*peak_ok*lim)
        lp={li:max(np.abs(x).max() for l2,x in slots if l2==li) for li in range(4)}
        slots=[(li,limit(x,thr*lp[li]/lp[3])) for li,x in slots]; g*=peak_ok*lim; lim_db=20*np.log10(lim)
    else: g*=want
    accR=rms60([x for li,x in slots if li==3][0]); sp=[]
    for li in range(3):
        lr=rms60([x for l2,x in slots if l2==li][0]); wl=accR*10**(TARGET[li]/20)
        f=min(1.0,wl*10**(1/20)/(lr+1e-12)) if lr>wl*10**(1/20) else 1.0
        slots=[(l2,x*f if l2==li else x) for l2,x in slots]; sp.append(round(20*np.log10(f),1))
    PRE=4410; buf=np.zeros(PRE+12*n,np.float32); buf[0]=0.9
    for k,(li,x) in enumerate(slots):
        x=x*g; fs=int(n*0.6); x=x.copy(); x[fs:]*=np.linspace(1,0,n-fs)**2
        buf[PRE+k*n:PRE+(k+1)*n]=np.clip(x,-1,1)
    os.makedirs(OUT,exist_ok=True); dst=f'{OUT}/{vid}.mp3'
    run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-q:a','4',dst],input=buf.tobytes(),check=True)
    r={'stufen':[int(p) for p in picks],'quellStufen':len(L),'rr':len(L[-1]),'abstand_dB':sp,'limit_dB':round(float(lim_db),1),'len':LEN[vid],'kb':os.path.getsize(dst)//1024}
    print(vid,r,flush=True); return r
if __name__=='__main__':
    want=sys.argv[1].split(',') if len(sys.argv)>1 else list(SPEC)
    rp=OUT+'/report.json'; rep=json.load(open(rp)) if os.path.exists(rp) else {}
    for v in want: rep[v]=build(v)
    json.dump(rep,open(rp,'w'),indent=1)
