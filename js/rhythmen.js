"use strict";
// =========================================================================
// RHYTHMEN PRO SPUR (#14, Mockup docs/mockups/issue-14.html Variante B)
// Nur Drum-/Perc-Zeilen. Der Würfel (taRandBtn) fragt bei diesen Spuren: Neu erzeugen (wie bisher) ·
// Aus Bibliothek (Zufall aus Eigene + Vorlagen) · Bibliothek … (Sheet #rhSheet: Speichern, Eigene, Vorlagen).
// Ablage im Store "beats" als {id, kind:'rh', voice:rowBase, name, v:[Stärke], a:[Spielweise], savedAt} —
// beatAll() filtert kind 'rh' heraus. Eigene gelten pro Zeile ab Werk (rowBase), also auch für drums2 usw.;
// Vorlagen nach Rolle (trRole), passen damit auch zu getauschten Stimmen. Einsetzen in taRange()
// (Seite bzw. alle Seiten), kürzere Rhythmen werden wiederholt. Rückgängig = taUndoBtn.
// =========================================================================
// Vorlagen: . aus · g Ghost · x normal · X Akzent · o Spielweise 2 (Hi-Hat locker, Ride Bell)
const RH_TPL={
  kick:[['Four on the Floor','X...x...X...x...'],['Rock','x.......x.x.....'],['Breakbeat','x.........x..x..'],['Half-Time','x...........x...'],['Two-Step','x.....x...x.....'],['Trap','x......x..x....x']],
  snare:[['Backbeat','....X.......X...'],['Backbeat + Ghosts','..g.X..g.g..X.g.'],['Half-Time','........X.......'],['Breakbeat','....X..g.g..X..g']],
  clap:[['Backbeat','....X.......X...'],['Half-Time','........X.......'],['Trap','....X.......X..x']],
  hat:[['Achtel','x.x.x.x.x.x.x.x.'],['Sechzehntel','xgxgxgxgxgxgxgxg'],['Offbeat','..x...x...x...x.'],['Disco (locker auf und)','x.o.x.o.x.o.x.o.']],
  openhat:[['Offbeat','..x...x...x...x.'],['Auf die Vier','............x...']],
  ride:[['Achtel','x.x.x.x.x.x.x.x.'],['Bell auf 1 und 3','o.x.x.x.o.x.x.x.'],['Jazz','x..xx..xx..xx..x']],
  crash:[['Auf die Eins','X...............']],
  perc:[['Clave 3-2','x..x..x...x.x...'],['Tresillo','x..x..x.x..x..x.'],['Offbeat','..x...x...x...x.'],['Achtel','x.x.x.x.x.x.x.x.']]
};
const RH_IC={
  lib:'<svg viewBox="0 0 24 24"><rect x="4" y="9" width="16" height="11" rx="2"/><path d="M6 6h12M8 3h8"/><path d="M8 14.5h1.5M11.5 14.5h1M15 14.5h1"/></svg>',
  save:'<svg viewBox="0 0 24 24"><path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/></svg>',
  dice:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>',
  spark:'<svg viewBox="0 0 24 24"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/></svg>',
  more:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="19" cy="12" r="1.5" fill="currentColor"/></svg>',
  pen:'<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  del:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'
};
let RH_OWN=null, rhLast=null; // Cache aller eigenen Rhythmen; zuletzt eingesetzter (Zufall wiederholt ihn nicht)

