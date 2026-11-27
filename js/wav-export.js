"use strict";
// =========================================================================
// WAV-EXPORT — rendert das aktuelle Pattern offline (nicht in Echtzeit) über
// einen OfflineAudioContext. Die komplette Engine hängt bereits an den
// modulweiten Variablen audioCtx/master/tr.bus statt fest verdrahteten
// Referenzen — deshalb reicht es, diese kurzzeitig auf den Offline-Kontext
// umzubiegen, alle Steps "trocken" (ohne Echtzeit-Lookahead) durchzuplanen,
// zu rendern und danach den Live-Zustand wiederherzustellen.
//
// Seit v67 nutzt der Export dasselbe FM-Worklet wie die Live-Wiedergabe (klingt identisch).
// Nur wenn live kein Worklet verfügbar ist, läuft auch der Export über den nativen Ersatzpfad.
// Humanize wird beim Export bewusst NICHT angewendet, damit das Ergebnis
// reproduzierbar bleibt (Feel-Werte pro Spur wirken weiterhin).
async function renderPatternToWav(){
  await Promise.resolve(initAudio());
  if(audioCtx.state!=='running') await audioCtx.resume();
  // Sample-Kits erst fertig laden — sonst landet still der Synth-Ersatz im WAV (#12). Fehlgeschlagene Kits → Synth wie live.
  await Promise.all(smpKitsInUse().map(smpLoad));
  await samplerSync(); // Sampler-Spuren (#8): Samples erst fertig dekodieren, sonst fehlen sie im WAV

  // ---- Live-Zustand sichern ----
  const liveCtx=audioCtx, liveMaster=master, liveComp=comp, liveNoise=noiseBuf;
  const liveReverbIn=reverbInputNode, liveReverbConv=reverbConvolver, liveUseWorklet=useWorklet;
  const liveDelayIn=delayInputNode, liveDelayNode=delayNode, liveDelayFb=delayFeedbackGain, liveDelayOut=delayOutputGain;
  const livePadDelaySend=padDelaySendGain, liveFXG=FXG;
  // Bugfix: ohne Sichern/Zurücksetzen zeigte diese globale Choke-Group-Referenz nach dem Export
  // ggf. noch auf einen Gain-Node des bereits verworfenen OfflineAudioContext — der nächste
  // Live-Choke-Versuch scheiterte dann still (von try/catch abgefangen, aber ein verschluckter Choke).
  const liveOpenHatGain=lastOpenHatGain; lastOpenHatGain={};
  const liveOpenSample=lastOpenSample; lastOpenSample={}; // dito für die offene Sample-Hi-Hat
  const BUS_KEYS=['bus','eqHp','eqLow','eqMid','eqHigh','post','panner','analyser','sendGain','delaySendGain','_fxN','_eqIn'];
  const busBackup=TRACKS.map(tr=>{ const o={arpOsc:tr._arpOsc, arpFilter:tr._arpFilter, arpAmp:tr._arpAmp, arpLastFreq:tr._arpLastFreq}; BUS_KEYS.forEach(k=>o[k]=tr[k]); return o; });

  const secondsPerStep=60/bpm/4;
  const tailSeconds=2.6; // Hall-/Delay-Ausklang nach dem letzten Step
  // Vorlauf: der Master-Kompressor schwingt in den ersten ~0,2 s eines frischen Kontexts ein und dämpft dort stärker
  // (erster Schlag sonst bis ~3 dB leiser als live). Wird nach dem Rendern wieder abgeschnitten.
  const preRoll=0.25;
  const totalSeconds=preRoll + secondsPerStep*seqLength() + tailSeconds;
  const sampleRate=liveCtx.sampleRate;
  const OfflineCtor=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const offlineCtx=new OfflineCtor(2, Math.ceil(totalSeconds*sampleRate), sampleRate);

  // ---- Engine auf den Offline-Kontext umbiegen ----
  audioCtx=offlineCtx;
  // v67: Export über dasselbe FM-Worklet wie live (klingt identisch); nativer Pfad nur, wenn es live auch keins gibt
  useWorklet=false;
  if(liveUseWorklet && offlineCtx.audioWorklet){
    try{ await offlineCtx.audioWorklet.addModule(URL.createObjectURL(new Blob([FM_WORKLET_SRC],{type:'application/javascript'}))); useWorklet=true; }
    catch(e){ console.warn('Export: Worklet nicht ladbar, nutze nativen Pfad', e); useWorklet=false; }
  }
  comp=makeOutStage(offlineCtx).inp; // gleicher Ausgang wie live (#51)
  master=offlineCtx.createGain(); master.gain.value=masterVol;
  noiseBuf=makeNoise(2);
  buildFxBuses(); // gleicher Aufbau wie live: Hall, Delay, Gruppen (Drums, Perc), Master-Effekte

  TRACKS.forEach(tr=>{ BUS_KEYS.forEach(k=>tr[k]=null); tr._arpOsc=null; tr._arpFilter=null; tr._arpAmp=null; tr._arpLastFreq=null; tr._arpHeld=false; tr._arpPeak=0; tr._arpEnvT0=0; tr._arpOff=0; tr._arpOffT=0; });
  ensureTrackBuses();

  // ---- Alle Steps des Patterns direkt durchplanen (kein Echtzeit-Scheduler nötig) ----
  const anySolo=TRACKS.some(t=>t.solo);
  let t=preRoll+0.05;
  for(let step=0; step<seqLength(); step++){
    let dur=secondsPerStep;
    if(step%2===1) dur += secondsPerStep*swing;
    TRACKS.forEach(tr=>{
      const si=tr.type==='arp' ? null : stepInfo(tr,step), v=si ? si.v : (evStarts(tr,step).length?1:0);
      if(v<=0) return;
      if(anySolo && !tr.solo) return;
      if(!anySolo && tr.muted) return;
      const hitTime=Math.max(0, t + (tr.feel||0)/1000);
      if(tr.type==='arp'){
        evPlay(tr, step, hitTime, 1, step);
      } else {
        triggerRat(tr, hitTime, v, stArt(si.note), stRat(si.note), dur); // Wirbel (#46) über die Step-Länge
      }
    });
    t+=dur;
  }

  const fullBuffer=await offlineCtx.startRendering();
  const cut=Math.round(preRoll*sampleRate), renderedBuffer=liveCtx.createBuffer(2, fullBuffer.length-cut, sampleRate);
  for(let ch=0; ch<2; ch++) renderedBuffer.getChannelData(ch).set(fullBuffer.getChannelData(ch).subarray(cut));

  // ---- Live-Zustand wiederherstellen ----
  audioCtx=liveCtx; master=liveMaster; comp=liveComp; noiseBuf=liveNoise;
  reverbInputNode=liveReverbIn; reverbConvolver=liveReverbConv; useWorklet=liveUseWorklet;
  delayInputNode=liveDelayIn; delayNode=liveDelayNode; delayFeedbackGain=liveDelayFb; delayOutputGain=liveDelayOut;
  padDelaySendGain=livePadDelaySend; FXG=liveFXG;
  lastOpenHatGain=liveOpenHatGain; lastOpenSample=liveOpenSample;
  TRACKS.forEach((tr,i)=>{
    BUS_KEYS.forEach(k=>tr[k]=busBackup[i][k]);
    tr._arpOsc=busBackup[i].arpOsc; tr._arpFilter=busBackup[i].arpFilter;
    tr._arpAmp=busBackup[i].arpAmp; tr._arpLastFreq=busBackup[i].arpLastFreq; tr._arpHeld=false; tr._arpPeak=0; tr._arpEnvT0=0; tr._arpOff=0; tr._arpOffT=0;
  });

  return renderedBuffer;
}

