"use strict";
// =========================================================================
// METALLIC-ENGINE (6-Oszillator-Technik) — original dokumentierte Methode
// hinter dem TR-808-Hi-Hat/Crash-Klang: sechs Rechteckwellen auf unharmonische
// Frequenzverhältnisse gestimmt, gemeinsam durch Bandpass → Hochpass gefiltert.
// Kein FM/Feedback nötig — läuft komplett nativ, kein AudioWorklet erforderlich.
// mode: 'closed' | 'open' | 'cymbal' (Hi-Hat und Crash teilen sich dieselbe
// Oszillatorbank, nur Filter/Hüllkurve unterscheiden sich).
// =========================================================================
let lastOpenHatGain={}; // für Choke-Group: laufender Open-Hat-Gain-Node je Drum-Spur (chokeKey, #70)
function playMetallicSix(time, vol, tune, velocity, kp, mode){
  const g=velocity;
  const isAccentEnv = velocity>=1.1;
  let decay;
  if(mode==='closed') decay = isAccentEnv?kp.decayClosedAccent:kp.decayClosed;
  else if(mode==='open') decay = isAccentEnv?kp.decayOpenAccent:kp.decayOpen;
  else decay = kp.ampDecay; // 'cymbal'

  const fundamental=freqFromTune(kp.baseFreq, tune);
  const ratios=kp.ratios||[2,3,4.16,5.43,6.79,8.21]; // dokumentierte 808-Verhältnisse

  const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=kp.bpFreq||10000; bp.Q.value=kp.bpQ!=null?kp.bpQ:0.7;
  const hp=audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=kp.hpFreq||7000;
  const amp=audioCtx.createGain();
  bp.connect(hp); hp.connect(amp); amp.connect(getBus());

  ratios.forEach(r=>{
    const o=audioCtx.createOscillator(); o.type='square'; o.frequency.value=fundamental*r;
    o.connect(bp); o.start(time); o.stop(time+decay+0.08);
  });

  // Math.max(0.0001,…): exponentialRampToValueAtTime verbietet 0 als Ziel (wirft eine
  // Exception) — bei Vol=0 (Mixer-Fader ganz runter) wäre peak sonst exakt 0 und der Fehler
  // würde den Scheduler-Loop mitten im while() abbrechen, wodurch die GESAMTE Wiedergabe
  // stoppt, nicht nur diese eine Spur. 0.0001 ist praktisch lautlos (~-80dB).
  const peak=Math.max(0.0001, (kp.fmLevel!=null?kp.fmLevel:0.5)*vol*g);
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(peak, time+0.004);
  amp.gain.exponentialRampToValueAtTime(0.0006, time+decay);

  // optionale zusätzliche Rausch-"Wäsche" fürs Crash (mehr Fülle im Ausklang)
  if(kp.noiseLevel){
    const noise=audioCtx.createBufferSource(); noise.buffer=noiseBuf;
    const hp2=audioCtx.createBiquadFilter(); hp2.type='highpass'; hp2.frequency.value=(kp.hpFreq||7000)*0.6;
    const ng=audioCtx.createGain();
    ng.gain.setValueAtTime(kp.noiseLevel*vol*g,time); ng.gain.exponentialRampToValueAtTime(0.001,time+(kp.noiseDecay||decay));
    noise.connect(hp2).connect(ng).connect(getBus()); noise.start(time); noise.stop(time+(kp.noiseDecay||decay)+0.05);
  }

  // Choke Group: Closed-Hat kappt sofort einen noch klingenden Open-Hat —
  // physikalisch korrekt, weil es am echten Kit dieselbe Metallscheibe ist.
  if(mode==='open'){
    lastOpenHatGain[chokeKey]=amp;
  } else if(mode==='closed' && kp.choke && lastOpenHatGain[chokeKey]){
    try{
      const stillRinging=lastOpenHatGain[chokeKey];
      stillRinging.gain.cancelScheduledValues(time);
      stillRinging.gain.setValueAtTime(stillRinging.gain.value, time);
      stillRinging.gain.linearRampToValueAtTime(0.0001, time+0.025);
    }catch(e){}
    delete lastOpenHatGain[chokeKey];
  }
}

