"use strict";
// Oberflächen-Elemente je Spur (Übersicht, Mixer) liegen nicht an der Spur selbst,
// damit TRACKS ohne Oberfläche nutzbar bleibt (Vorbereitung freie Spuren, #13).
// Spur-ID → {ovRow, ovCells, ovLab, mixFaderEl, mixMeter, mixMuteBtn, mixSoloBtn, mixPanKnob, mixEqKnobs}.
// Audio-Knoten (bus, _fxN, _arpAmp …) bleiben an der Spur.
const TR_UI=new Map();
function trUi(tr){ let u=TR_UI.get(tr.id); if(!u){ u={}; TR_UI.set(tr.id,u); } return u; }

// =========================================================================
// KNOB-KOMPONENTE
// =========================================================================
function makeKnob({label, min, max, value, size, fmt, onChange}){
  const wrap=document.createElement('div'); wrap.className='knob';
  const dial=document.createElement('div'); dial.className='knob-dial';
  if(size) dial.style.setProperty('--ks', size);
  const ind=document.createElement('div'); ind.className='ind';
  dial.appendChild(ind); wrap.appendChild(dial);
  if(label){ const l=document.createElement('div'); l.className='knob-label'; l.textContent=label; wrap.appendChild(l); }
  const valEl=document.createElement('div'); valEl.className='knob-val'; wrap.appendChild(valEl);

  let val=value;
  function render(){
    const t=(val-min)/(max-min);
    ind.style.transform=`rotate(${-135+t*270}deg)`;
    valEl.textContent = fmt ? fmt(val) : val.toFixed(2);
  }
  render();
  let dragging=false, startY=0, startVal=0;
  function onDown(e){ dragging=true; startY=(e.touches?e.touches[0].clientY:e.clientY); startVal=val; e.preventDefault(); }
  function onMove(e){
    if(!dragging) return;
    const y=(e.touches?e.touches[0].clientY:e.clientY);
    val=Math.min(max,Math.max(min, startVal+((startY-y)/130)*(max-min)));
    render(); onChange && onChange(val);
    e.preventDefault && e.preventDefault();
  }
  function onUp(){ dragging=false; }
  dial.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  dial.addEventListener('touchstart', onDown, {passive:false});
  window.addEventListener('touchmove', onMove, {passive:false});
  window.addEventListener('touchend', onUp);
  return { el:wrap, setValue(v){ val=v; render(); } };
}

// Globale Regler
let bpm=128, swing=0, masterVol=0.85, humanize=0;
let masterVolKnobRef=null, mixerMasterFaderEl=null; // für bidirektionale Sync mit dem Mixer-Master-Fader
let masterMuted=false, masterMuteBtnEl=null;
function setMasterVol(v){
  masterVol=v;
  if(master) master.gain.value = masterMuted ? 0 : v;
  if(masterVolKnobRef) masterVolKnobRef.setValue(v);
  if(mixerMasterFaderEl && Number(mixerMasterFaderEl.value)!==v) mixerMasterFaderEl.value=v;
}
function setMasterMuted(m){
  masterMuted=m;
  if(master) master.gain.value = masterMuted ? 0 : masterVol;
  if(masterMuteBtnEl) masterMuteBtnEl.classList.toggle('on', masterMuted);
}
masterVolKnobRef={setValue(){ syncSettingsUI(); }};

// =========================================================================
// TEMPO — digitale Anzeige statt Drehregler. Ersetzt den früheren TEMPO-Knob:
// kleine Kachel in der Transport-Leiste (zeigt nur die Zahl, öffnet per Klick
// ein Vollbild-Overlay), darin Tap-Tempo, ±1-Stepper, Slider (60–200) und
// Zifferneingabe. setBpm() ist die EINZIGE Stelle, die bpm ändert — von hier
// aus werden alle Anzeigen (LCD-Kopfzeile, Kachel, Overlay-Ziffer, Slider)
// synchron gehalten, egal ob Tap/Stepper/Slider/Keypad/Pattern-Load ausgelöst hat.
function setBpm(v){
  bpm=Math.min(200, Math.max(60, Math.round(v)));
  tempoChipVal.textContent=bpm;
  tempoOverlayNum.textContent=bpm;
  tempoOverlaySlider.value=bpm;
  if(audioCtx) updateDelayTime();
}
const tempoControl=document.getElementById('tempoControl');
const tempoChipVal=document.getElementById('tempoChipVal');
const tempoOverlay=document.getElementById('tempoOverlay');
const tempoOverlayCloseBtn=document.getElementById('tempoOverlayCloseBtn');
const tempoOverlayNum=document.getElementById('tempoOverlayNum');
const tempoOverlayNumInput=document.getElementById('tempoOverlayNumInput');
const tempoOverlayMinus=document.getElementById('tempoOverlayMinus');
const tempoOverlayPlus=document.getElementById('tempoOverlayPlus');
const tempoOverlayTap=document.getElementById('tempoOverlayTap');
const tempoOverlayTapFeedback=document.getElementById('tempoOverlayTapFeedback');
const tempoOverlaySlider=document.getElementById('tempoOverlaySlider');

