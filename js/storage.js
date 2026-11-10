"use strict";
// =========================================================================
// PATTERN-SPEICHER — kompletter Beat-Zustand (Steps, Kit, Tempo, Hall, …)
// als benannte Sätze in IndexedDB, session-übergreifend abrufbar.
// =========================================================================
// Stabile, kollisionssichere ID für gespeicherte Patterns — Referenzen auf
// Patterns laufen über diese ID statt über den Namen, damit Umbenennen (siehe unten) sie
// nicht bricht. Kein Krypto-Anspruch nötig, nur lokale Eindeutigkeit.
function genId(){ return 'p_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
// Hängt bei Namenskollision "(2)", "(3)", … an — zentrale Stelle für die im ganzen
// Beats-System geltende Regel "nie stillschweigend überschreiben, sondern umbenennen"
// (Speichern, Duplizieren, Umbenennen, Import nutzen alle diese eine Funktion).
function uniqueName(base, existingNames){
  if(!existingNames.has(base)) return base;
  let n=2, candidate=base+' ('+n+')';
  while(existingNames.has(candidate)){ n++; candidate=base+' ('+n+')'; }
  return candidate;
}
// Eine Spur als Speicher-Eintrag (Pattern, Song, Rückgängig beim Löschen, Kopieren)
function trSave(tr){
  return {
    id: tr.id,
    steps: tr.steps.slice(),
    events: tr.events ? JSON.parse(JSON.stringify(trOwnEvents(tr))) : undefined, // folgt die Spur der Harmonie: eigene Noten, nicht die erzeugten
    harm: tr.harm ? JSON.parse(JSON.stringify(tr.harm)) : undefined,
    notes: tr.notes ? tr.notes.slice() : undefined,
    slides: tr.slides ? tr.slides.slice() : undefined,
    vol: tr.vol,
    tune: tr.tune,
    pan: tr.pan || 0,
    eqLowGain: tr.eqLowGain || 0,
    eqMidGain: tr.eqMidGain || 0,
    eqHighGain: tr.eqHighGain || 0,
    eqOn: tr.eqOn!==false, eqLc: tr.eqLc||0, eqMf: tr.eqMf!=null?tr.eqMf:EQ_MF_DEF, fx: fxSave(tr.fx),
    muted: !!tr.muted,
    solo: !!tr.solo,
    reverbAmount: tr.reverbAmount || 0,
    feel: tr.feel || 0,
    delaySend: tr.delaySend || 0,
    accentAmt: tr.accentAmt, rootNote: tr.rootNote, cutoff: tr.cutoff, resonance: tr.resonance, envMod: tr.envMod, decay: tr.decay, scale: tr.scale, ...instSave(tr) // eigene Felder des Instruments (#24), optional für ältere Pattern

  };
}
function collectPatternData(name, id){
  return {
    id: id || genId(),
    name,
    savedAt: Date.now(),
    schemaVersion: 8, // v80: grps {drums,perc} mit Effekten statt grpDrums (alt wird gelesen) // v79: Effekte (tracks[].fx/eqOn/eqLc/eqMf, fxHall, fxDelay, masterFx) // v62: optionale Felder harmony + tracks[].harm (rückwärtskompatibel) // v6 = Humanize (global) + Feel (pro Spur); pan/EQ/muted/solo/fill (v6.1, rückwärtskompatibel) neu dazu
    bpm, swing, humanize,
    kitId: DRUM_TRACKS[0].kit, // = Drum-Kit (ältere Versionen lesen nur das)
    kits: Object.fromEntries(DRUM_TRACKS.map(d=>[d.id, d.kit])), // #68: Kit je Drum-Spur
    smpOpt: Object.assign({},smpOpt),
    drumSet: { voices: JSON.parse(JSON.stringify(drumSet.voices)), setId: DRUM_TRACKS[0].set.id, setName: DRUM_TRACKS[0].set.name,
               sets: Object.fromEntries(DRUM_TRACKS.map(d=>[d.id, {id:d.set.id, name:d.set.name}])) },
    patternLength: PATTERN_LENGTH,
    tracks: TRACKS.map(trSave),
    mel: TRACKS.filter(trInst).map(melEntry), // #13: Melodiespuren in Reihenfolge (fehlt bei älteren Ständen = ACID, COSMIC, KEYS)
    harmony: JSON.parse(JSON.stringify(harmony)), // v62: Akkordfolge + Tonart (optional, ältere Pattern: Standard-Vorlage)
    acidAuto: { shape: autoShape, bars: autoBars, depth: autoDepth },
    fxHall: Object.assign({},fxHall), fxDelay: Object.assign({},fxDelay), masterFx: fxSave(masterFx), mfxV: 2, grps: Object.fromEntries(GRP_KEYS.map(k=>[k,Object.assign({vol:grps[k].vol,muted:grps[k].muted,fx:fxSave(grps[k].fx)},Object.fromEntries(EQ_KEYS.map(q=>[q,grps[k][q]])))])),
    fill: {
      lengthSteps: fillLengthSteps,
      everyN: fillEveryN,
      intensity: fillIntensity,
      enabled: fillEnabled,
      styles: Object.assign({}, fillStyleEnabled)
    }
  };
}
// Wandelt Steps aus älteren Pattern-Formaten (boolean + globaler accentSteps-Layer)
// in das neue Velocity-Format um, damit vorhandene gespeicherte Beats weiter laden.
// targetLen sorgt zusätzlich dafür, dass ältere (immer 16 Steps lange) Patterns
// korrekt auf die aktuelle Pattern-Länge aufgefüllt bzw. gekürzt werden.
// Spielweisen der Drum-Spuren laden (tr.notes): nur gültige Werte, sonst 0 = Standard
function artLoad(tr, saved){
  const n=(tr.type!=='arp' && !tr.isSample) ? Math.max(...Object.values(ART).map(l=>l.length)) : 0, out=new Array(PATTERN_LENGTH).fill(0);
  if(n && saved) for(let i=0;i<Math.min(saved.length,PATTERN_LENGTH);i++){ const a=saved[i]|0; out[i]= a>0&&a<n ? a : 0; }
  return out;
}
function migrateStepsToVelocity(savedSteps, trackId, oldAccentSteps, targetLen){
  const out=new Array(targetLen).fill(VEL_OFF);
  for(let s=0;s<Math.min(savedSteps.length, targetLen); s++){
    const v=savedSteps[s];
    if(typeof v === 'number'){ out[s]=v; continue; }
    if(!v) continue;
    const accented = oldAccentSteps && oldAccentSteps[s];
    out[s]= accented ? VEL_ACCENT : VEL_NORMAL;
  }
  return out;
}
// Kern von applyPatternData(): setzt Kit,
// Pattern-Länge, alle Track-Daten (Steps/Vol/Pan/EQ/Mute/Solo/Feel/Sends/Arp) und
// Fill-Einstellungen. Bewusst OHNE Tempo/Swing/Humanize und OHNE stop().
// applyPatternData() (Beats laden per Hand) ergänzt Tempo+Stop.
// Gespeicherten Spur-Eintrag auf eine Spur anwenden (accentSteps = globaler Accent-Layer sehr alter Stände)
function trLoadSaved(tr, saved, accentSteps){
  tr.steps=migrateStepsToVelocity(saved.steps, tr.id, accentSteps, PATTERN_LENGTH);
  if(tr.type!=='arp') tr.notes=artLoad(tr, saved.notes);
  tr.vol=saved.vol; tr.tune=saved.tune; tr.reverbAmount=saved.reverbAmount||0;
  tr.pan=saved.pan||0; // ältere Patterns ohne pan-Feld -> zentriert (Standard)
  tr.eqLowGain=saved.eqLowGain||0; tr.eqMidGain=saved.eqMidGain||0; tr.eqHighGain=saved.eqHighGain||0;
  fxLoadTrack(tr,saved);
  const u=trUi(tr);
  if(u.mixEqKnobs){
    if(u.mixEqKnobs.eqLowGain) u.mixEqKnobs.eqLowGain.setValue(tr.eqLowGain);
    if(u.mixEqKnobs.eqMidGain) u.mixEqKnobs.eqMidGain.setValue(tr.eqMidGain);
    if(u.mixEqKnobs.eqHighGain) u.mixEqKnobs.eqHighGain.setValue(tr.eqHighGain);
  }
  tr.muted=!!saved.muted; tr.solo=!!saved.solo; // ältere Patterns ohne diese Felder -> beides aus
  if(u.ovRow) u.ovRow.classList.toggle('muted', tr.muted);
  if(u.mixMuteBtn) u.mixMuteBtn.classList.toggle('on', tr.muted);
  if(u.mixSoloBtn) u.mixSoloBtn.classList.toggle('on', tr.solo);
  tr.feel=saved.feel||0;
  tr.delaySend=saved.delaySend||0;
  if(tr.delaySendGain) tr.delaySendGain.gain.value=tr.delaySend;
  if(tr.sendGain) tr.sendGain.gain.value=tr.reverbAmount;
  if(tr.panner) tr.panner.pan.value=tr.pan;
  if(u.mixFaderEl){ u.mixFaderEl.value=tr.vol; if(u.mixMeter) u.mixMeter.dbReadout.textContent=dbLabel(tr.vol)+'dB'; }
  if(u.mixPanKnob) u.mixPanKnob.setValue(tr.pan);
  if(tr.type==='arp'){
    // ältere Patterns ohne Arp-Track: sinnvolle Defaults statt undefined
    tr.events=evLoad(saved,tr); delete tr.notes; delete tr.slides; evTouch(tr);
    tr.rootNote = saved.rootNote!=null ? saved.rootNote : 0;
    tr.cutoff = saved.cutoff!=null ? saved.cutoff : 0.5;
    tr.resonance = saved.resonance!=null ? saved.resonance : 0.35;
    tr.envMod = saved.envMod!=null ? saved.envMod : 0.5;
    tr.decay = saved.decay!=null ? saved.decay : 0.26;
    instLoad(tr,saved); // eigene Felder des Instruments (#24)
    tr.scale = SCALES[saved.scale] ? saved.scale : 'minor';
    tr.accentAmt = saved.accentAmt!=null ? saved.accentAmt : 0.5;
    tr.harm = hmSanTrack(tr, saved.harm);
  }
}
function applyTrackAndFillData(data){
  { const K=data.kits||{}; // #68: Kit je Drum-Spur; ältere Stände: alle Spuren mit kitId (klingt wie bisher)
    DRUM_TRACKS.forEach(d=>{ const k=K[d.id]||data.kitId; if(KITS[k]) d.kit=k; }); }

  Object.assign(smpOpt, SMP_OPT_DEF, data.smpOpt||{}); smpOptRender(); // ohne Angabe: Standard
  drumSetApply(data.drumSet); // ältere Patterns/Beats ohne Set: alle Stimmen aus dem Basis-Kit
  PATTERN_LENGTH = data.patternLength || 16; // ältere Patterns hatten keine gespeicherte Länge → 16
  currentPage=0;
  melSync(data.mel); // #13: Melodiespuren wie gespeichert anlegen/entfernen (ältere Stände: ACID, COSMIC, KEYS)
  // Neue Spuren, die in älteren gespeicherten Patterns noch nicht existierten,
  // starten beim Laden leer statt den Zustand des zuvor geladenen Beats zu behalten.
  // Melodiespuren, die das Pattern nicht kennt (z. B. Cosmic/Keys vor ihrer Einführung): leer, Klang ab Werk (tr._snd0)
  TRACKS.forEach(tr=>{
    if(!trInst(tr) || (data.tracks||[]).some(saved=>saved.id===tr.id)) return;
    tr.steps=new Array(PATTERN_LENGTH).fill(VEL_OFF); tr.events=[]; delete tr.notes; delete tr.slides; tr._idx=null; tr.muted=false; tr.solo=false;
    const u=trUi(tr); ['mixMuteBtn','mixSoloBtn'].forEach(k=>{ if(u[k]) u[k].classList.remove('on'); }); if(u.ovRow) u.ovRow.classList.remove('muted');
    applyTrackSound(tr, instTpl(tr));
  });
  TRACKS.forEach(tr=>{ if(tr.type==='arp'){ tr.harm=hmDefaultTrack(tr); delete tr.harmOwn; } });
  TRACKS.forEach(tr=>{ // Drum-Spuren, die es im gespeicherten Pattern noch nicht gab (z. B. Ride vor v72): leer
    if(tr.type==='arp' || (data.tracks||[]).some(s=>s.id===tr.id)) return;
    tr.steps=new Array(PATTERN_LENGTH).fill(VEL_OFF); tr.notes=new Array(PATTERN_LENGTH).fill(0); tr.slides=new Array(PATTERN_LENGTH).fill(false);
  });
  data.tracks.forEach(saved=>{ const tr=TRACKS.find(t=>t.id===saved.id); if(tr) trLoadSaved(tr, saved, data.accentSteps); });
  { const h=hmSanHarmony(data.harmony); if(h){ harmony=h; hmTpl=0; } else hmDefault(); }
  TRACKS.forEach(tr=>{ if(hmOn(tr)){ tr.harmOwn=tr.events; hmRegen(tr); } });
  refreshSoloVisuals(); // Mute/Solo mehrerer Spuren gerade geändert -> Solo-Dimming einmal gesamt neu berechnen
  fxLoadGlobal(data);

  // Fill-Einstellungen: ältere Patterns haben kein data.fill -> aktuelle Werte bleiben unangetastet
  if(data.fill){
    fillLengthSteps = data.fill.lengthSteps || fillLengthSteps;
    fillEveryN = data.fill.everyN || fillEveryN;
    fillIntensity = data.fill.intensity!=null ? data.fill.intensity : fillIntensity;
    fillEnabled = data.fill.enabled!=null ? data.fill.enabled : fillEnabled;
    if(data.fill.styles){
      Object.keys(fillStyleEnabled).forEach(k=>{ if(data.fill.styles[k]!=null) fillStyleEnabled[k]=data.fill.styles[k]; });
    }
    FILL_LEN_OPTIONS.forEach(l=>fillLenChipEls[l].classList.toggle('active', l===fillLengthSteps));
    FILL_EVERY_OPTIONS.forEach(x=>fillEveryChipEls[x].classList.toggle('active', x===fillEveryN));
    fillIntensitySlider.value=Math.round(fillIntensity*100);
    fillIntensityValue.textContent=fillIntensitySlider.value+'%';
    fillEnableBtn.classList.toggle('on', fillEnabled);
    fillEnableBtn.textContent = fillEnabled ? 'Fill aktiv' : 'Fill aus';
    fillToggleBtn.classList.toggle('on', fillEnabled);
    FILL_STYLE_INFO.forEach(({id})=> fillStyleChipEls[id].classList.toggle('active', !!fillStyleEnabled[id]));
  }

  const aa=data.acidAuto||{};
  autoShape=aa.shape||'off'; autoBars=aa.bars||4; autoDepth=aa.depth!=null?aa.depth:0.6;
  syncAutoUI();
  renderLengthChips();
  renderPageNav();
  selectTrack(activeTrackIdx);
  renderAllForPage();
}
function applyPatternData(data){
  clipEditEnd();
  swing=data.swing; humanize=data.humanize!=null ? data.humanize : 0; // alte Patterns: 0 = kein Humanize
  setBpm(data.bpm); // aktualisiert bpm + LCD-Kopfzeile + Tempo-Kachel + Overlay-Ziffer/-Slider synchron
  syncSettingsUI();

  if(isPlaying) stop();
  applyTrackAndFillData(data);
}
async function savePatternToIndexedDB(data){
  const db=await idbOpen();
  const tx=db.transaction(IDB_PATTERNS,'readwrite');
  tx.objectStore(IDB_PATTERNS).put(data, data.id);
}
async function loadPatternFromIndexedDB(id){
  const db=await idbOpen();
  const tx=db.transaction(IDB_PATTERNS,'readonly');
  return new Promise((res,rej)=>{
    const r=tx.objectStore(IDB_PATTERNS).get(id);
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  });
}
async function deletePatternFromIndexedDB(id){
  const db=await idbOpen();
  const tx=db.transaction(IDB_PATTERNS,'readwrite');
  tx.objectStore(IDB_PATTERNS).delete(id);
}
// Liest alle gespeicherten Patterns. Ältere Einträge (vor der ID-Umstellung) waren
// per Name statt per ID keyed und haben kein data.id-Feld — die werden hier einmalig
// "lazy" migriert (neue ID vergeben, unter dem neuen Key neu abgelegt, alten
// Namens-Key gelöscht), damit Rename/Song-Referenzen für ALLE Patterns funktionieren,
// auch für schon vor diesem Update gespeicherte.
async function listPatternsFromIndexedDB(){
  const db=await idbOpen();
  const out=[];
  await new Promise((res,rej)=>{
    const tx=db.transaction(IDB_PATTERNS,'readonly');
    const req=tx.objectStore(IDB_PATTERNS).openCursor();
    req.onsuccess=(e)=>{
      const cursor=e.target.result;
      if(cursor){
        const val=cursor.value;
        if(!val.id){ val.id=genId(); val.__oldKey=cursor.key; }
        out.push(val);
        cursor.continue();
      } else res();
    };
    req.onerror=()=>rej(req.error);
  });
  const toMigrate=out.filter(p=>p.__oldKey!=null);
  if(toMigrate.length){
    await new Promise((res,rej)=>{
      const tx=db.transaction(IDB_PATTERNS,'readwrite');
      const store=tx.objectStore(IDB_PATTERNS);
      toMigrate.forEach(p=>{
        const oldKey=p.__oldKey; delete p.__oldKey;
        store.delete(oldKey);
        store.put(p, p.id);
      });
      tx.oncomplete=res; tx.onerror=()=>rej(tx.error);
    });
  }
  return out.sort((a,b)=>b.savedAt-a.savedAt);
}

const patternsOverlay=document.getElementById('patternsOverlay');
const patternsOverlayCloseBtn=document.getElementById('patternsOverlayCloseBtn');
const exportWavBtn=document.getElementById('exportWavBtn');
exportWavBtn.addEventListener('click', async ()=>{
  // Bugfix: renderPatternToWav() biegt audioCtx/master/... für die Dauer des Renderns auf einen
  // OfflineAudioContext um. Lief der Sequencer währenddessen weiter, griff der Live-Scheduler auf
  // die vertauschten Objekte zu — Live-Ton brach ab, vereinzelte Events konnten ins WAV durchrutschen.
  if(isPlaying) stop();
  const orig=exportWavBtn.textContent;
  exportWavBtn.textContent='Rendere…';
  exportWavBtn.disabled=true;
  try{
    const buffer=await renderPatternToWav();
    const blob=audioBufferToWavBlob(buffer);
    const stamp=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-');
    await offerFileToViewer('mrm44-pattern-'+stamp+'.wav', blob);
  } catch(err){
    console.warn('WAV-Export fehlgeschlagen:', err);
    exportWavBtn.textContent='Fehler';
    setTimeout(()=>{ exportWavBtn.textContent=orig; }, 1500);
    exportWavBtn.disabled=false;
    return;
  }
  exportWavBtn.textContent=orig;
  exportWavBtn.disabled=false;
});
const patternNameInput=document.getElementById('patternNameInput');
const patternSaveBtn=document.getElementById('patternSaveBtn');
const patternCopyBtn=document.getElementById('patternCopyBtn');
const pbName=document.getElementById('pbName'), pbState=document.getElementById('pbState'), pbNewBtn=document.getElementById('pbNewBtn');
let currentLoadedPatternId=null; // id des zuletzt geladenen/gespeicherten/duplizierten Patterns (für Song-Referenzen/Anzeige)
let currentLoadedPatternName=null; // Name dazu (ohne id: „Neuer Beat“ = Entwurf, „♫ …“ = Song)
const patternList=document.getElementById('patternList');

// Beat-Zeile (v65): oben Name/Datum + Laden + Weitere; Weitere klappt die übrigen Aktionen mit Namen auf
function prowFinish(row, loadBtn, more){
  const meta=row.querySelector('.prow-meta'); const top=document.createElement('div'); top.className='prow-top';
  row.insertBefore(top, meta); top.appendChild(meta);
  const mb=document.createElement('button'); mb.className='prow-btn'; mb.innerHTML=UI_IC.more; mb.title='Weitere Aktionen'; mb.setAttribute('aria-label','Weitere Aktionen');
  top.appendChild(loadBtn); top.appendChild(mb);
  const box=document.createElement('div'); box.className='prow-more'; more.forEach(b=>box.appendChild(b)); row.appendChild(box);
  mb.addEventListener('click', e=>{ e.stopPropagation(); const open=!row.classList.contains('open');
    (row.parentNode||patternList).querySelectorAll('.pattern-row.open').forEach(r=>{ r.classList.remove('open'); const x=r.querySelector('.prow-top .prow-btn:last-child'); if(x) x.classList.remove('on'); });
    row.classList.toggle('open',open); mb.classList.toggle('on',open); });
}
async function refreshPatternList(){
  if(beatTab!=='all'){ return beatRenderGroupList(); }
  const items=await listPatternsFromIndexedDB();
  patternList.innerHTML='';
  if(items.length===0){
    const empty=document.createElement('div'); empty.id='patternEmpty'; empty.textContent='Noch keine gespeicherten Beats';
    patternList.appendChild(empty); return;
  }
  items.forEach(item=>{
    const row=document.createElement('div'); row.className='pattern-row'+(item.id===currentLoadedPatternId?' active':'');

    const meta=document.createElement('div'); meta.className='prow-meta';
    const nameEl=document.createElement('div'); nameEl.className='pname'; nameEl.textContent=item.name;
    const dateEl=document.createElement('div'); dateEl.className='pdate';
    dateEl.textContent = item.id===currentLoadedPatternId ? '● aktiv' : new Date(item.savedAt).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    meta.appendChild(nameEl); meta.appendChild(dateEl);
    row.appendChild(meta);

    

    const loadBtn=document.createElement('button'); loadBtn.className='prow-btn pload'; loadBtn.innerHTML=UI_IC.play; loadBtn.title='Laden'; loadBtn.setAttribute('aria-label','Laden');
    loadBtn.addEventListener('click', async ()=>{
      const data=await loadPatternFromIndexedDB(item.id);
      if(data){ applyPatternData(data); setCurrentLoadedPattern(item.id, item.name); rememberLastPattern(item.id); pbMarkClean(); }
      patternsOverlay.classList.remove('open');
      syncBottomBarVisibility();
    });

    const copyBtn=document.createElement('button'); copyBtn.className='act sec'; copyBtn.innerHTML=UI_IC.dup+'Duplizieren'; copyBtn.title='Duplizieren';
    copyBtn.addEventListener('click', async (e)=>{
      e.stopPropagation();
      const existingNames=new Set((await listPatternsFromIndexedDB()).map(p=>p.name));
      const newName=uniqueName(item.name+' (Kopie)', existingNames);
      const newData=Object.assign({}, item, { id:genId(), name:newName, savedAt:Date.now() });
      await savePatternToIndexedDB(newData);
      applyPatternData(newData);
      setCurrentLoadedPattern(newData.id, newData.name);
      rememberLastPattern(newData.id); pbMarkClean();
      refreshPatternList();
      showPatternIOStatus('„'+item.name+'“ dupliziert als „'+newName+'“ und geladen');
    });

    const splitBtn=document.createElement('button'); splitBtn.className='act sec'; splitBtn.innerHTML=UI_IC.split+'Aufteilen'; splitBtn.title='In Beats pro Spurtyp aufteilen';
    splitBtn.addEventListener('click', (e)=>{ e.stopPropagation(); beatSplitLegacy(item); });

    const renameBtn=document.createElement('button'); renameBtn.className='act sec'; renameBtn.innerHTML=UI_IC.ren+'Umbenennen'; renameBtn.title='Umbenennen';
    renameBtn.addEventListener('click', (e)=>{ e.stopPropagation(); startRenamePattern(row, item); });

    const exportBtn=document.createElement('button'); exportBtn.className='act sec'; exportBtn.innerHTML=UI_IC.dl+'Exportieren'; exportBtn.title='Als JSON exportieren';
    exportBtn.addEventListener('click', (e)=>{ e.stopPropagation(); exportSinglePattern(item); });

    const delBtn=document.createElement('button'); delBtn.className='act sec prow-del'; delBtn.innerHTML=UI_IC.del+'Löschen'; delBtn.title='Löschen';
    delBtn.addEventListener('click', async (e)=>{
      e.stopPropagation();
      await deletePatternFromIndexedDB(item.id);
      refreshPatternList();
    });

    prowFinish(row, loadBtn, [copyBtn, renameBtn, splitBtn, exportBtn, delBtn]);
    patternList.appendChild(row);
  });
}
// Verwandelt eine Pattern-Row temporär in ein Umbenennen-Formular (Input + Speichern/
// Abbrechen) statt eines Browser-prompt() — bleibt optisch im Chassis-Look statt eines
// systemfremden Dialogs. Committen prüft auf Namenskollision (uniqueName) wie überall
// sonst im Beats-System.
function startRenamePattern(row, item){
  row.innerHTML='';
  row.classList.add('renaming');
  const input=document.createElement('input'); input.type='text'; input.className='prow-rename-input';
  input.value=item.name; input.maxLength=40;
  row.appendChild(input);
  const actions=document.createElement('div'); actions.className='prow-actions';
  const confirmBtn=document.createElement('button'); confirmBtn.className='prow-btn'; confirmBtn.innerHTML='✓'; confirmBtn.title='Speichern';
  const cancelBtn=document.createElement('button'); cancelBtn.className='prow-btn'; cancelBtn.innerHTML='✕'; cancelBtn.title='Abbrechen';
  actions.appendChild(confirmBtn); actions.appendChild(cancelBtn);
  row.appendChild(actions);
  input.focus(); input.select();
  const commit=()=>commitRenamePattern(item, input.value);
  confirmBtn.addEventListener('click', commit);
  cancelBtn.addEventListener('click', ()=> refreshPatternList());
  input.addEventListener('keydown', e=>{
    if(e.key==='Enter'){ e.preventDefault(); commit(); }
    if(e.key==='Escape'){ e.preventDefault(); refreshPatternList(); }
  });
}
async function commitRenamePattern(item, newNameRaw){
  const newName=newNameRaw.trim();
  if(!newName){ refreshPatternList(); return; }
  if(newName===item.name){ refreshPatternList(); return; }
  const others=(await listPatternsFromIndexedDB()).filter(p=>p.id!==item.id).map(p=>p.name);
  const finalName=uniqueName(newName, new Set(others));
  const data=await loadPatternFromIndexedDB(item.id);
  if(!data){ refreshPatternList(); return; }
  data.name=finalName;
  await savePatternToIndexedDB(data); // gleiche id -> gleicher Key, nur Inhalt aktualisiert
  // Bugfix: falls das umbenannte Pattern gerade geladen ist, LCD-Anzeige mit aktualisieren —
  // vorher blieb dort der alte Name stehen, bis manuell neu geladen wurde.
  if(item.id===currentLoadedPatternId) setCurrentLoadedPattern(item.id, finalName);
  showPatternIOStatus('Umbenannt zu „'+finalName+'“'+(finalName!==newName?' (Name bereits vergeben)':''));
  refreshPatternList();
}
// Öffnen der Beats-Bibliothek läuft jetzt über lcdPatternBtn (s.o.), nicht mehr
// über einen eigenen Bottom-Bar-Chip.
patternsOverlayCloseBtn.addEventListener('click', ()=>{ patternsOverlay.classList.remove('open'); syncBottomBarVisibility(); });


// =========================================================================
// PATTERN-EXPORT/IMPORT — Beats als JSON-Datei sichern bzw. wieder einlesen.
// Wichtig: exportiert wird nur die strukturelle Pattern-Beschreibung (Steps,
// Tempo, Kit-Auswahl, Effekt-/Track-Werte) — genau das, was collectPatternData/
// applyPatternData ohnehin verwenden. Über das Mikrofon aufgenommene Samples
// (MIC-SAMPLE-Track, Sample-Pads) liegen als Audio-Blobs in einem separaten
// IndexedDB-Store und sind NICHT Teil dieser Datei; sie bleiben rein lokal.
// =========================================================================
const patternIOStatusEl=document.getElementById('patternIOStatus');
let patternIOStatusTimer=null;
function showPatternIOStatus(msg, isError){
  patternIOStatusEl.textContent=msg;
  patternIOStatusEl.classList.toggle('err', !!isError);
  clearTimeout(patternIOStatusTimer);
  patternIOStatusTimer=setTimeout(()=>{ patternIOStatusEl.textContent=''; }, 4500);
}
function ioStamp(){ return new Date().toISOString().slice(0,16).replace(/[:T]/g,'-'); }
// Reicht eine erzeugte Datei an die Person weiter. Im veröffentlichten Claude-Artefakt ist ein
// simpler <a download>-Klick wirkungslos (Sandbox) — dort läuft es über die downloads-Capability
// (Bestätigungsdialog beim Betrachter). Im echten Deployment (GitHub Pages o.ä.) existiert
// window.claude nicht, dort greift ganz normal der klassische Browser-Download.
async function offerFileToViewer(filename, blob){
  if(window.claude && window.claude.use){
    try{
      const downloads=await window.claude.use('downloads');
      if(downloads){ await downloads.save({filename, data:blob}); return; }
    } catch(err){
      if(err && err.code==='declined') return; // Betrachter hat abgelehnt — kein Fallback erzwingen
      console.warn('downloads-Capability fehlgeschlagen, Fallback auf Browser-Download:', err);
    }
  }
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}
async function downloadJson(obj, filename){
  const blob=new Blob([JSON.stringify(obj,null,2)], {type:'application/json'});
  await offerFileToViewer(filename, blob);
}
function makeExportPayload(patterns){
  return { app:'MRM-44', kind:'mrm44-patterns', formatVersion:1, exportedAt:Date.now(), patterns };
}
async function exportAllPatterns(){
  const items=await listPatternsFromIndexedDB();
  if(items.length===0){ showPatternIOStatus('Keine gespeicherten Beats zum Exportieren', true); return; }
  await downloadJson(makeExportPayload(items), 'mrm44-beats-'+ioStamp()+'.json');
  showPatternIOStatus(items.length+' Beat'+(items.length===1?'':'s')+' exportiert');
}
function exportSinglePattern(item){
  const safeName=(item.name||'beat').replace(/[^a-z0-9\-_]+/gi,'_').slice(0,40) || 'beat';
  downloadJson(makeExportPayload([item]), 'mrm44-'+safeName+'-'+ioStamp()+'.json');
  showPatternIOStatus('„'+item.name+'“ exportiert');
}
document.getElementById('patternExportAllBtn').addEventListener('click', exportAllPatterns);

const patternImportInput=document.getElementById('patternImportInput');
document.getElementById('patternImportBtn').addEventListener('click', ()=> patternImportInput.click());
patternImportInput.addEventListener('change', async (e)=>{
  const file=e.target.files[0];
  patternImportInput.value=''; // zurücksetzen, damit dieselbe Datei erneut wählbar bleibt
  if(!file) return;
  try{
    const text=await file.text();
    const parsed=JSON.parse(text);
    // Akzeptiert sowohl das eigene Export-Format ({patterns:[...]}) als auch ein
    // rohes Array oder ein einzelnes Pattern-Objekt (z. B. bei manuell editierten Dateien).
    const incoming = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed.patterns) ? parsed.patterns
      : (parsed && Array.isArray(parsed.tracks)) ? [parsed]
      : null;
    if(!incoming || incoming.length===0) throw new Error('Kein gültiges Beat-Format gefunden');

    const existingNames=new Set((await listPatternsFromIndexedDB()).map(p=>p.name));
    let imported=0, renamed=0;
    for(const p of incoming){
      if(!p || !p.name || !Array.isArray(p.tracks)) continue; // grobe Plausibilitätsprüfung pro Eintrag
      const name=uniqueName(p.name, existingNames);
      if(name!==p.name) renamed++;
      existingNames.add(name);
      // Immer eine frische lokale id vergeben (nie eine importierte id übernehmen) —
      // vermeidet Kollisionen mit lokal bereits vorhandenen IDs aus anderer Quelle.
      await savePatternToIndexedDB(Object.assign({}, p, { id:genId(), name, savedAt:Date.now() }));
      imported++;
    }
    if(imported===0) throw new Error('Keine gültigen Beats in der Datei gefunden');
    refreshPatternList();
    showPatternIOStatus(imported+' Beat'+(imported===1?'':'s')+' importiert'+(renamed?' · '+renamed+'x umbenannt (Namenskonflikt)':''));
  } catch(err){
    console.warn('Beat-Import fehlgeschlagen:', err);
    showPatternIOStatus('Import fehlgeschlagen — Datei ungültig', true);
  }
});

