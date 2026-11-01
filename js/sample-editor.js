"use strict";
// =========================================================================
// SAMPLE-EDITOR — zentrale Stelle zum Aufnehmen/Laden/Bearbeiten von Samples.
// Ersetzt den alten schwebenden Trim-Editor (nur Startpunkt, nur ein Ziel) durch
// ein Vollbild-Overlay mit Start+Ende-Trim, Normalisieren/Rückwärts/Fade, und
// Mehrfachzuweisung an Sample-Spur und/oder beliebige Pads über die Sample-
// Bibliothek (s. IndexedDB-Abschnitt oben: saveSampleLibraryEntry() etc.).
// =========================================================================
const sampleEditorOverlay=document.getElementById('sampleEditorOverlay');
const sampleEditorCloseBtn=document.getElementById('sampleEditorCloseBtn');
const seRecordBtn=document.getElementById('seRecordBtn');
const seImportBtn=document.getElementById('seImportBtn');
const seImportInput=document.getElementById('seImportInput');
const seStatus=document.getElementById('seStatus');
const seWaveWrap=document.getElementById('seWaveWrap');
const seWaveScroll=document.getElementById('seWaveScroll');
const seWaveInner=document.getElementById('seWaveInner');
const seWaveCanvas=document.getElementById('seWaveCanvas');
const seWaveCtx=seWaveCanvas.getContext('2d');
const seDimLeft=document.getElementById('seDimLeft');
const seDimRight=document.getElementById('seDimRight');
const seHandleStartEl=document.getElementById('seHandleStart');
const seHandleEndEl=document.getElementById('seHandleEnd');
const seZoomEl=document.getElementById('seZoom');
const seZoomValEl=document.getElementById('seZoomVal');
const seFieldStart=document.getElementById('seFieldStart');
const seFieldEnd=document.getElementById('seFieldEnd');
const seNormalizeBtn=document.getElementById('seNormalizeBtn');
const seReverseBtn=document.getElementById('seReverseBtn');
const seFadeInBtn=document.getElementById('seFadeInBtn');
const seFadeOutBtn=document.getElementById('seFadeOutBtn');
const seResetBtn=document.getElementById('seResetBtn');
const seAssignTrackChip=document.getElementById('seAssignTrackChip');
const sePadGrid=document.getElementById('sePadGrid');
const sePreviewBtn=document.getElementById('sePreviewBtn');
const seSaveBtn=document.getElementById('seSaveBtn');
const seModeTrimBtn=document.getElementById('seModeTrim'), seModeLoopBtn=document.getElementById('seModeLoop');
const seCursorEl=document.getElementById('seCursor'), seLoopBand=document.getElementById('seLoopBand');
const seHandleL1El=document.getElementById('seHandleL1'), seHandleL2El=document.getElementById('seHandleL2');
const seFieldL1=document.getElementById('seFieldL1'), seFieldL2=document.getElementById('seFieldL2');
const sePlayOnceBtn=document.getElementById('sePlayOnce'), sePlayHoldBtn=document.getElementById('sePlayHold'), sePlayLoopBtn=document.getElementById('sePlayLoop'), seOverlapBtn=document.getElementById('seOverlapBtn'), sePlayHintEl=document.getElementById('sePlayHint'), seSnapBtn=document.getElementById('seSnapBtn'), seHintEl=document.getElementById('seHint');

