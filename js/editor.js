"use strict";
// =========================================================================
// UI: GROSSES EDIT-GRID (4x4 = 16 Steps des aktiven Tracks)
// =========================================================================
let stepBrush=VEL_NORMAL;
const stepArt={ch:0, rd:0, cy:0}; // gewählte Spielweise beim Setzen, pro Spur
const bigGrid=document.getElementById('bigGrid');
const bigCells=[];
const bigCellNums=[];
for(let s=0;s<16;s++){
  const c=document.createElement('div');
  c.className='bstep'+(s%4===0?' beat-start':'');
  const num=document.createElement('span'); num.className='num'; num.textContent=s+1;
  c.appendChild(num);
  bigCellNums.push(num);
  // Tap zyklisiert die Velocity dieses Steps für die aktuell aktive Spur:
  // aus → normal → accent → ghost → ghost soft → aus. s ist relativ zur aktuellen
  // Seite; die absolute Position im (ggf. längeren) Pattern ergibt sich aus currentPage.
  c.addEventListener('click', ()=>{
    const tr=TRACKS[activeTrackIdx];
    const abs=currentPage*16+s;
    const sa=ART[tr.id] ? stepArt[tr.id]|0 : 0;
    if(tr.steps[abs]===stepBrush && (!ART[tr.id] || (tr.notes[abs]|0)===sa)) tr.steps[abs]=VEL_OFF;
    else { tr.steps[abs]=stepBrush; if(tr.notes) tr.notes[abs]=sa; }
    updateStepVisual(c, tr.steps[abs]); c.dataset.a=artLetter(tr,abs);
    if(tr._ovCells) updateStepVisual(tr._ovCells[s], tr.steps[abs]);
  });
  bigGrid.appendChild(c); bigCells.push(c);
}
function updateStepVisual(el, v){
  el.classList.remove('vel-ghost-soft','vel-ghost','vel-normal','vel-accent','on');
  const cls=velClass(v);
  if(cls) el.classList.add(cls, 'on'); // 'on' bleibt als generischer "aktiv"-Marker erhalten
}
function renderBigGrid(){
  const tr=TRACKS[activeTrackIdx];
  bigGrid.style.setProperty('--tc', tr.color);
  for(let s=0;s<16;s++){
    bigCells[s].style.setProperty('--tc', tr.color);
    bigCellNums[s].textContent = currentPage*16+s+1; // absolute Step-Nummer im Pattern
    updateStepVisual(bigCells[s], tr.steps[currentPage*16+s]);
    bigCells[s].dataset.a=artLetter(tr,currentPage*16+s);
  }
  renderEditorArea(tr);
}

// =========================================================================
// EDITORBEREICH + NOTEN-HELFER — Melodiespuren (arp) zeigen statt bigGrid die Piano-Roll-Vorschau;
// Bearbeiten im Piano-Roll-Fenster. Helfer werden von Piano Roll und Acid-Spielfläche genutzt.
// Notenname: noteFreq() basiert auf A1 (55 Hz) -> Halbton 0 bei rootNote 0 ist ein A.
// =========================================================================
function renderEditorArea(tr){
  const isArp=tr.type==='arp';
  bigGrid.style.display=isArp?'none':''; document.getElementById('brushRow').style.display=isArp?'none':'';
  artRender(tr);
  hmRender();
  if(!isArp){ $id('prPreview').style.display='none'; $id('taRoll').style.display='none'; return; }
  $id('prPreview').style.display='flex'; $id('taRoll').style.display=''; prDrawPreview(tr);
}
// Leiste „Spielweise“ unter der Stärke — nur für Spuren mit Spielweisen (Hi-Hat, Ride, Crash)
function artRender(tr){
  const row=$id('artRow'), L=ART[tr.id];
  if(!L){ row.style.display='none'; row.innerHTML=''; return; }
  row.style.display=''; const cur=stepArt[tr.id]|0;
  row.innerHTML='<span class="al">Spielweise</span>'+L.map((x,i)=>'<button data-a="'+i+'" class="'+(i===cur?'on':'')+'" aria-pressed="'+(i===cur)+'"><b>'+x.k+'</b>'+x.n+'</button>').join('');
}
function pitchNoteName(tr,v){
  const t=9+tr.rootNote+v+trOct(tr); // Cosmic klingt 2 Oktaven höher -> Namen passen zum Klang
  return NOTE_NAMES[((t%12)+12)%12]+(Math.floor(t/12)+1);
}
function pitchInScale(v,tr){ return (SCALES[(tr&&tr.scale)||'minor']||SCALES.minor).semis.indexOf(((v%12)+12)%12)>=0; }
// Anspielen nur im Stillstand: triggerArpStep() nutzt die eine dauerhafte Stimme der Spur und
// würde sonst bereits eingeplante Sequencer-Events (cancelScheduledValues) abräumen.
function pitchPreview(tr, semis, vel){
  if(isPlaying) return;
  Promise.resolve(initAudio()).then(()=>{
    if(audioCtx.state!=='running') audioCtx.resume();
    triggerArpStep(audioCtx.currentTime+0.01, tr, semis, vel, false);
  });
}

