// ---- Tastenbelegung bearbeiten (#76, Mockup docs/mockups/issue-76.html v6) ----
// Nur in der Piano Roll an der Klaviatur links (der Spielmodus bleibt zum Spielen):
//   tippen = anhören (prLblCol in pianoroll.js) · halten = Taste-Sheet (leere Taste: Sample wählen) · halten und ziehen = verschieben.
// Ziehen ist relativ (Zeilen = Fingerweg + gescrollte Strecke), das Ziel ist immer eine ganz sichtbare Zeile; der Balken #smpKeyBar
// zeigt es über die ganze Breite rechts vom Finger. Mitscrollen am Rand nur in Zugrichtung, zeilenweise im Takt.
const SKG_HOLD=420, SKG_EDGE=36, SKG_STEP=160;
let skg=null, skgBar=null;
const skgTick=ms=>{ if(navigator.vibrate) try{ navigator.vibrate(ms); }catch(e){} };
function skgRow(y){ const r=prLbl.getBoundingClientRect(), i=Math.floor((y-r.top)/prV(prTr).rh); return i>=0 && i<prR.length ? i : -1; }
function skgDown(e){
  const tr=prTr; if(!tr || !smpIsKeys(tr) || prMode!=='edit' || e.button>0) return;
  const i=skgRow(e.clientY); if(i<0) return; skgEnd();
  skg={pid:e.pointerId, i, n:prR[i], x:e.clientX, y:e.clientY, cy:e.clientY, sy0:prV(tr).sy, last:0, ph:'wait', t:setTimeout(skgHold,SKG_HOLD)};
}
function skgHold(){ if(!skg) return; skg.ph='held'; skgTick(14); skgLift(skg.n); }
function skgLift(n){ document.querySelectorAll('.pk-bd.lift').forEach(x=>x.classList.remove('lift')); if(n==null) return;
  const b=prLbl.querySelector('[data-bn="'+n+'"]'); if(b) b.classList.add('lift'); }
function skgShowBar(i){
  const tr=prTr, v=prV(tr), vr=prView.getBoundingClientRect(), lr=$id('prLblCol').getBoundingClientRect();
  if(!skgBar){ skgBar=document.createElement('div'); skgBar.id='smpKeyBar'; document.body.appendChild(skgBar); }
  const top=vr.top+i*v.rh-v.sy, t0=Math.max(vr.top,top);
  Object.assign(skgBar.style, {display:'flex', left:lr.left+'px', width:(vr.right-lr.left)+'px', top:t0+'px', height:Math.max(0,Math.min(top+v.rh,vr.bottom)-t0)+'px'});
  const n=prR[i], src=trKeyInfo(tr,skg.n), o=trKeyInfo(tr,n), same=n===skg.n;
  skgBar.classList.toggle('sw', !!o && !same);
  skgBar.innerHTML='<b class="smp-tg"></b><span></span>'; skgBar.querySelector('b').textContent=src.tag;
  skgBar.querySelector('span').textContent=same ? 'Ziehen zum Verschieben' : '→ '+smpKeyName(tr,n)+(o ? ' · tauscht mit '+o.name : '');
}
function skgAim(){
  const v=prV(prTr), lo=Math.ceil(v.sy/v.rh-0.01), hi=Math.floor((v.sy+prVH())/v.rh+0.01)-1; // nur ganz sichtbare Zeilen
  const i=Math.max(0, lo, Math.min(prR.length-1, hi, skg.i+Math.round((skg.cy-skg.y+v.sy-skg.sy0)/v.rh)));
  if(i!==skg.to){ skg.to=i; skgTick(6); } skgShowBar(i);
}
function skgEdge(t){
  if(!skg || skg.ph!=='drag') return; skg.raf=requestAnimationFrame(skgEdge);
  const vr=prView.getBoundingClientRect(), v=prV(prTr), dy=skg.cy-skg.y;
  const dir=(skg.cy<vr.top+SKG_EDGE && dy<-v.rh*0.6) ? -1 : (skg.cy>vr.bottom-SKG_EDGE && dy>v.rh*0.6) ? 1 : 0;
  if(!dir || t-skg.last<SKG_STEP) return;
  const sy=v.sy, al=dir>0 ? Math.ceil((sy+prVH())/v.rh)*v.rh-prVH() : Math.floor(sy/v.rh)*v.rh;
  v.sy=Math.abs(al-sy)>1 ? al : sy+dir*v.rh; prClamp(v); if(v.sy===sy) return;
  skg.last=t; prApplyScroll(); skgAim();
}
function skgMove(e){
  if(!skg || e.pointerId!==skg.pid) return;
  if(e.pointerType==='mouse' && e.buttons===0){ skgUp(e); return; }
  const far=Math.hypot(e.clientX-skg.x, e.clientY-skg.y)>9;
  if(skg.ph==='wait'){ if(far) skgEnd(); return; }
  e.stopPropagation(); e.preventDefault(); skg.cy=e.clientY;
  if(skg.ph==='held' && far && trKeyInfo(prTr,skg.n)){ skg.ph='drag'; skg.to=skg.i; skgShowBar(skg.i); skg.raf=requestAnimationFrame(skgEdge); }
  if(skg.ph==='drag') skgAim();
}
function skgUp(e){
  if(!skg || e.pointerId!==skg.pid) return; const g=skg; skgEnd();
  if(g.ph==='wait') return; e.stopPropagation(); const tr=prTr;
  if(g.ph==='held'){ smpKeySheetOpen(tr,g.n); return; }
  const b=prR[g.to]; if(b!=null && b!==g.n) smpKeyMoveUi(tr,g.n,b);
}
function skgEnd(){ if(!skg) return; clearTimeout(skg.t); cancelAnimationFrame(skg.raf); skg=null; skgLift(null); if(skgBar) skgBar.style.display='none'; }
$id('prLblCol').addEventListener('pointerdown', skgDown);
$id('prLblCol').addEventListener('contextmenu', e=>{ if(prTr && smpIsKeys(prTr)) e.preventDefault(); });
window.addEventListener('pointermove', skgMove, true);
window.addEventListener('pointerup', skgUp, true);
window.addEventListener('pointercancel', ()=>skgEnd(), true);
document.addEventListener('visibilitychange', ()=>skgEnd()); window.addEventListener('blur', ()=>skgEnd());

