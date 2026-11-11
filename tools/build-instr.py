# Werk-Instrumente für den Sampler bauen (#61, #71): mehrere Töne × Lautstärken × Round Robin je Instrument.
# Ergebnis: samples/instr/<id>-<hash>.mp3 (mono 44,1 kHz, LAME VBR) + js/sampler-werk.js (Karte der Slots).
# Datei: Sync-Klick bei 0 s, ab 0,1 s die Slots hintereinander (je 0,05 s Pause). Slot = [Start (s ab Klick+0,1), Länge, Verstimmung in Cent].
# Quellen (CC0): VSCO 2 Community Edition (sgossner/VSCO-2-CE; Dateinamen eine Oktave tiefer benannt: C1 = MIDI 36),
#               Karoryfer Meatbass (sfzinstruments/karoryfer.meatbass, Kontrabass Otto Rubner 1958; Namen = MIDI, a0 = 21).
# Aufruf: VSCO=/pfad/VSCO-2-CE MB=/pfad/karoryfer.meatbass python3 tools/build-instr.py [id,…]
#   Beide als blobless Klon (git clone --filter=blob:none --no-checkout); Dateien kommen per `git show HEAD:<pfad>`.
# Aufbereitung:
#   - Anfang: ab Anschlag (2 % der Spitze) − 8 ms. Gezupft: Länge LEN, letzte 30 % ausgeblendet.
#   - Gestrichen: Schleife [LOOP_A, LEN] mit Überblendung (gleiche Leistung, XF s) eingebacken → Loop springt nahtlos zurück.
#   - g = Pegel des Instruments relativ zu den anderen (Wiedergabe × g).
#   - Lautstärke: je Ton auf gleiche Lautheit der lautesten Stufe (RMS ab Anschlag, gezupft 0,3 s, gestrichen 0,5–1,5 s),
#     leisere Stufen desselben Tons bekommen dieselbe Verstärkung (Dynamik bleibt). Danach Instrument auf −1 dBFS Spitze.
#   - Stimmung: gemessene Tonhöhe (Autokorrelation) → Abweichung in Cent im Slot, die Wiedergabe gleicht aus (nur wenn < 60 Cent;
#     weicht ein Slot > 15 Cent vom Median des Tons ab, gilt der Median).
import os, sys, re, json, hashlib, subprocess, numpy as np
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT=ROOT+'/samples/instr'; SR=44100
VS=os.environ.get('VSCO',''); MB=os.environ.get('MB','')
NN={'c':0,'c#':1,'db':1,'d':2,'d#':3,'eb':3,'e':4,'f':5,'f#':6,'gb':6,'g':7,'g#':8,'ab':8,'a':9,'a#':10,'bb':10,'b':11}
def midi(name, shift=0):
    m=re.match(r'([a-gA-G][#b]?)(-?\d)$',name); return NN[m.group(1).lower()]+12*(int(m.group(2))+1)+shift
CE='Strings/Cello Section/'; VA='Strings/Viola Section/'; VN='Strings/Violin Section/'
def vs(path): return (VS,path)
def mb(path): return (MB,path)
# Zonen: (Name, Quelle je Stufe leise→laut, je Stufe Liste der Round Robins)
def str_zone(n):
    if midi(n,12)<=53: return [[vs(f'{CE}susvib/susvib_{n}_v{v}_1.wav')] for v in (1,3)]
    if midi(n,12)<=65: return [[vs(f'{VA}susvib/ViolaEns_susvib_{n}_v{v}_1.wav')] for v in (1,2)]
    return [[vs(f'{VN}susVib/VlnEns_susVib_{n}_v{v}.wav')] for v in (1,2)]
def piz_zone(n):
    if midi(n,12)<=53: return [[vs(f'{CE}pizzT/pizzT_{n}_v{v}_RR{r}.wav') for r in (1,2)] for v in (1,2)]
    if midi(n,12)<=65: return [[vs(f'{VA}pizz/ViolaEns_pizz_{n}_v{v}_rr{r}.wav') for r in (1,2)] for v in (1,2)]
    return [[vs(f'{VN}Pizz/VlnEns_Pizz_{n}_v{v}_rr{r}.wav') for r in (1,2)] for v in (1,2)]
