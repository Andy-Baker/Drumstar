"use strict";
// =========================================================================
// SAMPLE PAD — 9 unabhängige Live-Pads, eigenes Mikro-Sample pro Pad,
// getrennt vom Step-Sequencer (sofortiges Antippen statt Timing-Raster).
// =========================================================================
const PAD_COUNT=9;
const padSamples=Array.from({length:PAD_COUNT}, ()=>({buffer:null, offset:0, slot:{voice:null}, mode:'oneshot', overlap:false, loopStart:null, loopEnd:null}));
const padSampleId=new Array(PAD_COUNT).fill(null); // welcher Bibliothekseintrag ist diesem Pad zugeordnet

const padGrid=document.getElementById('padGrid');
const padQuantizeBtn=document.getElementById('padQuantizeBtn');
let padQuantize=true; // Standard an: Live-Pad-Anschläge während des Abspielens aufs Raster ziehen
padQuantizeBtn.addEventListener('click', ()=>{
  padQuantize=!padQuantize;
  padQuantizeBtn.classList.toggle('on', padQuantize);
});

// Sample-Pad-Bereich: jetzt eigenes Tab-Panel (früher Vollbild-Overlay) — Klick-
// Handler wird weiter unten zentral über switchTab() gesetzt (s. dort).
const padsToggleBtn=document.getElementById('padsToggleBtn');
const padOverlay=document.getElementById('padOverlay');

// =========================================================================
// MIXER — Vollbild-Overlay mit einem Kanalzug pro Spur (Fader/Vol, Pan,
// Mute/Solo, Pegelmeter) plus fest angehefteter Master-Sektion rechts.
// Fader/Vol nutzen dieselbe setTrackVol()/setMasterVol()-Funktion wie die
// Track-Detail-Leiste bzw. der globale Volume-Knob — beide Ansichten bleiben
// dadurch synchron, ganz gleich wo zuerst geändert wird.
// =========================================================================
const mixerToggleBtn=document.getElementById('mixerToggleBtn');
const mixerOverlay=document.getElementById('mixerOverlay');
const mixerChannels=document.getElementById('mixerChannels');

