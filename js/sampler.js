"use strict";
// =========================================================================
// SAMPLER (#8, Mockup docs/mockups/issue-8.html Variante A): ein Sample über die Klaviatur spielen, mehrstimmig.
// Instrument-Eintrag INSTR.sampler (js/events.js), Spur nur über „Spur hinzufügen“ (zählt zu MEL_MAX). Ersetzt die
// frühere SAMPLE-Spur (id 'mc'); alte Stände werden beim Laden umgewandelt (mcMigrate).
//   tr.smp     Sample: Werksample ('vox' | 'glas' | 'bass') oder Bibliothekseintrag 'lib:<id>'
//   tr.smpAtk / tr.smpRel   Hüllkurve in Sekunden (Release nur bei „Halten“/„Schleife“)
// Grundton (MIDI) gehört zum Sample: Bibliothekseintrag.root (fehlt = 60 = C4; beim ersten Wählen im Klang-Sheet
// wird er erkannt und gespeichert). Wiedergabe-Art aus dem Sample-Editor (entry.playMode): „Einmal“ spielt bis zum
// Ende (Notenlänge egal, z. B. Drum-Hits), „Halten“ folgt der Notenlänge, „Schleife“ wiederholt die Schleife beim Halten.
// Tonhöhe = playbackRate (Länge ändert sich mit, kein Time-Stretch → #11). Noten: MIDI = 33 + Grundton der Spur + n + 12 (wie KEYS).
// Stimme = BufferSource → Gain → tr.bus (2 Knoten je Note), höchstens SMP_MAXV gleichzeitig, Stopp über tr._cosVoices.
// =========================================================================
const SMP_MAXV=8, SMP_ROOT_DEF=60;
const SMP_NN=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function midiName(m){ return SMP_NN[((m%12)+12)%12]+(Math.floor(m/12)-1); }
// Werksamples: beim ersten Gebrauch synthetisiert (kein Download), Grundton bekannt
const SMP_WERK={
  vox: {name:'VOX',  root:57, mode:'loop', loop:[0.45,1.25], sec:1.6, desc:'Chor „Ahh“'},
  glas:{name:'GLAS', root:72, mode:'oneshot', sec:2.2, desc:'Glocke'},
  bass:{name:'BASS', root:36, mode:'hold', sec:1.4, desc:'gezupft'},
};
function smpWerkBuf(k){
  const sr=audioCtx ? audioCtx.sampleRate : 44100, W=SMP_WERK[k], n=Math.round(sr*W.sec);
  const b=new AudioBuffer({length:n, numberOfChannels:1, sampleRate:sr}), d=b.getChannelData(0);
  if(k==='vox'){ // „Ahh“ auf A3: Teiltöne nach drei Formanten gewichtet, leichtes Vibrato
    const f0=220, F=[[750,1],[1200,.55],[2600,.25]], K=24, amp=[];
    for(let h=1;h<=K;h++){ let a=0; F.forEach(([c,g])=>a+=g*Math.exp(-Math.pow((f0*h-c)/180,2))); amp.push(a+0.02/h); }
    for(let i=0;i<n;i++){ const t=i/sr, vib=1+0.006*Math.sin(2*Math.PI*5.2*t)*Math.min(1,t/0.3); let s=0;
      for(let h=1;h<=K;h++) s+=amp[h-1]*Math.sin(2*Math.PI*f0*h*vib*t+h);
      d[i]=s*Math.min(1,t/0.06)*(t>1.45?Math.max(0,(1.6-t)/0.15):1); }
  } else if(k==='glas'){ // C5, unharmonische Teiltöne
    const f=523.25, P=[[1,1,1.4],[2.76,.5,.5],[5.4,.25,.25],[8.9,.12,.12]];
    for(let i=0;i<n;i++){ const t=i/sr; let s=0; P.forEach(([r,a,tau])=>s+=a*Math.exp(-t/tau)*Math.sin(2*Math.PI*f*r*t)); d[i]=s*Math.min(1,t/0.002); }
  } else { // C2, gezupfte Saite (Karplus-Strong, fester Startwert → immer gleich)
    const N=Math.round(sr/65.41), ring=new Float32Array(N); let z=12345;
    for(let i=0;i<N;i++){ z=(z*1103515245+12345)%2147483648; ring[i]=z/1073741824-1; }
    let p=0; for(let i=0;i<n;i++){ const a=ring[p], c=ring[(p+1)%N]; ring[p]=0.5*(a+c)*0.996; d[i]=a*(i>n-400?(n-i)/400:1); p=(p+1)%N; }
  }
  let pk=0; for(let i=0;i<n;i++) pk=Math.max(pk,Math.abs(d[i])); for(let i=0;i<n;i++) d[i]*=0.8/pk;
  return b;
}
// ---- Puffer-Cache je Sample (Schlüssel wie tr.smp) ----
// {name, buf, root, mode, loop:[a,b]|null, off, state:'load'|'ok'|'missing'|'err', id (Bibliothek)}
const SMPL={};
function samplerGet(key){
  if(!key) return null;
  let S=SMPL[key]; if(S) return S;
  if(SMP_WERK[key]){ const W=SMP_WERK[key]; S=SMPL[key]={name:W.name, root:W.root, mode:W.mode, loop:W.loop||null, off:0, state:'ok', werk:true, buf:smpWerkBuf(key)}; return S; }
  if(key.startsWith('lib:')){ S=SMPL[key]={name:'…', state:'load', id:key.slice(4)}; S.p=samplerLoadLib(S); return S; }
  return SMPL[key]={name:'?', state:'missing'};
}
async function samplerLoadLib(S){
  try{
    const e=await loadSampleLibraryEntry(S.id);
    if(!e){ S.state='missing'; S.name='Sample fehlt'; samplerChanged(); return; }
    await Promise.resolve(initAudio());
    const buf=await audioCtx.decodeAudioData(await e.blob.arrayBuffer()), off=e.offsetStart||0;
    Object.assign(S, {name:e.name||'Sample', buf, off, root:e.root!=null ? e.root : null,
      mode:e.playMode||'oneshot', loop:(e.loopStart!=null && e.loopEnd!=null && e.loopEnd>e.loopStart) ? [off+e.loopStart, off+e.loopEnd] : null, state:'ok'});
  }catch(err){ console.warn('Sampler: Sample nicht ladbar', S.id, err); S.state='err'; S.name='Sample fehlt'; }
  samplerChanged();
}
const smpRoot=S=>S && S.root!=null ? S.root : SMP_ROOT_DEF;
// Nach dem Laden: Namen in Noteneditor, Spur-Menü und Klang-Sheet auffrischen
function samplerChanged(){
  if(typeof prIsOpen==='function' && prIsOpen() && prTr && trInstKey(prTr)==='sampler') prRenderChrome();
  if(typeof klTr!=='undefined' && klTr && trInstKey(klTr)==='sampler' && $id('klSheet').classList.contains('open')) renderKlang();
}
// Alle Samples der Sampler-Spuren laden; Promise erst fertig, wenn alle da sind (WAV-Export)
function samplerSync(){ return Promise.all(TRACKS.filter(t=>trInstKey(t)==='sampler').map(t=>{ const S=samplerGet(t.smp); return S && S.p; })); }
// Eintrag im Sample-Editor neu gespeichert: Puffer neu laden
function samplerInvalidate(id){ delete SMPL['lib:'+id]; samplerSync(); }
async function samplerSetRoot(S, m){
  S.root=Math.max(12, Math.min(108, m));
  if(S.id){ try{ const e=await loadSampleLibraryEntry(S.id); if(e){ e.root=S.root; await saveSampleLibraryEntry(e); } }catch(err){ console.warn('Sampler: Grundton nicht gespeichert', err); } }
}
// Tonhöhe erkennen: normierte Autokorrelation auf 80 ms kurz nach dem Anschlag, 50–1000 Hz → MIDI oder null
function smpDetect(S){
  if(!S || !S.buf) return null;
  const d=S.buf.getChannelData(0), sr=S.buf.sampleRate, a=Math.round(((S.off||0)+0.06)*sr), N=Math.min(Math.round(0.08*sr), d.length-a-Math.round(sr/50)); if(N<512) return null;
  const lo=Math.round(sr/1000), hi=Math.round(sr/50), r=new Float32Array(hi+2); let mx=0;
  for(let L=lo;L<=hi;L++){ let s=0,e1=0,e2=0; for(let i=0;i<N;i+=2){ const x=d[a+i], y=d[a+i+L]; s+=x*y; e1+=x*x; e2+=y*y; }
    r[L]=s/Math.sqrt(e1*e2+1e-12); if(r[L]>mx) mx=r[L]; }
  if(mx<0.6) return null;
  // Kürzeste Periode, deren Spitze fast so hoch ist wie die höchste (sonst Oktavfehler nach unten: 2×, 4× Periode passen auch)
  for(let L=lo+1;L<hi;L++) if(r[L]>=0.88*mx && r[L]>=r[L-1] && r[L]>=r[L+1]){
    const p=r[L-1]-2*r[L]+r[L+1], dl=p<0 ? 0.5*(r[L-1]-r[L+1])/p : 0; // Parabel durch die Spitze: genauere Periode
    return Math.round(69+12*Math.log2(sr/(L+dl)/440)); }
  return null;
}
// ---- Stimme ----
function samplerVoice(tr, time, n, vel, holdSec){
  if(!audioCtx || !tr.bus) return null;
  const S=samplerGet(tr.smp); if(!S || S.state!=='ok') return null;
  const midi=33+(tr.rootNote||0)+n+12, rate=Math.pow(2,(midi-smpRoot(S))/12);
  const src=audioCtx.createBufferSource(); src.buffer=S.buf; src.playbackRate.value=rate;
  const looping=S.mode==='loop' && !!S.loop, oneshot=S.mode==='oneshot';
  if(looping){ src.loop=true; src.loopStart=S.loop[0]; src.loopEnd=S.loop[1]; }
  const g=audioCtx.createGain(), peak=Math.max(0.0001, Math.min(1.2, vel*tr.vol));
  const atk=Math.max(0.002, tr.smpAtk!=null ? tr.smpAtk : 0.005), rel=Math.max(0.02, tr.smpRel!=null ? tr.smpRel : 0.25);
  g.gain.setValueAtTime(0, time); g.gain.linearRampToValueAtTime(peak, time+atk);
  src.connect(g).connect(tr.bus); src.start(time, Math.min(S.off||0, Math.max(0, S.buf.duration-0.01)));
  const voice={amp:g, oscs:[src], t0:time, rel(at){
    if(oneshot || voice.done) return; voice.done=true; // „Einmal“: spielt bis zum Ende
    const now=Math.max(time, at!=null ? at : audioCtx.currentTime), lvl=now<time+atk ? peak*(now-time)/atk : peak;
    try{ g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(lvl, now); g.gain.setTargetAtTime(0, now, rel/5); src.stop(now+rel+0.03); }catch(e){} }};
  src.onended=()=>{ try{ g.disconnect(); }catch(e){} const l=tr._cosVoices; if(l){ const i=l.indexOf(voice); if(i>=0) l.splice(i,1); } };
  const isLive=!(typeof OfflineAudioContext!=='undefined' && audioCtx instanceof OfflineAudioContext);
  if(isLive){ const L=(tr._cosVoices=tr._cosVoices||[]); L.push(voice);
    while(L.length>SMP_MAXV){ const o=L.shift(); try{ o.amp.gain.cancelScheduledValues(time); o.amp.gain.setTargetAtTime(0, time, 0.01); o.oscs.forEach(x=>{ try{ x.stop(time+0.06); }catch(e){} }); }catch(e){} } }
  if(holdSec!=null) voice.rel(time+holdSec);
  return voice;
}
// Anhören im Klang-Sheet: Grundton des Samples (= Originaltonhöhe)
function samplerPreview(tr){
  Promise.resolve(initAudio()).then(()=>{ if(audioCtx.state!=='running') audioCtx.resume(); ensureTrackBuses();
    const S=samplerGet(tr.smp); if(!S || S.state!=='ok') return;
    samplerVoice(tr, audioCtx.currentTime+0.01, smpRoot(S)-45-(tr.rootNote||0), 0.9, 0.7); });
}
function samplerSub(tr){ const S=samplerGet(tr.smp); return S ? (S.state==='missing'||S.state==='err' ? 'Sample fehlt' : S.name) : ''; }
// Sample wählen. Bibliothek ohne Grundton: erkennen (sonst C4) und am Eintrag speichern.
async function samplerPick(tr, key, quiet){
  tr.smp=key; const S=samplerGet(key);
  if(S.p) await S.p;
  if(S.state==='ok' && S.id && S.root==null) await samplerSetRoot(S, smpDetect(S) || SMP_ROOT_DEF);
  samplerChanged(); renderKlang(); if(typeof prIsOpen==='function' && prIsOpen()) prRenderChrome(); trMenuRefresh();
  if(!quiet) samplerPreview(tr);
}
function trMenuRefresh(){ if(typeof grpSelRender==='function') try{ grpSelRender(); }catch(e){} }

