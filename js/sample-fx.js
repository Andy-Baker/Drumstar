// ---- Effekte im Sample-Editor (v124, #16, Mockup docs/mockups/issue-16.html v2) ----
// Wie ein Audio-Editor (Wavelab): ein Effekt offen, 3 Presets + höchstens 2 Schieber, Vorhören, Anwenden = fest ins Sample
// (über seApplyTransform → Rückgängig und „Zurück zum Original“ gehen). Mehrere Effekte = nacheinander anwenden.
// Gerechnet wird offline (OfflineAudioContext) mit den Geräten aus FXDEF; Vorhören spielt genau das gerechnete Ergebnis.
// Beim Spielen keine Last, nichts Neues im Speicherformat. Hall/Delay hängen den Ausklang an, Hall „Rückwärts“ setzt ihn davor.
const SFX_IC={
  filter:'<path d="M3 8h9c3 0 4 2 5 5l3 6"/>',
  dist:'<path d="M3 12c2-6 4-6 5 0s3 6 5 0 3-6 5 0 2 4 3 4"/>',
  comp:'<path d="M4 4v16M4 20L12 12h8"/>',
  hall:'<path d="M4 20c0-9 7-16 16-16M8 20c0-6 6-12 12-12M12 20c0-4 4-8 8-8"/>',
  delay:'<circle cx="6" cy="12" r="3"/><circle cx="13" cy="12" r="2.2" opacity=".7"/><circle cx="19" cy="12" r="1.5" opacity=".45"/>'
};
const SFX={
  filter:{n:'Filter',pre:[['Dumpf',{ty:'lowpass',fr:.42,q:.25}],['Dünn',{ty:'highpass',fr:.45,q:.2}],['Telefon',{ty:'bandpass',fr:.6,q:.35}]],ps:[{k:'fr',l:'Frequenz',a:0,b:1,s:.005}]},
  dist:{n:'Verzerrung',pre:[['Wärme',{dr:.2,to:.6,mx:.6}],['Crunch',{dr:.55,to:.55,mx:.8}],['Fuzz',{dr:.95,to:.4,mx:1}]],ps:[{k:'dr',l:'Drive',a:0,b:1,s:.01}]},
  comp:{n:'Kompressor',pre:[['Sanft',{st:.3}],['Punch',{st:.55}],['Platt',{st:.9}]],ps:[{k:'st',l:'Stärke',a:0,b:1,s:.01}]},
  hall:{n:'Hall',rev:1,pre:[['Raum',{sz:.8,to:.6,mx:.3}],['Halle',{sz:2,to:.5,mx:.35}],['Weit',{sz:3.8,to:.45,mx:.4}]],ps:[{k:'sz',l:'Länge',a:.3,b:5,s:.1},{k:'mx',l:'Mischung',a:0,b:1,s:.01}]},
  delay:{n:'Delay',pre:[['Slapback',{tm:.09,fb:.15,to:.8,mx:.3}],['Echo',{tm:.3,fb:.4,to:.6,mx:.3}],['Dub',{tm:.45,fb:.6,to:.3,mx:.35}]],ps:[{k:'fb',l:'Feedback',a:0,b:.85,s:.01},{k:'mx',l:'Mischung',a:0,b:1,s:.01}]}
};
const SFX_ORDER=['filter','dist','comp','hall','delay'];
const sfxRow=$id('seFxRow'), sfxPan=$id('seFxPanel');
let sfxCur=null, sfxP=null, sfxSrc=null, sfxBusy=false, sfxGen=0;
const sfxSvg=p=>'<svg class="se-ico" viewBox="0 0 24 24" aria-hidden="true">'+p+'</svg>';
sfxRow.innerHTML=SFX_ORDER.map(t=>'<button class="se-tool-btn" data-fx="'+t+'">'+sfxSvg(SFX_IC[t])+'<span>'+SFX[t].n+'</span></button>').join('');
sfxRow.addEventListener('click', e=>{ const b=e.target.closest('[data-fx]'); if(!b) return; const t=b.dataset.fx; sfxStop();
  if(sfxCur===t) sfxCur=null; else { sfxCur=t; sfxP={pi:0,rev:false,p:Object.assign({},SFX[t].pre[0][1])}; } sfxDraw(); });
