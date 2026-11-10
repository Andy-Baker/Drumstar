"use strict";
// =========================================================================
// HARMONIE (v62) — gemeinsame Akkordfolge pro Pattern + Spielweise pro melodischer Spur. Ersetzt den Arpeggio-Generator.
//   harmony = {key:{root,scale}, chords:[{step,len,root,type}]}   root = Tonklasse 0..11 (C=0), step/len in Steps
//   tr.harm  = {mode:'off'|'chord'|'chordbass'|'root'|'arp', seed, fill, arp:{style,dir,rate,oct,dens}, bass:{bstyle,lage}}
// Folgt eine Spur (mode≠'off'), liegen ihre eigenen Noten in tr.harmOwn und tr.events enthält die ERZEUGTEN Noten (e.h=1).
// Dadurch laufen Wiedergabe, Vorschau, Übersicht, Export und Clips ohne Sonderfall. Gespeichert werden die eigenen Noten (trOwnEvents).
// Bearbeiten einer erzeugten Note (Piano Roll, Velocity, Rec) wandelt die Spur um: erzeugte Noten werden eigene, mode='off' (hmConvert).
// Zufall ist deterministisch (Seed pro Spur): das Pattern bleibt gleich, bis "Variation" den Seed neu würfelt.
// =========================================================================
const HM_TYPES=[{id:'',n:'Dur',iv:[0,4,7]},{id:'m',n:'Moll',iv:[0,3,7]},{id:'7',n:'7',iv:[0,4,7,10]},{id:'maj7',n:'maj7',iv:[0,4,7,11]},
  {id:'m7',n:'m7',iv:[0,3,7,10]},{id:'madd9',n:'m add9',iv:[0,3,7,14]},{id:'sus2',n:'sus2',iv:[0,2,7]},{id:'sus4',n:'sus4',iv:[0,5,7]},{id:'dim',n:'dim',iv:[0,3,6]}];
const HM_MODES=[{id:'off',n:'Aus'},{id:'chord',n:'Akkord'},{id:'chordbass',n:'Akkord + Bass'},{id:'root',n:'Grundton'},{id:'arp',n:'Arpeggio'}];
const HM_SCALES={minor:[0,2,3,5,7,8,10],major:[0,2,4,5,7,9,11]};
// Verläufe wie im früheren Arpeggio-Generator: [Halbtöne ab Grundton der Tonart, 'm'=Moll/''=Dur]
const HM_PROGS={
  minor:[
    {rn:'i–VI–III–VII',steps:[[0,'m'],[8,''],[3,''],[10,'']]},
    {rn:'i–VII–VI–VII',steps:[[0,'m'],[10,''],[8,''],[10,'']]},
    {rn:'i–iv–VII–III',steps:[[0,'m'],[5,'m'],[10,''],[3,'']]},
    {rn:'i–VI–VII–i',steps:[[0,'m'],[8,''],[10,''],[0,'m']]},
    {rn:'i–III–VII–VI',steps:[[0,'m'],[3,''],[10,''],[8,'']]},
    {rn:'i–v–VI–iv',steps:[[0,'m'],[7,'m'],[8,''],[5,'m']]},
    {rn:'VI–VII–i–i',steps:[[8,''],[10,''],[0,'m'],[0,'m']]},
    {rn:'i–VII',steps:[[0,'m'],[10,'']]},
    {rn:'i–iv–v–i',steps:[[0,'m'],[5,'m'],[7,'m'],[0,'m']]}
  ],
  major:[
    {rn:'I–V–vi–IV',steps:[[0,''],[7,''],[9,'m'],[5,'']]},
    {rn:'vi–IV–I–V',steps:[[9,'m'],[5,''],[0,''],[7,'']]},
    {rn:'I–IV–V–IV',steps:[[0,''],[5,''],[7,''],[5,'']]}
  ]
};
const hmMod=(a,n)=>((a%n)+n)%n;
const hmType=id=>HM_TYPES.find(t=>t.id===id)||HM_TYPES[0];
const hmChordName=c=>NOTE_NAMES[c.root]+(c.type==='madd9'?'m(add9)':c.type);
const hmTrName=tr=>{ const n=prName(tr); return n[0]+n.slice(1).toLowerCase(); };
function hmPcOf(tr){ return hmMod(9+(tr.rootNote||0),12); } // Tonklasse von n=0 dieser Spur
let harmony={key:{root:9,scale:'minor'},chords:[]}, hmTpl=0, hmOpen=false, hmMoreOpen=false, hmSelIdx=-1, hmSheetSnap=false;
function hmDefaultTrack(tr){ const I=trInst(tr)||{}; return {mode:'off', seed:1+Math.floor(Math.random()*1e6), fill:false,
  arp:{style:I.arpStyle||'classic', dir:'up', rate:1, oct:2, dens:75}, bass:{bstyle:I.bass||'hold', lage:0}}; }