// ---- Fill-In-Overlay ----
const fillToggleBtn=document.getElementById('fillBtn'); // Fill-Taste in der Drums-Zeile (Licht = aktiv)
const fillOverlay=document.getElementById('fillOverlay');
const fillLenChips=document.getElementById('fillLenChips');
const fillEveryChips=document.getElementById('fillEveryChips');
const fillEnableBtn=document.getElementById('fillEnableBtn');
const FILL_LEN_OPTIONS=[2,4,8,16];
const FILL_EVERY_OPTIONS=[1,2,4,8];
const fillLenChipEls={}, fillEveryChipEls={};
FILL_LEN_OPTIONS.forEach(len=>{
  const c=document.createElement('div'); c.className='fill-chip'+(len===fillLengthSteps?' active':'');
  c.textContent=len;
  c.addEventListener('click', ()=>{
    fillLengthSteps=len;
    FILL_LEN_OPTIONS.forEach(l=>fillLenChipEls[l].classList.toggle('active', l===fillLengthSteps));
  });
  fillLenChipEls[len]=c; fillLenChips.appendChild(c);
});
FILL_EVERY_OPTIONS.forEach(n=>{
  const c=document.createElement('div'); c.className='fill-chip'+(n===fillEveryN?' active':'');
  c.textContent=n;
  c.addEventListener('click', ()=>{
    fillEveryN=n;
    FILL_EVERY_OPTIONS.forEach(x=>fillEveryChipEls[x].classList.toggle('active', x===fillEveryN));
  });
  fillEveryChipEls[n]=c; fillEveryChips.appendChild(c);
});
// Intensität: Slider statt Knob — auf dem Handy leichter zu treffen als ein
// Drehregler, gerade in einem Vollbild-Overlay mit viel horizontalem Platz.
const fillIntensitySlider=document.getElementById('fillIntensitySlider');
const fillIntensityValue=document.getElementById('fillIntensityValue');
fillIntensitySlider.value=Math.round(fillIntensity*100);
fillIntensityValue.textContent=fillIntensitySlider.value+'%';
fillIntensitySlider.addEventListener('input', ()=>{
  fillIntensity=parseInt(fillIntensitySlider.value,10)/100;
  fillIntensityValue.textContent=fillIntensitySlider.value+'%';
});

