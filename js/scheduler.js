"use strict";
// =========================================================================
// SCHEDULER (Lookahead-Pattern)
// =========================================================================
let isPlaying=false, currentStep=0, nextNoteTime=0;
const scheduleAheadTime=0.12, lookahead=25;
let timerID=null;
// Takt-Geber im Web Worker: Timer im Hauptthread werden von Rendern/Layout
// blockiert und im Hintergrund-Tab gedrosselt. Der Worker schickt nur Ticks,
// die Planung selbst bleibt hier. Ohne Worker (alter Browser, CSP) → setTimeout.
let tickWorker=null;
try{
  const src="let t=null;onmessage=e=>{clearInterval(t);t=null;if(e.data>0)t=setInterval(()=>postMessage(0),e.data);};";
  tickWorker=new Worker(URL.createObjectURL(new Blob([src],{type:'text/javascript'})));
  tickWorker.onmessage=()=>{ if(isPlaying) scheduler(); };
}catch(e){ tickWorker=null; }

// Transport-Ereignisse: Die Engine (start/stop/scheduler/scheduleStep) kennt keine
// Oberfläche. UI-Teile (Play-Taste, Abspielkopf, Piano Roll) hängen sich hier ein
// (js/transport-ui.js). 'start' kommt vor dem ersten Planen, 'step' je geplantem Step
// ({step,time,isFill,abs}, time = Audio-Zeit, also im Voraus), 'stop' am Ende von stop().
const TRANSPORT_HOOKS={start:[],stop:[],step:[]};
function transportOn(ev,fn){ TRANSPORT_HOOKS[ev].push(fn); }
function transportEmit(ev,a){ const l=TRANSPORT_HOOKS[ev]; for(let i=0;i<l.length;i++) l[i](a); }

function stepDuration(){ return 60/bpm/4; }
// Hält die Delay-Zeit synchron zum Tempo (Viertelnoten-Delay = 4 Steps).
// setTargetAtTime statt hartem Sprung, damit Tempo-Änderungen während des
// Abspielens nicht als hörbarer Klick im Delay-Signal auftauchen.
function updateDelayTime(){ fxDelayUpdate(); }

// ---- Metronom-Klick (optional, unabhängig vom Pattern) ----
// Ein-/ausschaltbar über #tempoClickToggle im Tempo-Overlay. Klingt auf jeder
// Viertelnote (alle 4 Steps), die "1" jedes 4/4-Takts (Step % 16 === 0) wird
// heller/lauter betont. Bewusst NICHT über getBus()/Hall/Delay geroutet und
// NICHT von Humanize/Swing beeinflusst — ein Metronom-Klick soll als feste
// Referenz dienen, nicht Teil des musikalischen Signals sein. Läuft nur live
// (scheduleStep), nicht im Offline-WAV-Export, da renderPatternToWav() einen
// eigenen Trigger-Loop nutzt und scheduleStep() dafür nicht aufruft.
let metronomeClickEnabled=false;
function playMetronomeClick(time, accented){
  if(!audioCtx) return;
  const osc=audioCtx.createOscillator(); osc.type='square';
  osc.frequency.value = accented ? 1800 : 1100;
  const g=audioCtx.createGain();
  g.gain.setValueAtTime(accented ? 0.5 : 0.3, time);
  g.gain.exponentialRampToValueAtTime(0.001, time+0.045);
  osc.connect(g).connect(master); // direkt auf master, kein Hall/Delay-Send
  osc.start(time); osc.stop(time+0.06);
}