// Maracas: reiner gefilterter Rauschausbruch, kein tonaler Anteil (anders als
// Cowbell/Claves, die beide über einen Trägerton laufen) — Bandpass + Highpass
// auf hoher Frequenz für den charakteristischen "Shaker"-Klang.
function playMaracas(time,vol,tune,velocity,kp){
  const g=velocity;
  const noise=audioCtx.createBufferSource(); noise.buffer=noiseBuf;
  const hp=audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=kp.hpFreq||6000;
  const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=kp.bpFreq||9500; bp.Q.value=kp.bpQ!=null?kp.bpQ:1.0;
  const ng=audioCtx.createGain();
  ng.gain.setValueAtTime(kp.noiseLevel*vol*g,time); ng.gain.exponentialRampToValueAtTime(0.001,time+kp.noiseDecay);
  noise.connect(hp).connect(bp).connect(ng).connect(getBus());
  noise.start(time); noise.stop(time+kp.noiseDecay+0.02);
}

// =========================================================================
// MIC-SAMPLE — aufgenommener Sound als eigene Spur (kein FM-Preset)
// =========================================================================
let sampleBuffer=null; // AudioBuffer des zuletzt aufgenommenen Samples
let sampleStartOffset=0; // Trim-Startpunkt in Sekunden

// Stimmen-Verwaltung für Sample-Spur und Pads: pro "Slot" (Spur bzw. Pad) wird die zuletzt gestartete
// Stimme gemerkt. Ohne Überlagern schneidet ein neuer Treffer sie mit kurzem Fade ab (gegen Knackser);
// Halten/Schleife-Pads werden beim Loslassen mit Fade beendet.
const sampleTrackSlot={voice:null};
let sampleMode='oneshot', sampleOverlap=false, sampleLoopStart=null, sampleLoopEnd=null;
function cutVoice(v, when, fade){
  if(!v || v.dead) return; v.dead=true;
  try{
    v.g.gain.cancelScheduledValues(when);
    v.g.gain.setValueAtTime(v.vol, when);
    v.g.gain.linearRampToValueAtTime(0.0001, when+fade);
    v.src.stop(when+fade+0.005);
  }catch(e){}
}
function startSampleVoice(slot, cfg, when){
  if(!cfg.overlap && slot.voice) cutVoice(slot.voice, when, 0.008);
  const src=audioCtx.createBufferSource(); src.buffer=cfg.buffer; src.playbackRate.value=cfg.rate||1;
  const g=audioCtx.createGain(); g.gain.value=cfg.vol;
  src.connect(g); cfg.connect(g);
  const looping=cfg.mode==='loop';
  if(looping){ src.loop=true; src.loopStart=cfg.loopStart||0; src.loopEnd=cfg.loopEnd||0; }
  src.start(when, Math.min(cfg.offset||0, Math.max(0, cfg.buffer.duration-0.01)));
  const v={src, g, vol:cfg.vol, start:when, dead:false, looping};
  src.onended=()=>{ if(slot.voice===v) slot.voice=null; };
  slot.voice=v; return v;
}
function releaseVoice(slot){
  const v=slot.voice; if(!v || !audioCtx) return;
  cutVoice(v, Math.max(audioCtx.currentTime, v.start+0.02), 0.02);
  slot.voice=null;
}
function stopLoopingSampleTrack(){
  const v=sampleTrackSlot.voice;
  if(v && v.looping && audioCtx){ cutVoice(v, audioCtx.currentTime, 0.02); sampleTrackSlot.voice=null; }
}
function playSample(time,vol,tune,velocity){
  if(!sampleBuffer || !audioCtx) return;
  const bus=getBus();
  startSampleVoice(sampleTrackSlot, {buffer:sampleBuffer, offset:sampleStartOffset,
    mode: sampleMode==='loop' ? 'loop' : 'oneshot', overlap:sampleOverlap, loopStart:sampleLoopStart, loopEnd:sampleLoopEnd,
    rate:Math.pow(2,(tune-0.5)*2), vol:vol*velocity, connect:g=>g.connect(bus)}, time);
}

