"use strict";
// =========================================================================
// ARRANGEMENT (Beta, Schritt a) — Clips pro Spur statt eines gemeinsamen Patterns.
// arr.clips[trackId] = [{start, bars, steps[], notes[], slides[]}] (start/bars in Takten à 16 Steps; Clip = KOPIE der Spurdaten).
// Aus (Standard): Verhalten exakt wie bisher. An: Sequenzlänge = arr.bars*16, jede Spur liest ihre Clips.
// stepInfo() ist die EINZIGE Stelle, die Step-Daten für Wiedergabe UND Export liefert (inkl. Nachbarn für Slide).
// =========================================================================
const arr={enabled:false, bars:8, clips:{}};
let editClip=null; // Clip im Editor: dann spielen/exportieren Wiedergabe und Export das Arbeits-Pattern (Vorschau)
function arrOn(){ return arr.enabled && !editClip; }
// =========================================================================
// MELODIE-INSTRUMENTE (#24) — alles, was Acid, Cosmic und Keys unterscheidet, steht NUR hier.
// trInst(tr) = Eintrag der Spur (null bei Drums/Perc/Sample). Schlüssel = Instrument; heute gleich der Spur-ID,
// mit #13 (mehrere Spuren gleichen Typs) setzt die Spur tr.inst und behält eine eigene ID.
//   name     Anzeige (Noteneditor, Klang-Sheet, Übersicht)   grp   Übersichts-Gruppe
//   poly     Akkorde, keine Slides                          oct   Oktavlage der Namen/Töne (Halbtöne)
//   trigger  Wiedergabe einer Note (time,tr,semis,vel,lenSteps,modPos,chordN); fehlt = Acid-Stimme in triggerArpStep
//   live     Live-Spiel im Noteneditor (tr,n,vel,legato) → Handle mit rel() bzw. null (einstimmig, prAcidOff)
//   fields   eigene Klang-Felder mit Standard (werden gespeichert/geladen)   undo  Felder im Schritt-Rückgängig
//   sounds   Auswahl an Klängen (Kit-Taste, Klang-Sheet), Wert in tr.sound   knobs Zusatzregler [Label, Feld]
//   xy/accent  XY-Pad bzw. Accent-Regler im Klang-Sheet      arpStyle/bass  Harmonie-Standard
// Funktionen in Pfeilen, weil sie in späteren Dateien stehen (Aufruf erst zur Laufzeit).
// =========================================================================
const INSTR={
  arp:   {name:'ACID',   grp:'acid',   poly:false, oct:0,  cls:'',    xy:true, accent:true, arpStyle:'classic', bass:'roll',
          live:(tr,n,v,lg)=>{ prAcidOn(tr,n,v,lg); return null; }, fields:{}, undo:[]},
  cosmic:{name:'COSMIC', grp:'cosmic', poly:true,  oct:24, cls:'cos', arpStyle:'cosmic', bass:'hold',
          trigger:(t,tr,n,v,l,m,c)=>triggerCosmicArpStep(t,tr,n,v,m,l,c), live:(tr,n,v)=>prCosmicOn(tr,n,v),
          fields:{cosmicWidth:0.62, cosmicMotion:0.46, cosmicWarmth:0.22, cosmicAir:0.18}, undo:['cosmicWidth','cosmicMotion','cosmicWarmth','cosmicAir'],
          knobs:[['Width','cosmicWidth'],['Motion','cosmicMotion'],['Warmth','cosmicWarmth'],['Air','cosmicAir']]},
  piano: {name:'KEYS',   grp:'piano',  poly:true,  oct:12, cls:'pno', arpStyle:'classic', bass:'hold',
          trigger:(t,tr,n,v,l)=>triggerPianoStep(t,tr,n,v,l), live:(tr,n,v)=>prPianoOn(tr,n,v),
          fields:{sound:'piano', tremolo:0}, undo:[], sounds:()=>KEY_SOUNDS},
};
function trInst(tr){ return (tr && INSTR[tr.inst||tr.id]) || null; }
// Eigene Felder des Instruments: speichern (nur gesetzte), laden (fehlend/ungültig → Standard)
function instSave(tr){ const I=trInst(tr), o={}; if(I) for(const k in I.fields) if(tr[k]!==undefined) o[k]=tr[k]; return o; }
function instLoad(tr,sv){ const I=trInst(tr); if(!I) return;
  for(const k in I.fields){ let v=sv?sv[k]:null; if(k==='sound' && I.sounds && !I.sounds()[v]) v=null; tr[k]=v!=null?v:I.fields[k]; } }
