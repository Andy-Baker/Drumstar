# Sample-Kits bauen: Bibliothek -> 4 Layer x 3 RR, Mikros ausgerichtet, Lautheit je Stimme = Studio, gebündelt pro Stimme.
# Aufruf: SAMPLE_WORK=/pfad python3 tools/build-samples.py studio s67 hyb rusty lofi   (studio zuerst, ist die Referenz)
# Erwartet in $SAMPLE_WORK/dl/ blobless Klone (git clone --filter=blob:none --no-checkout) von sfzinstruments/SMDrums,
# karoryfer.big-rusty-drums, karoryfer.swirly-drums, karoryfer.gogodze-phu-vol-ii und je eine Dateiliste <repo>.list
# (git ls-tree -r --name-only HEAD | grep -E '\.(wav|flac)$'). Ausgabe: $SAMPLE_WORK/kits2/<kit>/<stimme>.mp3 (lofi → samples/vintage).
# Braucht ffmpeg (libmp3lame) und numpy.
import re, os, sys, json, subprocess, numpy as np
B=os.environ.get('SAMPLE_WORK','.'); DL=B+'/dl'; SR=44100
S='Samples/SMDrum Stereo (Samples)/'; C='Samples/SMD Cymbals Stereo (Samples)/'
LEN={'bd':0.9,'sd':0.7,'rs':0.6,'ch':0.5,'oh':2.5,'hf':0.6,'ht':1.8,'lt':2.0,'cy':4.0,'rd':3.5,'rb':3.5}
# SM: (Ordner ohne /RRk) ; mehrere Ordner = jeweils eine Round-Robin-Quelle
SM={
 'studio':{'bd':[S+'Kik_Stereo'],'sd':[S+'Snare65_Reg_Stereo'],'rs':[S+'SideStick_Stereo'],'ch':[C+'Hi-Hat (Samples)/01 Hat Tight 1'],
   'oh':[C+'Hi-Hat (Samples)/03 Hat, Open'],'hf':[C+'Hi-Hat (Samples)/05 Hat, Foot'],'ht':[S+'Toms_Stereo/Tom1'],'lt':[S+'Toms_Stereo/Tom4'],
   'cy':[C+'Crash (Samples)/Crash 16 (Samples)'],'rd':[C+'Ride (Samples)/Ride 17 (Samples)'],'rb':[C+'Ride (Samples)/Ride 17 Bell (Samples)']},
 's67':{'sd':[S+'Snare67_NR_Stereo'],'ch':[C+'Hi-Hat (Samples)/02 Hat, Loose'],'ht':[S+'Toms_Stereo/Tom2'],'lt':[S+'Toms_Stereo/Tom3'],'cy':[C+'Crash (Samples)/Crash 17 (Samples)']},
 'hyb':{'sd':[S+'SMD_Snr_Str_HyB1 (Samples)',S+'SMD_Snr_Str_HyB2 (Samples)',S+'SMD_Snr_Str_HyB3 (Samples)'],'rs':[S+'SMD RimShot_Str_HyB1 (Samples)'],'cy':[C+'Crash (Samples)/Crash 15 (Samples)']},
}
# Karoryfer: Stimme -> [(Ordner, Präfix, Gain, Suffix)]; erstes Mikro = Referenz für Ausrichtung/Messung
KARO={
 'rusty':('karoryfer.big-rusty-drums',{
   'bd':[('Samples/kick_24/kick/kick','k',1.0,''),('Samples/kick_24/kick/oh','k',0.5,'')],
   'sd':[('Samples/snare_14/center/top','sn_center',1.0,''),('Samples/snare_14/center/btm','sn_center',0.35,''),('Samples/snare_14/center/oh','sn_center',0.5,'')],
   'rs':[('Samples/snare_14/sidestick/top','sn_ss',1.0,''),('Samples/snare_14/sidestick/oh','sn_ss',0.5,'')],
   'ch':[('Samples/hihat_14/tc/cl','ht_tc',1.0,''),('Samples/hihat_14/tc/oh','ht_tc',0.5,'')],
   'oh':[('Samples/hihat_14/open/cl','ht_open',1.0,''),('Samples/hihat_14/open/oh','ht_open',0.5,'')],
   'hf':[('Samples/hihat_14/chik/cl','ht_chik',1.0,''),('Samples/hihat_14/chik/oh','ht_chik',0.5,'')],
   'ht':[('Samples/tom_14/center/cl','t14',1.0,''),('Samples/tom_14/center/oh','t14',0.5,'')],
   'lt':[('Samples/tom_18/center/cl','t18',1.0,''),('Samples/tom_18/center/oh','t18',0.5,'')],
   'cy':[('Samples/crash_17/cr/oh','cr',1.0,''),('Samples/crash_17/cr/cl','cr',0.6,'')],
   'rd':[('Samples/ride_22/rd/oh','rd',1.0,''),('Samples/ride_22/rd/cl','rd',0.6,'')],
   'rb':[('Samples/ride_22/bl/oh','rd_bl',1.0,''),('Samples/ride_22/bl/cl','rd_bl',0.6,'')]}),
 'brush':('karoryfer.swirly-drums',{
   'bd':[('Samples/kick_buzz','buzz_kick_with_snare_buzz',1.0,'')],
   'sd':[('Samples/snare_main','snare_hit',1.0,'_top'),('Samples/snare_main','snare_hit',0.35,'_btm')],
   'rs':[('Samples/snare_edge','snare_edge',1.0,'_top'),('Samples/snare_edge','snare_edge',0.35,'_btm')],
   'ch':[('Samples/hat_closed','hh_closed',1.0,'')],'oh':[('Samples/hat_open','hh_open',1.0,'')],'hf':[('Samples/hat_foot','hh_foot',1.0,'')],
   'ht':[('Samples/tom_vhi','tom_vhi',1.0,'')],'lt':[('Samples/tom_floor','tom_floor',1.0,'')],
   'cy':[('Samples/crash','crash',1.0,'')],'rd':[('Samples/ride','ride',1.0,'')]}),
 'lofi':('karoryfer.gogodze-phu-vol-ii',{
   'bd':[('Samples/kick_mic','ks',1.0,''),('Samples/front_mic','ks',0.6,''),('Samples/oh_mic','ks',0.4,'')],
   'sd':[('Samples/snare_mic','sc',1.0,''),('Samples/front_mic','sc',0.6,''),('Samples/oh_mic','sc',0.4,'')],
   'rs':[('Samples/snare_mic','ss',1.0,''),('Samples/front_mic','ss',0.6,''),('Samples/oh_mic','ss',0.4,'')],
   'ch':[('Samples/front_mic','hc',1.0,''),('Samples/oh_mic','hc',0.5,'')],'oh':[('Samples/front_mic','ho',1.0,''),('Samples/oh_mic','ho',0.5,'')],
   'hf':[('Samples/front_mic','hf',1.0,''),('Samples/oh_mic','hf',0.5,'')],
   'ht':[('Samples/front_mic','th',1.0,''),('Samples/oh_mic','th',0.5,'')],'lt':[('Samples/front_mic','tl',1.0,''),('Samples/oh_mic','tl',0.5,'')]})
}
TARGET=[-19,-12,-5,0]
def run(cmd,**k): return subprocess.run(cmd,capture_output=True,**k)
def load(path):
    raw=run(['ffmpeg','-v','error','-i',path,'-ac','1','-f','f32le','-ar',str(SR),'-']).stdout
    return np.frombuffer(raw,dtype=np.float32).copy()
