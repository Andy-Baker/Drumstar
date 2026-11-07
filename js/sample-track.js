"use strict";
// =========================================================================
// TRANSPORT-AKTIONEN
// =========================================================================
// Generiert ein neues Zufalls-Pattern für EINE Spur — genutzt vom globalen
// Random-Button (über alle Nicht-Arp-Spuren) und vom Pro-Spur-🎲-Button.
function randomizeTrackPattern(tr, from=0, to=PATTERN_LENGTH){
  if(tr.type==='arp'){ generateAcidBassline(tr, from, to); return; }
  for(let s=from;s<to;s++){
    const beatPos = s%16; // Rhythmus-Gewichtung bleibt pro Takt (16 Steps) gleich
    const role=trRole(tr); // nach Rolle statt fester ID (#2)
    const p = role==='kick'? (beatPos%4===0?0.85:0.12) :
              role==='snare'? (beatPos%8===4?0.9:0.05) :
              role==='hat'? 0.55 :
              role==='ride'? (beatPos%2===0?0.8:0.15) : 0.12;
    const hit=Math.random()<p;
    // gelegentlich ein Ghost-Note statt vollem Hit für lebendigere Zufalls-Patterns
    tr.steps[s]= hit ? (Math.random()<0.15 ? VEL_GHOST : VEL_NORMAL) : VEL_OFF;
    if(tr.notes) tr.notes[s]= (trVoice(tr)==='rd' && hit && beatPos%4===0 && Math.random()<0.25) ? 1 : 0; // Ride: ab und zu Bell auf der Zählzeit
  }
}
// =========================================================================
// MIC-SAMPLE-SPUR — Wiedergabe. Aufnahme/Import/Bearbeitung laufen jetzt zentral
// über den Sample-Editor (s. u.); sampleBuffer bleibt hier der In-Memory-Cache
// des aktuell zugewiesenen Bibliothekseintrags, exakt wie vorher für triggerTrack().
// =========================================================================
const MAX_REC_SECONDS=4;
let micStream=null;
let sampleTrackSampleId=null; // welcher Bibliothekseintrag ist der Sample-Spur zugeordnet

const recBtn=document.getElementById('recBtn');
const recStatus=document.getElementById('recStatus');
const sampleClearBtn=document.getElementById('sampleClearBtn');
const samplePreviewBtn=document.getElementById('samplePreviewBtn');
const trimBtn=document.getElementById('trimBtn');

function updateRecStatus(){
  if(sampleBuffer){
    scStatusRow.style.display='flex';
    recStatus.textContent='● Sample gespeichert';
    recStatus.classList.add('has'); recStatus.classList.remove('err');
    recDur.style.display=''; recDur.textContent=sampleBuffer.duration.toFixed(1)+'s';
    scBtnsRow.style.display='flex';
    scHint.style.display='none';
    recBtn.textContent='● Neu aufnehmen / bearbeiten';
    recBtn.classList.remove('big');
  } else {
    const inIframe=(()=>{ try{ return window.self!==window.top; }catch(e){ return true; } })();
    scStatusRow.style.display='none';
    scBtnsRow.style.display='none';
    scHint.style.display='';
    scHint.textContent = inIframe ? 'Vorschau blockiert das Mikrofon' : 'Kein Sample gespeichert — Button antippen zum Aufnehmen';
    if(inIframe) recBtn.title='In dieser Vorschau blockiert — Datei herunterladen & lokal öffnen';
    recBtn.textContent='● Aufnehmen (max. 4s)';
    recBtn.classList.add('big');
  }
}

async function ensureMicStream(){
  // Android beendet den Mikro-Track manchmal (Hintergrund, Rechte) → dann neu holen statt Stille aufzunehmen
  if(micStream && micStream.getAudioTracks().some(t=>t.readyState==='live')) return micStream;
  micStream = await navigator.mediaDevices.getUserMedia({
    audio:{ echoCancellation:false, noiseSuppression:false, autoGainControl:false }
  });
  return micStream;
}

function micErrorMessage(err){
  const inIframe = (()=>{ try{ return window.self!==window.top; }catch(e){ return true; } })();
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    return inIframe ? 'Vorschau blockiert Mikro' : 'Browser unterstützt kein Mic-Recording';
  }
  switch(err && err.name){
    case 'NotAllowedError':
      return inIframe ? 'Vorschau blockiert Mikro' : 'Zugriff abgelehnt — Browser-Einstellungen prüfen';
    case 'NotFoundError':
      return 'Kein Mikrofon gefunden';
    case 'NotReadableError':
      return 'Mikro von anderer App belegt';
    case 'SecurityError':
      return 'Nur über HTTPS/localhost möglich';
    default:
      return inIframe ? 'Vorschau blockiert Mikro' : 'Mikro-Zugriff fehlgeschlagen';
  }
}

// Öffnet den zentralen Sample-Editor statt wie vorher direkt inline aufzunehmen —
// Aufnehmen/Laden/Bearbeiten/Zuweisen passiert jetzt an einer einzigen Stelle.
recBtn.addEventListener('click', ()=> openSampleEditor({sampleId:sampleTrackSampleId, forTrack:true}));
trimBtn.addEventListener('click', ()=> openSampleEditor({sampleId:sampleTrackSampleId, forTrack:true}));
samplePreviewBtn.addEventListener('click', ()=>{
  if(!sampleBuffer) return;
  Promise.resolve(initAudio()).then(()=>{
    if(audioCtx.state!=='running') audioCtx.resume();
    triggerTrack(TRACKS.find(t=>t.isSample), audioCtx.currentTime, VEL_NORMAL);
  });
});
// Hebt nur die Zuordnung der Sample-Spur auf — der Bibliothekseintrag selbst bleibt
// erhalten (könnte noch an Pads zugewiesen sein) und lässt sich im Sample-Editor
// jederzeit wieder zuweisen, statt unwiderruflich gelöscht zu werden.
sampleClearBtn.addEventListener('click', ()=>{
  sampleBuffer=null; sampleStartOffset=0; sampleTrackSampleId=null;
  try{ localStorage.removeItem('mrm44_sampleTrackId'); }catch(e){}
  updateRecStatus();
});

// ---- WAV-Encoding (für IndexedDB-Speicherung als Blob) ----
function audioBufferToWavBlob(buffer){
  const numCh=buffer.numberOfChannels, sr=buffer.sampleRate, len=buffer.length;
  const bytesPerSample=2, blockAlign=numCh*bytesPerSample;
  const dataSize=len*blockAlign;
  const ab=new ArrayBuffer(44+dataSize);
  const dv=new DataView(ab);
  const writeStr=(o,s)=>{ for(let i=0;i<s.length;i++) dv.setUint8(o+i,s.charCodeAt(i)); };
  writeStr(0,'RIFF'); dv.setUint32(4,36+dataSize,true); writeStr(8,'WAVE');
  writeStr(12,'fmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true);
  dv.setUint16(22,numCh,true); dv.setUint32(24,sr,true);
  dv.setUint32(28,sr*blockAlign,true); dv.setUint16(32,blockAlign,true); dv.setUint16(34,16,true);
  writeStr(36,'data'); dv.setUint32(40,dataSize,true);
  let off=44;
  const chans=[]; for(let c=0;c<numCh;c++) chans.push(buffer.getChannelData(c));
  for(let i=0;i<len;i++){
    for(let c=0;c<numCh;c++){
      const s=Math.max(-1,Math.min(1,chans[c][i]));
      dv.setInt16(off, s<0? s*0x8000 : s*0x7fff, true); off+=2;
    }
  }
  return new Blob([ab],{type:'audio/wav'});
}