// ---- Stil-Auswahl-Chips: mehrere gleichzeitig aktivierbar, mindestens einer
// muss immer an bleiben (sonst hätte der Zufall keine Auswahl mehr) ----
const fillStyleChipsWrap=document.getElementById('fillStyleChips');
const fillStyleChipEls={};
FILL_STYLE_INFO.forEach(({id,label})=>{
  const c=document.createElement('div'); c.className='fill-style-chip active'; c.textContent=label;
  c.addEventListener('click', ()=>{
    const enabledCount=FILL_STYLE_INFO.filter(s=>fillStyleEnabled[s.id]).length;
    if(fillStyleEnabled[id] && enabledCount<=1) return; // letzten aktiven Stil nicht abschaltbar machen
    fillStyleEnabled[id]=!fillStyleEnabled[id];
    c.classList.toggle('active', fillStyleEnabled[id]);
  });
  fillStyleChipEls[id]=c;
  fillStyleChipsWrap.appendChild(c);
});

fillEnableBtn.classList.toggle('on', fillEnabled);
fillToggleBtn.classList.toggle('on', fillEnabled); // Fill-Chip im Transport-Bereich spiegelt nur den Aktiv-Zustand, blinkt nicht mehr pro Step
fillEnableBtn.addEventListener('click', ()=>{
  fillEnabled=!fillEnabled;
  fillEnableBtn.classList.toggle('on', fillEnabled);
  fillEnableBtn.textContent = fillEnabled ? 'Fill aktiv' : 'Fill aus';
  fillToggleBtn.classList.toggle('on', fillEnabled);
});
// Fill-Tab-Klick-Handler wird weiter unten zentral über switchTab() gesetzt.

