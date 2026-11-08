"use strict";
// =========================================================================
// TRANSPORT-ANZEIGE: Play-Taste, Metronom-Schalter, Abspielkopf (visualLoop),
// Piano-Roll-Sync. Hängt sich über transportOn() an die Engine (js/scheduler.js).
// =========================================================================
const playBtn=$id('playBtn');
playBtn.addEventListener('click', ()=> isPlaying ? stop() : start());

const tempoClickToggle=$id('tempoClickToggle');
tempoClickToggle.addEventListener('click', ()=>{
  metronomeClickEnabled=!metronomeClickEnabled;
  tempoClickToggle.classList.toggle('on', metronomeClickEnabled);
});

// Geplante Steps (im Voraus) → Warteschlange, visualLoop zeigt sie zur Audio-Zeit an.
let scheduledSteps=[];
transportOn('step', ev=>{ scheduledSteps.push(ev); });
transportOn('start', ()=>{
  pagePinned=false; renderPinChip(); scheduledSteps=[]; modVisAbs=0;
  playBtn.textContent='■'; playBtn.classList.add('playing'); prSyncPlay();
  requestAnimationFrame(visualLoop);
});
transportOn('stop', ()=>{
  pagePinned=false; renderPinChip();
  playBtn.textContent='▶'; playBtn.classList.remove('playing'); prSyncPlay(); prHidePh();
  document.querySelectorAll('.playcol').forEach(el=>el.classList.remove('playcol'));
});

let lastDisplayStep=-1;
function visualLoop(){
  if(!isPlaying) return;
  requestAnimationFrame(visualLoop);
  const now=audioCtx.currentTime;
  while(scheduledSteps.length && scheduledSteps[0].time<=now){
    const ev=scheduledSteps.shift();
    modVisAbs=ev.abs; updateAutoVisual();
    if(arrOn() && switchTabIsSong()) ovPlayhead(Math.floor(ev.step/16));
    const dstep=arrOn() ? ev.step%PATTERN_LENGTH : ev.step;
    if(dstep!==lastDisplayStep){
      const page=Math.floor(dstep/16), rel=dstep%16;
      // Beim Überschreiten einer Seitengrenze blättert die Ansicht automatisch mit,
      // damit der Playhead beim Abspielen längerer Patterns immer sichtbar bleibt.
      if(page!==currentPage && !pagePinned){
        currentPage=page;
        renderAllForPage();
        renderPageNav();
      }
      document.querySelectorAll('.playcol').forEach(el=>el.classList.remove('playcol'));
      if(page===currentPage){ TRACKS.forEach(tr=> trUi(tr).ovCells[rel].classList.add('playcol'));
      bigCells[rel].classList.add('playcol'); }
      if(page===currentPage && TRACKS[activeTrackIdx].steps[dstep]){
        bigCells[rel].classList.add('flash');
        setTimeout(()=>bigCells[rel].classList.remove('flash'),90);
      }
      { const on=page===currentPage, pp=document.querySelector('#prPv .pph');
        if(prIsOpen()) prPlayhead(dstep);
        if(pp){ pp.style.display=on?'block':'none'; pp.style.left=(rel/16*100)+'%'; } }
      lastDisplayStep=dstep;
    }
  }
}

// =========================================================================
// BOTTOM-TAB-BAR — scroll-richtungsabhängiges Ein-/Ausblenden. #panelMain ist
// selbst der scrollende Container (overflow-y:auto), daher hier gehorcht.
// Ausblenden nur ab einem kleinen Schwellwert (gegen Zittern bei Mini-Scrolls),
// an den beiden Scroll-Enden (ganz oben/unten) immer einblenden, damit die Bar
// nicht "verschwunden" wirkt, wenn gar nicht aktiv gescrollt wird.
// Verhalten ist bewusst IMMER gleich, auch während Song-Wiedergabe — keine
// Sonderfälle, um das Verhalten vorhersehbar zu halten.
(function initBottomTabBarScroll(){
  const panelMainEl=document.getElementById('panelMain');
  const bar=document.getElementById('bottomTabBar');
  if(!panelMainEl || !bar) return;
  let lastTop=panelMainEl.scrollTop, hidden=false;
  panelMainEl.addEventListener('scroll', ()=>{
    const top=panelMainEl.scrollTop;
    const delta=top-lastTop;
    const maxScroll=panelMainEl.scrollHeight-panelMainEl.clientHeight;
    if(top<=4 || top>=maxScroll-4){
      if(hidden){ hidden=false; bar.classList.remove('hidden'); }
    } else if(Math.abs(delta)>6){
      if(delta>0 && !hidden){ hidden=true; bar.classList.add('hidden'); }
      else if(delta<0 && hidden){ hidden=false; bar.classList.remove('hidden'); }
    }
    lastTop=top;
  }, {passive:true});
})();