function dbLabel(v){
  if(v<=0.001) return '-∞';
  return (20*Math.log10(v)).toFixed(1);
}
// Mixer (v79, Mockup effekte-mockup.html v7): alle Kanäle gleich hoch; sichtbar nur Fader, Meter, M/S und ein Knopf,
// der die Kanal-Einstellungen öffnet (= Klang → Mix & FX). Drums laufen über eine Gruppe (zugeklappt),
// Hall/Delay scrollen am Ende mit, nur der Master steht fest.
let mxGrpOpen={drums:false,perc:false}, mxGrpMeters={}, mxRetMeters={};
const MX_ICO='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4v16M12 4v16M19 4v16"/><circle cx="5" cy="14" r="2" fill="currentColor"/><circle cx="12" cy="8" r="2" fill="currentColor"/><circle cx="19" cy="15" r="2" fill="currentColor"/></svg>';
const mxDots=L=>'<span class="mx-dots">'+Array.from({length:FX_MAX},(_,i)=>'<i class="'+(L&&L[i]?(L[i].on?'on':'by'):'')+'"></i>').join('')+'</span>';
function mxStrip(o){ // o: {cls,color,name,sub,head,vol,label,onVol,mute,solo,chip,set,dots,parent}
  const strip=document.createElement('div'); strip.className='mix-strip '+(o.cls||'');
  const tag=document.createElement('div'); tag.className='mix-strip-tag'; tag.style.background=o.color; strip.appendChild(tag);
  const head=document.createElement('div'); head.className='mix-head'; head.innerHTML=o.head||('<div class="mix-name">'+o.name+'</div>'+(o.sub?'<div class="mix-sub">'+o.sub+'</div>':'')); strip.appendChild(head);
  const faderRow=document.createElement('div'); faderRow.className='mix-fader-row';
  const meter=document.createElement('div'); meter.className='mix-meter';
  const meterMask=document.createElement('div'); meterMask.className='mix-meter-mask'; meterMask.style.height='100%';
  const meterZero=document.createElement('div'); meterZero.className='mix-meter-zero';
  const meterPeak=document.createElement('div'); meterPeak.className='mix-meter-peakhold';
  meter.append(meterMask,meterZero,meterPeak); faderRow.appendChild(meter);
  const faderWrap=document.createElement('div'); faderWrap.className='mix-fader-wrap';
  const faderTrack=document.createElement('div'); faderTrack.className='mix-fader-track';
  const fader=document.createElement('input'); fader.type='range'; fader.className='mix-fader'; fader.min='0'; fader.max='1'; fader.step='0.01'; fader.value=o.vol;
  fader.setAttribute('aria-label',o.label+' Lautstärke'); faderWrap.append(faderTrack,fader); faderRow.appendChild(faderWrap); strip.appendChild(faderRow);
  const db=document.createElement('div'); db.className='mix-db-readout'; db.textContent=dbLabel(o.vol)+'dB'; strip.appendChild(db);
  fader.addEventListener('input',()=>{ const v=parseFloat(fader.value); db.textContent=dbLabel(v)+'dB'; o.onVol(v); });
  const btns=document.createElement('div'); btns.className='mix-btns'; let muteBtn=null, soloBtn=null;
  if(o.chip){ const c=document.createElement('div'); c.className='mix-chip'; c.textContent=o.chip; btns.appendChild(c); }
  if(o.mute){ muteBtn=document.createElement('button'); muteBtn.className='mix-mute'; muteBtn.textContent='M'; muteBtn.classList.toggle('on',!!o.mute.on); muteBtn.addEventListener('click',o.mute.fn); btns.appendChild(muteBtn); }
  if(o.solo){ soloBtn=document.createElement('button'); soloBtn.className='mix-solo'; soloBtn.textContent='S'; soloBtn.classList.toggle('on',!!o.solo.on); soloBtn.addEventListener('click',o.solo.fn); btns.appendChild(soloBtn); }
  strip.appendChild(btns);
  const set=document.createElement('button'); set.className='mix-set'; set.setAttribute('aria-label',o.label+' Einstellungen'); set.innerHTML=MX_ICO+(o.dots!==undefined?mxDots(o.dots):''); set.addEventListener('click',o.set); strip.appendChild(set);
  o.parent.appendChild(strip);
  return { el:strip, fader, mute:muteBtn, solo:soloBtn, meter:{ meterMask, meterPeak, dbReadout:db, fader, peakHoldVal:0, smoothVal:0 } };
}
function buildMixerChannels(){
  const ch=mixerChannels, ms=document.getElementById('mixerMaster'); ch.innerHTML=''; ms.innerHTML='';
  TRACKS.forEach(tr=>{ tr._mixFaderEl=null; tr._mixMeter=null; tr._mixMuteBtn=null; tr._mixSoloBtn=null; tr._mixPanKnob=null; tr._mixEqKnobs=null; });
  mxGrpMeters={}; const done={};
  const grpStrip=k=>{ const G=grps[k], D=GRP_DEF[k], op=mxGrpOpen[k];
    const g=mxStrip({cls:'grp-strip grp-'+k+(op?' open':''),color:D.color,label:'Gruppe '+D.n,vol:G.vol,parent:ch,
      head:'<button class="mix-grp" aria-expanded="'+op+'" aria-label="'+D.n+'-Kanäle '+(op?'zuklappen':'aufklappen')+'">'+D.ab+'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button><div class="mix-sub">'+(op?'Gruppe':D.ids.length+' Spuren')+'</div>',
      onVol:v=>{ G.vol=v; grpUpdate(k); }, mute:{on:G.muted,fn:e=>{ G.muted=!G.muted; e.currentTarget.classList.toggle('on',G.muted); grpUpdate(k); }},
      set:()=>openFxRoot('grp',k), dots:G.fx});
    g.el.querySelector('.mix-grp').onclick=()=>{ mxGrpOpen[k]=!op; buildMixerChannels(); };
    mxGrpMeters[k]=g.meter; };
  TRACKS.forEach(tr=>{ const k=trGrp(tr); if(k&&!done[k]){ done[k]=1; grpStrip(k); } if(k&&!mxGrpOpen[k]) return;
    const r=mxStrip({cls:k?'in-grp in-'+k:'',color:tr.color,name:tr.short||tr.id.toUpperCase(),label:tr.name,vol:tr.vol,parent:ch,
      onVol:v=>setTrackVol(tr,v), mute:{on:tr.muted,fn:()=>toggleTrackMute(tr)}, solo:{on:tr.solo,fn:()=>toggleTrackSolo(tr)},
      set:()=>openKanal(tr), dots:tr.fx||[]});
    tr._mixFaderEl=r.fader; tr._mixMeter=r.meter; tr._mixMuteBtn=r.mute; tr._mixSoloBtn=r.solo; });
  const sep=document.createElement('div'); sep.className='mix-sep'; ch.appendChild(sep);
  mxRetMeters={};
  [['hall',fxHall,'Hall'],['delay',fxDelay,'Delay']].forEach(([k,p,n])=>{
    const r=mxStrip({cls:'ret-strip',color:'#1c4666',name:n.toUpperCase(),label:n,vol:p.lv,parent:ch,chip:FX_SEND[k].chip(p).replace(' PP',''),
      onVol:v=>{ p.lv=v; k==='hall'?fxHallUpdate():fxDelayUpdate(); }, set:()=>openFxRoot('send',k)});
    mxRetMeters[k]=r.meter; });
  const m=mxStrip({cls:'master-strip',color:'#5fc2ff',name:'MASTER',label:'Master',vol:masterVol,parent:ms,
    onVol:v=>setMasterVol(v), mute:{on:masterMuted,fn:()=>setMasterMuted(!masterMuted)}, set:()=>openFxRoot('master'), dots:masterFx});
  mixerMasterFaderEl=m.fader; window._masterMeter=m.meter; masterMuteBtnEl=m.mute;
  refreshSoloVisuals&&refreshSoloVisuals();
  mixerFit(); }
