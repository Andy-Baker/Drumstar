// Test-Hook: wird von tests/run.py in eine TEMP-KOPIE der index.html direkt nach "let activeTrackIdx=0;" eingesetzt
// (innerhalb der App-IIFE, hat also Zugriff auf deren Variablen). Nie in die echte index.html übernehmen.
window.__T=TRACKS; window.__sel=()=>activeTrackIdx; window.__pv=pianoVoice; window.__setCtx=c=>{audioCtx=c};
window.__audio={
  kits:()=>Object.keys(KITS).filter(k=>!KITS[k].studio), // Studio Kit nutzt Samples, eigener Test unten
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

// Studio Kit: Samples laden und prüfen
window.__audio.studioLoad=async function(){
  await studioLoad(); let n=0, mo=0;
  STUDIO_VOICES.forEach(id=>studio.buf[id].forEach(l=>l.forEach(s=>{ n++; mo=Math.max(mo,s.off); })));
  return {state:studio.state, n, maxOff:mo};
};
// Ganzes Drum-Pattern über den echten WAV-Export (nur Drums/Perc, ohne Hall/Delay). pat={bd:{0:4,...}} mit Stufen 1..4
window.__audio.exportPattern=async function(kit,pat,bpmv){
  currentKitId=kit; drumSet.voices={}; drumSet.buffers={}; bpm=bpmv||100; swing=0; humanize=0; PATTERN_LENGTH=16;
  const V=[0,VEL_GHOST_SOFT,VEL_GHOST,VEL_NORMAL,VEL_ACCENT];
  TRACKS.forEach(t=>{ t.solo=false; t.muted=(t.type==='arp'||t.isSample||!VOICE_FNS[t.id]);
    if(!t.muted) t.steps=t.steps.map(()=>0); t.feel=0; t.reverbAmount=0; t.delaySend=0;
    if(t.sendGain) t.sendGain.gain.value=0; if(t.delaySendGain) t.delaySendGain.gain.value=0; });
  for(const id in pat){ const t=TRACKS.find(x=>x.id===id); for(const s in pat[id]) t.steps[+s]=V[pat[id][s]]; }
  const b=await renderPatternToWav(), L=b.getChannelData(0), R=b.getChannelData(1), x=new Float32Array(L.length);
  let pc=0; for(let i=0;i<x.length;i++){ x[i]=L[i]+R[i]; pc=Math.max(pc,Math.abs(L[i]),Math.abs(R[i])); }
  return {x:Array.from(x), sr:b.sampleRate, peakCh:pc};
};
