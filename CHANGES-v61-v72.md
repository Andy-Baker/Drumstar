# v61 → v72 (26.–28.10.2026)

## v61
- Alter Tonhöhen-Editor entfernt (toter Code). `renderPitchEditor` → `renderEditorArea`.

## v62
- Harmonie-Tool ersetzt den Arpeggio-Generator (Details in CLAUDE.md).

## v63 – Aufräumen + Performance
- FM-Worklet: Hüllkurven multiplikativ statt `Math.exp` je Sample, Phasen gewrappt (~35 % schneller, Klang gleich). 4 ms Ausblenden am Stimmende statt hartem Abschnitt (vorher Knackser bei 5–30 % Restpegel).
- Schriften als Latein-Subset-WOFF (1,35 MB → 110 KB), keine 404 mehr beim Start.
- Audio startet bei jedem Zustand ≠ running wieder (iOS „interrupted“).
- Toter Code raus (Alt-Header, Power-LED, ungenutzte Funktionen/CSS).

## v64 – Noteneditor + Klang nach Mockup v3
- Editor in Zonen: Kopf (Zurück, Instrument, Klang, ⋯), Werkzeug (Stift/Klaviatur, Zoom %, Alles zeigen, Undo), Fuß (Play, Rec, Solo, Position) bzw. Notenleiste der Auswahl (A, S, Duplizieren, Löschen, ✕).
- Raster über das ganze Pattern: 2 Finger = Zoom (achsengetrennt), 1 Finger auf leer = scrollen, Tippen = Note. Lineal, ▲▼-Hinweise, Mitlaufen. Querformat: alles in einer Kopfzeile.
- „Nur Skalentöne“ blendet Zeilen aus statt zu sperren.
- Klaviatur mit Übersichtsleiste (Fenster ziehen = Lage, Rand = 7–15 Tasten, quer bis 24).
- Klang-Sheet mit Reitern Sound / Mix & FX / Tonart ersetzt Klang- + Synth-Sheet; ein Klang-Button pro Spur.

## v65 – Design-Ausreißer (Mockup ausreisser-mockup.html)
- Einheitliche Overlay-Köpfe, SVG statt Emojis.
- Beats: ▶ + ⋯ mit benannten Aktionen; WAV/Alle/Import in einer Zeile.
- Pads füllen die Höhe, Delay-Regler, Quantize-Icon. Mixer: Master in eigener Spalte, Fader nach Höhe. Song: ⓘ-Hilfe, AUS/AN. Spielfläche: Rec-Dummy weg, Segment.

## v66 – Keys-Anschlag (28.10.)
- Notenende: Pegel sprang beim Release um ~+22 dB (Piano und Rhodes), weil bei vorausgeplanten Noten `amp.gain.value` noch 1 war. Jetzt Hüllkurvenwert berechnet (Piano: `peak`, Rhodes: `rhodesEnvAt`). Bei kurzen Noten klang das wie ein zweiter Schlag kurz nach dem Anschlag.
- Piano-Grundton fällt nach dem Anschlag kaum noch ab (vorher −6 dB in 100 ms = „Bassdrum“-Wumms); Obertöne klingen weiter schnell ab.
- Hammer-Rauschen leiser, tiefer (500 Hz–2,5 kHz) und durch den Tonfilter (vorher hell und ungefiltert = „Hi-Hat“). Anteil über 4 kHz im Anschlag −38 → −58 dB.
- Klang dadurch insgesamt etwas voller/länger (RMS über 1 s ca. +5 dB bei gleichem Spitzenpegel). Am Handy gegenhören.
- Neuer Test `tests/test-audio.py` (Offline-Render: Release-Sprung, Wumms, Hammer, Clipping).
- Audiotest erweitert (ohne App-Änderung): alle Drum-Stimmen aller Kits über Worklet und nativen Pfad, Acid über den WAV-Export (Cutoff, Resonanz, Accent, Clipping). Test-Hook liegt jetzt in `tests/hook.js`.

## v67 – Export = Live (28.10.)
- WAV-Export rendert die FM-Drums jetzt über dasselbe AudioWorklet wie die Live-Wiedergabe (vorher nativer Ersatzpfad mit anderer Hüllkurve). Ersatzpfad nur noch ohne Worklet. Offline kein Echtzeit-Timer zum Aufräumen der Stimmen.
- Test: Kick über den WAV-Export endet wie live. Neues Werkzeug `tests/test-bench.py` (Lastmessung, `python3 tests/run.py bench`).

