"use strict";
// =========================================================================
// UX v2: Menüs (Spur, Länge), Sheets (Einstellungen, Klang), Mute/Solo in der Spurleiste
// =========================================================================
function closeMenus(){ $id('grpMenu').classList.remove('open'); $id('grpBtn').setAttribute('aria-expanded','false'); }
function toggleMenu(menuId, btnId){ const o=!$id(menuId).classList.contains('open'); closeMenus(); if(o){ $id(menuId).classList.add('open'); $id(btnId).setAttribute('aria-expanded','true'); } }
$id('grpBtn').addEventListener('click', ()=>toggleMenu('grpMenu','grpBtn'));
document.addEventListener('click', e=>{ if(!e.target.closest('.lcdsel')) closeMenus(); });
function grpSelRender(){
  const m=$id('grpMenu'); if(!m) return; m.innerHTML='';
  ARR_GROUPS.forEach(g=>{ const b=document.createElement('button'); b.setAttribute('role','option'); if(g.id===patternGroup) b.className='cur';
    b.innerHTML=g.label+'<small>'+g.ids.map(i=>i.toUpperCase()).join(' ')+'</small>';
    b.onclick=()=>{ closeMenus(); setPatternGroup(g.id,true); }; m.appendChild(b); });
  const g=ARR_GROUPS.find(x=>x.id===patternGroup), n=g.ids.length;
  $id('grpName').textContent=g.label; $id('grpCnt').textContent=n+(n===1?' Spur':' Spuren');
}
grpSelRender();
function syncTbMS(){ const tr=TRACKS[activeTrackIdx], m=$id('tbM'), s2=$id('tbS'); if(!tr||!m) return; m.classList.toggle('on',!!tr.muted); s2.classList.toggle('on',!!tr.solo); }
$id('tbM').addEventListener('click', ()=>toggleTrackMute(TRACKS[activeTrackIdx]));
$id('tbS').addEventListener('click', ()=>toggleTrackSolo(TRACKS[activeTrackIdx]));
$id('tbSound').addEventListener('click', ()=>openKlang(TRACKS[activeTrackIdx]));

function closeSheets(){ if(typeof eqStop==='function') eqStop(); $id('sheetVeil').style.display='none'; ['setSheet','klSheet','fillSheet','prSheet','hmChordSheet','hmTplSheet','hmConfSheet','newBeatSheet'].forEach(i=>$id(i).classList.remove('open')); }
function openSheet(id){ closeMenus(); $id('sheetVeil').style.display='block'; $id(id).classList.add('open'); }
$id('sheetVeil').addEventListener('click', closeSheets); $id('setX').addEventListener('click', closeSheets); $id('fillX').addEventListener('click', closeSheets);
// Zurücksetzen (v78, Mockup zuruecksetzen-mockup.html B, ersetzt den versteckten Doppeltipp): Regler mit data-def zeigen
// ihren Wert als Taste mit ↺, sobald er vom Standard abweicht. Antippen = dieser Regler auf Standard, Rückgängig im Toast.
function srowMark(inp){
  const b=inp.parentNode && inp.parentNode.querySelector('b'); if(!b || inp.dataset.def==null) return;
  b.classList.add('rs'); const d=+inp.value===+inp.dataset.def; b.classList.toggle('def',d);
  if(d){ b.removeAttribute('role'); b.removeAttribute('aria-label'); } else { b.setAttribute('role','button'); b.setAttribute('aria-label','Auf Standard zurücksetzen'); }
}
document.addEventListener('input', e=>{ const i=e.target; if(i.matches && i.matches('.srow input[data-def]')) srowMark(i); }, true);
document.addEventListener('click', e=>{
  const b=e.target.closest && e.target.closest('.srow b.rs'); if(!b || b.classList.contains('def')) return;
  const inp=b.parentNode.querySelector('input'), old=inp.value, lab=b.parentNode.querySelector('label');
  const set=v=>{ if(inp.isConnected){ inp.value=v; inp.dispatchEvent(new Event('input',{bubbles:true})); } else if(inp._on) inp._on(+v); };
  set(inp.dataset.def);
  hmToast((lab?lab.textContent:'Regler')+' auf Standard', true, ()=>set(old));
});
function syncSettingsUI(){
  $id('sMaster').value=Math.round(masterVol*100); $id('sMasterV').textContent=$id('sMaster').value+'%';
  $id('sSwing').value=Math.round(swing/0.6*100); $id('sSwingV').textContent=$id('sSwing').value+'%';
  $id('sHum').value=Math.round(humanize*100); $id('sHumV').textContent=$id('sHum').value+'%';
  ['sMaster','sSwing','sHum'].forEach(i=>srowMark($id(i)));
}
$id('sMaster').addEventListener('input', e=>setMasterVol(e.target.value/100));
$id('sSwing').addEventListener('input', e=>{ swing=e.target.value/100*0.6; syncSettingsUI(); });
$id('sHum').addEventListener('input', e=>{ humanize=e.target.value/100; syncSettingsUI(); });
syncSettingsUI();
$id('settingsBtn').addEventListener('click', ()=>{ syncSettingsUI(); openSheet('setSheet'); });