// ---- Loop + Cursor (Loop-Punkte absolut in Sekunden im Arbeitspuffer; null = nicht gesetzt,
// dann gilt der Trim-Bereich. seLoopBuf bindet die Punkte an einen Puffer — neuer Puffer
// (Aufnahme, Import, Werkzeug, Zurücksetzen) verwirft sie automatisch.) ----
let seLoopStart=null, seLoopEnd=null, seLoopBuf=null, sePlayMode='oneshot', seOverlap=false, seEditMode='trim', seSnap=true;
let seCursorRAF=null, seCursorT0=0;
const SE_ICON_PLAY='<svg class="se-ico" viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>Vorhören', SE_ICON_STOP='<svg class="se-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/></svg>Stopp';
// ---- Undo/Redo (5 Schritte): Zustände sind nur Referenzen auf unveränderliche Puffer + Trim/Loop-Werte ----
const SE_HIST_MAX=5;
let seUndoStack=[], seRedoStack=[], seDragStartState=null, seHistLastKey=null, seHistLastTime=0;
const seUndoBtn=document.getElementById('seUndoBtn'), seRedoBtn=document.getElementById('seRedoBtn');
function seHistState(){ return {buf:seWorkingBuffer, ts:seTrimStart, te:seTrimEnd, ls:seLoopStart, le:seLoopEnd, lb:seLoopBuf}; }
function seHistSame(a,b){ return a.buf===b.buf && a.ts===b.ts && a.te===b.te && a.ls===b.ls && a.le===b.le; }
function seHistUI(){ seUndoBtn.disabled=!seUndoStack.length; seRedoBtn.disabled=!seRedoStack.length; }
function seHistPush(st, key){
  const now=performance.now();
  if(key && key===seHistLastKey && now-seHistLastTime<1500){ seHistLastTime=now; seRedoStack=[]; seHistUI(); return; } // Nudge-Serie = ein Schritt
  seHistLastKey=key||null; seHistLastTime=now;
  seUndoStack.push(st); if(seUndoStack.length>SE_HIST_MAX) seUndoStack.shift();
  seRedoStack=[]; seHistUI();
}
function seHistReset(){ seUndoStack=[]; seRedoStack=[]; seHistLastKey=null; seHistUI(); }
function seHistApply(st){
  seStopPreview();
  seWorkingBuffer=st.buf; seTrimStart=st.ts; seTrimEnd=st.te; seLoopStart=st.ls; seLoopEnd=st.le; seLoopBuf=st.lb;
  drawSEWave(); updateSETrimUI();
}
function seWithHist(fn, key){ const h=seHistState(); fn(); if(!seHistSame(h, seHistState())) seHistPush(h, key); }
seUndoBtn.addEventListener('click', ()=>{ if(!seUndoStack.length) return; seRedoStack.push(seHistState()); seHistLastKey=null; seHistApply(seUndoStack.pop()); seHistUI(); });
seRedoBtn.addEventListener('click', ()=>{ if(!seRedoStack.length) return; seUndoStack.push(seHistState()); seHistLastKey=null; seHistApply(seRedoStack.pop()); seHistUI(); });
function seLoopBounds(){
  if(!seWorkingBuffer) return [0,0];
  let a=seTrimStart, b=seTrimEnd;
  if(seLoopBuf===seWorkingBuffer && seLoopStart!=null && seLoopEnd!=null){ a=Math.max(seLoopStart,seTrimStart); b=Math.min(seLoopEnd,seTrimEnd); }
  if(b-a<0.02){ a=seTrimStart; b=seTrimEnd; }
  return [a,b];
}
function seSnapZero(t){
  if(!seSnap || !seWorkingBuffer) return t;
  const d=seWorkingBuffer.getChannelData(0), sr=seWorkingBuffer.sampleRate;
  const c=Math.round(t*sr), w=Math.round(sr*0.01);
  let best=c, bd=1e9;
  for(let i=Math.max(1,c-w); i<Math.min(d.length-1,c+w); i++){
    if((d[i-1]<=0&&d[i]>0)||(d[i-1]>=0&&d[i]<0)){ const dist=Math.abs(i-c); if(dist<bd){ bd=dist; best=i; } }
  }
  return best/sr;
}
function updateSELoopUI(){
  const w=seInnerWidth(), dur=seWorkingBuffer ? seWorkingBuffer.duration : 1;
  const [a,b]=seLoopBounds(), xa=a/dur*w, xb=b/dur*w;
  seHandleL1El.style.left=xa+'px'; seHandleL2El.style.left=xb+'px';
  seLoopBand.style.left=xa+'px'; seLoopBand.style.width=Math.max(0,xb-xa)+'px';
  if(document.activeElement!==seFieldL1) seFieldL1.value=a.toFixed(2);
  if(document.activeElement!==seFieldL2) seFieldL2.value=b.toFixed(2);
}
function seSetMode(m){
  seEditMode=m;
  sampleEditorOverlay.classList.toggle('mode-loop', m==='loop');
  seHintEl.textContent = m==='loop' ? 'Zieh L1 und L2: Dieser Teil wird wiederholt.' : 'Zieh S und E: Nur dieser Teil wird übernommen.';
  seHintEl.style.color = m==='loop' ? '#ffc247' : '#8fd4ff';
  seModeTrimBtn.classList.toggle('on', m==='trim'); seModeLoopBtn.classList.toggle('on', m==='loop');
}
function seUpdatePlayModeUI(){
  [['oneshot',sePlayOnceBtn],['hold',sePlayHoldBtn],['loop',sePlayLoopBtn]].forEach(([m,b])=>b.classList.toggle('on', sePlayMode===m));
  seOverlapBtn.classList.toggle('on', seOverlap);
  const base={oneshot:'Spielt komplett durch, Loslassen wird ignoriert.', hold:'Pads: spielt nur, solange gedrückt. Spur: wie Einmal.', loop:'Wiederholt den Loop-Bereich (Pads: solange gedrückt, Spur: bis zum nächsten Treffer).'}[sePlayMode];
  sePlayHintEl.textContent=base+(seOverlap?' Treffer überlagern sich.':' Neuer Treffer schneidet den alten ab.');
}
seModeTrimBtn.addEventListener('click', ()=>seSetMode('trim'));
seModeLoopBtn.addEventListener('click', ()=>seSetMode('loop'));
sePlayOnceBtn.addEventListener('click', ()=>{ sePlayMode='oneshot'; seUpdatePlayModeUI(); });
sePlayHoldBtn.addEventListener('click', ()=>{ sePlayMode='hold'; seUpdatePlayModeUI(); });
sePlayLoopBtn.addEventListener('click', ()=>{ sePlayMode='loop'; seUpdatePlayModeUI(); });
seOverlapBtn.addEventListener('click', ()=>{ seOverlap=!seOverlap; seUpdatePlayModeUI(); });
seSnapBtn.addEventListener('click', ()=>{ seSnap=!seSnap; seSnapBtn.classList.toggle('on', seSnap); });
function seCommitLoopField(which){
  if(!seWorkingBuffer) return;
  const v=parseFloat((which===1?seFieldL1:seFieldL2).value);
  if(isNaN(v)) { updateSETrimUI(); return; }
  const [a,b]=seLoopBounds(); seLoopBuf=seWorkingBuffer;
  if(which===1){ seLoopStart=Math.min(Math.max(seSnapZero(v),seTrimStart),b-0.02); seLoopEnd=b; }
  else { seLoopEnd=Math.max(Math.min(seSnapZero(v),seTrimEnd),a+0.02); seLoopStart=a; }
  updateSETrimUI();
}
seFieldL1.addEventListener('change', ()=>seWithHist(()=>seCommitLoopField(1)));
seFieldL2.addEventListener('change', ()=>seWithHist(()=>seCommitLoopField(2)));
function seCursorFrame(){
  if(!sePreviewSrc || !seWorkingBuffer) return;
  const dur=seWorkingBuffer.duration, [la,lb]=seLoopBounds();
  let pos=seTrimStart+(audioCtx.currentTime-seCursorT0);
  if(sePlayMode==='loop' && pos>lb && lb>la) pos=la+((pos-la)%(lb-la));
  const w=seInnerWidth(), px=Math.min(w,pos/dur*w);
  seCursorEl.style.left=px+'px'; seCursorEl.style.display='block';
  if(seZoomFactor>1 && (px<seWaveScroll.scrollLeft+20 || px>seWaveScroll.scrollLeft+seWaveScroll.clientWidth-20))
    seWaveScroll.scrollLeft=Math.max(0, px-seWaveScroll.clientWidth/2);
  seCursorRAF=requestAnimationFrame(seCursorFrame);
}
function seStopPreview(){
  if(sePreviewSrc){ const s0=sePreviewSrc; sePreviewSrc=null; try{ s0.stop(); }catch(e){} }
  cancelAnimationFrame(seCursorRAF); seCursorRAF=null;
  seCursorEl.style.display='none'; sePreviewBtn.innerHTML=SE_ICON_PLAY;
}

