# v61 → v68 (26.–28.10.2026)

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

## Offen
- Am Handy prüfen: Noteneditor (Zoom/Scroll), Klaviatur, Piano/Rhodes-Klang, Drum-Ausklang (v63).
- Unsichtbaren alten Song-Modus (`songEnableBtn`, `songSlotsList`, `addPatternToSong`) entfernen.
- Versteckte Übersichts-Buttons M/S/🎲 pro Spur und `#groupBar` ausbauen (Mute/Solo-Refs beachten).
- Samples in der Bibliothek löschen (Funktion `deleteSampleLibraryEntry` da, Button fehlt).
- Optional: Tests ins Repo, `index.html` in ES-Module aufteilen.
