// Test-Hook: wird von tests/run.py in eine TEMP-KOPIE der index.html direkt nach "let activeTrackIdx=0;" eingesetzt
// (innerhalb der App-IIFE, hat also Zugriff auf deren Variablen). Nie in die echte index.html übernehmen.
window.__T=TRACKS; window.__sel=()=>activeTrackIdx; window.__pv=pianoVoice; window.__setCtx=c=>{audioCtx=c};
window.__audio={
  kits:()=>Object.keys(KITS).filter(k=>!KITS[k].samples), // Sample-Kits: eigener Test unten
  drumIds:()=>TRACKS.filter(t=>t.type!=='arp' && !t.isSample && VOICE_FNS[t.id]).map(t=>t.id),
  // Eine Drum-Stimme offline rendern (worklet=true: FM-Worklet wie live, false: nativer Fallback wie WAV-Export)
  async drum(id,kit,worklet,dur){
    const sr=48000, c=new OfflineAudioContext(2,Math.ceil(sr*dur),sr);
    const sv={a:audioCtx,n:noiseBuf,w:useWorklet,b:currentTrackBus,k:currentKitId};
    audioCtx=c; noiseBuf=makeNoise(2); useWorklet=false; currentKitId=kit; currentTrackBus=c.destination;
    try{
      if(worklet){ if(!c.audioWorklet) return {skip:'kein AudioWorklet'};
        await c.audioWorklet.addModule(URL.createObjectURL(new Blob([FM_WORKLET_SRC],{type:'application/javascript'}))); useWorklet=true; }
      const tr=TRACKS.find(t=>t.id===id), kp=KITS[kit].voices[id]; if(!kp) return {skip:'nicht im Kit'};
      VOICE_FNS[id](0.05,tr.vol,tr.tune,1,kp);
      const b=await c.startRendering(), L=b.getChannelData(0), R=b.getChannelData(1), x=new Float32Array(L.length);
      let pc=0; for(let i=0;i<x.length;i++){ x[i]=L[i]+R[i]; pc=Math.max(pc,Math.abs(L[i]),Math.abs(R[i])); }
      return {x:Array.from(x), sr, peakCh:pc};
    } finally { audioCtx=sv.a; noiseBuf=sv.n; useWorklet=sv.w; currentTrackBus=sv.b; currentKitId=sv.k; }
  },
  // Acid-Pattern über den echten WAV-Export rendern (nur Acid hörbar, ohne Hall/Delay)
  async acid(opt){
    const tr=TRACKS.find(t=>t.id==='arp');
    TRACKS.forEach(t=>{ t.solo=(t===tr); });
    if(tr.harm) tr.harm.mode='off'; delete tr.harmOwn;
    tr.events=opt.events.map(e=>Object.assign({l:1,v:1,a:0,sl:0},e)); evTouch(tr);
    Object.assign(tr,{cutoff:opt.cutoff,resonance:opt.reso,envMod:opt.envMod!=null?opt.envMod:0.5,reverbAmount:0,delaySend:0});
    if(tr.sendGain) tr.sendGain.gain.value=0; if(tr.delaySendGain) tr.delaySendGain.gain.value=0;
    bpm=opt.bpm||128; swing=0;
    const b=await renderPatternToWav(), L=b.getChannelData(0), R=b.getChannelData(1), x=new Float32Array(L.length);
    let pc=0; for(let i=0;i<x.length;i++){ x[i]=L[i]+R[i]; pc=Math.max(pc,Math.abs(L[i]),Math.abs(R[i])); }
    return {x:Array.from(x), sr:b.sampleRate, step:60/bpm/4, peakCh:pc};
  }
};
// Lastmessung: dichtes Drum-Pattern (64 Steps, 128 BPM) offline über das Worklet rendern, Wandzeit + Stimmenzahl
window.__audio.bench=async function(kit,reps){
  const sr=48000, st=60/128/4, dur=64*st+3, times=[];
  for(let r=0;r<reps;r++){
    const c=new OfflineAudioContext(2,Math.ceil(sr*dur),sr);
    const sv={a:audioCtx,n:noiseBuf,w:useWorklet,b:currentTrackBus,k:currentKitId};
    audioCtx=c; noiseBuf=makeNoise(2); currentKitId=kit; currentTrackBus=c.destination;
    try{
      await c.audioWorklet.addModule(URL.createObjectURL(new Blob([FM_WORKLET_SRC],{type:'application/javascript'}))); useWorklet=true;
      const hit=(id,t)=>{ const kp=KITS[kit].voices[id]; if(kp) VOICE_FNS[id](t,0.8,0.5,1,kp); };
      for(let s=0;s<64;s++){ const t=0.05+s*st; hit('ch',t); if(s%4===0) hit('bd',t); if(s%8===4) hit('sd',t); if(s%8===6) hit('oh',t); if(s%16===0) hit('cy',t); if(s%16===14){ hit('lt',t); hit('ht',t+st/2); } }
      const t0=performance.now(); await c.startRendering(); times.push(performance.now()-t0);
    } finally { audioCtx=sv.a; noiseBuf=sv.n; useWorklet=sv.w; currentTrackBus=sv.b; currentKitId=sv.k; }
  }
  times.sort((a,b)=>a-b); return {ms:times[Math.floor(times.length/2)], audioSec:dur};
};
// Eine Drum-Stimme über den echten WAV-Export rendern (ein Schlag auf Step 1, nur diese Spur, ohne Hall/Delay)
window.__audio.exportDrum=async function(id,kit){
  currentKitId=kit; const tr=TRACKS.find(t=>t.id===id);
  TRACKS.forEach(t=>{ t.solo=(t===tr); });
  tr.steps=tr.steps.map((_,i)=>i===0?1:0); tr.feel=0;
  if(tr.sendGain) tr.sendGain.gain.value=0; if(tr.delaySendGain) tr.delaySendGain.gain.value=0; tr.reverbAmount=0; tr.delaySend=0;
  const b=await renderPatternToWav(), L=b.getChannelData(0), R=b.getChannelData(1), x=new Float32Array(L.length);
  for(let i=0;i<x.length;i++) x[i]=L[i]+R[i];
  return {x:Array.from(x), sr:b.sampleRate};
};