def checkout(repo,paths):
    R=f'{DL}/{repo}'; sp=f'{R}/.git/info/sparse-checkout'
    run(['git','-C',R,'sparse-checkout','init','--no-cone'])
    old=set(open(sp).read().split('\n')) if os.path.exists(sp) else set()
    open(sp,'w').write('\n'.join(sorted(x for x in old|{'/'+p for p in paths} if x)))
    run(['git','-C',R,'-c','gc.auto=0','checkout','HEAD'])
def onset(x):
    pk=np.abs(x).max(); i=int(np.argmax(np.abs(x)>pk*0.05)); return max(0,i-int(0.001*SR))
def align(ref,y):
    """Verschiebung (−2…+12 ms) und Polarität, die y am besten auf ref legt (Kreuzkorrelation der ersten 30 ms)."""
    o=onset(ref); w=int(0.03*SR); a=ref[o:o+w]; best=(0,1,-1)
    for lag in range(-int(0.002*SR),int(0.012*SR)):
        s=o+lag
        if s<0 or s+w>len(y): continue
        b=y[s:s+w]; c=float(np.dot(a,b))/(np.linalg.norm(a)*np.linalg.norm(b)+1e-9)
        if abs(c)>best[2]: best=(lag,1 if c>=0 else -1,abs(c))
    lag,pol,_=best
    y=np.roll(y,-lag) if lag>=0 else np.concatenate([np.zeros(-lag,np.float32),y[:lag]])
    return y*pol, lag/SR*1000, pol