function hmEnsure(tr){ if(!tr.harm) tr.harm=hmDefaultTrack(tr); return tr.harm; }
function hmOn(tr){ return !!(tr && tr.type==='arp' && tr.harm && tr.harm.mode!=='off'); }
function trOwnEvents(tr){ return hmOn(tr) ? (tr.harmOwn||[]) : tr.events; }
function hmModesFor(tr){ return isPoly(tr) ? HM_MODES : HM_MODES.filter(m=>m.id!=='chord' && m.id!=='chordbass'); } // Acid ist einstimmig
function hmSanTrack(tr,h){
  const d=hmDefaultTrack(tr); if(!h || typeof h!=='object') return d;
  const ok=(v,list,def)=>list.indexOf(v)>=0?v:def, a=h.arp||{}, b=h.bass||{};
  return {mode:ok(h.mode,hmModesFor(tr).map(m=>m.id),'off'), seed:Number.isFinite(h.seed)?h.seed:d.seed, fill:!!h.fill,
    arp:{style:ok(a.style,['cosmic','classic','flow'],d.arp.style), dir:ok(a.dir,['up','down','updown','rand'],'up'), rate:ok(a.rate,[1,2],1), oct:ok(a.oct,[1,2,3],2), dens:ok(a.dens,[55,75,92,100],75)},
    bass:{bstyle:ok(b.bstyle,['hold','off','roll','pulse'],d.bass.bstyle), lage:ok(b.lage,[0,12],0)}};
}
function hmSanHarmony(h){
  if(!h || !h.key || !Array.isArray(h.chords)) return null;
  const key={root:hmMod(Math.round(+h.key.root||0),12), scale:h.key.scale==='major'?'major':'minor'};
  const chords=h.chords.filter(c=>c && Number.isFinite(c.step) && Number.isFinite(c.len) && Number.isFinite(c.root))
    .map(c=>({step:Math.max(0,Math.round(c.step)), len:Math.max(1,Math.round(c.len)), root:hmMod(Math.round(c.root),12), type:hmType(c.type).id}));
  return {key, chords};
}
function hmSeg(){ return PATTERN_LENGTH>=32 ? 16 : 8; } // bei nur einem Takt Akkordwechsel alle 8 Steps (wie bisher)
function hmApplyTpl(i){
  const list=HM_PROGS[harmony.key.scale]; i=Math.max(0,Math.min(list.length-1,i));
  const p=list[i], seg=hmSeg(); harmony.chords=[];
  for(let s=0,k=0;s<PATTERN_LENGTH;s+=seg,k++){ const st=p.steps[k%p.steps.length]; harmony.chords.push({step:s,len:Math.min(seg,PATTERN_LENGTH-s),root:hmMod(harmony.key.root+st[0],12),type:st[1]}); }
  hmTpl=i;
}
function hmDefault(){
  const a=TRACKS.find(t=>t.id==='arp');
  harmony={key:{root:a?hmPcOf(a):9, scale:a&&a.scale==='major'?'major':'minor'}, chords:[]}; hmApplyTpl(0);
}
const hmSorted=()=>harmony.chords.filter(c=>c.step<PATTERN_LENGTH).slice().sort((a,b)=>a.step-b.step);
// Voicing im n-Raum der Spur (n=0 = Grundton der Spur, Lage 0..24): Umkehrung mit kürzestem Weg zum vorherigen Akkord
function hmVoicings(tr,c){
  const pc0=hmPcOf(tr), rel=hmType(c.type).iv.map(i=>hmMod(c.root+i-pc0,12)+(i>=12?12:0)), out=[];
  for(let r=0;r<rel.length;r++){
    const rot=rel.slice(r).concat(rel.slice(0,r)); let v=[], last=-1;
    rot.forEach(x=>{ let m=hmMod(x,12); while(m<=last) m+=12; v.push(m); last=m; });
    out.push(v, v.map(x=>x+12));
  }
  const ok=out.filter(v=>v[v.length-1]<=24); return ok.length?ok:[out[0]];
}
function hmVoiced(tr){
  let prev=null; const pc0=hmPcOf(tr);
  return hmSorted().map(c=>{
    const vs=hmVoicings(tr,c); let best=vs[0], bd=1e9;
    if(prev) vs.forEach(v=>{ const d=v.reduce((s,m)=>s+Math.min.apply(null,prev.map(p=>Math.abs(p-m))),0); if(d<bd){ bd=d; best=v; } });
    prev=best; const r=hmMod(c.root-pc0,12);
    return {c, notes:best, root:r>6?r-12:r};
  });
}
function hmRng(seed){ let s=(seed*2654435761)>>>0||1; return ()=>{ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
// Eigene Noten taktweise zu "Akkorden" bündeln (Arpeggio ohne Akkordfolge)
function hmOwnSegs(tr){
  const own=tr.harmOwn||[], seg=[];
  for(let b=0;b<PATTERN_LENGTH;b+=16){ const ns=[...new Set(own.filter(n=>n.s<b+16 && n.s+n.l>b).map(n=>n.n))].sort((x,y)=>x-y); if(ns.length) seg.push({step:b,len:Math.min(16,PATTERN_LENGTH-b),notes:ns}); }
  return seg;
}
function hmGen(tr){
  const h=hmEnsure(tr), L=PATTERN_LENGTH, out=[], R=hmRng(h.seed*7919+1), has=hmSorted().length>0;
  const put=(s,n,l,kind)=>{ if(s<0||s>=L) return; out.push({s, n, l:Math.max(1,Math.min(l,L-s)), v:kind==='g'?.35:.85, a:kind==='a', sl:false, h:1}); };
  const fold=n=>{ while(n>36) n-=12; while(n<-12) n+=12; return n; };
  if(h.mode==='arp'){
    const a=h.arp, d=a.dens/100, pc0=hmPcOf(tr), scale=HM_SCALES[harmony.key.scale].map(x=>hmMod(x+harmony.key.root,12));
    const segs=has ? hmVoiced(tr).map(v=>({step:v.c.step,len:Math.min(v.c.len,L-v.c.step),notes:v.notes})) : hmOwnSegs(tr);
    segs.forEach(sg=>{
      let seq=[]; for(let o=0;o<a.oct;o++) sg.notes.forEach(n=>seq.push(n+12*o));
      if(a.dir==='down') seq.reverse(); else if(a.dir==='updown' && seq.length>2) seq=seq.concat(seq.slice(1,-1).reverse());
      let cur=-1;
      for(let s=sg.step;s<sg.step+sg.len;s++){
        const si=s%16, r1=R(), r2=R(), r3=R(), r4=R(), r5=R();
        if(h.fill && si>=12){ const p=si-12; put(s,fold(seq[p%seq.length]),1,(p===0||p===3)?'a':'n'); continue; } // Lauf auf dem letzten Schlag
        if((s-sg.step)%a.rate!==0) continue;
        let ch=d; if(a.style==='cosmic' && si%4!==0) ch=Math.max(.35,d-.12); if(a.style==='flow' && si%8===6) ch=Math.min(1,d+.18);
        if(r1>ch) continue;
        if(a.dir==='rand') cur=Math.floor(r2*seq.length);
        else if(a.style==='flow' && r2<.17) cur=(cur+2+Math.floor(r3*2))%seq.length;
        else cur=(cur+1)%seq.length;
        let n=seq[cur];
        if(a.style==='cosmic' && r3<.18) n+=r4<.5?12:-12;
        if(a.style==='flow' && r4<.16){ const near=[]; for(let x=n-3;x<=n+3;x++) if(x!==n && scale.indexOf(hmMod(pc0+x,12))>=0) near.push(x); if(near.length) n=near[Math.floor(r5*near.length)]; }
        put(s,fold(n),1,(si%4===0 || (a.style==='cosmic' && r5<.12))?'a':(r5>.8?'g':'n'));
      }
    });
    return out;
  }
  if(!has) return out;
  hmVoiced(tr).forEach(v=>{
    const c=v.c, len=Math.min(c.len,L-c.step);
    if(h.mode==='chord' || h.mode==='chordbass') v.notes.forEach(n=>put(c.step,n,len,'n'));
    if(h.mode==='chordbass') put(c.step,v.root-12,len,'n');
    if(h.mode==='root'){
      const b=h.bass, rb=v.root+b.lage;
      if(b.bstyle==='hold'){ put(c.step,rb,len,'n'); return; }
      for(let s=c.step;s<c.step+len;s++){
        const st=s%16, r1=R(), r2=R();
        if(h.fill && st>=12){ put(s,rb+(st===15?12:0),1,st===12?'a':'n'); continue; }
        if(b.bstyle==='off'){ if(st%4===2) put(s,rb+(st===14&&r1<.5?12:0),1,(st===2&&r2<.4)?'a':'n'); }
        else if(b.bstyle==='roll') put(s,rb+(st%4===3&&r1<.65?12:0),1,(st===0||(st%4===0&&r2<.35))?'a':'n');
        else if(b.bstyle==='pulse'){ if(st%4===0) put(s,rb+(st===12&&r1<.3?7:0),1,st===0?'a':'n'); }
      }
    }
  });
  return out;
}
function hmRegen(tr){ if(!hmOn(tr)) return; tr.events=hmGen(tr); evTouch(tr); }
function hmRegenAll(){ TRACKS.forEach(tr=>{ if(hmOn(tr)){ hmRegen(tr); refreshTrackStepVisuals(tr); } }); }
function hmAfterChange(){ hmRegenAll(); const tr=TRACKS[activeTrackIdx]; if(tr && tr.type==='arp') renderEditorArea(tr); else hmRender(); if(prIsOpen()) prRender(); }
function hmSetMode(tr,m){
  const h=hmEnsure(tr), was=hmOn(tr); if(h.mode===m) return;
  taSnapshot(); h.mode=m;
  if(!was && m!=='off'){ tr.harmOwn=tr.events; hmRegen(tr); }
  else if(was && m==='off'){ tr.events=tr.harmOwn||[]; delete tr.harmOwn; evTouch(tr); }
  else hmRegen(tr);
  refreshTrackStepVisuals(tr); hmAfterChange();
}
// Spur hört auf zu folgen: die erzeugten Noten werden zu eigenen (für direkte Bearbeitung)
function hmConvert(tr){
  if(!hmOn(tr)) return false;
  taSnapshot(); tr.events.forEach(e=>{ delete e.h; }); delete tr.harmOwn; tr.harm.mode='off'; evTouch(tr);
  refreshTrackStepVisuals(tr); hmToast('Harmonie für '+hmTrName(tr)+' aus · eigene Noten',true); hmRender();
  return true;
}
// Ohne Rückfrage zurücksetzen, wenn eine Spur von außen komplett neue Noten bekommt (Beat laden, Clip bearbeiten, Alles leeren)
function hmReset(tr){ if(tr.harm) tr.harm.mode='off'; delete tr.harmOwn; }
let hmToastT=null;
let hmToastFn=null;
function hmToast(msg,undo,fn){
  hmToastFn=fn||null; const t=$id('hmToast'); t.querySelector('span').textContent=msg; t.querySelector('button').style.display=undo?'':'none';
  t.classList.add('on'); clearTimeout(hmToastT); hmToastT=setTimeout(()=>t.classList.remove('on'),undo?4000:1800);
}
$id('hmToast').querySelector('button').addEventListener('click',()=>{ $id('hmToast').classList.remove('on'); const f=hmToastFn; hmToastFn=null; if(f) f(); else taUndoBtn.click(); });
// ---- UI: Harmonie-Karte (Pattern-Seite, statt Arpeggio-Generator) ----
const HM_CHEV='<svg class="am-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function hmIntroSeen(){ try{ return localStorage.getItem('mrm44-hm-intro')==='1'; }catch(e){ return false; } }
function hmRender(){
  const tr=TRACKS[activeTrackIdx], panel=$id('hmPanel');
  const show=!!tr && tr.type==='arp'; panel.classList.toggle('show',show);
  $id('prPreview').classList.toggle('hmdock',show && hmOpen);
  if(!show) return;
  const h=hmEnsure(tr), list=hmSorted(), mode=HM_MODES.find(m=>m.id===h.mode).n;
  $id('hmTog').setAttribute('aria-expanded',hmOpen?'true':'false'); $id('hmBody').classList.toggle('open',hmOpen);
  $id('hmSum').innerHTML=(list.length?list.slice(0,4).map(hmChordName).join(' ')+(list.length>4?' …':''):'keine Akkorde')+' · '+(h.mode==='off'?'Aus':'<b>'+mode+'</b>');
  if(!hmOpen) return;
  $id('hmIntro').style.display=hmIntroSeen()?'none':'';
  $id('hmKey').innerHTML='Akkordfolge · <b>'+NOTE_NAMES[harmony.key.root]+(harmony.key.scale==='minor'?'-Moll':'-Dur')+'</b>'+HM_CHEV;
  const fol=TRACKS.filter(hmOn).map(hmTrName);
  $id('hmFoll').textContent=fol.length?'Gilt für '+fol.join(', '):'Noch folgt keine Spur der Akkordfolge.';
  $id('hmModeLab').textContent='Spielweise · '+hmTrName(tr);
  const mb=$id('hmModes'); mb.innerHTML='';
  hmModesFor(tr).forEach(m=>{ const b=document.createElement('button'); b.type='button'; b.textContent=m.n; if(h.mode===m.id) b.className='on'; b.onclick=()=>hmSetMode(tr,m.id); mb.appendChild(b); });
  $id('hmArp').style.display=h.mode==='arp'?'':'none';
  $id('hmBass').style.display=h.mode==='root'?'':'none';
  $id('hmActs').style.display=(h.mode==='arp' || (h.mode==='root' && h.bass.bstyle!=='hold'))?'':'none';
  $id('hmFill').classList.toggle('on',h.fill); $id('hmFillSt').textContent=h.fill?'an':'aus';
  document.querySelectorAll('#hmPanel .am-seg[data-hk]').forEach(sg=>{ const k=sg.dataset.hk, src=(k==='bstyle'||k==='lage')?h.bass:h.arp;
    sg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',String(src[k])===b.dataset.v)); });
  $id('hmMoreBody').classList.toggle('open',hmMoreOpen); $id('hmMore').setAttribute('aria-expanded',hmMoreOpen?'true':'false');
  $id('hmMoreT').textContent=hmMoreOpen?'Weniger':'Mehr · '+({up:'↑',down:'↓',updown:'↑↓',rand:'Zufall'})[h.arp.dir]+' · '+(h.arp.rate===2?'1/8':'1/16')+' · '+h.arp.oct+' Okt';
  const hint={off:'Spur spielt nur ihre eigenen Noten.', chord:'Akkorde mit kurzen Wegen zwischen den Umkehrungen.', chordbass:'Akkord plus Grundton eine Oktave tiefer.',
    root:h.bass.bstyle==='hold'?'Hält den Grundton jedes Akkords.':'Bass-Muster auf dem Grundton des jeweiligen Akkords.',
    arp:list.length?'Arpeggio aus den Akkordtönen. Bleibt gleich, bis du Variation drückst.':'Keine Akkordfolge: Arpeggio aus den eigenen Noten der Spur.'};
  $id('hmHint').textContent=hint[h.mode];
  hmRenderLane();
}
function hmRenderLane(){
  const lane=$id('hmLane'), L=PATTERN_LENGTH; lane.innerHTML='';
  const add=(st,len,c)=>{ const d=document.createElement('button'); d.type='button'; d.className='hm-cell'+(c?'':' empty'); d.style.flex=len+' 1 0';
    d.textContent=c?hmChordName(c):'+'; if(c && harmony.chords.indexOf(c)===hmSelIdx) d.classList.add('sel');
    d.onclick=()=>c?hmOpenChord(harmony.chords.indexOf(c)):hmNewChord(st,len); lane.appendChild(d); };
  const fill=(a,b)=>{ let x=a; while(x<b){ const nb=Math.min(b,(Math.floor(x/16)+1)*16); add(x,nb-x,null); x=nb; } };
  let s=0; hmSorted().forEach(c=>{ if(c.step>s) fill(s,c.step); const len=Math.min(c.len,L-c.step); add(c.step,len,c); s=c.step+len; }); if(s<L) fill(s,L);
  const bars=$id('hmBars'); bars.innerHTML=''; for(let b=0;b<L/16;b++){ const sp=document.createElement('span'); sp.textContent='T'+(b+1); bars.appendChild(sp); }
}
$id('hmTog').addEventListener('click',()=>{ hmOpen=!hmOpen; hmRender(); });
$id('hmIntroX').addEventListener('click',()=>{ try{ localStorage.setItem('mrm44-hm-intro','1'); }catch(e){} hmRender(); });
$id('hmMore').addEventListener('click',()=>{ hmMoreOpen=!hmMoreOpen; hmRender(); });
document.querySelectorAll('#hmPanel .am-seg[data-hk]').forEach(sg=>sg.addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return; const tr=TRACKS[activeTrackIdx], h=hmEnsure(tr), k=sg.dataset.hk, src=(k==='bstyle'||k==='lage')?h.bass:h.arp;
  const v=sg.dataset.num?Number(b.dataset.v):b.dataset.v; if(src[k]===v) return;
  taSnapshot(); src[k]=v; hmRegen(tr); refreshTrackStepVisuals(tr); hmAfterChange();
}));
$id('hmVar').addEventListener('click',()=>{ const tr=TRACKS[activeTrackIdx]; taSnapshot(); hmEnsure(tr).seed=1+Math.floor(Math.random()*1e6); hmRegen(tr); refreshTrackStepVisuals(tr); hmAfterChange(); hmToast('Variation gewürfelt',true); });
$id('hmFill').addEventListener('click',()=>{ const tr=TRACKS[activeTrackIdx], h=hmEnsure(tr); taSnapshot(); h.fill=!h.fill; hmRegen(tr); refreshTrackStepVisuals(tr); hmAfterChange(); });
// ---- Akkord-Sheet ----
function hmMkGrid(id,items){ const g=$id(id); g.innerHTML=''; items.forEach(it=>{ const b=document.createElement('button'); b.type='button'; b.className='hm-k'+(it.sharp?' sharp':''); b.textContent=it.n; b.dataset.v=it.v; g.appendChild(b); }); }
hmMkGrid('hmRoots',NOTE_NAMES.map((n,i)=>({n,v:i,sharp:n.indexOf('#')>=0})));
hmMkGrid('hmKRoots',NOTE_NAMES.map((n,i)=>({n,v:i,sharp:n.indexOf('#')>=0})));
hmMkGrid('hmTypes',HM_TYPES.map(t=>({n:t.n,v:t.id})));
hmMkGrid('hmLens',[{n:'½ Takt',v:8},{n:'1 Takt',v:16},{n:'2 Takte',v:32}]);
function hmSyncChord(){
  const c=harmony.chords[hmSelIdx]; if(!c) return; const tr=TRACKS[activeTrackIdx];
  $id('hmChT').textContent=hmChordName(c)+' · Takt '+(Math.floor(c.step/16)+1)+(c.step%16?' (2. Hälfte)':'');
  const oth=TRACKS.filter(t=>t!==tr && hmOn(t)).map(hmTrName), aff=$id('hmAff');
  aff.style.display=oth.length?'':'none'; aff.textContent=(hmOn(tr)?'Ändert auch: ':'Ändert: ')+oth.join(', ');
  $id('hmRoots').querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.v===c.root));
  $id('hmTypes').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===c.type));
  $id('hmLens').querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.v===c.len));
}
function hmChordSnap(){ if(!hmSheetSnap){ taSnapshot(); hmSheetSnap=true; } }
function hmPreviewChord(c){
  const tr=TRACKS[activeTrackIdx]; if(!tr || tr.type!=='arp' || isPlaying) return;
  const v=hmVoiced(tr).find(x=>x.c===c); if(!v) return;
  (isPoly(tr)?v.notes:[v.root]).forEach((n,i)=>setTimeout(()=>pitchPreview(tr,n,.8),i*18));
}
function hmOpenChord(i){ hmSelIdx=i; hmSheetSnap=false; hmSyncChord(); openSheet('hmChordSheet'); hmRenderLane(); }
function hmNewChord(step,len){
  hmChordSnap(); const c={step,len:Math.min(16,len),root:harmony.key.root,type:harmony.key.scale==='minor'?'m':''};
  harmony.chords.push(c); hmSelIdx=harmony.chords.length-1; hmSheetSnap=true; hmSyncChord(); openSheet('hmChordSheet'); hmAfterChange(); hmPreviewChord(c);
}
function hmCloseChord(){ hmSelIdx=-1; closeSheets(); hmRender(); }
$id('hmChX').addEventListener('click',hmCloseChord); $id('hmDone').addEventListener('click',hmCloseChord);
$id('hmDel').addEventListener('click',()=>{ hmChordSnap(); harmony.chords.splice(hmSelIdx,1); hmCloseChord(); hmAfterChange(); });
$id('hmRoots').addEventListener('click',e=>{ const b=e.target.closest('button'), c=harmony.chords[hmSelIdx]; if(!b||!c) return; hmChordSnap(); c.root=+b.dataset.v; hmSyncChord(); hmAfterChange(); hmPreviewChord(c); });
$id('hmTypes').addEventListener('click',e=>{ const b=e.target.closest('button'), c=harmony.chords[hmSelIdx]; if(!b||!c) return; hmChordSnap(); c.type=b.dataset.v; hmSyncChord(); hmAfterChange(); hmPreviewChord(c); });
$id('hmLens').addEventListener('click',e=>{
  const b=e.target.closest('button'), c=harmony.chords[hmSelIdx]; if(!b||!c) return; hmChordSnap();
  const len=Math.max(1,Math.min(+b.dataset.v,PATTERN_LENGTH-c.step));
  harmony.chords=harmony.chords.filter(o=>o===c || o.step+o.len<=c.step || o.step>=c.step+len); hmSelIdx=harmony.chords.indexOf(c); c.len=len;
  hmSyncChord(); hmAfterChange();
});
// ---- Vorlage-Sheet (Tonart + Verläufe) ----
function hmRenderTpl(){
  $id('hmTplT').textContent=NOTE_NAMES[harmony.key.root]+(harmony.key.scale==='minor'?'-Moll':'-Dur');
  $id('hmKRoots').querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.v===harmony.key.root));
  $id('hmKScale').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===harmony.key.scale));
  const box=$id('hmProgs'); box.innerHTML='';
  HM_PROGS[harmony.key.scale].forEach((p,i)=>{
    const b=document.createElement('button'); b.type='button'; b.className='hm-prog'+(i===hmTpl?' on':'');
    b.innerHTML='<b>'+p.steps.slice(0,4).map(st=>hmChordName({root:hmMod(harmony.key.root+st[0],12),type:st[1]})).join(' ')+'</b><span>'+p.rn+'</span>';
    b.onclick=()=>{ taSnapshot(); hmApplyTpl(i); hmRenderTpl(); hmAfterChange(); hmPreviewChord(hmSorted()[0]); hmToast('Vorlage übernommen',true); };
    box.appendChild(b);
  });
}
function hmOpenTpl(){ hmRenderTpl(); openSheet('hmTplSheet'); }
$id('hmTplBtn').addEventListener('click',hmOpenTpl); $id('hmKey').addEventListener('click',hmOpenTpl);
$id('hmTplX').addEventListener('click',()=>{ closeSheets(); hmRender(); });
$id('hmKRoots').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; taSnapshot(); harmony.key.root=+b.dataset.v; hmApplyTpl(hmTpl); hmRenderTpl(); hmAfterChange(); });
$id('hmKScale').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b || b.dataset.v===harmony.key.scale) return; taSnapshot(); harmony.key.scale=b.dataset.v; hmApplyTpl(0); hmRenderTpl(); hmAfterChange(); });
// ---- Rückfrage bei "Leeren", während die Spur folgt ----
function hmAskClear(tr){
  $id('hmCfT').textContent='Harmonie für '+hmTrName(tr)+' ausschalten?';
  $id('hmCfD').textContent='Die Spur folgt gerade der Akkordfolge. Leeren würde nur ihre eigenen, momentan stummen Noten löschen.';
  openSheet('hmConfSheet');
}
$id('hmCfX').addEventListener('click',()=>closeSheets()); $id('hmCfNo').addEventListener('click',()=>closeSheets());
$id('hmCfYes').addEventListener('click',()=>{ const tr=TRACKS[activeTrackIdx]; closeSheets(); hmSetMode(tr,'off'); hmToast('Harmonie aus · eigene Noten spielen',true); });
hmDefault();