// =========================================================================
// ACID MOD UI — AUTO (einklappbar). Logik/Engine: siehe triggerArpStep().
// =========================================================================
const arpModPanel=document.getElementById('arpModPanel');
const autoToggle=document.getElementById('autoToggle'), autoBody=document.getElementById('autoBody'), autoSummary=document.getElementById('autoSummary');
const autoShapeSeg=document.getElementById('autoShapeSeg'), autoRateSeg=document.getElementById('autoRateSeg');
const autoDepthEl=document.getElementById('autoDepth'), autoDepthVal=document.getElementById('autoDepthVal');
const autoCurvePath=document.getElementById('autoCurvePath'), autoCurveGrid=document.getElementById('autoCurveGrid'), autoCurvePh=document.getElementById('autoCurvePh');
const AUTO_SHAPE_LABEL={off:'Aus', sine:'Sinus', tri:'Dreieck', drift:'Drift'};
function drawAutoCurve(){
  let d='';
  const N=140;
  for(let i=0;i<=N;i++){
    const v = autoShape==='off' ? 0 : (function(){ const per=autoBars*16; return autoLfo(i/N*per); })();
    d+=(i?'L':'M')+(i/N*340).toFixed(1)+' '+(28-v*autoDepth*24).toFixed(1);
  }
  autoCurvePath.setAttribute('d', d);
  let g='<line x1="0" x2="340" y1="28" y2="28" stroke="rgba(255,255,255,.12)" stroke-width="1" vector-effect="non-scaling-stroke"/>';
  for(let i=1;i<autoBars;i++) g+='<line x1="'+(i*340/autoBars)+'" x2="'+(i*340/autoBars)+'" y1="0" y2="56" stroke="rgba(255,255,255,.12)" stroke-width="1" vector-effect="non-scaling-stroke"/>';
  autoCurveGrid.innerHTML=g;
}
function syncAutoUI(){
  autoShapeSeg.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.v===autoShape));
  autoRateSeg.querySelectorAll('button').forEach(b=>b.classList.toggle('on', +b.dataset.v===autoBars));
  autoDepthEl.value=Math.round(autoDepth*100); autoDepthVal.textContent=autoDepthEl.value+'%';
  autoSummary.textContent = autoShape==='off' ? 'Aus' : AUTO_SHAPE_LABEL[autoShape]+' · '+autoBars+(autoBars===1?' Takt':' Takte')+' · '+autoDepthEl.value+'%';
  drawAutoCurve(); updateAutoVisual();
}
function updateAutoVisual(){
  const per=autoBars*16, x=(((modVisAbs%per)+per)%per)/per*340;
  autoCurvePh.setAttribute('x1',x); autoCurvePh.setAttribute('x2',x);
}
autoToggle.addEventListener('click', ()=>{
  const open=!autoBody.classList.contains('open');
  autoBody.classList.toggle('open', open);
  autoToggle.setAttribute('aria-expanded', open?'true':'false');
  if(open) drawAutoCurve();
});
autoShapeSeg.addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return; autoShape=b.dataset.v; syncAutoUI(); });
autoRateSeg.addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b) return; autoBars=+b.dataset.v; syncAutoUI(); });
autoDepthEl.addEventListener('input', ()=>{ autoDepth=autoDepthEl.value/100; syncAutoUI(); });
syncAutoUI();

