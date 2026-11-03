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

  // ---- Live-Zustand sichern ----
  const liveCtx=audioCtx, liveMaster=master, liveComp=comp, liveNoise=noiseBuf;
  const liveReverbIn=reverbInputNode, liveReverbConv=reverbConvolver, liveUseWorklet=useWorklet;
  const liveDelayIn=delayInputNode, liveDelayNode=delayNode, liveDelayFb=delayFeedbackGain, liveDelayOut=delayOutputGain;
  const livePadDelaySend=padDelaySendGain, liveFXG=FXG;
  // Bugfix: ohne Sichern/Zurücksetzen zeigte diese globale Choke-Group-Referenz nach dem Export
  // ggf. noch auf einen Gain-Node des bereits verworfenen OfflineAudioContext — der nächste
  // Live-Choke-Versuch scheiterte dann still (von try/catch abgefangen, aber ein verschluckter Choke).
  const liveOpenHatGain=lastOpenHatGain; lastOpenHatGain=null;
  const liveOpenSample=lastOpenSample; lastOpenSample=null; // dito für die offene Sample-Hi-Hat
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
        triggerTrack(tr, hitTime, v, si.note|0);
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
// Dekodiert einen Bibliothekseintrag und weist ihn der Sample-Spur bzw. einem Pad zu —
// aktualisiert dabei genau die Variablen, die triggerTrack()/playPad() ohnehin schon lesen.
async function applySampleToTrack(entry){
  await Promise.resolve(initAudio());
  const arr=await entry.blob.arrayBuffer();
  sampleBuffer=await audioCtx.decodeAudioData(arr);
  sampleStartOffset=entry.offsetStart||0;
  sampleMode=entry.playMode||'oneshot'; sampleOverlap=!!entry.overlap; sampleLoopStart=entry.loopStart!=null?entry.loopStart:null; sampleLoopEnd=entry.loopEnd!=null?entry.loopEnd:null;
  sampleTrackSampleId=entry.id;
  try{ localStorage.setItem('mrm44_sampleTrackId', entry.id); }catch(e){}
  if(TRACKS[activeTrackIdx] && TRACKS[activeTrackIdx].isSample) updateRecStatus();
}
async function applySampleToPad(i, entry){
  await Promise.resolve(initAudio());
  const arr=await entry.blob.arrayBuffer();
  padSamples[i].buffer=await audioCtx.decodeAudioData(arr);
  padSamples[i].offset=entry.offsetStart||0;
  padSamples[i].mode=entry.playMode||'oneshot'; padSamples[i].overlap=!!entry.overlap;
  padSamples[i].loopStart=entry.loopStart!=null?entry.loopStart:null; padSamples[i].loopEnd=entry.loopEnd!=null?entry.loopEnd:null;
  padSampleId[i]=entry.id;
  try{
    const ids=JSON.parse(localStorage.getItem('mrm44_padSampleIds')||'[]');
    ids[i]=entry.id;
    localStorage.setItem('mrm44_padSampleIds', JSON.stringify(ids));
  }catch(e){}
  updatePadUI(i);
}
// Lädt beim Start: erst die einmalige Migration, dann die zuletzt gespeicherten Zuordnungen
// für Sample-Spur und Pads (ersetzt die alten loadSampleFromIndexedDB()/loadPadsFromIndexedDB()).
async function restoreSampleAssignments(){
  await migrateLegacySamplesIfNeeded();
  try{
    const trackId=localStorage.getItem('mrm44_sampleTrackId');
    if(trackId){ const entry=await loadSampleLibraryEntry(trackId); if(entry) await applySampleToTrack(entry); }
  }catch(err){ console.warn('Sample-Spur-Zuordnung konnte nicht geladen werden:', err); }
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