## v68 – Drum-Ausklang (28.10.)
- FM-Worklet-Stimmen klingen bis −45 dB aus und blenden 20 ms weich aus (vorher fest nach `ampDecay`+60 ms bei −10…−30 dB abgeschnitten, 32 von 66 Stimmen betroffen). Live und Export gleich. Mehrlast Drums ≈ +19 % (dichtes Pattern, gemessen mit `tests/test-bench.py`). Am Handy prüfen: Klang (vor allem Kick/Toms) und ob dichte Patterns flüssig laufen.
- Audiotest: Ausklang jetzt auch für den Worklet-Pfad harter Check (185 Prüfungen).

## v69 – Studio Kit (28.10.)
- Neues Kit **STUDIO KIT** mit echten Aufnahmen (SM Drums, Public Domain). Stimmen BD, SD, CH, OH, LT, HT, CY und RS (Sidestick) mit je 4 Lautstärke-Layern (passend zu Ghost leise / Ghost / Normal / Akzent) × 3 Round-Robins. Pro Schlag ±8 Cent und ±1,5 dB Variation, kurzer Raum (22 %) nur für die Samples.
- Samples in `samples/studio/` (96 MP3, mono, 1,4 MB). Laden erst, wenn das Kit gewählt ist oder ein Set es nutzt (Fortschritt in der Kit-Liste), bis dahin spielt der Rock-Synth. Clap, Cowbell, Claves, Maracas haben keine Aufnahme und spielen ebenfalls den Rock-Synth.
- MP3-Vorlauf wird pro Datei erkannt (Safari entfernt das Encoder-Padding nicht). Service Worker cacht `.mp3` wie Schriften (Cache zuerst).
- Pegel auf das Rock Kit abgeglichen (`STUDIO_OUT`). Neue Audiotests: Laden, 4 Stufen je lauter, Lautheit wie Rock Kit, kein Clipping, Synth-Ersatz.
- Ride und Pedal-Hat folgen mit Kits mit variabler Stimmenzahl (Mockup `kit-stimmen-mockup.html` im Claude-Projekt). Hörvergleich: A/B-Testseite als Artifact.

## v70 – weitere Sample-Kits (28.10.)
- Neue Kits **STUDIO 67** (1967er Snare, lockere Hi-Hat, Tom 2/3, Crash 17"), **HYBRID** (bearbeitete Pop-Snare, drei Varianten als Round Robin, Hybrid-Rim, Crash 15"), **RUSTY KIT** (Big Rusty Drums, 80er-Rockkit) und **VINTAGE 73** (Gogodze Phu, 70er, gedämpft). Quellen und Aufbereitung: `samples/README.md`.
- Engine verallgemeinert (`smpLoad`/`smpPlay`, `KITS.<id>.samples` mit `dir`, `voices`, `fallback`). Fehlende Stimmen spielt das Studio Kit, Stimmen ohne Aufnahme (Clap, Cowbell, Claves, Maracas) weiter der Rock-Synth.
- Neues Dateiformat: eine MP3 pro Stimme mit Sync-Klick und 12 Slots statt 12 Dateien (Studio 96 → 8 Anfragen). Alle Kits je Stimme auf Studio-Lautheit, Stufen-Abstände einheitlich; Studio dadurch minimal verändert (leisere Stufen teils bis 3 dB leiser).
- Mehrmikrofon-Kits neu gemischt: zeitlich ausgerichtet, Polarität korrigiert, Spitzen leicht begrenzt. Werkzeug `tools/build-samples.py`.
- Interne Klang-Optionen `smpOpt` (Layer, Round Robin, Variation, Raum) – UI folgt nach Mockup.
- Audiotests je Sample-Kit (Laden, 4 Stufen, Lautheit Groove ±3 dB / Fill ±5 dB, Clipping, Optionen, Ersatz-Stimmen).
- Besen-Kit (Swirly Drums) verworfen: Kick klingt nach Snare.

