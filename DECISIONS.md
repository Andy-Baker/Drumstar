# Entscheidungen & Lektionen — MRM-44 / Drumstar

Zusammengeführt am 28.10.2026 aus DECISIONS-2/-3, ARCHITECTURE-11/-12 und ROADMAP-15 (Stand v41–v50, früher im Claude-Projekt), bereinigt auf den Stand v65. Was durch spätere Versionen überholt ist, steht nicht mehr hier. Änderungshistorie: `CHANGES-v61-v68.md` (neu) und `docs/history/`.

## Gilt weiter

**Arbeitsweise**
- Mockups immer als interaktive HTML-Seiten (klickbar, bei Musik-Funktionen mit Ton), nicht als Bilder/Artboards. Erst Mockup, dann Umbau.
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
- Step-Stärke über Pinsel (Ghost leise, Ghost, Normal, Akzent), nicht Tipp-Zyklus.
- Kit nur bei Drums/Perc; Fill nur bei Drums (Icon-Taste + Sheet), steuert nur BD/SD/Toms/Becken/Hats. Perc-Fill evtl. später als eigene Version.
- Design braucht Raum; Sticky-Elemente am Rand dürfen keinen Spalt zum Chassis lassen (Safe-Area im Element selbst auffangen).
- Querformat nur für Spielflächen (Step-Raster, Pads, Noteneditor); Mixer, Song und Vollbild-Overlays bleiben Hochformat und scrollen.

**Klang & Instrumente**
- Samples bleiben in den Drums erlaubt (Drum-Rack-Prinzip: Pad = Container für Synth oder Sample). Ein ausgebauter Sampler ist ein zweites Werkzeug.
- Pro Spur eigener Grundton und eigene Skala.
- Cosmic klingt gut und bleibt so; Performance auf dem Handy spürbar, läuft aber.
- Realistische Drums über Samples statt Synthese: Studio Kit (SM Drums, Public Domain), mindestens 4 Lautstärke-Layer je Stimme (= 4 Velocity-Stufen), Round Robin. Nur frei lizenzierte Bibliotheken (Public Domain/CC0; CC-BY mit Nennung), kein CC-BY-SA. Kits laden erst bei Auswahl. Im Hörtest übernommen: Studio 67, Hybrid, Rusty, Vintage 73; verworfen: Besen (Swirly, Kick klingt nach Snare). Mehrmikrofon-Bibliotheken nur zeitlich ausgerichtet und polaritätskorrigiert mischen.
- Kits mit variabler Stimmenzahl (Mockup `docs/mockups/kit-stimmen-mockup.html`, entschieden 28.10.):
  - Mischform: eine Zeile pro Instrument; nur Hi-Hat (zu, locker, offen, Pedal) und Ride (Fläche, Bell) bekommen Spielweisen pro Step. Snare-Rimshot/Sidestick und Becken bleiben eigene Zeilen. Hi-Hat würgt sich dadurch automatisch selbst ab.
  - Jede Stimme hat eine Rolle (Kick, Snare, Hi-Hat, Tom, Becken, Perc); Fill, Würfeln und Kit-Wechsel arbeiten über die Rolle statt über feste IDs.
  - Kit-Wechsel: Noten ohne passende Stimme im neuen Kit werden gemerkt (nicht gelöscht) und kommen beim Zurückwechseln wieder; gespeichert wird nur, was hörbar ist.
  - Höchstens 16 Stimmen pro Kit.
  - Umgesetzt in v72 (Schritt 1): Ride als neue Drum-Zeile (Fläche/Bell), Hi-Hat mit Zu/Locker/Pedal. Spielweise liegt im sonst leeren `tr.notes[s]` der Drum-Spuren (zieht überall mit). Offene Hi-Hat bleibt vorerst eigene Zeile (Synth-Kits, Fill, Mixer, eigene Sets hängen an `oh`). Noch offen (Schritt 2): Issue #2.
  - „Locker“ = halb offen. Studio hat keine halb offene Aufnahme → offene Hi-Hat abgedämpft.

**Technik**
- Schriften lokal (`fonts/`, `fonts.css`), kein Google.
- Service Worker: stale-while-revalidate für App-Dateien, Cache zuerst für Schriften/Bilder; `CACHE` trotzdem bei jedem Deploy erhöhen.
- Pinch-Zoom erlaubt (kein `user-scalable=no`).

## Verworfen / bewusst nicht gebaut
- Gemeinsamer Grundton/gemeinsame Skala für Acid und Cosmic; „Wie Cosmic“-Taste; Schalter „Cosmic sparsam“.
- Logo im Header (alle Varianten), Logo-Startbild.
- Master-Regler in der Transportleiste; dauerhafter „Folgen“-Schalter; gestrichelter Rand der Random-Leiste.
- Eigenes Pattern-Sheet für Name + Länge.
- Sample-Quellen aus den Drums streichen (höchstens Aufräumschritt, nachdem der Sampler steht).

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
- JS: Funktionsdeklarationen sind hoisted, `const`-Hilfen nicht.
- Native `<select>` mit `<optgroup>` funktioniert auf Android.
- Manifest-Änderungen (z. B. `orientation`) greifen in der installierten App oft erst nach Neu-Hinzufügen zum Homescreen.

## Bekannte Einschränkungen
- iOS-Stummschalter kann Web Audio stumm halten; Gerätetasten regeln nur die Systemausgabe.
- Sample-Quellen in Drums und Sample-Spur einstimmig (eine Note pro Step).
- Schriftgrößen < 11 px an vielen Stellen (Anheben braucht eigenes Mockup).
- Rechtstexte (Impressum/Datenschutz) nicht anwaltlich geprüft.

## Offene Punkte
Aufräumen, Struktur und spätere Vorhaben stehen seit 29.10.2026 als GitHub Issues (Labels `aufräumen`, `aufgabe`, `idee`), nicht mehr hier.