let seEditingId=null;        // id des bearbeiteten Bibliothekseintrags, oder null = neues Sample
let seOriginalBuffer=null;   // unveränderte Fassung, für "Zurücksetzen"
let seWorkingBuffer=null;    // aktuelle Arbeitskopie, auf die Tools angewendet werden
let seTrimStart=0, seTrimEnd=0;
let seZoomFactor=1; // 1..8 — horizontaler Zoom der Wellenform, echte Breite (nicht nur optisch)
let seAssignTrack=false, seAssignPads=new Set();
let seIsRecording=false, seRecStartTime=0, seRecTimerId=null;
let seMicSourceNode=null, seMicRecorderNode=null, seMicSilentGain=null;
let seMediaRecorder=null, seMediaChunks=[], seRecChunksFloat=[];
let sePreviewSrc=null;

// ---- Bearbeitungs-Werkzeuge: jedes erzeugt einen NEUEN AudioBuffer statt den
// bestehenden zu mutieren (Web-Audio-Konvention, hält seOriginalBuffer unangetastet). ----
function bufferReverse(buf){
  const out=audioCtx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for(let c=0;c<buf.numberOfChannels;c++){
    const src=buf.getChannelData(c), dst=out.getChannelData(c);
    for(let i=0;i<buf.length;i++) dst[i]=src[buf.length-1-i];
  }
  return out;
}
function bufferNormalize(buf){
  let peak=0;
  for(let c=0;c<buf.numberOfChannels;c++){ const d=buf.getChannelData(c); for(let i=0;i<d.length;i++){ const a=Math.abs(d[i]); if(a>peak) peak=a; } }
  if(peak<0.0001) return buf; // Stille — nichts zu normalisieren
  const gain=0.98/peak;
  const out=audioCtx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for(let c=0;c<buf.numberOfChannels;c++){
    const src=buf.getChannelData(c), dst=out.getChannelData(c);
    for(let i=0;i<src.length;i++) dst[i]=src[i]*gain;
  }
  return out;
}
// Vereinfachung, bewusst so belassen: Fade wirkt auf eine feste Dauer (150ms) am Anfang/Ende
// des GESAMTEN aktuellen Puffers, nicht nur auf den per Start/Ende markierten Ausschnitt —
// deckt den praktisch relevanten Fall ab (aufnehmen/laden, faden, danach zurechttrimmen).
// Ein Fade exakt auf den Trim-Ausschnitt wäre ein sinnvoller nächster Ausbauschritt.
function bufferFade(buf, direction){
  const out=audioCtx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  const fadeLen=Math.min(buf.length, Math.round(buf.sampleRate*0.15));
  for(let c=0;c<buf.numberOfChannels;c++){
    const src=buf.getChannelData(c), dst=out.getChannelData(c);
    dst.set(src);
    for(let i=0;i<fadeLen;i++){
      const t=i/fadeLen;
      const idx = direction==='in' ? i : (buf.length-1-i);
      dst[idx]*=t;
    }
  }
  return out;
}
function bufferSlice(buf, startSec, endSec){
  const sr=buf.sampleRate;
  const startFrame=Math.max(0, Math.floor(startSec*sr));
  const endFrame=Math.min(buf.length, Math.ceil(endSec*sr));
  const len=Math.max(1, endFrame-startFrame);
  const out=audioCtx.createBuffer(buf.numberOfChannels, len, sr);
  for(let c=0;c<buf.numberOfChannels;c++){
    out.getChannelData(c).set(buf.getChannelData(c).subarray(startFrame, startFrame+len));
  }
  return out;
}
function seApplyTransform(fn){
  if(!seWorkingBuffer) return;
  seHistPush(seHistState());
  seWorkingBuffer=fn(seWorkingBuffer);
  seTrimStart=0; seTrimEnd=seWorkingBuffer.duration; // Auswahl nach jeder Bearbeitung zurückgesetzt (volle Länge)
  seSetZoom(1); // Bearbeitung ändert oft die Länge/Struktur — Ansicht wieder auf volle Breite
  drawSEWave(); updateSETrimUI();
}
seNormalizeBtn.addEventListener('click', ()=> seApplyTransform(bufferNormalize));
seReverseBtn.addEventListener('click', ()=> seApplyTransform(bufferReverse));
seFadeInBtn.addEventListener('click', ()=> seApplyTransform(b=>bufferFade(b,'in')));
seFadeOutBtn.addEventListener('click', ()=> seApplyTransform(b=>bufferFade(b,'out')));
seResetBtn.addEventListener('click', ()=>{
  if(!seOriginalBuffer) return;
  seHistPush(seHistState());
  seWorkingBuffer=seOriginalBuffer;
  seTrimStart=0; seTrimEnd=seOriginalBuffer.duration;
  seSetZoom(1);
  drawSEWave(); updateSETrimUI();
});