// ---- IndexedDB-Persistenz (optional, überlebt Reload) ----
// Version 3 (diese Session): neuer Store "sampleLibrary" für die zentrale Sample-Bibliothek,
// löst die bisherigen Einzelablagen (ein Mic-Sample-Slot + 9 Pad-Slots im alten "samples"-
// Store) ab. Der alte "samples"-Store bleibt bestehen (nur für die einmalige Migration
// bestehender Aufnahmen gelesen, s. migrateLegacySamplesIfNeeded()), damit niemand seine
// bereits aufgenommenen Samples durch dieses Update verliert.
const IDB_NAME='RM909SampleDB', IDB_STORE='samples', IDB_KEY='micSample', IDB_PATTERNS='patterns', IDB_SAMPLES='sampleLibrary', IDB_SONGS='songs', IDB_BEATS='beats', IDB_DRUMSETS='drumsets';
function idbOpen(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(IDB_NAME,6);
    req.onupgradeneeded=(e)=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      if(!db.objectStoreNames.contains(IDB_PATTERNS)) db.createObjectStore(IDB_PATTERNS);
      if(!db.objectStoreNames.contains(IDB_SAMPLES)) db.createObjectStore(IDB_SAMPLES);
      if(!db.objectStoreNames.contains(IDB_SONGS)) db.createObjectStore(IDB_SONGS);
      if(!db.objectStoreNames.contains(IDB_BEATS)) db.createObjectStore(IDB_BEATS);
      if(!db.objectStoreNames.contains(IDB_DRUMSETS)) db.createObjectStore(IDB_DRUMSETS);
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
// ---- Sample-Bibliothek: CRUD, analog zum Pattern-Speicher (gleiche Konventionen,
// gleiche genId()) — ein Eintrag: {id, name, blob (WAV), offsetStart, offsetEnd, savedAt}
async function saveSampleLibraryEntry(entry){
  const db=await idbOpen();
  const tx=db.transaction(IDB_SAMPLES,'readwrite');
  tx.objectStore(IDB_SAMPLES).put(entry, entry.id);
}
async function loadSampleLibraryEntry(id){
  const db=await idbOpen();
  const tx=db.transaction(IDB_SAMPLES,'readonly');
  return new Promise((res,rej)=>{
    const r=tx.objectStore(IDB_SAMPLES).get(id);
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  });
}
async function deleteSampleLibraryEntry(id){
  const db=await idbOpen();
  const tx=db.transaction(IDB_SAMPLES,'readwrite');
  tx.objectStore(IDB_SAMPLES).delete(id);
}
async function listSampleLibrary(){
  const db=await idbOpen();
  const out=[];
  await new Promise((res,rej)=>{
    const tx=db.transaction(IDB_SAMPLES,'readonly');
    const req=tx.objectStore(IDB_SAMPLES).openCursor();
    req.onsuccess=(e)=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(); };
    req.onerror=()=>rej(req.error);
  });
  return out.sort((a,b)=>b.savedAt-a.savedAt);
}
// Einmalige, transparente Migration: bestehende Aufnahmen aus dem alten Einzel-Slot-Modell
// (ein Mic-Sample, 9 Pad-Samples im "samples"-Store) werden — nur falls die neue Bibliothek
// noch komplett leer ist — als benannte Bibliothekseinträge übernommen und automatisch wieder
// der Sample-Spur bzw. dem jeweiligen Pad zugewiesen. Kein manueller Schritt, kein Datenverlust.
async function migrateLegacySamplesIfNeeded(){
  const existing=await listSampleLibrary();
  if(existing.length>0) return; // schon migriert oder Nutzer hat bereits eigene Bibliothekseinträge
  const db=await idbOpen();
  const tx=db.transaction(IDB_STORE,'readonly');
  const store=tx.objectStore(IDB_STORE);
  const getRec=(key)=>new Promise((res)=>{ const r=store.get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); });

  const micRec=await getRec(IDB_KEY);
  if(micRec){
    const blob=(micRec instanceof Blob) ? micRec : micRec.blob;
    const offset=(micRec instanceof Blob) ? 0 : (micRec.offset||0);
    const entry={id:genId(), name:'Mic-Sample (migriert)', blob, offsetStart:offset, offsetEnd:null, savedAt:Date.now()};
    await saveSampleLibraryEntry(entry);
    localStorage.setItem('mrm44_sampleTrackId', entry.id);
  }
  for(let i=0;i<PAD_COUNT;i++){
    const rec=await getRec('pad'+i);
    if(!rec) continue;
    const blob=(rec instanceof Blob) ? rec : rec.blob;
    const offset=(rec instanceof Blob) ? 0 : (rec.offset||0);
    const entry={id:genId(), name:'Pad '+(i+1)+' (migriert)', blob, offsetStart:offset, offsetEnd:null, savedAt:Date.now()};
    await saveSampleLibraryEntry(entry);
    const ids=JSON.parse(localStorage.getItem('mrm44_padSampleIds')||'[]');
    ids[i]=entry.id;
    localStorage.setItem('mrm44_padSampleIds', JSON.stringify(ids));
  }
}
// Bibliothek gruppiert (#11): Stücke (`src` = Original) folgen ihrem Original nach Nummer; liegt das Original
// selbst unter einem anderen oder fehlt es, steht das Stück oben. → [{e, kids:[…]}]
const SMP_LIB_OPEN=new Set(); // aufgeklappte Originale (Bibliothek in Set-Editor und Sampler-Klang)
function smpLibGroup(items){
  const by=new Map(items.map(e=>[e.id,e])), isKid=e=>!!e.src && by.has(e.src) && !by.get(e.src).src, kids=new Map();
  items.forEach(e=>{ if(isKid(e)){ if(!kids.has(e.src)) kids.set(e.src, []); kids.get(e.src).push(e); } });
  return items.filter(e=>!isKid(e)).map(e=>({e, kids:(kids.get(e.id)||[]).sort((a,b)=>(a.slice||0)-(b.slice||0))}));
}
// Loop-Überblendung (#10, Mockup A): Ende der Schleife [b−X, b] mit dem Stück vor L1 [a−X, a]
// mischen (gleiche Leistung, wie tools/build-instr.py). Nicht zerstörend: Eintrag speichert nur
// die gewünschte Länge `loopXf`, gemischt wird beim Laden in eine Kopie. X begrenzt auf den Platz
// vor L1 (ab `from`) und die halbe Schleife.
const LOOP_XF_MAX=0.3;
const loopXfWant=(a,b)=>Math.min(LOOP_XF_MAX, (b-a)/4);
function loopXfLen(a, b, want, from=0){ return Math.max(0, Math.min(want||0, a-from, (b-a)/2)); }
function loopXfBake(buf, a, b, want, from=0){
  const X=loopXfLen(a, b, want, from); if(!buf || X<=0.002) return buf;
  const sr=buf.sampleRate, ia=Math.round(a*sr), ib=Math.min(buf.length, Math.round(b*sr)), n=Math.min(Math.round(X*sr), ia, ib);
  const out=audioCtx.createBuffer(buf.numberOfChannels, buf.length, sr);
  for(let c=0;c<buf.numberOfChannels;c++){
    const s=buf.getChannelData(c), o=out.getChannelData(c); o.set(s);
    for(let i=0;i<n;i++){ const t=(i+0.5)/n; o[ib-n+i]=s[ib-n+i]*Math.cos(t*Math.PI/2)+s[ia-n+i]*Math.sin(t*Math.PI/2); }
  }
  return out;
}
// ---- Tonhöhe / Tempo (v118, #11 Stufe 2, Variante B): nicht zerstörend, der Eintrag speichert nur `semi` (±12 HT),
// `tempo` (50–200 %) und `art`: 'rate' = wie Plattenspieler (Tempo folgt der Tonhöhe, sauberster Klang),
// 'beats' = Anschläge bleiben unverändert, nur die Lücken werden kürzer/länger (wie Ableton „Beats“; für Drums),
// 'tones' = WSOLA-Zeitdehnung (für Flächen/Gesang). Gerechnet beim Laden bzw. Vorhören. Zeitfaktor g = neue/alte Länge.
const PT_ARTS=['rate','beats','tones'];
const ptOf=e=>({semi:Math.max(-12,Math.min(12,Math.round(+(e && e.semi)||0))), tempo:Math.max(50,Math.min(200,Math.round(+(e && e.tempo)||100))), art:PT_ARTS.includes(e && e.art) ? e.art : 'rate'});
const ptIsOn=pt=>pt.semi!==0 || (pt.art!=='rate' && pt.tempo!==100);
const ptG=pt=>pt.art==='rate' ? Math.pow(2,-pt.semi/12) : 100/pt.tempo;
// Anschläge (gleiche Logik wie der Modus Schneiden): Pegelsprung > 4 dB gegen die letzten ~23 ms, über der Grenze
// top − (6 + s·34) dB, mind. 90 ms Abstand, 6 ms vor dem Anschlag; snap = Funktion zum Einrasten (oder keine)
function smpOnsets(buf, a, b, s, snap){
  const x=buf.getChannelData(0), sr=buf.sampleRate, H=256, i0=Math.floor(a*sr), i1=Math.floor(b*sr), D=[];
  for(let i=i0;i+H<=i1;i+=H){ let e=0; for(let k=0;k<H;k++) e+=x[i+k]*x[i+k]; D.push(10*Math.log10(1e-12+e/H)); }
  let top=-240; for(const v of D) if(v>top) top=v;
  const floor=top-(6+s*34), gap=Math.round(0.09*sr/H), out=[]; let last=-gap;
  for(let k=4;k<D.length;k++){ const pm=Math.max(D[k-1],D[k-2],D[k-3],D[k-4]);
    if(D[k]>floor && D[k]-pm>4 && k-last>=gap){ const t=a+(k*H)/sr-0.006; if(t>a+0.03 && t<b-0.03) out.push(snap ? snap(t) : t); last=k; } }
  return out;
}
function ptResample(x, r){ const n=Math.max(1,Math.floor((x.length-1)/r)), y=new Float32Array(n);
  for(let i=0;i<n;i++){ const t=i*r, j=t|0, f=t-j; y[i]=x[j]*(1-f)+(x[j+1]||0)*f; } return y; }