function soundRow(label,min,max,val,def,fmt,on){
  const r=document.createElement('div'); r.className='srow';
  r.innerHTML='<label>'+label+'</label><input type="range" min="'+min+'" max="'+max+'" step="1"><b></b>';
  const inp=r.querySelector('input'), b=r.querySelector('b'); inp.value=Math.round(val); inp.dataset.def=def; b.textContent=fmt(+inp.value);
  inp._on=on; srowMark(inp);
  inp.addEventListener('input', ()=>{ b.textContent=fmt(+inp.value); b.classList.toggle('def',+inp.value===+def); on(+inp.value); });
  return r;
}
// ---------- Mix & FX und Effekt-Geräte (v79, Mockup effekte-mockup.html v7) ----------
// klMode: 'klang' (Klang-Sheet mit Reitern) | 'kanal' (aus dem Mixer) | 'master' | 'grp' | 'send' (Hall/Delay aus dem Mixer)
// klView: Stapel der Geräte-Ansichten (Zurück-Pfeil im Kopf). Inhalt Mix & FX = Kanal-Einstellungen im Mixer.
let klMode='klang', klArg=null, klView=[], fxUI={order:false,pick:false,grv:false,who:false};
const FXI={
 go:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>', dn:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
 l:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>', up:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>',
 plus:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>', trash:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
 ear:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h3l4-5v10l-4-5"/><path d="M15 9l6 6M21 9l-6 6"/></svg>', pw:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>',
 rs:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg>'};
function klResetUI(){ fxUI.order=false; fxUI.pick=false; }
function openKanal(tr){ klTr=tr; klMode='kanal'; klView=[]; klResetUI(); renderKlang(); openSheet('klSheet'); $id('klSheet').scrollTop=0; }
function openFxRoot(mode,arg){ klMode=mode; klArg=arg; klView=[]; klResetUI(); renderKlang(); openSheet('klSheet'); $id('klSheet').scrollTop=0; }
function klPush(v){ klView.push(v); klResetUI(); renderKlang(); $id('klSheet').scrollTop=0; }
function klBackFn(){ klView.pop(); klResetUI(); eqStop(); renderKlang(); }
const fxTrName=tr=>tr.grp?'Gruppe '+GRP_DEF[tr.k].n:tr.type==='arp'?prName(tr):tr.name, fxShort=tr=>tr.grp?GRP_DEF[tr.k].ab:tr.type==='arp'?prName(tr):(tr.short||tr.id.toUpperCase());
let FXH={}, fxHid=0; const fxOn=fn=>{ const id='f'+(fxHid++); FXH[id]=fn; return id; };
// Regler im Gerät: ohne Zahl (nach Gehör); Wert nur beim Ziehen im Label, Zurücksetzen-Symbol nur bei Abweichung
function fxRow(ps,val,def,fn,noReset){ const isd=def==null||Math.abs(val-def)<1e-9;
  return '<div class="srow fxbare"><label data-l="'+ps.l+'">'+ps.l+'</label><input type="range" min="'+ps.a+'" max="'+ps.b+'" step="'+ps.s+'" value="'+val+'" data-fxin="'+fxOn(v=>{ fn(v); return ps.f(v); })+'"'+(def!=null&&!noReset?' data-d="'+def+'"':'')+' aria-label="'+ps.l+'">'+
   (noReset||def==null?'<span></span>':'<button class="fxrz'+(isd?' def':'')+'" aria-label="'+ps.l+' zurücksetzen">'+FXI.rs+'</button>')+'</div>'; }
function fxLsel(k,opts,val,fn,o={}){ const c=opts.find(x=>x[0]===val), id=fxOn(fn);
  return '<div class="fxlsel" data-ls="'+id+'"><button class="ar" data-step="-1" aria-label="'+k+' zurück">'+FXI.l+'</button><button class="lb" data-op aria-haspopup="listbox"><span class="k">'+k+'</span><span class="x">'+(c?c[1]:o.custom||val)+(o.sub?' <em>'+o.sub+'</em>':'')+'</span>'+FXI.dn+'</button><button class="ar" data-step="1" aria-label="'+k+' weiter">'+FXI.go+'</button>'+
   '<div class="menu" role="listbox">'+opts.map(x=>'<button data-v="'+x[0]+'" class="'+(x[0]===val?'cur':'')+'"><span>'+x[1]+'</span>'+(x[2]?'<small>'+x[2]+'</small>':'')+'</button>').join('')+'</div></div>'; }
function fxBind(root){
  root.querySelectorAll('.fxbare input[data-fxin]').forEach(e=>{ const lab=e.previousElementSibling, b=e.nextElementSibling; let tm;
    const mark=()=>{ if(b&&b.classList.contains('fxrz')) b.classList.toggle('def',Math.abs(+e.value-(+e.dataset.d))<1e-9); };
    e.oninput=()=>{ lab.textContent=FXH[e.dataset.fxin](+e.value); lab.classList.add('val'); clearTimeout(tm); tm=setTimeout(()=>{ lab.textContent=lab.dataset.l; lab.classList.remove('val'); },900); mark(); };
    if(b&&b.classList.contains('fxrz')) b.onclick=()=>{ if(b.classList.contains('def')) return; const old=e.value; e.value=e.dataset.d; e.oninput(); hmToast(lab.dataset.l+' auf Standard',true,()=>{ e.value=old; e.oninput(); }); }; });
  root.querySelectorAll('[data-ls]').forEach(el=>{ const fn=FXH[el.dataset.ls], opts=[...el.querySelectorAll('.menu [data-v]')].map(b=>b.dataset.v), cb=el.querySelector('.menu .cur');
    el.querySelectorAll('[data-step]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const i=cb?opts.indexOf(cb.dataset.v):-1; fn(opts[(i+(+b.dataset.step)+opts.length)%opts.length]); });
    el.querySelector('[data-op]').onclick=e=>{ e.stopPropagation(); const m=el.querySelector('.menu'), w=m.classList.contains('open'); root.querySelectorAll('.fxlsel .menu.open').forEach(x=>x.classList.remove('open')); if(!w){ m.classList.add('open'); m.scrollIntoView({block:'nearest',behavior:'smooth'}); } };
    el.querySelectorAll('.menu [data-v]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); fn(b.dataset.v); }); }); }
document.addEventListener('click',e=>{ if(!e.target.closest('.fxlsel')) document.querySelectorAll('.fxlsel .menu.open').forEach(x=>x.classList.remove('open')); });
function fxHold(el,fn){ if(!el) return; const up=()=>{ if(!el.classList.contains('on')) return; el.classList.remove('on'); fn(false); };
  el.onpointerdown=e=>{ e.preventDefault(); el.classList.add('on'); fn(true); }; el.onpointerup=up; el.onpointerleave=up; el.onpointercancel=up; }
function fxSec(box,title,extra){ const s=document.createElement('div'); s.className='fxsec'; s.innerHTML='<div class="fxsh"><span>'+title+'</span>'+(extra||'')+'</div><div class="fxsb"></div>'; box.appendChild(s); return s.querySelector('.fxsb'); }
// EQ-Kurve: eigener Offline-Kontext nur für die Rechnung (geht auch ohne laufendes Audio)
let eqOC=null, eqON=null;
function eqCurve(tr,fr){ if(!eqOC){ eqOC=new (window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,128,44100); const c=eqOC;
    eqON={eqHp:c.createBiquadFilter(),eqLow:c.createBiquadFilter(),eqMid:c.createBiquadFilter(),eqHigh:c.createBiquadFilter()};
    eqON.eqHp.type='highpass'; eqON.eqHp.Q.value=.707; eqON.eqLow.type='lowshelf'; eqON.eqLow.frequency.value=250; eqON.eqMid.type='peaking'; eqON.eqMid.Q.value=1; eqON.eqHigh.type='highshelf'; eqON.eqHigh.frequency.value=4000; }
  eqSetNodes(eqON,tr,null); const n=fr.length, m=new Float32Array(n), ph=new Float32Array(n), out=new Float32Array(n);
  ['eqHp','eqLow','eqMid','eqHigh'].forEach(k=>{ eqON[k].getFrequencyResponse(fr,m,ph); for(let i=0;i<n;i++) out[i]+=20*Math.log10(Math.max(m[i],1e-6)); }); return out; }
const EQF0=20,EQF1=20000, eqFx=f=>Math.log(f/EQF0)/Math.log(EQF1/EQF0), eqXf=x=>EQF0*Math.pow(EQF1/EQF0,x);
function eqMini(tr){ const N=40, fr=new Float32Array(N).map((_,i)=>eqXf(i/(N-1))), c=eqCurve(tr,fr);
  return '<svg class="fxmini" viewBox="0 0 64 22" aria-hidden="true"><line x1="0" y1="11" x2="64" y2="11"/><polyline points="'+[...c].map((d,i)=>(i/(N-1)*64).toFixed(1)+','+(11-Math.max(-12,Math.min(12,d))*.8).toFixed(1)).join(' ')+'"/></svg>'; }
// Effektkette: Übersicht (an/aus, Preset). owner = Spur oder null (Master)
function fxChainHTML(owner){ const L=owner?owner.fx||(owner.fx=[]):masterFx, master=!owner, grp=!master&&owner.grp, ok=fxOwnKey(owner), types=Object.keys(FXDEF).filter(k=>(master||grp||!FXDEF[k].master)&&!L.some(f=>f.t===k));
  let h='<div class="fxchain'+(fxUI.order?' ord':'')+'"><div class="fxterm"><b>'+(master?'Mix':fxShort(owner))+'</b>'+(master?'alle Spuren':grp?GRP_DEF[owner.k].ids.length+' Spuren':'Klang')+'</div>';
  if(!master){ const on=owner.eqOn!==false; h+='<div class="fxslot fixed'+(on?'':' byp')+'"><button class="fxnode" data-eqpw aria-label="EQ '+(on?'ausschalten':'einschalten')+'"></button><div class="fxsr" data-eqopen role="button"><span class="n">EQ</span><span class="v">'+(on?eqMini(owner):'aus')+'</span>'+FXI.go+'<span class="fixl">fest</span></div></div>'; }
  L.forEach((f,i)=>{ const d=FXDEF[f.t], pn=fxPreName(d.pre,f.p);
    h+='<div class="fxslot'+(f.on?'':' byp')+'"><button class="fxnode" data-pw="'+f.id+'" aria-label="'+d.n+' '+(f.on?'ausschalten':'einschalten')+'"></button><div class="fxsr" data-sl="'+f.id+'" role="button"><span class="n">'+d.n+'</span>'+(d.build.toString().includes('red:')?'<span class="fxgr" data-gr="'+ok+':'+f.id+'"></span>':'')+'<span class="v">'+(f.on?(pn!=='Eigene'?pn:d.sum(f.p)):'aus')+'</span>'+FXI.go+
       '<span class="mv"><button data-mv="'+f.id+'" data-d="-1" '+(i===0?'disabled':'')+' aria-label="Nach oben">'+FXI.up+'</button><button data-mv="'+f.id+'" data-d="1" '+(i===L.length-1?'disabled':'')+' aria-label="Nach unten">'+FXI.dn+'</button></span></div></div>'; });
  if(L.length<FX_MAX && !fxUI.order && types.length){ h+='<button class="fxadd" data-add>'+FXI.plus+'Effekt hinzufügen<small>'+L.length+' von '+FX_MAX+'</small></button>';
    h+='<div class="fxpick'+(fxUI.pick?' open':'')+'">'+types.map(k=>'<button data-new="'+k+'">'+FXDEF[k].n+'<small>'+FXDEF[k].w+'</small></button>').join('')+'</div>'; }
  return h+'<div class="fxterm"><b>'+(master?'Ausgang':grp?'Gruppe':'Kanal')+'</b>'+(master?'Lautsprecher · Schutz −0,3 dB<i class="fxbrake" data-brake title="Notbremse: leuchtet, wenn sie eingreift"></i>':grp?'Laut → Master':'Mixer')+'</div></div>'; }
// Absenkung von Kompressor/Limiter und Notbremsen-Lampe live anzeigen (v95, #51), solange das Klang-Fenster solche Anzeigen enthält
const fxOwnKey=o=>!o?'m':o.grp?'g.'+o.k:'t.'+o.id;
function fxNodeOf(key,id){ const [a,b]=key.split('.'), L=a==='m'?FXG.mfxN:a==='g'?(FXG.g&&FXG.g[b]?FXG.g[b].n:[]):((TRACKS.find(t=>t.id===b)||{})._fxN||[]); return (L||[]).find(n=>n.id===id); }
let fxGrRAF=0, fxBrakeT=-9;
function fxGrLoop(){ const box=$id('klRows'), els=box?box.querySelectorAll('[data-gr]'):[], lamps=box?box.querySelectorAll('[data-brake]'):[];
  if(!$id('klSheet').classList.contains('open') || (!els.length && !lamps.length)){ fxGrRAF=0; return; }
  els.forEach(e=>{ const [k,id]=e.dataset.gr.split(':'), n=fxNodeOf(k,+id), r=n&&n.red?-n.red.reduction:0, t=r>0.1?'−'+fxDe(r,1):'';
    if(e.classList.contains('fxgrbar')) e.style.setProperty('--gr',Math.min(100,r/20*100)+'%'); else if(e.textContent!==t) e.textContent=t; });
  if(lamps.length && masterAnalyser){ const now=performance.now(); if(readPeak(masterAnalyser)>Math.pow(10,BRAKE_KNEE/20)) fxBrakeT=now; lamps.forEach(l=>l.classList.toggle('on',now-fxBrakeT<250)); }
  fxGrRAF=requestAnimationFrame(fxGrLoop); }
function fxGrStart(){ if(!fxGrRAF) fxGrRAF=requestAnimationFrame(fxGrLoop); }
const fxOrdBtn=L=>L.length>1?'<button class="fxtbtn'+(fxUI.order?' on':'')+'" data-ord>'+(fxUI.order?'Fertig':'Ordnen')+'</button>':'';
function fxRebuildOwner(o){ if(!audioCtx) return; if(!o) fxMasterRebuild(); else if(o.grp) grpFxRebuild(o.k); else trFxRebuild(o); }
function fxBindChain(root,owner){ const L=owner?owner.fx:masterFx, find=id=>L.find(f=>f.id===+id), done=()=>{ fxRebuildOwner(owner); renderKlang(); mixerRebuild(); };
  root.querySelectorAll('[data-ord]').forEach(b=>b.onclick=()=>{ fxUI.order=!fxUI.order; fxUI.pick=false; renderKlang(); });
  root.querySelectorAll('[data-pw]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const f=find(b.dataset.pw); f.on=!f.on; done(); });
  root.querySelectorAll('[data-sl]').forEach(r=>r.onclick=e=>{ if(fxUI.order||e.target.closest('.mv')) return; klPush({v:'dev',o:owner,id:+r.dataset.sl}); });
  root.querySelectorAll('[data-mv]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const f=find(b.dataset.mv), i=L.indexOf(f), j=i+(+b.dataset.d); if(j<0||j>=L.length) return;
    const els=[...root.querySelectorAll('.fxslot:not(.fixed)')], a=els[i], c=els[j], dy=c.getBoundingClientRect().top-a.getBoundingClientRect().top;
    a.style.transform='translateY('+dy+'px)'; c.style.transform='translateY('+(-dy)+'px)'; setTimeout(()=>{ L.splice(i,1); L.splice(j,0,f); done(); },170); });
  const ad=root.querySelector('[data-add]'); if(ad) ad.onclick=()=>{ fxUI.pick=!fxUI.pick; renderKlang(); const pk=$id('klRows').querySelector('.fxpick.open'); if(pk) pk.scrollIntoView({block:'nearest',behavior:'smooth'}); };
  root.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>{ const f=fxNew(b.dataset.new); let at=L.findIndex(x=>FXDEF[x.t].rank>FXDEF[f.t].rank); if(at<0) at=L.length; L.splice(at,0,f); fxUI.pick=false; done(); });
  if(owner){ const ep=root.querySelector('[data-eqpw]'); if(ep) ep.onclick=e=>{ e.stopPropagation(); owner.eqOn=owner.eqOn===false; eqApply(owner); renderKlang(); };
    const eo=root.querySelector('[data-eqopen]'); if(eo) eo.onclick=()=>{ if(!fxUI.order) klPush({v:'eq',o:owner}); }; } }
// Mix & FX = Kanal-Einstellungen
function mixFxBody(tr,box){ const arp=tr.type==='arp';
  box.appendChild(soundRow('Laut',0,100,tr.vol*100,Math.round(tr._def.vol*100),v=>v,v=>setTrackVol(tr,v/100)));
  box.appendChild(soundRow('Pan',-100,100,(tr.pan||0)*100,0,v=>v===0?'C':(v<0?'L':'R')+Math.abs(v),v=>{ tr.pan=v/100; if(tr.panner) tr.panner.pan.value=tr.pan; }));
  if(!arp) box.appendChild(soundRow('Tune',0,100,tr.tune*100,Math.round(tr._def.tune*100),v=>tr.isSample?Math.round(Math.pow(2,(v/100-0.5)*2)*100)+'%':v,v=>tr.tune=v/100));
  const sb=fxSec(box,'Sends');
  [['hall','reverbAmount','sendGain'],['delay','delaySend','delaySendGain']].forEach(([k,prop,node])=>{
    const r=soundRow(FX_SEND[k].n,0,100,(tr[prop]||0)*100,Math.round((tr._def[prop]||0)*100),v=>v,v=>{ tr[prop]=v/100; if(tr[node]) tr[node].gain.value=tr[prop]; });
    const lab=r.querySelector('label'); lab.classList.add('fxlk'); lab.innerHTML=FX_SEND[k].n+FXI.go; lab.setAttribute('role','button'); lab.onclick=()=>klPush({v:'send',k}); sb.appendChild(r); });
  const eb=fxSec(box,'Effekte',fxOrdBtn(tr.fx||[])); eb.innerHTML=fxChainHTML(tr); fxBindChain(eb.parentNode,tr); fxGrStart();
  const g=document.createElement('div'); g.className='fxcard'+(fxUI.grv?' open':''); g.innerHTML='<button class="fxch" aria-expanded="'+fxUI.grv+'"><span>Groove</span><span class="sum">'+(fxUI.grv?'':'Feel '+((tr.feel||0)>0?'+':'')+(tr.feel||0)+' ms')+'</span>'+FXI.dn+'</button><div class="fxcb"></div>';
  g.querySelector('.fxch').onclick=()=>{ fxUI.grv=!fxUI.grv; renderKlang(); };
  g.querySelector('.fxcb').appendChild(soundRow('Feel',-30,30,tr.feel||0,0,v=>(v>0?'+':'')+v+'ms',v=>tr.feel=v)); box.appendChild(g); }
// Geräte-Ansichten
function fxRenderView(box,v){ FXH={}; fxHid=0; const T=t=>$id('klT').textContent=t, tr=klTr; let h='';
  if(v.v==='kanal'){ T('Kanal · '+fxTrName(tr)); mixFxBody(tr,box); return; }
  if(v.v==='master'){ T('Master');
    box.appendChild(soundRow('Laut',0,100,masterVol*100,85,v=>v,v=>setMasterVol(v/100)));
    const eb=fxSec(box,'Effekte · ganzer Mix',fxOrdBtn(masterFx)); eb.innerHTML=fxChainHTML(null); fxBindChain(eb.parentNode,null); fxGrStart(); return; }
  if(v.v==='grp'){ const k=GRP_DEF[klArg]?klArg:'drums', G=grps[k], D=GRP_DEF[k]; T('Gruppe · '+D.n);
    box.appendChild(soundRow('Laut',0,100,G.vol*100,100,v=>v,v=>{ G.vol=v/100; grpUpdate(k); mixerSyncGroup(k); }));
    const eb=fxSec(box,'Effekte · ganze Gruppe',fxOrdBtn(G.fx)); eb.innerHTML=fxChainHTML(G); fxBindChain(eb.parentNode,G); fxGrStart();
    const n=document.createElement('div'); n.className='kl-note'; n.textContent='Fasst '+D.ids.map(i=>i.toUpperCase()).join(', ')+' zusammen. Im Mixer klappt „'+D.ab+'“ die einzelnen Kanäle auf.'; box.appendChild(n); return; }
  if(v.v==='dev'){ const o=v.o, L=o?o.fx:masterFx, f=L.find(x=>x.id===v.id); if(!f){ klBackFn(); return; } const d=FXDEF[f.t], up=()=>fxUpd(o,f);
    T(d.n+' · '+(o?fxShort(o):'Master'));
    h+='<div class="fxdevtop"><button class="fxpwr'+(f.on?' on':'')+'" data-pwd aria-label="An/Aus">'+FXI.pw+'</button>'+fxLsel('Preset',d.pre.map(x=>[x[0],x[0]]),fxPreName(d.pre,f.p),n=>{ Object.assign(f.p,d.pre.find(x=>x[0]===n)[1]); up(); renderKlang(); },{custom:'Eigene'})+'</div>';
    const def=d.pre[0][1];
    d.ps.forEach(ps=>{ h+=ps.sel?fxLsel(ps.l,ps.sel,f.p[ps.k],x=>{ f.p[ps.k]=x; up(); renderKlang(); }):fxRow(ps,f.p[ps.k],def[ps.k],x=>{ f.p[ps.k]=x; up(); fxSoft(); }); });
    if(d.build.toString().includes('red:')) h+='<div class="fxgrrow"><span>Absenkung</span><i class="fxgrbar" data-gr="'+fxOwnKey(o)+':'+f.id+'"></i><b data-gr="'+fxOwnKey(o)+':'+f.id+'"></b></div>';
    h+='<div class="fxfoot"><button class="fxfb" data-hold>'+FXI.ear+'Ohne vergleichen</button><button class="fxfb dng" data-rm>'+FXI.trash+'Entfernen</button></div>';
    box.innerHTML=h; fxBind(box); fxGrStart();
    box.querySelector('[data-pwd]').onclick=()=>{ f.on=!f.on; fxRebuildOwner(o); renderKlang(); mixerRebuild(); };
    box.querySelector('[data-rm]').onclick=()=>{ const i=L.indexOf(f); L.splice(i,1); fxRebuildOwner(o); klView.pop(); renderKlang(); mixerRebuild(); hmToast(d.n+' entfernt',true,()=>{ L.splice(i,0,f); fxRebuildOwner(o); renderKlang(); mixerRebuild(); }); };
    fxHold(box.querySelector('[data-hold]'),st=>{ f._byp=st; fxRebuildOwner(o); }); return; }
  if(v.v==='eq'){ const tr=v.o||klTr; T('EQ · '+fxShort(tr)); const on=tr.eqOn!==false;
    h+='<div class="fxdevtop"><button class="fxpwr'+(on?' on':'')+'" data-pwd aria-label="An/Aus">'+FXI.pw+'</button>'+fxLsel('Preset',EQ_PRE.map(x=>[x[0],x[0]]),fxPreName(EQ_PRE,tr),n=>{ Object.assign(tr,EQ_PRE.find(x=>x[0]===n)[1]); eqApply(tr); renderKlang(); },{custom:'Eigene'})+'</div>';
    h+='<div class="fxeqbox"><canvas id="fxEqCv" aria-label="EQ-Kurve: Punkte ziehen"></canvas></div><div class="fxcap"><span>Punkte ziehen</span><span>'+(isPlaying?'Spektrum läuft':'Play zeigt das Spektrum')+'</span></div>';
    EQ_PS.forEach(ps=>h+=fxRow(ps,ps.k==='eqMf'?(tr.eqMf!=null?tr.eqMf:EQ_MF_DEF):(tr[ps.k]||0),EQ_PRE[0][1][ps.k],x=>{ tr[ps.k]=x; eqApply(tr); fxSoft(); }));
    h+='<div class="fxfoot"><button class="fxfb" data-hold>'+FXI.ear+'Ohne vergleichen</button></div>';
    box.innerHTML=h; fxBind(box);
    box.querySelector('[data-pwd]').onclick=()=>{ tr.eqOn=tr.eqOn===false; eqApply(tr); renderKlang(); };
    fxHold(box.querySelector('[data-hold]'),st=>{ tr._eqByp=st; eqApply(tr); }); eqDraw(tr); return; }
  if(v.v==='send'){ const k=v.k||klArg, d=FX_SEND[k], p=k==='hall'?fxHall:fxDelay, up=()=>{ k==='hall'?fxHallUpdate():fxDelayUpdate(); }, def=d.pre[0][1];
    T(d.n+' · für alle Spuren');
    h+=fxLsel('Preset',d.pre.map(x=>[x[0],x[0]]),fxPreName(d.pre,p),n=>{ Object.assign(p,d.pre.find(x=>x[0]===n)[1]); up(); renderKlang(); mixerRebuild(); },{custom:'Eigene'});
    if(k==='delay'){ const n=FX_NV.find(x=>x[0]===p.div);
      h+=fxLsel('Notenwert',FX_NV.map(x=>[x[0],x[1],x[2]]),p.div,x=>{ p.div=x; up(); renderKlang(); mixerRebuild(); },{sub:n[2]});
      h+='<div class="fxtl" id="fxTl">'+fxTl()+'</div><div class="fxcap"><span>Echos eines Schlags auf die 1'+(p.md==='pp'?' · voll links, hohl rechts':'')+'</span><span>'+Math.round(fxDelaySec()*1000)+' ms</span></div>';
      h+='<div class="am-seg fxseg"><button data-md="mono" class="'+(p.md==='mono'?'on':'')+'">MONO</button><button data-md="pp" class="'+(p.md==='pp'?'on':'')+'">PING-PONG</button></div>'; }
    if(k==='hall') h+=fxRow(d.ps[0],p.sz,def.sz,x=>{ p.sz=x; up(); fxSoft(); });
    d.ps.forEach(ps=>{ if(k==='hall'&&ps.k==='sz') return; h+=fxRow(ps,p[ps.k],def[ps.k],x=>{ p[ps.k]=x; up(); fxSoft(); mixerRebuildSoft(); }); });
    if(k==='delay') h+='<div class="fxfoot"><button class="fxfb" data-holdd>'+FXI.ear+'Ohne Delay vergleichen</button></div>';
    const prop=k==='hall'?'reverbAmount':'delaySend', node=k==='hall'?'sendGain':'delaySendGain';
    const sum=TRACKS.filter(t=>(t[prop]||0)>0).map(t=>(t.short||t.id.toUpperCase())+' '+Math.round(t[prop]*100)).join(' · ')||'keine';
    h+='<div class="fxcard'+(fxUI.who?' open':'')+'"><button class="fxch" data-who aria-expanded="'+fxUI.who+'"><span>Anteile der Spuren</span><span class="sum">'+(fxUI.who?'':sum)+'</span>'+FXI.dn+'</button><div class="fxcb">'+
       (fxUI.who?TRACKS.map(t=>fxRow({l:t.short||t.id.toUpperCase(),a:0,b:1,s:.01,f:fxPct},t[prop]||0,null,x=>{ t[prop]=x; if(t[node]) t[node].gain.value=x; },true)).join(''):'')+'</div></div>';
    box.innerHTML=h; fxBind(box);
    box.querySelectorAll('[data-md]').forEach(b=>b.onclick=()=>{ p.md=b.dataset.md; up(); renderKlang(); mixerRebuild(); });
    box.querySelector('[data-who]').onclick=()=>{ fxUI.who=!fxUI.who; renderKlang(); };
    fxHold(box.querySelector('[data-holdd]'),st=>{ if(FXG.dlOut) FXG.dlOut.gain.setTargetAtTime(st?0:fxDelay.lv,audioCtx.currentTime,.01); }); return; } }
// Beim Ziehen nur Anzeigen nachführen (Regler bleibt unter dem Finger)
function fxSoft(){ const v=klView[klView.length-1]||{v:klMode}, x=$id('klRows').querySelector('.fxdevtop .x, .fxlsel .x');
  if(v.v==='send'){ const t=$id('fxTl'); if(t) t.innerHTML=fxTl(); const k=v.k||klArg; if(x) x.textContent=fxPreName(FX_SEND[k].pre,k==='hall'?fxHall:fxDelay); }
  if(v.v==='dev'){ const L=v.o?v.o.fx:masterFx, f=L.find(y=>y.id===v.id); if(f&&x) x.textContent=fxPreName(FXDEF[f.t].pre,f.p); }
  if(v.v==='eq'&&x) x.textContent=fxPreName(EQ_PRE,v.o||klTr); }
function fxTl(){ const p=fxDelay, T=FX_NV.find(n=>n[0]===p.div)[3], pos=s=>'calc(6px + (100% - 12px) * '+((s+.5)/16)+')';
  let h='<div class="g">'+'<i></i>'.repeat(16)+'</div><div class="m s" style="left:'+pos(0)+';height:30px"></div>';
  for(let k=1;k<40;k++){ const s=k*T; if(s>=16) break; const a=Math.pow(p.fb,k-1)*p.lv; if(a<.04) break; h+='<div class="m'+(p.md==='pp'&&k%2===0?' r':'')+'" style="left:'+pos(s)+';height:'+Math.max(4,30*a)+'px"></div>'; }
  return h+'<div class="ax"><span>1</span><span>2</span><span>3</span><span>4</span></div>'; }
// EQ-Gerät: Raster, Spektrum, Kurve, ziehbare Punkte (Tiefen-Filter, Tiefen, Mitten, Höhen)
let eqRAF=0; function eqStop(){ cancelAnimationFrame(eqRAF); eqRAF=0; }
function eqDraw(tr){ eqStop(); const cv=$id('fxEqCv'); if(!cv) return; const dpr=window.devicePixelRatio||1, W=cv.clientWidth, H=cv.clientHeight; cv.width=W*dpr; cv.height=H*dpr;
  const g=cv.getContext('2d'); g.scale(dpr,dpr); const N=160, fr=new Float32Array(N).map((_,i)=>eqXf(i/(N-1))), R=15, pad=8;
  const X=f=>pad+eqFx(f)*(W-2*pad), Y=d=>H/2-d/R*(H/2-12);
  const hs=()=>[{k:'eqLc',x:X(Math.max(20,eqLcHz(tr.eqLc||0))),y:Y(0),l:'Tiefen-Filter',off:!(tr.eqLc>.005)},{k:'eqLowGain',x:X(250),y:Y(tr.eqLowGain||0),l:'Tiefen'},{k:'eqMidGain',x:X(eqMfHz(tr.eqMf)),y:Y(tr.eqMidGain||0),l:'Mitten'},{k:'eqHighGain',x:X(4000),y:Y(tr.eqHighGain||0),l:'Höhen'}];
  const an=tr.grp?(FXG.g&&FXG.g[tr.k]&&FXG.g[tr.k].an):tr.analyser; let spec=an?new Float32Array(an.frequencyBinCount):null, drag=null;
  function frame(){ if(!$id('fxEqCv')) return; g.clearRect(0,0,W,H); const on=tr.eqOn!==false;
    g.strokeStyle='rgba(63,169,255,.08)'; g.lineWidth=1; g.font='13px VT323, monospace'; g.fillStyle='#2f6a92';
    [50,100,200,500,1000,2000,5000,10000].forEach(f=>{ const x=Math.round(X(f))+.5; g.beginPath(); g.moveTo(x,0); g.lineTo(x,H); g.stroke(); if(f===100||f===1000||f===10000) g.fillText(f>=1000?f/1000+'k':f,x+3,H-4); });
    [-12,-6,6,12].forEach(d=>{ const y=Math.round(Y(d))+.5; g.beginPath(); g.moveTo(0,y); g.lineTo(W,y); g.stroke(); });
    g.strokeStyle='rgba(143,212,255,.25)'; g.beginPath(); g.moveTo(0,Y(0)+.5); g.lineTo(W,Y(0)+.5); g.stroke();
    if(spec&&isPlaying&&audioCtx){ an.getFloatFrequencyData(spec); const sr=audioCtx.sampleRate, n=spec.length; g.beginPath(); g.moveTo(X(20),H);
      for(let i=1;i<n;i++){ const f=i*sr/2/n; if(f<20||f>20000) continue; g.lineTo(X(f),H-Math.max(0,Math.min(1,(spec[i]+100)/80))*H*.85); }
      g.lineTo(X(20000),H); g.closePath(); g.fillStyle='rgba(63,169,255,.12)'; g.fill(); }
    const c=on?eqCurve(tr,fr):new Float32Array(N), path=()=>{ g.beginPath(); for(let i=0;i<N;i++){ const x=X(fr[i]), y=Y(Math.max(-R,Math.min(R,c[i]))); i?g.lineTo(x,y):g.moveTo(x,y); } };
    path(); g.lineTo(X(20000),Y(0)); g.lineTo(X(20),Y(0)); g.closePath(); const gr=g.createLinearGradient(0,0,0,H); gr.addColorStop(0,'rgba(95,194,255,.22)'); gr.addColorStop(.5,'rgba(95,194,255,.04)'); gr.addColorStop(1,'rgba(95,194,255,.22)'); g.fillStyle=gr; g.fill();
    path(); g.strokeStyle=on?'#5fc2ff':'#2b5470'; g.lineWidth=2; g.shadowColor='rgba(95,194,255,.7)'; g.shadowBlur=on?8:0; g.stroke(); g.shadowBlur=0;
    hs().forEach(hd=>{ const act=drag&&drag.k===hd.k; g.beginPath(); g.arc(hd.x,hd.y,act?9:7,0,7);
      if(hd.off||!on){ g.fillStyle='#0a0a0d'; g.fill(); g.strokeStyle='#3f7aa6'; g.lineWidth=1.5; g.stroke(); } else { g.fillStyle='#e9f6ff'; g.shadowColor='#5fc2ff'; g.shadowBlur=10; g.fill(); g.shadowBlur=0; }
      if(act){ const ps=EQ_PS.find(p=>p.k===hd.k), t=hd.l+' '+(hd.k==='eqMidGain'?fxHz(eqMfHz(tr.eqMf))+' ':'')+ps.f(tr[hd.k]||0); g.font='15px VT323, monospace'; g.fillStyle='#e9f6ff'; const tw=g.measureText(t).width; g.fillText(t,Math.min(W-tw-4,Math.max(4,hd.x-tw/2)),Math.max(14,hd.y-14)); } });
    eqRAF=requestAnimationFrame(frame); }
  const syncRows=()=>{ $id('klRows').querySelectorAll('.fxbare input').forEach((inp,i)=>{ const ps=EQ_PS[i]; if(!ps) return; const val=ps.k==='eqMf'?(tr.eqMf!=null?tr.eqMf:EQ_MF_DEF):(tr[ps.k]||0); inp.value=val; const b=inp.nextElementSibling; if(b&&b.classList.contains('fxrz')) b.classList.toggle('def',Math.abs(val-EQ_PRE[0][1][ps.k])<1e-9); }); };
  cv.onpointerdown=e=>{ const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top; let best=null,bd=1e9; hs().forEach(hd=>{ const d=Math.hypot(hd.x-x,hd.y-y); if(d<bd){ bd=d; best=hd; } }); if(bd>40) return; drag={k:best.k}; cv.setPointerCapture(e.pointerId); e.preventDefault(); };
  cv.onpointermove=e=>{ if(!drag) return; const r=cv.getBoundingClientRect(), x=e.clientX-r.left, y=e.clientY-r.top, f=eqXf(Math.max(0,Math.min(1,(x-pad)/(W-2*pad)))), dbv=Math.round(Math.max(-12,Math.min(12,(H/2-y)/(H/2-12)*R))*2)/2;
    if(drag.k==='eqLc') tr.eqLc=f<22?0:Math.max(0,Math.min(1,Math.log(f/20)/Math.log(20)));
    if(drag.k==='eqLowGain') tr.eqLowGain=dbv; if(drag.k==='eqHighGain') tr.eqHighGain=dbv;
    if(drag.k==='eqMidGain'){ tr.eqMidGain=dbv; tr.eqMf=Math.max(0,Math.min(1,Math.log(f/200)/Math.log(40))); }
    eqApply(tr); fxSoft(); syncRows(); };
  cv.onpointerup=cv.onpointercancel=()=>{ drag=null; };
  frame(); }
// Klang-Sheet (v64): ein Einstieg für alle Spuren. Melodiespuren mit Reitern Sound / Mix & FX / Tonart,
// Drums/Perc/Sample nur Mix-Regler (+ Tune). Werte direkt auf tr.*
let klTab='sound', klTr=null;
function openKlang(tr,tab){
  klTr=tr||TRACKS[activeTrackIdx]; if(tab) klTab=tab; klMode='klang'; klView=[]; klResetUI();
  renderKlang(); openSheet('klSheet');
}
function renderKlang(){
  const box=$id('klRows'); eqStop(); $id('klBack').hidden=!klView.length;
  if(klView.length || klMode!=='klang'){ box.innerHTML=''; $id('klTabs').style.display='none'; $id('klSheet').classList.remove('cos','pno'); fxRenderView(box,klView.length?klView[klView.length-1]:{v:klMode}); return; }
  const tr=klTr, arp=tr.type==='arp'; box.innerHTML='';
  const tab=arp?klTab:'fx';
  $id('klT').textContent='Klang · '+(arp?prName(tr):tr.name);
  $id('klTabs').style.display=arp?'':'none';
  $id('klTabs').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
  $id('klSheet').classList.toggle('cos',tr.id==='cosmic'); $id('klSheet').classList.toggle('pno',tr.id==='piano');
  const grp=t=>{ const g=document.createElement('div'); g.className='grp'; g.textContent=t; box.appendChild(g); };
  const pct=v=>v+'%', num=(v,d)=>v!=null?v:d;
  if(tab==='sound'){
    if(tr.id==='piano'){
      grp('Instrument');
      const sg=document.createElement('div'); sg.className='am-seg';
      Object.keys(KEY_SOUNDS).concat(['organ']).forEach(id=>{ const b=document.createElement('button'); const k=KEY_SOUNDS[id];
        if(!k){ b.className='soon'; b.innerHTML='ORGEL<small>bald</small>'; } else { b.textContent=k.name; if(tr.sound===id) b.classList.add('on'); b.onclick=()=>{ keysSetSound(tr,id); renderKlang(); if(prIsOpen()) prRenderChrome(); }; }
        sg.appendChild(b); });
      box.appendChild(sg);
      const rh=tr.sound==='rhodes'; grp('Klang · '+(KEY_SOUNDS[tr.sound]||KEY_SOUNDS.piano).name);
      box.appendChild(soundRow('Ton',0,100,num(tr.cutoff,.55)*100,Math.round((KEY_SOUNDS[tr.sound]||KEY_SOUNDS.piano).def.cutoff*100),pct,v=>tr.cutoff=v/100));
      box.appendChild(soundRow(rh?'Biss':'Härte',0,100,num(tr.envMod,.5)*100,Math.round((KEY_SOUNDS[tr.sound]||KEY_SOUNDS.piano).def.envMod*100),pct,v=>tr.envMod=v/100));
      box.appendChild(soundRow('Ausklang',0,100,num(tr.decay,.5)*100,Math.round((KEY_SOUNDS[tr.sound]||KEY_SOUNDS.piano).def.decay*100),pct,v=>tr.decay=v/100));
      if(rh) box.appendChild(soundRow('Tremolo',0,100,num(tr.tremolo,.35)*100,35,pct,v=>tr.tremolo=v/100));
      return;
    }
    const cos=tr.id==='cosmic', ico=d=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+d+'</svg>';
    const acts=document.createElement('div'); acts.className='acts';
    acts.innerHTML='<button class="act" id="klRand">'+ico('<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>')+'Filter würfeln</button>'
      +(cos?'':'<button class="act" id="klXy">'+ico('<circle cx="12" cy="12" r="8"/><path d="M12 4v16M4 12h16"/>')+'XY-Pad</button>');
    box.appendChild(acts);
    const dec=v=>{ const sec=arpDecaySeconds(v/100); return sec<1 ? Math.round(sec*1000)+'ms' : sec.toFixed(1)+'s'; };
    const D=cos?{cut:62,res:22,env:62,dec:42}:{cut:50,res:35,env:50,dec:26};
    grp('Filter');
    box.appendChild(soundRow('Cutoff',0,100,num(tr.cutoff,D.cut/100)*100,D.cut,pct,v=>tr.cutoff=v/100));
    box.appendChild(soundRow('Reso',0,100,num(tr.resonance,D.res/100)*100,D.res,pct,v=>tr.resonance=v/100));
    box.appendChild(soundRow('Env Mod',0,100,num(tr.envMod,D.env/100)*100,D.env,pct,v=>tr.envMod=v/100));
    box.appendChild(soundRow('Decay',0,100,num(tr.decay,D.dec/100)*100,D.dec,dec,v=>tr.decay=v/100));
    if(!cos) box.appendChild(soundRow('Accent',0,100,num(tr.accentAmt,.5)*100,50,pct,v=>tr.accentAmt=v/100));
    if(cos){ grp('Klang');
      [['Width','cosmicWidth',62],['Motion','cosmicMotion',46],['Warmth','cosmicWarmth',22],['Air','cosmicAir',18]].forEach(([l,k,d])=>
        box.appendChild(soundRow(l,0,100,num(tr[k],d/100)*100,d,pct,v=>tr[k]=v/100))); }
    $id('klRand').onclick=()=>{ if(TRACKS[activeTrackIdx]!==tr) selectTrack(TRACKS.indexOf(tr)); arpFilterRandBtn.click(); renderKlang(); };
    const xy=$id('klXy'); if(xy) xy.onclick=()=>{ closeSheets(); if(prIsOpen()) prClose(); if(TRACKS[activeTrackIdx]!==tr) selectTrack(TRACKS.indexOf(tr)); openXY(); };
  } else if(tab==='fx'){
    mixFxBody(tr,box);
  } else {
    grp('Grundton · '+NOTE_NAMES[(tr.rootNote+9)%12]);
    const kk=document.createElement('div'); kk.className='kl-keys';
    for(let i=0;i<12;i++){ const v=(i+3)%12, name=NOTE_NAMES[(v+9)%12], b=document.createElement('button');
      b.textContent=name; if(name.indexOf('#')>=0) b.classList.add('bk'); if(v===tr.rootNote) b.classList.add('on');
      b.onclick=()=>{ if(v!==tr.rootNote){ tr.rootNote=v; if(hmOn(tr)){ hmRegen(tr); refreshTrackStepVisuals(tr); } renderEditorArea(tr); if(prIsOpen()) prRender(); keysOrPreview(tr); } renderKlang(); };
      kk.appendChild(b); }
    box.appendChild(kk);
    grp('Skala');
    const sc=document.createElement('div'); sc.className='hm-kg g3 kl-scales';
    Object.keys(SCALES).forEach(id=>{ const b=document.createElement('button'); b.textContent=SCALES[id].label||id; if((tr.scale||'minor')===id) b.className='on';
      b.onclick=()=>{ setAcidScale(id,tr); if(prIsOpen()){ if(prTr) prV(prTr).fit=true; prRender(); } renderKlang(); }; sc.appendChild(b); });
    box.appendChild(sc);
    const nt=document.createElement('div'); nt.className='kl-note'; nt.textContent='Gilt für Noteneditor, Klaviatur und Würfeln dieser Spur.'+(hmOn(tr)?' Die Spur folgt gerade der Harmonie.':''); box.appendChild(nt);
  }
}
function keysOrPreview(tr){ if(isPlaying) return; pitchPreview(tr,isPoly(tr)?12:0,.8); }
$id('klTabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b) return; klTab=b.dataset.t; renderKlang(); });
$id('klX').addEventListener('click',closeSheets);
{ const b=document.createElement('button'); b.className='shx'; b.id='klBack'; b.hidden=true; b.setAttribute('aria-label','Zurück'); b.innerHTML=FXI.l; b.onclick=klBackFn; $id('klT').before(b); }
$id('artRow').addEventListener('click', e=>{
  const b=e.target.closest('button[data-a]'); if(!b) return; const tr=TRACKS[activeTrackIdx]; if(!ART[tr.id]) return;
  stepArt[tr.id]=+b.dataset.a; artRender(tr);
  if(!isPlaying) Promise.resolve(initAudio()).then(()=>{ if(audioCtx.state!=='running') audioCtx.resume(); triggerTrack(tr, audioCtx.currentTime+0.01, VEL_NORMAL, stepArt[tr.id]); }); // anhören
});
document.querySelectorAll('#brushRow button').forEach(b=>b.addEventListener('click', ()=>{
  stepBrush=parseFloat(b.dataset.v);
  document.querySelectorAll('#brushRow button').forEach(x=>x.classList.toggle('on',x===b));
}));

function selectTrack(idx){
  
  activeTrackIdx=idx;
  { const g0=groupOfTrack(TRACKS[idx]); if(g0!==patternGroup) setPatternGroup(g0,false); }
  TRACKS.forEach((tr,i)=> tr._ovRow.classList.toggle('active', i===idx));
  renderTrackBar();
  renderBigGrid();
}
