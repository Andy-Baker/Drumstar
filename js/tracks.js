"use strict";
// =========================================================================
// TRACK-DEFINITIONEN
// =========================================================================
const TRACKS=[
  {id:'bd', name:'BASS DRUM', color:'#3fa9ff', tune:0.5, vol:0.9},
  {id:'sd', name:'SNARE',     color:'#8fd4ff', tune:0.5, vol:0.85},
  {id:'ch', name:'HI-HAT',    color:'#e8f4ff', tune:0.5, vol:0.75},
  {id:'lt', name:'LOW TOM',   color:'#2f7fd4', tune:0.5, vol:0.8},
  {id:'ht', name:'HI TOM',    color:'#2f7fd4', tune:0.5, vol:0.8},
  {id:'rs', name:'RIM SHOT',  color:'#5eead4', tune:0.5, vol:0.8},
  {id:'hc', name:'HAND CLAP', color:'#2dd4bf', tune:0.5, vol:0.85},
  {id:'oh', name:'OP HIHAT',  color:'#c7e6ff', tune:0.5, vol:0.7},
  {id:'cy', name:'CRASH',     color:'#a3d8ff', tune:0.5, vol:0.7},
  {id:'rd', name:'RIDE',      color:'#b9dcff', tune:0.5, vol:0.7},
  {id:'cb', name:'COWBELL',  color:'#14b8a6', tune:0.5, vol:0.75},
  {id:'cl', name:'CLAVES',   color:'#99f6e4', tune:0.5, vol:0.7},
  {id:'mr', name:'MARACAS',  color:'#7ff0dc', tune:0.5, vol:0.65},
  {id:'mc', name:'MIC SAMPLE', color:'#8be86a', tune:0.5, vol:0.9, isSample:true},
  {id:'arp', name:'ACID BASS', color:'#ff6b35', tune:0.5, vol:0.8, type:'arp',
   rootNote:0, cutoff:0.5, resonance:0.35, envMod:0.5, decay:0.26, scale:'minor'},
  {id:'cosmic', name:'COSMIC', short:'COS', color:'#b88cff', tune:0.5, vol:0.68, type:'arp',
   rootNote:0, cutoff:0.62, resonance:0.22, envMod:0.62, decay:0.42, scale:'minor', reverbAmount:0.24, delaySend:0.28, cosmicWidth:0.62, cosmicMotion:0.46, cosmicWarmth:0.22, cosmicAir:0.18},
  {id:'piano', name:'KEYS', short:'KEY', sound:'piano', tremolo:0, color:'#ffd166', tune:0.5, vol:0.8, type:'arp',
   rootNote:0, cutoff:0.55, resonance:0.2, envMod:0.5, decay:0.5, scale:'minor', reverbAmount:0.18, delaySend:0},
];
TRACKS.forEach(t=>{ t._def={vol:t.vol, tune:t.tune, reverbAmount:t.reverbAmount||0, delaySend:t.delaySend||0}; }); // Standardwerte je Spur (Zurücksetzen im Klang-Sheet)
TRACKS.forEach(t=>{ if(t.type==='arp') t._snd0=Object.assign({},t); }); // Melodiespur ab Werk (Laden eines Patterns ohne diese Spur)
// steps[s] speichert die Velocity eines Steps direkt als Zahl:
// 0 = aus, 0.15 = Ghost soft (sehr leise), 0.35 = Ghost, 0.85 = Normal, 1.3 = Accent.
// Ersetzt das alte reine An/Aus + globalen Accent-Layer durch echte
// Per-Step/Per-Track-Dynamik (näher an DAW-Velocity als am alten Modell).
const VEL_OFF=0, VEL_GHOST_SOFT=0.15, VEL_GHOST=0.35, VEL_NORMAL=0.85, VEL_ACCENT=1.3;
function velClass(v){
  if(v===VEL_OFF) return '';
  if(v===VEL_GHOST_SOFT) return 'vel-ghost-soft';
  if(v===VEL_GHOST) return 'vel-ghost';
  if(v===VEL_ACCENT) return 'vel-accent';
  return 'vel-normal';
}
// Pattern-Länge: statt fix 16 Steps kann ein Pattern 16/32/48/64 Steps lang sein.
// Editiert wird weiterhin in 16er-"Seiten" im bestehenden Grid (kein horizontales
// Scrollen), der Player blättert beim Abspielen automatisch mit.
let PATTERN_LENGTH=16;
let currentPage=0; // 0-indexiert; Seite deckt absolute Steps [page*16, page*16+16) ab
function totalPages(){ return PATTERN_LENGTH/16; }

