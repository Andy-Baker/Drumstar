"use strict";
// =========================================================================
// BEATS PRO SPURTYP (Drums / Perc / Acid / Sample) — Store "beats". Ein Beat = Muster einer Gruppe (Steps, bei Acid Noten + Slides, Länge)
// plus Klang der Gruppe (Mixer-Werte, Acid-Filter/Skala, Sample-Verweis). Laden: nur Muster (▶) oder Muster + Klang (🔊) ins Arbeits-Pattern.
// Das Kit ist global und wird nicht umgeschaltet (kitId nur gemerkt, für spätere Drum-Sets).
// =========================================================================
let beatTab='all';
async function beatPut(d){ const db=await idbOpen(); db.transaction(IDB_BEATS,'readwrite').objectStore(IDB_BEATS).put(d, d.id); }
async function beatDelete(id){ const db=await idbOpen(); db.transaction(IDB_BEATS,'readwrite').objectStore(IDB_BEATS).delete(id); }
async function beatAll(){
  const db=await idbOpen(), out=[];
  await new Promise((res,rej)=>{ const q=db.transaction(IDB_BEATS,'readonly').objectStore(IDB_BEATS).openCursor(); q.onsuccess=e=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(); }; q.onerror=()=>rej(q.error); });
  return out.sort((a,b)=>b.savedAt-a.savedAt);
}
function beatTrackData(tr){
  return { id:tr.id, steps:tr.steps.slice(), events:tr.events?JSON.parse(JSON.stringify(tr.events)):undefined, notes:tr.notes?tr.notes.slice():undefined, slides:tr.slides?tr.slides.slice():undefined,
    vol:tr.vol, tune:tr.tune, pan:tr.pan||0, eqLowGain:tr.eqLowGain||0, eqMidGain:tr.eqMidGain||0, eqHighGain:tr.eqHighGain||0,
    eqOn:tr.eqOn!==false, eqLc:tr.eqLc||0, eqMf:tr.eqMf!=null?tr.eqMf:EQ_MF_DEF, fx:fxSave(tr.fx),
    reverbAmount:tr.reverbAmount||0, delaySend:tr.delaySend||0, feel:tr.feel||0,
    accentAmt:tr.accentAmt, rootNote:tr.rootNote, cutoff:tr.cutoff, resonance:tr.resonance, envMod:tr.envMod, decay:tr.decay, scale:tr.scale,
    cosmicWidth:tr.cosmicWidth, cosmicMotion:tr.cosmicMotion, cosmicWarmth:tr.cosmicWarmth, cosmicAir:tr.cosmicAir, sound:tr.sound, tremolo:tr.tremolo };
}
function beatCollect(gid, name){
  const d={ id:genId(), kind:'beat', group:gid, name, savedAt:Date.now(), length:PATTERN_LENGTH, kitId:currentKitId, tracks:arrGroupTracks(gid).map(beatTrackData) };
  if(gid==='acid') d.acidAuto={shape:autoShape, bars:autoBars, depth:autoDepth};
  if(gid==='sample') d.sampleId=sampleTrackSampleId;
  return d;
}
function applyTrackSound(tr, sv){
  if(sv.vol!=null) tr.vol=sv.vol; if(sv.tune!=null) tr.tune=sv.tune;
  tr.reverbAmount=sv.reverbAmount||0; tr.pan=sv.pan||0; tr.feel=sv.feel||0; tr.delaySend=sv.delaySend||0;
  tr.eqLowGain=sv.eqLowGain||0; tr.eqMidGain=sv.eqMidGain||0; tr.eqHighGain=sv.eqHighGain||0;
  fxLoadTrack(tr,sv);
  if(tr.sendGain) tr.sendGain.gain.value=tr.reverbAmount; if(tr.delaySendGain) tr.delaySendGain.gain.value=tr.delaySend; if(tr.panner) tr.panner.pan.value=tr.pan;
  if(tr._mixFaderEl){ tr._mixFaderEl.value=tr.vol; if(tr._mixMeter) tr._mixMeter.dbReadout.textContent=dbLabel(tr.vol)+'dB'; }
  if(tr._mixPanKnob) tr._mixPanKnob.setValue(tr.pan);
  if(tr._mixEqKnobs){ ['eqLowGain','eqMidGain','eqHighGain'].forEach(k=>{ if(tr._mixEqKnobs[k]) tr._mixEqKnobs[k].setValue(tr[k]); }); }
  if(tr.type==='arp'){
    tr.rootNote=sv.rootNote!=null?sv.rootNote:0; tr.cutoff=sv.cutoff!=null?sv.cutoff:0.5; tr.resonance=sv.resonance!=null?sv.resonance:0.35;
    tr.envMod=sv.envMod!=null?sv.envMod:0.5; tr.decay=sv.decay!=null?sv.decay:0.26; tr.scale=SCALES[sv.scale]?sv.scale:'minor'; tr.accentAmt=sv.accentAmt!=null?sv.accentAmt:0.5;
  }
  if(tr.id==='piano'){ tr.sound=KEY_SOUNDS[sv.sound]?sv.sound:'piano'; tr.tremolo=sv.tremolo!=null?sv.tremolo:0; }
  if(tr.id==='cosmic'){ tr.cosmicWidth=sv.cosmicWidth!=null?sv.cosmicWidth:0.62; tr.cosmicMotion=sv.cosmicMotion!=null?sv.cosmicMotion:0.46; tr.cosmicWarmth=sv.cosmicWarmth!=null?sv.cosmicWarmth:0.22; tr.cosmicAir=sv.cosmicAir!=null?sv.cosmicAir:0.18; }
}
async function beatApply(d, withSound){
  if(isPlaying) stop();
  if(d.length>PATTERN_LENGTH) setPatternLength(d.length); // nur erweitern, nie kürzen
  arrGroupTracks(d.group).forEach(tr=>{ // Spuren der Gruppe, die der Beat noch nicht kannte (z. B. Ride vor v72): leer
    if(tr.type!=='arp' && !d.tracks.some(sv=>sv.id===tr.id)){ tr.steps.fill(VEL_OFF); if(tr.notes) tr.notes.fill(0); }
  });
  d.tracks.forEach(sv=>{
    const tr=TRACKS.find(t=>t.id===sv.id); if(!tr) return;
    tr.steps=migrateStepsToVelocity(sv.steps, tr.id, undefined, PATTERN_LENGTH);
    if(tr.type!=='arp') tr.notes=artLoad(tr, sv.notes);
    if(tr.type==='arp'){
      hmReset(tr);
      tr.events=evLoad(sv,tr); delete tr.notes; delete tr.slides; evTouch(tr);
      tr.rootNote=sv.rootNote!=null?sv.rootNote:tr.rootNote; tr.scale=SCALES[sv.scale]?sv.scale:(tr.scale||'minor'); // Noten sind relativ zu Grundton/Skala -> immer mit
    }
    if(withSound) applyTrackSound(tr, sv);
  });
  if(withSound && d.acidAuto){ autoShape=d.acidAuto.shape||'off'; autoBars=d.acidAuto.bars||4; autoDepth=d.acidAuto.depth!=null?d.acidAuto.depth:0.6; syncAutoUI(); }
  if(withSound && d.sampleId){ try{ const e=await loadSampleLibraryEntry(d.sampleId); if(e) await applySampleToTrack(e); }catch(err){ console.warn('Sample zum Beat nicht gefunden', err); } }
  selectTrack(activeTrackIdx); renderAllForPage(); ovRender();
}
async function beatSaveGroup(typed){
  const names=new Set((await beatAll()).filter(b=>b.group===beatTab).map(b=>b.name)), name=uniqueName(typed,names);
  await beatPut(beatCollect(beatTab,name)); patternNameInput.value=''; beatRenderGroupList();
  showPatternIOStatus(name!==typed ? 'Name vergeben — gespeichert als „'+name+'“' : '„'+name+'“ gespeichert');
}
async function beatRenderGroupList(){
  const items=(await beatAll()).filter(b=>b.group===beatTab); patternList.innerHTML='';
  if(!items.length){ const e=document.createElement('div'); e.id='patternEmpty'; e.textContent='Noch keine Beats für diesen Spurtyp'; patternList.appendChild(e); return; }
  items.forEach(it=>{
    const row=document.createElement('div'); row.className='pattern-row';
    const meta=document.createElement('div'); meta.className='prow-meta';
    const n=document.createElement('div'); n.className='pname'; n.textContent=it.name;
    const dt=document.createElement('div'); dt.className='pdate'; dt.textContent=(it.length||16)+' Steps · '+new Date(it.savedAt).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    meta.appendChild(n); meta.appendChild(dt); row.appendChild(meta);
    const mk=(html,title,cls,fn)=>{ const b=document.createElement('button'); b.className=cls; b.innerHTML=html; b.title=title; b.addEventListener('click',fn); return b; };
    const ld=mk(UI_IC.play,'Muster laden','prow-btn pload', async()=>{ await beatApply(it,false); patternsOverlay.classList.remove('open'); syncBottomBarVisibility(); });
    prowFinish(row, ld, [
      mk(UI_IC.snd+'Mit Klang laden','Muster + Klang laden','act sec', async()=>{ await beatApply(it,true); patternsOverlay.classList.remove('open'); syncBottomBarVisibility(); }),
      mk(UI_IC.del+'Löschen','Löschen','act sec prow-del', async()=>{ await beatDelete(it.id); beatRenderGroupList(); }) ]);
    patternList.appendChild(row);
  });
}
// Alte Gesamt-Beats in Beats pro Spurtyp zerlegen (nur Gruppen mit mindestens einem aktiven Step)
async function beatSplitLegacy(item){
  const data=await loadPatternFromIndexedDB(item.id) || item;
  const all=await beatAll(); let made=0;
  for(const g of ARR_GROUPS){
    const saved=data.tracks.filter(s=>g.ids.indexOf(s.id)>=0); if(!saved.length) continue;
    const len=data.patternLength||16;
    const tracks=saved.map(sv=>Object.assign({}, sv, { steps:migrateStepsToVelocity(sv.steps, sv.id, data.accentSteps, len) }));
    if(!tracks.some(t=>t.steps.some(v=>v>0))) continue;
    const names=new Set(all.filter(b=>b.group===g.id).map(b=>b.name));
    const name=uniqueName(item.name+' · '+g.label, names); names.add(name);
    const d={ id:genId(), kind:'beat', group:g.id, name, savedAt:Date.now(), length:len, kitId:data.kitId, tracks };
    if(g.id==='acid' && data.acidAuto) d.acidAuto=data.acidAuto;
    await beatPut(d); all.push(d); made++;
  }
  showPatternIOStatus(made ? '„'+item.name+'“ aufgeteilt in '+made+' Beat'+(made===1?'':'s')+' (Reiter Drums, Perc, Acid, Sample)' : 'Nichts zum Aufteilen gefunden', !made);
}
document.querySelectorAll('#beatTabs button').forEach(b=>b.addEventListener('click', ()=>{
  beatTab=b.dataset.t;
  document.querySelectorAll('#beatTabs button').forEach(x=>x.classList.toggle('on', x===b));
  patternsOverlay.classList.toggle('grp', beatTab!=='all');
  const g=ARR_GROUPS.find(x=>x.id===beatTab);
  patternNameInput.placeholder = g ? 'Name für aktuellen '+g.label+'-Beat…' : 'Name für aktuellen Beat…';
  refreshPatternList();
}));