function openTempoOverlay(){ tempoOverlay.classList.add('open'); syncBottomBarVisibility(); }
function closeTempoOverlay(){
  tempoOverlay.classList.remove('open');
  syncBottomBarVisibility();
  closeTempoNumInput(false);
}
tempoControl.addEventListener('click', openTempoOverlay);
tempoControl.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' ') openTempoOverlay(); });
tempoOverlayCloseBtn.addEventListener('click', closeTempoOverlay); // Schließen-Button: immer oben rechts im Overlay-Header

tempoOverlayMinus.addEventListener('click', ()=>setBpm(bpm-1));
tempoOverlayPlus.addEventListener('click', ()=>setBpm(bpm+1));
tempoOverlaySlider.addEventListener('input', ()=>setBpm(parseInt(tempoOverlaySlider.value,10)));

// Tap-Tempo: Mittelwert der letzten (max. 8) Tap-Intervalle, Pause >2s setzt zurück.
let tempoTaps=[];
let tempoTapResetTimer=null;
tempoOverlayTap.addEventListener('click', ()=>{
  const now=performance.now();
  tempoTaps.push(now);
  if(tempoTaps.length>1 && (now-tempoTaps[tempoTaps.length-2])>2000) tempoTaps=[now];
  if(tempoTaps.length>8) tempoTaps.shift();
  if(tempoTaps.length>=2){
    const intervals=[];
    for(let i=1;i<tempoTaps.length;i++) intervals.push(tempoTaps[i]-tempoTaps[i-1]);
    const avg=intervals.reduce((a,b)=>a+b,0)/intervals.length;
    setBpm(60000/avg);
    tempoOverlayTapFeedback.textContent=tempoTaps.length+' Taps erkannt';
  } else {
    tempoOverlayTapFeedback.textContent='nochmal tippen…';
  }
  clearTimeout(tempoTapResetTimer);
  tempoTapResetTimer=setTimeout(()=>{ tempoOverlayTapFeedback.textContent=''; tempoTaps=[]; }, 2200);
});

// Zifferneingabe: Tap auf die große Zahl blendet ein <input type="number"> ein und
// fokussiert es — auf dem Handy öffnet das die native Ziffern-Tastatur (inputmode="numeric"),
// statt ein eigenes Nummernfeld nachzubauen. Optisch identisch zur LCD-Ziffer gestylt,
// damit der Wechsel nicht auffällt.
function openTempoNumInput(){
  tempoOverlayNumInput.value=bpm;
  tempoOverlayNum.style.display='none';
  tempoOverlayNumInput.classList.add('open');
  tempoOverlayNumInput.focus();
  tempoOverlayNumInput.select();
}
let tempoNumIgnoreNextBlur=false;
function closeTempoNumInput(apply){
  if(apply && tempoOverlayNumInput.value!==''){
    setBpm(parseInt(tempoOverlayNumInput.value,10));
  } else if(!apply){
    tempoNumIgnoreNextBlur=true; // Escape/Abbruch: der folgende programmatische blur() darf NICHT nochmal übernehmen
  }
  tempoOverlayNumInput.classList.remove('open');
  tempoOverlayNum.style.display='';
  tempoOverlayNumInput.blur();
}
tempoOverlayNum.addEventListener('click', openTempoNumInput);
tempoOverlayNum.addEventListener('keydown', e=>{ if(e.key==='Enter' || e.key===' ') openTempoNumInput(); });
tempoOverlayNumInput.addEventListener('blur', ()=>{
  if(tempoNumIgnoreNextBlur){ tempoNumIgnoreNextBlur=false; return; }
  closeTempoNumInput(true);
});
tempoOverlayNumInput.addEventListener('keydown', e=>{
  if(e.key==='Enter'){ e.preventDefault(); closeTempoNumInput(true); }
  if(e.key==='Escape'){ e.preventDefault(); closeTempoNumInput(false); }
});
setBpm(bpm); // initiale Anzeige synchronisieren