## v71 – Klang-Optionen der Sample-Kits (28.10.)
- Kit-Auswahl: am gewählten Sample-Kit Knopf „KLANG“, klappt die Regler auf (beim Öffnen der Auswahl immer eingeklappt, Mockup `kit-klang-mockup.html` Variante B).
- Regler: Lautstärken 4 Stufen / 1 Stufe, Abwechseln 3 Aufnahmen / immer gleich, Variation 0–100 % (50 = bisher), Raum 0–60 %, „Zurück auf Standard“.
- Gespeichert mit dem Pattern (`smpOpt`); ältere Patterns ohne Angabe laden den Standard. Beats tragen kein Kit und daher auch keine Optionen.
- Tests: Auf-/Zuklappen, Wirkung, Zurücksetzen (ui), Speichern/Laden (audio).

## v72 – Ride + Spielweisen Hi-Hat (28.10.)
- Neue Drum-Zeile **RIDE** mit Spielweisen Fläche/Bell. Studio und Rusty mit eigenen Aufnahmen, Studio 67/Hybrid/Vintage aus Studio, Synth-Kits mit einem aus ihrem Crash abgeleiteten Ride.
- **Hi-Hat** (vorher CL HIHAT) mit Spielweisen Zu/Locker/Pedal. Locker klingt halb offen und wird vom nächsten Hi-Hat-Schlag abgewürgt.
- Leiste „Spielweise“ unter der Stärke, nur bei Hi-Hat und Ride; der Step zeigt den Buchstaben (L, P, B). Antippen der Spielweise spielt sie an.
- Gespeichert in `tr.notes` der Drum-Spuren (Patterns, Beats, Song-Clips, Undo, Länge). Ältere Patterns/Beats ohne Ride laden mit leerer Ride-Spur.
- Fill pausiert auch den Ride; globales Würfeln lässt den Ride leer, eigener Würfel = Viertel/Achtel mit gelegentlicher Bell.
- Nicht benutzte Sample-Kits werden aus dem Speicher freigegeben.
- Tests: Ride/Spielweisen je Kit, Abwürgen, Speichern/Laden, Leiste (ui).

## Offen
Siehe GitHub Issues (seit 29.10.2026).

## v73 – Aufräumen + Export mit Samples (29.10.)
- Alter Song-Modus (Slots, „Zum Song“, Song aus/Loop) samt Resten ausgebaut: `#groupBar`, `tbKnobs` + tote Knob-Variablen, versteckte Random/Clear-Buttons, `#taToast`, `#ctxRow`, `lenBtn`/`lenUiRender` (#21). Sichtbar ändert sich nichts.
- WAV-Export wartet, bis die benutzten Sample-Kits geladen sind (vorher still Synth-Ersatz im WAV, wenn kurz nach Kit-Wahl/App-Start exportiert wurde). Offene Sample-Hi-Hat wird beim Export wie `lastOpenHatGain` gesichert (#12).
- WAV-Export: erster Schlag war bis ~3 dB leiser als live (Master-Kompressor schwingt in einem frischen Offline-Kontext ~0,2 s ein). Jetzt 0,25 s Vorlauf, der abgeschnitten wird; Timing im WAV unverändert.
- Tests: Export bei nicht geladenem Kit, Song-Export (Arrangement) mit Samples + Spielweise im Clip, erster Schlag = späterer Schlag.

## v74 – Sample-Kits: Größe und Offline-Meldung (29.10.)
- Kit-Auswahl: Sample-Kits zeigen vor dem ersten Laden die Ladegröße am Chip („… · 1,8 MB“, Ersatz-Kit mitgerechnet). Geladen oder im Cache → nur noch die Beschreibung. Größen als `samples.kb` in `KITS` (#31).
- Offline und noch nicht gespeichert: „Offline · Kit noch nicht gespeichert“ statt „Laden fehlgeschlagen“.
- Kein Sperren auf Mobil: Kits laden ohnehin erst beim Antippen, der Rock-Synth spielt solange weiter.
- Tests (ui): Größen passen zu `samples/`, Chip-Text vor dem Laden, Offline-Meldung.

## v75 – Größe bleibt am Kit stehen (29.10.)
- Handytest v74: Größe war lesbar, verschwand aber nach dem Laden. Jetzt bleibt sie stehen (immer inkl. Ersatz-Kit, feste Zahl) und nach dem Laden kommt „· gespeichert“ dazu (#31).
