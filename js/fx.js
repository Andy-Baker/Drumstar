"use strict";
// =========================================================================
// EFFEKTE (v79, Mockup docs/mockups/effekte-mockup.html v7, Issues #16/#35/#36)
// Pro Spur: bus → EQ (fest, nur im Weg wenn nicht neutral) → bis 4 Inserts → post → Pan → Master bzw. Drums-Gruppe.
// Sends (Hall, Delay) zapfen an post ab, also nach EQ und Inserts. Master: master → Master-Effekte → comp.
// Alle Knoten des aktuellen Kontexts liegen in FXG; der WAV-Export baut denselben Aufbau im Offline-Kontext.
// =========================================================================
const FX_MAX=4;
const FX_NV=[['16','1/16','Sechzehntel',1],['8','1/8','Achtel',2],['8d','1/8·','punktiert',3],['4','1/4','Viertel',4],['4d','1/4·','punktiert',6],['8t','1/8T','Triole',4/3],['4t','1/4T','Triole',8/3],['2','1/2','Halbe',8]];
const fxEx=(a,b,t)=>a*Math.pow(b/a,t);
const fxDe=(v,d=1)=>v.toFixed(d).replace('.',',');
const fxHz=v=>v>=1000?fxDe(v/1000,1)+' kHz':Math.round(v)+' Hz';
const fxPct=v=>Math.round(v*100)+'%';
const fxDb=v=>(v>0?'+':'')+fxDe(v,1)+' dB';
const fxSet=(par,v,c)=>{ if(c && c.currentTime>0) par.setTargetAtTime(v,c.currentTime,.02); else par.value=v; };
const FXDEF={
 dist:{n:'Verzerrung',ab:'DIST',w:'Sättigung bis Fuzz',rank:0,
   ps:[{k:'dr',l:'Drive',a:0,b:1,s:.01,f:fxPct},{k:'mx',l:'Mix',a:0,b:1,s:.01,f:fxPct},{k:'to',l:'Ton',a:0,b:1,s:.01,f:v=>fxHz(fxEx(800,14000,v))}],
   pre:[['Wärme',{dr:.2,to:.6,mx:.6}],['Crunch',{dr:.55,to:.55,mx:.8}],['Fuzz',{dr:.95,to:.4,mx:1}]],
   sum:p=>'Drive '+fxPct(p.dr),
   build(c){ const i=c.createGain(),ws=c.createWaveShaper(),tn=c.createBiquadFilter(),wet=c.createGain(),dry=c.createGain(),o=c.createGain(); tn.type='lowpass'; ws.oversample='2x';
     i.connect(ws); ws.connect(tn); tn.connect(wet); wet.connect(o); i.connect(dry); dry.connect(o); let last=-1;
     return {i,o,u(p){ if(Math.abs(p.dr-last)>.004){ last=p.dr; const k=1+p.dr*60,n=1024,cv=new Float32Array(n); for(let j=0;j<n;j++){ const x=j/(n-1)*2-1; cv[j]=Math.tanh(k*x)/Math.tanh(k);} ws.curve=cv; }
       fxSet(tn.frequency,fxEx(800,14000,p.to),c); fxSet(wet.gain,p.mx*(1-p.dr*.45),c); fxSet(dry.gain,1-p.mx,c); }}; }},
 filter:{n:'Filter',ab:'FILT',w:'Tiefpass, Hochpass, Band',rank:1,
   ps:[{k:'ty',l:'Typ',sel:[['lowpass','Tiefpass'],['highpass','Hochpass'],['bandpass','Bandpass']]},{k:'fr',l:'Frequenz',a:0,b:1,s:.005,f:v=>fxHz(fxEx(40,16000,v))},{k:'q',l:'Resonanz',a:0,b:1,s:.01,f:fxPct}],
   pre:[['Offen',{ty:'lowpass',fr:1,q:.1}],['Dumpf',{ty:'lowpass',fr:.42,q:.25}],['Dünn',{ty:'highpass',fr:.45,q:.2}],['Telefon',{ty:'bandpass',fr:.6,q:.35}]],
   sum:p=>({lowpass:'TP',highpass:'HP',bandpass:'BP'})[p.ty]+' '+fxHz(fxEx(40,16000,p.fr)),
   build(c){ const f=c.createBiquadFilter(); return {i:f,o:f,u(p){ f.type=p.ty; fxSet(f.frequency,fxEx(40,16000,p.fr),c); fxSet(f.Q,.5+p.q*16,c); }}; }},
 comp:{n:'Kompressor',ab:'KOMP',w:'Dynamik bändigen',rank:2,
   ps:[{k:'th',l:'Schwelle',a:-40,b:0,s:1,f:v=>Math.round(v)+' dB'},{k:'ra',l:'Stärke',a:1,b:20,s:.5,f:v=>fxDe(v,1)+':1'},{k:'at',l:'Attack',a:1,b:80,s:1,f:v=>Math.round(v)+' ms'},{k:'re',l:'Release',a:30,b:600,s:10,f:v=>Math.round(v)+' ms'},{k:'mk',l:'Aufholen',a:0,b:18,s:.5,f:fxDb}],
   // v95 (#51): „Drumstar“ = bisher unsichtbarer Ausgangs-Kompressor (Web-Audio-Standardwerte, Knie 30). Web Audio hebt bei jedem Kompressor
   // automatisch an (0,6 × Absenkung bei 0 dB), „Aufholen“ kommt obendrauf. kn = Knie (ohne Regler).
   pre:[['Drumstar',{th:-24,ra:12,at:3,re:250,kn:30,mk:0}],['Sanft',{th:-18,ra:2.5,at:20,re:150,kn:6,mk:3}],['Punch',{th:-24,ra:4,at:30,re:150,kn:6,mk:6}],['Platt',{th:-34,ra:12,at:3,re:150,kn:6,mk:12}]],
   legacy:{th:-18,ra:2.5,at:20,re:150,kn:6,mk:3}, // fehlende Felder älterer Speicherstände = Klang vor v95
   sum:p=>Math.round(p.th)+' dB '+fxDe(p.ra,0)+':1',
   build(c){ const k=c.createDynamicsCompressor(),g=c.createGain(); k.connect(g);
     return {i:k,o:g,red:k,u(p){ fxSet(k.threshold,p.th,c); fxSet(k.ratio,p.ra,c); fxSet(k.attack,p.at/1000,c); fxSet(k.release,(p.re!=null?p.re:150)/1000,c); fxSet(k.knee,p.kn!=null?p.kn:6,c); fxSet(g.gain,Math.pow(10,p.mk/20),c); }}; }},
 limit:{n:'Limiter',ab:'LIM',w:'Spitzen abfangen',rank:3,master:1,
   ps:[{k:'ce',l:'Decke',a:-12,b:0,s:.5,f:fxDb},{k:'gn',l:'Lauter',a:0,b:12,s:.5,f:fxDb}],
   pre:[['Sicher',{ce:-1,gn:0}],['Laut',{ce:-1,gn:6}],['Sehr laut',{ce:-.5,gn:10}]],
   sum:p=>'Decke '+fxDe(p.ce,1),
   build(c){ const g=c.createGain(),k=c.createDynamicsCompressor(); k.knee.value=0; k.ratio.value=20; k.attack.value=.002; k.release.value=.08; g.connect(k);
     return {i:g,o:k,red:k,u(p){ fxSet(g.gain,Math.pow(10,p.gn/20),c); fxSet(k.threshold,p.ce,c); }}; }}
};
// Sends: Standard = bisheriger Klang (Hall 2,4 s offen, Delay 1/4 mono 34 %)
const FX_SEND={
 hall:{n:'Hall',ps:[{k:'sz',l:'Größe',a:.3,b:5,s:.1,f:v=>fxDe(v,1)+' s'},{k:'to',l:'Ton',a:0,b:1,s:.01,f:v=>v>=.995?'offen':fxHz(fxEx(1500,16000,v))},{k:'lv',l:'Pegel',a:0,b:1,s:.01,f:fxPct}],
   pre:[['Standard',{sz:2.4,to:1,lv:1}],['Raum',{sz:.8,to:.6,lv:.8}],['Halle',{sz:2.4,to:.5,lv:.8}],['Kathedrale',{sz:4.6,to:.4,lv:.75}],['Platte',{sz:1.6,to:.95,lv:.7}]],
   chip:p=>fxDe(p.sz,1)+' s'},
 delay:{n:'Delay',ps:[{k:'fb',l:'Feedback',a:0,b:.85,s:.01,f:fxPct},{k:'to',l:'Ton',a:0,b:1,s:.01,f:v=>v>=.995?'offen':fxHz(fxEx(600,13000,v))},{k:'lv',l:'Pegel',a:0,b:1,s:.01,f:fxPct}],
   pre:[['Standard',{div:'4',md:'mono',fb:.34,to:1,lv:.85}],['Dub 1/8·',{div:'8d',md:'mono',fb:.55,to:.3,lv:.85}],['Ping-Pong 1/8·',{div:'8d',md:'pp',fb:.45,to:.6,lv:.85}],['Ping-Pong 1/8',{div:'8',md:'pp',fb:.4,to:.65,lv:.8}],['Slapback',{div:'16',md:'mono',fb:.08,to:.8,lv:.7}],['Triole',{div:'8t',md:'pp',fb:.4,to:.55,lv:.8}]],
   chip:p=>FX_NV.find(n=>n[0]===p.div)[1]+(p.md==='pp'?' PP':'')}
};
const EQ_MF_DEF=Math.log(1000/200)/Math.log(40); // Mitten-Lage Standard 1 kHz (wie bisher)
const EQ_PRE=[['Neutral',{eqLc:0,eqLowGain:0,eqMidGain:0,eqMf:EQ_MF_DEF,eqHighGain:0}],['Wärmer',{eqLc:0,eqLowGain:3,eqMidGain:-1.5,eqMf:.55,eqHighGain:-3}],['Präsenz',{eqLc:.15,eqLowGain:-1,eqMidGain:3,eqMf:.7,eqHighGain:2}],['Rumpeln weg',{eqLc:.45,eqLowGain:0,eqMidGain:0,eqMf:EQ_MF_DEF,eqHighGain:0}],['Telefon',{eqLc:.75,eqLowGain:-8,eqMidGain:6,eqMf:.6,eqHighGain:-10}]];
const eqLcHz=v=>v<.005?10:20*Math.pow(20,v), eqMfHz=v=>200*Math.pow(40,v==null?EQ_MF_DEF:v);
const EQ_PS=[{k:'eqLc',l:'Tiefen-Filter',a:0,b:1,s:.005,f:v=>v<.005?'aus':fxHz(eqLcHz(v))},{k:'eqLowGain',l:'Tiefen',a:-12,b:12,s:.5,f:fxDb},{k:'eqMidGain',l:'Mitten',a:-12,b:12,s:.5,f:fxDb},{k:'eqMf',l:'Mitten-Lage',a:0,b:1,s:.005,f:v=>fxHz(eqMfHz(v))},{k:'eqHighGain',l:'Höhen',a:-12,b:12,s:.5,f:fxDb}];
const fxPreName=(pre,p)=>{ const x=pre.find(x=>Object.keys(x[1]).every(k=>Math.abs((typeof x[1][k]==='number'?x[1][k]:0)-(typeof p[k]==='number'?p[k]:0))<1e-6 && (typeof x[1][k]!=='string'||x[1][k]===p[k]))); return x?x[0]:'Eigene'; };
let fxHall=Object.assign({},FX_SEND.hall.pre[0][1]), fxDelay=Object.assign({},FX_SEND.delay.pre[0][1]), masterFx=[];
let fxUid=0; const fxNew=(t,pi)=>({id:++fxUid,t,on:true,p:Object.assign({},FXDEF[t].pre[pi||0][1])});
const fxClean=list=>(list||[]).filter(f=>f&&FXDEF[f.t]).slice(0,FX_MAX).map(f=>({id:++fxUid,t:f.t,on:f.on!==false,p:Object.assign({},FXDEF[f.t].legacy||FXDEF[f.t].pre[0][1],f.p||{})}));
// Master ab Werk (v95, #51): sichtbarer Bus-Kompressor „Drumstar“ = bisheriger Klang
const mfxDefault=()=>[fxNew('comp',0)];
masterFx=mfxDefault();
const fxSave=list=>(list||[]).map(f=>({t:f.t,on:f.on,p:Object.assign({},f.p)}));
// Gruppen (Busse): Spuren → Gruppe (Effekte → Laut) → Master. ids = ARR_GROUPS
const GRP_DEF={drums:{n:'Drums',ab:'DRUMS',ids:['bd','sd','ch','oh','lt','ht','cy','rd'],color:'#2a5a86'},
               perc:{n:'Perc',ab:'PERC',ids:['rs','hc','cb','cl','mr'],color:'#1f6f68'}};