STR_N=['C1','E1','G1','B1','D2','F2','G2','B2','D3','F3','A3','C4','E4','G4','B4','D5']   # VSCO-Namen (+12 = MIDI)
BASS_N=['c1','eb1','gb1','a1','c2','eb2','gb2','a2','c3','eb3','gb3','a3']                 # Meatbass-Namen (= MIDI)
INSTR={
 'str':dict(name='STREICHER', desc='Ensemble, gestrichen', sustain=True, LEN=3.0, LOOP_A=1.4, XF=0.45, rel=0.4, atk=0.005,
            zones=[(midi(n,12), str_zone(n)) for n in STR_N]),
 'piz':dict(name='PIZZICATO', desc='Ensemble, gezupft', sustain=False, LEN=1.3, rel=0.25, atk=0.002,
            zones=[(midi(n,12), piz_zone(n)) for n in STR_N]),
 'kb': dict(name='KONTRABASS', desc='gezupft', sustain=False, LEN=1.7, rel=0.2, atk=0.002,
            zones=[(midi(n), [[mb(f'Samples/pizz/{n}_vl{v}_rr{r}.wav') for r in (1,3)] for v in (1,2,3,4)]) for n in BASS_N]),
 'kba':dict(name='BASS ARCO', desc='Kontrabass, gestrichen', sustain=True, g=0.7, LEN=2.6, LOOP_A=1.2, XF=0.4, rel=0.3, atk=0.005,
            zones=[(midi(n), [[mb(f'Samples/arco_looped/{n}_vl{v}_down.wav')] for v in (1,2,3)]) for n in BASS_N]),
}
def run(cmd,**k): return subprocess.run(cmd,capture_output=True,**k)
def load(src):
    repo,path=src; raw=run(['git','-C',repo,'show','HEAD:'+path]).stdout
    if not raw: raise SystemExit('fehlt: '+path)
    return np.frombuffer(run(['ffmpeg','-v','error','-i','-','-ac','1','-f','f32le','-ar',str(SR),'-'],input=raw).stdout,dtype=np.float32).copy()
def f0(x,a,N=8192):  # MIDI aus normierter Autokorrelation (kürzeste Periode ≥ 90 % der Spitze)
    seg=x[a:a+N]; seg=seg-seg.mean(); lo,hi=int(SR/1500),int(SR/25)
    if len(seg)<N: return None
    c=np.correlate(seg,seg,'full')[N-1:]; e=np.sqrt(np.cumsum(seg[::-1]**2)[::-1]); r=c[:hi+2]/(e[0]*e[:hi+2]+1e-9); mx=r[lo:hi].max()
    if mx<0.5: return None
    for L in range(lo+1,hi):
        if r[L]>=0.9*mx and r[L]>=r[L-1] and r[L]>=r[L+1]:
            p=r[L-1]-2*r[L]+r[L+1]; d=0.5*(r[L-1]-r[L+1])/p if p<0 else 0; return 69+12*np.log2(SR/(L+d)/440)
def cents(x,root,sus):
    ms=[f0(x,int(t*SR)) for t in ((0.5,0.8,1.1,1.4) if sus else (0.12,0.25,0.4))]
    ds=[(m-root)-12*round((m-root)/12) for m in ms if m is not None]
    if not ds: return 0
    d=float(np.median(ds)); return round(d*100) if abs(d)<0.6 else 0
def prep(x,I):
    pk=np.abs(x).max(); on=max(0,int(np.argmax(np.abs(x)>pk*0.02))-int(0.008*SR)); n=int(I['LEN']*SR)
    y=x[on:on+n].copy()
    if len(y)<n: y=np.concatenate([y,np.zeros(n-len(y),np.float32)])
    y[:int(0.002*SR)]*=np.linspace(0,1,int(0.002*SR))
    if I['sustain']:
        a=int(I['LOOP_A']*SR); X=int(I['XF']*SR); w=np.linspace(0,1,X)
        y[n-X:n]=y[n-X:n]*np.cos(w*np.pi/2)+y[a-X:a]*np.sin(w*np.pi/2)   # bei n = Wert bei a → nahtlos
    else:
        f=int(0.3*n); y[n-f:]*=np.linspace(1,0,f)**2
    return y