function scheduleStep(step,time){
  if(metronomeClickEnabled && step%4===0) playMetronomeClick(time, step%16===0);
  const anySolo=TRACKS.some(t=>t.solo);
  const fillWindowStart=PATTERN_LENGTH-activeFillLength;
  const inFillWindow = currentLoopIsFill && fillOverride && step>=fillWindowStart;
  transportEmit('step',{step,time,isFill:inFillWindow,abs:curAbsStep});
  TRACKS.forEach(tr=>{
    let v, art=0;
    if(inFillWindow && fillOverride[tr.id]){
      v = fillOverride[tr.id].vel[step-fillWindowStart];
    } else if(tr.type==='arp'){
      v = evStarts(tr,step).length ? 1 : 0;
    } else {
      const si=stepInfo(tr,step); v=si.v; art=si.note|0;
    }
    if(v<=0) return;
    if(anySolo && !tr.solo) return;          // andere Spuren stumm, solange irgendwo soliert wird
    if(!anySolo && tr.muted) return;          // normales Mute nur wirksam, wenn kein Solo aktiv ist

    // ---- Feel (systematischer Push/Pull pro Spur) + Humanize (zufälliger Jitter) ----
    // Feel: bewusster, fester Zeitversatz (ms) — z. B. Snare leicht hinter dem Beat für
    // ein "laid back"-Gefühl, oder Kick leicht davor für mehr Drive.
    // Humanize: kleine zufällige Timing- UND Lautstärke-Schwankung pro Hit, simuliert
    // die Unregelmäßigkeit eines echten Schlagzeugers. Wirkt nur auf die Wiedergabe,
    // nicht auf die im Pattern gespeicherte Velocity-Stufe (die bleibt unangetastet).
    const feelSec=(tr.feel||0)/1000;
    const jitterSec = humanize>0 ? (Math.random()*2-1)*0.012*humanize : 0; // bis zu ±12ms bei voller Stärke
    const hitTime = time + feelSec + jitterSec;
    const playVel = humanize>0
      ? Math.max(0.05, Math.min(1.5, v*(1 + (Math.random()*2-1)*0.12*humanize)))
      : v;

    if(tr.type==='arp'){
      evPlay(tr, step, hitTime, humanize>0 ? (1+(Math.random()*2-1)*0.12*humanize) : 1, curAbsStep);
    } else if(inFillWindow && fillOverride[tr.id] && fillOverride[tr.id].chokeSteps && fillOverride[tr.id].chokeSteps[step-fillWindowStart]){
      triggerChokedCrash(hitTime, tr, playVel); // kurz abgeschnittener statt lang ausklingender Crash
    } else {
      triggerTrack(tr, hitTime, playVel, art);
    }
  });
}
function scheduler(){
  // Hing der Hauptthread länger fest, liegen Steps schon in der Vergangenheit:
  // nicht als Schwall nachspielen, sondern still überspringen (Position bleibt).
  while(nextNoteTime < audioCtx.currentTime - 0.03){
    const swingOffset = (currentStep%2===1) ? stepDuration()*swing : 0;
    if(nextNoteTime + swingOffset >= audioCtx.currentTime) break;
    absStepCounter++;
    nextNoteTime += stepDuration();
    currentStep=(currentStep+1)%seqLength();
    if(currentStep===0) onLoopRestart();
  }
  while(nextNoteTime < audioCtx.currentTime + scheduleAheadTime){
    // Swing verschiebt NUR die Position der ungeraden (Off-Beat-)Steps nach
    // hinten — das Grund-Raster (nextNoteTime-Fortschritt) bleibt bei jedem
    // Step exakt gleich lang, damit sich die Gesamt-Pattern-Dauer/das Tempo
    // durch Swing nicht verändert (nur die Betonung innerhalb des Rasters).
    const swingOffset = (currentStep%2===1) ? stepDuration()*swing : 0;
    curAbsStep=absStepCounter;
    scheduleStep(currentStep, nextNoteTime + swingOffset);
    absStepCounter++;
    nextNoteTime += stepDuration();
    currentStep=(currentStep+1)%seqLength();
    if(currentStep===0) onLoopRestart();
  }
  if(!tickWorker) timerID=setTimeout(scheduler, lookahead);
}
function start(){
  Promise.resolve(initAudio()).then(()=>{
    if(audioCtx.state!=='running') audioCtx.resume();
    isPlaying=true; currentStep=0; nextNoteTime=audioCtx.currentTime+0.06;
    TRACKS.forEach(t=>{ t._arpHeld=false; });
    absStepCounter=0;
    loopCount=0; currentLoopIsFill=false; fillOverride=null;
    transportEmit('start');
    scheduler();
    if(tickWorker) tickWorker.postMessage(lookahead);
  });
}
function stop(){
  isPlaying=false; clearTimeout(timerID);
  if(tickWorker) tickWorker.postMessage(0);
  stopLoopingSampleTrack(); stopCosmicVoices();
  // Acid-Stimme: gehaltene (Slide-)Noten würden sonst weiterklingen; bereits eingeplante Events werden verworfen
  TRACKS.forEach(t=>{
    if(t._arpAmp && audioCtx){
      const n=audioCtx.currentTime;
      try{
        t._arpAmp.gain.cancelScheduledValues(n);
        t._arpAmp.gain.setValueAtTime(Math.max(0.0001, t._arpAmp.gain.value), n);
        t._arpAmp.gain.exponentialRampToValueAtTime(0.0008, n+0.05);
        t._arpAmp.gain.setTargetAtTime(0, n+0.05, 0.008);
      }catch(e){}
    }
    t._arpHeld=false;
  });
  transportEmit('stop');
}