const GRP_KEYS=Object.keys(GRP_DEF);
const grpNew=k=>({grp:true,k,vol:1,muted:false,fx:[],eqOn:true,eqLc:0,eqLowGain:0,eqMidGain:0,eqMf:EQ_MF_DEF,eqHighGain:0});
const EQ_KEYS=['eqOn','eqLc','eqLowGain','eqMidGain','eqMf','eqHighGain'];
let grps={}; GRP_KEYS.forEach(k=>grps[k]=grpNew(k));
const trGrp=tr=>GRP_KEYS.find(k=>GRP_DEF[k].ids.includes(tr.id));
const grpIn=tr=>{ const k=trGrp(tr); return k&&FXG.g&&FXG.g[k]?FXG.g[k].i:master; };
// Sends einer Gruppenspur laufen über das Send-Tor der Gruppe: Gruppe stumm = auch Hall/Delay der Spuren still (wie Pro Tools Basic Folder / Cubase „Mute Sources“, #43)
const grpSend=(tr,w)=>{ const k=trGrp(tr), o=k&&FXG.g&&FXG.g[k]; return o?o[w]:(w==='sr'?reverbInputNode:delayInputNode); };
let FXG={};
const fxDelaySec=()=>FX_NV.find(n=>n[0]===fxDelay.div)[3]*60/bpm/4;
const fxDelayTone=()=>fxDelay.to>=.995?20000:fxEx(600,13000,fxDelay.to);
const fxHallTone=()=>fxHall.to>=.995?20000:fxEx(1500,16000,fxHall.to);
function buildFxBuses(){ const c=audioCtx;
  FXG={};
  FXG.mfxIn=c.createGain(); master.connect(FXG.mfxIn); FXG.mfxN=[]; fxMasterRebuild();
  // Hall-Bus
  FXG.revIn=c.createGain(); FXG.revConv=c.createConvolver(); FXG.revConv.buffer=createImpulseResponse(fxHall.sz,2.8); FXG.revSz=fxHall.sz;
  FXG.revLp=c.createBiquadFilter(); FXG.revLp.type='lowpass'; FXG.revLp.frequency.value=fxHallTone(); FXG.revOut=c.createGain(); FXG.revOut.gain.value=fxHall.lv;
  FXG.revIn.connect(FXG.revConv); FXG.revConv.connect(FXG.revLp); FXG.revLp.connect(FXG.revOut); FXG.revOut.connect(master);
  FXG.revAn=c.createAnalyser(); FXG.revAn.fftSize=2048; FXG.revOut.connect(FXG.revAn);
  reverbInputNode=FXG.revIn; reverbConvolver=FXG.revConv;
  // Delay-Bus
  FXG.dlIn=c.createGain(); FXG.dlOut=c.createGain(); FXG.dlOut.gain.value=fxDelay.lv; FXG.dlOut.connect(master);
  FXG.dlAn=c.createAnalyser(); FXG.dlAn.fftSize=2048; FXG.dlOut.connect(FXG.dlAn);
  fxDelayBuild(); delayInputNode=FXG.dlIn; delayOutputGain=FXG.dlOut;
  padDelaySendGain=c.createGain(); padDelaySendGain.gain.value=padDelayAmount; padDelaySendGain.connect(FXG.dlIn);
  // Gruppen: Eingang → Effekte → Laut (+Meter) → Master
  FXG.g={}; GRP_KEYS.forEach(k=>{ const G=grps[k], o=FXG.g[k]={i:c.createGain(),v:c.createGain(),an:c.createAnalyser(),n:[]};
    eqNodes(o,c); o.v.gain.value=G.muted?0:G.vol; o.an.fftSize=2048; o.an.smoothingTimeConstant=.82; o.v.connect(master); o.v.connect(o.an); eqSetNodes(o,G,c); grpFxRebuild(k);
    o.sr=c.createGain(); o.sd=c.createGain(); o.sr.gain.value=o.sd.gain.value=G.muted?0:1; o.sr.connect(FXG.revIn); o.sd.connect(FXG.dlIn); });
}
// Gruppe: i → EQ (nur wenn nicht neutral) → Inserts → v (Laut) → Master
function grpFxRebuild(k){ const o=FXG.g&&FXG.g[k], G=grps[k]; if(!o) return; const c=audioCtx; try{o.i.disconnect();}catch(e){} try{o.eqHigh.disconnect();}catch(e){} o.n.forEach(n=>{ try{n.o.disconnect();}catch(e){} });
  o.n=G.fx.filter(f=>f.on&&!f._byp).map(f=>{ const n=FXDEF[f.t].build(c); n.u(f.p); n.id=f.id; return n; });
  let last=o.i; G._eqIn=G.eqOn!==false && !G._eqByp && !eqNeutral(G); if(G._eqIn){ last.connect(o.eqHp); last=o.eqHigh; }
  o.n.forEach(n=>{ last.connect(n.i); last=n.o; }); last.connect(o.v); }
