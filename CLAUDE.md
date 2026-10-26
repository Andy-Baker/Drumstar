# MRM-44 / Drumstar
Browser-Drum-Machine/Sequencer, Vanilla JS + Web Audio, eine `index.html` + `sw.js` (Service Worker). Gehostet via GitHub Pages. Sprache: Deutsch, knapp.

## Regeln
- Kein Framework, kein Build. Plain HTML/CSS/JS.
- Bei jedem Deploy `CACHE` in `sw.js` erhöhen (aktuell `mrm44-v59`).
- UI: erst interaktives Mockup (HTML), dann Umbau. Design braucht Platz; dunkles Chassis, blaue Controls, Instrumentfarben (Acid orange, Cosmic lila, Piano gelb, Sample grün, Drums blau, Perc türkis).
- Versionen über Git-Commits/Tags, nicht über Datei-Suffixe.

## Architektur-Kurzfassung
- Melodische Spuren (`type:'arp'`: arp=Acid, cosmic, piano) nutzen `tr.events=[{s,n,l,v,a,sl}]`; `tr.steps` ist abgeleitet (`evTouch`). `isPoly(tr)` = Cosmic/Piano (Akkorde, keine Slides), `trOct(tr)` = Oktavlage.
- Drums/Perc/Sample: `tr.steps`.
- Piano-Roll-Fenster `#prWin` (Bearbeiten + Spielen/Rec). Speicherformat `schemaVersion: 7`.
- Siehe `CHANGES-v54-v55.md`. Tests (Playwright, headless) liegen noch nicht im Repo.

## Offen
Piano-Klang hören/verbessern, Sample-Tasten, Mixer-Solo-Link, alten Tonhöhen-Editor entfernen.