function seFxClose(){ sfxStop(); sfxCur=null; sfxDraw(); }
function sfxDraw(){
  sfxRow.querySelectorAll('[data-fx]').forEach(b=>b.classList.toggle('on', b.dataset.fx===sfxCur));
  sfxPan.classList.toggle('on', !!sfxCur); if(!sfxCur){ sfxPan.innerHTML=''; return; }
  const d=SFX[sfxCur], pl=!!sfxSrc;
  sfxPan.innerHTML='<div class="se-seg">'+d.pre.map((x,i)=>'<button data-pi="'+i+'" class="'+(sfxP.pi===i?'on':'')+'">'+x[0]+'</button>').join('')+'</div>'
    +(d.rev?'<div class="se-seg"><button data-rv="0" class="'+(sfxP.rev?'':'on')+'">Normal</button><button data-rv="1" class="'+(sfxP.rev?'on':'')+'">Rückwärts</button></div>':'')
    +d.ps.map(p=>'<label class="se-fx-k"><span>'+p.l+'</span><input type="range" data-k="'+p.k+'" min="'+p.a+'" max="'+p.b+'" step="'+p.s+'" value="'+sfxP.p[p.k]+'"></label>').join('')
    +'<div class="se-fx-f"><button class="x" data-fa="x" aria-label="Schließen">'+sfxSvg('<path d="M6 6l12 12M18 6L6 18"/>')+'</button>'
    +'<button data-fa="pre">'+(pl?sfxSvg('<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor"/>')+'Stopp':sfxSvg('<polygon points="6,4 20,12 6,20" fill="currentColor"/>')+'Vorhören')+'</button>'
    +'<button class="ok" data-fa="ok">'+sfxSvg('<path d="M4 12l5 5L20 6"/>')+'Anwenden</button></div>';
  sfxPan.querySelectorAll('[data-pi]').forEach(b=>b.onclick=()=>{ sfxP.pi=+b.dataset.pi; sfxP.p=Object.assign({},d.pre[sfxP.pi][1]); sfxChanged(); });
  sfxPan.querySelectorAll('[data-rv]').forEach(b=>b.onclick=()=>{ sfxP.rev=b.dataset.rv==='1'; sfxChanged(); });
  sfxPan.querySelectorAll('[data-k]').forEach(i=>{ i.oninput=()=>{ sfxP.p[i.dataset.k]=+i.value; sfxP.pi=-1; sfxPan.querySelectorAll('[data-pi]').forEach(b=>b.classList.remove('on')); }; i.onchange=sfxChanged; });
  sfxPan.querySelector('[data-fa=x]').onclick=seFxClose;
  sfxPan.querySelector('[data-fa=pre]').onclick=()=>{ if(sfxSrc){ sfxStop(); sfxDraw(); } else sfxPlay(); };
  sfxPan.querySelector('[data-fa=ok]').onclick=sfxApply;
}
function sfxChanged(){ const was=!!sfxSrc; sfxDraw(); if(was) sfxPlay(); }
// Hall-Impuls in der Abtastrate des Offline-Kontexts (createImpulseResponse hängt an audioCtx)
function sfxIr(c,sz){ const n=Math.max(1,Math.floor(c.sampleRate*sz)), b=c.createBuffer(2,n,c.sampleRate);
  for(let ch=0;ch<2;ch++){ const d=b.getChannelData(ch); for(let i=0;i<n;i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.8); } return b; }
function sfxNode(c,t,p,wetOnly){ const i=c.createGain(), o=c.createGain();
  if(t==='filter'){ const n=FXDEF.filter.build(c); n.u(Object.assign({},SFX.filter.pre[0][1],p)); i.connect(n.i); n.o.connect(o); }
  else if(t==='dist'){ const n=FXDEF.dist.build(c); n.u(Object.assign({},SFX.dist.pre[1][1],p)); i.connect(n.i); n.o.connect(o); }
  else if(t==='comp'){ const n=FXDEF.comp.build(c); n.u({th:-6-p.st*34,ra:1.5+p.st*10,at:10,re:150,kn:6,mk:0}); i.connect(n.i); n.o.connect(o); }
  else { let wet;
    if(t==='hall'){ const cv=c.createConvolver(), lp=c.createBiquadFilter(); cv.buffer=sfxIr(c,p.sz); lp.type='lowpass'; lp.frequency.value=fxEx(1500,16000,p.to); i.connect(cv); cv.connect(lp); wet=lp; }
    else { const dl=c.createDelay(2), fb=c.createGain(), lp=c.createBiquadFilter(); dl.delayTime.value=p.tm; fb.gain.value=p.fb; lp.type='lowpass'; lp.frequency.value=fxEx(600,13000,p.to);
      i.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); wet=lp; }
    const wg=c.createGain(); wg.gain.value=p.mx; wet.connect(wg); wg.connect(o);
    if(!wetOnly){ const dg=c.createGain(); dg.gain.value=1-p.mx*.5; i.connect(dg); dg.connect(o); } }
  return {i,o}; }