// WSOLA: Fenster 4096 (~93 ms, gemessen am wenigsten „phasig“ bei Flächen; Transienten macht der Modus Beats), 50 % Überlappung, normierte Korrelation,
// Suche grob (Schritt 8) dann fein (±8, Schritt 1); Ausgabe durch die aufsummierte Fensterkurve geteilt.
function ptWsola(X, f){
  const L=X[0].length, N=Math.min(4096, 1<<Math.floor(Math.log2(Math.max(64,L>>1)))), Hs=N>>1, Ha=Hs/f, T=N>>2, outL=Math.max(1,Math.round(L*f));
  if(L<N*2) return X.map(x=>ptResample(x,1/f)); // zu kurz zum Dehnen: wie Plattenspieler
  const Y=X.map(()=>new Float32Array(outL+N)), W=new Float32Array(outL+N), w=new Float32Array(N);
  for(let i=0;i<N;i++) w[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
  const x0=X.length>1 ? X[0].map((v,i)=>v+X[1][i]) : X[0], M=N>>1;
  const corr=(p,ref,st)=>{ let c=0,e=1e-9; for(let i=0;i<M;i+=st){ const v=x0[p+i]; c+=v*x0[ref+i]; e+=v*v; } return c/Math.sqrt(e); };
  let prev=0;
  for(let k=0;k*Hs<outL;k++){
    const nom=Math.round(k*Ha); let pos=Math.max(0,Math.min(L-N,nom));
    if(k>0){ const ref=Math.min(L-N, prev+Hs), lo=Math.max(0,nom-T), hi=Math.min(L-N,nom+T); let best=pos, bc=-Infinity;
      for(let p=lo;p<=hi;p+=8){ const c=corr(p,ref,4); if(c>bc){ bc=c; best=p; } }
      const c0=best; for(let p=Math.max(lo,c0-8);p<=Math.min(hi,c0+8);p++){ const c=corr(p,ref,2); if(c>bc){ bc=c; best=p; } }
      pos=best; }
    prev=pos; const o=k*Hs;
    for(let i=0;i<N;i++) W[o+i]+=w[i];
    for(let c=0;c<X.length;c++){ const x=X[c], y=Y[c]; for(let i=0;i<N;i++) y[o+i]+=x[pos+i]*w[i]; }
  }
  return Y.map(y=>{ const r=y.subarray(0,outL); for(let i=0;i<outL;i++) r[i]/=Math.max(W[i],0.1); return r; });
}
// Beats: jedes Stück zwischen zwei Anschlägen beginnt an seiner neuen Stelle (·g), wird nur in der Tonhöhe
// umgerechnet und am neuen Abstand abgeschnitten (4 ms Ausblenden) bzw. endet natürlich (Lücke bleibt still).
function ptBeats(X, sr, p, g, onsets){
  const L=X[0].length, outL=Math.max(1,Math.round(L*g)), B=[0, ...onsets.map(t=>Math.round(t*sr)).filter(i=>i>0 && i<L), L];
  const Y=X.map(()=>new Float32Array(outL)), fi=Math.round(sr*0.0005), fo=Math.round(sr*0.004);
  const P=Math.round(sr*0.006), at=k=>k===0 ? 0 : k>=B.length-1 ? outL : Math.round((B[k]+P)*g)-P; // Schnitt liegt 6 ms vor dem Anschlag: Anschlag landet genau bei ·g
  for(let k=0;k<B.length-1;k++){
    const o=at(k), room=at(k+1)-o; if(room<=0) continue;
    X.forEach((x,c)=>{ let seg=x.subarray(B[k], B[k+1]); if(p!==1) seg=ptResample(seg,p);
      const n=Math.min(seg.length, room), y=Y[c], cut=seg.length>room;
      for(let i=0;i<n;i++){ let v=seg[i]; if(k>0 && i<fi) v*=i/fi; if(cut && i>n-fo) v*=Math.max(0,(n-i)/fo); y[o+i]+=v; } });
  }
  return Y;
}
// Rechnet einen Puffer mit Tonhöhe/Tempo des Eintrags (pt = ptOf(entry)); onsets nur für 'beats' (Sekunden).
function ptRender(buf, pt, onsets){
  if(!ptIsOn(pt)) return buf;
  const sr=buf.sampleRate, p=Math.pow(2,pt.semi/12), g=ptG(pt), X=[...Array(buf.numberOfChannels)].map((_,c)=>buf.getChannelData(c));
  let Y;
  if(pt.art==='rate') Y=X.map(x=>ptResample(x,p));
  else if(pt.art==='beats') Y=ptBeats(X, sr, p, g, onsets || smpOnsets(buf, 0, buf.duration, 0.15));
  else { Y=Math.abs(p*g-1)>1e-6 ? ptWsola(X, p*g) : X; if(p!==1) Y=Y.map(y=>ptResample(y,p)); }
  const out=new AudioBuffer({length:Y[0].length, numberOfChannels:Y.length, sampleRate:sr}); Y.forEach((y,c)=>out.getChannelData(c).set(y)); return out;
}
// Für Pads/Sampler/Drum-Sets: Puffer + Zeiten (Start, Loop) des Eintrags mit Tonhöhe/Tempo; Loop-Überblendung vorher.
function ptEntry(buf, e, off, loop){
  const pt=ptOf(e); if(!ptIsOn(pt)) return {buf, off, loop};
  const g=ptG(pt), on=Array.isArray(e.cuts) && e.cuts.length ? e.cuts.map(t=>t+off) : null;
  return {buf:ptRender(buf, pt, on), off:off*g, loop:loop ? [loop[0]*g, loop[1]*g] : null};
}
// Dekodiert einen Bibliothekseintrag und weist ihn einem Pad zu — aktualisiert genau die Variablen, die playPad() liest.
async function applySampleToPad(i, entry){
  await Promise.resolve(initAudio());
  const arr=await entry.blob.arrayBuffer();
  padSamples[i].buffer=await audioCtx.decodeAudioData(arr);
  padSamples[i].offset=entry.offsetStart||0;
  padSamples[i].mode=entry.playMode||'oneshot'; padSamples[i].overlap=!!entry.overlap;
  padSamples[i].loopStart=entry.loopStart!=null?entry.loopStart:null; padSamples[i].loopEnd=entry.loopEnd!=null?entry.loopEnd:null;
  if(padSamples[i].mode==='loop' && entry.loopXf>0 && padSamples[i].loopEnd>padSamples[i].loopStart)
    padSamples[i].buffer=loopXfBake(padSamples[i].buffer, padSamples[i].loopStart, padSamples[i].loopEnd, entry.loopXf, padSamples[i].offset);
  { const P=padSamples[i], hasL=P.loopEnd!=null && P.loopStart!=null, r=ptEntry(P.buffer, entry, P.offset, hasL ? [P.loopStart, P.loopEnd] : null); // #11 Tonhöhe/Tempo
    P.buffer=r.buf; P.offset=r.off; if(hasL){ P.loopStart=r.loop[0]; P.loopEnd=r.loop[1]; } }
  padSampleId[i]=entry.id;
  try{
    const ids=JSON.parse(localStorage.getItem('mrm44_padSampleIds')||'[]');
    ids[i]=entry.id;
    localStorage.setItem('mrm44_padSampleIds', JSON.stringify(ids));
  }catch(e){}
  updatePadUI(i);
}
// Lädt beim Start: erst die einmalige Migration, dann die zuletzt gespeicherten Zuordnungen
// der Pads (mrm44_sampleTrackId bleibt nur für die Umwandlung alter SAMPLE-Spuren, #8) (ersetzt die alten loadSampleFromIndexedDB()/loadPadsFromIndexedDB()).
async function restoreSampleAssignments(){
  await migrateLegacySamplesIfNeeded();
  try{
    const ids=JSON.parse(localStorage.getItem('mrm44_padSampleIds')||'[]');
    for(let i=0;i<PAD_COUNT;i++){
      if(ids[i]){ const entry=await loadSampleLibraryEntry(ids[i]); if(entry) await applySampleToPad(i, entry); }
    }
  }catch(err){ console.warn('Pad-Sample-Zuordnungen konnten nicht geladen werden:', err); }
}

// Der Sample-Editor (Aufnahme/Import/Bearbeitung/Zuweisung an Spur+Pads) steht weiter unten,
// direkt nach dem Pad-Grid — dort sind PAD_COUNT/padSamples/padSampleId bereits deklariert,
// die der Editor beim Aufbau seiner Pad-Zuweisungs-Chips sofort synchron braucht.
