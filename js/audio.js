"use strict";
// =========================================================================
// AUDIO ENGINE — AudioWorklet-basierter Multi-Operator-FM-Synth
// =========================================================================
let audioCtx=null, master=null, comp=null, noiseBuf=null, workletReady=null, useWorklet=false;
let masterAnalyser=null; // fürs Mixer-Meter der Master-Sektion
let reverbInputNode=null, reverbConvolver=null;
let delayInputNode=null, delayNode=null, delayFeedbackGain=null, delayOutputGain=null;
let padDelaySendGain=null, padDelayAmount=0; // gemeinsamer Delay-Send-Regler für alle Live-Pads
let currentTrackBus=null;

// Ausgang (v94, #51): „klassisch“ = bisheriger DynamicsCompressor mit Standardwerten (−24 dB, 12:1, komprimiert fast immer),
// „sauber“ = nur Schutz-Limiter knapp unter 0 dB, der normalerweise nichts tut. Wahl per ?ausgang=sauber|klassisch, gemerkt.
const OUT_MODE=(()=>{ try{ const q=new URLSearchParams(location.search).get('ausgang');
  if(q==='sauber'||q==='klassisch') localStorage.setItem('ds_ausgang',q);
  return localStorage.getItem('ds_ausgang')==='sauber'?'sauber':'klassisch'; }catch(e){ return 'klassisch'; } })();
// Baut die Ausgangsstufe in Kontext c (live und WAV-Export gleich). inp = Eingang (wird zu `comp`), tap = Abgriff fürs Master-Meter.
function makeOutStage(c){
  if(OUT_MODE!=='sauber'){ const k=c.createDynamicsCompressor(); k.connect(c.destination); return {inp:k, tap:k}; }
  const g=c.createGain(), l=c.createDynamicsCompressor();
  l.threshold.value=-1; l.knee.value=0; l.ratio.value=20; l.attack.value=0.001; l.release.value=0.06;
  // DynamicsCompressor hebt automatisch an (~+0,6 dB bei −1 dB/20:1) -> danach wieder absenken: unter der Schwelle neutral, Decke < 0 dBFS
  const trim=c.createGain(); trim.gain.value=Math.pow(10,-0.8/20);
  g.connect(l); l.connect(trim); trim.connect(c.destination);
  return {inp:g, tap:g}; // Meter vor dem Limiter: CLIP-LED zeigt, wann er eingreifen müsste
}

// Erzeugt eine synthetische Hall-Impulsantwort: Rauschen mit exponentiellem
// Decay pro Kanal, kein externes Audio-File nötig.
function createImpulseResponse(duration, decay){
  const rate=audioCtx.sampleRate;
  const length=Math.floor(rate*duration);
  const impulse=audioCtx.createBuffer(2, length, rate);
  for(let c=0;c<2;c++){
    const data=impulse.getChannelData(c);
    for(let i=0;i<length;i++){
      data[i]=(Math.random()*2-1)*Math.pow(1-i/length, decay);
    }
  }
  return impulse;
}
