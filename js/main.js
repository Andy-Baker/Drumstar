"use strict";
// Start: läuft als letzte Datei, wenn alle Funktionen geladen sind.
setPatternGroup(patternGroup,false);
restoreSampleAssignments();
nbDefault=collectPatternData('Neuer Beat', null); // „Leer, Standard“ = Zustand beim ersten Start
restoreLastOpenedOrSeed().then(restoreLastSong);
// Versionsnummer im Fuß (aus dem ?v= der geladenen index.html = tatsächlich laufender Stand).
// Liegt eine neuere Version im Cache (Service Worker meldet „update-ready“), wird sie antippbar: neu laden.
(function(){
  const el=$id('appVer'); if(!el) return;
  const m=(document.querySelector('script[src*="?v="]')||{}).src; const v=m&&(m.match(/[?&]v=([^&]+)/)||[])[1];
  el.textContent=(v?'v'+v:'')+(OUT_MODE==='sauber'?' · Ausgang sauber':'');
  if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('message',e=>{
    if(!e.data || e.data.type!=='update-ready') return;
    el.textContent=(v?'v'+v+' · ':'')+'Update da, antippen'; el.classList.add('upd'); el.setAttribute('role','button');
    el.onclick=()=>location.reload();
  });
})();