// ---- Klang-Sheet · Reiter Sound ----
let SMP_LIB=[]; // Bibliothek (id, name) für die Auswahl; neu gelesen beim Öffnen
async function samplerLibRefresh(){ try{ SMP_LIB=(await listSampleLibrary()).map(e=>({id:e.id, name:e.name||'Sample'})); }catch(e){ SMP_LIB=[]; } }
function samplerKlang(tr, box, grp){
  const S=samplerGet(tr.smp);
  grp('Sample');
  const ch=document.createElement('div'); ch.className='smp-chips';
  const chip=(key, label, sub)=>{ const b=document.createElement('button'); b.className='smp-chip'+(tr.smp===key?' on':''); b.innerHTML='<b></b>'+(sub?'<small></small>':'');
    b.querySelector('b').textContent=label; if(sub) b.querySelector('small').textContent=sub; b.onclick=()=>samplerPick(tr, key); ch.appendChild(b); };
  Object.keys(SMP_WERK).forEach(k=>chip(k, SMP_WERK[k].name, SMP_WERK[k].desc));
  SMP_LIB.forEach(e=>chip('lib:'+e.id, e.name, ''));
  if(tr.smp.startsWith('lib:') && !SMP_LIB.some(e=>'lib:'+e.id===tr.smp)) chip(tr.smp, S.name, ''); // fehlt in der Bibliothek
  const rec=document.createElement('button'); rec.className='smp-chip smp-add'; rec.innerHTML=TR_IC.plus+'<b>Aufnehmen / Laden</b>';
  rec.onclick=()=>{ closeSheets(); openSampleEditor({forSampler:tr}); }; ch.appendChild(rec);
  box.appendChild(ch);
  const hint=t=>{ const h=document.createElement('div'); h.className='kl-note'; h.textContent=t; box.appendChild(h); };
  if(S.state==='missing' || S.state==='err'){ hint('Dieses Sample gibt es auf diesem Gerät nicht (mehr). Die Spur bleibt stumm, bis du ein anderes wählst.'); }
  else if(S.state==='load'){ hint('Sample wird geladen …'); }
  else {
    grp('Grundton am Sample');
    const r=document.createElement('div'); r.className='smp-root';
    r.innerHTML='<button data-d="-1" aria-label="Grundton tiefer">−</button><b>'+midiName(smpRoot(S))+'</b><button data-d="1" aria-label="Grundton höher">+</button>'
      +'<button class="smp-det" data-x="det"><svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h3l3-7 4 14 3-7h5"/></svg>Erkennen</button>'
      +'<button class="smp-det" data-x="hear" aria-label="Anhören"><svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><polygon points="7,5 19,12 7,19" fill="currentColor"/></svg></button>';
    if(S.werk) r.querySelectorAll('[data-d],[data-x=det]').forEach(b=>b.disabled=true);
    r.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{ await samplerSetRoot(S, smpRoot(S)+(+b.dataset.d)); renderKlang(); samplerPreview(tr); });
    r.querySelector('[data-x=det]').onclick=async()=>{ const m=smpDetect(S); if(m==null){ hmToast('Keine klare Tonhöhe erkannt',false); return; } await samplerSetRoot(S, m); renderKlang(); samplerPreview(tr); };
    r.querySelector('[data-x=hear]').onclick=()=>samplerPreview(tr);
    box.appendChild(r);
    const M={oneshot:'Einmal: spielt bis zum Ende, Notenlänge egal.', hold:'Halten: klingt so lang wie die Note.', loop:S.loop?'Schleife: wiederholt beim Halten.':'Schleife ohne Bereich: klingt so lang wie die Note.'};
    hint(S.werk ? 'Werksample, richtig gestimmt. '+M[S.mode] : 'Gehört zum Sample, gilt in jeder Spur und jedem Beat. '+M[S.mode]+' Wiedergabe-Art im Sample-Editor.');
    if(S.id){ const ed=document.createElement('div'); ed.className='acts'; ed.innerHTML='<button class="act" data-x="edit">'+UI_IC.trim+'Im Sample-Editor bearbeiten</button>';
      ed.querySelector('button').onclick=()=>{ closeSheets(); openSampleEditor({sampleId:S.id, forSampler:tr}); }; box.appendChild(ed); }
  }
  grp('Hüllkurve');
  const ms=v=>v<1000 ? v+' ms' : (v/1000).toFixed(1)+' s';
  box.appendChild(soundRow('Attack',2,500,Math.round((tr.smpAtk!=null?tr.smpAtk:0.005)*1000),5,ms,v=>tr.smpAtk=v/1000));
  box.appendChild(soundRow('Release',20,2000,Math.round((tr.smpRel!=null?tr.smpRel:0.25)*1000),250,ms,v=>tr.smpRel=v/1000));
}