// =========================================================================
// KIT-MENÜ + DRUM-SET-EDITOR — Standard-Kits und eigene Sets stehen gleichberechtigt im Kit-Menü. Ein Wechsel ersetzt das ganze Set
// (angepasste Stimmen bleiben nicht stehen); bei ungespeicherten Änderungen fragt die App vorher. Siehe drumSet/currentSet in der Engine.
// =========================================================================
const drumSetOverlay=document.getElementById('drumSetOverlay'), dsRows=document.getElementById('dsRows'), dsSheet=document.getElementById('dsSheet');
const dsChips=document.getElementById('dsChips');
const dsList=document.getElementById('dsList'), dsSeg=document.getElementById('dsSeg'), dsShT=document.getElementById('dsShT'), dsStatus=document.getElementById('dsStatus');
const dsName=document.getElementById('dsName'), dsDirty=document.getElementById('dsDirty');
const kitConfirm=document.getElementById('kitConfirm'), kcText=document.getElementById('kcText');
const DS_IDS=['bd','sd','ch','oh','lt','ht','rs','hc','cy','rd','cb','cl','mr'];
let dsCur=null, dsMode='syn', dsMsgTimer=null, kitPending=null;
function dsSay(m){ dsStatus.textContent=m; clearTimeout(dsMsgTimer); dsMsgTimer=setTimeout(()=>{ dsStatus.textContent=''; },3000); }
function updateKitLabel(){
  if(typeof patternGroup!=='undefined' && patternGroup==='piano'){ const k=TRACKS.find(t=>t.id==='piano'); lcdKit.textContent=(KEY_SOUNDS[k&&k.sound]||KEY_SOUNDS.piano).name; return; }
  const custom=!currentSet.name && Object.keys(drumSet.voices).length>0;
  const KIT_SHORT={rock:'ROCK',studio:'STUDIO',s67:'ST 67',hyb:'HYBRID',rusty:'RUSTY',vintage:'VINT 73',fm909:'909',fm808:'808',real808:'808 A',acid:'ACID',lofi:'LO-FI'};
  { const use=smpKitsInUse(); smpFree(use); use.forEach(k=>{ if(!smp[k] || smp[k].state==='error') smpLoad(k); }); } // Fehler: erneuter Versuch beim nächsten Kit-Tipp
  lcdKit.textContent=(currentSet.name || KIT_SHORT[currentKitId] || KITS[currentKitId].name)+(currentSet.dirty?' *':(custom?' +':''));
  trNamesRefresh();
}
// Getauschte Stimmen (#2): Zeilennamen in Übersicht, Spurleiste und Mixer folgen dem Sound. Neuaufbau nur bei Änderung.
let trNamesSig='';
function trNamesRefresh(){
  const sig=TRACKS.map(trShort).join(); if(sig===trNamesSig) return; trNamesSig=sig;
  TRACKS.forEach(t=>{ if(t._ovLab) t._ovLab.textContent=trShort(t); });
  if(typeof renderTrackBar==='function') renderTrackBar();
  if(typeof mixerRebuild==='function') mixerRebuild();
}
async function drumSetLoadBuffers(){
  drumSet.buffers={};
  for(const id of Object.keys(drumSet.voices)){
    const v=drumSet.voices[id]; if(v.t!=='smp') continue;
    try{
      const e=await loadSampleLibraryEntry(v.sampleId); if(!e) continue;
      await Promise.resolve(initAudio());
      const buf=await audioCtx.decodeAudioData(await e.blob.arrayBuffer());
      drumSet.buffers[id]={buffer:buf, offset:e.offsetStart||0, name:e.name};
    }catch(err){ console.warn('Drum-Set-Sample nicht ladbar:', id, err); }
  }
  if(drumSetOverlay.classList.contains('open')) dsRender();
}
function drumSetApply(ds){
  drumSet.voices=(ds && ds.voices) ? JSON.parse(JSON.stringify(ds.voices)) : {};
  currentSet={id:(ds && ds.setId)||null, name:(ds && ds.setName)||null, dirty:false};
  drumSet.buffers={}; updateKitLabel(); drumSetLoadBuffers();
}
// ---- Speichern (Store "drumsets"; gleiche id überschreibt) ----
async function dsPut(d){ const db=await idbOpen(); db.transaction(IDB_DRUMSETS,'readwrite').objectStore(IDB_DRUMSETS).put(d,d.id); }
async function dsDel(id){ const db=await idbOpen(); db.transaction(IDB_DRUMSETS,'readwrite').objectStore(IDB_DRUMSETS).delete(id); }
async function dsAll(){
  const db=await idbOpen(), out=[];
  await new Promise((res,rej)=>{ const q=db.transaction(IDB_DRUMSETS,'readonly').objectStore(IDB_DRUMSETS).openCursor(); q.onsuccess=e=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(); }; q.onerror=()=>rej(q.error); });
  return out.sort((a,b)=>b.savedAt-a.savedAt);
}
async function dsSaveCurrent(){
  const others=new Set((await dsAll()).filter(s=>s.id!==currentSet.id).map(s=>s.name));
  const name=uniqueName((currentSet.name||'').trim()||'Mein Set', others), id=currentSet.id||genId();
  await dsPut({id, name, savedAt:Date.now(), baseKitId:currentKitId, voices:JSON.parse(JSON.stringify(drumSet.voices))});
  currentSet={id, name, dirty:false}; updateKitLabel(); return name;
}
function dsMarkDirty(){ currentSet.dirty=true; updateKitLabel(); dsDirty.textContent='● ungespeicherte Änderungen'; }
// ---- Wechsel mit Sicherheitsabfrage ----
function kitNeedsConfirm(){ return currentSet.dirty || (!currentSet.name && Object.keys(drumSet.voices).length>0); }
function kitChooseGuarded(fn){
  if(!kitNeedsConfirm()){ fn(); return; }
  kitPending=fn; kcText.textContent='„'+(currentSet.name || KITS[currentKitId].name+' (angepasst)')+'“ hat ungespeicherte Änderungen. Beim Wechsel gehen sie verloren.';
  kitConfirm.classList.add('open');
}
document.getElementById('kcSave').addEventListener('click', async ()=>{ kitConfirm.classList.remove('open'); await dsSaveCurrent(); const f=kitPending; kitPending=null; if(f) f(); });
document.getElementById('kcDiscard').addEventListener('click', ()=>{ kitConfirm.classList.remove('open'); currentSet.dirty=false; const f=kitPending; kitPending=null; if(f) f(); });
document.getElementById('kcCancel').addEventListener('click', ()=>{ kitConfirm.classList.remove('open'); kitPending=null; });
function closeKitPicker(){ kitPickerOverlay.classList.remove('open'); syncBottomBarVisibility(); }
function applyStandardKit(kitId){
  currentKitId=kitId; drumSet.voices={}; drumSet.buffers={}; currentSet={id:null,name:null,dirty:false};
  updateKitLabel(); closeKitPicker();
}
async function applyOwnSet(s){
  currentKitId=KITS[s.baseKitId] ? s.baseKitId : currentKitId;
  drumSet.voices=JSON.parse(JSON.stringify(s.voices||{})); drumSet.buffers={}; currentSet={id:s.id,name:s.name,dirty:false};
  updateKitLabel(); await drumSetLoadBuffers();
}
async function kitPickerRefresh(){
  const customAny=Object.keys(drumSet.voices).length>0;
  Object.keys(KITS).forEach(k=>{ const c=KITS[k]._chip; if(c) c.classList.toggle('active', !currentSet.name && !customAny && k===currentKitId); });
  const list=document.getElementById('kitOwnList'); list.innerHTML='';
  (await dsAll()).forEach(s=>{
    const n=Object.keys(s.voices||{}).filter(i=>s.voices[i].t==='smp').length;
    const row=document.createElement('div'); row.className='kit-chip'+(currentSet.id===s.id?' active':'');
    row.innerHTML='<div class="grow"><div class="kn"></div><div class="kd"></div></div><button class="kib" title="Bearbeiten" aria-label="Bearbeiten">'+UI_IC.ren+'</button><button class="kib d" title="Löschen" aria-label="Löschen">'+UI_IC.del+'</button>';
    row.querySelector('.kn').textContent=s.name; row.querySelector('.kd').textContent=(n?n+' Sample'+(n>1?'s':'')+' · ':'')+'Basis '+KITS[s.baseKitId||'rock'].name;
    row.onclick=()=>kitChooseGuarded(async()=>{ await applyOwnSet(s); closeKitPicker(); });
    row.querySelector('.kib').onclick=e=>{ e.stopPropagation(); kitChooseGuarded(async()=>{ await applyOwnSet(s); openSetEditor(); }); };
    row.querySelector('.d').onclick=e=>{ e.stopPropagation(); dsAskDelete(s); };
    list.appendChild(row);
  });
  const nw=document.createElement('div'); nw.className='kit-chip new'; nw.textContent='＋ Neues Set aus dem aktuellen Kit';
  nw.onclick=()=>kitChooseGuarded(()=>{ currentSet={id:null,name:'Neues Set',dirty:true}; updateKitLabel(); openSetEditor(); });
  list.appendChild(nw);
}
// ---- Eigenes Set löschen (#63, Mockup docs/mockups/issue-63.html A) ----
// Steckt das Set in gespeicherten Beats/Songs oder ist es geladen: Abfrage mit Liste. Sonst sofort löschen, Rückgängig im Toast.
// Beats/Songs speichern eine Kopie der Stimmen (drumSet.voices) → klingen danach gleich, nur der Listeneintrag verschwindet.
async function dsUsage(id){
  const out=[];
  try{ (await listPatternsFromIndexedDB()).forEach(p=>{ if(p.drumSet && p.drumSet.setId===id) out.push(['Beat',p.name||'Beat']); }); }catch(e){}
  try{ (await songAll()).forEach(s=>{ if(s.drumSet && s.drumSet.setId===id) out.push(['Song',s.name||'Song']); }); }catch(e){}
  return out;
}
async function dsAskDelete(s){
  const use=await dsUsage(s.id), cur=currentSet.id===s.id;
  if(!use.length && !cur){ dsDoDelete(s); return; }
  const box=document.getElementById('kdBox'), n=use.length, dlg=document.getElementById('kitDelConfirm');
  box.innerHTML='<div class="kc-h"></div>'
    +(n?'<div>Wird verwendet in '+n+(n>1?' Beats/Songs':' Beat/Song')+':</div><div class="kc-use"></div>':'<div>Wird in keinem gespeicherten Beat oder Song verwendet.</div>')
    +(cur?'<div class="kc-info">Ist gerade geladen – der aktuelle Beat behält den Klang, das Set gilt dann als „eigene Änderung“.</div>':'')
    +(n?'<div class="kc-info">Diese Beats und Songs klingen weiter wie bisher – das Set ist in ihnen mitgespeichert. Nur der Eintrag hier in der Liste verschwindet.</div>':'')
    +'<div class="kc-row"><button class="danger" id="kdDel">Löschen</button><button id="kdNo">Abbrechen</button></div>';
  box.querySelector('.kc-h').textContent='„'+s.name+'“ löschen?';
  if(n){ const U=box.querySelector('.kc-use'); use.forEach(([t,nm])=>{ const d=document.createElement('div'); d.innerHTML='<b class="'+(t==='Song'?'song':'')+'">'+t.toUpperCase()+'</b><span></span>'; d.querySelector('span').textContent=nm; U.appendChild(d); }); }
  dlg.classList.add('open');
  box.querySelector('#kdDel').onclick=()=>{ dlg.classList.remove('open'); dsDoDelete(s); };
  box.querySelector('#kdNo').onclick=()=>dlg.classList.remove('open');
  dlg.onclick=e=>{ if(e.target===dlg) dlg.classList.remove('open'); };
}
async function dsDoDelete(s){
  const prev=Object.assign({},currentSet), cur=currentSet.id===s.id;
  await dsDel(s.id); if(cur){ currentSet={id:null,name:currentSet.name,dirty:true}; updateKitLabel(); } kitPickerRefresh();
  hmToast('„'+s.name+'“ gelöscht', true, async()=>{ await dsPut(s); if(cur){ currentSet=prev; updateKitLabel(); } kitPickerRefresh(); });
}
// ---- Set-Editor ----
function openSetEditor(){
  closeKitPicker(); dsName.value=currentSet.name||''; dsDirty.textContent=currentSet.dirty?'● ungespeicherte Änderungen':'';
  dsRender(); drumSetOverlay.classList.add('open'); syncBottomBarVisibility();
}
function dsPreview(id, o){ // o = Vorhören einer anderen Quelle (Eintrag der Liste), ohne sie zu übernehmen
  const tr=TRACKS.find(t=>t.id===id);
  const kid=o && o.t==='syn' ? o.kitId : null;
  Promise.resolve(initAudio()).then(()=>kid && KITS[kid].samples ? Promise.race([smpLoad(kid), new Promise(r=>setTimeout(r,1500))]) : 0).then(()=>{
    if(audioCtx.state!=='running') audioCtx.resume();
    const keep=drumSet.voices[id]; if(o!==undefined){ if(o) drumSet.voices[id]=o; else delete drumSet.voices[id]; }
    try{ triggerTrack(tr, audioCtx.currentTime+0.01, VEL_NORMAL); }
    finally{ if(o!==undefined){ if(keep) drumSet.voices[id]=keep; else delete drumSet.voices[id]; } }
  });
}
// Stimmen tauschen (#2 Stufe 2, Mockup docs/mockups/issue-2-tauschen.html A): jede Zeile kann jede Stimme
// jedes Kits spielen. Liste nach Rolle gefiltert, vorausgewählt = Rolle der Zeile.
const DS_ROLES=['Kick','Snare','Hi-Hat','Tom','Becken','Perc'];
let dsFilt='all';
const dsVName=voiceName;
const dsVGroup=v=>ROLE_GROUP[VOICE_ROLE[v]]||'Perc';
function dsKitVoices(k){ // Stimmen, die ein Kit wirklich eigen spielt (Sample-Kits: nur eigene Aufnahmen, Ersatz-Stimmen stehen beim Ersatz-Kit)
  const K=KITS[k];
  if(K.samples) return K.samples.voices.filter(v=>VOICE_FNS[v]); // nur Stimmen mit eigener Zeile (Spielweisen wie hl/rb, cgm gehören zur Hauptstimme)
  return DS_IDS.filter(v=>K.voices && K.voices[v]);
}
function dsRender(){
  dsRows.innerHTML='';
  GRP_KEYS.forEach(gk=>{
    const ids=DS_IDS.filter(id=>GRP_DEF[gk].ids.indexOf(id)>=0); if(!ids.length) return;
    const h=document.createElement('div'); h.className='ds-grp ds-grp-'+gk; h.innerHTML='<i></i>'+GRP_DEF[gk].ab; dsRows.appendChild(h);
    ids.forEach(id=>{
      const tr=TRACKS.find(t=>t.id===id), v=drumSet.voices[id], sw=trSwap(tr), d=document.createElement('div');
      d.className='ds-row ds-'+gk+(v?' sw':'');
      let name, sub, smp=false;
      if(v && v.t==='smp'){ smp=true; name=(drumSet.buffers[id] && drumSet.buffers[id].name) || 'Sample (lädt…)'; sub=drumSet.buffers[id] ? 'Sample · aus Bibliothek' : 'Sample fehlt — Synth als Ersatz'; }
      else if(v){ name=dsVName(trVoice(tr)); sub=KITS[v.kitId].name; }
      else { name=tr.name; sub=KITS[currentKitId].name+' (Original)'; }
      d.innerHTML='<b>'+trShort(tr)+(sw?'<s>statt '+id.toUpperCase()+'</s>':'')+'</b><div class="ds-src'+(smp?' smp':'')+'"><span></span><small>'+(smp?'':'<em class="ds-rl">'+dsVGroup(trVoice(tr))+'</em>')+'<i></i></small></div><button class="ds-pv" aria-label="Anhören">'+UI_IC.play+'</button>';
      d.querySelector('span').textContent=name; d.querySelector('small i').textContent=sub;
      d.querySelector('.ds-pv').onclick=e=>{ e.stopPropagation(); dsPreview(id); };
      d.onclick=()=>dsOpenSheet(id); dsRows.appendChild(d);
    });
  });
}
function dsPick(id, o){ // o = {t:'syn',kitId,v} oder null = Original; Rückgängig im Toast
  const prev=drumSet.voices[id], wasDirty=currentSet.dirty;
  if(o && o.kitId===currentKitId && o.v===id) o=null; // = Original
  if(o){ if(o.v===id) o={t:'syn',kitId:o.kitId}; drumSet.voices[id]=o; } else delete drumSet.voices[id];
  delete drumSet.buffers[id]; dsMarkDirty(); dsRender(); dsRenderList(); dsPreview(id);
  const tr=TRACKS.find(t=>t.id===id);
  hmToast(id.toUpperCase()+' spielt jetzt '+dsVName(trVoice(tr))+(o?' · '+KITS[o.kitId].name:''), true, async()=>{
    if(prev) drumSet.voices[id]=prev; else delete drumSet.voices[id];
    if(prev && prev.t==='smp') await drumSetLoadBuffers();
    if(!wasDirty){ currentSet.dirty=false; dsDirty.textContent=''; } updateKitLabel(); dsRender(); if(dsSheet.classList.contains('open')) dsRenderList();
  });
}
async function dsRenderList(){
  dsList.innerHTML=''; const id=dsCur, v=drumSet.voices[id];
  dsSeg.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b.dataset.m===dsMode));
  dsChips.hidden=dsMode!=='syn';
  if(dsMode==='syn'){
    dsChips.innerHTML='';
    [['all','Alle']].concat(DS_ROLES.map(r=>[r,r])).forEach(([k,n])=>{ const b=document.createElement('button'); b.textContent=n; b.className=dsFilt===k?'on':''; b.setAttribute('aria-pressed',dsFilt===k);
      b.onclick=()=>{ dsFilt=k; dsRenderList(); }; dsChips.appendChild(b); });
    const on=dsChips.querySelector('.on'); if(on) on.scrollIntoView({block:'nearest',inline:'center'});
    const pv=(o)=>{ const b=document.createElement('button'); b.className='ds-ipv'; b.innerHTML=UI_IC.play; b.setAttribute('aria-label','Anhören'); b.onclick=e=>{ e.stopPropagation(); dsPreview(id,o); }; return b; };
    const base=document.createElement('div'); base.className='ds-it base'+(!v?' on':''); base.innerHTML='<span class="grow">↺ Original<small>'+KITS[currentKitId].name+' · '+dsVName(id)+'</small></span>';
    base.appendChild(pv(null)); base.onclick=()=>dsPick(id,null); dsList.appendChild(base);
    Object.keys(KITS).forEach(k=>{
      const vs=dsKitVoices(k).filter(x=>dsFilt==='all' || dsVGroup(x)===dsFilt); if(!vs.length) return;
      const h=document.createElement('div'); h.className='ds-kit'; h.textContent=KITS[k].name+(KITS[k].samples?' · gesampelt':''); dsList.appendChild(h);
      vs.forEach(x=>{
        const sel=v && v.t==='syn' && v.kitId===k && (v.v||id)===x, it=document.createElement('div'); it.className='ds-it'+(sel?' on':'');
        it.innerHTML='<span class="grow">'+dsVName(x)+'<small>'+dsVGroup(x)+'</small></span>'+(KITS[k].samples?'<em class="ds-tg">ECHT</em>':'');
        const o={t:'syn',kitId:k,v:x}; it.appendChild(pv(o)); it.onclick=()=>dsPick(id,o); dsList.appendChild(it);
      });
    });
    if(dsList.children.length===1){ const e=document.createElement('div'); e.className='ds-it'; e.textContent='Keine Sounds mit dieser Rolle'; dsList.appendChild(e); }
  } else {
    const items=await listSampleLibrary();
    items.forEach(e=>{
      const it=document.createElement('div'); it.className='ds-it'+(v && v.t==='smp' && v.sampleId===e.id?' on':'');
      const nm=document.createElement('span'); nm.className='grow'; nm.textContent=e.name||'Sample'; it.appendChild(nm);
      const del=document.createElement('button'); del.innerHTML=UI_IC.del; del.title='Sample löschen'; del.setAttribute('aria-label','Sample löschen');
      del.onclick=ev=>{ ev.stopPropagation(); smpLibDelete(e); }; it.appendChild(del);
      it.onclick=async()=>{ drumSet.voices[id]={t:'smp',sampleId:e.id}; dsMarkDirty(); await drumSetLoadBuffers(); dsRender(); dsRenderList(); dsPreview(id); }; dsList.appendChild(it);
    });
    if(!items.length){ const e=document.createElement('div'); e.className='ds-it'; e.textContent='Noch keine Samples in der Bibliothek'; dsList.appendChild(e); }
    const add=document.createElement('div'); add.className='ds-it add'; add.textContent='＋ Aufnehmen / Datei laden (Sample-Editor)';
    add.onclick=()=>{ dsSheet.classList.remove('open'); openSampleEditor({sampleId:null}); }; dsList.appendChild(add);
  }
}
// Sample aus der Bibliothek löschen (#6): Stimmen des aktuellen Sets, die es nutzen, folgen wieder dem Basis-Kit.
// Kein Rückfrage-Dialog, stattdessen Rückgängig im Toast (Eintrag inkl. Audio wird neu gespeichert).
async function smpLibDelete(e){
  const used=Object.keys(drumSet.voices).filter(k=>{ const v=drumSet.voices[k]; return v && v.t==='smp' && v.sampleId===e.id; });
  const prev=used.map(k=>[k, drumSet.voices[k], drumSet.buffers[k]]), wasDirty=currentSet.dirty;
  await deleteSampleLibraryEntry(e.id);
  used.forEach(k=>{ delete drumSet.voices[k]; delete drumSet.buffers[k]; }); if(used.length) dsMarkDirty();
  dsRender(); dsRenderList();
  hmToast('„'+(e.name||'Sample')+'“ gelöscht', true, async()=>{
    await saveSampleLibraryEntry(e);
    prev.forEach(([k,v,b])=>{ drumSet.voices[k]=v; if(b) drumSet.buffers[k]=b; });
    if(used.length && !wasDirty){ currentSet.dirty=false; updateKitLabel(); dsDirty.textContent=''; }
    dsRender(); dsRenderList();
  });
}
function dsOpenSheet(id){
  dsCur=id; const v=drumSet.voices[id], tr=TRACKS.find(t=>t.id===id); dsMode=(v && v.t==='smp')?'smp':'syn';
  dsFilt=dsVGroup(trVoice(tr)); // vorausgewählt: Rolle der Zeile
  dsShT.textContent=id.toUpperCase()+' · Sound wählen'; dsSheet.classList.add('open'); dsList.scrollTop=0; dsRenderList();
}
dsSeg.querySelectorAll('button').forEach(b=>b.addEventListener('click', ()=>{ dsMode=b.dataset.m; dsRenderList(); }));
document.getElementById('dsShX').addEventListener('click', ()=>dsSheet.classList.remove('open'));
dsName.addEventListener('input', ()=>{ currentSet.name=dsName.value; dsMarkDirty(); });
document.getElementById('dsSave').addEventListener('click', async ()=>{
  if(!dsName.value.trim()){ dsSay('Bitte einen Namen eingeben'); return; }
  currentSet.name=dsName.value; const n=await dsSaveCurrent(); dsName.value=n; dsDirty.textContent=''; dsSay('„'+n+'“ gespeichert');
});
document.getElementById('dsCloseBtn').addEventListener('click', ()=>{ dsSheet.classList.remove('open'); drumSetOverlay.classList.remove('open'); syncBottomBarVisibility(); });
updateKitLabel();