// ---- Wellenform + zwei Trim-Handles (Start UND Ende) mit echtem horizontalem Zoom ----
// seWaveInner ist bei Zoom > 1 breiter als der sichtbare Ausschnitt (seWaveWrap) und liegt
// in einem nativ scrollbaren Container (seWaveScroll) — Handles/Dim-Overlays/Canvas leben
// alle IN seWaveInner, ihre Pixelposition ist also unabhängig vom aktuellen Scroll-Offset
// (getBoundingClientRect() von seWaveInner liefert die tatsächliche, bereits verschobene
// Position). Das ersetzt die vorherige "Zoom", der nur das Wellenform-Muster optisch
// verzerrt hat, ohne echten Ausschnitt/Scroll-Anker — dadurch wirkte er beim Ziehen des
// Reglers, als würde die Ansicht "springen".
function seInnerWidth(){ return Math.max(seWaveWrap.clientWidth, seWaveWrap.clientWidth*seZoomFactor); }
function seSetZoom(z, anchorTime){
  const dur=seWorkingBuffer ? seWorkingBuffer.duration : 1;
  // Ankerpunkt: die Zeitposition in der Mitte des aktuell sichtbaren Ausschnitts bleibt
  // beim Zoomen optisch an derselben Stelle stehen, statt dass die Ansicht auf den Anfang
  // zurückspringt oder sich unvorhersehbar verschiebt.
  if(anchorTime==null){
    const oldW=seWaveInner.clientWidth || seWaveWrap.clientWidth;
    const centerX=seWaveScroll.scrollLeft + seWaveScroll.clientWidth/2;
    anchorTime=(centerX/oldW)*dur;
  }
  seZoomFactor=Math.min(8, Math.max(1, z));
  seZoomEl.value=seZoomFactor;
  seZoomValEl.textContent=seZoomFactor.toFixed(1)+'×';
  drawSEWave();
  updateSETrimUI();
  const newW=seInnerWidth();
  const newCenterX=(anchorTime/dur)*newW;
  seWaveScroll.scrollLeft=Math.max(0, newCenterX - seWaveScroll.clientWidth/2);
}
seZoomEl.addEventListener('input', ()=> seSetZoom(parseFloat(seZoomEl.value)));

