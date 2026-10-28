# MRM-44 / Drumstar
Browser-Drum-Machine/Sequencer, Vanilla JS + Web Audio, eine `index.html` + `sw.js` (Service Worker). Gehostet via GitHub Pages. Sprache: Deutsch, knapp.

## Regeln
- Kein Framework, kein Build. Plain HTML/CSS/JS.
- Bei jedem Deploy `CACHE` in `sw.js` erhöhen (aktuell `mrm44-v71`).
- UI: erst interaktives Mockup (HTML), dann Umbau. Design braucht Platz; dunkles Chassis, blaue Controls, Instrumentfarben (Acid orange, Cosmic lila, Piano gelb, Sample grün, Drums blau, Perc türkis).
- Versionen über Git-Commits/Tags, nicht über Datei-Suffixe.
- Tests gehören ins Repo (`tests/`), nie nur ins Claude-Projekt. Neue oder geänderte Tests immer mit committen und pushen.

## Architektur-Kurzfassung
- Melodische Spuren (`type:'arp'`: arp=Acid, cosmic, piano) nutzen `tr.events=[{s,n,l,v,a,sl}]`; `tr.steps` ist abgeleitet (`evTouch`). `isPoly(tr)` = Cosmic/Piano (Akkorde, keine Slides), `trOct(tr)` = Oktavlage.
- Drums/Perc/Sample: `tr.steps`.
- Noteneditor `#prWin` (v64, nach Mockup v3): Kopf `#prTop` (Zurück · Instrument · Klang · Optionen), Werkzeug `#prTool` (Modus · Zoom · Alles zeigen · Undo), Raster `#prView`/`#prCv` über das ganze Pattern mit Zoom/Scroll pro Spur (`tr._prv`), Fuß `#prFoot` = Transport bzw. Notenleiste der Auswahl; Querformat: alles in `#prLand`. Klaviatur mit Übersichtsleiste (`tr._prk`). Buttons per `data-pa`/`data-pm`. Im Hauptfenster zeigen arp-Spuren nur die Vorschau `#prPreview` (`renderEditorArea`). Speicherformat `schemaVersion: 7`.
- Klang-Sheet `#klSheet` (`openKlang`): ein Einstieg für alle Spuren; Melodiespuren mit Reitern Sound / Mix & FX / Tonart (Grundton + Skala), Drums/Perc/Sample nur Mix + Tune.
- UI-Einheitlichkeit (v65): Overlays mit Kopf `.ovt` + ✕-Kasten; Icons als SVG (`UI_IC` am Skriptanfang, CSS `.uic`), keine Emojis in Buttons. Beat-Zeilen über `prowFinish` (▶ + ⋯ mit benannten Aktionen). Mixer: Master in eigener Spalte `#mixerMaster`, Fader-Höhe über `--fh` (`mixerFit`).
- Harmonie (v62, ersetzt den Arpeggio-Generator): einklappbare Karte `#hmPanel` auf der Pattern-Seite. `harmony={key,chords}` gilt pro Pattern für alle Spuren; `tr.harm` = Spielweise pro Spur (`off|chord|chordbass|root|arp`, Acid ohne Akkord-Modi). Folgt eine Spur, liegen die eigenen Noten in `tr.harmOwn` und `tr.events` enthält die erzeugten (`e.h=1`) — Wiedergabe/Export/Vorschau brauchen keinen Sonderfall. Speichern: `trOwnEvents(tr)` + `harm` + `harmony`. Erzeugte Note in der Piano Roll anfassen = `hmConvert` (Spur bekommt eigene Noten, Undo per Toast). Zufall deterministisch über `tr.harm.seed`.
- FM-Drums: AudioWorklet `fm-voice` (Hüllkurven multiplikativ statt `Math.exp` je Sample; Stimme endet bei −45 dB mit 20 ms Ausblenden; WAV-Export nutzt dasselbe Worklet). Schriften: Latein-Subsets als WOFF in `fonts/` (Neu erzeugen mit `pyftsubset`, Zeichenbereich siehe Commit v63).
- Sample-Kits (v69/v70): `KITS.<id>.samples={dir,voices,fallback}` (studio, s67, hyb, rusty, vintage), Dateien `samples/<dir>/<stimme>.mp3` (Sync-Klick + 12 Slots, Format in `samples/README.md`), Engine `smpLoad`/`smpPlay` (Layer nach Velocity, Round Robin, Variation, Raum je AudioContext), Optionen `smpOpt` (v71: Kit-Auswahl → „Klang“ am gewählten Sample-Kit, eingeklappt; gespeichert mit dem Pattern, ohne Angabe Standard `SMP_OPT_DEF`). `voices` = Rock-Synth als Ersatz beim Laden und für Stimmen ohne Aufnahme. Neue Kits mit `tools/build-samples.py` bauen.
- Siehe `CHANGES-v61-v71.md` (neuester Stand, offene Punkte), `DECISIONS.md` (gültige Entscheidungen, Verworfenes, Lektionen, Aufräum-Liste) und `docs/history/` (ältere Changelogs v41–v60). Tests (Playwright, headless) in `tests/`: vor jedem Push `python3 tests/run.py` (setzt Test-Hook in einer Temp-Kopie, startet Server, Screenshots in `tests/out/`). Neue Features bekommen Checks im passenden `test-*.py`.

## Offen
Nächster Schritt: variable Kit-Stimmen (Ride, Pedal-Hi-Hat; Entscheidungen in DECISIONS.md, Mockup `kit-stimmen-mockup.html` im Claude-Projekt). Handytest Sample-Kits + Klang-Optionen ausstehend (Nutzer sah den KLANG-Knopf am 28.10. noch nicht: erscheint nur am gewählten Sample-Kit; evtl. alter SW-Cache – prüfen). Piano/Rhodes-Klang hören/verbessern, Orgel + Sample-Tasten im Roll-Fenster, Mixer-Solo-Link.

## Langfristig
Spuren frei hinzufügen (Schichten, mehrere Keys-Spuren; Sound pro Spur über `tr.sound`). Zurückgestellt, erst Keys-Klang fine-tunen. Mockup: add-track-mockup.html (Chat). Größter Aufwand: Spuren sind fest in TRACKS/ARR_GROUPS verdrahtet.