// ---- Song-Tab ----
const songToggleBtn=document.getElementById('songToggleBtn');
const songOverlay=document.getElementById('songOverlay');
// Song-Tab-Klick-Handler wird weiter unten zentral über switchTab() gesetzt.

// Schließt die verbleibenden echten Modals (Tempo/Beats/Kit-Picker/Trim) — die 5
// Bereiche Pattern/Fill/Pads/Mixer/Song sind jetzt Tabs, keine Overlays mehr, und
// laufen über switchTab() (s.u.), nicht mehr über diese Funktion.
const tabPattern=document.getElementById('tabPattern');
const patternTabBtn=document.getElementById('patternTabBtn');
const bottomTabBar=document.getElementById('bottomTabBar');
// Einzige Quelle der Wahrheit: bei jeder Änderung an einem der vier echten Modals aufgerufen,
// statt einen separaten "suppressed"-Flag mitzuführen, der aus dem Ruder laufen könnte.
function switchTabIsSong(){ return songOverlay.classList.contains('open'); }
function syncBottomBarVisibility(){
  const anyModalOpen=[tempoOverlay, patternsOverlay, kitPickerOverlay, soundPickerOverlay, sampleEditorOverlay, xyOverlay, drumSetOverlay, document.getElementById('prWin')]
    .some(el=> el && el.classList.contains('open'));
  bottomTabBar.classList.toggle('overlay-hidden', anyModalOpen);
}
function closeAllOverlays(){
  closeSheets(); closeMenus();
  [tempoOverlay, patternsOverlay, kitPickerOverlay, soundPickerOverlay, sampleEditorOverlay, xyOverlay, drumSetOverlay, document.getElementById('prWin'), kitConfirm, document.getElementById('kitDelConfirm')].forEach(el=>{ if(el) el.classList.remove('open'); });
  xyClear();
  syncBottomBarVisibility();
}
// Blendet genau eines der 5 Tab-Panels ein (Pattern/Fill/Pads/Mixer/Song), alle
// anderen aus, und markiert den passenden Bottom-Bar-Button als aktuell aktiv.
// Ersetzt das frühere "Overlay öffnen/schließen"-Modell — kein Schließen-Button
// mehr nötig, da immer genau ein Panel sichtbar ist.
const TAB_PANELS={ pattern:tabPattern, pads:padOverlay, mixer:mixerOverlay, song:songOverlay };
function switchTab(name){
  closeAllOverlays();
  Object.keys(TAB_PANELS).forEach(k=> TAB_PANELS[k].classList.toggle('open', k===name));
  document.querySelectorAll('.tab-item[data-tab]').forEach(b=> b.classList.toggle('current', b.dataset.tab===name));
  if(name==='mixer'){
    mixerFit();
    Promise.resolve(initAudio()).then(()=>{ if(!mixerMeterRAF) mixerMeterRAF=requestAnimationFrame(mixerMeterLoop); });
  }
  if(name==='song'){
    ovRender(); songRefreshList();
  }
}
patternTabBtn.addEventListener('click', ()=> switchTab('pattern'));
fillToggleBtn.addEventListener('click', ()=> openSheet('fillSheet'));
padsToggleBtn.addEventListener('click', ()=> switchTab('pads'));
mixerToggleBtn.addEventListener('click', ()=> switchTab('mixer'));
songToggleBtn.addEventListener('click', ()=> switchTab('song'));