function drawSEWave(){
  const w=seInnerWidth(), h=seWaveWrap.clientHeight;
  seWaveInner.style.width=w+'px';
  seWaveCanvas.width=w*devicePixelRatio; seWaveCanvas.height=h*devicePixelRatio;
  seWaveCanvas.style.width=w+'px'; seWaveCanvas.style.height=h+'px';
  seWaveCtx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
  seWaveCtx.clearRect(0,0,w,h);
  if(!seWorkingBuffer) return;
  const data=seWorkingBuffer.getChannelData(0);
  const step=Math.max(1, Math.floor(data.length/w));
  seWaveCtx.strokeStyle='#3fa9ff'; seWaveCtx.lineWidth=1; seWaveCtx.beginPath();
  const mid=h/2;
  for(let x=0;x<w;x++){
    let min=1,max=-1; const start=x*step;
    for(let i=0;i<step;i++){ const s=data[start+i]; if(s===undefined) break; if(s<min)min=s; if(s>max)max=s; }
    seWaveCtx.moveTo(x, mid+min*mid*0.9); seWaveCtx.lineTo(x, mid+max*mid*0.9);
  }
  seWaveCtx.stroke();
}
function updateSETrimUI(){
  const w=seInnerWidth();
  const dur=seWorkingBuffer ? seWorkingBuffer.duration : 1;
  const xs=Math.min(w,(seTrimStart/dur)*w), xe=Math.min(w,(seTrimEnd/dur)*w);
  seHandleStartEl.style.left=xs+'px'; seHandleEndEl.style.left=xe+'px';
  seDimLeft.style.left='0px'; seDimLeft.style.width=xs+'px';
  seDimRight.style.left=xe+'px'; seDimRight.style.width=(w-xe)+'px';
  // Zahlenfelder nur aktualisieren, wenn sie nicht gerade fokussiert/editiert werden —
  // sonst würde ein Tipp-Vorgang durch das Drag-Update wieder überschrieben.
  if(document.activeElement!==seFieldStart) seFieldStart.value=seTrimStart.toFixed(2);
  if(document.activeElement!==seFieldEnd) seFieldEnd.value=seTrimEnd.toFixed(2);
  updateSELoopUI();
}
let seDragHandle=null; // 'start' | 'end' | null
function seSetHandleFromX(clientX){
  const rect=seWaveInner.getBoundingClientRect();
  const x=Math.min(rect.width, Math.max(0, clientX-rect.left));
  const dur=seWorkingBuffer ? seWorkingBuffer.duration : 1;
  const t=(x/rect.width)*dur;
  if(seDragHandle==='start') seTrimStart=Math.min(t, seTrimEnd-0.02);
  else if(seDragHandle==='end') seTrimEnd=Math.max(t, seTrimStart+0.02);
  else if(seDragHandle==='l1' || seDragHandle==='l2'){
    const [a,b]=seLoopBounds(), sn=seSnapZero(t); seLoopBuf=seWorkingBuffer;
    if(seDragHandle==='l1'){ seLoopStart=Math.min(Math.max(sn,seTrimStart),b-0.02); seLoopEnd=b; }
    else { seLoopEnd=Math.max(Math.min(sn,seTrimEnd),a+0.02); seLoopStart=a; }
  }
  updateSETrimUI();
}
// Grabzone ist per CSS auf 32px verbreitert (vorher 14px); zusätzlich hält
// setPointerCapture den Handle auch dann fest, wenn der Finger beim schnellen Ziehen kurz
// die Element-Fläche verlässt — beides zusammen war die Hauptursache für "schlecht greifbar".
function seHandleDown(which, el){ return (e)=>{
  seDragHandle=which; seDragStartState=seHistState();
  el.classList.add('dragging');
  if(e.pointerId!=null && el.setPointerCapture){ try{ el.setPointerCapture(e.pointerId); }catch(err){} }
  seSetHandleFromX(e.touches?e.touches[0].clientX:e.clientX);
  e.preventDefault();
}; }
function seHandleMove(e){ if(!seDragHandle) return; seSetHandleFromX(e.touches?e.touches[0].clientX:e.clientX); e.preventDefault&&e.preventDefault(); }
function seHandleUp(){ [seHandleStartEl,seHandleEndEl,seHandleL1El,seHandleL2El].forEach(el=>el.classList.remove('dragging'));
  if(seDragHandle && seDragStartState && !seHistSame(seDragStartState, seHistState())) seHistPush(seDragStartState);
  seDragStartState=null; seDragHandle=null; }
seHandleStartEl.addEventListener('pointerdown', seHandleDown('start', seHandleStartEl));
seHandleEndEl.addEventListener('pointerdown', seHandleDown('end', seHandleEndEl));
window.addEventListener('pointermove', seHandleMove);
window.addEventListener('pointerup', seHandleUp);
seHandleStartEl.addEventListener('touchstart', seHandleDown('start', seHandleStartEl), {passive:false});
seHandleEndEl.addEventListener('touchstart', seHandleDown('end', seHandleEndEl), {passive:false});
window.addEventListener('touchmove', seHandleMove, {passive:false});
window.addEventListener('touchend', seHandleUp);