// ---- Umwandlung alter Stände: SAMPLE-Spur (id 'mc', ein Sample für alle Beats in localStorage) → Sampler-Spur ----
// Nur wenn die Spur Noten hat und ein Sample zugeordnet war (sonst war sie stumm). Noten auf dem Grundton des Samples
// (+ Tune der alten Spur in Halbtönen), Grundton fehlt am Eintrag → C4 wird gespeichert, damit es gleich klingt.
function mcSampleId(){ try{ return localStorage.getItem('mrm44_sampleTrackId'); }catch(e){ return null; } }
function mcEvents(steps, tune){
  const n=SMP_ROOT_DEF-45+Math.round(((tune!=null?tune:0.5)-0.5)*24), out=[];
  (steps||[]).forEach((v,s)=>{ const x=typeof v==='number' ? v : (v?VEL_NORMAL:0); if(x>0){ const f=evFromStepVal(x); out.push({s, n, l:1, v:f.v, a:f.a}); } });
  return out;
}
function mcTrack(sv, sid, id){
  const o=Object.assign({}, INSTR.sampler.tpl, sv, {id, rootNote:0, scale:'minor', smp:'lib:'+sid, events:mcEvents(sv.steps, sv.tune)});
  delete o.notes; delete o.slides; delete o.isSample; o.tune=0.5;
  return o;
}
function mcRootDefault(sid){ loadSampleLibraryEntry(sid).then(e=>{ if(e && e.root==null){ e.root=SMP_ROOT_DEF; return saveSampleLibraryEntry(e); } }).catch(()=>{}); }
function mcMigrate(data){
  if(!data || !Array.isArray(data.tracks)) return;
  const i=data.tracks.findIndex(t=>t && t.id==='mc'); if(i<0) return;
  const sv=data.tracks[i]; data.tracks.splice(i,1);
  const clips=data.arrangement && data.arrangement.clips ? data.arrangement.clips.mc : null;
  if(data.arrangement && data.arrangement.clips) delete data.arrangement.clips.mc;
  const sid=mcSampleId(), used=(sv.steps||[]).some(v=>v) || (clips||[]).some(c=>(c.steps||[]).some(v=>v));
  const mel=Array.isArray(data.mel) ? data.mel : MEL_BASE.map(e=>({id:e.id, inst:e.id}));
  if(!sid || !used || mel.length>=MEL_MAX) return;
  let id='sampler'; for(let n=2; mel.some(e=>e.id===id) || data.tracks.some(t=>t.id===id); n++) id='sampler'+n;
  data.mel=mel.concat([{id, inst:'sampler', label:'SAMPLE'}]);
  data.tracks.push(mcTrack(sv, sid, id));
  if(clips) data.arrangement.clips[id]=clips.map(c=>{ const evs=mcEvents(c.steps, sv.tune); return {start:c.start, bars:c.bars, events:evs, steps:evStepsOf(evs, c.bars*16)}; });
  mcRootDefault(sid);
}
// Alter Beat aus dem Reiter „Sample“ → Sampler-Beat
function mcBeat(d){
  if(!d || d.group!=='sample') return d;
  const sid=d.sampleId || mcSampleId(), sv=(d.tracks||[]).find(t=>t.id==='mc')||{steps:[]};
  const o=Object.assign({}, d, {group:'sampler', tracks:[mcTrack(sv, sid||'', 'sampler')]}); delete o.sampleId;
  if(sid) mcRootDefault(sid);
  return o;
}