let mxRbf=0; function mixerRebuild(){ if(mxRbf) return; mxRbf=requestAnimationFrame(()=>{ mxRbf=0; buildMixerChannels(); }); }
function mixerRebuildSoft(){ const c=mixerChannels.querySelectorAll('.ret-strip .mix-chip'); if(c[0]) c[0].textContent=FX_SEND.hall.chip(fxHall); if(c[1]) c[1].textContent=FX_SEND.delay.chip(fxDelay).replace(' PP',''); }
function mixerSyncGroup(k){ const s=mixerChannels.querySelector('.grp-strip.grp-'+k), f=s&&s.querySelector('.mix-fader'); if(f){ f.value=grps[k].vol; const d=s.querySelector('.mix-db-readout'); if(d) d.textContent=dbLabel(grps[k].vol)+'dB'; } }
// Fader/Meter nutzen die verfügbare Höhe (v65): --fh am Mixer-Tab
function mixerFit(){ requestAnimationFrame(()=>{ const mo=document.getElementById('mixerOverlay'); if(!mo.classList.contains('open')) return;
  const tb=document.getElementById('bottomTabBar'), top=document.getElementById('mixerChannels').getBoundingClientRect().top;
  const avail=(tb&&tb.offsetHeight?tb.getBoundingClientRect().top:window.innerHeight)-top-14; // bis kurz über die Tab-Leiste
  const strip=document.querySelector('#mixerChannels .mix-strip'), fw=document.querySelector('#mixerChannels .mix-fader-wrap');
  const other=strip&&fw ? strip.offsetHeight-fw.offsetHeight : 190;
  mo.style.setProperty('--fh', Math.round(Math.max(160,Math.min(640,avail-other)))+'px'); }); }
window.addEventListener('resize', ()=>{ if(document.getElementById('mixerOverlay').classList.contains('open')) mixerFit(); });
buildMixerChannels();