function eqNodes(n,c){ n.eqHp=c.createBiquadFilter(); n.eqHp.type='highpass'; n.eqHp.Q.value=.707;
  n.eqLow=c.createBiquadFilter(); n.eqLow.type='lowshelf'; n.eqLow.frequency.value=250;
  n.eqMid=c.createBiquadFilter(); n.eqMid.type='peaking'; n.eqMid.Q.value=1;
  n.eqHigh=c.createBiquadFilter(); n.eqHigh.type='highshelf'; n.eqHigh.frequency.value=4000;
  n.eqHp.connect(n.eqLow); n.eqLow.connect(n.eqMid); n.eqMid.connect(n.eqHigh); }
function fxDelayBuild(){ const c=audioCtx, p=fxDelay; (FXG.dlNodes||[]).forEach(n=>{ try{n.disconnect();}catch(e){} }); try{FXG.dlIn.disconnect();}catch(e){}
  FXG.dlNodes=[]; const mk=n=>(FXG.dlNodes.push(n),n), t=fxDelaySec();
  const tone=()=>{ const f=mk(c.createBiquadFilter()); f.type='lowpass'; f.Q.value=.5; f.frequency.value=fxDelayTone(); return f; };
  if(p.md==='pp'){ // Ping-Pong: links → rechts → links, jede Seite = ein Echo
    const L=mk(c.createDelay(4)),R=mk(c.createDelay(4)),fL=tone(),fR=tone(),gL=mk(c.createGain()),gR=mk(c.createGain()),m=mk(c.createChannelMerger(2));
    L.delayTime.value=t; R.delayTime.value=t; gL.gain.value=p.fb; gR.gain.value=p.fb;
    FXG.dlIn.connect(L); L.connect(fL); fL.connect(m,0,0); fL.connect(gL); gL.connect(R); R.connect(fR); fR.connect(m,0,1); fR.connect(gR); gR.connect(L); m.connect(FXG.dlOut);
    FXG.dl=[L,R]; FXG.fb=[gL,gR]; FXG.dlF=[fL,fR]; // Echo 1 links, Echo 2 rechts (×fb), Echo 3 links (×fb²) …
  } else { const d=mk(c.createDelay(4)), f=tone(), g=mk(c.createGain()); d.delayTime.value=t; g.gain.value=p.fb;
    FXG.dlIn.connect(d); d.connect(f); f.connect(g); g.connect(d); f.connect(FXG.dlOut); FXG.dl=[d]; FXG.fb=[g]; FXG.dlF=[f]; }
  FXG.dlMd=p.md; delayNode=FXG.dl[0]; delayFeedbackGain=FXG.fb[0]; }