// Sample-Kits: laden und prüfen (Anzahl Slots, größter Abstand Slotanfang → Schlag)
window.__audio.smpKits=()=>Object.keys(KITS).filter(k=>KITS[k].samples).map(k=>({id:k, voices:KITS[k].samples.voices}));
window.__audio.smpOpt=o=>Object.assign(smpOpt,o);
window.__audio.smpLoad=async function(kid){
  smpFree([kid,'studio']); await smpLoad(kid); const st=smp[kid]; let n=0, mo=0;
  Object.values(st.buf).forEach(set=>set.forEach((ly,l)=>ly.forEach((s,r)=>{ n++; })));
  return {state:st.state, n};
};
// Ganzes Drum-Pattern über den echten WAV-Export (nur Drums/Perc, ohne Hall/Delay). pat={bd:{0:4,...}} mit Stufen 1..4
window.__audio.exportPattern=async function(kit,pat,bpmv,vol){
  currentKitId=kit; drumSet.voices={}; drumSet.buffers={}; bpm=bpmv||100; swing=0; humanize=0; PATTERN_LENGTH=16;
  const V=[0,VEL_GHOST_SOFT,VEL_GHOST,VEL_NORMAL,VEL_ACCENT];
  TRACKS.forEach(t=>{ t.solo=false; t.muted=(t.type==='arp'||t.isSample||!VOICE_FNS[t.id]);
    if(!t.muted){ t.steps=t.steps.map(()=>0); if(t.notes) t.notes=t.notes.map(()=>0); } t.feel=0; t.reverbAmount=0; t.delaySend=0;
    if(t.sendGain) t.sendGain.gain.value=0; if(t.delaySendGain) t.delaySendGain.gain.value=0; });
  // Schlüssel = Spur oder Sample-Stimme einer Spielweise (hl/hf → Hi-Hat, rb → Ride)
  const sv=[]; for(const id in pat){ let tid=id, a=0; for(const k in ART){ const i=ART[k].findIndex(x=>x.v===id); if(i>0){ tid=k; a=i; } }
    const t=TRACKS.find(x=>x.id===tid); for(const s in pat[id]){ t.steps[+s]=V[pat[id][s]]; t.notes[+s]=a; } if(vol!=null){ sv.push([t,t.vol]); t.vol=vol; } }
  const b=await renderPatternToWav(); sv.forEach(([t,v])=>t.vol=v); if(window.gc) gc(); // Offline-Kontexte sofort freigeben (sonst läuft der Testbrowser voll)
  const L=b.getChannelData(0), R=b.getChannelData(1), x=new Float32Array(L.length);
  let pc=0; for(let i=0;i<x.length;i++){ x[i]=L[i]+R[i]; pc=Math.max(pc,Math.abs(L[i]),Math.abs(R[i])); }
  return {x:Array.from(x), sr:b.sampleRate, peakCh:pc};
};
// Klang-Optionen: mit dem Pattern speichern und wieder laden (ältere Daten ohne smpOpt → Standard)
window.__audio.smpOptRoundTrip=function(o){
  Object.assign(smpOpt,o); const d=JSON.parse(JSON.stringify(collectPatternData('t','t')));
  Object.assign(smpOpt,{layers:true,rr:true,vari:50,room:0.22}); applyTrackAndFillData(d); const a=Object.assign({},smpOpt);
  delete d.smpOpt; Object.assign(smpOpt,o); applyTrackAndFillData(d); const b=Object.assign({},smpOpt);
  return {saved:a, old:b};
};
// Spielweisen (tr.notes der Drum-Spuren) mit dem Pattern speichern/laden; altes Pattern ohne Ride → Ride leer
window.__audio.artRoundTrip=function(){
  const ch=TRACKS.find(t=>t.id==='ch'), rd=TRACKS.find(t=>t.id==='rd');
  ch.steps.fill(0); ch.notes.fill(0); rd.steps.fill(0); rd.notes.fill(0);
  [0,1,2].forEach(i=>{ ch.steps[i]=VEL_NORMAL; ch.notes[i]=i; }); ch.steps[3]=VEL_NORMAL; rd.steps[0]=VEL_NORMAL; rd.notes[0]=1;
  const d=JSON.parse(JSON.stringify(collectPatternData('t','t')));
  ch.notes.fill(0); rd.notes.fill(0); applyTrackAndFillData(JSON.parse(JSON.stringify(d)));
  const r={ch:ch.notes.slice(0,4), rd:rd.notes.slice(0,4)};
  rd.steps.fill(VEL_NORMAL); d.tracks=d.tracks.filter(t=>t.id!=='rd'); applyTrackAndFillData(d);
  r.oldRide=rd.steps.filter(v=>v>0).length; return r;
};
// #12: Kit aus dem Speicher werfen (Export muss dann selbst aufs Laden warten)
window.__audio.smpDrop=function(){ smpFree([]); return Object.keys(smp); };
// #12: Song-Export (Arrangement) über den echten WAV-Export. clips={spur:[{start,steps:{s:stufe},notes:{s:spielweise}}]}, je Clip 1 Takt
window.__audio.exportSong=async function(kit,clips,bars,bpmv){
  currentKitId=kit; drumSet.voices={}; drumSet.buffers={}; bpm=bpmv||100; swing=0; humanize=0; PATTERN_LENGTH=16;
  const V=[0,VEL_GHOST_SOFT,VEL_GHOST,VEL_NORMAL,VEL_ACCENT];
  TRACKS.forEach(t=>{ t.solo=false; t.muted=(t.type==='arp'||t.isSample||!VOICE_FNS[t.id]); t.feel=0; t.reverbAmount=0; t.delaySend=0;
    if(t.sendGain) t.sendGain.gain.value=0; if(t.delaySendGain) t.delaySendGain.gain.value=0; });
  const keep={enabled:arr.enabled, bars:arr.bars, clips:arr.clips}, ke=editClip;
  arr.clips={}; arr.bars=bars; arr.enabled=true; editClip=null;
  for(const id in clips) arr.clips[id]=clips[id].map(c=>{ const st=new Array(16).fill(0), no=new Array(16).fill(0);
    for(const s in c.steps) st[+s]=V[c.steps[s]]; for(const s in (c.notes||{})) no[+s]=c.notes[s]; return {start:c.start, bars:1, steps:st, notes:no, slides:[]}; });
  let b; try{ b=await renderPatternToWav(); } finally { arr.enabled=keep.enabled; arr.bars=keep.bars; arr.clips=keep.clips; editClip=ke; }
  if(window.gc) gc();
  const L=b.getChannelData(0), R=b.getChannelData(1), x=new Float32Array(L.length);
  for(let i=0;i<x.length;i++) x[i]=L[i]+R[i];
  return {x:Array.from(x), sr:b.sampleRate};
};
// Sample-Kits: Größe/Text am Chip (#31)
window.__audio.smpChips=()=>Object.keys(KITS).filter(k=>KITS[k].samples).map(k=>({id:k,dir:KITS[k].samples.dir,kb:KITS[k].samples.kb,t:KITS[k]._chip.querySelector('.kd').textContent}));
window.__audio.smpTryLoad=kid=>{ smpFree([]); smpLoad(kid).catch(()=>{}); };
window.__audio.smpReset=()=>{ smpFree([]); smpChipIdle(); };
// Sample-Bibliothek (#6)
window.__lib={ save:e=>saveSampleLibraryEntry(e), list:()=>listSampleLibrary().then(a=>a.map(x=>x.id)) };

// Effekte (v79): Zugriff auf interne Zustände für tests/test-fx.py
window.__ev=s=>eval(s);
