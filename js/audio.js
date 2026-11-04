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

// Ausgang (v95, #51): feste Notbremse hinter den Master-Effekten, live und im WAV-Export gleich. Der Kompressor ist ein sichtbarer Master-Effekt.
// Notbremse = WaveShaper statt DynamicsCompressor: keine Verzögerung (der Kompressor schaut 6 ms voraus) und garantierte Decke
// (ein DynamicsCompressor ließ bei harten Spitzen noch über 0 dB durch). Bis BRAKE_KNEE exakt unverändert (lineare Kurve), darüber weich
// (tanh) bis höchstens BRAKE_DB. Eingang wird ÷4 skaliert, damit auch Spitzen bis +12 dBFS auf der Kurve liegen.
const BRAKE_DB=-0.3, BRAKE_KNEE=-1.5;
let brakeCurve=null;
function makeOutStage(c){
  if(!brakeCurve){ const N=16385, T=Math.pow(10,BRAKE_KNEE/20), C=Math.pow(10,BRAKE_DB/20); brakeCurve=new Float32Array(N);
    for(let j=0;j<N;j++){ const x=(j/(N-1)*2-1)*4, a=Math.abs(x); brakeCurve[j]=Math.sign(x)*(a<=T?a:T+(C-T)*Math.tanh((a-T)/(C-T))); } }
  const g=c.createGain(), pre=c.createGain(), ws=c.createWaveShaper(); pre.gain.value=0.25; ws.curve=brakeCurve; ws.oversample='none';
  g.connect(pre); pre.connect(ws); ws.connect(c.destination);
  return {inp:g, tap:g}; // Master-Meter vor der Notbremse: CLIP zeigt, wann sie eingreift
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
