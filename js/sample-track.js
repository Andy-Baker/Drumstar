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
// MIKROFON — Zugriff für Sample-Editor (Aufnahme) und Tempo erkennen. Die frühere SAMPLE-Spur
// ist seit #8 durch den Sampler ersetzt (js/sampler.js).
// =========================================================================
const MAX_REC_SECONDS=4;
let micStream=null;

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
