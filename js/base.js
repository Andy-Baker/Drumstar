"use strict";
// v65: gemeinsame SVG-Icons für Listen, Pads, Song
const UI_IC={ play:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" stroke="none"/></svg>', more:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>', dup:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>', split:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6"/><path d="M17 15l3 3-3 3"/></svg>', ren:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/></svg>', dl:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>', del:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>', snd:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9a4 4 0 0 1 0 6"/></svg>', dice:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2" fill="currentColor"/><circle cx="15" cy="15" r="1.2" fill="currentColor"/></svg>', trim:'<svg class="uic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/></svg>' };

// Drum-Spuren (#68): gleiche Sorte Spur, mehrfach. Jede hat eigene Zeilen und ein eigenes Kit (kit) bzw. eigenes Set (set).
// kind = Art der Spur (eigene Sets gehören zu einer Art). fill = Fill-Taste. Zeilen-IDs sind (noch) global eindeutig (#13).
const DRUM_TRACKS=[
  {id:'drums', kind:'drums', name:'DRUMS', rows:['bd','sd','ch','oh','lt','ht','cy','rd'], fill:true,
   kitT:'Drum-Kit', ownT:'Eigene Drum-Sets', newT:'＋ Neues Drum-Set aus dem aktuellen Kit', setT:'Drum-Set', kit:'rock', set:{id:null,name:null,dirty:false}},
  {id:'perc',  kind:'perc',  name:'PERC',  rows:['rs','hc','cb','cl','mr'], fill:false,
   kitT:'Perc-Kit', ownT:'Eigene Perc-Kits', newT:'＋ Neues Perc-Kit aus dem aktuellen Kit', setT:'Perc-Kit', kit:'rock', set:{id:null,name:null,dirty:false}}];
const ROW_DT={}; DRUM_TRACKS.forEach(d=>d.rows.forEach(r=>ROW_DT[r]=d));
const dtById=id=>DRUM_TRACKS.find(d=>d.id===id)||null;
// Weitere Drum-/Perc-Spuren (#70): Zeile „bd_2“ = Stimme „bd“ in der Spur drums2. rowBase = Stimme ab Werk der Zeile
// (Rolle, Kit-Belegung, Spielweisen, eigene Sets und Beats rechnen damit), ROW_DT ordnet die Zeile ihrer Spur zu.
const rowBase=id=>id.replace(/_\d+$/,'');
const DT_MAX_EXTRA=3; // zusätzliche Drum-/Perc-Spuren (Handy-Last, Speicher der Sample-Kits)
const dtOfRow=id=>ROW_DT[id]||DRUM_TRACKS[0];

// Kurzform für document.getElementById (wird schon beim Laden gebraucht, daher hier)
function $id(id){ return document.getElementById(id); }