// ---- v76: Karte „Aktueller Beat“ ----
// Speichern: Beat mit id -> überschreiben (Name aus dem Feld), sonst neu anlegen. „Als Kopie“ legt immer neu an.
// Ungespeichert = Fingerabdruck des Zustands (ohne id/Name/Zeit) weicht vom letzten Laden/Speichern ab;
// geprüft nach Bedienung (pointerup/change, entprellt), nicht per Dauerschleife.
let pbBase=null, pbTimer=null;
function pbPrint(){ const d=collectPatternData('',''); delete d.id; delete d.name; delete d.savedAt; return JSON.stringify(d); }
function pbMarkClean(){ pbBase=pbPrint(); pbRender(true); }
function pbKind(){ const n=currentLoadedPatternName; if(currentLoadedPatternId) return 'beat'; if(n && n.charAt(0)==='♫') return 'song'; return 'draft'; }
function pbDirty(){
  const k=pbKind(); if(k!=='beat') return k==='draft';
  if(pbBase===null || pbPrint()!==pbBase) return true;
  return patternsOverlay.classList.contains('open') && pbName.value.trim()!=='' && pbName.value.trim()!==currentLoadedPatternName;
}
function pbRender(syncName){
  const k=pbKind(), dirty=pbDirty();
  if(syncName || document.activeElement!==pbName) pbName.value = k==='song' ? '' : (currentLoadedPatternName||'');
  pbState.classList.toggle('ok', k==='beat' && !dirty);
  pbState.querySelector('span').textContent = k==='beat' ? (dirty?'Ungespeicherte Änderungen':'Gespeichert') : k==='song' ? 'Gehört zum Song · Speichern legt einen Beat an' : 'Noch nicht gespeichert';
  const done=k==='beat' && !dirty; patternSaveBtn.classList.toggle('done',done); patternSaveBtn.querySelector('span').textContent=done?'Gespeichert':'Speichern';
  patternCopyBtn.disabled = k!=='beat';
  lcdPatternBtn.classList.toggle('unsaved', dirty);
}
function pbSoon(){ clearTimeout(pbTimer); pbTimer=setTimeout(()=>pbRender(), 350); }
['pointerup','change','keyup'].forEach(t=>document.addEventListener(t, pbSoon, true));
pbName.addEventListener('input', ()=>pbRender());
pbName.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); pbName.blur(); patternSaveBtn.click(); } });
patternSaveBtn.addEventListener('click', async ()=>{
  const typed=pbName.value.trim(), all=await listPatternsFromIndexedDB();
  let data;
  if(currentLoadedPatternId && all.some(p=>p.id===currentLoadedPatternId)){
    let name=currentLoadedPatternName;
    if(typed && typed!==name) name=uniqueName(typed, new Set(all.filter(p=>p.id!==currentLoadedPatternId).map(p=>p.name)));
    data=collectPatternData(name, currentLoadedPatternId);
  } else data=collectPatternData(uniqueName(typed||'Neuer Beat', new Set(all.map(p=>p.name))), genId());
  await savePatternToIndexedDB(data); // gleiche id -> gleicher Key, nur Inhalt aktualisiert
  setCurrentLoadedPattern(data.id, data.name); rememberLastPattern(data.id); pbMarkClean();
  if(typed && data.name!==typed) showPatternIOStatus('Name bereits vergeben — gespeichert als „'+data.name+'“');
  refreshPatternList();
});
patternCopyBtn.addEventListener('click', async ()=>{
  if(!currentLoadedPatternId) return;
  const base=(pbName.value.trim()||currentLoadedPatternName)+' (Kopie)';
  const data=collectPatternData(uniqueName(base, new Set((await listPatternsFromIndexedDB()).map(p=>p.name))), genId());
  await savePatternToIndexedDB(data);
  setCurrentLoadedPattern(data.id, data.name); rememberLastPattern(data.id); pbMarkClean();
  showPatternIOStatus('Als „'+data.name+'“ gespeichert'); refreshPatternList();
});
document.getElementById('grpSaveBtn').addEventListener('click', async ()=>{ const t=patternNameInput.value.trim(); if(t && beatTab!=='all') await beatSaveGroup(t); });