// Pegelmeter-Loop: liest die Analyser-Knoten aller Spuren + Master aus und
// aktualisiert Maske (verdeckt den unbeleuchteten Teil von oben) + Peak-Hold-
// Strich (fällt langsam ab, klassisches Mixer-Verhalten). Läuft NUR während
// das Mixer-Overlay offen ist (spart CPU/Akku) — startet erneut bei jedem Öffnen.
let mixerMeterRAF=null;
// WICHTIG: Puffer muss mind. so groß wie analyser.fftSize (256) sein — vorher
// war er nur 128 groß, wodurch getByteTimeDomainData() nur die halbe
// Zeitfenster-Breite füllte und kurze Transienten (Drum-Hits) unzuverlässig
// erfasst wurden ("seltsames" Pegelverhalten, Treffer wurden mal erfasst,
// mal komplett verpasst).
const meterByteBuf=new Uint8Array(256);
function readPeak(analyser){
  if(!analyser) return 0;
  analyser.getByteTimeDomainData(meterByteBuf);
  let peak=0;
  for(let i=0;i<meterByteBuf.length;i++){
    const dev=Math.abs(meterByteBuf[i]-128)/128;
    if(dev>peak) peak=dev;
  }
  return peak; // 0..1
}
// Rechnet einen linearen Pegel (0..1, 1.0 = digitales Vollausschlag/0dBFS) in
// eine Meter-Füllhöhe (0..100%) um, kalibriert auf eine echte dB-Skala von
// -48dB (unten, 0%) bis +6dB (oben, 100%) — die weiße "Null"-Linie im CSS
// sitzt exakt bei 11.11% von oben, weil das rechnerisch genau 0dB entspricht
// ((6-0)/(6-(-48))=6/54). Vorher wurde der Rohpegel mit einem frei erfundenen
// Faktor (×140) hochskaliert, ohne dass die eingezeichnete Linie dazu passte —
// optisch "ging es ungefähr", war aber keine echte dB-Referenz.
const METER_FLOOR_DB=-48, METER_CEIL_DB=6;
function ampToMeterPct(peak){
  if(peak<=0.0001) return 0;
  const db=20*Math.log10(peak);
  return Math.min(100, Math.max(0, (db-METER_FLOOR_DB)/(METER_CEIL_DB-METER_FLOOR_DB)*100));
}
function updateMeter(m, analyser){
  const peak=readPeak(analyser);
  const pct=ampToMeterPct(peak);
  // Angriff/Abfall-Ballistik statt Rohwert 1:1 anzuzeigen: ohne das sprang der
  // Balken bei jedem rAF-Tick unvermittelt zwischen "Treffer erwischt" und
  // "Treffer verpasst" hin und her (Perkussion ist kurz genug, dass ein
  // einzelner Analyser-Schnappschuss pro Frame sie leicht verfehlt) — wirkte
  // dadurch ruckartig/unruhig statt wie ein reguläres VU-/Peak-Meter.
  // Sofortiger Anstieg (Attack), sanfter Abfall (Release) behebt das.
  m.smoothVal = pct>m.smoothVal ? pct : m.smoothVal*0.80;
  m.meterMask.style.height=(100-m.smoothVal)+'%';
  m.peakHoldVal = m.smoothVal>m.peakHoldVal ? m.smoothVal : m.peakHoldVal*0.97;
  m.meterPeak.style.top=(100-m.peakHoldVal)+'%';
}
function mixerMeterLoop(){
  if(!mixerOverlay.classList.contains('open')){ mixerMeterRAF=null; return; }
  TRACKS.forEach(tr=>{ if(tr._mixMeter) updateMeter(tr._mixMeter, tr.analyser); });
  GRP_KEYS.forEach(k=>{ if(mxGrpMeters[k]&&FXG.g&&FXG.g[k]) updateMeter(mxGrpMeters[k], FXG.g[k].an); });
  if(mxRetMeters.hall) updateMeter(mxRetMeters.hall, FXG.revAn); if(mxRetMeters.delay) updateMeter(mxRetMeters.delay, FXG.dlAn);
  if(window._masterMeter) updateMeter(window._masterMeter, masterAnalyser);
  mixerMeterRAF=requestAnimationFrame(mixerMeterLoop);
}
// Mixer-Tab-Klick-Handler wird weiter unten zentral über switchTab() gesetzt.

// Gemeinsamer Delay-Send für alle 9 Live-Pads (kein Sinn, jedes Pad einzeln zu
// regeln — anders als Spuren werden Pads meist spontan/live gespielt).
const padDelayIn=document.getElementById('padDelayIn');
padDelayIn.value=Math.round(padDelayAmount*100); document.getElementById('padDelayV').textContent=padDelayIn.value+'%';
padDelayIn.addEventListener('input', ()=>{ const v=padDelayIn.value/100; padDelayAmount=v; if(padDelaySendGain) padDelaySendGain.gain.value=v; document.getElementById('padDelayV').textContent=padDelayIn.value+'%'; });