// Geteilte Mute/Solo-Toggle-Funktionen: aktualisieren sowohl die Overview-Buttons
// als auch die (später gebauten) Mixer-Kanalzug-Buttons, damit beide Ansichten
// immer denselben Zustand zeigen, egal wo zuerst geklickt wurde.
function toggleTrackMute(tr){
  tr.muted=!tr.muted; syncTbMS();
  if(trUi(tr).ovRow) trUi(tr).ovRow.classList.toggle('muted', tr.muted);
  if(trUi(tr).mixMuteBtn) trUi(tr).mixMuteBtn.classList.toggle('on', tr.muted);
}
function toggleTrackSolo(tr){
  tr.solo=!tr.solo;
  if(trUi(tr).mixSoloBtn) trUi(tr).mixSoloBtn.classList.toggle('on', tr.solo);
  refreshSoloVisuals();
}
// Zentrale Stelle für Lautstärkeänderungen (egal ob per Track-Detail-Knob oder
// Mixer-Fader ausgelöst) — hält beide UIs synchron, ohne dass Duplizierung/
// Rundungs-Drift zwischen zwei separaten Zustandskopien entstehen kann.
function setTrackVol(tr, v){
  tr.vol=v;
  if(trUi(tr).mixFaderEl && Number(trUi(tr).mixFaderEl.value)!==v) trUi(tr).mixFaderEl.value=v;
}

// =========================================================================
// UI: OVERVIEW — glanceable, Track-Auswahl + Volume-Regler pro Sound
// =========================================================================
const overviewEl=document.getElementById('overview');
// Zeile je Spur; Index erst beim Antippen bestimmen (Spuren kommen und gehen, #13). before = Zeile, vor der eingefügt wird
function ovRowMake(tr, before){
  const row=document.createElement('div'), sel=()=>selectTrack(TRACKS.indexOf(tr));
  row.className='ov-row'; row.style.setProperty('--tc', tr.color);
  const lab=document.createElement('div'); lab.className='ov-label'; lab.textContent=trShort(tr); trUi(tr).ovLab=lab;
  lab.addEventListener('click', sel);
  row.appendChild(lab);
  const cells=[];
  for(let s=0;s<16;s++){
    const c=document.createElement('div'); c.className='ov-cell'; c.addEventListener('click', sel);
    row.appendChild(c); cells.push(c);
  }
  trUi(tr).ovCells=cells; trUi(tr).ovRow=row;
  row.addEventListener('click', (e)=>{ if(e.target===row) sel(); });
  overviewEl.insertBefore(row, before||null);
}
TRACKS.forEach(tr=>ovRowMake(tr)); arrGroupsBuild(); // setzt data-idx
// Zeigt an, welche Spuren durch aktive Solo-Schaltung(en) gerade stummgeschaltet
// sind (alle nicht-solierten, sobald mindestens eine Spur soliert ist).
function refreshSoloVisuals(){
  const anySolo=TRACKS.some(t=>t.solo); syncTbMS(); if(typeof mixerSyncGrpSolo==='function') mixerSyncGrpSolo();
  TRACKS.forEach(tr=>{
    trUi(tr).ovRow.classList.toggle('solo-dim', anySolo && !tr.solo); trUi(tr).ovRow.classList.toggle('solo', !!tr.solo);
  });
}
// Aktualisiert nur die Step-Anzeige einer einzelnen Spur (Overview-Zeile +
// großes Grid, falls diese Spur gerade aktiv ausgewählt ist) — genutzt vom
// Pro-Spur-Random-Button, damit nicht das ganze UI neu gerendert werden muss.
function refreshTrackStepVisuals(tr){
  for(let s=0;s<16;s++) updateStepVisual(trUi(tr).ovCells[s], tr.steps[currentPage*16+s]);
  if(tr===TRACKS[activeTrackIdx]) renderBigGrid();
}