// =========================================================================
// ACID-SPIELFLÄCHE — Vollbild-Touchfläche für die Acid-Stimme: X = Tonhöhe (gerastet auf die Skala der Spur, 2 Oktaven),
// Y = Cutoff, Reso per Regler. Eigene Live-Stimme (tr._live), unabhängig vom Sequencer-Voice: beides klingt gleichzeitig.
// Gate offen, solange der Finger liegt; Wischen zu einer anderen Spalte gleitet (wenn "Gleiten" an) ohne neuen Anschlag.
// =========================================================================
const xyOverlay=document.getElementById('xyOverlay'), xyPad=document.getElementById('xyPad'), xyPuck=document.getElementById('xyPuck');
const xyReadN=document.getElementById('xyReadN'), xyReadC=document.getElementById('xyReadC');
const xyScaleSel=document.getElementById('xyScaleSel');
const xyReso=document.getElementById('xyReso'), xyResoVal=document.getElementById('xyResoVal');
const xyGlideBtn=document.getElementById('xyGlideBtn');
let xyLo=0, xyGlide=true, xyDown=false, xyAudio=false, xyCur=-1, xyLast={i:0,y:0.5}, xyCols=[];
function xyTrack(){ return TRACKS.find(t=>t.type==='arp'); }
function acidScale(tr){ return SCALES[tr.scale] || SCALES.minor; }
function xySemi(tr,i){ const sc=acidScale(tr).semis, n=sc.length; return sc[i%n]+12*Math.floor(i/n)+xyLo; }
const scaleOptionsHtml=Object.keys(SCALES).map(k=>'<option value="'+k+'">'+SCALES[k].label+'</option>').join('');
xyScaleSel.innerHTML=scaleOptionsHtml;
function xyBuild(){
  const tr=xyTrack(); if(!tr) return;
  xyPad.querySelectorAll('.xy-col').forEach(c=>c.remove()); xyCols=[];
  const n=acidScale(tr).semis.length, cnt=n*2+1;
  for(let i=0;i<cnt;i++){
    const c=document.createElement('div'); c.className='xy-col'+(i%n===0?' rt':'');
    c.innerHTML='<span>'+pitchNoteName(tr,xySemi(tr,i))+'</span>';
    xyPad.insertBefore(c, xyPuck); xyCols.push(c);
  }
  xyScaleSel.value=tr.scale||'minor';
  xyReso.value=Math.round((tr.resonance!=null?tr.resonance:0.35)*100); xyResoVal.textContent=xyReso.value+'%';
}
// Skala wechseln: gilt für die ganze Acid-Spur (Spielfläche, Piano Roll, Random)
function setAcidScale(id, tr){
  tr=tr||xyTrack(); if(!tr || !SCALES[id]) return;
  tr.scale=id;
  if(tr===xyTrack()) xyScaleSel.value=id;
  if(tr===TRACKS[activeTrackIdx]) renderEditorArea(tr);
  if(tr===xyTrack() && xyOverlay.classList.contains('open')) xyBuild();
}
xyScaleSel.addEventListener('change', ()=>setAcidScale(xyScaleSel.value));