def limit(x,thr):
    """Peak-Limiter mit 1,5 ms Vorschau, 60 ms Rückkehr: flacht nur die Anschlagspitze ab."""
    la=int(0.0015*SR); a=np.abs(x); env=np.zeros_like(a)
    m=np.maximum.reduce([np.roll(a,-k) for k in range(la)])  # Vorschau-Maximum
    rel=np.exp(-1/(0.06*SR)); e=0.0
    for i in range(len(m)):
        e=m[i] if m[i]>e else e*rel+m[i]*(1-rel); env[i]=e
    g=np.minimum(1.0,thr/(env+1e-9)); return x*g
def rms_win(x,vid):
    o=onset(x); w=int((0.4 if vid in ('oh','cy','rd','rb') else 0.06)*SR); return float(np.sqrt((x[o:o+w]**2).mean()))

def sm_entries(kit,vid):
    names=open(f'{DL}/SMDrums.list').read().split('\n'); srcs=SM[kit][vid]; out=[]
    for si,base in enumerate(srcs):
        pat=re.compile(re.escape(base)+r'/RR(\d+)/(\d+)_[^/]*\.wav$'); d={}
        for n in names:
            m=pat.match(n)
            if m: d.setdefault(int(m.group(2)),{})[int(m.group(1))]=n
        out.append(d)
    return out  # pro Quelle: {layer:{rr:pfad}}