def loud(y,I):
    s=y[int(0.5*SR):int(1.5*SR)] if I['sustain'] else y[:int(0.3*SR)]
    return float(np.sqrt(np.mean(s**2))+1e-9)
def build(iid):
    I=INSTR[iid]; zs=[]; nm=0
    for root,layers in I['zones']:
        L=[[prep(load(s),I) for s in rr] for rr in layers]
        g=0.1/np.mean([loud(y,I) for y in L[-1]])          # lauteste Stufe → gleiche Lautheit je Ton
        L=[[y*g for y in rr] for rr in L]
        C=[[cents(y,root,I['sustain']) for y in rr] for rr in L]
        md=int(np.median([c for rr in C for c in rr]))                 # Ausreißer (Anschlag gezupft) → Mittel des Tons
        C=[[c if abs(c-md)<=15 else md for c in rr] for rr in C]
        zs.append((root,[[(y,c) for y,c in zip(yr,cr)] for yr,cr in zip(L,C)])); nm+=sum(len(rr) for rr in L)
    pk=max(np.abs(y).max() for _,L in zs for rr in L for y,_ in rr); k=10**(-1/20)/pk
    gap=np.zeros(int(0.05*SR),np.float32); parts=[np.zeros(int(0.1*SR),np.float32)]; parts[0][:3]=0.9; t=0.0; Z=[]
    for root,L in zs:
        zl=[]
        for rr in L:
            sl=[]
            for y,c in rr: sl.append([round(t,4),I['LEN'],c]); parts+=[y*k,gap]; t+=I['LEN']+0.05
            zl.append(sl)
        Z.append([root,zl])
    wav=np.concatenate(parts).astype(np.float32)
    os.makedirs(OUT,exist_ok=True)
    for f in os.listdir(OUT):
        if f.startswith(iid+'-'): os.remove(OUT+'/'+f)
    tmp=OUT+'/_tmp.mp3'
    run(['ffmpeg','-v','error','-y','-f','f32le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-q:a','4',tmp],input=wav.tobytes())
    h=hashlib.sha1(open(tmp,'rb').read()).hexdigest()[:8]; fn=f'{iid}-{h}.mp3'; os.replace(tmp,OUT+'/'+fn)
    cs=[c for _,L in zs for rr in L for _,c in rr]
    print(f'{iid}: {len(zs)} Töne, {nm} Slots, {len(wav)/SR:.0f} s, {os.path.getsize(OUT+"/"+fn)/1e6:.2f} MB, Cent {min(cs)}…{max(cs)}')
    d={k2:I[k2] for k2 in ('name','desc','rel','atk','g') if k2 in I}
    d.update(file='samples/instr/'+fn, mode='loop' if I['sustain'] else 'oneshot', z=Z)
    if I['sustain']: d['loop']=[I['LOOP_A'],I['LEN']]
    return d
def main():
    ids=sys.argv[1].split(',') if len(sys.argv)>1 else list(INSTR)
    js=ROOT+'/js/sampler-werk.js'; old={}
    if os.path.exists(js):
        m=re.search(r'const SMP_INSTR=(\{.*\});',open(js,encoding='utf8').read(),re.S)
        if m: old=json.loads(m.group(1))
    for i in ids: old[i]=build(i)
    out={i:old[i] for i in INSTR if i in old}
    open(js,'w',encoding='utf8').write('"use strict";\n// ERZEUGT von tools/build-instr.py — nicht von Hand ändern.\n'
      '// Werk-Instrumente des Samplers (#61): z = [[MIDI-Ton, [Stufe leise→laut: [Round Robin: [Start s, Länge s, Cent]]]]], loop = [Start, Ende] s im Slot.\n'
      'const SMP_INSTR='+json.dumps(out,ensure_ascii=False,separators=(',',':'))+';\n')
main()
