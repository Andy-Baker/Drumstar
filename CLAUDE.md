# MRM-44 / Drumstar
Browser-Drum-Machine/Sequencer, Vanilla JS + Web Audio, eine `index.html` + `sw.js` (Service Worker). Gehostet via GitHub Pages. Sprache: Deutsch, knapp.

## Regeln
- Kein Framework, kein Build. Plain HTML/CSS/JS.
- Bei jedem Deploy `CACHE` in `sw.js` erhöhen (aktuell `mrm44-v76`).
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
- Sample-Kits (v69/v70): `KITS.<id>.samples={dir,voices,fallback}` (studio, s67, hyb, rusty, vintage), Dateien `samples/<dir>/<stimme>.mp3` (Sync-Klick + 12 Slots, Format in `samples/README.md`), Engine `smpLoad`/`smpPlay` (Layer nach Velocity, Round Robin, Variation, Raum je AudioContext), Optionen `smpOpt` (v71: Kit-Auswahl → „Klang“ am gewählten Sample-Kit, eingeklappt; gespeichert mit dem Pattern, ohne Angabe Standard `SMP_OPT_DEF`). `voices` = Rock-Synth als Ersatz beim Laden und für Stimmen ohne Aufnahme. Neue Kits mit `tools/build-samples.py` bauen (einzelne Stimmen: `VOICES=…`). Nicht benutzte Kits frei (`smpFree`).
- Beats-Fenster (v76, Mockup `docs/mockups/neuer-beat-mockup.html` B): Karte „Aktueller Beat“ `#pbCard` (Name `#pbName`, Status `#pbState`, Länge, Speichern = anlegen bzw. überschreiben, Als Kopie, WAV), darunter `#pbNewBtn` → Sheet `#newBeatSheet` (`nbMake('keep'|'def')`, Standard = `nbDefault` beim Start, Undo über `hmToast(msg,true,fn)`). Ungespeichert = `pbPrint()` ≠ `pbBase` (geprüft nach pointerup/change), Punkt `.pdirty` im LCD. Ohne id: „Neuer Beat“ = Entwurf, „♫ …“ = Song.
- Spielweisen (v72): `ART={ch:[Zu,Locker,Pedal], rd:[Fläche,Bell]}`, Wert pro Step im sonst leeren `tr.notes[s]` der Drum-Spuren; `triggerTrack(tr,t,vel,art)` → Sample-Stimme `ART[..].v` (ch/hl/hf, rd/rb) bzw. `artSynth`. Leiste `#artRow`, Step-Buchstabe über `data-a`. Ride-Zeile `rd`; Synth-Ride = `rideFromCy`.
- Siehe `CHANGES-v61-v72.md` (neuester Stand, offene Punkte), `DECISIONS.md` (gültige Entscheidungen, Verworfenes, Lektionen, Aufräum-Liste) und `docs/history/` (ältere Changelogs v41–v60). Tests (Playwright, headless) in `tests/`: vor jedem Push `python3 tests/run.py` (setzt Test-Hook in einer Temp-Kopie, startet Server, Screenshots in `tests/out/`). Neue Features bekommen Checks im passenden `test-*.py`.

## Aufgaben & Ideen = GitHub Issues
Einzige Quelle für „was noch“ sind die Issues (Labels: `aufgabe`, `idee`, `bug`, `aufräumen`). Keine Aufgabenlisten in Dateien oder Memory.
- **Session-Start** („weiter machen“): offene Issues lesen (`gh api "repos/Andy-Baker/drumstar/issues?state=open&per_page=100"`; GraphQL/`gh issue` geht hier nicht).
- **Während der Session**: Neue Idee, Wunsch oder Fehler vom Nutzer sofort als Issue anlegen (knapp, mit Kontext), nicht erst am Ende.
- **Commits**: `fixes #n` bzw. `refs #n` in die Commit-Nachricht.
- **Session-Ende**: Erledigtes geschlossen? Neues angelegt? Rückmeldungen (z. B. Handytest) als Kommentar am Issue.
- Der Nutzer pflegt nichts selbst, kann aber jederzeit in GitHub nachtragen.

## Ablage
- Mockups: `docs/mockups/` (neue Mockups direkt dort). Ältere, schon umgesetzte Mockups liegen nur noch im Claude-Projekt als Archiv.
- Entscheidungen, Verworfenes, Lektionen: `DECISIONS.md`. Änderungshistorie: Git-Log + `CHANGES-*.md`.
