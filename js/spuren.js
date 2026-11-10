// =========================================================================
// SPUREN HINZUFÜGEN (#13, Stufe 1: Melodiespuren). Mockup docs/mockups/issue-13.html, Variante C:
// „+ Spur hinzufügen“ + ⋯ im Spur-Menü (grpSelRender) und „+ Spur“ + Spurname antippen in der Song-Übersicht (ovRender).
// Spur = Eintrag in TRACKS mit tr.inst (Instrument im Register INSTR) und eigener ID; Original-Spuren haben id = Instrument.
// Gespeichert als data.mel=[{id,inst,label}] (melEntry); Laden legt an/entfernt (melSync). Ohne mel: ACID, COSMIC, KEYS.
// Drum-/Perc-Spuren hinzufügen = Stufe 2 (eigenes Issue).
// =========================================================================
const MEL_BASE=Object.keys(INSTR).map(k=>({id:k}));
const RESERVED_NAMES=['DRUMS','PERC','SAMPLE'];
function melEntry(tr){ const e={id:tr.id, inst:trInstKey(tr)}; if(tr.label) e.label=tr.label; return e; }
function melShort(l){ const s=l.replace(/\s+/g,'').toUpperCase(); return /\d$/.test(s) && s.length>3 ? s.slice(0,2)+s.slice(-1) : s.slice(0,3); }
function melCount(){ return TRACKS.filter(trInst).length; }
function melNameFree(n, self){ n=n.toUpperCase(); return RESERVED_NAMES.indexOf(n)<0 && !TRACKS.some(t=>t!==self && trInst(t) && trTitle(t)===n) && !DRUM_TRACKS.some(d=>d!==self && d.name===n); }
function melSuggest(base){ if(melNameFree(base)) return base; for(let i=2;;i++) if(melNameFree(base+' '+i)) return base+' '+i; }
function trSetLabel(tr, l){
  const tpl=instTpl(tr);
  if(l){ tr.label=l; tr.name=l; tr.short=melShort(l); }
  else { delete tr.label; tr.name=tpl.name; if(tpl.short) tr.short=tpl.short; else delete tr.short; }
  if(trUi(tr).ovLab) trUi(tr).ovLab.textContent=trShort(tr);
}
function instPickSound(tr, id){ const I=trInst(tr), S=I.sounds&&I.sounds(); if(S && S[id]){ tr.sound=id; Object.assign(tr, S[id].def); } }
// Neue Spur aus der Vorlage des Instruments (noch nicht in TRACKS)
function trCreate(k, o){
  const I=INSTR[k]; let id=o.id;
  if(!id){ id=k; for(let n=2; TRACKS.some(t=>t.id===id); n++) id=k+n; }
  const tr=Object.assign({}, I.tpl, {id, inst:k});
  tr._def=Object.assign({}, I.def);
  tr.steps=new Array(PATTERN_LENGTH).fill(VEL_OFF); tr.events=[]; tr._idx=null; tr.muted=false; tr.solo=false;
  tr.pan=0; tr.feel=0; tr.eqLowGain=0; tr.eqMidGain=0; tr.eqHighGain=0; tr.eqOn=true; tr.eqLc=0; tr.eqMf=EQ_MF_DEF; tr.fx=[];
  tr.harm=hmDefaultTrack(tr);
  trSetLabel(tr, o.label);
  return tr;
}
// In TRACKS + Übersicht einhängen (at = Index in TRACKS; ohne: hinter die letzte Spur desselben Instruments, sonst ans Ende)
function trAttach(tr, at){
  if(at==null){ at=TRACKS.length; TRACKS.forEach((t,i)=>{ if(trInst(t)===trInst(tr)) at=i+1; }); }
  TRACKS.splice(at, 0, tr);
  const nx=TRACKS[at+1]; ovRowMake(tr, nx ? trUi(nx).ovRow : null);
  if(audioCtx) ensureTrackBuses();
}
function trDetach(tr){
  const i=TRACKS.indexOf(tr); if(i<0) return;
  ['panner','sendGain','delaySendGain','analyser','post','bus'].forEach(k=>{ try{ if(tr[k]) tr[k].disconnect(); }catch(e){} });
  TRACKS.splice(i,1);
  const u=trUi(tr); if(u.ovRow) u.ovRow.remove(); TR_UI.delete(tr.id);
  delete arr.clips[tr.id]; if(fillOverride) delete fillOverride[tr.id];
}
// Nach jeder Änderung der Spurliste: Gruppen, Auswahl, Ansichten. sel = Spur, die danach gewählt ist
function melChanged(sel){
  arrGroupsBuild(); taResetUndo();
  if(prIsOpen() && TRACKS.indexOf(prTr)<0) prClose();
  if(klTr && TRACKS.indexOf(klTr)<0) closeSheets();
  let idx=sel ? TRACKS.indexOf(sel) : -1;
  if(idx<0) idx=TRACKS.findIndex(t=>groupOfTrack(t)===patternGroup);
  if(idx<0) idx=0;
  activeTrackIdx=idx; setPatternGroup(groupOfTrack(TRACKS[idx]), false); selectTrack(idx);
  mixerRebuild(); ovRender(); refreshSoloVisuals(); renderAllForPage(); if(prIsOpen()) prBuildMenu();
}
// Laden: Melodiespuren wie gespeichert (fehlende anlegen, überzählige entfernen, Reihenfolge). Leere Liste = alle gelöscht.
function melSync(list){
  if(!Array.isArray(list)) list=MEL_BASE;
  const seen={}; list=list.filter(e=>e && typeof e.id==='string' && INSTR[e.inst||e.id] && !seen[e.id] && (seen[e.id]=1)).slice(0,MEL_MAX);
  const cur=TRACKS[activeTrackIdx]; let changed=false;
  TRACKS.filter(t=>trInst(t) && !list.some(e=>e.id===t.id && (e.inst||e.id)===trInstKey(t))).forEach(t=>{ trDetach(t); changed=true; });
  list.forEach(e=>{
    let tr=TRACKS.find(t=>t.id===e.id);
    if(!tr){ tr=trCreate(e.inst||e.id, {id:e.id, label:e.label}); trAttach(tr, TRACKS.length); changed=true; }
    else if((tr.label||'')!==(e.label||'')){ trSetLabel(tr, e.label); changed=true; }
  });
  const mel=list.map(e=>TRACKS.find(t=>t.id===e.id)), now=TRACKS.filter(trInst);
  if(mel.some((t,i)=>now[i]!==t)){ const rest=TRACKS.filter(t=>!trInst(t)); TRACKS.length=0; TRACKS.push(...rest, ...mel); changed=true; }
  if(!changed) return;
  TRACKS.forEach(t=>overviewEl.appendChild(trUi(t).ovRow)); // Reihenfolge der Zeilen = TRACKS
  arrGroupsBuild(); taResetUndo();
  let idx=TRACKS.indexOf(cur); if(idx<0) idx=Math.max(0,TRACKS.findIndex(t=>groupOfTrack(t)===patternGroup));
  activeTrackIdx=idx; if(!ARR_GROUPS.some(g=>g.id===patternGroup)) patternGroup=groupOfTrack(TRACKS[idx]);
  if(prIsOpen() && TRACKS.indexOf(prTr)<0) prClose();
  setPatternGroup(groupOfTrack(TRACKS[idx]), false); mixerRebuild();
}
// Neue Spur (Sheet „Spur hinzufügen“ bzw. Kopieren). o={k,sound,label,src,notes}
function trAddNew(o){
  const tr=trCreate(o.k, {label:o.label});
  if(o.src){
    const same=trInstKey(o.src)===o.k, sv=trSave(same ? o.src : tr);
    if(!same){ sv.rootNote=o.src.rootNote; sv.scale=o.src.scale; }
    sv.events=o.notes ? JSON.parse(JSON.stringify(trOwnEvents(o.src))) : []; sv.harm=o.notes && same ? sv.harm : undefined;
    sv.muted=false; sv.solo=false;
    trLoadSaved(tr, sv);
  }
  if(o.sound && (!o.src || o.src.sound!==o.sound)) instPickSound(tr, o.sound);
  trAttach(tr, o.src ? TRACKS.indexOf(o.src)+1 : null);
  if(o.src) trApplyNodes(tr);
  if(hmOn(tr)){ tr.harmOwn=tr.events; hmRegen(tr); }
  if(o.src && o.notes && arr.clips[o.src.id]) arr.clips[tr.id]=JSON.parse(JSON.stringify(arr.clips[o.src.id])); // Clips im Song mit (Schichten)
  melChanged(tr);
  return tr;
}
function trApplyNodes(tr){ if(!tr.bus) return; tr.sendGain.gain.value=tr.reverbAmount||0; tr.delaySendGain.gain.value=tr.delaySend||0; tr.panner.pan.value=tr.pan||0; eqApply(tr,true); }
function trDelete(tr){
  if(isPlaying) stop();
  const snap={save:trSave(tr), mel:melEntry(tr), at:TRACKS.indexOf(tr), clips:arr.clips[tr.id] ? JSON.parse(JSON.stringify(arr.clips[tr.id])) : null};
  const name=trTitle(tr); trDetach(tr); melChanged(null);
  hmToast(name+' gelöscht', true, ()=>{
    if(TRACKS.some(t=>t.id===snap.mel.id) || melCount()>=MEL_MAX) return;
    const t=trCreate(snap.mel.inst, {id:snap.mel.id, label:snap.mel.label});
    trLoadSaved(t, snap.save); trAttach(t, Math.min(snap.at, TRACKS.length)); trApplyNodes(t);
    if(hmOn(t)){ t.harmOwn=t.events; hmRegen(t); }
    if(snap.clips) arr.clips[t.id]=snap.clips;
    melChanged(t);
  });
}
function trRename(tr, l){
  const tpl=instTpl(tr), def=tr.id===trInstKey(tr) ? trInst(tr).name : null;
  trSetLabel(tr, l===def ? null : l); melChanged(tr); trNamesRefresh();
}