// =========================================================================
// UI: TRACK-DETAIL-BAR
// =========================================================================
const tbName=document.getElementById('tbName'), tbDot=document.getElementById('tbDot');
const tbPreview=document.getElementById('tbPreview');
const lcdKit=document.getElementById('lcdKit');
const kitPickerList=document.getElementById('kitPickerList');
const kitPickerOverlay=document.getElementById('kitPickerOverlay');
const soundPickerOverlay=document.getElementById('soundPickerOverlay');
function soundPickerRefresh(){
  const tr=grpSoundTr(patternGroup), S=trInst(tr).sounds(), box=document.getElementById('soundPickerList'); box.innerHTML='';
  Object.keys(S).forEach(id=>{
    const k=S[id], chip=document.createElement('div'); chip.className='kit-chip'+(tr.sound===id?' active':'');
    chip.innerHTML='<div class="kn">'+k.name+'</div><div class="kd">'+k.desc+'</div>';
    chip.addEventListener('click', ()=>{ keysSetSound(tr,id); soundPickerRefresh(); });
    box.appendChild(chip);
  });
}
function keysSetSound(tr,id){
  if(tr.sound!==id){ tr.sound=id; Object.assign(tr,KEY_SOUNDS[id].def); }
  updateKitLabel();
  Promise.resolve(initAudio()).then(()=>{ if(audioCtx.state!=='running') audioCtx.resume(); if(isPlaying) return;
    const t=audioCtx.currentTime+0.02; [0,4,7].forEach((n,i)=>pianoVoice(tr,t+i*0.015,n+12,0.8,0.9)); });
}
document.getElementById('soundPickerCloseBtn').addEventListener('click', ()=>{ soundPickerOverlay.classList.remove('open'); syncBottomBarVisibility(); });
Object.keys(KITS).forEach(kitId=>{
  const kit=KITS[kitId]; // welche Kits eine Drum-Spur anbietet: kitPickerRefresh (kitFits)
  const chip=document.createElement('div');
  chip.className='kit-chip';
  chip.innerHTML='<div class="kn">'+kit.name+'</div><div class="kd">'+kit.desc+'</div>';
  if(kit.samples){
    chip.classList.add('smp');
    chip.innerHTML='<div class="kt"><div class="grow"><div class="kn">'+kit.name+'</div><div class="kd">'+kit.desc+'</div></div>'
      +'<button class="kit-kl" aria-expanded="false" aria-label="Klang dieses Kits">KLANG<svg class="uic" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></div><div class="kit-opts" hidden></div>';
    chip.querySelector('.kit-kl').addEventListener('click', e=>{ e.stopPropagation(); smpOptToggle(chip); });
    chip.querySelector('.kit-opts').addEventListener('click', e=>e.stopPropagation());
  }
  chip.addEventListener('click', ()=>kitChooseGuarded(()=>applyStandardKit(kitId)));
  kit._chip=chip;
  kitPickerList.appendChild(chip);
});
smpChipIdle(); smpCheckCache();
const lcdKitBtn=document.getElementById('lcdKitBtn');
const kitPickerCloseBtn=document.getElementById('kitPickerCloseBtn');
lcdKitBtn.addEventListener('click', ()=>{ closeAllOverlays(); if(grpSoundTr(patternGroup)){ soundPickerOverlay.classList.add('open'); syncBottomBarVisibility(); soundPickerRefresh(); return; } kitPickerOverlay.classList.add('open'); syncBottomBarVisibility(); smpOptCollapse(); kitPickerRefresh(); });
kitPickerCloseBtn.addEventListener('click', ()=>{ kitPickerOverlay.classList.remove('open'); syncBottomBarVisibility(); });
const lcdPatternBtn=document.getElementById('lcdPatternBtn');
const lcdPatternName=document.getElementById('lcdPatternName');
lcdPatternBtn.addEventListener('click', ()=>{
  closeAllOverlays();
  patternsOverlay.classList.add('open');
  syncBottomBarVisibility();
  pbRender(true);
  refreshPatternList();
});
// Zentrale Stelle, die currentLoadedPatternId setzt UND die LCD-Anzeige synchron hält —
// ersetzt direkte Zuweisungen von currentLoadedPatternId an allen Aufrufstellen.
// Blendet außerdem den ↻-Button ein/aus: nur sichtbar, solange ein gespeicherter Beat
// geladen ist (bei einem frischen/neuen Pattern gibt es noch nichts zu überschreiben).
function setCurrentLoadedPattern(id, name){
  currentLoadedPatternId=id;
  currentLoadedPatternName=name;
  lcdPatternName.textContent=name||'—';
  if(typeof pbRender==='function') pbRender(true);
}