seHandleL1El.addEventListener('pointerdown', seHandleDown('l1', seHandleL1El));
seHandleL2El.addEventListener('pointerdown', seHandleDown('l2', seHandleL2El));
seHandleL1El.addEventListener('touchstart', seHandleDown('l1', seHandleL1El), {passive:false});
seHandleL2El.addEventListener('touchstart', seHandleDown('l2', seHandleL2El), {passive:false});
// ---- Zahlenfelder (exakte Eingabe) + Nudge ±10ms — Alternative zum Ziehen, wenn das zu
// ungenau ist. Feld-Änderung übernimmt sofort, geklammert an Puffergrenzen/Mindestabstand.
function seCommitFieldStart(){
  const dur=seWorkingBuffer ? seWorkingBuffer.duration : 0;
  seTrimStart=Math.min(Math.max(0, parseFloat(seFieldStart.value)||0), seTrimEnd-0.02);
  updateSETrimUI();
}
function seCommitFieldEnd(){
  const dur=seWorkingBuffer ? seWorkingBuffer.duration : 0;
  seTrimEnd=Math.max(Math.min(dur, parseFloat(seFieldEnd.value)||dur), seTrimStart+0.02);
  updateSETrimUI();
}
seFieldStart.addEventListener('change', ()=>seWithHist(seCommitFieldStart));
seFieldEnd.addEventListener('change', ()=>seWithHist(seCommitFieldEnd));
document.querySelectorAll('.se-nudge').forEach(b=>b.addEventListener('click', ()=>{
  if(!seWorkingBuffer) return;
  const h0=seHistState();
  const dur=seWorkingBuffer.duration, d=parseInt(b.dataset.d,10)*0.01; // 10ms-Schritt
  if(b.dataset.t==='start') seTrimStart=Math.min(Math.max(0, seTrimStart+d), seTrimEnd-0.02);
  else seTrimEnd=Math.max(Math.min(dur, seTrimEnd+d), seTrimStart+0.02);
  updateSETrimUI();
  if(!seHistSame(h0, seHistState())) seHistPush(h0, 'nudge-'+b.dataset.t);
}));