// ---------- Sheets ----------
const trSheet=$id('trSheet');
const TR_IC={
  pen:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  copy:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/></svg>',
  del:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/></svg>',
  plus:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  dots:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>'};
// Kacheln: jedes Instrument, bei Klang-Auswahl (Keys) je Klang eine; Drums/Perc ausgegraut (Stufe 2)
function trTiles(){
  const out=[];
  Object.keys(INSTR).forEach(k=>{ const I=INSTR[k], c=I.tpl.color, S=I.sounds&&I.sounds();
    if(S) Object.keys(S).forEach(s=>out.push({k, sound:s, n:S[s].name, d:I.name, c}));
    else out.push({k, n:I.name, d:{arp:'303-Bass', cosmic:'Fläche · Arp'}[k]||'', c}); });
  DRUM_TRACKS.filter(d=>!dtExtra(d)).forEach(d=>out.push({drum:d.kind, n:d.name, d:'eigenes Kit', c:DT_COL[d.kind]}));
  return out;
}
function trSheetOpen(title, html){
  openSheet('trSheet');
  trSheet.innerHTML='<div class="sh"><span>'+title+'</span><button class="shx" aria-label="Schließen">✕</button></div>'+html;
  trSheet.querySelector('.shx').onclick=closeSheets;
}
function trAddSheet(src){
  const full=melCount()>=MEL_MAX, tiles=trTiles().filter(o=>!src || !o.drum);
  let sel=src ? tiles.find(o=>o.k===trInstKey(src) && (!o.sound || o.sound===src.sound)) : null;
  trSheetOpen(src ? 'Spur kopieren · '+trTitle(src) : 'Spur hinzufügen',
    '<div class="trs-lbl">INSTRUMENT</div><div class="trs-tiles">'+tiles.map((o,i)=>'<button class="trs-tile'+(o.soon?' soon':'')+'" data-i="'+i+'" style="--c:'+o.c+'"'+(o.soon?' disabled':'')+'><b>'+o.n+'</b><small>'+o.d+'</small></button>').join('')+'</div>'
    +'<div class="trs-lbl">NAME</div><input class="trs-in" id="trName" maxlength="12" autocomplete="off" spellcheck="false">'
    +(src ? '<label class="trs-chk"><input type="checkbox" id="trNotes" checked>Noten von '+trTitle(src)+' übernehmen</label>' : '')
    +(full ? '<div class="trs-hint">Höchstens '+MEL_MAX+' Melodiespuren – erst eine löschen.</div>' : '')
    +'<button class="trs-go" id="trGo">Hinzufügen</button>');
  const nm=$id('trName'), go=$id('trGo'); let typed=false;
  const check=()=>{ const v=nm.value.trim().toUpperCase(); go.disabled=full || !sel || !v || !melNameFree(v); };
  nm.addEventListener('input', ()=>{ typed=true; check(); });
  const pick=o=>{ sel=o; trSheet.querySelectorAll('.trs-tile').forEach(b=>b.classList.toggle('on', tiles[+b.dataset.i]===o)); if(!typed) nm.value=melSuggest(o.n); check(); };
  trSheet.querySelectorAll('.trs-tile').forEach(b=>{ const o=tiles[+b.dataset.i]; if(o.drum) b.onclick=()=>dtAddSheet(o.drum); else if(!o.soon) b.onclick=()=>pick(o); });
  if(sel) pick(sel); else check();
  go.onclick=()=>{ if(go.disabled) return; const label=nm.value.trim().toUpperCase();
    const tr=trAddNew({k:sel.k, sound:sel.sound, label, src, notes:src ? $id('trNotes').checked : false}); closeSheets();
    hmToast(label+' hinzugefügt', true, ()=>{ if(TRACKS.indexOf(tr)>=0){ trDetach(tr); melChanged(src||null); } }); };
}
function trRenameSheet(tr){
  trSheetOpen('Umbenennen · '+trTitle(tr), '<input class="trs-in" id="trName" maxlength="12" autocomplete="off" spellcheck="false"><button class="trs-go" id="trGo">Übernehmen</button>');
  const nm=$id('trName'), go=$id('trGo'); nm.value=trTitle(tr);
  const check=()=>{ const v=nm.value.trim().toUpperCase(); go.disabled=!v || !melNameFree(v, tr); };
  nm.addEventListener('input', check); check(); setTimeout(()=>{ nm.focus(); nm.select(); }, 60);
  go.onclick=()=>{ if(go.disabled) return; trRename(tr, nm.value.trim().toUpperCase()); closeSheets(); };
}
function trActSheet(tr){
  const s=instSound(tr), I=trInst(tr), full=melCount()>=MEL_MAX;
  const ti=trTitle(tr), sub=[I.name, s&&s.name].filter((x,i,a)=>x && x!==ti && a.indexOf(x)===i);
  trSheetOpen([ti].concat(sub).join(' · '),
    '<button class="nb-opt" data-a="ren">'+TR_IC.pen+'<span><b>Umbenennen</b><small>Name in Spur-Menü, Song und Mixer.</small></span></button>'
    +'<button class="nb-opt" data-a="cp"'+(full?' disabled':'')+'>'+TR_IC.copy+'<span><b>Als neue Spur kopieren</b><small>'+(full?'Höchstens '+MEL_MAX+' Melodiespuren.':'Gleiche Noten und Einstellungen, Instrument wählbar – z. B. zum Schichten.')+'</small></span></button>'
    +'<button class="nb-opt trs-del" data-a="del">'+TR_IC.del+'<span><b>Löschen</b><small>Mit Rückgängig.</small></span></button>');
  trSheet.querySelector('[data-a=ren]').onclick=()=>trRenameSheet(tr);
  trSheet.querySelector('[data-a=cp]').onclick=()=>{ if(!full) trAddSheet(tr); };
  trSheet.querySelector('[data-a=del]').onclick=()=>{ closeSheets(); trDelete(tr); };
}
// Einträge in Spur-Menü und Song (Aufruf aus grpSelRender / ovRender)
function trMenuDecorate(m){
  [...m.children].forEach((b,i)=>{ const g=ARR_GROUPS[i], d=g && dtById(g.id);
    if(d){ b.querySelector('small').textContent=KITS[d.kit] ? KITS[d.kit].name : ''; trDots(b, g.label, ()=>dtActSheet(d)); return; } });
  [...m.children].forEach((b,i)=>{ const g=ARR_GROUPS[i], tr=g && TRACKS.find(t=>t.id===g.ids[0]), I=trInst(tr); if(!I) return;
    const s=instSound(tr); b.querySelector('small').textContent=(g.label!==I.name ? I.name+(s?' · ':'') : '')+(s ? s.name : (g.label!==I.name ? '' : I.name));
    trDots(b, g.label, ()=>trActSheet(tr)); });
  const a=document.createElement('button'); a.className='grp-add'; a.innerHTML=TR_IC.plus+'Spur hinzufügen';
  a.onclick=()=>{ closeMenus(); trAddSheet(null); }; m.appendChild(a);
}
function trDots(b, label, fn){ b.classList.add('grp-has'); const d=document.createElement('span'); d.className='grp-dots'; d.setAttribute('role','button'); d.setAttribute('aria-label',label+' · Aktionen'); d.innerHTML=TR_IC.dots;
  d.onclick=e=>{ e.stopPropagation(); closeMenus(); fn(); }; b.appendChild(d); }
function trSongDecorate(rows){
  [...rows.querySelectorAll('.ar-row')].forEach((r,i)=>{ const g=ARR_GROUPS[i], d=g && dtById(g.id), tr=g && TRACKS.find(t=>t.id===g.ids[0]); if(!d && !trInst(tr)) return;
    const lab=r.querySelector('.ar-lab'); lab.classList.add('tap'); lab.firstChild.onclick=()=>d ? dtActSheet(d) : trActSheet(tr); });
  const b=document.createElement('button'); b.className='ov-add'; b.innerHTML=TR_IC.plus+'Spur'; b.onclick=()=>trAddSheet(null); rows.appendChild(b);
}

// =========================================================================
// WEITERE DRUM-/PERC-SPUREN (#70, Stufe 2; Mockup docs/mockups/issue-70.html B): Kit + Zeilen wählen.
// Spur = Eintrag in DRUM_TRACKS (id drums2/perc3 …) mit Zeilen „<Stimme>_<n>“ (rowBase = Stimme ab Werk).
// Eigener Mixer-Gruppen-Kanal (grpAdd), eigenes Kit/Set, Fill wird von DRUMS übernommen (fillLayer).
// DRUMS und PERC ab Werk bleiben (kein Löschen/Umbenennen: Altstände, Fill und Sets hängen daran).
// Gespeichert als data.drt=[{id,kind,name,rows}], Laden dtSync (fehlt = keine weiteren).
// =========================================================================
const DT_COL={drums:'#3fa9ff', perc:'#2dd4bf'};
const DT_ROLE_N={bd:'Kick',sd:'Snare',ch:'Hi-Hat',oh:'Open Hat',lt:'Low Tom',ht:'High Tom',cy:'Crash',rd:'Ride',rs:'Rim',hc:'Clap',cb:'Cowbell',cl:'Claves',mr:'Maracas'};
const dtExtras=()=>DRUM_TRACKS.filter(dtExtra);
function dtCreate(kind, o){
  const base=dtById(kind); let id=o.id;
  if(!id){ let n=2; while(dtById(kind+n)) n++; id=kind+n; }
  const n=id.slice(kind.length), bases=(o.rows||base.rows).map(rowBase).filter((b,i,a)=>base.rows.indexOf(b)>=0 && a.indexOf(b)===i);
  return Object.assign({}, base, {id, name:o.name, rows:bases.map(b=>b+'_'+n), kit:KITS[o.kit]?o.kit:base.kit, set:{id:null,name:null,dirty:false}});
}
function dtAttach(d, grpSaved){
  let at=DRUM_TRACKS.length; DRUM_TRACKS.forEach((x,i)=>{ if(x.kind===d.kind) at=i+1; }); DRUM_TRACKS.splice(at,0,d);
  d.rows.forEach(r=>ROW_DT[r]=d); grpAdd(d, grpSaved);
  let ti=0; TRACKS.forEach((t,i)=>{ const x=ROW_DT[t.id]; if(x && x!==d && x.kind===d.kind) ti=i+1; });
  d.rows.forEach(r=>{ const T=ROW_TPL[rowBase(r)];
    const tr=Object.assign({}, T, {id:r, _def:Object.assign({},T._def)});
    tr.steps=new Array(PATTERN_LENGTH).fill(VEL_OFF); tr.notes=new Array(PATTERN_LENGTH).fill(0); tr.slides=new Array(PATTERN_LENGTH).fill(false);
    tr.muted=false; tr.solo=false; tr.pan=0; tr.feel=0; tr.reverbAmount=T._def.reverbAmount||0; tr.delaySend=T._def.delaySend||0;
    tr.eqLowGain=0; tr.eqMidGain=0; tr.eqHighGain=0; tr.eqOn=true; tr.eqLc=0; tr.eqMf=EQ_MF_DEF; tr.fx=[];
    TRACKS.splice(ti,0,tr); const nx=TRACKS[ti+1]; ovRowMake(tr, nx ? trUi(nx).ovRow : null); ti++; });
  if(audioCtx) ensureTrackBuses();
}
function dtDetach(d){
  if(!dtExtra(d)) return;
  d.rows.forEach(r=>{ const t=TRACKS.find(x=>x.id===r); if(t) trDetach(t); delete drumSet.voices[r]; delete drumSet.buffers[r]; delete ROW_DT[r]; });
  const i=DRUM_TRACKS.indexOf(d); if(i>=0) DRUM_TRACKS.splice(i,1); grpRemove(d.id);
}
function dtEntry(d){ return {id:d.id, kind:d.kind, name:d.name, rows:d.rows.slice()}; }
// Laden: weitere Drum-Spuren wie gespeichert (fehlt = keine). Vor Kits/Sets/Gruppen/Spuren aufrufen.
function dtSync(list){
  if(!Array.isArray(list)) list=[];
  const ok=list.filter(e=>e && dtById(e.kind) && !dtExtra(dtById(e.kind)) && typeof e.id==='string' && new RegExp('^'+e.kind+'\\d+$').test(e.id) && e.id!==e.kind && Array.isArray(e.rows) && e.rows.length)
    .filter((e,i,a)=>a.findIndex(x=>x.id===e.id)===i).slice(0,DT_MAX_EXTRA);
  const same=(d,e)=>d.kind===e.kind && d.rows.join()===dtCreate(e.kind,{id:e.id,rows:e.rows,name:e.name}).rows.join();
  let changed=false;
  dtExtras().forEach(d=>{ const e=ok.find(x=>x.id===d.id); if(!e || !same(d,e)){ dtDetach(d); changed=true; } });
  ok.forEach(e=>{ let d=dtById(e.id);
    if(!d){ d=dtCreate(e.kind,{id:e.id, name:String(e.name||e.id).toUpperCase().slice(0,12), rows:e.rows}); dtAttach(d); changed=true; }
    else if(d.name!==e.name && e.name){ d.name=String(e.name).toUpperCase().slice(0,12); GRP_DEF[d.id]=grpDefOf(d); changed=true; } });
  if(!changed) return;
  arrGroupsBuild(); taResetUndo();
  if(!ARR_GROUPS.some(g=>g.id===patternGroup)) patternGroup='drums';
  if(!TRACKS[activeTrackIdx] || groupOfTrack(TRACKS[activeTrackIdx])!==patternGroup) activeTrackIdx=Math.max(0,TRACKS.findIndex(t=>groupOfTrack(t)===patternGroup));
  if(prIsOpen() && TRACKS.indexOf(prTr)<0) prClose();
  setPatternGroup(patternGroup, false); mixerRebuild();
}
function dtNameFree(n, self){ return melNameFree(n, self); }
function dtSuggest(kind){ const b=dtById(kind).name; for(let i=2;;i++) if(dtNameFree(b+' '+i)) return b+' '+i; }
function dtSelect(d){ const t=TRACKS.find(x=>x.id===d.rows[0]); melChanged(t); updateKitLabel(); }
// Neue Drum-Spur; src = Kopiervorlage (Noten, Klang je Zeile, Tausch, Set, Gruppen-Mix), notes = Noten mitnehmen
function dtAddNew(o){
  const d=dtCreate(o.kind, {name:o.name, rows:o.rows, kit:o.kit});
  if(o.src){ d.set=Object.assign({}, o.src.set); }
  dtAttach(d, o.src && grps[o.src.id]);
  if(o.src) d.rows.forEach(r=>{ const sr=o.src.rows.find(x=>rowBase(x)===rowBase(r)), st=sr && TRACKS.find(t=>t.id===sr), tr=TRACKS.find(t=>t.id===r); if(!st) return;
    const sv=Object.assign(trSave(st), {id:r}); if(!o.notes){ sv.steps=new Array(PATTERN_LENGTH).fill(VEL_OFF); sv.notes=undefined; }
    trLoadSaved(tr, sv); trApplyNodes(tr);
    if(drumSet.voices[sr]) drumSet.voices[r]=JSON.parse(JSON.stringify(drumSet.voices[sr]));
    if(o.notes && arr.clips[sr]) arr.clips[r]=JSON.parse(JSON.stringify(arr.clips[sr])); });
  if(o.src) drumSetLoadBuffers();
  if(audioCtx && FXG.g && FXG.g[d.id]){ grpFxRebuild(d.id); grpUpdate(d.id); }
  dtSelect(d);
  return d;
}
function dtDelete(d){
  if(isPlaying) stop();
  const snap={e:dtEntry(d), kit:d.kit, set:Object.assign({},d.set), grp:JSON.parse(JSON.stringify(grps[d.id]||{})),
    rows:d.rows.map(r=>{ const t=TRACKS.find(x=>x.id===r); return {sv:trSave(t), v:drumSet.voices[r] ? JSON.parse(JSON.stringify(drumSet.voices[r])) : null, c:arr.clips[r] ? JSON.parse(JSON.stringify(arr.clips[r])) : null}; })};
  dtDetach(d); patternGroup='drums'; melChanged(TRACKS.find(t=>t.id===DRUM_TRACKS[0].rows[0]));
  hmToast(snap.e.name+' gelöscht', true, ()=>{
    if(dtById(snap.e.id) || dtExtras().length>=DT_MAX_EXTRA) return;
    const n=dtCreate(snap.e.kind, {id:snap.e.id, name:snap.e.name, rows:snap.e.rows, kit:snap.kit}); n.set=snap.set; dtAttach(n, snap.grp);
    n.rows.forEach((r,i)=>{ const s=snap.rows[i], t=TRACKS.find(x=>x.id===r); trLoadSaved(t, s.sv); trApplyNodes(t); if(s.v) drumSet.voices[r]=s.v; if(s.c) arr.clips[r]=s.c; });
    drumSetLoadBuffers(); if(audioCtx && FXG.g && FXG.g[n.id]){ grpFxRebuild(n.id); grpUpdate(n.id); } dtSelect(n);
  });
}
function dtRename(d, l){ d.name=l; GRP_DEF[d.id]=grpDefOf(d); melChanged(TRACKS[activeTrackIdx]); updateKitLabel(); }
function dtAddSheet(kind, src){
  const base=dtById(kind), full=dtExtras().length>=DT_MAX_EXTRA, col=DT_COL[kind];
  const kits=Object.keys(KITS).filter(k=>(!KITS[k].hidden || (kind==='perc' && k==='latin')) && kitFits(k, base));
  let kit=src ? src.kit : base.kit, rows=src ? src.rows.map(rowBase) : base.rows.slice();
  trSheetOpen(src ? 'Spur kopieren · '+src.name : 'Spur hinzufügen · '+base.name,
    '<div class="trs-lbl">KIT</div><div class="trs-chips" id="dtKits">'+kits.map(k=>'<button class="trs-chip'+(k===kit?' on':'')+'" data-k="'+k+'" style="--c:'+col+'">'+KITS[k].name.replace(/ KIT$/,'')+'</button>').join('')+'</div>'
    +'<div class="trs-lbl">ZEILEN</div><div class="trs-chips" id="dtRows">'+base.rows.map(r=>'<button class="trs-chip'+(rows.indexOf(r)>=0?' on':'')+'" data-r="'+r+'" style="--c:'+col+'" aria-pressed="'+(rows.indexOf(r)>=0)+'">'+DT_ROLE_N[r]+'</button>').join('')+'</div>'
    +'<div class="trs-lbl">NAME</div><input class="trs-in" id="trName" maxlength="12" autocomplete="off" spellcheck="false">'
    +(src ? '<label class="trs-chk"><input type="checkbox" id="trNotes" checked>Noten von '+src.name+' übernehmen</label>' : '')
    +(full ? '<div class="trs-hint">Höchstens '+DT_MAX_EXTRA+' zusätzliche Drum-/Perc-Spuren – erst eine löschen.</div>' : '')
    +'<button class="trs-go" id="trGo">Hinzufügen</button>');
  const nm=$id('trName'), go=$id('trGo'); nm.value=dtSuggest(kind);
  const check=()=>{ const v=nm.value.trim().toUpperCase(); go.disabled=full || !v || !dtNameFree(v) || !rows.length; };
  nm.addEventListener('input', check);
  trSheet.querySelectorAll('[data-k]').forEach(b=>b.onclick=()=>{ kit=b.dataset.k; trSheet.querySelectorAll('[data-k]').forEach(x=>x.classList.toggle('on',x===b)); if(KITS[kit].samples && (!smp[kit] || smp[kit].state==='error')) smpLoad(kit); });
  trSheet.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>{ const on=!b.classList.contains('on'); b.classList.toggle('on',on); b.setAttribute('aria-pressed',on);
    rows=base.rows.filter(r=>trSheet.querySelector('[data-r="'+r+'"]').classList.contains('on')); check(); });
  check();
  go.onclick=()=>{ if(go.disabled) return; const name=nm.value.trim().toUpperCase();
    const d=dtAddNew({kind, name, kit, rows, src, notes:src ? $id('trNotes').checked : false}); closeSheets();
    hmToast(name+' hinzugefügt', true, ()=>{ if(DRUM_TRACKS.indexOf(d)>=0){ dtDetach(d); patternGroup='drums'; melChanged(TRACKS.find(t=>t.id===(src?src.rows[0]:DRUM_TRACKS[0].rows[0]))); } }); };
}
function dtRenameSheet(d){
  trSheetOpen('Umbenennen · '+d.name, '<input class="trs-in" id="trName" maxlength="12" autocomplete="off" spellcheck="false"><button class="trs-go" id="trGo">Übernehmen</button>');
  const nm=$id('trName'), go=$id('trGo'); nm.value=d.name;
  const check=()=>{ const v=nm.value.trim().toUpperCase(); go.disabled=!v || !dtNameFree(v, d); };
  nm.addEventListener('input', check); check(); setTimeout(()=>{ nm.focus(); nm.select(); }, 60);
  go.onclick=()=>{ if(go.disabled) return; dtRename(d, nm.value.trim().toUpperCase()); closeSheets(); };
}
function dtActSheet(d){
  const ex=dtExtra(d), full=dtExtras().length>=DT_MAX_EXTRA;
  trSheetOpen(d.name+' · '+(KITS[d.kit] ? KITS[d.kit].name : ''),
    (ex ? '<button class="nb-opt" data-a="ren">'+TR_IC.pen+'<span><b>Umbenennen</b><small>Name in Spur-Menü, Song und Mixer.</small></span></button>' : '')
    +'<button class="nb-opt" data-a="cp"'+(full?' disabled':'')+'>'+TR_IC.copy+'<span><b>Als neue Spur kopieren</b><small>'+(full?'Höchstens '+DT_MAX_EXTRA+' zusätzliche Drum-/Perc-Spuren.':'Gleiche Noten und Klang, Kit und Zeilen wählbar – z. B. Kit-Wechsel im Song.')+'</small></span></button>'
    +'<button class="nb-opt trs-del" data-a="del"'+(ex?'':' disabled')+'>'+TR_IC.del+'<span><b>Löschen</b><small>'+(ex?'Mit Rückgängig.':d.name+' ab Werk bleibt immer da.')+'</small></span></button>');
  if(ex) trSheet.querySelector('[data-a=ren]').onclick=()=>dtRenameSheet(d);
  trSheet.querySelector('[data-a=cp]').onclick=()=>{ if(!full) dtAddSheet(d.kind, d); };
  trSheet.querySelector('[data-a=del]').onclick=()=>{ if(!ex) return; closeSheets(); dtDelete(d); };
}
