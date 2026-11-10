# Entscheidungen & Lektionen — MRM-44 / Drumstar

Zusammengeführt am 28.10.2026 aus DECISIONS-2/-3, ARCHITECTURE-11/-12 und ROADMAP-15 (Stand v41–v50, früher im Claude-Projekt), bereinigt auf den Stand v65. Was durch spätere Versionen überholt ist, steht nicht mehr hier. Änderungshistorie: `CHANGES-v61-v68.md` (neu) und `docs/history/`.

## Gilt weiter

**Arbeitsweise**
- Mockups immer als interaktive HTML-Seiten (klickbar, bei Musik-Funktionen mit Ton), nicht als Bilder/Artboards. Erst Mockup, dann Umbau.
- Vergleiche an bestehenden Bildschirmen (vorher/nachher) immer 1:1 im Look der App, nicht nachgebaut: echte App (`../../index.html`) im Mockup einbetten und die Änderung dort zur Laufzeit anwenden, mit Schalter „Geänderte markieren“ (Beispiel `docs/mockups/issue-19.html`, vom Nutzer als Vorlage bestätigt).
- Schrift (31.10., #19): Untergrenze 11 px (12 px verglichen, 11 gewählt).
- Klang und Performance vor neuen Funktionen. Kostet ein Feature eines davon, vorher Bescheid geben.
- Fremdänderungen (andere KI, eigene Edits) prüfen: Diff, Syntaxcheck, Nebenwirkungen auf geteilten Zustand.
- Dient es Qualität und Sound, keine Rücksicht auf alte Patterns (keine Migrationspflicht).
- Kein Autosave des Arbeitsstands (nicht erneut vorschlagen).

**Bedienung & Layout**
- Eine Transportleiste, immer bündig oben (Play, BPM, Pattern-Taste, Zahnrad). Kein Logo im Header; Logo mittig ganz unten, darunter Impressum/Datenschutz.
- Master/Swing/Humanize im Einstellungs-Sheet (Zahnrad), nicht in der Transportleiste.
- Keine Pop-up-/Toast-Meldungen außer Undo-Toasts (z. B. `hmConvert`). Rückgängig ist global.
- Länge gehört zum Pattern (Beats-Ansicht). Kein „Folgen“-Schalter: Ansicht blättert mit, manuelles Blättern fixiert bis Stopp/Tippen.
- Neuer Beat (29.10., Mockup `neuer-beat-mockup.html` Variante B): Beats-Fenster oben Karte „Aktueller Beat“, darunter Bibliothek mit „Neuer Beat“. Auswahl „Leer, gleicher Klang“ / „Leer, Standard“, keine Rückfrage, Undo-Toast. Speichern überschreibt den geladenen Beat, „Als Kopie“ legt neu an. Oranger Punkt neben dem Namen = ungespeichert.
- Zurücksetzen (29.10., Mockup `zuruecksetzen-mockup.html` B): kein versteckter Doppeltipp mehr. Verstellter Regler zeigt seinen Wert als Taste mit ↺, Antippen = nur dieser Regler auf Standard (je Spur eigener Standard), Rückgängig im Toast.
- Step-Stärke über Pinsel (Ghost leise, Ghost, Normal, Akzent), nicht Tipp-Zyklus.
- Drum-Spuren (#68, 09.11.): PERC ist eine zweite Drum-Spur mit eigenem Kit/Set, keine Sonderform. Kein „Wie Drums“; alte Beats bekommen für PERC dasselbe Kit. Eigene Sets gehören zu einer Spurart (Zeilen verschieden); Kits mit eigenen Zeilen für jede Spur erst mit #13. Verworfen: ein Picker mit Reitern DRUMS/PERC (Variante B).
- Kit nur bei Drums/Perc; Fill nur bei Drums (Icon-Taste + Sheet), steuert nur BD/SD/Toms/Becken/Hats. Perc-Fill evtl. später als eigene Version.
- Design braucht Raum; Sticky-Elemente am Rand dürfen keinen Spalt zum Chassis lassen (Safe-Area im Element selbst auffangen).
- Querformat nur für Spielflächen (Step-Raster, Pads, Noteneditor); Mixer, Song und Vollbild-Overlays bleiben Hochformat und scrollen.

**Klang & Instrumente**
- Samples bleiben in den Drums erlaubt (Drum-Rack-Prinzip: Pad = Container für Synth oder Sample). Ein ausgebauter Sampler ist ein zweites Werkzeug.
- Pro Spur eigener Grundton und eigene Skala.
- Piano Roll (6.11., #59): „Nur Skalentöne“ ab Werk aus, damit die Klaviatur-Leiste schwarze Tasten zeigt; Fremdtöne als dunkle Zeilen. Schalter bleibt in den Optionen.
- Cosmic klingt gut und bleibt so; Performance auf dem Handy spürbar, läuft aber.
- Realistische Drums über Samples statt Synthese: Studio Kit (SM Drums, Public Domain), mindestens 4 Lautstärke-Layer je Stimme (= 4 Velocity-Stufen), Round Robin. Nur frei lizenzierte Bibliotheken (Public Domain/CC0; CC-BY mit Nennung), kein CC-BY-SA. Kits laden erst bei Auswahl. Im Hörtest übernommen: Studio 67, Hybrid, Rusty, Vintage 73; verworfen: Besen (Swirly, Kick klingt nach Snare). Mehrmikrofon-Bibliotheken nur zeitlich ausgerichtet und polaritätskorrigiert mischen.
- Kits mit variabler Stimmenzahl (Mockup `docs/mockups/kit-stimmen-mockup.html`, entschieden 28.10.):
  - Mischform: eine Zeile pro Instrument; nur Hi-Hat (zu, locker, offen, Pedal) und Ride (Fläche, Bell) bekommen Spielweisen pro Step. Snare-Rimshot/Sidestick und Becken bleiben eigene Zeilen. Hi-Hat würgt sich dadurch automatisch selbst ab.
  - Jede Stimme hat eine Rolle (Kick, Snare, Hi-Hat, Tom, Becken, Perc); Fill, Würfeln und Kit-Wechsel arbeiten über die Rolle statt über feste IDs.
  - Kit-Wechsel: Noten ohne passende Stimme im neuen Kit werden gemerkt (nicht gelöscht) und kommen beim Zurückwechseln wieder; gespeichert wird nur, was hörbar ist.
  - Höchstens 16 Stimmen pro Kit.
  - Umgesetzt in v72 (Schritt 1): Ride als neue Drum-Zeile (Fläche/Bell), Hi-Hat mit Zu/Locker/Pedal. Spielweise liegt im sonst leeren `tr.notes[s]` der Drum-Spuren (zieht überall mit). Offene Hi-Hat bleibt vorerst eigene Zeile (Synth-Kits, Fill, Mixer, eigene Sets hängen an `oh`). Noch offen (Schritt 2): Issue #2.
  - Crash bekommt doch Spielweisen (5.11., #56): Crash · Kurz · 1/16 · 1/8 = frei ausklingen bzw. mit der Hand abstoppen, Greifzeit folgt dem Tempo. Beim späten Greifen klingt der Hall weiter (wie im Raum), nur „Kurz“ duckt die Sends.
  - „Locker“ = halb offen. Studio hat keine halb offene Aufnahme → offene Hi-Hat abgedämpft.

**Effekte** (30.10., Mockup `docs/mockups/effekte-mockup.html`, Issue #16/#35)
- Drei Ebenen: Insert-Effekte pro Spur, gemeinsame Sends (nur Hall + Delay, vorerst keine weiteren), Master-Effekte in der Master-Spalte des Mixers.
- Höchstens 4 Insert-Effekte pro Kanal. Reihenfolge umsortierbar, mit sinnvoller Standardreihenfolge. (Die früher notierte Reihenfolge EQ → Kompressor → Filter → Distortion → Reverb → Delay war nur eine Aufzählung gewünschter Effekte, keine Festlegung.)
- Delay: Notenwert inkl. punktiert/Triole, Mono/Ping-Pong, Feedback, Ton, Pegel, Presets.
- Dieselben Geräte-Ansichten aus Klang-Sheet und Mixer erreichbar.
- Mix & FX (Klang) = Kanal-Einstellungen im Mixer, gleicher Inhalt: Laut, Pan, Sends (über den Effekten), Effektkette, EQ und Groove eingeklappt. Dort nur Übersicht (an/aus, Preset), Details erst im Effekt- bzw. Send-Gerät – nach Gehör arbeiten.
- EQ (30.10.): eigenes Gerät mit Kurve, fest als erstes Glied jeder Spur-Kette (kein Effekt-Platz). Bänder Tiefen-Filter, Tiefen, Mitten (Lage wählbar), Höhen; Punkte auf der Kurve ziehen oder Regler; Spektrum beim Abspielen; Mini-Kurve in der Übersicht. Die EQ-Knöpfe im Mixer-Kanal entfallen.
- Regler in Effekt-/Send-Geräten ohne Zahlenwerte (nach Gehör); Wert nur kurz beim Ziehen im Label, Zurücksetzen als Symbol-Knopf nur bei Abweichung.
- Entschieden 30.10. (Mockup v7): Sends-Regler wie alle anderen Regler; Name antippen öffnet Hall-/Delay-Gerät. Sends und Effekte im Klang-Sheet immer offen (keine Klapp-Karten). Jeder Effekt nur einmal pro Kanal. Mixer: Hall/Delay scrollen am Ende mit, nur Master fest; Drums als Gruppe, startet zugeklappt (Issue #36).
- Umgesetzt in v79 (30.10.): alles oben außer Effekten im Sample-Editor. Sends zapfen jetzt nach EQ und Effekten ab (vorher vor dem EQ) – EQ und Effekte wirken also auch auf Hall/Delay.
- Alle Regler behalten das Zurücksetzen (Wert ≠ Standard → Wert wird zum Knopf).
- Mixer: alle Kanäle volle Höhe; sichtbar nur Fader, Meter, M/S und ein Knopf, der die Kanal-Einstellungen als Sheet öffnet. Gruppen, Hall/Delay und Master optisch leicht abgesetzt.
- UX: Je mehr Regler, desto wichtiger ist Ordnung. Bereiche klar abgegrenzt, Details eingeklappt, selbsterklärend. Schriftgrößen wie in der App, nicht größer. Außergewöhnliches Design ist zentral für den Erfolg der App.

**Technik**
- Schriften lokal (`fonts/`, `fonts.css`), kein Google.
- Code in mehreren Dateien ohne Build (v89, #25): `css/app.css` + `js/*.js` als klassische Skripte im globalen Scope (vorher eine IIFE in `index.html`). Grund: kleinere Dateien sind für Claude/Agenten lesbar und editierbar, Diffs pro Bereich; „was im Repo liegt, läuft“ bleibt. ES-Module erst, wenn der globale Zustand ohnehin aufgeräumt wird (z. B. mit #13); TypeScript/Build-Schritt nicht nötig (Pages liefert gzip, kein Kompilat, Debuggen am Handy einfach). Typprüfung später ggf. per JSDoc + `tsc --noEmit` im Test.
- Service Worker: App (index.html + verlinkte js/css) wird nur als Ganzes aktualisiert (Start aus dem Cache, Hintergrund-Prüfung von index.html, alles oder nichts); Liste aus index.html; Cache zuerst für Schriften/Bilder; `CACHE` + `?v=` bei jedem Deploy erhöhen.
- Pinch-Zoom erlaubt (kein `user-scalable=no`).
- Weitere Drum-/Perc-Spuren (10.11., #70, Variante B): Kit + Zeilen im Sheet wählen (alle vorausgewählt), höchstens 3 zusätzliche. Zeile `bd_2` spielt Stimme `bd` (kein neues Stimmen-Modell). Fill nur einmal (von DRUMS) und auf weitere Drum-Spuren mit Noten geschichtet, statt pro Spur neu zu würfeln. Hi-Hat würgt nur innerhalb der eigenen Spur ab. DRUMS/PERC ab Werk bleiben (nicht löschbar/umbenennbar), weil Altstände, Fill und Sets daran hängen. Zeilen nachträglich ergänzen: mit #2.
- Freie Melodiespuren (10.11., #13 Stufe 1, Variante C): „Spur hinzufügen“ im Spur-Menü und im Song, gleiches Sheet; Original-Spuren ACID/COSMIC/KEYS dürfen gelöscht und umbenannt werden („werden nicht immer gebraucht“); höchstens 7 Melodiespuren (Handy-Last). Ein Beat/Song legt beim Laden genau seine Melodiespuren an (ältere Stände = die drei ab Werk). Beat-Reiter bleiben je Instrument, nicht je Spur. Zweite Drum-/Perc-Spur = Stufe 2.
- Instrument-Register (10.11., #24, Weg „A+“): Unterschiede Acid/Cosmic/Keys stehen nur in `INSTR` (inkl. Verweisen auf die bestehenden Klang-/Live-Funktionen), nicht als verstreute ID-Abfragen. Bewusst noch ohne eigenes Instrument-Feld an der Spur und ohne neues Speicherformat; das kommt mit #13 (`tr.inst`). Verworfen: nur Eigenschafts-Tabelle (müsste für #13 erneut umgebaut werden) und gleich Instrument-Objekt pro Spur (Formatwechsel ohne heutigen Nutzen). Folge: Acid/Keys speichern keine fremden Cosmic-Felder mehr; ein Pattern ohne eine Melodiespur lädt diese leer mit Werksklang (galt vorher nur für Cosmic/Keys).

## Verworfen / bewusst nicht gebaut
- Gemeinsamer Grundton/gemeinsame Skala für Acid und Cosmic; „Wie Cosmic“-Taste; Schalter „Cosmic sparsam“.
- Logo im Header (alle Varianten), Logo-Startbild.
- Master-Regler in der Transportleiste; dauerhafter „Folgen“-Schalter; gestrichelter Rand der Random-Leiste.
- Eigenes Pattern-Sheet für Name + Länge.
- Sample-Quellen aus den Drums streichen (höchstens Aufräumschritt, nachdem der Sampler steht).
- Farben/Themes wählbar machen (1.11., Mockup Presets bzw. Presets + Anpassen; liegt in der Git-Historie, #47).

## Lektionen
- Dekodierte Sample-Kits sind groß (Studio ≈ 45 MB als Float). Nicht benutzte Kits freigeben (`smpFree`); Tests mit vielen WAV-Exporten brauchen frische Seiten bzw. `gc()`, sonst stürzt Chromium ab.
- Geteilter Zustand ist Fehlerquelle Nr. 1 (früher `xyTrack()`, ein Generator-Panel für zwei Spuren, der `type:'arp'`-Mischzustand): Spur-Bezug immer explizit übergeben.
- Generator-/Harmonie-Ausgaben müssen im Editor erreichbar sein (Notenbereich ↔ sichtbares Fenster).
- `exponentialRampToValueAtTime` nie auf 0.
- Patches per Script mit `assert count==1`, danach Playwright (390×844).
- Playwright findet echte Fehler (Solo ohne Muting, NaN im Fill, FM-Operator-Pegel, Choke vom Hall verdeckt, Swing-Timing). Klang und Last sind headless nicht beurteilbar.
- Playwright: Service Worker nur über `http://localhost` testbar; „offline“ blockiert Anfragen des Service Workers nicht (Server abschalten); emulierter Doppeltipp erzeugt kein `dblclick`.
- Messung Cosmic: eine Note ≈ 1,4× ein Kick-Schlag (≈ 12 neue Knoten pro Note). Wirksam wäre nur Stimmen-Wiederverwendung (Klang könnte sich ändern) → vorerst nicht gewünscht.
- CSS: Flex-Items in scrollenden Containern mit `min-height` brauchen `flex-shrink:0`; gleiche Spezifität → spätere Regel gewinnt; Fixed-Elemente in einem Element mit `z-index` kommen nicht über Geschwister außerhalb (Sheets deshalb außerhalb von `#panelContent`).
- JS: Funktionsdeklarationen sind hoisted, `const`-Hilfen nicht. Seit der Aufteilung (v89) gilt Hoisting nur innerhalb einer Datei: Code auf oberster Ebene, der eine Funktion aus einer späteren Datei aufruft oder als Wert übergibt (`addEventListener('click',f)`), wirft beim Laden `ReferenceError`.
- Cache-Nummer nie zweimal ausliefern (v99 ging für Crash und Klaviatur raus → Handy behielt die erste v99). `tests/run.py` vergleicht jetzt mit `origin/main`: App-Dateien geändert ohne höhere `CACHE`-Nummer = FAIL.
- Mehrere Skriptdateien + Service Worker: Ohne `?v=` an den Links nimmt Chromium beim Neuladen Skripte evtl. aus dem Speicher-Cache, obwohl der Service Worker schon die neuen hat → neue index.html mit alten Skripten.
- Native `<select>` mit `<optgroup>` funktioniert auf Android.
- Mockups, die dem Nutzer als einzelne Datei geschickt werden, brauchen eingebettete Schriften (sonst Ersatzschrift in der Handy-Vorschau).
- Manifest-Änderungen (z. B. `orientation`) greifen in der installierten App oft erst nach Neu-Hinzufügen zum Homescreen.
- Tempo erkennen (v98): Saubere synthetische Beats beweisen nichts. Log-Kompression je FFT-Bin mit fester Verstärkung (`log1p(1000·|X|)`) macht jedes Grundrauschen zu vollen Ausschlägen (Log-Schwankung von Rauschen hängt nicht vom Pegel ab) → übers Handy-Mikro Zufallstempo. Erst Bänder mitteln, dann dB relativ zum Pegel mit Boden. Prüfen mit echter Musik + Handy-Simulation: `python3 tests/tempo-bench.py`.
- Mitklicken/Phase vom Mikro: Eingangs-, Basis- und Ausgangs-Latenz abziehen (Android zusammen oft 0,1–0,3 s), Zeitstempel aus dem Worklet (`currentFrame`), nicht `currentTime` beim Eintreffen der Nachricht.

## Bekannte Einschränkungen
- iOS-Stummschalter kann Web Audio stumm halten; Gerätetasten regeln nur die Systemausgabe.
- Sample-Quellen in Drums und Sample-Spur einstimmig (eine Note pro Step).
- Schriftgrößen < 11 px an vielen Stellen (entschieden: auf 11 px anheben, #19).
- Rechtstexte (Impressum/Datenschutz) nicht anwaltlich geprüft.

## Offene Punkte
Aufräumen, Struktur und spätere Vorhaben stehen seit 29.10.2026 als GitHub Issues (Labels `aufräumen`, `aufgabe`, `idee`), nicht mehr hier.