// Verschieben mit Rückgängig im Hinweis
function smpKeyMoveUi(tr,a,b){
  const sw=trKeyInfo(tr,b), nm=trKeyInfo(tr,a).name; smpKeyMove(tr,a,b); smpKeysChanged(tr); smpKeyHear(tr,b);
  hmToast(nm+' → '+smpKeyName(tr,b)+(sw ? ' (getauscht)' : ''), true, ()=>{ smpKeyMove(tr,b,a); smpKeysChanged(tr); if(smpKeySheetN!=null) smpKeySheetOpen(tr,a); });
}

// ---- Taste-Sheet #smpKeySheet: Karte (antippen = hören), Liegt auf ‹ › (genau eine Taste weiter), Anderes Sample | Bearbeiten, Taste leeren ----
let smpKeySheetN=null;
function smpKeySheetOpen(tr,n){
  const ki=trKeyInfo(tr,n); if(!ki){ smpKeySheetClose(); smpPickOpen(tr,n); return; }
  smpKeySheetN=n; $id('smpKeyT').textContent='Taste '+smpKeyName(tr,n);
  const B=$id('smpKeyB'); B.innerHTML='';
  const w=document.createElement('button'); w.className='smp-kcard'; w.setAttribute('aria-label','Anhören');
  w.innerHTML='<div class="smp-kh"><b class="smp-tg"></b><span class="smp-kn"></span><span class="smp-kp">'+UI_IC.play+'</span></div><canvas width="600" height="96"></canvas>';
  w.querySelector('.smp-tg').textContent=ki.tag; w.querySelector('.smp-kn').textContent=ki.name;
  w.onclick=()=>smpKeyHear(tr,n); B.appendChild(w); smpKeyWave(w.querySelector('canvas'), ki.key);
  const mv=document.createElement('div'); mv.className='smp-kmv';
  mv.innerHTML='<span>Liegt auf</span><button data-d="-1" aria-label="Eine Taste tiefer"><svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><b></b><button data-d="1" aria-label="Eine Taste höher"><svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></button>';
  mv.querySelector('b').textContent=smpKeyName(tr,n);
  mv.querySelectorAll('[data-d]').forEach(b=>b.onclick=()=>{ const t=n+(+b.dataset.d); if(t<PR_LO || t>PR_HI) return; smpKeyMoveUi(tr,n,t); smpKeySheetOpen(tr,t); });
  B.appendChild(mv);
  const a=document.createElement('div'); a.className='smp-krow';
  a.innerHTML='<button class="act" data-x="pick">'+UI_IC.swap+'Anderes Sample</button><button class="act" data-x="edit">'+UI_IC.trim+'Bearbeiten</button>';
  const id=ki.key.startsWith('lib:') ? ki.key.slice(4) : null; if(!id) a.querySelector('[data-x=edit]').disabled=true;
  a.querySelector('[data-x=pick]').onclick=()=>{ smpKeySheetClose(); smpPickOpen(tr,n); };
  a.querySelector('[data-x=edit]').onclick=()=>{ smpKeySheetClose(); if(prIsOpen()) prClose(); openSampleEditor({sampleId:id}); };
  B.appendChild(a);
  const c=document.createElement('button'); c.className='smp-kclr'; c.innerHTML=UI_IC.del+'Taste leeren';
  c.onclick=()=>{ const k=ki.key; smpKeySet(tr,n,null); smpKeysChanged(tr); smpKeySheetClose(); hmToast('Taste '+smpKeyName(tr,n)+' geleert', true, ()=>{ smpKeySet(tr,n,k); smpKeysChanged(tr); }); };
  B.appendChild(c);
  if(!$id('smpKeySheet').classList.contains('open')) openSheet('smpKeySheet');
}
function smpKeySheetClose(){ smpKeySheetN=null; closeSheets(); }
// Nach „Anderes Sample“ (aus sampler.js) offenes Sheet auffrischen
function smpKeySheetRefresh(tr,n){ if(smpKeySheetN!=null && $id('smpKeySheet').classList.contains('open')) smpKeySheetOpen(tr,n); }
$id('smpKeyX').addEventListener('click', smpKeySheetClose);
async function smpKeyWave(cv, key){
  const S=samplerGet(key); if(S && S.p) await S.p; if(!S || !S.buf || !cv.isConnected) return;
  const x=cv.getContext('2d'), d=S.buf.getChannelData(0), W=cv.width, H=cv.height, a=Math.floor((S.off||0)*S.buf.sampleRate), L=d.length-a;
  x.clearRect(0,0,W,H); x.fillStyle='#8be86a';
  for(let i=0;i<W;i++){ let m=0; const s0=a+Math.floor(i*L/W), s1=a+Math.floor((i+1)*L/W); for(let j=s0;j<s1;j+=2) m=Math.max(m,Math.abs(d[j]));
    const h=Math.max(1,m*H*0.95); x.fillRect(i,(H-h)/2,1,h); }
}