function rhFor(tr){ return !!tr && tr.type!=='arp' && Array.isArray(tr.steps); }
async function rhAll(){
  if(RH_OWN) return RH_OWN;
  const db=await idbOpen(), out=[];
  await new Promise((res,rej)=>{ const q=db.transaction(IDB_BEATS,'readonly').objectStore(IDB_BEATS).openCursor(); q.onsuccess=e=>{ const c=e.target.result; if(c){ if(c.value&&c.value.kind==='rh') out.push(c.value); c.continue(); } else res(); }; q.onerror=()=>rej(q.error); });
  return RH_OWN=out.sort((a,b)=>b.savedAt-a.savedAt);
}
async function rhPut(r){ await beatPut(r); RH_OWN=null; }
async function rhDel(id){ await beatDelete(id); RH_OWN=null; }
async function rhOwnOf(tr){ const k=rowBase(tr.id); return (await rhAll()).filter(r=>r.voice===k); }
function rhCodeToRh(name, code){
  const v=[], a=[];
  for(const ch of code){ v.push(ch==='.'?VEL_OFF : ch==='X'?VEL_ACCENT : ch==='g'?VEL_GHOST : VEL_NORMAL); a.push(ch==='o'?1:0); }
  return {name, v, a, tpl:1};
}
function rhTplOf(tr){ return (RH_TPL[trRole(tr)]||RH_TPL.perc).map(([n,c])=>rhCodeToRh(n,c)); }
// Spur → Rhythmus (Bereich wie Würfel/Leeren)
function rhGrab(tr){
  const [from,to]=taRange(), v=[], a=[];
  for(let s=from;s<to;s++){ v.push(+(tr.steps[s]||0).toFixed(3)); a.push(tr.notes&&tr.steps[s]?(tr.notes[s]||0):0); }
  return {v,a};
}
// Rhythmus → Spur (wiederholt bis zum Bereichsende); Spielweise nur, wenn die Stimme sie kennt
function rhPut2Track(tr, r){
  taSnapshot();
  const [from,to]=taRange(), n=r.v.length, arts=(ART[trVoice(tr)]||[]).length;
  for(let s=from;s<to;s++){ const i=(s-from)%n; tr.steps[s]=r.v[i]||VEL_OFF;
    if(tr.notes) tr.notes[s]= (r.v[i] && r.a && r.a[i] && r.a[i]<arts) ? r.a[i] : 0; }
  rhLast=r; refreshTrackStepVisuals(tr);
  hmToast('„'+r.name+'“ eingesetzt', true);
}
async function rhRandomLoad(){
  const tr=TRACKS[activeTrackIdx]; if(!rhFor(tr)) return;
  let all=(await rhOwnOf(tr)).concat(rhTplOf(tr));
  if(all.length>1 && rhLast) all=all.filter(r=>r.name!==rhLast.name || r.id!==rhLast.id);
  if(!all.length){ hmToast('Keine Rhythmen für diese Spur'); return; }
  rhPut2Track(tr, all[Math.floor(Math.random()*all.length)]);
}
// ---------- UI ----------
function rhPop(x, y, items){
  rhPopClose();
  const p=document.createElement('div'); p.className='rh-pop'; p.id='rhPop'; document.body.appendChild(p);
  items.forEach(([ic,l,s,fn,cls,act])=>{ const b=document.createElement('button'); if(cls) b.className=cls; if(act) b.dataset.rh=act;
    b.innerHTML=ic+'<span>'+l+(s?'<small>'+s+'</small>':'')+'</span>'; b.onclick=ev=>{ ev.stopPropagation(); rhPopClose(); fn(); }; p.appendChild(b); });
  const r=p.getBoundingClientRect();
  p.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x))+'px'; p.style.top=Math.max(8,Math.min(innerHeight-r.height-8,y))+'px';
  setTimeout(()=>document.addEventListener('pointerdown', rhPopOutside, true), 0);
}
function rhPopOutside(e){ const p=$id('rhPop'); if(p && !p.contains(e.target)) rhPopClose(); }
function rhPopClose(){ const p=$id('rhPop'); if(p) p.remove(); document.removeEventListener('pointerdown', rhPopOutside, true); }
// Würfel bei Drum-/Perc-Spuren
function rhDiceMenu(){
  const r=taRandBtn.getBoundingClientRect();
  rhPop(r.left, r.bottom+6, [
    [RH_IC.spark,'Neu erzeugen','wie bisher',taDiceNew,'','new'],
    [RH_IC.dice,'Aus Bibliothek','eigene + Vorlagen dieser Spur',rhRandomLoad,'','lib'],
    [RH_IC.lib,'Bibliothek …','speichern, auswählen',rhOpen,'','open']]);
}
function rhMini(r, col){
  let h='<div class="rh-mini" style="--rc:'+col+'">';
  for(let i=0;i<16;i++){ const v=r.v[i]||0, o=v && r.a && r.a[i];
    h+='<i class="'+(!v?'':o?'o':'on')+'"'+(v&&v<VEL_NORMAL?' style="opacity:.4"':'')+'></i>'; }
  return h+'</div>';
}
function rhRow(r, k, col){
  const bars=Math.max(1,Math.round(r.v.length/16));
  return '<div class="rh-row" data-k="'+k+'">'+rhMini(r,col)+'<div class="nm">'+escHtmlRh(r.name)+'<small>'+bars+(bars>1?' Takte':' Takt')+'</small></div>'
    +(r.tpl?'':'<button class="mo" aria-label="Mehr">'+RH_IC.more+'</button>')+'</div>';
}
function escHtmlRh(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
async function rhRender(){
  const tr=TRACKS[activeTrackIdx]; if(!rhFor(tr)) return;
  const mine=await rhOwnOf(tr), tpl=rhTplOf(tr), L=$id('rhList'), col=tr.color||'#3fa9ff';
  $id('rhT').textContent='Rhythmen · '+trLabel(tr);
  $id('rhScope').textContent='Einsetzen in: '+(taScope==='all'||totalPages()===1?'alle Seiten':'diese Seite')+' (Umschalter unter dem Raster)';
  let h='<div class="grp">Eigene</div>';
  h+= mine.length ? mine.map((r,i)=>rhRow(r,'m'+i,col)).join('') : '<div class="rh-empty">Noch nichts gespeichert. „Speichern“ legt den Rhythmus dieser Spur ab.</div>';
  h+='<div class="grp">Vorlagen</div>'+tpl.map((r,i)=>rhRow(r,'t'+i,col)).join('');
  L.innerHTML=h;
  L.querySelectorAll('.rh-row').forEach(el=>el.onclick=e=>{
    const k=el.dataset.k, r=k[0]==='m' ? mine[+k.slice(1)] : tpl[+k.slice(1)];
    if(e.target.closest('.mo')){ e.stopPropagation(); return rhMore(e, r); }
    rhPut2Track(tr, r); closeSheets();
  });
}
function rhMore(e, r){
  rhPop(e.clientX-200, e.clientY+10, [
    [RH_IC.pen,'Umbenennen','',()=>rhNameSheet('Umbenennen · '+r.name, r.name, async n=>{ r.name=n; await rhPut(r); rhOpen(); })],
    [RH_IC.del,'Löschen','',async()=>{ await rhDel(r.id); rhRender(); hmToast('„'+r.name+'“ gelöscht', true, async()=>{ await rhPut(r); if($id('rhSheet').classList.contains('open')) rhRender(); }); },'del']]);
}
function rhNameSheet(title, val, done){
  closeSheets();
  trSheetOpen(title, '<input class="trs-in" id="rhName" maxlength="24" autocomplete="off" spellcheck="false"><button class="trs-go" id="rhGo">Übernehmen</button>');
  const nm=$id('rhName'), go=$id('rhGo'); nm.value=val;
  const check=()=>{ go.disabled=!nm.value.trim(); };
  nm.addEventListener('input', check); check(); setTimeout(()=>{ nm.focus(); nm.select(); }, 60);
  const fire=()=>{ if(go.disabled) return; const v=nm.value.trim().toUpperCase(); closeSheets(); done(v); };
  go.onclick=fire; nm.addEventListener('keydown', e=>{ if(e.key==='Enter') fire(); });
}
async function rhSave(){
  const tr=TRACKS[activeTrackIdx]; if(!rhFor(tr)) return;
  const g=rhGrab(tr);
  if(!g.v.some(v=>v>0)){ hmToast('Spur ist leer – nichts zu speichern'); return; }
  const names=new Set((await rhOwnOf(tr)).map(r=>r.name));
  rhNameSheet('Rhythmus speichern · '+trLabel(tr), uniqueName(trShort(tr)+' '+(names.size+1), names), async n=>{
    const name=uniqueName(n, names);
    await rhPut({id:genId(), kind:'rh', voice:rowBase(tr.id), name, v:g.v, a:g.a, savedAt:Date.now()});
    hmToast('„'+name+'“ gespeichert');
  });
}
function rhOpen(){ rhPopClose(); openSheet('rhSheet'); rhRender(); }
$id('rhSheet').querySelector('.shx').addEventListener('click', closeSheets);
$id('rhSave').addEventListener('click', rhSave);
$id('rhRand').addEventListener('click', ()=>{ closeSheets(); rhRandomLoad(); });