function fxDelayUpdate(){ if(!FXG.dlIn) return; if(FXG.dlMd!==fxDelay.md) return fxDelayBuild(); const c=audioCtx, t=c.currentTime;
  FXG.dl.forEach(d=>d.delayTime.setTargetAtTime(fxDelaySec(),t,.03)); FXG.fb.forEach(g=>g.gain.setTargetAtTime(fxDelay.fb,t,.02));
  FXG.dlF.forEach(f=>f.frequency.setTargetAtTime(fxDelayTone(),t,.02)); FXG.dlOut.gain.setTargetAtTime(fxDelay.lv,t,.01); }
let fxHallT=null;
function fxHallUpdate(){ if(!FXG.revIn) return; const c=audioCtx, t=c.currentTime;
  FXG.revLp.frequency.setTargetAtTime(fxHallTone(),t,.02); FXG.revOut.gain.setTargetAtTime(fxHall.lv,t,.02);
  if(Math.abs(fxHall.sz-FXG.revSz)>.05){ clearTimeout(fxHallT); fxHallT=setTimeout(()=>{ if(!FXG.revConv) return; FXG.revSz=fxHall.sz; FXG.revConv.buffer=createImpulseResponse(fxHall.sz,2.8); },160); } }
function grpUpdate(k){ (k?[k]:GRP_KEYS).forEach(k=>{ const o=FXG.g&&FXG.g[k], G=grps[k]; if(!o) return; const t=audioCtx.currentTime; o.v.gain.setTargetAtTime(G.muted?0:G.vol,t,.015); o.sr.gain.setTargetAtTime(G.muted?0:1,t,.015); o.sd.gain.setTargetAtTime(G.muted?0:1,t,.015); }); }
function fxMasterRebuild(){ if(!FXG.mfxIn) return; const c=audioCtx; try{FXG.mfxIn.disconnect();}catch(e){} FXG.mfxN.forEach(n=>{ try{n.o.disconnect();}catch(e){} });
  FXG.mfxN=masterFx.filter(f=>f.on&&!f._byp).map(f=>{ const n=FXDEF[f.t].build(c); n.u(f.p); n.id=f.id; return n; });
  let last=FXG.mfxIn; FXG.mfxN.forEach(n=>{ last.connect(n.i); last=n.o; }); last.connect(comp); }
// Jede Spur: eigener Bus mit fester EQ-Stufe und Effektkette, danach Pan und Sends.
function ensureTrackBuses(){
  TRACKS.forEach(tr=>{
    if(tr.bus) return; const c=audioCtx;
    tr.bus=c.createGain();
    eqNodes(tr,c);
    tr.post=c.createGain();
    tr.panner=c.createStereoPanner(); tr.panner.pan.value=tr.pan||0;
    tr.post.connect(tr.panner); tr.panner.connect(grpIn(tr));
    tr.analyser=c.createAnalyser(); tr.analyser.fftSize=2048; tr.analyser.smoothingTimeConstant=.82; tr.panner.connect(tr.analyser);
    tr.sendGain=c.createGain(); tr.reverbAmount=tr.reverbAmount||0; tr.sendGain.gain.value=tr.reverbAmount; tr.post.connect(tr.sendGain); tr.sendGain.connect(grpSend(tr,'sr'));
    tr.delaySendGain=c.createGain(); tr.delaySend=tr.delaySend||0; tr.delaySendGain.gain.value=tr.delaySend; tr.post.connect(tr.delaySendGain); tr.delaySendGain.connect(grpSend(tr,'sd'));
    tr._fxN=[]; eqApply(tr,true);
  });
}
const eqNeutral=tr=>!(tr.eqLc>.005) && !tr.eqLowGain && !tr.eqMidGain && !tr.eqHighGain;
function eqSetNodes(n,tr,c){ fxSet(n.eqHp.frequency,eqLcHz(tr.eqLc||0),c); fxSet(n.eqLow.gain,tr.eqLowGain||0,c); fxSet(n.eqMid.gain,tr.eqMidGain||0,c); fxSet(n.eqMid.frequency,eqMfHz(tr.eqMf),c); fxSet(n.eqHigh.gain,tr.eqHighGain||0,c); }
function eqApply(tr,force){ if(tr.grp){ const o=FXG.g&&FXG.g[tr.k]; if(!o) return; eqSetNodes(o,tr,audioCtx); const want=tr.eqOn!==false && !tr._eqByp && !eqNeutral(tr); if(force||want!==tr._eqIn) grpFxRebuild(tr.k); return; }
  if(!tr.eqLow) return; eqSetNodes(tr,tr,audioCtx); const want=tr.eqOn!==false && !tr._eqByp && !eqNeutral(tr); if(force||want!==tr._eqIn) trFxRebuild(tr); }