// ---- Pattern-Länge (16/32/48/64 Steps) ----
const lengthRow=document.getElementById('lengthRow');
const LENGTH_OPTIONS=[16,32,48,64];
const lengthChips={};
LENGTH_OPTIONS.forEach(len=>{
  const chip=document.createElement('div');
  chip.className='len-chip'+(len===PATTERN_LENGTH?' active':'');
  chip.textContent=len;
  chip.addEventListener('click', ()=> setPatternLength(len));
  lengthChips[len]=chip;
  lengthRow.appendChild(chip);
});
function renderLengthChips(){
  LENGTH_OPTIONS.forEach(len=> lengthChips[len].classList.toggle('active', len===PATTERN_LENGTH));
}

// ---- Seiten-Navigation (nur sichtbar, wenn Pattern >16 Steps hat) ----
const pageNav=document.getElementById('pageNav');
const pageLabel=document.getElementById('pageLabel');
const pagePrevBtn=document.getElementById('pagePrevBtn');
const pageNextBtn=document.getElementById('pageNextBtn');
const pageCopyBtn=document.getElementById('pageCopyBtn');
let pagePinned=false;
const pinBtn=document.getElementById('pinBtn');
function renderPinChip(){ pinBtn.style.display = pagePinned && isPlaying ? 'block' : 'none'; }
function pinIfPlaying(){ if(isPlaying){ pagePinned=true; renderPinChip(); } }
pinBtn.addEventListener('click', ()=>{ pagePinned=false; renderPinChip(); if(isPlaying && lastDisplayStep>=0){ currentPage=Math.floor(lastDisplayStep/16); renderPageNav(); renderAllForPage(); } });
function renderPageNav(){
  const total=totalPages();
  pageNav.classList.toggle('show', total>1);
  pageLabel.textContent='Seite '+(currentPage+1)+'/'+total;
  pagePrevBtn.disabled = currentPage===0;
  pageNextBtn.disabled = currentPage===total-1;
  pageCopyBtn.disabled = currentPage===total-1;
  document.getElementById('taScope').style.display = total>1 ? 'flex' : 'none';
}
pagePrevBtn.addEventListener('click', ()=>{
  if(currentPage>0){ currentPage--; pinIfPlaying(); renderPageNav(); renderAllForPage(); }
});
pageNextBtn.addEventListener('click', ()=>{
  if(currentPage<totalPages()-1){ currentPage++; pinIfPlaying(); renderPageNav(); renderAllForPage(); }
});
// Dupliziert die 16 Steps (inkl. Noten/Slides für Acid Bass) der aktuellen Seite auf
// die direkt folgende Seite und springt dorthin — schnellster Weg, um z.B. aus einem
// 16-Step-Grundbeat per 32/64-Step-Verlängerung einen Vers/Chorus-Unterschied nur an
// den paar Steps zu bauen, die sich wirklich unterscheiden sollen.
// #69: nur die gewählte Spur (activeTrackIdx); alle anderen Spuren bleiben, Rückgängig im Toast.
function copyCurrentPageToNext(){
  const total=totalPages();
  if(currentPage>=total-1) return;
  const from=currentPage*16, to=(currentPage+1)*16, tr=TRACKS[activeTrackIdx];
  if(!tr) return;
  taSnapshot();
  if(tr.type==='arp'){
    const src=tr.events.filter(e=>e.s>=from&&e.s<from+16);
    tr.events=tr.events.filter(e=>!(e.s>=to&&e.s<to+16)).map(e=>(e.s<to&&e.s+e.l>to)?Object.assign({},e,{l:to-e.s}):e)
      .concat(src.map(e=>Object.assign({},e,{s:e.s+16,l:Math.max(1,Math.min(e.l,from+16-e.s))})));
    evTouch(tr);
  } else for(let i=0;i<16;i++){
    tr.steps[to+i]=tr.steps[from+i];
    if(tr.notes) tr.notes[to+i]=tr.notes[from+i];
    if(tr.slides) tr.slides[to+i]=tr.slides[from+i];
  }
  currentPage++; pinIfPlaying();
  renderPageNav();
  renderAllForPage();
  hmToast(trLabel(tr)+': Seite '+currentPage+' → '+(currentPage+1)+' kopiert', true, ()=>{ const p=currentPage-1; taUndoBtn.click(); currentPage=p; renderPageNav(); renderAllForPage(); });
}
pageCopyBtn.addEventListener('click', copyCurrentPageToNext);