const sfxTail=(t,p)=>t==='hall' ? p.sz : t==='delay' ? Math.min(4, p.tm*Math.log(.001)/Math.log(Math.max(.05,p.fb))) : 0;
function sfxReverse(b){ const o=new AudioBuffer({length:b.length,numberOfChannels:b.numberOfChannels,sampleRate:b.sampleRate});
  for(let c=0;c<b.numberOfChannels;c++){ const s=b.getChannelData(c), d=o.getChannelData(c); for(let i=0;i<s.length;i++) d[i]=s[s.length-1-i]; } return o; }
function sfxRun(B,t,p,wetOnly,len){ const ch=(t==='hall'||t==='delay')?2:B.numberOfChannels, oc=new OfflineAudioContext(ch,len,B.sampleRate), s=oc.createBufferSource();
  s.buffer=B; const n=sfxNode(oc,t,p,wetOnly); s.connect(n.i); n.o.connect(oc.destination); s.start(0); return oc.startRendering(); }
async function sfxRender(B,t,P){
  const sr=B.sampleRate, M=Math.round(sfxTail(t,P.p)*sr), back=t==='hall'&&P.rev;
  let out;
  if(back){ // umdrehen → nur Hallanteil → umdrehen: Hall endet, wo das Sample beginnt; Original dahinter
    const z=sfxReverse(await sfxRun(sfxReverse(B),t,P.p,true,B.length+M));
    out=new AudioBuffer({length:B.length+M,numberOfChannels:2,sampleRate:sr});
    for(let c=0;c<2;c++){ const d=out.getChannelData(c), bc=B.getChannelData(Math.min(c,B.numberOfChannels-1)), g=1-P.p.mx*.3; d.set(z.getChannelData(c)); for(let i=0;i<B.length;i++) d[M+i]+=bc[i]*g; }
  } else out=await sfxRun(B,t,P.p,false,B.length+M);
  let pk=0; for(let c=0;c<out.numberOfChannels;c++){ const d=out.getChannelData(c); for(let i=0;i<d.length;i++){ const a=Math.abs(d[i]); if(a>pk) pk=a; } }
  if(pk>1){ const g=.98/pk; for(let c=0;c<out.numberOfChannels;c++){ const d=out.getChannelData(c); for(let i=0;i<d.length;i++) d[i]*=g; } } // nicht übersteuern
  if(M && !back){ // Stille im Ausklang abschneiden (unter −60 dB)
    let last=out.length-1; for(;last>B.length;last--){ let a=0; for(let c=0;c<out.numberOfChannels;c++) a=Math.max(a,Math.abs(out.getChannelData(c)[last])); if(a>.001) break; }
    if(last<out.length-1) out=bufferSlice(out,0,(last+1)/sr);
  }
  return out;
}
function sfxStop(){ sfxGen++; if(sfxSrc){ const s=sfxSrc; sfxSrc=null; try{ s.stop(); }catch(e){} } }
async function sfxPlay(){
  if(!seWorkingBuffer || !sfxCur) return; if(!audioCtx) initAudio();
  sfxStop(); seStopPreview(); const g=sfxGen, b=await sfxRender(seWorkingBuffer,sfxCur,sfxP);
  if(g!==sfxGen || !sfxCur) return; // inzwischen gestoppt/geändert
  const s=audioCtx.createBufferSource(); s.buffer=b; s.connect(master); s.start();
  s.onended=()=>{ if(sfxSrc===s){ sfxSrc=null; sfxDraw(); } }; sfxSrc=s; sfxDraw();
}
async function sfxApply(){
  if(!seWorkingBuffer || !sfxCur || sfxBusy) return; if(!audioCtx) initAudio();
  sfxStop(); seStopPreview(); sfxBusy=true;
  try{ const out=await sfxRender(seWorkingBuffer,sfxCur,sfxP); seApplyTransform(()=>out); } finally { sfxBusy=false; }
  sfxCur=null; sfxDraw();
}
sePreviewBtn.addEventListener('click', ()=>{ if(sfxSrc){ sfxStop(); sfxDraw(); } }, true); // normales Vorhören beendet das Effekt-Vorhören
