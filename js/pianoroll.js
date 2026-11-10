"use strict";
// =========================================================================
// NOTENEDITOR (v64, nach Mockup v3) — Vollbild-Editor für Acid, Cosmic und Keys auf den Noten-Events.
// Zonen: Kopf (Zurück · Instrument · Klang · Optionen), Werkzeug (Modus · Zoom · Alles zeigen · Rückgängig),
// Arbeitsfläche (Lineal, Tonnamen, Raster, Velocity bzw. Klaviatur mit Übersicht), Fuß (Transport bzw. Notenleiste).
// Raster: ganzes Pattern, zwei Finger = Zoom (waagerecht/senkrecht getrennt), ein Finger auf leer = scrollen,
// leer tippen = Note, Note antippen = auswählen, ziehen = verschieben, weißer Griff = Länge.
// Querformat: Werkzeug und Fuß wandern in die Kopfzeile (#prLand).
// =========================================================================
const prWin=document.getElementById('prWin'), prView=$id('prView'), prCv=$id('prCv'), prLbl=$id('prLbl'), prVel=$id('prVel');
const prKb=document.getElementById('prKb'), prLive=new Map(), prSust=[];
let prTr=null, prSel=null, prG=null, prScaleOnly=false, prVD=null, prFollow=true, prPhStep=-1;
let prMode='edit', prBars=false, prVp=true, prSus=false, prRec=false, prRecSnap=false, prKbFirst=0, prKbLast=0;
const PR_LO=-24, PR_HI=48;
const prLandMQ=matchMedia('(orientation:landscape) and (max-height:700px)');
function prLandOn(){ return prLandMQ.matches; }
function prIsOpen(){ return prWin.classList.contains('open'); }
function prSyncPlay(){ if(!isPlaying){ prRecSnap=false; prPhStep=-1; } if(prIsOpen()) prRenderChrome(); }
function prHidePh(){ const a=$id('prPh'), b=document.querySelector('#prPv .pph'); if(a) a.style.display='none'; if(b) b.style.display='none'; }
function prName(tr){ return trTitle(tr); }
function prSubName(tr){ const s=instSound(tr); return s ? s.name : ''; }
function prWhite(tr,n){ return [0,2,4,5,7,9,11].indexOf((((9+tr.rootNote+n)%12)+12)%12)>=0; }
function prRows(tr){ const out=[]; for(let n=PR_HI;n>=PR_LO;n--) if(!prScaleOnly || pitchInScale(n,tr)) out.push(n); return out; }
let prR=[];
function prV(tr){ return tr._prv || (tr._prv={cw:0,rh:0,sx:0,sy:0,fit:true}); }
function prVW(){ return prView.clientWidth||1; } function prVH(){ return prView.clientHeight||1; }
function prClamp(v){
  const L=PATTERN_LENGTH; v.cw=Math.max(prVW()/L,Math.min(prVW()/4,v.cw)); v.rh=Math.max(14,Math.min(64,v.rh));
  v.sx=Math.max(0,Math.min(L*v.cw-prVW(),v.sx)); v.sy=Math.max(0,Math.min(prR.length*v.rh-prVH(),v.sy));
}
// Ansicht einpassen: all=true -> ganze Länge; sonst die aktuelle Seite (hoch) bzw. 2 Takte (quer). Senkrecht: alle Noten der Spur.
function prFitView(all){
  const tr=prTr, v=prV(tr); prR=prRows(tr);
  const steps=all ? PATTERN_LENGTH : Math.min(PATTERN_LENGTH, prLandOn()?32:16);
  v.cw=prVW()/steps; v.sx=all ? 0 : Math.floor(currentPage*16/steps)*steps*v.cw;
  const idx=tr.events.map(e=>prR.indexOf(e.n)).filter(i=>i>=0);
  let lo, hi;
  if(idx.length){ lo=Math.min.apply(null,idx); hi=Math.max.apply(null,idx); }
  else { const c=prR.indexOf(isPoly(tr)?12:0); lo=hi=c<0?Math.floor(prR.length/2):c; }
  const minRows=prLandOn()?9:13, span=Math.max(hi-lo+3,minRows);
  v.rh=prVH()/span; prClamp(v);
  v.sy=((lo+hi+1)/2)*v.rh-prVH()/2; prClamp(v); v.fit=false;
}
function prOpen(tr){
  closeSheets(); closeMenus();
  prTr=tr||TRACKS[activeTrackIdx]; if(!prTr || prTr.type!=='arp') return;
  if(TRACKS[activeTrackIdx]!==prTr) selectTrack(TRACKS.indexOf(prTr));
  prSel=null; prV(prTr).fit=true; prBuildMenu(); prWin.classList.add('open'); prWin.classList.toggle('land',prLandOn()); syncBottomBarVisibility(); prSetMode(prMode);
}
function prClose(){ prKbReleaseAll(); prRec=false; prWin.classList.remove('open'); prSel=null; prG=null; $id('prMenu').classList.remove('open'); syncBottomBarVisibility(); renderAllForPage(); }
function prBuildMenu(){
  const m=$id('prMenu'); m.innerHTML='';
  TRACKS.filter(t=>t.type==='arp').forEach(t=>{
    const b=document.createElement('button'); b.setAttribute('role','option'); if(t===prTr) b.className='cur';
    b.innerHTML='<span style="display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:8px;background:'+t.color+'"></span>'+prName(t)+(prSubName(t)?' <small style="opacity:.6">'+prSubName(t)+'</small>':'');
    b.onclick=()=>{ m.classList.remove('open'); prKbReleaseAll(); prTr=t; prSel=null; prV(t).fit=true; selectTrack(TRACKS.indexOf(t)); prBuildMenu(); prRender(); };
    m.appendChild(b);
  });
}
// ---- Kopf, Werkzeug, Fuß ----
const PR_IC={
  pen:'<svg viewBox="0 0 24 24"><path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/></svg>',
  keys:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7.5 12v7M12 12v7M16.5 12v7"/><rect class="f" x="6" y="5" width="3" height="7"/><rect class="f" x="10.5" y="5" width="3" height="7"/><rect class="f" x="15" y="5" width="3" height="7"/></svg>',
  play:'<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>',
  stop:'<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>',
  rec:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="6.5"/></svg>',
  solo:'<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/></svg>',
  undo:'<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  fit:'<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  dup:'<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
  del:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/></svg>',
  x:'<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
function prPosTxt(s){ return (Math.floor(s/16)+1)+'.'+(Math.floor(s%16/4)+1)+'.'+(s%4+1); }
function prSelOk(){ return prSel && prTr && prTr.events.indexOf(prSel)>=0 && prMode==='edit'; }
function prRenderChrome(){
  const tr=prTr; if(!tr) return; const land=prLandOn();
  prWin.classList.toggle('land',land); prWin.classList.toggle('play',prMode==='play');
  prWin.style.setProperty('--c',tr.color);
  $id('prName').textContent=prName(tr); $id('prSub').textContent=prSubName(tr); $id('prDot').style.background=tr.color;
  const seg='<div class="pr-seg"><button data-pm="edit" class="'+(prMode==='edit'?'on':'')+'" aria-label="Bearbeiten">'+PR_IC.pen+'</button><button data-pm="play" class="'+(prMode==='play'?'on':'')+'" aria-label="Spielen">'+PR_IC.keys+'</button></div>';
  const zoom='<span id="prZoomL">'+prZoomTxt()+'</span>';
  const fit=prMode==='edit'?'<button class="ib" data-pa="fit" aria-label="Alles zeigen">'+PR_IC.fit+'</button>':'';
  const undo='<button class="ib" data-pa="undo" aria-label="Rückgängig">'+PR_IC.undo+'</button>';
  const trans='<button class="ib'+(isPlaying?' on':'')+'" id="prPlayB" data-pa="play" aria-label="Start/Stopp">'+(isPlaying?PR_IC.stop:PR_IC.play)+'</button>'
    +'<button class="ib'+(prRec?' on':'')+'" id="prRecB" data-pa="rec" aria-label="Aufnahme">'+PR_IC.rec+'</button>'
    +'<button class="ib'+(tr.solo?' on':'')+'" data-pa="solo" aria-label="Solo">'+PR_IC.solo+'</button>';
  let selH='';
  if(prSelOk()){
    selH='<div class="pr-info"><b>'+pitchNoteName(tr,prSel.n)+'</b><span>Takt '+prPosTxt(prSel.s)+' · '+prSel.l+'/16</span></div>'
      +'<button class="pr-tb'+(prSel.a?' on':'')+'" data-pa="acc" aria-label="Accent">A</button>'
      +(isPoly(tr)?'':'<button class="pr-tb'+(prSel.sl?' on':'')+'" data-pa="sld" aria-label="Slide">S</button>')
      +'<button class="pr-tb" data-pa="dup" aria-label="Duplizieren">'+PR_IC.dup+'</button>'
      +'<button class="pr-tb del" data-pa="del" aria-label="Löschen">'+PR_IC.del+'</button>'
      +'<button class="pr-x" data-pa="desel" aria-label="Auswahl aufheben">'+PR_IC.x+'</button>';
  }
  if(land){
    $id('prTool').innerHTML=''; $id('prFoot').innerHTML='';
    $id('prLand').innerHTML='<span class="pr-vd"></span>'+(selH || (seg+'<span class="prsp"></span>'+trans+'<span class="pr-vd"></span>'+zoom+fit+undo));
  } else {
    $id('prLand').innerHTML='';
    $id('prTool').innerHTML=seg+'<span class="prsp"></span>'+zoom+fit+undo;
    $id('prFoot').innerHTML=selH || (trans+'<span class="prsp"></span><span id="prPos">'+prPosTxt(isPlaying&&prPhStep>=0?prPhStep:0)+'</span>');
  }
}
function prZoomTxt(){
  if(prMode==='play') return pitchNoteName(prTr,prKbFirst)+'–'+pitchNoteName(prTr,prKbLast);
  const v=prV(prTr); return v.cw ? Math.round(v.cw*16/prVW()*100)+'%' : '';
}
prWin.addEventListener('click',e=>{
  const m=e.target.closest('[data-pm]'); if(m){ if(m.dataset.pm!==prMode) prSetMode(m.dataset.pm); return; }
  const b=e.target.closest('[data-pa]'); if(!b || !prTr) return; const a=b.dataset.pa, tr=prTr;
  if(a==='play') $id('playBtn').click();
  else if(a==='rec'){ prRec=!prRec; prRecSnap=false; if(prRec && prMode==='edit') prSetMode('play'); else prRenderChrome(); }
  else if(a==='solo'){ toggleTrackSolo(tr); prRenderChrome(); }
  else if(a==='undo'){ $id('taUndoBtn').click(); prSel=null; prRender(); }
  else if(a==='fit'){ prFitView(true); prRenderGrid(); }
  else if(a==='klang') openKlang(tr);
  else if(a==='opt') prOpenOpt();
  else if(!prSelOk()) return;
  else if(a==='acc'){ taSnapshot(); prSel.a=!prSel.a; prCommit(); }
  else if(a==='sld'){ taSnapshot(); prSel.sl=!prSel.sl; prCommit(); }
  else if(a==='dup'){
    let s2=prSel.s+prSel.l; if(s2+prSel.l>PATTERN_LENGTH) s2=prSel.s-prSel.l; if(s2<0) return;
    taSnapshot(); const n=Object.assign({},prSel,{s:s2}); tr.events.push(n); prMono(n); prSel=n; prEnsureVisible(n); prCommit();
  }
  else if(a==='del'){ taSnapshot(); tr.events=tr.events.filter(n=>n!==prSel); prSel=null; prCommit(); }
  else if(a==='desel'){ prSel=null; prRenderGrid(); prRenderChrome(); }
});
function prRender(){
  const tr=prTr; if(!tr) return;
  prRenderChrome();
  requestAnimationFrame(()=>{ if(!prIsOpen()) return; if(prMode==='play') prBuildKb(); else { if(prV(tr).fit || !prV(tr).cw) prFitView(false); prRenderGrid(); } prRenderChrome(); });
}
// ---- Raster ----
// Klaviatur-Leiste (#57, Mockup docs/mockups/issue-57.html v2: C · Dezent, Tonart = Zeilen getönt):
// eine Taste je Zeile; weiße reichen halb in eine direkt benachbarte schwarze Zeile, schwarze 60 % breit
// darüber; Name nur bei C (Grundton in Instrumentfarbe). Breite fest 48 px, Höhe zoomt mit v.rh.
function prKeysHtml(tr,v){
  const pc=n=>(((9+tr.rootNote+n)%12)+12)%12, rt=n=>(((n%12)+12)%12)===0, R=prR, h=v.rh;
  let w='', b='', t='';
  R.forEach((n,i)=>{ const y=i*h;
    if(prWhite(tr,n)){
      const up=i>0&&R[i-1]===n+1&&!prWhite(tr,n+1), dn=i<R.length-1&&R[i+1]===n-1&&!prWhite(tr,n-1);
      w+='<div class="pkl w" data-n="'+n+'" style="top:'+(y-(up?h/2:0))+'px;height:'+(h+(up?h/2:0)+(dn?h/2:0))+'px"></div>';
    } else b+='<div class="pkl b" data-n="'+n+'" style="top:'+(y+.5)+'px;height:'+(h-1)+'px"></div>';
    if(pc(n)===0) t+='<div class="pkn'+(rt(n)?' rt':'')+'" style="top:'+y+'px;height:'+h+'px'+(prWhite(tr,n)?'':';right:40%')+'">'+pitchNoteName(tr,n)+'</div>';
  });
  return w+b+t;
}
$id('prLblCol').addEventListener('pointerdown',e=>{
  const tr=prTr; if(!tr || !prR) return; e.preventDefault();
  let k=e.target.closest('.pkl'), n;
  if(k) n=+k.dataset.n; else { const i=Math.floor((e.clientY-prLbl.getBoundingClientRect().top)/prV(tr).rh); if(i<0||i>=prR.length) return; n=prR[i]; k=prLbl.querySelector('.pkl[data-n="'+n+'"]'); }
  pitchPreview(tr,n,.85);
  if(k){ k.classList.add('on'); setTimeout(()=>k.classList.remove('on'),180); }
});
function prRenderGrid(){
  const tr=prTr, v=prV(tr); prR=prRows(tr); prClamp(v);
  const L=PATTERN_LENGTH, W=L*v.cw, H=prR.length*v.rh; prCv.style.width=W+'px'; prCv.style.height=H+'px';
  let h='';
  prR.forEach((n,i)=>{ const rt=(((n%12)+12)%12)===0; h+='<div class="prr'+(rt?' rt':'')+(!prScaleOnly&&!pitchInScale(n,tr)?' ox':'')+'" style="top:'+(i*v.rh)+'px;height:'+v.rh+'px"></div>'; });
  for(let c=1;c<L;c++){ if(v.cw<10 && c%4) continue; h+='<div class="prv'+(c%16===0?' bar':c%4===0?' b':'')+'" style="left:'+(c*v.cw)+'px"></div>'; }
  prCv.innerHTML=h+'<div id="prNotes"></div>';
  prLbl.innerHTML=prKeysHtml(tr,v); prLbl.style.height=H+'px';
  let r=''; for(let c=0;c<L;c+=4) r+='<span class="'+(c%16?'sub':'')+'" style="left:'+(c*v.cw)+'px">'+(c%16?'':(c/16+1))+'</span>';
  $id('prRIn').innerHTML=r; $id('prRIn').style.width=W+'px';
  const hb=$id('prHmB'); if(hmOn(tr)){ hb.style.display='block'; hb.textContent='HARMONIE · '+HM_MODES.find(m=>m.id===tr.harm.mode).n.toUpperCase(); } else hb.style.display='none';
  prDraw();
}
function prDraw(){
  const tr=prTr, v=prV(tr), box=$id('prNotes'); if(!box) return; let h='';
  tr.events.forEach((e,i)=>{
    const ri=prR.indexOf(e.n); if(ri<0) return;
    const sel=e===prSel, room=(PATTERN_LENGTH-(e.s+e.l))*v.cw;
    h+='<div class="prn'+(sel?' sel':'')+(e.a?' acc':'')+(e.h?' gen':'')+'" style="left:'+(e.s*v.cw+1)+'px;width:'+Math.max(4,e.l*v.cw-2)+'px;top:'+(ri*v.rh+1)+'px;height:'+Math.max(4,v.rh-2)+'px">'
      +(e.sl&&!isPoly(tr)?'~':'')+(sel?'<i class="prhd" style="right:'+(room<30?'2px':'-26px')+'"></i>':'')+'</div>';
  });
  box.innerHTML=h;
  const vh=prVel.clientHeight||40; let vb=''; const seen={};
  tr.events.forEach(e=>{ const o=seen[e.s]||(seen[e.s]={v:0,sel:false}); o.v=Math.max(o.v,e.v); if(e===prSel) o.sel=true; });
  Object.keys(seen).forEach(k=>{ const o=seen[k]; vb+='<i class="'+(o.sel?'selb':'')+'" style="left:'+(k*v.cw+v.cw*.22)+'px;width:'+Math.max(3,v.cw*.56)+'px;height:'+Math.round(o.v*(vh-6))+'px"></i>'; });
  $id('prVIn').innerHTML=vb; $id('prVIn').style.width=(PATTERN_LENGTH*v.cw)+'px'; $id('prVIn').style.height=vh+'px';
  prApplyScroll();
}
function prApplyScroll(){
  const v=prV(prTr);
  prCv.style.transform='translate('+(-v.sx)+'px,'+(-v.sy)+'px)'; prLbl.style.transform='translateY('+(-v.sy)+'px)';
  $id('prRIn').style.transform='translateX('+(-v.sx)+'px)'; $id('prVIn').style.transform='translateX('+(-v.sx)+'px)';
  const top=v.sy/v.rh, bot=(v.sy+prVH())/v.rh; let up=0,dn=0;
  prTr.events.forEach(e=>{ const ri=prR.indexOf(e.n); if(ri<0) return; if(ri+1<=top+0.3) up++; else if(ri>=bot-0.3) dn++; });
  const eu=$id('prEU'), ed=$id('prED'); eu.style.display=up?'block':'none'; eu.textContent='▲ '+up; ed.style.display=dn?'block':'none'; ed.textContent='▼ '+dn;
  const zl=$id('prZoomL'); if(zl && prMode==='edit') zl.textContent=prZoomTxt();
  prMovePh();
}
function prEnsureVisible(n){ const v=prV(prTr), x=n.s*v.cw, ri=prR.indexOf(n.n), y=ri*v.rh;
  if(x<v.sx) v.sx=x; if(x+n.l*v.cw>v.sx+prVW()) v.sx=x+n.l*v.cw-prVW(); if(ri>=0){ if(y<v.sy) v.sy=y; if(y+v.rh>v.sy+prVH()) v.sy=y+v.rh-prVH(); } prClamp(v); }
function prPlayhead(step){ prPhStep=step; prMovePh(); const p=$id('prPos'); if(p) p.textContent=prPosTxt(step); }
function prMovePh(){
  const ph=$id('prPh'); if(!ph) return;
  if(!isPlaying || prMode!=='edit' || prPhStep<0 || !prTr){ ph.style.display='none'; return; }
  const v=prV(prTr);
  if(prFollow && !prG){ const x0=prPhStep*v.cw; if(x0<v.sx || x0>v.sx+prVW()-v.cw*0.5){ v.sx=x0; prClamp(v); prCv.style.transform='translate('+(-v.sx)+'px,'+(-v.sy)+'px)'; $id('prRIn').style.transform='translateX('+(-v.sx)+'px)'; $id('prVIn').style.transform='translateX('+(-v.sx)+'px)'; } }
  const x=prPhStep*v.cw-v.sx; ph.style.display=(x>=0 && x<=prVW())?'block':'none'; ph.style.left=x+'px';
}
function prCommit(){ evTouch(prTr); prDraw(); prRenderChrome(); refreshTrackStepVisuals(prTr); }
function prSnap(d){ if(!d.snapped){ taSnapshot(); d.snapped=true; } }
function prMono(n){ if(!isPoly(prTr)) prTr.events=prTr.events.filter(o=>o===n||o.s+o.l<=n.s||o.s>=n.s+n.l); }
// Gesten im Raster
const prP=new Map();
function prCellAt(x,y){ const r=prView.getBoundingClientRect(), v=prV(prTr);
  const s=Math.max(0,Math.min(PATTERN_LENGTH-1,Math.floor((x-r.left+v.sx)/v.cw))), ri=Math.max(0,Math.min(prR.length-1,Math.floor((y-r.top+v.sy)/v.rh)));
  return {s,ri,n:prR[ri]}; }
function prEndNote(d){ prMono(d.n); if(d.t==='move' && !d.moved && d.was) prSel=null; prCommit(); }
prView.addEventListener('pointerdown',e=>{
  if(!prTr) return; try{ prView.setPointerCapture(e.pointerId); }catch(err){}
  prP.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(prP.size===2){
    if(prG && (prG.t==='move'||prG.t==='size')) prEndNote(prG);
    const [a,b]=[...prP.values()], v=prV(prTr), r=prView.getBoundingClientRect();
    prG={t:'pinch',dx0:Math.max(30,Math.abs(a.x-b.x)),dy0:Math.max(30,Math.abs(a.y-b.y)),cw0:v.cw,rh0:v.rh,mx:(a.x+b.x)/2-r.left,my:(a.y+b.y)/2-r.top,sx0:v.sx,sy0:v.sy}; return;
  }
  if(prP.size>2) return;
  const tr=prTr, v=prV(tr), r=prView.getBoundingClientRect(), c=prCellAt(e.clientX,e.clientY);
  if(prSelOk()){ // Griff am rechten Ende der ausgewählten Note
    const ri=prR.indexOf(prSel.n);
    if(ri>=0){ const xr=r.left+(prSel.s+prSel.l)*v.cw-v.sx, room=(PATTERN_LENGTH-(prSel.s+prSel.l))*v.cw, kx=room<30?xr-14:xr+14, ky=r.top+(ri+.5)*v.rh-v.sy;
      if(Math.hypot(e.clientX-kx,e.clientY-ky)<=18){ prG={t:'size',n:prSel,x0:e.clientX,l0:prSel.l,snapped:hmConvert(tr)}; return; } }
  }
  const hit=tr.events.find(n=>n.n===c.n && c.s>=n.s && c.s<n.s+n.l);
  if(hit){ const conv=hmConvert(tr); prG={t:'move',n:hit,ds:c.s-hit.s,r0:prR.indexOf(hit.n),ri0:c.ri,moved:false,was:prSel===hit,snapped:conv}; prSel=hit; pitchPreview(tr,hit.n,hit.v); prDraw(); prRenderChrome(); return; }
  prG={t:'pan',x0:e.clientX,y0:e.clientY,sx0:v.sx,sy0:v.sy,c,moved:false};
});
prView.addEventListener('pointermove',e=>{
  if(!prP.has(e.pointerId) || !prG) return; prP.set(e.pointerId,{x:e.clientX,y:e.clientY}); const v=prV(prTr), g=prG;
  if(g.t==='pinch'){ if(prP.size<2) return; const [a,b]=[...prP.values()];
    const fx=Math.max(30,Math.abs(a.x-b.x))/g.dx0, fy=Math.max(30,Math.abs(a.y-b.y))/g.dy0, ox=(g.sx0+g.mx)/g.cw0, oy=(g.sy0+g.my)/g.rh0;
    v.cw=g.cw0*fx; v.rh=g.rh0*fy; prClamp(v); v.sx=ox*v.cw-g.mx; v.sy=oy*v.rh-g.my; prRenderGrid(); return; }
  if(g.t==='pan'){ const dx=e.clientX-g.x0, dy=e.clientY-g.y0; if(!g.moved && Math.abs(dx)+Math.abs(dy)>8) g.moved=true; if(g.moved){ v.sx=g.sx0-dx; v.sy=g.sy0-dy; prClamp(v); prApplyScroll(); } return; }
  if(g.t==='idle') return;
  const c=prCellAt(e.clientX,e.clientY), n=g.n;
  if(g.t==='size'){ const l=Math.max(1,Math.min(PATTERN_LENGTH-n.s,g.l0+Math.round((e.clientX-g.x0)/v.cw))); if(l!==n.l){ prSnap(g); n.l=l; } }
  else { const ns=Math.max(0,Math.min(PATTERN_LENGTH-n.l,c.s-g.ds)), np=prR[Math.max(0,Math.min(prR.length-1,g.r0+c.ri-g.ri0))];
    if(ns!==n.s || np!==n.n){ prSnap(g); g.moved=true; if(np!==n.n){ n.n=np; pitchPreview(prTr,np,n.v); } n.s=ns; } }
  evTouch(prTr); prDraw(); prRenderChrome();
});
function prPointerEnd(e){
  prP.delete(e.pointerId); const g=prG; if(!g) return;
  if(g.t==='pinch' || g.t==='idle'){ prG = prP.size ? {t:'idle'} : null; prRenderChrome(); return; }
  prG=null; const tr=prTr;
  if(g.t==='pan'){
    if(g.moved || e.type==='pointercancel') return;
    if(prSelOk()){ prSel=null; prDraw(); prRenderChrome(); return; } // mit Auswahl: erst abwählen
    const conv=hmConvert(tr); if(!conv) taSnapshot();
    if(!isPoly(tr)) tr.events=tr.events.filter(n=>!(n.s<=g.c.s && g.c.s<n.s+n.l));
    const n={s:g.c.s,n:g.c.n,l:1,v:.85,a:false,sl:false}; tr.events.push(n); prSel=n; pitchPreview(tr,n.n,.85); prCommit(); return;
  }
  prEndNote(g);
}
prView.addEventListener('pointerup',prPointerEnd); prView.addEventListener('pointercancel',prPointerEnd);
prView.addEventListener('wheel',e=>{ if(!prTr) return; e.preventDefault(); const v=prV(prTr);
  if(e.ctrlKey||e.metaKey){ const r=prView.getBoundingClientRect(), mx=e.clientX-r.left, ox=(v.sx+mx)/v.cw; v.cw*=e.deltaY<0?1.12:1/1.12; prClamp(v); v.sx=ox*v.cw-mx; prClamp(v); prRenderGrid(); }
  else { v.sx+=e.shiftKey?e.deltaY:e.deltaX; v.sy+=e.shiftKey?0:e.deltaY; prClamp(v); prApplyScroll(); } },{passive:false});
// Velocity-Spur (pro Step; bei Akkorden für alle Noten des Steps, mit Auswahl nur für die ausgewählte)
function prVelAt(e){ const r=prVel.getBoundingClientRect(), v=prV(prTr); return { s:Math.max(0,Math.min(PATTERN_LENGTH-1,Math.floor((e.clientX-r.left+v.sx)/v.cw))), v:Math.max(.1,Math.min(1,1-(e.clientY-r.top)/r.height)) }; }
function prSetVel(e){ const c=prVelAt(e); let ns=prTr.events.filter(n=>n.s===c.s); if(!ns.length) return; if(prSelOk() && ns.indexOf(prSel)>=0) ns=[prSel]; if(!prVD.snapped){ taSnapshot(); prVD.snapped=true; } ns.forEach(n=>n.v=c.v); prDraw(); }
prVel.addEventListener('pointerdown',e=>{ if(!prTr) return; prVD={snapped:hmConvert(prTr)}; try{ prVel.setPointerCapture(e.pointerId); }catch(err){} prSetVel(e); });
prVel.addEventListener('pointermove',e=>{ if(prVD) prSetVel(e); });
['pointerup','pointercancel'].forEach(t=>prVel.addEventListener(t,()=>{ if(prVD){ prVD=null; evTouch(prTr); refreshTrackStepVisuals(prTr); } }));
$id('prBack').addEventListener('click',prClose);
$id('prIBtn').addEventListener('click',e=>{ e.stopPropagation(); $id('prMenu').classList.toggle('open'); });
document.addEventListener('click',e=>{ if(!e.target.closest('#prSel')) $id('prMenu').classList.remove('open'); });
$id('prShX').addEventListener('click',closeSheets);
prLandMQ.addEventListener('change',()=>{ if(!prIsOpen()) return; closeSheets(); TRACKS.forEach(t=>{ if(t._prv) t._prv.fit=true; if(t._prk) t._prk.w=0; }); prRender(); });
let prRzT=null; window.addEventListener('resize',()=>{ if(!prIsOpen()) return; clearTimeout(prRzT); prRzT=setTimeout(prRender,120); });
// ---- Editor-Optionen (⋯) ----
function prOpenOpt(){
  const box=$id('prShRows'); box.innerHTML=''; $id('prShT').textContent='Optionen · Editor';
  const grp=t=>{ const g=document.createElement('div'); g.className='grp'; g.textContent=t; box.appendChild(g); };
  const row=(t,sub,get,set)=>{ const d=document.createElement('div'); d.className='pr-orow';
    d.innerHTML='<div class="tx"><b>'+t+'</b><span>'+sub+'</span></div><div class="am-seg"><button>AUS</button><button>AN</button></div>';
    const bs=d.querySelectorAll('button'), sync=()=>{ bs[0].classList.toggle('on',!get()); bs[1].classList.toggle('on',get()); };
    bs.forEach((b,i)=>b.onclick=()=>{ if((i===1)!==get()){ set(i===1); sync(); prRender(); } }); sync(); box.appendChild(d); };
  grp('Raster');
  row('Nur Skalentöne','Andere Zeilen und Tasten ausblenden',()=>prScaleOnly,v=>{ prScaleOnly=v; TRACKS.forEach(t=>{ if(t._prv) t._prv.fit=true; }); });
  row('Mitlaufen','Raster folgt beim Abspielen',()=>prFollow,v=>{ prFollow=v; });
  grp('Klaviatur');
  row('Balken statt Tasten','Nur Skalentöne als breite Felder',()=>prBars,v=>{ prBars=v; });
  row('Anschlag','Oben leise, unten laut',()=>prVp,v=>{ prVp=v; });
  row('Halten','Töne klingen nach dem Loslassen',()=>prSus,v=>{ prSus=v; if(!v) prFlushSust(); });
  openSheet('prSheet');
}
function prDrawPreview(tr){
  const pv=$id('prPv'); if(!pv) return; pv.innerHTML=''; pv.style.setProperty('--tc',tr.color);
  const base=currentPage*16, ev=tr.events.filter(e=>e.s<base+16 && e.s+e.l>base);
  if(ev.length){
    const ns=ev.map(e=>e.n), hi=Math.max.apply(null,ns)+1, lo=Math.min.apply(null,ns)-1, rows=Math.max(7,hi-lo+1);
    ev.forEach(e=>{
      const s0=Math.max(e.s,base), e0=Math.min(e.s+e.l,base+16), d=document.createElement('div'); d.className='pb'+(e.h?' gen'+(e.a?' acc':''):'');
      d.style.left=(s0-base)/16*100+'%'; d.style.width='calc('+(e0-s0)/16*100+'% - 2px)'; d.style.top=(hi-e.n)/rows*100+'%'; d.style.height='calc('+100/rows+'% - 2px)'; pv.appendChild(d);
    });
  } else { const t=document.createElement('div'); t.className='pvempty'; t.textContent='Noch keine Noten'; pv.appendChild(t); }
  if(hmOn(tr)){ const b=document.createElement('div'); b.className='hmb'; b.textContent='Harmonie · '+HM_MODES.find(m=>m.id===tr.harm.mode).n; pv.appendChild(b); }
  const ph=document.createElement('div'); ph.className='pph'; pv.appendChild(ph);
}
// ---- Spielen-Modus: Klaviatur (1,5 Oktaven), Balken-Modus, Rec auf das Raster (v54) ----
function prSetMode(m){
  prKbReleaseAll(); prMode=m; prSel=null; prG=null;
  if(m==='play' && prTr){ const k=prK(prTr); if(!k.w) prFitKb(prTr); }
  prRender();
}
// ---- Klaviatur mit Übersichtsleiste: Fenster ziehen = Lage, Rand ziehen = Anzahl Tasten (7–15, quer bis 24) ----
const PR_KLO=-24, PR_KHI=48;
function prK(tr){ return tr._prk || (tr._prk={lo:0,w:0}); }
function prKWhites(tr){ const w=[]; for(let n=PR_KLO;n<=PR_KHI;n++) if(prWhite(tr,n)) w.push(n); return w; }
function prKMaxW(){ return prLandOn()?24:15; }
function prFitKb(tr){ // Fenster um die vorhandenen Noten bzw. den Grundton legen
  const k=prK(tr), wl=prKWhites(tr); k.w=prLandOn()?15:11;
  const ns=tr.events.map(e=>e.n); let c=ns.length ? Math.round((Math.min.apply(null,ns)+Math.max.apply(null,ns))/2) : (isPoly(tr)?12:0);
  let i=0; while(i<wl.length-1 && wl[i]<c) i++; i=Math.max(0,Math.min(wl.length-k.w,i-Math.floor(k.w/2))); k.lo=wl[i];
}
function prBuildKb(){
  const tr=prTr, k=prK(tr); if(!k.w) prFitKb(tr); prKb.innerHTML='';
  const wl=prKWhites(tr); k.w=Math.max(7,Math.min(prKMaxW(),k.w)); let li=wl.indexOf(k.lo); if(li<0){ li=0; k.lo=wl[0]; } if(li>wl.length-k.w){ li=wl.length-k.w; k.lo=wl[li]; }
  const whites=wl.slice(li,li+k.w);
  if(prBars){
    let n=k.lo; while(!pitchInScale(n,tr) && n<PR_KHI) n++;
    for(let cnt=0;cnt<k.w && n<=PR_KHI;n++){
      if(!pitchInScale(n,tr)) continue;
      const d=document.createElement('div'); d.className='pkw pkbar'+((((n%12)+12)%12===0)?' root':''); d.dataset.n=n; d.textContent=pitchNoteName(tr,n); prKb.appendChild(d);
      if(cnt===0) prKbFirst=n; prKbLast=n; cnt++;
    }
  } else {
    const W=whites.length, bw=100/W*0.6;
    prKbFirst=whites[0]; prKbLast=whites[W-1];
    whites.forEach((n,i)=>{
      const inS=pitchInScale(n,tr), d=document.createElement('div'); d.className='pkw'+(inS?' sc':'')+(prScaleOnly&&!inS?' off':''); d.dataset.n=n;
      if((((n%12)+12)%12)===0) d.textContent=pitchNoteName(tr,n); prKb.appendChild(d);
      const b=n+1; if(i<W-1 && !prWhite(tr,b)){ const bs=pitchInScale(b,tr), e=document.createElement('div'); e.className='pkb'+(bs?' sc':'')+(prScaleOnly&&!bs?' off':''); e.dataset.n=b; e.style.left=((i+1)/W*100-bw/2)+'%'; e.style.width=bw+'%'; prKb.appendChild(e); }
    });
  }
  prDrawMini(wl,li,k.w);
  const zl=$id('prZoomL'); if(zl) zl.textContent=prZoomTxt();
}
function prDrawMini(wl,li,w){
  const m=$id('prMini'), W=m.clientWidth||300, ww=W/wl.length; let h='';
  wl.forEach((n,i)=>{ h+='<i style="left:'+(i*ww)+'px;width:'+ww+'px"></i>'; if(i<wl.length-1 && !prWhite(prTr,n+1)) h+='<i class="b" style="left:'+((i+1)*ww-ww*.3)+'px;width:'+(ww*.6)+'px"></i>'; });
  m.querySelectorAll('i').forEach(e=>e.remove()); m.insertAdjacentHTML('afterbegin',h);
  const mw=$id('prMw'); mw.style.left=(li*ww)+'px'; mw.style.width=(w*ww)+'px';
}
let prMD=null;
$id('prMini').addEventListener('pointerdown',e=>{
  if(!prTr) return; const m=$id('prMini'), r=m.getBoundingClientRect(), wl=prKWhites(prTr), ww=r.width/wl.length, k=prK(prTr), mw=$id('prMw').getBoundingClientRect();
  try{ m.setPointerCapture(e.pointerId); }catch(err){}
  let t='move'; if(Math.abs(e.clientX-mw.left)<16) t='l'; else if(Math.abs(e.clientX-mw.right)<16) t='r';
  if(t==='move' && (e.clientX<mw.left || e.clientX>mw.right)){ k.lo=wl[Math.max(0,Math.min(wl.length-k.w,Math.round((e.clientX-r.left)/ww-k.w/2)))]; prKbReleaseAll(); prBuildKb(); }
  prMD={t,x0:e.clientX,li0:wl.indexOf(k.lo),w0:k.w,ww,wl};
});
$id('prMini').addEventListener('pointermove',e=>{
  if(!prMD) return; const d=Math.round((e.clientX-prMD.x0)/prMD.ww), k=prK(prTr), wl=prMD.wl, MX=prKMaxW();
  if(prMD.t==='move') k.lo=wl[Math.max(0,Math.min(wl.length-k.w,prMD.li0+d))];
  else if(prMD.t==='r') k.w=Math.max(7,Math.min(MX,Math.min(wl.length-prMD.li0,prMD.w0+d)));
  else { const nw=Math.max(7,Math.min(MX,prMD.w0-d)), nl=Math.max(0,prMD.li0+prMD.w0-nw); k.w=prMD.li0+prMD.w0-nl; k.lo=wl[nl]; }
  prKbReleaseAll(); prBuildKb();
});
['pointerup','pointercancel'].forEach(t=>$id('prMini').addEventListener(t,()=>{ prMD=null; }));
// Klang: Acid mono über die Live-Stimme (wie die Spielfläche, Gleiten bei gehaltener Taste), Cosmic polyphon mit gehaltenen Stimmen
function prAcidOn(tr,n,vel,legato){
  const L=xyEnsureVoice(tr), t=audioCtx.currentTime, freq=noteFreq(tr.rootNote+n);
  L.o.frequency.cancelScheduledValues(t);
  if(legato && L.held){ L.o.frequency.setTargetAtTime(freq,t,ARP_SLIDE_TC); return; }
  L.o.frequency.setValueAtTime(freq,t);
  const base=300+(tr.cutoff!=null?tr.cutoff:0.5)*4000, envMod=tr.envMod!=null?tr.envMod:0.5, dec=arpDecaySeconds(tr.decay!=null?tr.decay:0.26);
  const fl=Math.max(60,base*0.35), pk=Math.min(12000,fl*Math.pow(2,envMod*3.03));
  L.f.detune.cancelScheduledValues(t); L.f.detune.setValueAtTime(0,t);
  L.f.frequency.cancelScheduledValues(t); L.f.frequency.setValueAtTime(pk,t); L.f.frequency.setTargetAtTime(fl,t,dec/3);
  L.f.Q.value=1+(tr.resonance!=null?tr.resonance:0.35)*20;
  const peak=Math.max(0.0001,Math.min(1,vel*tr.vol*1.1*ARP_LEVEL));
  L.a.gain.cancelScheduledValues(t); L.a.gain.setValueAtTime(Math.max(0.0001,L.a.gain.value),t); L.a.gain.exponentialRampToValueAtTime(peak,t+0.004);
  L.held=true;
}
function prAcidOff(tr){
  const L=tr._live; if(!L || !audioCtx) return; const t=audioCtx.currentTime;
  L.a.gain.cancelScheduledValues(t); L.a.gain.setValueAtTime(Math.max(0.0001,L.a.gain.value),t); L.a.gain.setTargetAtTime(0,t,0.03); L.held=false;
}
function prCosmicOn(tr,n,vel){
  const t=audioCtx.currentTime+0.005, freq=noteFreq(tr.rootNote+n+24);
  const cutoff=700+(tr.cutoff!=null?tr.cutoff:0.62)*7600, envMod=tr.envMod!=null?tr.envMod:0.62, decay=arpDecaySeconds(tr.decay!=null?tr.decay:0.42);
  const width=tr.cosmicWidth!=null?tr.cosmicWidth:0.62, warmth=tr.cosmicWarmth!=null?tr.cosmicWarmth:0.22, air=tr.cosmicAir!=null?tr.cosmicAir:0.18;
  const peak=Math.max(0.0001,Math.min(0.22,vel*tr.vol*0.16));
  const filter=audioCtx.createBiquadFilter(); filter.type='lowpass'; filter.Q.value=0.65+(tr.resonance!=null?tr.resonance:0.22)*3.6;
  filter.frequency.setValueAtTime(Math.min(15000,cutoff*(1.15+envMod*2.25)),t); filter.frequency.setTargetAtTime(Math.max(280,cutoff*0.5),t+0.02,Math.max(0.2,decay));
  const amp=audioCtx.createGain(); amp.gain.setValueAtTime(0.0001,t); amp.gain.linearRampToValueAtTime(peak,t+0.012); amp.gain.setTargetAtTime(peak*0.76,t+0.013,0.2);
  const left=audioCtx.createOscillator(), right=audioCtx.createOscillator(), sub=audioCtx.createOscillator(), shim=audioCtx.createOscillator();
  left.type='sawtooth'; right.type='sawtooth'; sub.type='triangle'; shim.type='sine';
  left.frequency.value=freq; right.frequency.value=freq; sub.frequency.value=freq/2; shim.frequency.value=Math.min(12000,freq*2);
  const det=3+width*15; left.detune.value=-det; right.detune.value=det;
  const lp=audioCtx.createStereoPanner(), rp=audioCtx.createStereoPanner(); lp.pan.value=-(0.15+width*0.62); rp.pan.value=0.15+width*0.62;
  left.connect(lp).connect(filter); right.connect(rp).connect(filter);
  const sg=audioCtx.createGain(); sg.gain.value=0.015+warmth*0.095; sub.connect(sg).connect(filter);
  const hg=audioCtx.createGain(); hg.gain.value=0.002+air*0.025; shim.connect(hg).connect(amp);
  filter.connect(amp).connect(tr.bus);
  const oscs=[left,right,sub,shim]; oscs.forEach(o=>o.start(t));
  let done=false;
  return { rel(){ if(done) return; done=true; const now=audioCtx.currentTime; amp.gain.cancelScheduledValues(now); amp.gain.setValueAtTime(Math.max(0.0001,amp.gain.value),now); amp.gain.setTargetAtTime(0.0001,now,0.12); oscs.forEach(o=>{ try{ o.stop(now+0.8); }catch(e){} }); } };
}
function prFlushSust(){ prSust.splice(0).forEach(h=>h.rel()); }
function prKbReleaseAll(){ Array.from(prLive.keys()).forEach(id=>prRelease(id)); prFlushSust(); }
// Position des Sequencers in Steps (gebrochen) für Rec
function prStepPos(){ const L=seqLength(); const p=currentStep-(nextNoteTime-audioCtx.currentTime)/stepDuration(); return ((p%L)+L)%L; }
function prRecStart(tr,n,vel){
  if(!prRec || !isPlaying || arrOn()) return null;
  if(hmConvert(tr)) prRecSnap=true;
  if(!prRecSnap){ taSnapshot(); prRecSnap=true; }
  const s=Math.round(prStepPos())%PATTERN_LENGTH;
  tr.events = isPoly(tr) ? tr.events.filter(e=>!(e.s===s && e.n===n)) : tr.events.filter(e=>!(e.s<=s && s<e.s+e.l));
  const ev={s,n,l:1,v:Math.max(0.1,Math.min(1,vel)),a:false,sl:false}; tr.events.push(ev); evTouch(tr); refreshTrackStepVisuals(tr);
  return {ev,t0:prStepPos(),tr};
}
function prRecEnd(rc){
  if(!rc) return; const L=seqLength(); let d=prStepPos()-rc.t0; if(d<0) d+=L;
  rc.ev.l=Math.max(1,Math.min(PATTERN_LENGTH-rc.ev.s,Math.round(d))); evTouch(rc.tr); refreshTrackStepVisuals(rc.tr);
}
function prKeyAt(x,y){ const e=document.elementFromPoint(x,y); return (e && e.dataset && e.dataset.n!==undefined && e.closest('#prKb')) ? e : null; }
function prPress(id,el,y,glide){
  const tr=prTr; if(!audioCtx) initAudio(); if(audioCtx.state!=='running') audioCtx.resume();
  const n=+el.dataset.n, r=el.getBoundingClientRect(), vel=prVp ? Math.max(0.3,Math.min(1,0.3+0.7*(y-r.top)/r.height)) : 0.85;
  const h = trInst(tr).live(tr,n,vel,glide||prLive.size>0); // Acid: null (einstimmig, Loslassen über prAcidOff)
  prLive.set(id,{el,n,h,tr,rc:prRecStart(tr,n,vel)}); el.classList.add('down');
}
function prRelease(id,keepAcid){
  const c=prLive.get(id); if(!c) return; prLive.delete(id); c.el.classList.remove('down'); prRecEnd(c.rc);
  if(isPoly(c.tr)){ if(prSus){ prSust.push(c.h); while(prSust.length>16) prSust.shift().rel(); } else c.h.rel(); }
  else if(!keepAcid && prLive.size===0){ if(prSus) prSust.push({rel:()=>prAcidOff(c.tr)}); else prAcidOff(c.tr); }
}
prKb.addEventListener('pointerdown',e=>{ const k=prKeyAt(e.clientX,e.clientY); if(k) prPress(e.pointerId,k,e.clientY,false); });
prKb.addEventListener('pointermove',e=>{
  const c=prLive.get(e.pointerId); if(!c) return; const k=prKeyAt(e.clientX,e.clientY);
  if(k && k!==c.el){ prRelease(e.pointerId,true); prPress(e.pointerId,k,e.clientY,true); }
});
['pointerup','pointercancel'].forEach(t=>prKb.addEventListener(t,e=>prRelease(e.pointerId)));
$id('taRoll').addEventListener('click',()=>prOpen(TRACKS[activeTrackIdx]));
$id('prPv').addEventListener('click',()=>prOpen(TRACKS[activeTrackIdx]));