// ---- v76: Neuer Beat — leer mit gleichem Klang oder Standard (Zustand beim ersten Start), Undo per Toast ----
let nbDefault=null, nbBefore=null;
function nbBlank(d){
  d.tracks.forEach(t=>{
    t.steps=t.steps.map(()=>VEL_OFF);
    if(t.notes) t.notes=t.notes.map(()=>0);
    if(t.slides) t.slides=t.slides.map(()=>false);
    if(t.events) t.events=[];
    if(t.harm) t.harm=Object.assign({}, t.harm, {mode:'off'});
    t.muted=false; t.solo=false;
  });
  return d;
}
function nbMake(k){
  nbBefore={ data:collectPatternData(currentLoadedPatternName, currentLoadedPatternId), id:currentLoadedPatternId, name:currentLoadedPatternName, base:pbBase, clean:pbBase!==null && pbBase===pbPrint() };
  const src = k==='def' && nbDefault ? JSON.parse(JSON.stringify(nbDefault)) : collectPatternData('Neuer Beat', null);
  applyPatternData(nbBlank(src));
  taResetUndo();
  setCurrentLoadedPattern(null, 'Neuer Beat'); pbBase=null; pbRender(true);
  closeSheets(); patternsOverlay.classList.remove('open'); syncBottomBarVisibility();
  hmToast(k==='def'?'Neuer Beat · Standard':'Neuer Beat', true, nbUndo);
}
function nbUndo(){
  const b=nbBefore; if(!b) return; nbBefore=null;
  applyPatternData(b.data); taResetUndo();
  setCurrentLoadedPattern(b.id, b.name); if(b.clean) pbMarkClean(); else { pbBase=b.base; pbRender(true); } // Laden ergänzt fehlende Felder -> Fingerabdruck neu
}
pbNewBtn.addEventListener('click', ()=>openSheet('newBeatSheet'));
document.querySelectorAll('#newBeatSheet .nb-opt').forEach(b=>b.addEventListener('click', ()=>nbMake(b.dataset.k)));
document.getElementById('nbX').addEventListener('click', closeSheets);
