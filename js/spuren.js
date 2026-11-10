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
function melNameFree(n, self){ n=n.toUpperCase(); return RESERVED_NAMES.indexOf(n)<0 && !TRACKS.some(t=>t!==self && trInst(t) && trTitle(t)===n); }
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
  DRUM_TRACKS.forEach(d=>out.push({soon:1, n:d.name, d:'kommt', c:d.kind==='perc'?'#2dd4bf':'#3fa9ff'}));
  return out;
}
function trSheetOpen(title, html){
  openSheet('trSheet');
  trSheet.innerHTML='<div class="sh"><span>'+title+'</span><button class="shx" aria-label="Schließen">✕</button></div>'+html;
  trSheet.querySelector('.shx').onclick=closeSheets;
}
function trAddSheet(src){
  const full=melCount()>=MEL_MAX, tiles=trTiles().filter(o=>!src || !o.soon);
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
  trSheet.querySelectorAll('.trs-tile').forEach(b=>{ const o=tiles[+b.dataset.i]; if(!o.soon) b.onclick=()=>pick(o); });
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
  [...m.children].forEach((b,i)=>{ const g=ARR_GROUPS[i], tr=g && TRACKS.find(t=>t.id===g.ids[0]), I=trInst(tr); if(!I) return;
    const s=instSound(tr); b.querySelector('small').textContent=(g.label!==I.name ? I.name+(s?' · ':'') : '')+(s ? s.name : (g.label!==I.name ? '' : I.name));
    b.classList.add('grp-has'); const d=document.createElement('span'); d.className='grp-dots'; d.setAttribute('role','button'); d.setAttribute('aria-label',g.label+' · Aktionen'); d.innerHTML=TR_IC.dots;
    d.onclick=e=>{ e.stopPropagation(); closeMenus(); trActSheet(tr); }; b.appendChild(d); });
  const a=document.createElement('button'); a.className='grp-add'; a.innerHTML=TR_IC.plus+'Spur hinzufügen';
  a.onclick=()=>{ closeMenus(); trAddSheet(null); }; m.appendChild(a);
}
function trSongDecorate(rows){
  [...rows.querySelectorAll('.ar-row')].forEach((r,i)=>{ const g=ARR_GROUPS[i], tr=g && TRACKS.find(t=>t.id===g.ids[0]); if(!trInst(tr)) return;
    const lab=r.querySelector('.ar-lab'); lab.classList.add('tap'); lab.firstChild.onclick=()=>trActSheet(tr); });
  const b=document.createElement('button'); b.className='ov-add'; b.innerHTML=TR_IC.plus+'Spur'; b.onclick=()=>trAddSheet(null); rows.appendChild(b);
}