function trFxRebuild(tr){ if(!tr.bus) return; const c=audioCtx; try{tr.bus.disconnect();}catch(e){} try{tr.eqHigh.disconnect();}catch(e){} (tr._fxN||[]).forEach(n=>{ try{n.o.disconnect();}catch(e){} });
  tr._fxN=(tr.fx||[]).filter(f=>f.on&&!f._byp).map(f=>{ const n=FXDEF[f.t].build(c); n.u(f.p); n.id=f.id; return n; });
  let last=tr.bus; tr._eqIn=tr.eqOn!==false && !tr._eqByp && !eqNeutral(tr); if(tr._eqIn){ last.connect(tr.eqHp); last=tr.eqHigh; }
  tr._fxN.forEach(n=>{ last.connect(n.i); last=n.o; }); last.connect(tr.post); }
function fxUpd(owner,f){ const n=(owner===null?FXG.mfxN:owner.grp?(FXG.g&&FXG.g[owner.k]?FXG.g[owner.k].n:[]):owner._fxN||[]).find(n=>n.id===f.id); if(n) n.u(f.p); }
// Laden: fehlende Felder (ältere Patterns) = neutral bzw. bisheriger Klang
function fxLoadTrack(tr,sv){ tr.eqOn=sv.eqOn!==false; tr.eqLc=sv.eqLc||0; tr.eqMf=sv.eqMf!=null?sv.eqMf:EQ_MF_DEF; tr.fx=fxClean(sv.fx); delete tr._eqByp;
  if(tr.bus) eqApply(tr,true); if(typeof mixerRebuild==='function') mixerRebuild(); }
function fxLoadGlobal(d){ fxHall=Object.assign({},FX_SEND.hall.pre[0][1],d.fxHall||{}); fxDelay=Object.assign({},FX_SEND.delay.pre[0][1],d.fxDelay||{});
  if(!FX_NV.some(n=>n[0]===fxDelay.div)) fxDelay.div='4'; masterFx=fxClean(d.masterFx);
  if(!(d.mfxV>=2)) masterFx=[fxNew('comp',0)].concat(masterFx).slice(0,FX_MAX); // vor v95 lief der Kompressor unsichtbar am Ausgang -> gleich klingen lassen
  const sg=d.grps||(d.grpDrums?{drums:d.grpDrums}:{}); // vor v80 gab es nur die Drums-Gruppe (ohne Effekte)
  GRP_KEYS.forEach(k=>{ const v=sg[k]||{}; const G=grps[k]=Object.assign(grpNew(k),{vol:v.vol!=null?v.vol:1,muted:!!v.muted,fx:fxClean(v.fx)}); EQ_KEYS.forEach(q=>{ if(v[q]!=null) G[q]=v[q]; }); });
  if(audioCtx&&FXG.dlIn){ fxMasterRebuild(); fxHallUpdate(); fxDelayUpdate(); GRP_KEYS.forEach(grpFxRebuild); grpUpdate(); } if(typeof mixerRebuild==='function') mixerRebuild(); }
function fxAllRebuild(){ if(!audioCtx) return; TRACKS.forEach(tr=>eqApply(tr,true)); fxMasterRebuild(); fxHallUpdate(); fxDelayUpdate(); GRP_KEYS.forEach(grpFxRebuild); grpUpdate(); }
// Alle Synth-Funktionen verbinden sich hierüber statt direkt mit "master",

// damit ihr Signal über den aktuell getriggerten Track-Bus läuft.
function getBus(){ return currentTrackBus || master; }