// Gewählter Klang eines Instruments mit Klang-Auswahl (Keys); Ersatz = Standardklang
function instSound(tr){ const I=trInst(tr), S=I&&I.sounds&&I.sounds(); return S ? (S[tr.sound]||S[I.fields.sound]) : null; }
// Übersichts-Gruppen: jede Gruppe ist eine Zeile in der Song-Übersicht; Clips liegen weiterhin pro Stimme/Spur.
// Melodiespuren sind frei (#13): ARR_GROUPS wird aus TRACKS neu gebaut (arrGroupsBuild), ARR_GROUPS_BASE = Werksaufbau
// (z. B. zum Aufteilen alter Gesamt-Beats). Gruppen-ID einer Melodiespur: Original-Spur (id = Instrument) → INSTR.grp
// (acid/cosmic/piano, wie Beat-Reiter und alte Stände), weitere Spuren → ihre Spur-ID.
const ARR_GROUPS_BASE=[
  ...DRUM_TRACKS.map(d=>({id:d.id, label:d.name, ids:d.rows})),
  ...Object.keys(INSTR).map(k=>({id:INSTR[k].grp, label:INSTR[k].name, ids:[k]})),
  {id:'sample',label:'SAMPLE',ids:['mc']}
];
const ARR_GROUPS=ARR_GROUPS_BASE.map(g=>Object.assign({},g));
const MEL_MAX=7; // Melodiespuren gesamt (3 ab Werk + 4 zusätzliche; Handy-Last)
function trInstKey(tr){ return tr.inst||tr.id; }
function trGrpId(tr){ return tr.id===trInstKey(tr) ? INSTR[tr.id].grp : tr.id; }
function trTitle(tr){ const I=trInst(tr); return tr.label || (I ? I.name : tr.name); } // Anzeigename (Spur-Menü, Song, Noteneditor)
function instByGrp(g){ return Object.keys(INSTR).find(k=>INSTR[k].grp===g)||null; } // Beat-Reiter → Instrument
function arrGroupsBuild(){
  const mel=TRACKS.filter(t=>trInst(t)).map(t=>({id:trGrpId(t), label:trTitle(t), ids:[t.id]}));
  const base=ARR_GROUPS_BASE.filter(g=>!instByGrp(g.id));
  ARR_GROUPS.length=0; ARR_GROUPS.push(...base.filter(g=>g.id!=='sample'), ...mel, ...base.filter(g=>g.id==='sample'));
}
// Spur einer Gruppe, deren Instrument eine Klang-Auswahl hat (Kit-Taste zeigt dann die Klänge), sonst null
function grpSoundTr(gid){ const g=ARR_GROUPS.find(x=>x.id===gid), tr=g && TRACKS.find(t=>g.ids.indexOf(t.id)>=0), I=trInst(tr); return I && I.sounds ? tr : null; }
// Polyphone Melodiespuren (Akkorde, keine Slides). trOct = Oktavlage der Namen/Töne
function isPoly(tr){ const I=trInst(tr); return !!(I && I.poly); }
function trOct(tr){ const I=trInst(tr); return I ? I.oct : 0; }
function seqLength(){ return arrOn() ? arr.bars*16 : PATTERN_LENGTH; }
// =========================================================================
// NOTEN-EVENTS (v51) — melodische Spuren (Acid, Cosmic): tr.events = [{s, n, l, v, a, sl}]
//   s = Start-Step, n = Halbtöne rel. zu tr.rootNote, l = Länge in Steps (>=1), v = Velocity 0.05..1, a = Accent, sl = Slide zum Ton bei s+l.
// Mehrere Events im selben Step = Akkord (nur Cosmic). tr.steps bleibt als abgeleiteter Cache (Velocity-Stufe je Start-Step) für Übersicht/Flash.
// Drums/Perc/Sample bleiben bei tr.steps (+ unbenutzte notes/slides).
// =========================================================================
function evStepVal(e){ return e.a?VEL_ACCENT:(e.v<=.2?VEL_GHOST_SOFT:(e.v<=.5?VEL_GHOST:VEL_NORMAL)); }
function evFromStepVal(sv){ return sv>=VEL_ACCENT?{v:.85,a:true}:sv>=VEL_NORMAL?{v:.85,a:false}:sv>=VEL_GHOST?{v:.35,a:false}:{v:.15,a:false}; }
function evStepsOf(events,N){ const a=new Array(N).fill(VEL_OFF); events.forEach(e=>{ if(e.s>=0&&e.s<N){ const v=evStepVal(e); if(v>a[e.s]) a[e.s]=v; } }); return a; }
function evTouch(tr){ tr.events.sort((x,y)=>x.s-y.s||x.n-y.n); tr.steps=evStepsOf(tr.events,PATTERN_LENGTH); tr._idx=null; }
function evIndex(events){ const m=new Map(); events.forEach(e=>{ let l=m.get(e.s); if(!l){ l=[]; m.set(e.s,l); } l.push(e); }); return m; }
function evClip(events,start,bars,n){
  const evs=events.filter(e=>e.s<n).map(e=>Object.assign({},e,{l:Math.max(1,Math.min(e.l,n-e.s))}));
  return {start,bars,events:evs,steps:evStepsOf(evs,n)};
}
// Wiedergabe-Kontext eines absoluten Steps: Liste + relative Position (Arbeits-Pattern oder Clip im Arrangement)
function evCtx(tr,s){
  const L=seqLength(); s=((s%L)+L)%L;
  if(!arrOn()) return {list:tr.events, rel:s};
  const bar=Math.floor(s/16), list=arr.clips[tr.id]||[];
  for(let k=0;k<list.length;k++){ const c=list[k]; if(bar>=c.start && bar<c.start+c.bars) return {list:c.events||[], rel:s-c.start*16}; }
  return {list:[], rel:0};
}
function evStarts(tr,s){
  const c=evCtx(tr,s);
  if(!arrOn()){ if(!tr._idx) tr._idx=evIndex(tr.events); return tr._idx.get(c.rel)||[]; }
  return c.list.filter(e=>e.s===c.rel);
}
function evSlideIn(tr,s){ const c=evCtx(tr,s-1); return c.list.some(e=>e.sl && e.s+e.l-1===c.rel); }
// Spielt alle Noten, die in diesem Step beginnen (Acid mono: nur die erste, Cosmic: Akkord)
function evPlay(tr,step,hitTime,hum,modPos){
  const starts=evStarts(tr,step); if(!starts.length) return;
  const mono=!isPoly(tr), list=mono?[starts[0]]:starts, chord=list.length;
  list.forEach(e=>{
    const vel=Math.max(0.05,Math.min(1.5,e.v*(e.a&&!mono?1.53:1)*hum));
    const nx=mono && e.sl && evStarts(tr,step+e.l).length>0;
    triggerArpStep(hitTime,tr,e.n,vel,mono && evSlideIn(tr,step),nx,modPos,!!e.a,e.l,chord);
  });
}
function evLoad(sv,tr){
  const N=PATTERN_LENGTH, out=[];
  if(Array.isArray(sv.events)){
    sv.events.forEach(e=>{
      if(!e || !Number.isFinite(e.s) || !Number.isFinite(e.n)) return;
      const s=Math.round(e.s); if(s<0 || s>=N) return;
      out.push({s, n:Math.round(e.n), l:Math.max(1,Math.min(N-s,Math.round(e.l)||1)), v:Math.max(.05,Math.min(1,+e.v||.85)), a:!!e.a, sl:!!e.sl && !isPoly(tr)});
    });
  } else { // Altformat (steps/notes/slides je Step): Länge 1
    const nt=sv.notes||[], sl=sv.slides||[];
    for(let s=0;s<N;s++){ const sv2=tr.steps[s]; if(!(sv2>0)) continue; const f=evFromStepVal(sv2); out.push({s, n:nt[s]|0, l:1, v:f.v, a:f.a, sl:!!sl[s] && !isPoly(tr)}); }
  }
  return out;
}
// Übergang: Generatoren arbeiten in einem Block mit Step-Arrays; danach werden daraus Events.
function legacyEdit(tr,fn,keepLen){
  const N=PATTERN_LENGTH, orig=new Map();
  const steps=new Array(N).fill(VEL_OFF), notes=new Array(N).fill(0), slides=new Array(N).fill(false);
  tr.events.forEach(e=>{ if(e.s<N && !orig.has(e.s)){ orig.set(e.s,e); steps[e.s]=evStepVal(e); notes[e.s]=e.n; slides[e.s]=!!e.sl; } });
  tr.steps=steps; tr.notes=notes; tr.slides=slides; tr._scratch=true;
  try{ fn(); }
  finally{
    tr._scratch=false;
    const ev=[];
    for(let s=0;s<N;s++){
      const sv=tr.steps[s]; if(!(sv>0)) continue;
      const o=orig.get(s), n=tr.notes[s]|0, sl=!!tr.slides[s] && !isPoly(tr);
      if(o && evStepVal(o)===sv) ev.push({s, n, l:keepLen?o.l:1, v:o.v, a:!!o.a, sl});
      else { const f=evFromStepVal(sv); ev.push({s, n, l:keepLen&&o?o.l:1, v:f.v, a:f.a, sl}); }
    }
    tr.events=ev; delete tr.notes; delete tr.slides; evTouch(tr);
  }
}
function generateAcidBassline(tr,from,to){ legacyEdit(tr,()=>generateAcidBasslineCore(tr,from===undefined?0:from,to===undefined?PATTERN_LENGTH:to),false); }
function stepInfo(tr, s){
  const L=seqLength(); s=((s%L)+L)%L;
  if(!arrOn()) return {v:tr.steps[s], note:tr.notes[s]||0, slide:!!tr.slides[s]};
  const bar=Math.floor(s/16), list=arr.clips[tr.id]||[];
  for(let k=0;k<list.length;k++){
    const c=list[k];
    if(bar>=c.start && bar<c.start+c.bars){ const i=s-c.start*16; return {v:c.steps[i]||0, note:(c.notes&&c.notes[i])||0, slide:!!(c.slides&&c.slides[i])}; }
  }
  return {v:0, note:0, slide:false};
}
function arrGroupTracks(gid){ const g=ARR_GROUPS.find(x=>x.id===gid); return g ? TRACKS.filter(t=>g.ids.indexOf(t.id)>=0) : []; }
function arrClipAt(gid, bar){ const first=arrGroupTracks(gid)[0]; return first ? (arr.clips[first.id]||[]).find(c=>bar>=c.start && bar<c.start+c.bars) : null; }
function clipV(trId, s){ const list=arr.clips[trId]||[], bar=Math.floor(s/16); for(let k=0;k<list.length;k++){ const c=list[k]; if(bar>=c.start && bar<c.start+c.bars) return c.steps[s-c.start*16]||0; } return 0; }
// Stempeln: kopiert das aktuelle Arbeits-Pattern der Gruppe ab Takt b (überschreibt überlappende Clips der Gruppe)
function arrStamp(gid, b, barsOverride){
  const patBars=barsOverride||Math.max(1, PATTERN_LENGTH/16), bars=Math.min(patBars, arr.bars-b), n=bars*16;
  if(bars<=0) return;
  arrGroupTracks(gid).forEach(tr=>{
    const list=(arr.clips[tr.id]||[]).filter(c=>!(c.start<b+bars && c.start+c.bars>b));
    list.push(tr.type==='arp' ? evClip(tr.events,b,bars,n) : {start:b, bars, steps:tr.steps.slice(0,n), notes:tr.notes?tr.notes.slice(0,n):[], slides:tr.slides?tr.slides.slice(0,n):[]});
    list.sort((x,y)=>x.start-y.start); arr.clips[tr.id]=list;
  });
}
function arrRemove(gid, b){ arrGroupTracks(gid).forEach(tr=>{ arr.clips[tr.id]=(arr.clips[tr.id]||[]).filter(c=>!(b>=c.start && b<c.start+c.bars)); }); }
function arrFillAll(){ const patBars=Math.max(1, PATTERN_LENGTH/16); ARR_GROUPS.forEach(g=>{ for(let b=0;b<arr.bars;b+=patBars) arrStamp(g.id,b); }); }
function arrHasClips(){ return Object.keys(arr.clips).some(k=>arr.clips[k].length>0); }
function arrResize(nb){
  Object.keys(arr.clips).forEach(k=>{
    arr.clips[k]=arr.clips[k].filter(c=>c.start<nb).map(c=>{ const bars=Math.min(c.bars, nb-c.start), n=bars*16; return c.events ? evClip(c.events,c.start,bars,n) : {start:c.start, bars, steps:c.steps.slice(0,n), notes:(c.notes||[]).slice(0,n), slides:(c.slides||[]).slice(0,n)}; });
  });
  arr.bars=nb;
}
// COSMIC ARP — polyphoner, schimmernder 90s-Trance-Arpeggiator:
// detunierte Sägezähne, weicher Filter-Pick und lange, über den Spur-Bus
// geroutete Hall-/Delay-Sends. Eigenständige Stimmen pro Step, daher keine
// Monophonie/Slides der Acid-Bass-Stimme.
function triggerCosmicArpStep(time, tr, degreeSemis, velocity, modPos, lenSteps, chordN){
  if(!audioCtx || !tr.bus) return;
  const freq=noteFreq(tr.rootNote + degreeSemis + 24); // Cosmic lead: zwei Oktaven über der Bass-Arp-Lage
  const dur=Math.max(0.075, stepDuration()*(Math.max(1,lenSteps||1)-0.12));
  const decay=arpDecaySeconds(tr.decay!=null?tr.decay:0.42);
  const cutoff=700 + (tr.cutoff!=null?tr.cutoff:0.62)*7600;
  const envMod=tr.envMod!=null?tr.envMod:0.62;
  const width=Math.max(0,Math.min(1,tr.cosmicWidth!=null?tr.cosmicWidth:0.62));
  const motion=Math.max(0,Math.min(1,tr.cosmicMotion!=null?tr.cosmicMotion:0.46));
  const warmth=Math.max(0,Math.min(1,tr.cosmicWarmth!=null?tr.cosmicWarmth:0.22));
  const air=Math.max(0,Math.min(1,tr.cosmicAir!=null?tr.cosmicAir:0.18));
  const peak=Math.max(0.0001,Math.min(0.22,velocity*tr.vol*0.16));
  const filter=audioCtx.createBiquadFilter(); filter.type='lowpass';
  filter.Q.value=0.65 + (tr.resonance!=null?tr.resonance:0.22)*3.6;
  // LFO-artige Filterbewegung ist an die Step-Dauer gekoppelt und bleibt auch
  // bei unterschiedlichen Tempi musikalisch. Jede Note erhält eine weiche Rampe.
  // Phase an der Step-Position (modPos) statt an der Uhrzeit -> Live und WAV-Export klingen gleich
  const lfoPhase=(modPos!=null ? (modPos/8) : (time/Math.max(0.08,stepDuration()*8)))*Math.PI*2;
  const motionMul=1 + Math.sin(lfoPhase)*motion*0.32;
  const openCutoff=Math.min(15000,cutoff*(1.15+envMod*2.25)*motionMul);
  const floorCutoff=Math.max(280,cutoff*(0.42+motion*0.08));
  filter.frequency.setValueAtTime(Math.max(180,openCutoff),time);
  filter.frequency.exponentialRampToValueAtTime(floorCutoff,time+Math.max(0.09,decay));
  const amp=audioCtx.createGain();
  amp.gain.setValueAtTime(0.0001,time);
  amp.gain.linearRampToValueAtTime(peak,time+0.012);
  amp.gain.setTargetAtTime(peak*0.76,time+0.013,Math.max(0.07,decay*0.75));
  const end=time+Math.max(dur,Math.min(decay*1.65,dur*2.1))+0.16;
  amp.gain.setTargetAtTime(0.0001,end,0.11);

  // Unison-Saw: gegeneinander verstimmt und im Stereobild verteilt.
  // Triangle-Sub gibt Wärme/Körper; ein sehr leiser Sinus-Oberton bringt Luft.
  const left=audioCtx.createOscillator(), right=audioCtx.createOscillator();
  left.type='sawtooth'; right.type='sawtooth';
  left.frequency.setValueAtTime(freq,time); right.frequency.setValueAtTime(freq,time);
  const detune=3+width*15;
  left.detune.setValueAtTime(-detune,time); right.detune.setValueAtTime(detune,time);
  const lp=audioCtx.createStereoPanner(), rp=audioCtx.createStereoPanner();
  lp.pan.value=-(0.15+width*0.62); rp.pan.value=(0.15+width*0.62);
  left.connect(lp).connect(filter); right.connect(rp).connect(filter);

  const sub=audioCtx.createOscillator(), subGain=audioCtx.createGain();
  sub.type='triangle'; sub.frequency.setValueAtTime(freq/2,time);
  subGain.gain.setValueAtTime(0.015+warmth*0.095,time);
  sub.connect(subGain).connect(filter);

  const shimmer=audioCtx.createOscillator(), shimmerGain=audioCtx.createGain();
  shimmer.type='sine'; shimmer.frequency.setValueAtTime(Math.min(12000,freq*2),time);
  shimmerGain.gain.setValueAtTime((chordN||1)>1?0.0001:0.002+air*0.025,time); // Akkord: kein Shimmer-Layer (Last)
  shimmer.connect(shimmerGain).connect(amp);
  filter.connect(amp).connect(tr.bus);
  left.start(time); right.start(time); sub.start(time); shimmer.start(time);
  const oscs=[left,right,sub,shimmer];
  const isLive=!(typeof OfflineAudioContext!=='undefined' && audioCtx instanceof OfflineAudioContext);
  let voice=null;
  if(isLive){ voice={amp,oscs,t0:time}; (tr._cosVoices=tr._cosVoices||[]).push(voice);
    while(tr._cosVoices.length>8){ const old=tr._cosVoices.shift(); try{ old.amp.gain.cancelScheduledValues(time); old.amp.gain.setTargetAtTime(0.0001,time,0.03); old.oscs.forEach(x=>{ try{x.stop(time+0.15);}catch(e){} }); }catch(e){} } }
  oscs.forEach(o=>{ o.stop(end+0.4); o.onended=()=>{ try{o.disconnect();}catch(e){}
    if(voice && o===oscs[0] && tr._cosVoices){ const i=tr._cosVoices.indexOf(voice); if(i>=0) tr._cosVoices.splice(i,1); } }; });
  [lp,rp,filter,subGain,shimmerGain,amp].forEach(n=>{ /* Nodes are released with their oscillator graph. */ });
}
// ---- PIANO: additive Teiltöne, nach oben schneller abklingend, Härte = Anschlag-Helligkeit ----
// Obere Piano-Teiltöne 3..K (Amplitude 1/k^1.2) als eine Wellenform, je Kontext und K zwischengespeichert
function pianoWave(K){
  const c=audioCtx._pwv||(audioCtx._pwv={}); if(c[K]) return c[K];
  const re=new Float32Array(K+1), im=new Float32Array(K+1);
  for(let k=3;k<=K;k++) im[k]=1/Math.pow(k,1.2);
  return c[K]=audioCtx.createPeriodicWave(re,im,{disableNormalization:true});
}
// Keys-Sounds (pro Spur: tr.sound). def = Reglerwerte beim Umschalten
const KEY_SOUNDS={
  piano:{name:'PIANO', desc:'Hammer · Saiten · warm', def:{cutoff:0.55, envMod:0.5, decay:0.5, tremolo:0}},
  rhodes:{name:'RHODES', desc:'E-Piano · Glocke · Tremolo', def:{cutoff:0.5, envMod:0.45, decay:0.55, tremolo:0.35}}
};
// Wert der Rhodes-Hüllkurve dt Sekunden nach dem Anschlag (für den Release: amp.gain.value taugt bei vorausgeplanten Noten nicht)
function rhodesEnvAt(dt,peak,T){
  if(dt<0.003) return Math.max(0.0001,peak*dt/0.003);
  let v=peak; const t1=Math.min(dt,0.4); if(t1>0.01) v=peak*0.5+(peak-peak*0.5)*Math.exp(-(t1-0.01)/(T*0.22));
  if(dt>0.4) v=0.0001+(v-0.0001)*Math.exp(-(dt-0.4)/(T*0.55));
  return Math.max(0.0001,v);
}
function rhodesVoice(tr,time,n,vel,holdSec){
  const freq=noteFreq(tr.rootNote+n+12);
  const tone=tr.cutoff!=null?tr.cutoff:0.5, bite=tr.envMod!=null?tr.envMod:0.45, trem=tr.tremolo!=null?tr.tremolo:0.35;
  const v=Math.max(0.05,Math.min(1.2,vel));
  const T=0.6+arpDecaySeconds(tr.decay!=null?tr.decay:0.55)*1.6;
  const peak=Math.max(0.0001,Math.min(0.22,v*tr.vol*0.12));
  const lp=audioCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.setValueAtTime(Math.min(15000,(1500+tone*6500)*(0.6+v*0.5)),time); lp.Q.value=0.5;
  const tm=audioCtx.createGain(); tm.gain.value=1-trem*0.18;
  const lfo=audioCtx.createOscillator(), lg=audioCtx.createGain(); lfo.frequency.value=5.2; lg.gain.value=trem*0.35; lfo.connect(lg).connect(tm.gain);
  const amp=audioCtx.createGain(); amp.gain.setValueAtTime(0.0001,time); amp.gain.linearRampToValueAtTime(peak,time+0.003);
  amp.gain.setTargetAtTime(peak*0.5,time+0.01,T*0.22); amp.gain.setTargetAtTime(0.0001,time+0.4,T*0.55);
  const pan=audioCtx.createStereoPanner(); pan.pan.value=Math.max(-0.4,Math.min(0.4,(n-20)/50));
  const car=audioCtx.createOscillator(), mod=audioCtx.createOscillator(), mg=audioCtx.createGain();
  car.frequency.setValueAtTime(freq,time); mod.frequency.setValueAtTime(freq,time);
  mg.gain.setValueAtTime(freq*(0.5+bite*4.5)*(0.5+v*0.5),time); mg.gain.setTargetAtTime(freq*0.22,time,0.25); mod.connect(mg).connect(car.frequency);
  const bell=audioCtx.createOscillator(), bg=audioCtx.createGain(); bell.frequency.setValueAtTime(Math.min(12000,freq*7.1),time);
  bg.gain.setValueAtTime(0.03+bite*0.09*v,time); bg.gain.setTargetAtTime(0.0001,time,0.05);
  car.connect(tm); tm.connect(lp); bell.connect(bg).connect(lp); lp.connect(amp).connect(pan).connect(tr.bus);
  const oscs=[car,mod,bell,lfo]; oscs.forEach(o=>o.start(time));
  const voice={amp,oscs,t0:time,
    rel(at){ const now=Math.max(time,at!=null?at:audioCtx.currentTime); try{ amp.gain.cancelScheduledValues(now); amp.gain.setValueAtTime(rhodesEnvAt(now-time,peak,T),now); amp.gain.setTargetAtTime(0.0001,now,0.12); oscs.forEach(o=>{ try{o.stop(now+0.8);}catch(e){} }); }catch(e){} }};
  car.onended=()=>{ try{ amp.disconnect(); }catch(e){} if(tr._cosVoices){ const i=tr._cosVoices.indexOf(voice); if(i>=0) tr._cosVoices.splice(i,1); } };
  const isLive=!(typeof OfflineAudioContext!=='undefined' && audioCtx instanceof OfflineAudioContext);
  if(isLive){ (tr._cosVoices=tr._cosVoices||[]).push(voice);
    while(tr._cosVoices.length>10){ const old=tr._cosVoices.shift(); try{ old.amp.gain.cancelScheduledValues(time); old.amp.gain.setTargetAtTime(0.0001,time,0.03); old.oscs.forEach(x=>{ try{x.stop(time+0.15);}catch(e){} }); }catch(e){} } }
  if(holdSec!=null) voice.rel(time+holdSec); else oscs.forEach(o=>{ try{o.stop(time+T*5);}catch(e){} });
  return voice;
}
function pianoVoice(tr,time,n,vel,holdSec){
  if(tr.sound==='rhodes') return rhodesVoice(tr,time,n,vel,holdSec);
  const freq=noteFreq(tr.rootNote+n+12);
  const hard=tr.envMod!=null?tr.envMod:0.5, tone=tr.cutoff!=null?tr.cutoff:0.55;
  const v=Math.max(0.05,Math.min(1.2,vel));
  // Tiefe Töne klingen länger, hohe kürzer (Saitenlänge/Dämpfung)
  const T=arpDecaySeconds(tr.decay!=null?tr.decay:0.5)*Math.max(0.4,Math.min(1.8,Math.pow(220/freq,0.45)))*2.4;
  const peak=Math.max(0.0001,Math.min(0.2,v*tr.vol*0.11));
  const lp=audioCtx.createBiquadFilter(); lp.type='lowpass'; lp.Q.value=0.4;
  // Helligkeit: Hammer trifft hell, Ton wird in ~0.5 s weicher (mehr Anschlag = länger hell)
  const open=Math.min(16000,(900+tone*8000)*(0.45+v*(0.5+hard*1.1))+freq*3), floor=Math.max(freq*1.5,Math.min(open,500+tone*1800));
  lp.frequency.setValueAtTime(open,time); lp.frequency.setTargetAtTime(floor,time+0.02,0.35+T*0.08);
  const amp=audioCtx.createGain(); amp.gain.setValueAtTime(0.0001,time); amp.gain.linearRampToValueAtTime(peak,time+0.003);
  const pan=audioCtx.createStereoPanner(); pan.pan.value=Math.max(-0.45,Math.min(0.45,(n-20)/45)); // tiefe Töne links, hohe rechts
  // Teiltöne (v90, #48): Grundton und 2. Teilton einzeln, alle höheren zusammen in EINEM Oszillator (PeriodicWave).
  // Vorher je Teilton ein Oszillator + Gain (bis 11 Paare pro Note, Akkord >100 Knoten) -> am Handy Aussetzer beim Anschlag.
  const oscs=[], K=Math.max(3,Math.min(8,Math.floor(7500/freq)));
  const part=(f,a,tau1,det,drop,wave)=>{
    const o=audioCtx.createOscillator(); if(wave) o.setPeriodicWave(wave); else o.type='sine';
    o.frequency.setValueAtTime(f,time); if(det) o.detune.setValueAtTime(det,time);
    const g=audioCtx.createGain(); g.gain.setValueAtTime(a,time);
    // Zweistufiges Ausklingen: schneller Anfangsabfall, dann lange Schwebung
    g.gain.setTargetAtTime(a*drop,time+0.005,tau1); g.gain.setTargetAtTime(0.0001,time+0.1+tau1*2,tau1*6+T*0.35);
    o.connect(g).connect(lp); oscs.push(o);
  };
  const tau=k=>T*0.07/(1+0.5*(k-1)), str=k=>Math.sqrt(1+0.0004*k*k); // Saitensteifheit: Teiltöne leicht gespreizt
  part(freq*str(1),1,tau(1),0,0.8);                 // Grundton fällt kaum ab (sonst Wumms wie eine Bassdrum beim Anschlag)
  part(freq*2*str(2),0.8/Math.pow(2,1.2),tau(2),0,0.6);
  if(freq>130) part(freq*str(1),0.55,tau(1)*1.1,-3.5,0.8); // Doppelchörigkeit (Schwebung) nur am Grundton
  const kTop=Math.min(K,Math.floor(11000/freq));
  if(kTop>=3) part(freq*str(4),(0.3+v*0.7*(0.45+hard)),tau(4),0,0.3,pianoWave(kTop)); // obere Teiltöne gemeinsam, Spreizung gemittelt
  lp.connect(amp).connect(pan).connect(tr.bus);
  // Kein Hammer-Rauschen mehr (v92, #48): lag bei 2,5–5 kHz, wo Handy-Lautsprecher am lautesten sind -> Plopp/Hi-Hat bei jedem Anschlag
  oscs.forEach(o=>o.start(time));
  const voice={amp,oscs,t0:time,
    rel(at){ const now=Math.max(time,at!=null?at:audioCtx.currentTime); try{ amp.gain.cancelScheduledValues(now); amp.gain.setValueAtTime(Math.max(0.0001,peak*Math.min(1,(now-time)/0.003)),now); amp.gain.setTargetAtTime(0.0001,now,0.11); oscs.forEach(o=>{ try{o.stop(now+0.8);}catch(e){} }); }catch(e){} }};
  oscs[0].onended=()=>{ try{ amp.disconnect(); }catch(e){} if(tr._cosVoices){ const i=tr._cosVoices.indexOf(voice); if(i>=0) tr._cosVoices.splice(i,1); } };
  const isLive=!(typeof OfflineAudioContext!=='undefined' && audioCtx instanceof OfflineAudioContext);
  if(isLive){ (tr._cosVoices=tr._cosVoices||[]).push(voice);
    while(tr._cosVoices.length>10){ const old=tr._cosVoices.shift(); try{ old.amp.gain.cancelScheduledValues(time); old.amp.gain.setTargetAtTime(0.0001,time,0.03); old.oscs.forEach(x=>{ try{x.stop(time+0.15);}catch(e){} }); }catch(e){} } }
  if(holdSec!=null) voice.rel(time+holdSec);
  else oscs.forEach(o=>{ try{o.stop(time+T*6);}catch(e){} });
  return voice;
}
function triggerPianoStep(time,tr,n,vel,lenSteps){
  if(!audioCtx || !tr.bus) return;
  pianoVoice(tr,time,n,vel,Math.max(0.08,stepDuration()*Math.max(1,lenSteps||1)*0.96));
}
function prPianoOn(tr,n,vel){ return pianoVoice(tr,audioCtx.currentTime+0.005,n,vel,null); }
// Stopp: laufende Cosmic-/Piano-Stimmen kurz ausblenden, noch nicht gestartete verwerfen
function stopCosmicVoices(){
  if(!audioCtx) return;
  const now=audioCtx.currentTime;
  TRACKS.forEach(tr=>{
    const list=tr._cosVoices; if(!list || !list.length) return;
    tr._cosVoices=[];
    list.forEach(v=>{ try{
      v.amp.gain.cancelScheduledValues(now);
      if(v.t0>=now){ v.amp.gain.setValueAtTime(0.0001,now); v.oscs.forEach(o=>{ try{o.stop(now);}catch(e){} }); }
      else{
        v.amp.gain.setValueAtTime(Math.max(0.0001,v.amp.gain.value),now);
        v.amp.gain.linearRampToValueAtTime(0.0001,now+0.04);
        v.oscs.forEach(o=>{ try{o.stop(now+0.06);}catch(e){} });
      }
    }catch(e){} });
  });
}
function triggerArpStep(time, tr, degreeSemis, velocity, slide, holdNext, modPos, accent, lenSteps, chordN){
  lenSteps=Math.max(1,lenSteps||1);
  const I=trInst(tr);
  if(I && I.trigger){ I.trigger(time,tr,degreeSemis,velocity,lenSteps,modPos,chordN); return; }
  ensureArpVoice(tr); // ohne eigenen trigger: Acid-Stimme
  const freq=noteFreq(tr.rootNote + degreeSemis);
  const cutoffBase=300 + (tr.cutoff!=null?tr.cutoff:0.5)*4000;
  const envMod=tr.envMod!=null?tr.envMod:0.5;
  const decaySec=arpDecaySeconds(tr.decay!=null?tr.decay:0.26);
  const dur=stepDuration();
  const offline=(typeof OfflineAudioContext!=='undefined' && audioCtx instanceof OfflineAudioContext);
  let modC0=0, modC1=0;
  if(modPos!=null){
    modC0=autoLfo(modPos)*autoDepth*AUTO_CENTS;
    modC1=autoLfo(modPos+1)*autoDepth*AUTO_CENTS;
  }
  const hq=0;
  const resonance=1 + (tr.resonance!=null?tr.resonance:0.35)*20;
  const isAcc = accent!=null ? accent : velocity>=1.1, aAmt = tr.accentAmt!=null ? tr.accentAmt : 0.5;
  if(accent) velocity*=1+1.06*aAmt; // explizites Accent-Flag: Lautstärke-Anhebung nach Stärke (0,5 = bisher 1,53x)
  const accentBoost = isAcc ? 1+1.4*aAmt : 1; // Filterspitze: 1,7x bei Stärke 0,5 (klassisches 303-"Quack")
  // Gleicher Grund wie bei playMetallicSix: exponentialRampToValueAtTime darf nie 0 als
  // Ziel bekommen, sonst stoppt bei Vol=0 (Fader ganz runter) die komplette Wiedergabe.
  const peakGain = Math.max(0.0001, Math.min(1, velocity*tr.vol*1.1*ARP_LEVEL*(1-0.25*hq)));
  const sliding = !!(slide && tr._arpHeld && tr._arpLastFreq);

  tr._arpFilter.Q.value=resonance;
  tr._arpOsc.frequency.cancelScheduledValues(time);
  tr._arpOsc.detune.cancelScheduledValues(time);
  tr._arpOsc.frequency.setValueAtTime(freq, time); // Zielton; der Glide läuft komplett über detune

  if(sliding){
    // Restversatz eines noch laufenden Glides mitnehmen, damit Slide-Ketten ohne Sprung weiterlaufen
    const resid=(tr._arpOff||0)*Math.exp(-Math.max(0, time-(tr._arpOffT||0))/ARP_SLIDE_TC);
    const cents=1200*Math.log2(tr._arpLastFreq/freq) + resid;
    tr._arpOsc.detune.setValueAtTime(cents, time);
    tr._arpOsc.detune.setTargetAtTime(0, time, ARP_SLIDE_TC);
    tr._arpOff=cents; tr._arpOffT=time;
    // Amp läuft auf der Kurve der ursprünglichen Note weiter (Peak/Start bleiben erhalten)
    const lvl=Math.max(0.0001, tr._arpPeak*Math.exp(-(time-tr._arpEnvT0)/AMP_TAU));
    tr._arpAmp.gain.cancelScheduledValues(time);
    tr._arpAmp.gain.setValueAtTime(lvl, time);
    // Filter bewusst NICHT neu angeschlagen
  } else {
    tr._arpOsc.detune.setValueAtTime(0, time);
    tr._arpOff=0; tr._arpOffT=time;
    tr._arpPeak=peakGain; tr._arpEnvT0=time+0.004;
    tr._arpAmp.gain.cancelScheduledValues(time);
    tr._arpAmp.gain.setValueAtTime(0.0001, time);
    tr._arpAmp.gain.exponentialRampToValueAtTime(peakGain, time+0.004);

    // Filter-Hüllkurve: Sweep von der Spitze (Accent = höher/greller) zurück auf den Boden
    const floorF=Math.max(60, cutoffBase*0.35);
    const peakF=Math.min(12000, floorF*Math.pow(2, envMod*3.03)*accentBoost);
    tr._arpFilter.frequency.cancelScheduledValues(time);
    tr._arpFilter.frequency.setValueAtTime(peakF, time);
    tr._arpFilter.frequency.setTargetAtTime(floorF, time, decaySec/3);
  }
  tr._arpFilter.detune.cancelScheduledValues(time);
  tr._arpFilter.detune.setValueAtTime(modC0, time);
  tr._arpFilter.detune.linearRampToValueAtTime(modC1, time+dur);
  // Gate-Ende: bei gehaltener Note erst nach dem Sicherheitsfenster, sonst nach ARP_GATE
  const ge = holdNext ? time+dur*(lenSteps+0.5) : time+dur*(lenSteps-1+ARP_GATE);
  const lvlEnd=Math.max(0.0008, tr._arpPeak*Math.exp(-(ge-tr._arpEnvT0)/AMP_TAU));
  tr._arpAmp.gain.exponentialRampToValueAtTime(lvlEnd, ge);
  const rEnd=ge+(holdNext?0.02:ARP_REL);
  tr._arpAmp.gain.exponentialRampToValueAtTime(0.0008, rEnd);
  // exponentialRamp kann 0 nicht erreichen: danach sanft auf echte Stille, sonst bleibt die Säge mit −62 dB
  // (+ Resonanzspitze) dauerhaft am Ausgang hängen (Pegel nach Stop, Rauschteppich im Mix).
  if(!holdNext) tr._arpAmp.gain.setTargetAtTime(0, rEnd, 0.008);

  tr._arpLastFreq=freq;
  tr._arpHeld=!!holdNext;
}