// =========================================================================
// STANDARD-PATTERN
// =========================================================================
(function seedPattern(){
  const bd=TRACKS.find(t=>t.id==='bd'), sd=TRACKS.find(t=>t.id==='sd');
  const ch=TRACKS.find(t=>t.id==='ch'), oh=TRACKS.find(t=>t.id==='oh');
  [0,8].forEach(s=>bd.steps[s]=VEL_ACCENT); // Kick auf 1 und 3 als Accent, wie vorher
  [4,12].forEach(s=>sd.steps[s]=VEL_NORMAL);
  [0,2,4,6,8,10,12,14].forEach(s=>ch.steps[s]=VEL_NORMAL);
  ch.steps[6]=VEL_GHOST; // Beispiel-Ghost-Note zur Demonstration der neuen Stufen
  oh.steps[15]=VEL_NORMAL;
  TRACKS.forEach(tr=> tr._ovCells.forEach((c,s)=>updateStepVisual(c, tr.steps[s])));
  selectTrack(0);
  renderPageNav();
  renderLengthChips();
})();

// =========================================================================
// STANDARD-BEATS (optional, per default-beats.json) + "ZULETZT GEÖFFNET"
// =========================================================================
// localStorage statt IndexedDB für diese beiden kleinen Zustände — synchron
// verfügbar, kein eigener DB-Store nötig für zwei simple Werte.
const LAST_PATTERN_KEY='mrm44_lastPatternId';
function rememberLastPattern(id){
  try{ localStorage.setItem(LAST_PATTERN_KEY, id); } catch(err){ /* z.B. privater Modus ohne localStorage */ }
}

// Importiert ./default-beats.json (gleiches Format wie ein normaler Export)
// NUR, wenn noch überhaupt keine Beats gespeichert sind — also bei einer
// frischen Installation / einem neuen Gerät, nicht bei jedem Neustart.
// Bewusst so eingeschränkt: bei jedem Start neu zu importieren würde bei
// eigenen Änderungen an gleichnamigen Beats laufend Namenskonflikte /
// umbenannte Duplikate erzeugen. Wer die Datei später aktualisiert, nutzt
// weiterhin den bestehenden Import-Button im Beats-Fenster.
async function importDefaultBeatsIfEmpty(){
  try{
    const existing=await listPatternsFromIndexedDB();
    if(existing.length>0) return; // schon Beats vorhanden -> nichts tun
    const res=await fetch('./default-beats.json', {cache:'no-store'});
    if(!res.ok) return; // Datei existiert nicht — kein Fehler, einfach überspringen
    const parsed=await res.json();
    const incoming = Array.isArray(parsed) ? parsed
      : Array.isArray(parsed.patterns) ? parsed.patterns
      : (parsed && Array.isArray(parsed.tracks)) ? [parsed]
      : null;
    if(!incoming || incoming.length===0) return;
    for(const p of incoming){
      if(!p || !p.name || !Array.isArray(p.tracks)) continue;
      await savePatternToIndexedDB(Object.assign({}, p, { id:genId(), savedAt: p.savedAt || Date.now() }));
    }
  } catch(err){ console.warn('Standard-Beats konnten nicht geladen werden:', err); }
}

// Lädt beim Start den zuletzt geöffneten Beat (falls vorhanden), NACHDEM die
// Standard-Beats ggf. eingespielt wurden. Bleibt beim eingebauten Seed-Pattern,
// wenn es keinen "zuletzt geöffneten" Beat gibt oder er nicht mehr existiert
// (z.B. zwischenzeitlich gelöscht).
async function restoreLastOpenedOrSeed(){
  setCurrentLoadedPattern(null, 'Neuer Beat');
  await importDefaultBeatsIfEmpty();
  let lastId=null;
  try{ lastId=localStorage.getItem(LAST_PATTERN_KEY); } catch(err){ /* ignore */ }
  if(!lastId) return;
  try{
    const data=await loadPatternFromIndexedDB(lastId);
    if(data){ applyPatternData(data); setCurrentLoadedPattern(lastId, data.name); pbMarkClean(); }
  } catch(err){ console.warn('Zuletzt geöffneter Beat konnte nicht geladen werden:', err); }
}