// =========================================================================
// ACID BASS — monophone 303-artige Synth-Stimme (Sägezahn → Resonanzfilter →
// Hüllkurve). Läuft nativ (kein Worklet nötig, da kein FM-Perkussions-Modell).
// Bewusst EINE dauerhafte Stimme pro Track statt neuer Nodes pro Trigger,
// damit Slide/Glide zwischen aufeinanderfolgenden Noten möglich ist —
// genau das Verhalten, das den klassischen TB-303-Sound ausmacht.
// =========================================================================
function noteFreq(semisFromRoot){ return 55*Math.pow(2, semisFromRoot/12); } // Basis: A1 = 55Hz
function ensureArpVoice(tr){
  if(tr._arpOsc) return;
  tr._arpOsc=audioCtx.createOscillator(); tr._arpOsc.type='sawtooth';
  tr._arpFilter=audioCtx.createBiquadFilter(); tr._arpFilter.type='lowpass';
  tr._arpAmp=audioCtx.createGain(); tr._arpAmp.gain.value=0;
  tr._arpOsc.connect(tr._arpFilter).connect(tr._arpAmp).connect(tr.bus);
  tr._arpOsc.start();
  tr._arpLastFreq=null;
}
// Gate-/Slide-Modell wie bei der TB-303:
// - Slide-Flag liegt am QUELLTON: slides[s] = Note s wird in Step s+1 hineingehalten, Step s+1 gleitet.
//   (triggerArpStep bekommt slide = "dieser Ton wird angeglitten", holdNext = "Gate bleibt bis zum Folgeton offen")
// - Amp: Gate-Hüllkurve statt Zupf-Abfall. Attack ~4 ms, danach nur ein langsamer Abfall (AMP_TAU),
//   nach der Gate-Länge (ARP_GATE * Step) kurzes Release. Gehaltene Noten folgen derselben Kurve weiter,
//   dadurch klingen normale und Slide-Noten gleich laut (kein Lautstärkesprung).
// - Slide: weder Amp- noch Filterhüllkurve werden neu angeschlagen, die Filterhüllkurve läuft weiter.
//   Glide = RC-Verlauf in der Tonhöhe (Cents über osc.detune), feste Zeit ARP_SLIDE_TC*3 ≈ 60 ms.
// - Slide ohne offenes Gate (Vorgänger leer, Start, Anspielen) = normaler Anschlag ohne Glide.
// - Sicherheits-Release nach 1,5 Steps: falls der Folgeton nie kommt (z. B. Slide live ausgeschaltet),
//   bleibt kein Dauerton stehen. Der nächste Trigger räumt diese Events per cancelScheduledValues ab.
//
// Filter: Boden = Cutoff-Basis*0.35, Spitze = Boden * 2^(EnvMod*3.03) (EnvMod 0.5 = alte feste Hüllkurve),
// Abfall exponentiell (RC) mit DECAY: 50 ms .. 2 s (Standard 0.26 ≈ 130 ms).
const ARP_SLIDE_TC=0.02;   // Glide-Zeitkonstante (s); ~60 ms bis 95 %
const ARP_GATE=0.6;        // Gate-Länge normaler Noten als Anteil eines Steps
const ARP_REL=0.015;       // Release nach Gate-Ende (s)
const AMP_TAU=0.5;         // sehr langsamer Abfall während des Gates (s)
const ARP_LEVEL=0.31;      // Pegelausgleich: Gate-Noten haben deutlich mehr Energie als die frühere Zupf-Hüllkurve
function arpDecaySeconds(v){ return 0.05*Math.pow(40, v); }
// Filter-Versatz (Cents auf filter.detune, additiv zur Hüllkurve auf .frequency):
//  - AUTO: LFO (Sinus/Dreieck/Drift) über autoBars Takte, synchron zur absoluten Step-Position (modPos),
//    pro Note von modPos bis modPos+1 interpoliert -> glatt, tempo- und song-slot-fest, auch im WAV-Export.
//  - Spielfläche: eigene Live-Stimme tr._live (Saw→Lowpass→Gain→tr.bus), unabhängig vom Sequencer; nicht im Export.
const AUTO_CENTS=2400;
let autoShape='off', autoBars=4, autoDepth=0.6;
let curAbsStep=0, absStepCounter=0, modVisAbs=0; // absolute Step-Position seit Play-Start (für Auto-Modulation)
function autoTri(x){ const f=((x%1)+1)%1; return f<.5 ? f*4-1 : 3-f*4; }
function autoLfo(absStep){
  if(autoShape==='off' || !autoDepth) return 0;
  const per=autoBars*16, t=(((absStep%per)+per)%per)/per;
  if(autoShape==='sine') return Math.sin(2*Math.PI*t);
  if(autoShape==='tri') return autoTri(t+.25);
  const w=(a,b)=>Math.sin(2*Math.PI*(t*a+b));
  return Math.max(-1, Math.min(1, .55*w(1,.2)+.3*w(2,1.1)+.2*w(5,2.7)));
}
// Skalen (Halbtöne relativ zum Grundton rootNote) — gelten für die ganze Acid-Spur: Spielfläche, Piano Roll, Random
const SCALES={
  minor:{label:'Moll', semis:[0,2,3,5,7,8,10]},
  major:{label:'Dur', semis:[0,2,4,5,7,9,11]},
  dorian:{label:'Dorisch', semis:[0,2,3,5,7,9,10]},
  phrygian:{label:'Phrygisch', semis:[0,1,3,5,7,8,10]},
  pentaMinor:{label:'Pentatonik Moll', semis:[0,3,5,7,10]},
  blues:{label:'Blues', semis:[0,3,5,6,7,10]}
};