// =========================================================================
// FILL-IN — am Ende jedes N-ten Pattern-Durchlaufs wird das letzte Stück des
// Patterns (einstellbare Länge) durch eine frisch generierte Variation ersetzt,
// statt die programmierten Steps zu spielen. Rein zur Wiedergabezeit — das
// eigentliche Pattern bleibt unverändert, nur der Klang für diesen einen
// Durchlauf wird überschrieben.
// =========================================================================
let fillEnabled=true;
let fillLengthSteps=4;   // wie viele Steps am Ende des Patterns ersetzt werden (Live-Einstellung)
let fillEveryN=4;        // alle wie viele Durchläufe ein Fill ausgelöst wird
let fillIntensity=0.5;   // 0..1 — steuert Dichte, Akzent-Häufigkeit und Zwischen-Crashes im Fill
let loopCount=0;
let currentLoopIsFill=false;
let fillOverride=null;   // { trackId: {vel:[...]} } — nur für den aktuellen Fill-Durchlauf gültig
let activeFillLength=0;  // beim Auslösen eingefrorene Fensterlänge — verhindert Inkonsistenz,
                          // falls fillLengthSteps während eines laufenden Fills live geändert wird

// Welche Fill-Stile beim Zufalls-Ziehen überhaupt infrage kommen — einzeln
// an/abschaltbar, damit man gezielt ausprobieren kann, was musikalisch am
// besten passt (z. B. nur "Linear" testen, oder "Sparse" mal ausschließen).
const FILL_STYLE_INFO=[
  {id:'linear', label:'Linear'},
  {id:'rollDense', label:'Roll'},
  {id:'buildUp', label:'Aufbau'},
  {id:'snareBurst', label:'Snare'},
  {id:'alternateToms', label:'Wechsel'},
  {id:'sparse', label:'Sparse'},
  {id:'oneDrop', label:'One Drop'},
  {id:'chokeCrash', label:'Choke'},
];
const fillStyleEnabled={ linear:true, rollDense:true, buildUp:true, snareBurst:true, alternateToms:true, sparse:true, oneDrop:true, chokeCrash:true };