function xyEnsureVoice(tr){
  if(tr._live) return tr._live;
  const o=audioCtx.createOscillator(); o.type='sawtooth';
  const f=audioCtx.createBiquadFilter(); f.type='lowpass';
  const a=audioCtx.createGain(); a.gain.value=0;
  o.connect(f).connect(a).connect(tr.bus); o.start();
  return tr._live={o,f,a,held:false,baseY:0.5};
}
function xyFilterY(L,y){
  const cents=1200*Math.log2((300+y*4000)/(300+L.baseY*4000));
  L.f.detune.setTargetAtTime(cents, audioCtx.currentTime, 0.02);
}
function xyNoteOn(tr,i,y){
  const L=xyEnsureVoice(tr), t=audioCtx.currentTime;
  const freq=noteFreq(tr.rootNote+xySemi(tr,i));
  L.o.frequency.cancelScheduledValues(t);
  if(xyGlide && L.held){
    L.o.frequency.setTargetAtTime(freq, t, ARP_SLIDE_TC); // Slide: Gate offen, Hüllkurven laufen weiter
    xyFilterY(L,y); return;
  }
  L.o.frequency.setValueAtTime(freq, t);
  L.baseY=y;
  const base=300+y*4000, envMod=tr.envMod!=null?tr.envMod:0.5, decaySec=arpDecaySeconds(tr.decay!=null?tr.decay:0.26);
  const floorF=Math.max(60,base*0.35), peakF=Math.min(12000, floorF*Math.pow(2,envMod*3.03));
  L.f.detune.cancelScheduledValues(t); L.f.detune.setValueAtTime(0,t);
  L.f.frequency.cancelScheduledValues(t); L.f.frequency.setValueAtTime(peakF,t); L.f.frequency.setTargetAtTime(floorF,t,decaySec/3);
  L.f.Q.value=1+(tr.resonance!=null?tr.resonance:0.35)*20;
  const peak=Math.max(0.0001, Math.min(1, VEL_NORMAL*tr.vol*1.1*ARP_LEVEL));
  L.a.gain.cancelScheduledValues(t);
  L.a.gain.setValueAtTime(Math.max(0.0001,L.a.gain.value), t);
  L.a.gain.exponentialRampToValueAtTime(peak, t+0.004);
  L.held=true;
}
function xyNoteOff(){
  const tr=xyTrack(), L=tr && tr._live; if(!L || !audioCtx) return;
  const t=audioCtx.currentTime;
  L.a.gain.cancelScheduledValues(t);
  L.a.gain.setValueAtTime(Math.max(0.0001,L.a.gain.value), t);
  L.a.gain.setTargetAtTime(0, t, 0.03);
  L.held=false;
}
function xyPos(e){
  const r=xyPad.getBoundingClientRect(), cnt=xyCols.length||1;
  const fx=Math.min(0.9999,Math.max(0,(e.clientX-r.left)/r.width)), fy=Math.min(1,Math.max(0,1-(e.clientY-r.top)/r.height));
  xyPuck.style.left=(e.clientX-r.left)+'px'; xyPuck.style.top=(e.clientY-r.top)+'px';
  xyLast={i:Math.floor(fx*cnt), y:fy};
  return xyLast;
}
function xyShow(){
  const tr=xyTrack(); if(!tr) return;
  xyCols.forEach((c,k)=>c.classList.toggle('cur', xyDown && k===xyLast.i));
  xyReadN.textContent=pitchNoteName(tr,xySemi(tr,xyLast.i));
  xyReadC.textContent='CUT '+Math.round(xyLast.y*100)+'%';
}
function xyMove(e){
  const p=xyPos(e); xyShow();
  if(!xyAudio) return;
  const tr=xyTrack();
  if(p.i!==xyCur){ xyNoteOn(tr,p.i,p.y); xyCur=p.i; }
  else if(tr._live) xyFilterY(tr._live,p.y);
}
function xyRelease(){
  if(!xyDown) return;
  xyDown=false; xyAudio=false; xyCur=-1; xyPad.classList.remove('down'); xyShow(); xyNoteOff();
}
// Alles stoppen (auch von closeAllOverlays aufgerufen)
function xyClear(){ if(xyDown||xyAudio){ xyDown=false; xyAudio=false; xyCur=-1; xyPad.classList.remove('down'); xyNoteOff(); } }
xyPad.addEventListener('pointerdown', async e=>{
  try{ xyPad.setPointerCapture(e.pointerId); }catch(err){}
  xyDown=true; xyPad.classList.add('down'); xyPos(e); xyShow();
  await Promise.resolve(initAudio());
  if(audioCtx.state!=='running') audioCtx.resume();
  if(!xyDown) return; // schon losgelassen, während das Audio initialisiert wurde
  const tr=xyTrack();
  xyNoteOn(tr, xyLast.i, xyLast.y); xyCur=xyLast.i; xyAudio=true;
});
xyPad.addEventListener('pointermove', e=>{ if(xyDown) xyMove(e); });
xyPad.addEventListener('pointerup', xyRelease);
xyPad.addEventListener('pointercancel', xyRelease);
document.getElementById('xyOctDown').addEventListener('click', ()=>{ xyLo=Math.max(-24,xyLo-12); xyBuild(); });
document.getElementById('xyOctUp').addEventListener('click', ()=>{ xyLo=Math.min(12,xyLo+12); xyBuild(); });
xyGlideBtn.addEventListener('click', ()=>{ xyGlide=!xyGlide; xyGlideBtn.classList.toggle('on', xyGlide); });
xyReso.addEventListener('input', ()=>{
  const tr=xyTrack(); tr.resonance=xyReso.value/100; xyResoVal.textContent=xyReso.value+'%';
  if(tr._live) tr._live.f.Q.value=1+tr.resonance*20;
  renderArpControls(tr);
});
function openXY(){ xyBuild(); xyShow(); xyOverlay.classList.add('open'); syncBottomBarVisibility(); }
function closeXY(){ xyClear(); xyOverlay.classList.remove('open'); syncBottomBarVisibility(); }
document.getElementById('xyCloseBtn').addEventListener('click', closeXY);
document.getElementById('arpXyBtn').addEventListener('click', openXY);

// Spurleiste im Pattern-Tab: zeigt nur die Zeilen der gewählten Gruppe (gleiche Gruppen wie die Song-Übersicht)
let patternGroup='drums';
function groupOfTrack(tr){ const g=ARR_GROUPS.find(x=>x.ids.indexOf(tr.id)>=0); return g ? g.id : 'drums'; }
function setPatternGroup(gid, select){
  patternGroup=gid;
  grpSelRender();
  { const kitOn=(gid==='drums'||gid==='perc'||gid==='piano'); $id('spurRow').classList.toggle('hasKit',kitOn); $id('lcdKitBtn').style.display=kitOn?'':'none'; $id('lcdKitBtn').classList.toggle('keys',gid==='piano'); updateKitLabel(); $id('fillBtn').style.display=gid==='drums'?'':'none'; }
  TRACKS.forEach(tr=>{ if(tr._ovRow) tr._ovRow.style.display = groupOfTrack(tr)===gid ? '' : 'none'; });
  if(select) selectTrack(TRACKS.findIndex(t=>groupOfTrack(t)===gid));
}
