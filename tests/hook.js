// Test-Hook: wird von tests/run.py in eine TEMP-KOPIE der index.html direkt nach "let activeTrackIdx=0;" eingesetzt
// (innerhalb der App-IIFE, hat also Zugriff auf deren Variablen). Nie in die echte index.html übernehmen.
window.__T=TRACKS; window.__sel=()=>activeTrackIdx; window.__pv=pianoVoice; window.__setCtx=c=>{audioCtx=c};
window.__audio={
  kits:()=>Object.keys(KITS),
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