// Der Prozessor läuft im eigenen Audio-Thread. Er wird als Blob-Modul
// geladen, damit alles in EINER HTML-Datei bleibt (kein separates File nötig).
const FM_WORKLET_SRC = `
class FMVoiceProcessor extends AudioWorkletProcessor {
  // Hüllkurven exp(-t/decay) werden pro Sample multiplikativ fortgeschrieben (env *= k) statt Math.exp je Sample;
  // Phasen bleiben in [0, 2π). Klang identisch, deutlich weniger Rechenlast im Audio-Thread.
  // Ende (v68): sobald die Ausgangs-Hüllkurve (amp * Träger-env) unter -45 dB fällt, 20 ms weich ausblenden.
  // Vorher fest nach ampDecay+60 ms bei -10…-30 dB abgeschnitten. Sicherheitsgrenze 8 s. -60 dB kostete +26 % Last, -45 dB +19 %.
  constructor(options){
    super();
    const o = options.processorOptions;
    this.startFrame = Math.round(o.startTime * sampleRate);
    this.baseFreq = o.baseFreq;
    this.pitchEndMult = (o.pitchEndMult != null) ? o.pitchEndMult : 1;
    this.pitchDecay = o.pitchDecay || 0;
    const ops = o.ops, n = ops.length, dt = 1 / sampleRate;
    this.n = n;
    this.ratio = new Float64Array(n); this.level = new Float64Array(n); this.fbAmt = new Float64Array(n);
    this.env = new Float64Array(n); this.envK = new Float64Array(n);
    this.phase = new Float64Array(n); this.fbMem = new Float64Array(n);
    for(let i=0;i<n;i++){ const op=ops[i]; this.ratio[i]=op.ratio; this.level[i]=op.level||0; this.fbAmt[i]=op.feedback||0; this.env[i]=1; this.envK[i]=Math.exp(-dt/op.decay); }
    this.amp = 1; this.ampK = Math.exp(-dt / o.ampDecay);
    this.pEnv = 1; this.pK = this.pitchDecay > 0 ? Math.exp(-dt / this.pitchDecay) : 1;
    this.vol = o.vol;
    this.len = Math.floor(8 * sampleRate);
    this.fade = Math.max(1, Math.round(0.02 * sampleRate));
    this.fadeLeft = -1;
    this.pos = 0;
    this.done = false;
  }
  process(inputs, outputs){
    const out = outputs[0], ch0 = out[0], N = ch0.length;
    const TWO_PI = 6.283185307179586, w = TWO_PI / sampleRate;
    const n = this.n, ratio = this.ratio, level = this.level, fbAmt = this.fbAmt, env = this.env, envK = this.envK, phase = this.phase, fbMem = this.fbMem;
    const pe = this.pitchEndMult, usePitch = this.pitchDecay > 0, len = this.len, fade = this.fade;
    for(let i=0;i<N;i++){
      if(currentFrame + i < this.startFrame || this.done){ ch0[i]=0; continue; }
      const k = this.pos;
      if(this.fadeLeft === 0){ ch0[i]=0; this.done = true; continue; }
      const f0 = this.baseFreq * (usePitch ? pe + (1 - pe) * this.pEnv : 1);
      let mod = 0;
      for(let idx = n - 1; idx >= 1; idx--){
        const fb = fbAmt[idx] ? fbMem[idx] * fbAmt[idx] : 0;
        const sv = Math.sin(phase[idx] + mod + fb);
        fbMem[idx] = sv;
        let ph = phase[idx] + w * f0 * ratio[idx]; if(ph >= TWO_PI) ph -= TWO_PI; phase[idx] = ph;
        mod = sv * level[idx] * env[idx];
        env[idx] *= envK[idx];
      }
      const fbC = fbAmt[0] ? fbMem[0] * fbAmt[0] : 0;
      const sC = Math.sin(phase[0] + mod + fbC);
      fbMem[0] = sC;
      let ph0 = phase[0] + w * f0 * ratio[0]; if(ph0 >= TWO_PI) ph0 -= TWO_PI; phase[0] = ph0;
      let y = sC * env[0] * this.amp * this.vol;
      if(this.fadeLeft < 0 && (this.amp * env[0] < 0.0056 || k >= len)) this.fadeLeft = fade;
      if(this.fadeLeft > 0){ y *= this.fadeLeft / fade; this.fadeLeft--; }
      ch0[i] = y;
      env[0] *= envK[0]; this.amp *= this.ampK; if(usePitch) this.pEnv *= this.pK;
      this.pos = k + 1;
    }
    for(let c=1;c<out.length;c++) out[c].set(ch0);
    return !this.done;
  }
}
registerProcessor('fm-voice', FMVoiceProcessor);
`;

// Zweiter Worklet-Prozessor: reines Sample-Capturing. Reicht jeden
// Input-Block roh (Float32) an den Main-Thread weiter — Verarbeitung
// (Zusammensetzen zu einem AudioBuffer) passiert dort, da der Worklet-
// Scope selbst keinen persistenten Speicher über die Aufnahme hinweg halten muss.
const MIC_RECORDER_SRC = `
class MicRecorderProcessor extends AudioWorkletProcessor {
  process(inputs){
    const ch = inputs[0] && inputs[0][0];
    if(ch && ch.length) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor('mic-recorder', MicRecorderProcessor);
`;
let micWorkletReady=null, useMicWorklet=false;