// ---- Song-Übersicht (Arrangement): Bedienung ----
const arrToggle=document.getElementById('arrToggle'), ovRows=document.getElementById('ovRows'), ovToast=document.getElementById('ovToast');
let ovToastTimer=null, ovSel=null;
function ovSay(m){ ovToast.textContent=m; clearTimeout(ovToastTimer); ovToastTimer=setTimeout(()=>{ ovToast.textContent=''; },3000); }
function ovPreview(g, b){
  const trs=arrGroupTracks(g.id); let svg='<svg viewBox="0 0 16 10" preserveAspectRatio="none">';
  for(let s=0;s<16;s++){ const n=trs.filter(t=>clipV(t.id,b*16+s)>0).length; if(n){ const hh=Math.max(2,Math.min(10,n/3*10)); svg+='<rect x="'+s+'" y="'+(10-hh)+'" width="0.7" height="'+hh+'" fill="#8fd4ff"/>'; } }
  return svg+'</svg>';
}
function ovRender(){
  arrToggle.querySelectorAll('button').forEach(b=>b.classList.toggle('on', (b.dataset.v==='1')===!!arr.enabled));
  document.querySelectorAll('#arrBars button').forEach(b=>b.classList.toggle('on', +b.dataset.b===arr.bars));
  ovRows.innerHTML='';
  const rl=document.createElement('div'); rl.className='ar-rl'; rl.style.gridTemplateColumns='repeat('+arr.bars+',1fr)';
  for(let b=0;b<arr.bars;b++){ const sp=document.createElement('span'); sp.textContent=(b%4===0)?(b+1):'·'; rl.appendChild(sp); }
  ovRows.appendChild(rl);
  ARR_GROUPS.forEach(g=>{
    const trs=arrGroupTracks(g.id), row=document.createElement('div'); row.className='ar-row';
    const lab=document.createElement('div'); lab.className='ar-lab';
    lab.innerHTML='<span>'+g.label+'</span><span class="ar-ms"><button class="m'+(trs.every(t=>t.muted)?' on':'')+'">M</button><button class="s'+(trs.every(t=>t.solo)?' on':'')+'">S</button><button class="r" aria-label="Würfeln">'+UI_IC.dice+'</button></span>';
    const [bm,bs,br]=lab.querySelectorAll('button');
    bm.onclick=()=>{ const all=trs.every(t=>t.muted); trs.forEach(t=>{ if(!!t.muted===all) toggleTrackMute(t); }); ovRender(); };
    bs.onclick=()=>{ const all=trs.every(t=>t.solo); trs.forEach(t=>{ if(!!t.solo===all) toggleTrackSolo(t); }); ovRender(); };
    br.onclick=()=>{ trs.forEach(t=>randomizeTrackPattern(t)); renderAllForPage(); ovSay('Arbeits-Pattern '+g.label+' gewürfelt — Takte neu einsetzen'); };
    row.appendChild(lab);
    const tl=document.createElement('div'); tl.className='ar-tl'; tl.style.gridTemplateColumns='repeat('+arr.bars+',1fr)';
    for(let b=0;b<arr.bars;b++){
      const cell=document.createElement('div'), clip=arrClipAt(g.id,b); cell.className='ar-cell'+(clip?' f':'')+(clip && ovSel && ovSel.gid===g.id && ovSel.start===clip.start ? ' sel':''); cell.dataset.bar=b;
      if(clip) cell.innerHTML=ovPreview(g,b);
      cell.onclick=()=>{ if(clip){ ovSel=(ovSel && ovSel.gid===g.id && ovSel.start===clip.start) ? null : {gid:g.id,start:clip.start}; } else { arrStamp(g.id,b); ovSel=null; } ovRender(); };
      tl.appendChild(cell);
    }
    row.appendChild(tl); ovRows.appendChild(row);
  });
  if(typeof trSongDecorate==='function') trSongDecorate(ovRows); // #13: Spurname antippen = Aktionen, „+ Spur“
  ovActionsRender();
}
// ---- Clips bearbeiten: Clip ins Arbeits-Pattern laden, im Pattern-Tab bearbeiten, zurückschreiben ----
const ovActions=document.getElementById('ovActions'), ovActName=document.getElementById('ovActName');
const clipBanner=document.getElementById('clipBanner'), cbName=document.getElementById('cbName');
function clipLabel(g,c){ return g.label+' · Takt '+(c.start+1)+(c.bars>1?'–'+(c.start+c.bars):''); }
function ovActionsRender(){
  if(ovSel && !arrClipAt(ovSel.gid, ovSel.start)) ovSel=null;
  ovActions.style.display=ovSel?'flex':'none';
  if(ovSel){ ovActName.textContent=clipLabel(ARR_GROUPS.find(x=>x.id===ovSel.gid), arrClipAt(ovSel.gid, ovSel.start)); }
}
function arrDuplicate(gid, start){
  const first=arrGroupTracks(gid)[0], c=(arr.clips[first.id]||[]).find(x=>x.start===start); if(!c) return false;
  const ns=start+c.bars; if(ns>=arr.bars) return false;
  const bars=Math.min(c.bars, arr.bars-ns), n=bars*16;
  arrGroupTracks(gid).forEach(tr=>{
    const src=(arr.clips[tr.id]||[]).find(x=>x.start===start); if(!src) return;
    const list=(arr.clips[tr.id]||[]).filter(x=>!(x.start<ns+bars && x.start+x.bars>ns));
    list.push(src.events ? evClip(src.events,ns,bars,n) : {start:ns, bars, steps:src.steps.slice(0,n), notes:(src.notes||[]).slice(0,n), slides:(src.slides||[]).slice(0,n)});
    list.sort((p,q)=>p.start-q.start); arr.clips[tr.id]=list;
  });
  return ns;
}
function clipEditStart(){
  if(!ovSel) return;
  const g=ARR_GROUPS.find(x=>x.id===ovSel.gid), trs=arrGroupTracks(g.id), c0=arrClipAt(g.id, ovSel.start); if(!c0) return;
  if(isPlaying) stop();
  const n=c0.bars*16;
  if(n>PATTERN_LENGTH) setPatternLength(n); // erweitert nur, andere Spuren werden mit "aus" aufgefüllt
  trs.forEach(tr=>{
    const c=(arr.clips[tr.id]||[]).find(x=>x.start===c0.start)||{steps:[],notes:[],slides:[]};
    if(tr.type==='arp'){ hmReset(tr); tr.events=(c.events||[]).filter(e=>e.s<n).map(e=>Object.assign({},e,{l:Math.max(1,Math.min(e.l,n-e.s))})); evTouch(tr); return; }
    for(let i=0;i<PATTERN_LENGTH;i++){
      tr.steps[i]= i<n ? (c.steps[i]||0) : VEL_OFF;
      if(tr.notes) tr.notes[i]= i<n ? ((c.notes&&c.notes[i])||0) : 0;
      if(tr.slides) tr.slides[i]= i<n ? !!(c.slides&&c.slides[i]) : false;
    }
  });
  editClip={gid:g.id, start:c0.start, bars:c0.bars};
  cbName.textContent=clipLabel(g,c0);
  clipBanner.style.display='flex';
  switchTab('pattern'); selectTrack(TRACKS.indexOf(trs[0])); renderAllForPage();
}
function clipEditEnd(){ editClip=null; if(clipBanner) clipBanner.style.display='none'; }
document.getElementById('ovEdit').addEventListener('click', clipEditStart);
document.getElementById('ovDup').addEventListener('click', ()=>{
  if(!ovSel) return; const ns=arrDuplicate(ovSel.gid, ovSel.start);
  if(ns===false) ovSay('Kein Platz hinter dem Clip'); else { ovSel={gid:ovSel.gid, start:ns}; ovSay('Clip dupliziert'); }
  ovRender();
});
document.getElementById('ovDel').addEventListener('click', ()=>{ if(!ovSel) return; arrRemove(ovSel.gid, ovSel.start); ovSel=null; ovRender(); });
document.getElementById('cbSave').addEventListener('click', ()=>{
  if(!editClip) return; if(isPlaying) stop();
  const e=editClip; arrStamp(e.gid, e.start, e.bars); clipEditEnd(); ovSel={gid:e.gid, start:e.start};
  switchTab('song'); ovSay('Clip zurückgeschrieben');
});
document.getElementById('cbCancel').addEventListener('click', ()=>{ clipEditEnd(); switchTab('song'); });
function ovPlayhead(bar){ ovRows.querySelectorAll('.ar-cell').forEach(c=>c.classList.toggle('ph', +c.dataset.bar===bar)); }
document.getElementById('arrHelpBtn').addEventListener('click', ()=>{ const h=document.getElementById('arrHelp'); h.classList.toggle('open'); document.getElementById('arrHelpBtn').classList.toggle('on', h.classList.contains('open')); });
arrToggle.addEventListener('click', (e)=>{
  const tb=e.target.closest('button'); if(!tb || (tb.dataset.v==='1')===!!arr.enabled) return;
  if(isPlaying) stop();
  arr.enabled=!arr.enabled;
  if(arr.enabled && !arrHasClips()) arrFillAll(); // Startzustand: aktuelles Pattern über alle Takte und Gruppen
  if(!arr.enabled) ovPlayhead(-1);
  ovRender();
});
document.querySelectorAll('#arrBars button').forEach(b=>b.addEventListener('click', ()=>{ arrResize(+b.dataset.b); ovRender(); }));
// ---- Song speichern/laden (IndexedDB-Store "songs"): kompletter Zustand + Arrangement ----
async function songPut(d){ const db=await idbOpen(); db.transaction(IDB_SONGS,'readwrite').objectStore(IDB_SONGS).put(d, d.id); }
async function songGet(id){ const db=await idbOpen(); return new Promise((res,rej)=>{ const r=db.transaction(IDB_SONGS,'readonly').objectStore(IDB_SONGS).get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function songDel(id){ const db=await idbOpen(); db.transaction(IDB_SONGS,'readwrite').objectStore(IDB_SONGS).delete(id); }
async function songAll(){
  const db=await idbOpen(), out=[];
  await new Promise((res,rej)=>{ const q=db.transaction(IDB_SONGS,'readonly').objectStore(IDB_SONGS).openCursor(); q.onsuccess=e=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(); }; q.onerror=()=>rej(q.error); });
  return out.sort((a,b)=>b.savedAt-a.savedAt);
}
let currentSongId=null, currentSongName=null;
const songNameInput=document.getElementById('songNameInput'), songSaveBtn=document.getElementById('songSaveBtn'), songUpdateBtn=document.getElementById('songUpdateBtn');
const songListEl=document.getElementById('songList'), ovTitle=document.getElementById('ovTitle');
function songCollect(name,id){
  const d=collectPatternData(name,id);
  d.kind='song';
  d.arrangement={enabled:arr.enabled, bars:arr.bars, clips:JSON.parse(JSON.stringify(arr.clips))};
  return d;
}
function songApply(d){
  applyPatternData(d); // Tempo, Kit, Spur-Einstellungen, Arbeits-Pattern, Fill, Acid-Auto (stoppt die Wiedergabe)
  const a=d.arrangement||{};
  arr.bars=[4,8,16].indexOf(a.bars)>=0 ? a.bars : 8;
  arr.clips=a.clips ? JSON.parse(JSON.stringify(a.clips)) : {};
  arr.enabled=!!a.enabled;
  ovRender();
}
function songUpdateUI(){
  songUpdateBtn.style.display=currentSongId?'':'none';
  ovTitle.textContent=currentSongName ? 'SONG · '+currentSongName : 'SONG · ÜBERSICHT';
}
function songSetCurrent(id,name){
  currentSongId=id; currentSongName=name;
  setCurrentLoadedPattern(null, name ? '♫ '+name : null); // Arbeits-Pattern gehört jetzt zum Song, nicht zu einem Beat
  try{ if(id) localStorage.setItem('mrm44_lastSongId', id); else localStorage.removeItem('mrm44_lastSongId'); }catch(e){}
  songUpdateUI();
}
async function songRefreshList(){
  const items=await songAll(); songListEl.innerHTML='';
  if(!items.length){ const e=document.createElement('div'); e.className='sg-empty'; e.textContent='Noch keine gespeicherten Songs'; songListEl.appendChild(e); return; }
  items.forEach(it=>{
    // #41: Zeile wie bei den Beats (▶ + ⋯, dahinter Exportieren und Löschen)
    const row=document.createElement('div'); row.className='pattern-row'+(it.id===currentSongId?' active':'');
    const meta=document.createElement('div'); meta.className='prow-meta';
    const nameEl=document.createElement('div'); nameEl.className='pname'; nameEl.textContent=it.name;
    const dateEl=document.createElement('div'); dateEl.className='pdate';
    dateEl.textContent=it.id===currentSongId ? '● aktiv' : new Date(it.savedAt).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    meta.appendChild(nameEl); meta.appendChild(dateEl); row.appendChild(meta);
    const loadBtn=document.createElement('button'); loadBtn.className='prow-btn pload'; loadBtn.innerHTML=UI_IC.play; loadBtn.title='Laden'; loadBtn.setAttribute('aria-label','Laden');
    loadBtn.onclick=async()=>{ const d=await songGet(it.id); if(d){ songApply(d); songSetCurrent(it.id,it.name); songRefreshList(); ovSay('„'+it.name+'“ geladen'); } };
    const exportBtn=document.createElement('button'); exportBtn.className='act sec'; exportBtn.innerHTML=UI_IC.dl+'Exportieren'; exportBtn.title='Als JSON exportieren';
    exportBtn.onclick=e=>{ e.stopPropagation(); exportSingleSong(it); };
    const delBtn=document.createElement('button'); delBtn.className='act sec prow-del'; delBtn.innerHTML=UI_IC.del+'Löschen'; delBtn.title='Löschen';
    delBtn.onclick=async e=>{ e.stopPropagation(); await songDel(it.id); if(it.id===currentSongId) songSetCurrent(null,null); songRefreshList(); };
    prowFinish(row, loadBtn, [exportBtn, delBtn]);
    songListEl.appendChild(row);
  });
}
// ---- Songs als Datei sichern/laden (#41), analog zu den Beats ----
const songIOStatusEl=document.getElementById('songIOStatus'); let songIOStatusTimer=null;
function showSongIOStatus(msg, isError){
  songIOStatusEl.textContent=msg; songIOStatusEl.classList.toggle('err', !!isError);
  clearTimeout(songIOStatusTimer); songIOStatusTimer=setTimeout(()=>{ songIOStatusEl.textContent=''; }, 4500);
}
function makeSongExportPayload(songs){ return { app:'MRM-44', kind:'mrm44-songs', formatVersion:1, exportedAt:Date.now(), songs }; }
async function exportAllSongs(){
  const items=await songAll();
  if(!items.length){ showSongIOStatus('Keine gespeicherten Songs zum Exportieren', true); return; }
  await downloadJson(makeSongExportPayload(items), 'mrm44-songs-'+ioStamp()+'.json');
  showSongIOStatus(items.length+' Song'+(items.length===1?'':'s')+' exportiert');
}
function exportSingleSong(item){
  const safeName=(item.name||'song').replace(/[^a-z0-9\-_]+/gi,'_').slice(0,40) || 'song';
  downloadJson(makeSongExportPayload([item]), 'mrm44-song-'+safeName+'-'+ioStamp()+'.json');
  showSongIOStatus('„'+item.name+'“ exportiert');
}
document.getElementById('songExportAllBtn').addEventListener('click', exportAllSongs);
const songImportInput=document.getElementById('songImportInput');
document.getElementById('songImportBtn').addEventListener('click', ()=> songImportInput.click());
songImportInput.addEventListener('change', async (e)=>{
  const file=e.target.files[0]; songImportInput.value=''; if(!file) return;
  try{
    const parsed=JSON.parse(await file.text());
    // Eigenes Format ({songs:[...]}), rohes Array oder einzelner Song (mit Arrangement)
    const incoming=Array.isArray(parsed) ? parsed
      : (parsed && Array.isArray(parsed.songs)) ? parsed.songs
      : (parsed && Array.isArray(parsed.tracks) && parsed.arrangement) ? [parsed] : null;
    if(!incoming || !incoming.length) throw new Error('Kein gültiges Song-Format gefunden');
    const names=new Set((await songAll()).map(s=>s.name)); let imported=0, renamed=0;
    for(const sg of incoming){
      if(!sg || !sg.name || !Array.isArray(sg.tracks) || !sg.arrangement) continue;
      const name=uniqueName(sg.name, names); if(name!==sg.name) renamed++; names.add(name);
      await songPut(Object.assign({}, sg, { id:genId(), name, kind:'song', savedAt:Date.now() })); // immer frische id
      imported++;
    }
    if(!imported) throw new Error('Keine gültigen Songs in der Datei gefunden');
    songRefreshList();
    showSongIOStatus(imported+' Song'+(imported===1?'':'s')+' importiert'+(renamed?' · '+renamed+'x umbenannt (Namenskonflikt)':''));
  } catch(err){
    console.warn('Song-Import fehlgeschlagen:', err);
    showSongIOStatus('Import fehlgeschlagen — Datei ungültig', true);
  }
});
songSaveBtn.addEventListener('click', async ()=>{
  const typed=songNameInput.value.trim(); if(!typed) return;
  const names=new Set((await songAll()).map(s=>s.name)), name=uniqueName(typed,names);
  const d=songCollect(name, genId()); await songPut(d);
  songSetCurrent(d.id,d.name); songNameInput.value=''; songRefreshList();
  ovSay(name!==typed ? 'Name vergeben — gespeichert als „'+name+'“' : '„'+name+'“ gespeichert');
});
songUpdateBtn.addEventListener('click', async ()=>{
  if(!currentSongId) return;
  await songPut(songCollect(currentSongName,currentSongId)); songRefreshList(); ovSay('„'+currentSongName+'“ aktualisiert');
});
async function restoreLastSong(){
  let id=null; try{ id=localStorage.getItem('mrm44_lastSongId'); }catch(e){}
  if(!id) return;
  try{ const d=await songGet(id); if(d){ songApply(d); songSetCurrent(id,d.name); songRefreshList(); } }
  catch(err){ console.warn('Zuletzt geöffneter Song konnte nicht geladen werden:', err); }
}
ovRender(); songRefreshList();