// Wird aufgerufen, sobald der Scheduler wieder bei Step 0 beginnt (neuer Durchlauf).
function onLoopRestart(){
  loopCount++;
  currentLoopIsFill = !arrOn() && fillEnabled && (loopCount % fillEveryN === 0) && fillLengthSteps <= PATTERN_LENGTH;
  if(currentLoopIsFill){
    activeFillLength = fillLengthSteps; // für diesen Durchlauf fest — Live-Änderungen wirken erst ab dem nächsten
    fillOverride = generateFillOverride(activeFillLength);
  } else {
    activeFillLength = 0;
    fillOverride = null;
  }
}
// Musikalisch orientierter Fill-Generator: wählt bei jedem Auslösen zufällig
// einen von sechs klanglich klar unterscheidbaren Fill-Stilen. Die Intensität
// (Regler im Fill-Panel) steuert bei allen Stilen gemeinsam Dichte, Akzent-
// Häufigkeit und wie oft das Crash-Becken auch MITTEN im Fill einstreut,
// nicht nur als fixer Übergangs-Marker am letzten Step. "Linear" ist der von
// echten Drummern oft gespielte Stil: nie zwei Instrumente gleichzeitig,
// stattdessen wandert der Fill von einer Trommel/einem Becken zur nächsten.
// Hi-Hat pausiert bei allen Stilen, Acid-Bass bleibt unangetastet.
function generateFillOverride(len){
  const enabledStyles=FILL_STYLE_INFO.map(s=>s.id).filter(id=>fillStyleEnabled[id]);
  const styles=enabledStyles.length>0 ? enabledStyles : FILL_STYLE_INFO.map(s=>s.id); // Sicherheitsnetz: falls doch mal alle aus sind
  const style=styles[Math.floor(Math.random()*styles.length)];
  const intensity=fillIntensity; // 0..1
  const override={};
  const set=(id,vel)=>{ override[id]={vel}; };

  const lt=new Array(len).fill(VEL_OFF), ht=new Array(len).fill(VEL_OFF);
  const sd=new Array(len).fill(VEL_OFF), rs=new Array(len).fill(VEL_OFF);
  const bd=new Array(len).fill(VEL_OFF), hc=new Array(len).fill(VEL_OFF);
  const cy=new Array(len).fill(VEL_OFF);
  const chokeSteps=new Array(len).fill(false); // welche Crash-Treffer kurz abgestoppt statt ausklingen sollen
  cy[len-1]=VEL_ACCENT; // garantierter Übergangs-Crash, in jedem Stil gleich

  // Wie oft das Crash-Becken zusätzlich MITTEN im Fill als Akzent einstreut,
  // statt nur als Schluss-Marker — bei niedriger Intensität selten, bei hoher üblich.
  const midCrashChance = 0.08 + intensity*0.3;
  const sprinkleMidCrash=(s)=>{ if(s<len-1 && Math.random()<midCrashChance) cy[s]=VEL_NORMAL; };

  if(style==='linear'){
    // Klassischer "linearer" Fill: nie zwei Instrumente auf demselben Step,
    // der Fill wandert von Trommel zu Trommel statt gestapelter Treffer.
    // Crash darf hier NUR auf Pause-Steps einstreuen — sonst würde er sich
    // mit dem gerade gesetzten Trommel-Hit überlagern und das "linear"-
    // Versprechen (immer nur ein Instrument pro Step) brechen.
    const pool=[lt,ht,sd]; // Fill steuert nur Drums (Perc bleibt unberührt)
    let lastTrack=null;
    for(let s=0;s<len-1;s++){ // letzter Step bleibt für den Übergangs-Crash reserviert
      const restChance=0.34-intensity*0.28;
      if(Math.random()<restChance){ sprinkleMidCrash(s); continue; }
      let choices=pool.filter(t=>t!==lastTrack);
      const track=choices[Math.floor(Math.random()*choices.length)];
      const accentChance=0.16+intensity*0.4;
      track[s]=Math.random()<accentChance?VEL_ACCENT:VEL_NORMAL;
      lastTrack=track;
    }
  } else if(style==='rollDense'){
    // Durchgehender Tom-Wirbel über beide Toms, Dichte/Accent-Chance skaliert mit Intensität
    for(let s=0;s<len;s++){
      const track = s%2===0 ? lt : ht;
      track[s] = Math.random()<(0.2+intensity*0.4) ? VEL_ACCENT : VEL_NORMAL;
      sprinkleMidCrash(s);
    }
  } else if(style==='buildUp'){
    // Startet sparse, wird zum Ende hin dichter — klassischer Spannungsaufbau
    for(let s=0;s<len;s++){
      const density=((s+1)/len) * (0.7+intensity*0.6);
      if(Math.random()<density){
        const track = s<len/2 ? lt : ht;
        track[s] = (s===len-1 || Math.random()<intensity*0.5) ? VEL_ACCENT : VEL_NORMAL;
      }
      if(s>len*0.6) sprinkleMidCrash(s); // Crash-Einstreuung erst in der zweiten Hälfte, passend zum Aufbau
    }
  } else if(style==='snareBurst'){
    // Nur Snare, gerne mit Ghost-Notes dazwischen — Snare-Roll-Charakter
    for(let s=0;s<len;s++){
      const r=Math.random();
      sd[s] = r<(0.3+intensity*0.35) ? VEL_ACCENT : (r<0.75 ? VEL_NORMAL : VEL_GHOST);
    }
  } else if(style==='alternateToms'){
    // Low/High-Tom im klaren Wechsel, Dichte skaliert mit Intensität
    for(let s=0;s<len;s++){
      if(s%2===0 || Math.random()<intensity*0.5) (s%4===0?lt:ht)[s]=VEL_NORMAL;
    }
    if(len>=4) sd[len-2]=VEL_ACCENT; // kleiner Snare-Akzent kurz vorm Übergang
  } else if(style==='oneDrop'){
    // Reggae/Dancehall-inspiriert: Kick und Snare treffen GEMEINSAM auf einem
    // späten, betonten Punkt statt eines Wirbels — bewusste Leere drumherum
    // ist hier der Punkt, nicht Dichte. Klassisches "Space"-Feeling.
    const dropStep=Math.max(0, len-Math.ceil(len/3));
    bd[dropStep]=VEL_ACCENT; sd[dropStep]=VEL_ACCENT;
    if(dropStep>0 && Math.random()<0.3+intensity*0.3) sd[dropStep-1]=VEL_GHOST; // leiser Vorschlag
    if(Math.random()<0.25+intensity*0.4) cy[dropStep]=VEL_ACCENT; // Crash optional zusammen mit dem Drop
  } else if(style==='chokeCrash'){
    // Zusammengespielte Akzente aus Crash + Kick/Snare, das Becken wird dabei
    // "abgestoppt" statt auszuklingen — markiert gezielte Punktuierungen.
    // Intensität bestimmt, wie viele solcher Punktuierungen im Fill sitzen.
    const hitCount=1+Math.round(intensity*2); // 1..3
    for(let i=0;i<hitCount;i++){
      const s=Math.min(len-2, Math.floor((i+1)*len/(hitCount+1))); // letzter Step bleibt dem Übergangs-Crash vorbehalten
      if(s<0) continue;
      cy[s]=VEL_ACCENT; chokeSteps[s]=true;
      if(Math.random()<0.6) bd[s]=VEL_NORMAL; else sd[s]=VEL_NORMAL; // abwechselnd mit Kick oder Snare kombiniert
    }
  } else { // 'sparse'
    // Wenige, dafür druckvolle Treffer statt eines Wirbels — Kick+Snare-Kombi
    for(let s=0;s<len;s++){
      if(Math.random()<(0.3+intensity*0.35)){ sd[s]=VEL_ACCENT; }
      if(s===len-1) bd[s]=VEL_NORMAL;
    }
  }

  // Rollen statt fester IDs (#2): Kick/Snare/Crash = erste Zeile der Rolle, Toms = erste und zweite Tom-Zeile
  // (nur eine Tom-Zeile → beide Teile dorthin, keine → entfallen). Hi-Hats + Ride pausieren immer.
  const put=(tr,vel,extra)=>{ if(!tr) return; const o=override[tr.id];
    if(o){ o.vel=o.vel.map((v,i)=>Math.max(v,vel[i])); if(extra) Object.assign(o,extra); } else override[tr.id]=Object.assign({vel},extra||{}); };
  const toms=roleTracks('tom');
  put(toms[0],lt); put(toms[1]||toms[0],ht); put(roleTracks('snare')[0],sd); put(roleTracks('kick')[0],bd);
  put(roleTracks('crash')[0],cy,{chokeSteps});
  ['hat','openhat','ride'].forEach(r=>roleTracks(r).forEach(t=>{ if(!override[t.id]) set(t.id,new Array(len).fill(VEL_OFF)); }));
  return override;
}
// Passt alle Track-Step-Arrays auf eine neue Länge an (behält vorhandene Steps,
// füllt neue mit "aus", kürzt überschüssige beim Verkleinern).
function setPatternLength(newLen){
  if(newLen===PATTERN_LENGTH) return;
  if(typeof taSnapshot==='function') taSnapshot();
  if(isPlaying) stop();
  const PATTERN_LENGTH_PREV=PATTERN_LENGTH;
  PATTERN_LENGTH=newLen;
  currentLoopIsFill=false; fillOverride=null; loopCount=0; // Sicherheit: alte Fill-Daten passen sonst nicht mehr zur neuen Länge
  TRACKS.forEach(tr=>{
    if(tr.type==='arp'){
      const cut=list=>list.filter(e=>e.s<newLen).map(e=>e.s+e.l>newLen?Object.assign({},e,{l:newLen-e.s}):e);
      if(tr.harmOwn) tr.harmOwn=cut(tr.harmOwn);
      tr.events=cut(tr.events); evTouch(tr); return;
    }
    const old=tr.steps, oldNotes=tr.notes, oldSlides=tr.slides;
    const resized=new Array(newLen).fill(VEL_OFF);
    const resizedNotes=new Array(newLen).fill(0);
    const resizedSlides=new Array(newLen).fill(false);
    for(let i=0;i<Math.min(old.length,newLen);i++){
      resized[i]=old[i]; resizedNotes[i]=oldNotes[i]; resizedSlides[i]=oldSlides[i];
    }
    tr.steps=resized; tr.notes=resizedNotes; tr.slides=resizedSlides;
  });
  { const oldLen=PATTERN_LENGTH_PREV, base=harmony.chords.filter(c=>c.step<oldLen); // Akkordfolge: beim Verlängern wiederholen, beim Kürzen abschneiden
    if(newLen>oldLen && base.length) for(let k=1;k*oldLen<newLen;k++) base.forEach(c=>{ if(c.step+k*oldLen<newLen) harmony.chords.push(Object.assign({},c,{step:c.step+k*oldLen})); });
    harmony.chords=harmony.chords.filter(c=>c.step<newLen).map(c=>c.step+c.len>newLen?Object.assign({},c,{len:newLen-c.step}):c); }
  TRACKS.forEach(tr=>hmRegen(tr));
  currentPage=0;
  renderLengthChips();
  renderPageNav();
  renderAllForPage();
}
// Aktualisiert Overview (alle Spuren) + großes Grid (aktive Spur) für die aktuelle Seite
function renderAllForPage(){
  TRACKS.forEach(tr=>{
    for(let s=0;s<16;s++) updateStepVisual(trUi(tr).ovCells[s], tr.steps[currentPage*16+s]);
  });
  renderBigGrid();
}
TRACKS.forEach(tr=>{
  tr.steps=new Array(PATTERN_LENGTH).fill(VEL_OFF);
  if(tr.type==='arp'){ tr.events=[]; } // Noten-Events (siehe evTouch); tr.steps ist hier nur abgeleitet
  else { tr.notes=new Array(PATTERN_LENGTH).fill(0); tr.slides=new Array(PATTERN_LENGTH).fill(false); } // unbenutzt, nur für Altcode
});
let activeTrackIdx=0;