// Generiert eine zufällige Acid-Bassline: Random-Walk innerhalb einer
// natürlichen Moll-Tonleiter um die letzte Tonstufe, mit gelegentlichen
// Oktavsprüngen, Accents und Slides — klassisches 303-Feeling.
function generateAcidBasslineCore(tr, from=0, to=PATTERN_LENGTH){
  const scale=(SCALES[tr.scale]||SCALES.minor).semis, sn=scale.length; // Skala der Spur (Standard Moll)
  let lastDegree=0;
  for(let s=from;s<to;s++){
    const beatPos=s%16;
    const p = (beatPos%4===0) ? 0.85 : (beatPos%2===0 ? 0.55 : 0.32);
    if(Math.random()<p){
      const walk=Math.floor(Math.random()*3)-1; // -1, 0, +1 Tonleiterschritt
      lastDegree=Math.max(-sn, Math.min(sn, lastDegree+walk));
      const octaveJump = Math.random()<0.15 ? (Math.random()<0.5?-sn:sn) : 0;
      const degree=lastDegree+octaveJump;
      const scaleIdx=((degree%sn)+sn)%sn;
      const octave=Math.floor(degree/sn);
      tr.notes[s]=scale[scaleIdx]+octave*12;
      tr.steps[s]= Math.random()<0.25 ? VEL_ACCENT : VEL_NORMAL;
      tr.slides[s]=false;
    } else {
      tr.steps[s]=VEL_OFF;
      tr.slides[s]=false;
    }
  }
  // Slide-Flag liegt am Quellton: nur sinnvoll, wenn Quelle UND Folgestep aktiv sind
  for(let s=from;s<to;s++){
    const nx=(s+1)%PATTERN_LENGTH;
    tr.slides[s]= !isPoly(tr) && tr.steps[s]>0 && tr.steps[nx]>0 && Math.random()<0.25;
  }
}
