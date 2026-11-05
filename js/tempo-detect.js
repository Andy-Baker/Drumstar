// =========================================================================
// TEMPO ERKENNEN (#53, Mockup docs/mockups/issue-53.html Variante A)
// „Hören“ im Tempo-Fenster: Musik übers Mikro mithören (z. B. Radio), Tempo
// schätzen, übernehmen. Erkennung komplett im Browser.
// Neu gebaut (v98): Die alte Onset-Kurve (log1p(1000·|X|) je FFT-Bin) machte
// aus jedem Grundrauschen volle Ausschläge (Log-Schwankung von Rauschen ist
// pegelunabhängig) → übers Handy-Mikro fast nur Zufallswerte. Jetzt:
//  1. Onset-Kurve: 24 Bänder 60 Hz–8 kHz (Energie gemittelt), dB relativ zum
//     lautesten Band (gleitender Bezug), Boden −60 dB, positive Differenz.
//  2. Tempo: Autokorrelation → Kandidaten (Maxima von r(L)+r(2L)+r(4L)) →
//     Pulszug-Prüfung über alle Phasen (Schlag 1, halber Schlag 0,5) → Vorliebe
//     um 120 (log-normal, 1 Oktave) → Feinsuche über bis zu 8 Perioden.
//  3. Sicherheit = Abstand zum besten nicht verwandten Kandidaten (½/×2 zählen
//     als verwandt, dafür gibt es die Knöpfe).
// Testmaterial/Auswertung: tests/test-tempo.py (synthetisch + Handy-Simulation).
// =========================================================================
function bpmFft(re, im){ // in-place radix-2
  const n=re.length;
  for(let i=1,j=0;i<n;i++){ let b=n>>1; for(;j&b;b>>=1) j^=b; j^=b; if(i<j){ let t=re[i]; re[i]=re[j]; re[j]=t; t=im[i]; im[i]=im[j]; im[j]=t; } }
  for(let len=2;len<=n;len<<=1){
    const a=-2*Math.PI/len, wr=Math.cos(a), wi=Math.sin(a);
    for(let i=0;i<n;i+=len){ let cr=1, ci=0;
      for(let k=0;k<len/2;k++){ const p=i+k, q=p+len/2;
        const tr=re[q]*cr-im[q]*ci, ti=re[q]*ci+im[q]*cr;
        re[q]=re[p]-tr; im[q]=im[p]-ti; re[p]+=tr; im[p]+=ti;
        const nr=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=nr; } } }
}
const BPM_N=1024, BPM_H=512, BPM_BANDS=24, BPM_FLOOR=-60;
function BpmDetector(sr){
  const N=BPM_N, H=BPM_H, B=BPM_BANDS, win=new Float32Array(N);
  for(let i=0;i<N;i++) win[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
  const edge=[]; for(let b=0;b<=B;b++) edge.push(Math.round(60*Math.pow(8000/60,b/B)*N/sr));
  for(let b=1;b<=B;b++) if(edge[b]<=edge[b-1]) edge[b]=edge[b-1]+1;
  const buf=new Float32Array(N); let fill=0;
  const re=new Float32Array(N), im=new Float32Array(N), band=new Float64Array(B), prev=new Float32Array(B); let first=true;
  const env=[]; const fr=sr/H; let ref=1e-12; const decay=Math.pow(10,-6/10/(fr*10)); // Bezug sinkt 6 dB je 10 s
  function frame(){
    for(let i=0;i<N;i++){ re[i]=buf[i]*win[i]; im[i]=0; }
    bpmFft(re,im); let top=0;
    for(let b=0;b<B;b++){ let s=0; for(let k=edge[b];k<edge[b+1];k++) s+=re[k]*re[k]+im[k]*im[k]; band[b]=s/(edge[b+1]-edge[b]); if(band[b]>top) top=band[b]; }
    ref=Math.max(ref*decay, top);
    let f=0; // erster Frame ohne Vorgänger zählt nicht (sonst Riesen-Ausschlag am Anfang)
    for(let b=0;b<B;b++){ const d=Math.max(BPM_FLOOR, 10*Math.log10(band[b]/ref+1e-30)); const x=d-prev[b]; if(x>0&&!first) f+=x; prev[b]=d; }
    first=false; env.push(f/B);
  }
  return {
    fr, env,
    push(x){ let i=0; while(i<x.length){ const n=Math.min(N-fill, x.length-i); buf.set(x.subarray(i,i+n), fill); fill+=n; i+=n;
        if(fill===N){ frame(); buf.copyWithin(0,H); fill=N-H; } } },
    seconds(){ return env.length/fr; },
    estimate(){ return bpmEstimate(env, fr); }
  };
}
// → {bpm, conf 0..1, lastFrame (letzter Schlag, Frame-Index), period (Frames)} oder null (< 3 s)
function bpmEstimate(envIn, fr, lo=60, hi=200){
  const n=envIn.length; if(n<fr*3) return null;
  // Gleitenden Mittelwert (±0,2 s) abziehen, nur Anstiege, auf Streuung 1
  const w=Math.round(fr*0.2), e=new Float32Array(n), cs=new Float64Array(n+1);
  for(let i=0;i<n;i++) cs[i+1]=cs[i]+envIn[i];
  let s2=0; for(let i=0;i<n;i++){ const a=Math.max(0,i-w), b=Math.min(n,i+w+1); const v=envIn[i]-(cs[b]-cs[a])/(b-a); e[i]=v>0?v:0; s2+=e[i]*e[i]; }
  const sd=Math.sqrt(s2/n)||1; for(let i=0;i<n;i++) e[i]/=sd;
  const maxL=Math.min(Math.ceil(60*fr/lo*4)+2, n-1), acf=new Float32Array(maxL+1);
  for(let L=0;L<=maxL;L++){ let t=0; for(let i=0;i+L<n;i++) t+=e[i]*e[i+L]; acf[L]=t/n; }
  const at=L=>{ if(L>=maxL) return 0; const i=Math.floor(L), f=L-i; return acf[i]*(1-f)+acf[i+1]*f; };
  const prior=b=>{ const p=Math.log2(b/120); return Math.exp(-0.5*p*p); };
  const eac=b=>{ const L=60*fr/b; return at(L)+at(2*L)+at(4*L); };
  const cur=[]; for(let b=lo;b<=hi;b+=0.5) cur.push([b,eac(b)]);
  const cand=[]; for(let i=1;i<cur.length-1;i++) if(cur[i][1]>=cur[i-1][1]&&cur[i][1]>cur[i+1][1]) cand.push(cur[i]);
  if(!cand.length) return null;
  cand.sort((x,y)=>y[1]-x[1]);
  // Pulszug über alle Phasen: bester Treffer und Streuung (deutliches Raster)
  const sc=cand.slice(0,8).map(([b,v])=>{ const P=60*fr/b; let mx=0, sum=0, sq=0, c=0;
    for(let ph=0;ph<P;ph++){ let t=0, m=0;
      for(let x=ph;x<n;x+=P){ t+=(e[Math.round(x)]||0)+0.5*(e[Math.round(x+P/2)]||0); m++; }
      t/=m; sum+=t; sq+=t*t; c++; if(t>mx) mx=t; }
    const mean=sum/c; return {b, v, mx, sd:Math.sqrt(Math.max(0,sq/c-mean*mean))}; });
  const mv=Math.max(...sc.map(o=>o.v))||1, mm=Math.max(...sc.map(o=>o.mx))||1, ms=Math.max(...sc.map(o=>o.sd))||1;
  for(const o of sc) o.s=(o.v/mv+o.mx/mm+o.sd/ms)*prior(o.b);
  sc.sort((x,y)=>y.s-x.s);
  // fein: Kamm über bis zu 8 Perioden um den Sieger
  const fine=b=>{ const L=60*fr/b; let v=0,c=0; for(let k=1;k*L<maxL&&k<=8;k++){ v+=at(k*L); c++; } return c?v/c:0; };
  let best=sc[0].b, fv=-1; for(let b=sc[0].b-1;b<=sc[0].b+1;b+=0.02){ const v=fine(b); if(v>fv){ fv=v; best=b; } }
  best=Math.min(hi,Math.max(lo,best));
  const rel=b=>[1,2,.5].some(k=>Math.abs(b/(best*k)-1)<0.03);
  let s2b=0; for(const o of sc.slice(1)) if(!rel(o.b)&&o.s>s2b) s2b=o.s;
  const conf=Math.max(0,Math.min(1,(1-s2b/sc[0].s)/0.4));
  // Phase: letzter Schlag im Raster der letzten 8 s
  const P=60*fr/best; let bp=0, bs=-1; const from=Math.max(0,n-Math.round(fr*8));
  for(let ph=0;ph<P;ph+=0.5){ let t=0; for(let x=from+ph;x<n;x+=P) t+=e[Math.round(x)]||0; if(t>bs){ bs=t; bp=ph; } }
  let last=from+bp; while(last+P<n) last+=P;
  return { bpm:best, conf, lastFrame:last, period:P };
}

// ---- UI ----
const TD_MAX_S=15, TD_MIN_S=6;
const tdHear=document.getElementById('tempoOverlayHear'), tdHearLbl=tdHear.querySelector('span');
const tdTag=document.getElementById('tdTag'), tdBeat=document.getElementById('tdBeat'), tdLv=document.getElementById('tdLv');
const tdMtr=document.getElementById('tdMtr'), tdPrg=document.getElementById('tdPrg'), tdStat=document.getElementById('tdStat');
const tdRes=document.getElementById('tdRes'), tdAlt=document.getElementById('tdAlt'), tdRecInfo=document.getElementById('tdRecInfo');
const tdCheck=document.getElementById('tdCheck'), tdPlay=document.getElementById('tdPlay');
let tdOn=false, tdDet=null, tdRec=[], tdRecLen=0, tdSrc=null, tdNode=null, tdSink=null, tdT0=null, tdStart=0, tdPk=0;
let tdHist=[], tdRaf=0, tdResult=null, tdMul=1, tdCheckTimer=null, tdPlaySrc=null;

function tdUi(on){
  tdHear.classList.toggle('on',on); tdHearLbl.textContent=on?'STOPP':'HÖREN';
  tdLv.hidden=!on; tdTag.className=on?'rec':''; tdTag.textContent=on?'HÖRT MIT':'';
  tempoOverlayNum.classList.toggle('td-listen',on);
}
async function tdStartListen(){
  tdStopCheck(); tdStopPlay(); tdRes.hidden=true; tdResult=null;
  try{
    await Promise.resolve(initAudio());
    if(audioCtx.state!=='running') await audioCtx.resume();
    await ensureMicStream();
  }catch(err){ tdStat.textContent=micErrorMessage(err); tdStat.classList.add('err'); return; }
  tdStat.classList.remove('err');
  if(isPlaying) stop(); // eigener Klang würde mitgehört
  tdDet=BpmDetector(audioCtx.sampleRate); tdRec=[]; tdRecLen=0; tdHist=[]; tdT0=null; tdPk=0;
  // t = Kontextzeit des ersten Samples im Block (Worklet: currentFrame, exakt)
  const onChunk=(c, t)=>{ if(!tdOn) return;
    if(tdT0===null) tdT0=t;
    tdRec.push(c); tdRecLen+=c.length; tdDet.push(c);
    let pk=0; for(let i=0;i<c.length;i++){ const a=c[i]<0?-c[i]:c[i]; if(a>pk) pk=a; } if(pk>tdPk) tdPk=pk; };
  tdSrc=audioCtx.createMediaStreamSource(micStream);
  tdSink=audioCtx.createGain(); tdSink.gain.value=0;
  if(useMicWorklet){
    tdNode=new AudioWorkletNode(audioCtx,'mic-tap',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
    tdNode.port.onmessage=e=>onChunk(e.data.d, e.data.f/audioCtx.sampleRate);
  } else {
    tdNode=audioCtx.createScriptProcessor(2048,1,1);
    tdNode.onaudioprocess=ev=>onChunk(new Float32Array(ev.inputBuffer.getChannelData(0)), audioCtx.currentTime-2048/audioCtx.sampleRate);
  }
  tdSrc.connect(tdNode).connect(tdSink).connect(audioCtx.destination);
  tdOn=true; tdStart=performance.now(); tdUi(true);
  tempoOverlayNum.textContent='--'; tdStat.textContent='Musik laufen lassen…';
  let lastEst=0;
  const loop=()=>{ if(!tdOn) return;
    if(!tempoOverlay.classList.contains('open')){ tdStopListen(false); return; } // Fenster zu = abbrechen
    const t=(performance.now()-tdStart)/1000;
    tdPrg.style.width=Math.min(100,t/TD_MAX_S*100)+'%';
    const db=20*Math.log10(tdPk||1e-6); tdPk*=0.85;
    tdMtr.style.width=Math.max(0,Math.min(100,(db+48)/48*100))+'%';
    if(t-lastEst>1 && tdDet.seconds()>=4){ lastEst=t; const r=tdDet.estimate();
      if(r){ tdHist.push(r.bpm); tempoOverlayNum.textContent=Math.round(r.bpm);
        tdStat.textContent='Sicherheit '+Math.round(r.conf*100)+' % · '+Math.floor(t)+' s';
        const h=tdHist.slice(-4);
        if(t>=TD_MIN_S && h.length===4 && Math.max(...h)-Math.min(...h)<=1.2 && r.conf>.35){ tdStopListen(true); return; } } }
    if(db<-55 && t>3) tdStat.textContent='Sehr leise – Handy näher an die Musik';
    if(t>=TD_MAX_S){ tdStopListen(true); return; }
    tdRaf=requestAnimationFrame(loop); };
  tdRaf=requestAnimationFrame(loop);
}
function tdStopListen(evaluate){
  tdOn=false; cancelAnimationFrame(tdRaf);
  try{ tdSrc.disconnect(); tdNode.disconnect(); tdSink.disconnect(); }catch(e){}
  if(tdNode && tdNode.port) tdNode.port.onmessage=null;
  tdSrc=tdNode=tdSink=null; tdUi(false);
  const r=evaluate&&tdDet?tdDet.estimate():null;
  if(!r){ setBpm(bpm); tdStat.textContent=evaluate?'Zu kurz – mindestens 3 s hören':''; return; }
  tdResult=r; tdResult.t0=tdT0; tdStat.textContent=''; tdTag.textContent='ERKANNT';
  tdShow(1);
}
function tdShow(mul){
  tdMul=mul; const b=tdResult.bpm*mul;
  document.getElementById('tdBig').textContent=Math.round(b);
  document.getElementById('tdDec').textContent=b.toFixed(1).replace('.',',')+' BPM';
  const c=tdResult.conf, cl=c>.6?'h':c>.3?'m':'l', cf=document.getElementById('tdConf');
  cf.className='td-conf '+cl; cf.textContent='Sicherheit '+(cl==='h'?'hoch':cl==='m'?'mittel':'gering');
  const opts=[[.5,'½'],[1,'erkannt'],[2,'×2']].filter(([m])=>{ const v=tdResult.bpm*m; return v>=60&&v<=200; });
  tdAlt.innerHTML=opts.map(([m,l])=>`<button data-m="${m}" class="${m===mul?'on':''}">${Math.round(tdResult.bpm*m)}<small>${l}</small></button>`).join('');
  tempoOverlayNum.textContent=Math.round(b);
  // Aufnahme-Zeile erst, wenn wirklich etwas aufgenommen ist
  tdRecInfo.textContent='Aufnahme · '+(tdRecLen/audioCtx.sampleRate).toFixed(1).replace('.',',')+' s';
  document.getElementById('tdRecRow').hidden=!tdRecLen;
  tdRes.hidden=false;
}
tdAlt.addEventListener('click', e=>{ const x=e.target.closest('button'); if(!x) return;
  tdShow(+x.dataset.m); if(tdCheckTimer){ tdStopCheck(); tdStartCheck(); } });

// Mitklicken: Metronom-Klick im erkannten Raster, phasenrichtig fortgesetzt
function tdStartCheck(){
  const per=60/(tdResult.bpm*tdMul);
  // Schlag kam am Mikro um Eingangs-Latenz später an, der Klick braucht bis zum
  // Lautsprecher Basis- + Ausgangs-Latenz (Android oft 0,1–0,3 s zusammen) → früher planen
  let next=tdResult.t0+(tdResult.lastFrame*BPM_H+BPM_N/2)/audioCtx.sampleRate-tdLatency();
  while(next<audioCtx.currentTime+.05) next+=per;
  let i=0; tdCheck.classList.add('on');
  const tick=()=>{ if(!tempoOverlay.classList.contains('open')){ tdStopCheck(); return; }
    while(next<audioCtx.currentTime+.2){ playMetronomeClick(next, i%4===0);
      const d=(next-audioCtx.currentTime+(audioCtx.baseLatency||0)+(audioCtx.outputLatency||0))*1000; setTimeout(()=>{ tdBeat.classList.add('on'); setTimeout(()=>tdBeat.classList.remove('on'),90); },Math.max(0,d));
      next+=per; i++; } };
  tick(); tdCheckTimer=setInterval(tick,50);
}
function tdLatency(){
  let inp=0; try{ const st=micStream&&micStream.getAudioTracks()[0].getSettings(); if(st&&st.latency>0) inp=st.latency; }catch(e){}
  return (audioCtx.baseLatency||0)+(audioCtx.outputLatency||0)+inp;
}
function tdStopCheck(){ clearInterval(tdCheckTimer); tdCheckTimer=null; tdCheck.classList.remove('on'); }
function tdBuffer(){
  const ab=audioCtx.createBuffer(1,tdRecLen,audioCtx.sampleRate), d=ab.getChannelData(0);
  let o=0; for(const c of tdRec){ d.set(c,o); o+=c.length; } return ab;
}
function tdStopPlay(){ if(tdPlaySrc){ try{ tdPlaySrc.stop(); }catch(e){} tdPlaySrc=null; } tdPlay.classList.remove('on'); }

tdHear.addEventListener('click', ()=> tdOn ? tdStopListen(true) : tdStartListen());
tdCheck.addEventListener('click', ()=> tdCheckTimer ? tdStopCheck() : tdStartCheck());
document.getElementById('tdAgain').addEventListener('click', ()=> tdStartListen());
document.getElementById('tdTake').addEventListener('click', ()=>{
  tdStopCheck(); setBpm(tdResult.bpm*tdMul); tdRes.hidden=true; tdTag.textContent='';
  tdStat.textContent='Tempo '+bpm+' übernommen';
});
tdPlay.addEventListener('click', ()=>{
  if(tdPlaySrc){ tdStopPlay(); return; }
  tdPlaySrc=audioCtx.createBufferSource(); tdPlaySrc.buffer=tdBuffer(); tdPlaySrc.connect(master); tdPlaySrc.start();
  tdPlay.classList.add('on'); const me=tdPlaySrc; tdPlaySrc.onended=()=>{ if(tdPlaySrc===me){ tdPlaySrc=null; tdPlay.classList.remove('on'); } };
});
// Als Sample: Aufnahme als neues Sample in den Sample-Editor (dort kürzen, zuweisen, übernehmen)
document.getElementById('tdKeep').addEventListener('click', ()=>{
  tdStopCheck(); tdStopPlay();
  openSampleEditor({buffer:tdBuffer(), label:'Aufnahme aus Tempo erkennen'});
});
