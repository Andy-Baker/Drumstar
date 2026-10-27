# MRM-44 / Drumstar
Browser-Drum-Machine/Sequencer, Vanilla JS + Web Audio, eine `index.html` + `sw.js` (Service Worker). Gehostet via GitHub Pages. Sprache: Deutsch, knapp.

## Regeln
- Kein Framework, kein Build. Plain HTML/CSS/JS.
- Bei jedem Deploy `CACHE` in `sw.js` erhöhen (aktuell `mrm44-v62`).
- UI: erst interaktives Mockup (HTML), dann Umbau. Design braucht Platz; dunkles Chassis, blaue Controls, Instrumentfarben (Acid orange, Cosmic lila, Piano gelb, Sample grün, Drums blau, Perc türkis).
- Versionen über Git-Commits/Tags, nicht über Datei-Suffixe.

## Architektur-Kurzfassung
- Melodische Spuren (`type:'arp'`: arp=Acid, cosmic, piano) nutzen `tr.events=[{s,n,l,v,a,sl}]`; `tr.steps` ist abgeleitet (`evTouch`). `isPoly(tr)` = Cosmic/Piano (Akkorde, keine Slides), `trOct(tr)` = Oktavlage.
- Drums/Perc/Sample: `tr.steps`.
- Piano-Roll-Fenster `#prWin` (Bearbeiten + Spielen/Rec); im Hauptfenster zeigen arp-Spuren nur die Vorschau `#prPreview` (`renderEditorArea`). Der alte Tonhöhen-Editor ist seit v61 entfernt. Speicherformat `schemaVersion: 7`.
- Harmonie (v62, ersetzt den Arpeggio-Generator): einklappbare Karte `#hmPanel` auf der Pattern-Seite. `harmony={key,chords}` gilt pro Pattern für alle Spuren; `tr.harm` = Spielweise pro Spur (`off|chord|chordbass|root|arp`, Acid ohne Akkord-Modi). Folgt eine Spur, liegen die eigenen Noten in `tr.harmOwn` und `tr.events` enthält die erzeugten (`e.h=1`) — Wiedergabe/Export/Vorschau brauchen keinen Sonderfall. Speichern: `trOwnEvents(tr)` + `harm` + `harmony`. Erzeugte Note in der Piano Roll anfassen = `hmConvert` (Spur bekommt eigene Noten, Undo per Toast). Zufall deterministisch über `tr.harm.seed`.
- Siehe `CHANGES-v54-v55.md`. Tests (Playwright, headless) liegen noch nicht im Repo.

## Offen
Piano/Rhodes-Klang hören/verbessern, Orgel + Sample-Tasten im Roll-Fenster, Mixer-Solo-Link.

## Langfristig
Spuren frei hinzufügen (Schichten, mehrere Keys-Spuren; Sound pro Spur über `tr.sound`). Zurückgestellt, erst Keys-Klang fine-tunen. Mockup: add-track-mockup.html (Chat). Größter Aufwand: Spuren sind fest in TRACKS/ARR_GROUPS verdrahtet.
