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