// ---- Aufnahme (identisches Worklet/MediaRecorder-Muster wie zuvor bei der Spur, jetzt
// zentral hier) ----
async function seStartRecording(){
  try{
    await Promise.resolve(initAudio());
    if(audioCtx.state!=='running') await audioCtx.resume();
    await ensureMicStream();
  }catch(err){
    console.warn('Mikrofonzugriff (Sample-Editor) fehlgeschlagen:', err);
    seStatus.textContent=micErrorMessage(err); seStatus.classList.add('err');
    return;
  }
  seIsRecording=true;
  seRecStartTime=audioCtx.currentTime;
  seRecordBtn.textContent='■ Stop'; seRecordBtn.classList.add('recording');
  seStatus.classList.remove('err');
  seRecTimerId=setInterval(()=>{
    const el=audioCtx.currentTime-seRecStartTime;
    seStatus.textContent='Aufnahme läuft… '+el.toFixed(1)+'s';
    if(el>=MAX_REC_SECONDS) seStopRecording();
  }, 100);
  seMicSourceNode=audioCtx.createMediaStreamSource(micStream);
  if(useMicWorklet){
    seRecChunksFloat=[];
    seMicRecorderNode=new AudioWorkletNode(audioCtx,'mic-recorder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
    seMicRecorderNode.port.onmessage=(e)=>{ seRecChunksFloat.push(e.data); };
    seMicSilentGain=audioCtx.createGain(); seMicSilentGain.gain.value=0;
    seMicSourceNode.connect(seMicRecorderNode).connect(seMicSilentGain).connect(audioCtx.destination);
  } else {
    seMediaChunks=[];
    seMediaRecorder=new MediaRecorder(micStream);
    seMediaRecorder.ondataavailable=(e)=>{ if(e.data.size>0) seMediaChunks.push(e.data); };
    seMediaRecorder.start();
  }
}
async function seStopRecording(){
  if(!seIsRecording) return;
  seIsRecording=false;
  clearInterval(seRecTimerId);
  seRecordBtn.textContent='● Aufnehmen'; seRecordBtn.classList.remove('recording');
  if(useMicWorklet){
    seMicSourceNode.disconnect(); seMicRecorderNode.disconnect(); seMicSilentGain.disconnect();
    const totalLen=seRecChunksFloat.reduce((s,c)=>s+c.length,0);
    if(totalLen===0) return;
    const data=new Float32Array(totalLen);
    let off=0; for(const c of seRecChunksFloat){ data.set(c,off); off+=c.length; }
    const buf=audioCtx.createBuffer(1,totalLen,audioCtx.sampleRate);
    buf.copyToChannel(data,0);
    seOriginalBuffer=buf; seWorkingBuffer=buf; seTrimStart=0; seTrimEnd=buf.duration;
    seStatus.textContent='Aufgenommen — '+buf.duration.toFixed(1)+'s';
    seHistReset(); seSetZoom(1, 0);
  } else {
    await new Promise(resolve=>{ seMediaRecorder.onstop=resolve; seMediaRecorder.stop(); });
    seMicSourceNode.disconnect();
    const blob=new Blob(seMediaChunks,{type:seMediaChunks[0]?.type||'audio/webm'});
    const arr=await blob.arrayBuffer();
    try{
      const buf=await audioCtx.decodeAudioData(arr);
      seOriginalBuffer=buf; seWorkingBuffer=buf; seTrimStart=0; seTrimEnd=buf.duration;
      seStatus.textContent='Aufgenommen — '+buf.duration.toFixed(1)+'s';
      seHistReset(); seSetZoom(1, 0);
    }catch(err){
      console.warn('Sample konnte nicht dekodiert werden:', err);
      seStatus.textContent='Fehler beim Dekodieren'; seStatus.classList.add('err');
    }
  }
}
seRecordBtn.addEventListener('click', ()=> seIsRecording ? seStopRecording() : seStartRecording());

// ---- Datei-Import (neu — gab es im alten Trim-Editor nicht) ----
seImportBtn.addEventListener('click', ()=> seImportInput.click());
seImportInput.addEventListener('change', async (e)=>{
  const file=e.target.files[0]; seImportInput.value='';
  if(!file) return;
  try{
    await Promise.resolve(initAudio());
    const arr=await file.arrayBuffer();
    const buf=await audioCtx.decodeAudioData(arr);
    seOriginalBuffer=buf; seWorkingBuffer=buf; seTrimStart=0; seTrimEnd=buf.duration;
    seStatus.textContent=file.name+' geladen — '+buf.duration.toFixed(1)+'s';
    seStatus.classList.remove('err');
    seHistReset(); seSetZoom(1, 0);
  }catch(err){
    console.warn('Datei konnte nicht geladen werden:', err);
    seStatus.textContent='Datei konnte nicht gelesen werden — Format unterstützt?';
    seStatus.classList.add('err');
  }
});

// ---- Zuweisung: Sample-Spur (ein Chip) + beliebige Pads (Mehrfachauswahl-Grid) ----
const sePadChips=[];
for(let i=0;i<PAD_COUNT;i++){
  const chip=document.createElement('div'); chip.className='se-pad-chip'; chip.textContent=i+1;
  chip.addEventListener('click', ()=>{
    if(seAssignPads.has(i)) seAssignPads.delete(i); else seAssignPads.add(i);
    chip.classList.toggle('on', seAssignPads.has(i));
  });
  sePadGrid.appendChild(chip); sePadChips.push(chip);
}
seAssignTrackChip.addEventListener('click', ()=>{
  seAssignTrack=!seAssignTrack;
  seAssignTrackChip.classList.toggle('on', seAssignTrack);
});
function renderSEAssignUI(){
  seAssignTrackChip.classList.toggle('on', seAssignTrack);
  sePadChips.forEach((chip,i)=> chip.classList.toggle('on', seAssignPads.has(i)));
}

// ---- Vorhören: spielt exakt den aktuell markierten Start/Ende-Ausschnitt ----
sePreviewBtn.addEventListener('click', ()=>{
  if(sePreviewSrc){ seStopPreview(); return; }
  if(!seWorkingBuffer || !audioCtx) return;
  const src=audioCtx.createBufferSource(); src.buffer=seWorkingBuffer; src.connect(master);
  const [la,lb]=seLoopBounds(), t0=audioCtx.currentTime;
  if(sePlayMode==='loop'){ src.loop=true; src.loopStart=la; src.loopEnd=lb; src.start(t0, seTrimStart); }
  else src.start(t0, seTrimStart, Math.max(0.02, seTrimEnd-seTrimStart));
  seCursorT0=t0;
  src.onended=()=>{ if(sePreviewSrc===src) seStopPreview(); };
  sePreviewSrc=src; sePreviewBtn.innerHTML=SE_ICON_STOP;
  seCursorRAF=requestAnimationFrame(seCursorFrame);
});

function deriveSampleName(){
  if(seAssignTrack) return 'Sample-Spur';
  const firstPad=[...seAssignPads][0];
  if(firstPad!=null) return 'Pad '+(firstPad+1);
  return 'Sample '+new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
}
// ---- Übernehmen: schneidet final auf Start/Ende zu, speichert in der Bibliothek und
// gleicht die Zuweisungen ab (neu hinzugekommene UND entfernte, s. u.) ----
seSaveBtn.addEventListener('click', async ()=>{
  if(!seWorkingBuffer){ seStatus.textContent='Kein Sample zum Übernehmen'; seStatus.classList.add('err'); return; }
  const finalBuffer=bufferSlice(seWorkingBuffer, seTrimStart, seTrimEnd);
  const blob=audioBufferToWavBlob(finalBuffer);
  const entryId=seEditingId || genId();
  const hasLoop=seLoopBuf===seWorkingBuffer && seLoopStart!=null && seLoopEnd!=null;
  const [la,lb]=seLoopBounds();
  const entry={id:entryId, name:deriveSampleName(), blob, offsetStart:0, offsetEnd:null, savedAt:Date.now(),
    playMode:sePlayMode, overlap:seOverlap, loopStart:hasLoop ? la-seTrimStart : null, loopEnd:hasLoop ? lb-seTrimStart : null};
  await saveSampleLibraryEntry(entry);

  if(seAssignTrack) await applySampleToTrack(entry);
  else if(sampleTrackSampleId===entryId){
    sampleBuffer=null; sampleStartOffset=0; sampleTrackSampleId=null;
    try{ localStorage.removeItem('mrm44_sampleTrackId'); }catch(e){}
    updateRecStatus();
  }
  for(let i=0;i<PAD_COUNT;i++){
    if(seAssignPads.has(i)) await applySampleToPad(i, entry);
    else if(padSampleId[i]===entryId){
      padSamples[i].buffer=null; padSamples[i].offset=0; padSampleId[i]=null;
      try{
        const ids=JSON.parse(localStorage.getItem('mrm44_padSampleIds')||'[]');
        ids[i]=null; localStorage.setItem('mrm44_padSampleIds', JSON.stringify(ids));
      }catch(e){}
      updatePadUI(i);
    }
  }
  closeSampleEditor();
});

// ---- Öffnen/Schließen — öffnet mit dem übergebenen Bibliothekseintrag (oder leer für ein
// neues Sample) und erkennt bestehende Zuweisungen automatisch (Spur/Pads, die diesen
// Eintrag bereits nutzen, sind beim Öffnen schon als Chip markiert). ----
async function openSampleEditor({sampleId=null, forTrack=false, forPad=null}={}){
  closeAllOverlays();
  seEditingId=sampleId;
  if(sampleId){
    const entry=await loadSampleLibraryEntry(sampleId);
    if(entry){
      await Promise.resolve(initAudio());
      const arr=await entry.blob.arrayBuffer();
      seOriginalBuffer=await audioCtx.decodeAudioData(arr);
      seWorkingBuffer=seOriginalBuffer;
      seTrimStart=0; seTrimEnd=seOriginalBuffer.duration;
      sePlayMode=entry.playMode||'oneshot'; seOverlap=!!entry.overlap;
      if(entry.loopStart!=null && entry.loopEnd!=null){ seLoopStart=entry.loopStart; seLoopEnd=entry.loopEnd; seLoopBuf=seWorkingBuffer; } else { seLoopStart=seLoopEnd=null; seLoopBuf=null; }
      // Migrations-Altlast: alte Einträge tragen ihren Start-Offset noch separat statt
      // bereits "eingebrannt" — beim ersten erneuten Übernehmen wird das bereinigt.
      if(entry.offsetStart) seTrimStart=Math.min(entry.offsetStart, seTrimEnd-0.02);
      seStatus.textContent=(entry.name||'Sample')+' geladen — '+seOriginalBuffer.duration.toFixed(1)+'s';
      seStatus.classList.remove('err');
    }
  } else {
    seOriginalBuffer=null; seWorkingBuffer=null; seTrimStart=0; seTrimEnd=0;
    seLoopStart=seLoopEnd=null; seLoopBuf=null; sePlayMode='oneshot'; seOverlap=false;
    seStatus.textContent='Kein Sample geladen — aufnehmen oder Datei laden';
    seStatus.classList.remove('err');
  }
  seAssignTrack = forTrack || (sampleId!=null && sampleId===sampleTrackSampleId);
  seAssignPads = new Set(sampleId!=null ? padSampleId.map((id,idx)=> id===sampleId ? idx : null).filter(x=>x!=null) : []);
  if(forPad!=null) seAssignPads.add(forPad);
  renderSEAssignUI();
  sampleEditorOverlay.classList.add('open');
  seSetMode('trim'); seUpdatePlayModeUI(); seHistReset();
  syncBottomBarVisibility();
  seZoomFactor=1; seZoomEl.value=1; seZoomValEl.textContent='1.0×';
  requestAnimationFrame(()=>{ seWaveScroll.scrollLeft=0; drawSEWave(); updateSETrimUI(); });
}
function closeSampleEditor(){
  if(seIsRecording) seStopRecording();
  seStopPreview();
  sampleEditorOverlay.classList.remove('open');
  syncBottomBarVisibility();
}
sampleEditorCloseBtn.addEventListener('click', closeSampleEditor);