const padEls=[];
for(let i=0;i<PAD_COUNT;i++){
  const el=document.createElement('div'); el.className='pad';
  const label=document.createElement('div'); label.className='plabel'; label.textContent='PAD '+(i+1);
  const stat=document.createElement('div'); stat.className='pstat'; stat.textContent='leer';
  const trimBtnEl=document.createElement('button'); trimBtnEl.className='pad-trim-btn'; trimBtnEl.innerHTML=UI_IC.trim; trimBtnEl.setAttribute('aria-label','Sample bearbeiten');
  trimBtnEl.title='Sample bearbeiten';
  el.appendChild(label); el.appendChild(stat); el.appendChild(trimBtnEl);
  trimBtnEl.addEventListener('click', (e)=>{ e.stopPropagation(); openSampleEditor({sampleId:padSampleId[i], forPad:i}); });

  // Aufnahme läuft jetzt ausschließlich über den zentralen Sample-Editor (kein Long-Press
  // direkt auf dem Pad mehr, s. Roadmap-Entscheidung). Tap auf ein leeres Pad öffnet den
  // Editor direkt (schnellster Weg zur ersten Zuweisung), ein gefülltes Pad spielt sofort ab.
  // Gefüllte Pads lösen schon beim Antippen aus (pointerdown) und merken sich das Loslassen;
  // setPointerCapture hält das Pad fest, auch wenn der Finger wegrutscht. Leere Pads öffnen per click den Editor.
  el.addEventListener('pointerdown', (e)=>{
    if(e.target.closest('.pad-trim-btn') || !padSamples[i].buffer) return;
    try{ el.setPointerCapture(e.pointerId); }catch(err){}
    playPad(i);
  });
  el.addEventListener('pointerup', ()=>releasePad(i));
  el.addEventListener('pointercancel', ()=>releasePad(i));
  el.addEventListener('click', ()=>{ if(!padSamples[i].buffer) openSampleEditor({sampleId:null, forPad:i}); });

  padGrid.appendChild(el);
  padEls.push({el, label, stat});
}
function updatePadUI(i){
  const {el, stat}=padEls[i]; const s=padSamples[i];
  if(s.buffer){ el.classList.add('filled'); stat.textContent=s.buffer.duration.toFixed(1)+'s'; }
  else { el.classList.remove('filled'); stat.textContent='leer'; }
}
// Zieht einen Live-Trigger-Zeitpunkt aufs nächste 16tel-Raster, solange der
// Sequencer läuft und Quantize aktiv ist — sonst unverändert (echtes Echtzeit-Feel).
function quantizeTiming(rawTime){
  if(!padQuantize || !isPlaying || !audioCtx) return rawTime;
  const dur=stepDuration();
  const delta=rawTime-nextNoteTime;
  const stepsAhead=Math.round(delta/dur);
  let t=nextNoteTime+stepsAhead*dur;
  if(t<audioCtx.currentTime) t+=dur; // niemals rückwirkend auslösen
  return t;
}
function playPad(i){
  const s=padSamples[i];
  if(!s.buffer || !audioCtx) return;
  if(audioCtx.state!=='running') audioCtx.resume();
  const t=quantizeTiming(audioCtx.currentTime+0.006);
  startSampleVoice(s.slot, {buffer:s.buffer, offset:s.offset, mode:s.mode==='loop' ? 'loop' : 'oneshot', overlap:s.overlap,
    loopStart:s.loopStart, loopEnd:s.loopEnd, rate:1, vol:0.9,
    connect:g=>{ g.connect(master); if(padDelaySendGain) g.connect(padDelaySendGain); }}, t);
  padEls[i].el.classList.add('flash');
  setTimeout(()=>padEls[i].el.classList.remove('flash'), 90);
}
// Halten/Schleife: Ton endet beim Loslassen (auch bei pointercancel, z. B. Systemgeste/Anruf)
function releasePad(i){ const m=padSamples[i].mode; if(m==='hold' || m==='loop') releaseVoice(padSamples[i].slot); }
// Aufnahme/Import/Bearbeitung für Pads laufen jetzt zentral im Sample-Editor
// (s. u.) — applySampleToPad() übernimmt dort die Zuweisung eines fertigen
// Bibliothekseintrags auf ein Pad, inkl. Persistenz des Verweises.