def build(kit):
    out=f'{B}/kits2/{kit}'; os.makedirs(out,exist_ok=True); report={}
    ref=json.load(open(f'{B}/kits2/ref.json')) if kit!='studio' and os.path.exists(f'{B}/kits2/ref.json') else {}
    voices=SM[kit] if kit in SM else KARO[kit][1]
    for vid in voices:
        n=int(LEN[vid]*SR)
        if kit in SM:
            repo='SMDrums'; ent=sm_entries(kit,vid); main=ent[0]; vls=sorted(main)
            checkout(repo,[main[v][min(main[v])] for v in vls])
            pk=np.array([20*np.log10(np.abs(load(f'{DL}/{repo}/'+main[v][min(main[v])])).max()+1e-9) for v in vls])
        else:
            repo,V=KARO[kit]; mics=V[vid]; names=open(f'{DL}/{repo}.list').read().split('\n')
            def f(m,vl,rr):
                p=re.compile(re.escape(m[0])+'/'+re.escape(m[1])+r'_vl'+str(vl)+r'_rr'+str(rr)+re.escape(m[3])+r'\.(wav|flac)$')
                r=[x for x in names if p.match(x)]; return r[0] if r else None
            pat=re.compile(re.escape(mics[0][0])+'/'+re.escape(mics[0][1])+r'_vl(\d+)_rr(\d+)'+re.escape(mics[0][3])+r'\.(wav|flac)$'); L={}
            for x in names:
                m=pat.match(x)
                if m: L.setdefault(int(m.group(1)),set()).add(int(m.group(2)))
            vls=sorted(L); checkout(repo,[f(mics[0],v,min(L[v])) for v in vls])
            pk=np.array([20*np.log10(np.abs(load(f'{DL}/{repo}/'+f(mics[0],v,min(L[v])))).max()+1e-9) for v in vls])
        top=pk.max(); picks=[vls[int(np.argmin(np.abs(pk-(top+t))))] for t in TARGET]
        att=[10**((TARGET[i]-(pk[vls.index(v)]-top))/20) if (pk[vls.index(v)]-top)>TARGET[i]+2 else 1.0 for i,v in enumerate(picks)]
        slots=[]; info=[]
        for li,v in enumerate(picks):
            if kit in SM:
                cands=[]
                for e in ent:  # Round Robins: erst über Quellen, dann über RR-Nummern
                    if v in e: cands+= [e[v][r] for r in sorted(e[v])]
                if len(ent)>1: cands=[e[v][min(e[v])] for e in ent if v in e]+cands
                seen=[]; [seen.append(c) for c in cands if c not in seen]; cands=(seen*3)[:3]
                checkout(repo,cands)
                xs=[load(f'{DL}/{repo}/'+c)[:n] for c in cands]
            else:
                rrs=sorted(L[v]); rrs=(rrs*3)[:3]
                checkout(repo,[f(m,v,r) for r in rrs for m in mics if f(m,v,r)])
                xs=[]
                for r in rrs:
                    base=load(f'{DL}/{repo}/'+f(mics[0],v,r)); x=np.zeros(max(n,len(base)),np.float32); x[:len(base)]+=base*mics[0][2]
                    for m in mics[1:]:
                        p=f(m,v,r)
                        if not p: continue
                        y=load(f'{DL}/{repo}/'+p); y=np.pad(y,(0,max(0,len(x)-len(y))))[:len(x)]
                        y,ms,pol=align(base,y); x+=y*m[2]
                        if li==3 and r==rrs[0]: info.append(f'{m[0].split("/")[-1]}{m[3]}: {ms:+.1f} ms{" umgepolt" if pol<0 else ""}')
                    xs.append(x[:n])
            for x in xs: slots.append((li,np.pad(x,(0,max(0,n-len(x))))[:n]*att[li]))
        acc=[x for li,x in slots if li==3]
        g=1.0/max(np.abs(x).max() for x in acc)*10**(-1/20)  # erst auf Spitze −1 dB
        if kit=='studio': ref_r=rms_win(acc[0]*g,vid); json.dump({**json.load(open(f'{B}/kits2/ref.json')),vid:ref_r} if os.path.exists(f'{B}/kits2/ref.json') else {vid:ref_r},open(f'{B}/kits2/ref.json','w'))
        elif vid in ref:  # Lautheit wie Studio, Spitzen höchstens −0,3 dB
            want=ref[vid]/(rms_win(acc[0]*g,vid)+1e-9); peak_ok=10**(-0.3/20)/(max(np.abs(x).max() for x in acc)*g)
            lim_db=0.0
            if want>peak_ok:  # per Limiter holen (max. 10 dB), nach dem Limiter nachmessen und nachregeln
                orig=slots; lim=min(want/peak_ok,10**(6/20))
                for it in range(4):
                    thr=10**(-0.5/20)/(g*peak_ok*lim)
                    lp={li:max(np.abs(x).max() for l2,x in orig if l2==li) for li in range(4)}
                    cand=[(li,limit(x,thr*lp[li]/lp[3])) for li,x in orig]  # gleiche dB-Begrenzung je Stufe
                    acc2=[x for li,x in cand if li==3]; got=rms_win(acc2[0]*g*peak_ok*lim,vid)
                    if got>=ref[vid]*0.97 or lim>=10**(6/20): break
                    lim=min(lim*ref[vid]/got,10**(6/20))
                slots=cand; g*=peak_ok*lim; lim_db=20*np.log10(lim)
                report_l=20*np.log10(min(1.0,got/ref[vid]))
            else:
                g*=want; report_l=0.0
        # Stufen-Abstände nach Lautheit (60 ms): leisere Stufen höchstens auf −19/−12/−5 dB unter Akzent
        accR=rms_win([x for li,x in slots if li==3][0],'bd'); spacing=[]
        for li in range(3):
            lr=rms_win([x for l2,x in slots if l2==li][0],'bd'); want_l=accR*10**(TARGET[li]/20)
            f=min(1.0,want_l*10**(1/20)/(lr+1e-12)) if lr>want_l*10**(1/20) else 1.0
            slots=[(l2,x*f if l2==li else x) for l2,x in slots]; spacing.append(round(20*np.log10(f),1))
        # Bündeln: Sync-Klick, dann 12 Slots à n Samples (Layer 1..4 × RR 1..3)
        PRE=4410; buf=np.zeros(PRE+12*n,np.float32); buf[0]=0.9
        for k,(li,x) in enumerate(slots):
            x=x*g; fs=int(n*0.6); x=x.copy(); x[fs:]*=np.linspace(1,0,n-fs)**2
            buf[PRE+k*n:PRE+(k+1)*n]=np.clip(x,-1,1)
        dst=f'{out}/{vid}.mp3'
        run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-q:a','4',dst],input=buf.tobytes(),check=True)
        report[vid]={'abstand_dB':spacing,'layers':picks,'len':LEN[vid],'mics':info,'kb':os.path.getsize(dst)//1024}
        if kit!='studio' and vid in ref: report[vid]['zuLeise_dB']=round(float(report_l),1); report[vid]['limit_dB']=round(float(lim_db),1)
        print(kit,vid,report[vid],flush=True)
    json.dump(report,open(f'{out}/report.json','w'),indent=1)
for k in sys.argv[1:]: build(k)