function initAudio(){
  if(workletReady) return workletReady;
  audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  const outStage=makeOutStage(audioCtx); comp=outStage.inp;
  master = audioCtx.createGain(); master.gain.value=0.85;
  masterAnalyser=audioCtx.createAnalyser(); masterAnalyser.fftSize=2048;
  outStage.tap.connect(masterAnalyser); // Master-Meter nach den Master-Effekten, vor der Notbremse
  noiseBuf = makeNoise(2);

  // ---- Effekt-Busse (Hall, Delay, Drums-Gruppe, Master-Effekte): buildFxBuses()
  buildFxBuses();

  ensureTrackBuses();

  // AudioWorklet braucht einen sicheren Kontext (https/localhost) und
  // Browser-Unterstützung. Wenn nicht verfügbar, fällt die App automatisch
  // auf eine Node-basierte FM-Näherung zurück, statt stumm zu bleiben.
  if(audioCtx.audioWorklet){
    const blob = new Blob([FM_WORKLET_SRC], {type:'application/javascript'});
    const url = URL.createObjectURL(blob);
    workletReady = audioCtx.audioWorklet.addModule(url)
      .then(()=>{ useWorklet=true; })
      .catch((err)=>{ console.warn('AudioWorklet nicht verfügbar, nutze Fallback:', err); useWorklet=false; });

    const micBlob = new Blob([MIC_RECORDER_SRC], {type:'application/javascript'});
    const micUrl = URL.createObjectURL(micBlob);
    micWorkletReady = audioCtx.audioWorklet.addModule(micUrl)
      .then(()=>{ useMicWorklet=true; })
      .catch((err)=>{ console.warn('Mic-Recorder-Worklet nicht verfügbar, nutze MediaRecorder-Fallback:', err); useMicWorklet=false; });
  } else {
    useWorklet=false; useMicWorklet=false;
    workletReady = Promise.resolve();
    micWorkletReady = Promise.resolve();
  }
  return Promise.all([workletReady, micWorkletReady]);
}
function makeNoise(dur){
  const n=audioCtx.sampleRate*dur;
  const buf=audioCtx.createBuffer(1,n,audioCtx.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
  return buf;
}
function freqFromTune(base,tune){ const semis=(tune-0.5)*24; return base*Math.pow(2,semis/12); }

// Startet eine FM-Stimme im Audio-Thread; optional durch einen nativen
// Filter geformt, bevor sie auf den Master trifft.
function fmTrigger(time, cfg){
  if(!audioCtx) return;
  if(useWorklet){
    const node = new AudioWorkletNode(audioCtx, 'fm-voice', {
      numberOfInputs:0, numberOfOutputs:1, outputChannelCount:[1],
      processorOptions: Object.assign({startTime:time}, cfg)
    });
    let tail = node;
    if(cfg.filter){
      const f = audioCtx.createBiquadFilter();
      f.type = cfg.filter.type; f.frequency.value = cfg.filter.freq; if(cfg.filter.q) f.Q.value = cfg.filter.q;
      node.connect(f); tail = f;
    }
    tail.connect(getBus());
    // Aufräumen nur live; offline (Export) beendet sich der Prozessor selbst, ein Echtzeit-Timer wäre dort falsch
    if(!(typeof OfflineAudioContext!=='undefined' && audioCtx instanceof OfflineAudioContext)){
      const d0 = cfg.ops && cfg.ops[0] && cfg.ops[0].decay ? cfg.ops[0].decay : 1e9;
      const voiceSec = Math.min(8, 5.18 / (1/cfg.ampDecay + 1/d0)) + 0.03; // gleiche Regel wie im Prozessor (-45 dB + Ausblenden)
      const lifeMs = Math.max(50, (voiceSec+0.15)*1000 + (time-audioCtx.currentTime)*1000);
      setTimeout(()=>{ try{ node.disconnect(); if(tail!==node) tail.disconnect(); }catch(e){} }, lifeMs);
    }
  } else {
    nativeFmTrigger(time, cfg);
  }
}

// Fallback ohne AudioWorklet: gleiche Operator-Struktur (Ratio/Level/Decay je
// Operator), aber als Kette aus OscillatorNode + GainNode nachgebaut. Jeder
// Modulator moduliert per Audio-Rate-Verbindung die Frequenz des jeweils
// nächst-inneren Operators. Feedback-Loops sind ohne Worklet nicht sample-
// genau möglich und werden hier weggelassen — klanglich sehr nah dran,
// aber ohne das chaotische Feedback-Rauschen der Worklet-Variante.
function nativeFmTrigger(time, cfg){
  const ops = cfg.ops;
  const nodes = ops.map(()=>{ const o=audioCtx.createOscillator(); o.type='sine'; return o; });

  nodes.forEach((o,idx)=>{
    const f0 = cfg.baseFreq*ops[idx].ratio;
    o.frequency.setValueAtTime(f0, time);
  });
  if(cfg.pitchDecay){
    nodes.forEach((o,idx)=>{
      const fEnd = Math.max(1, cfg.baseFreq*cfg.pitchEndMult*ops[idx].ratio);
      o.frequency.exponentialRampToValueAtTime(fEnd, time+cfg.pitchDecay);
    });
  }

  for(let idx=ops.length-1; idx>=1; idx--){
    const op=ops[idx];
    const modGain=audioCtx.createGain();
    const depthHz = op.level * cfg.baseFreq * op.ratio * 0.6;
    modGain.gain.setValueAtTime(depthHz, time);
    modGain.gain.exponentialRampToValueAtTime(0.001, time+op.decay);
    nodes[idx].connect(modGain).connect(nodes[idx-1].frequency);
  }

  const amp=audioCtx.createGain();
  amp.gain.setValueAtTime(cfg.vol, time);
  amp.gain.exponentialRampToValueAtTime(0.001, time+cfg.ampDecay);
  nodes[0].connect(amp);

  let tail=amp;
  if(cfg.filter){
    const f=audioCtx.createBiquadFilter();
    f.type=cfg.filter.type; f.frequency.value=cfg.filter.freq; if(cfg.filter.q) f.Q.value=cfg.filter.q;
    amp.connect(f); tail=f;
  }
  tail.connect(getBus());
  const stopAt=time+cfg.ampDecay+0.08;
  nodes.forEach(o=>{ o.start(time); o.stop(stopAt); });
}

function playKick(time,vol,tune,velocity,kp){
  const g=velocity*(kp.trim!=null?kp.trim:1); // trim: optionaler Kit-Level-Headroom-Faktor gegen Clipping
  const base=freqFromTune(kp.baseFreq,tune);
  fmTrigger(time, {
    baseFreq: base*kp.startMult, pitchEndMult: kp.pitchEndMult, pitchDecay: kp.pitchDecay,
    ops: kp.ops, ampDecay: kp.ampDecay, vol: vol*g
  });
  if(kp.clickLevel>0){
    const click=audioCtx.createOscillator(); click.type='square'; click.frequency.value=900;
    const cg=audioCtx.createGain();
    cg.gain.setValueAtTime(kp.clickLevel*vol*g,time); cg.gain.exponentialRampToValueAtTime(0.001,time+0.018);
    click.connect(cg).connect(getBus()); click.start(time); click.stop(time+0.02);
  }
  // Optionaler Impact-Noise-Burst (Beater-auf-Fell-Transient) — echte Kicks zeigen laut
  // Spektralanalysen einen kurzen Rauschanteil ganz am Anfang, zusätzlich zum tonalen Klick.
  if(kp.impactNoiseLevel){
    const noise=audioCtx.createBufferSource(); noise.buffer=noiseBuf;
    const hp=audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=kp.impactNoiseFreq||2000;
    const ng=audioCtx.createGain();
    ng.gain.setValueAtTime(kp.impactNoiseLevel*vol*g,time); ng.gain.exponentialRampToValueAtTime(0.001,time+0.02);
    noise.connect(hp).connect(ng).connect(getBus()); noise.start(time); noise.stop(time+0.025);
  }
}

function playSnare(time,vol,tune,velocity,kp){
  const g=velocity;
  fmTrigger(time, {
    baseFreq: freqFromTune(kp.baseFreq,tune),
    ops: kp.ops, ampDecay: kp.ampDecay, vol: kp.fmLevel*vol*g
  });
  // Rauschband 1: Fell/Body — schmaler gefiltert, an die Tonhöhe gekoppelt
  const noise=audioCtx.createBufferSource(); noise.buffer=noiseBuf;
  const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=kp.noiseFreqBase+tune*kp.noiseFreqTune; bp.Q.value=kp.noiseQ;
  const ng=audioCtx.createGain();
  ng.gain.setValueAtTime(kp.noiseLevel*vol*g,time); ng.gain.exponentialRampToValueAtTime(0.01,time+kp.noiseDecay);
  noise.connect(bp).connect(ng).connect(getBus()); noise.start(time); noise.stop(time+kp.noiseDecay+0.02);

  // Rauschband 2 (optional): Snare-Teppich/"Sizzle" — breiter, höher, meist etwas länger als
  // das Fell-Band. Echte Snares trennen diese beiden Klanganteile; ein einzelnes Rauschband
  // (wie oben) approximiert das, klingt aber flacher/eindimensionaler.
  if(kp.wireNoiseLevel){
    const noise2=audioCtx.createBufferSource(); noise2.buffer=noiseBuf;
    const bp2=audioCtx.createBiquadFilter(); bp2.type='bandpass'; bp2.frequency.value=kp.wireFreq||3200; bp2.Q.value=kp.wireQ!=null?kp.wireQ:0.5;
    const ng2=audioCtx.createGain();
    const wireDecay=kp.wireDecay||kp.noiseDecay*1.6;
    ng2.gain.setValueAtTime(kp.wireNoiseLevel*vol*g,time); ng2.gain.exponentialRampToValueAtTime(0.008,time+wireDecay);
    noise2.connect(bp2).connect(ng2).connect(getBus()); noise2.start(time); noise2.stop(time+wireDecay+0.02);
  }
}

function playTom(time,vol,tune,velocity,kp){
  const g=velocity*(kp.trim!=null?kp.trim:1);
  const base=freqFromTune(kp.baseFreq,tune);
  fmTrigger(time, {
    baseFreq: base*kp.startMult, pitchEndMult: kp.pitchEndMult, pitchDecay: kp.pitchDecay,
    ops: kp.ops, ampDecay: kp.ampDecay, vol: vol*g
  });
}

function playRim(time,vol,tune,velocity,kp){
  const g=velocity;
  fmTrigger(time, {
    baseFreq: freqFromTune(kp.baseFreq,tune),
    ops: kp.ops, ampDecay: kp.ampDecay, vol: kp.fmLevel*vol*g
  });
  if(kp.clickLevel>0){
    const noise=audioCtx.createBufferSource(); noise.buffer=noiseBuf;
    const hp=audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=kp.clickFreq;
    const ng=audioCtx.createGain();
    ng.gain.setValueAtTime(kp.clickLevel*vol*g,time); ng.gain.exponentialRampToValueAtTime(0.001,time+0.025);
    noise.connect(hp).connect(ng).connect(getBus()); noise.start(time); noise.stop(time+0.03);
  }
}

function playClap(time,vol,tune,velocity,kp){
  const g=velocity;
  const centerF=kp.centerFreqBase+tune*kp.centerFreqTune;
  kp.bursts.forEach((offset,i,arr)=>{
    const noise=audioCtx.createBufferSource(); noise.buffer=noiseBuf;
    const bp=audioCtx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=centerF; bp.Q.value=1.4;
    const ng=audioCtx.createGain();
    const last=i===arr.length-1;
    const peak= last? 0.55*vol*g : 0.4*vol*g;
    const decay= last? 0.22 : 0.03;
    ng.gain.setValueAtTime(peak,time+offset);
    ng.gain.exponentialRampToValueAtTime(0.001,time+offset+decay);
    noise.connect(bp).connect(ng).connect(getBus());
    noise.start(time+offset); noise.stop(time+offset+decay+0.02);
  });
}

// Hi-Hats: FM mit Feedback statt additiver Oszillator-Bank —
// Feedback-Operatoren erzeugen ein chaotisches, metallisch-rauschiges Spektrum.
function playHat(time,vol,tune,velocity,kp,open){
  const g=velocity;
  // Der längere "Accent"-Decay wird ab einem Velocity-Schwellwert gewählt statt eines Booleans —
  // damit klingen Ghost Notes weiterhin kurz/dezent und Accents weiterhin länger/druckvoller.
  const isAccentEnv = velocity>=1.1;
  const base = open ? (isAccentEnv?kp.decayOpenAccent:kp.decayOpen) : (isAccentEnv?kp.decayClosedAccent:kp.decayClosed);
  fmTrigger(time, {
    baseFreq: freqFromTune(kp.baseFreq,tune),
    ops: kp.ops.map(o=>({ratio:o.ratio, level:o.level, decay:o.decay*(base/kp.decayClosed), feedback:o.feedback})),
    ampDecay: base, vol: kp.fmLevel*vol*g,
    filter: {type:kp.filterType||'highpass', freq:kp.filterFreq}
  });
}

function playCrash(time,vol,tune,velocity,kp){
  const g=velocity;
  fmTrigger(time, {
    baseFreq: freqFromTune(kp.baseFreq,tune),
    ops: kp.ops, ampDecay: kp.ampDecay, vol: kp.fmLevel*vol*g,
    filter: {type:kp.filterType||'highpass', freq:kp.filterFreq}
  });
  const noise=audioCtx.createBufferSource(); noise.buffer=noiseBuf;
  const hp=audioCtx.createBiquadFilter(); hp.type=kp.filterType||'highpass'; hp.frequency.value=kp.filterFreq+1200;
  const gain=audioCtx.createGain();
  gain.gain.setValueAtTime(kp.noiseLevel*vol*g,time); gain.gain.exponentialRampToValueAtTime(0.001,time+kp.noiseDecay);
  noise.connect(hp).connect(gain).connect(getBus()); noise.start(time); noise.stop(time+kp.noiseDecay+0.05);
}