// ---- Spur-Aktionen: Random / Leeren für die aktive Spur, wahlweise nur die sichtbare
// Seite (16 Steps) oder das gesamte Pattern. Bei 16 Steps gibt es nur eine Seite, der
// Umschalter bleibt dann ausgeblendet (Seite == Alles). ----
const taRandBtn=document.getElementById('taRandBtn');
const taClearBtn=document.getElementById('taClearBtn');
const taUndoBtn=document.getElementById('taUndoBtn');
const taScopeEl=document.getElementById('taScope');
let taScope='page';
let taUndo=null; // ein Schritt: Snapshot der aktiven Spur (steps + notes + slides) vor der letzten Aktion
function taResetUndo(){ taUndo=null; taUndoBtn.disabled=true; }
function taSnapshot(){
  taUndo={ len:PATTERN_LENGTH, tracks:TRACKS.map(t=>({steps:t.steps.slice(), notes:t.notes?t.notes.slice():null, slides:t.slides?t.slides.slice():null, events:t.events?JSON.parse(JSON.stringify(t.events)):null, cutoff:t.cutoff, resonance:t.resonance, envMod:t.envMod, decay:t.decay, inst:Object.fromEntries((trInst(t)||{undo:[]}).undo.map(k=>[k,t[k]])), harm:t.harm?JSON.parse(JSON.stringify(t.harm)):null, harmOwn:t.harmOwn?JSON.parse(JSON.stringify(t.harmOwn)):null})),
    harmony:JSON.parse(JSON.stringify(harmony)), hmTpl };
  taUndoBtn.disabled=false;
}
function taRange(){
  return taScope==='all' || totalPages()===1 ? [0, PATTERN_LENGTH] : [currentPage*16, currentPage*16+16];
}
taRandBtn.addEventListener('click', ()=>{
  const tr=TRACKS[activeTrackIdx], [from,to]=taRange();
  if(hmOn(tr)){ taSnapshot(); tr.harm.seed=1+Math.floor(Math.random()*1e6); hmRegen(tr); refreshTrackStepVisuals(tr); hmAfterChange(); hmToast('Harmonie aktiv · Variation gewürfelt',true); return; }
  taSnapshot(tr);
  randomizeTrackPattern(tr, from, to);
  refreshTrackStepVisuals(tr);
});
taClearBtn.addEventListener('click', ()=>{
  const tr=TRACKS[activeTrackIdx], [from,to]=taRange();
  if(hmOn(tr)){ hmAskClear(tr); return; }
  taSnapshot(tr);
  if(tr.type==='arp'){ tr.events=tr.events.filter(e=>e.s<from||e.s>=to).map(e=>(e.s<from&&e.s+e.l>from)?Object.assign({},e,{l:from-e.s}):e); evTouch(tr); }
  else for(let s=from;s<to;s++) tr.steps[s]=VEL_OFF;
  refreshTrackStepVisuals(tr);
});
taUndoBtn.addEventListener('click', ()=>{
  if(!taUndo) return;
  const u=taUndo; taResetUndo();
  if(isPlaying && u.len!==PATTERN_LENGTH) stop();
  PATTERN_LENGTH=u.len; currentPage=Math.min(currentPage,totalPages()-1);
  TRACKS.forEach((tr,i)=>{ const d=u.tracks[i]; tr.steps=d.steps; if(d.events){ tr.events=d.events; delete tr.notes; delete tr.slides; tr._idx=null; } else { tr.notes=d.notes; tr.slides=d.slides; }
    if(tr.type==='arp'){ tr.harm=d.harm; if(d.harmOwn) tr.harmOwn=d.harmOwn; else delete tr.harmOwn; }
    if(tr.type==='arp' && d.cutoff!=null){ tr.cutoff=d.cutoff; tr.resonance=d.resonance; tr.envMod=d.envMod; tr.decay=d.decay; Object.assign(tr,d.inst); renderArpControls(tr); } });
  if(u.harmony){ harmony=u.harmony; hmTpl=u.hmTpl||0; }
  renderLengthChips(); renderPageNav(); renderAllForPage(); if(prIsOpen()) prRender();
});
taScopeEl.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{
  taScope=b.dataset.s;
  taScopeEl.querySelectorAll('button').forEach(x=>x.classList.toggle('on', x===b));
}));

const sampleControls=document.getElementById('sampleControls');
const scStatusRow=document.getElementById('scStatusRow');
const scBtnsRow=document.getElementById('scBtnsRow');
const scHint=document.getElementById('scHint');
const recDur=document.getElementById('recDur');
const arpControls=document.getElementById('arpControls');
const NOTE_NAMES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