function renderTrackBar(){
  const tr=TRACKS[activeTrackIdx];
  tbName.textContent=trLabel(tr);
  tbDot.style.background=tr.color; tbDot.style.boxShadow='0 0 6px '+tr.color;
  syncTbMS();

  sampleControls.style.display='none';
  arpControls.style.display='none';
  arpModPanel.style.display='none';
  tbPreview.style.display='';
  if(tr.isSample){
    sampleControls.style.display='flex';
    tbPreview.style.display='none';
    updateRecStatus();
  } else if(tr.type==='arp'){
    arpControls.style.display='none'; // Filter-Regler liegen jetzt im Synth-Sheet
    arpModPanel.style.display=isPoly(tr)?'none':'flex';
    const xyBtn=document.getElementById('arpXyBtn');
    if(xyBtn) xyBtn.style.display=isPoly(tr)?'none':'';
    renderArpControls(tr);
  }
}
// Cutoff/Resonance-Knobs + "Bassline randomisieren"-Button für den Acid-Bass-Track
const arpCutoffEl=document.getElementById('arpCutoffKnob');
const arpResEl=document.getElementById('arpResKnob');
const arpEnvEl=document.getElementById('arpEnvKnob');
const arpDecayEl=document.getElementById('arpDecayKnob');
const arpCosmicControlsEl=document.getElementById('arpCosmicControls');
function renderArpControls(tr){
  arpCutoffEl.innerHTML=''; arpResEl.innerHTML='';
  const cutoffKnob=makeKnob({label:'CUTOFF', size:'26px', min:0, max:1, value:tr.cutoff, fmt:v=>Math.round(v*100)+'%',
    onChange:v=>tr.cutoff=v});
  const resKnob=makeKnob({label:'RESO', size:'26px', min:0, max:1, value:tr.resonance, fmt:v=>Math.round(v*100)+'%',
    onChange:v=>tr.resonance=v});
  arpCutoffEl.appendChild(cutoffKnob.el);
  arpResEl.appendChild(resKnob.el);
  arpEnvEl.innerHTML=''; arpDecayEl.innerHTML='';
  const envKnob=makeKnob({label:'ENV MOD', size:'26px', min:0, max:1, value:tr.envMod!=null?tr.envMod:0.5, fmt:v=>Math.round(v*100)+'%',
    onChange:v=>tr.envMod=v});
  const decayKnob=makeKnob({label:'DECAY', size:'26px', min:0, max:1, value:tr.decay!=null?tr.decay:0.26,
    fmt:v=>{ const sec=arpDecaySeconds(v); return sec<1 ? Math.round(sec*1000)+'ms' : sec.toFixed(1)+'s'; },
    onChange:v=>tr.decay=v});
  arpEnvEl.appendChild(envKnob.el);
  arpDecayEl.appendChild(decayKnob.el);
  if(arpCosmicControlsEl){
    const knobs=(trInst(tr)||{}).knobs; // Zusatzregler des Instruments (Cosmic: Width/Motion/Warmth/Air)
    arpCosmicControlsEl.style.display=knobs?'flex':'none';
    if(knobs) knobs.forEach(([label,key])=>{
      const el=document.getElementById('arpCosmic'+label); if(!el) return; el.innerHTML='';
      const k=makeKnob({label:label.toUpperCase(),size:'26px',min:0,max:1,value:tr[key]!=null?tr[key]:0.5,fmt:v=>Math.round(v*100)+'%',onChange:v=>tr[key]=v});
      el.appendChild(k.el);
    });
  }
}
// Würfelt die vier Filterwerte (Cutoff/Reso/Env Mod/Decay) — in musikalischen Grenzen, voller Bereich würde pfeifen/übersteuern
const arpFilterRandBtn=document.getElementById('arpFilterRandBtn');
arpFilterRandBtn.addEventListener('click', ()=>{
  const tr=TRACKS[activeTrackIdx]?.type==='arp' ? TRACKS[activeTrackIdx] : TRACKS.find(t=>t.type==='arp');
  taSnapshot(tr);
  tr.cutoff=0.15+Math.random()*0.7;
  tr.resonance=0.1+Math.random()*0.6;
  tr.envMod=0.2+Math.random()*0.7;
  tr.decay=0.1+Math.random()*0.6;
  renderArpControls(tr);
});
tbPreview.addEventListener('click', ()=>{
  Promise.resolve(initAudio()).then(()=>{
    if(audioCtx.state!=='running') audioCtx.resume();
    triggerTrack(TRACKS[activeTrackIdx], audioCtx.currentTime, VEL_NORMAL);
  });
});
