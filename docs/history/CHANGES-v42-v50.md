# CHANGES v42–v50 — Cosmic-Upgrade und danach (Basis: v41, `CHANGES-v41.md`)

Stand am Ende: `deploy-v21/index.html` = v50, `sw.js` `CACHE='mrm44-v50'`. (Ordner-Zählung: v12 = v41 → v21 = v50.)
Die Zwischenstände (Upgrade-1…5, v6…v10) sind nur Arbeitsstände und nicht mehr nötig.

## v42 — Cosmic-Upgrade bereinigt (Upgrade-1 einer anderen KI → Review)
- Upgrade-1 enthielt: neue Spur `cosmic` (Unisono-Saw + Sub + Shimmer, Filter-Pick), Arpeggio-Generator (Generate/Variation/Fill), Gruppe COSMIC. Nichts zerstört (+234 Zeilen, nur Ergänzungen), aber Fehler:
- Cache nicht hochgezählt; Skala-Wähler im Editor änderte immer Acid; XY-Taste im Mixer öffnete bei Cosmic das Acid-Pad; Generator-Noten bis +62 (im Editor unerreichbar); Slides bei Cosmic wirkungslos; Motion-LFO an `currentTime` (Live ≠ Export); Stopp ließ Cosmic nachklingen; Reset alter Patterns ohne Gains/Mixer-UI; kein Beats-Reiter.
- Fixes: `setAcidScale(id,tr)`; XY nur Acid; Notenbereich 0..36 (Überhang oktavweise gefaltet), 4-Oktaven-Option weg; Editor „Okt +" bis +24; Notennamen Cosmic +24; S-Zeile bei Cosmic aus; LFO an `modPos`; `stopCosmicVoices()`; Reset via `applyTrackSound`; Beats-Reiter „Cosmic" + Parameter gespeichert; Vorhören/Klang-Taste an M/S angeglichen (44 px, Radius 8).

## v43
- Synth-Sheet (`#synthSheet`, Taste `#tbSynth`) für Acid + Cosmic: Slider Cutoff/Reso/Env Mod/Decay (Cosmic zusätzlich Width/Motion/Warmth/Air), „Filter würfeln", XY nur Acid. Reglerzeile im Pattern-Tab entfernt (Elemente bleiben unsichtbar).
- Spur „COSMIC ARP" → „COSMIC" (Übersicht-Label `COS`).
- Flow-Bugfix: Durchgangstöne = Nachbar-Skalentöne (vorher 43 % skalenfremd).
- Step-Kacheln: Aufleuchten/Playhead als `::after`-Überlagerung (kein `outline`/`filter`), `-webkit-tap-highlight-color:transparent` (Android/Chrome: eckiges Aufblitzen behoben — vom Nutzer bestätigt).

## v44 — Akkordverläufe
- Dropdown „Chord": Gruppe „Einzelner Akkord" + „Verlauf · pro Takt ein Akkord". 9 Moll-Verläufe, 3 Dur-Verläufe (Liste folgt der Skala der Spur, Namen folgen dem Grundton). Ein Akkord pro Takt, bei 16 Steps alle 8 Steps; Wechsel beginnt auf dem Grundton. Gilt für Generate/Variation/Fill, Seite/Alle, Acid und Cosmic.

## v45 — Instrumentfarben
- Drums blau, Perc türkis, Sample grün, Acid orange, Cosmic lila (Übersicht, Raster, Spurname, Mixer-Tag; Tonzellen im Editor in Spurfarbe).

## v46 — Pflichtpunkte
- Schriften lokal (`fonts.css`, `fonts/`), Google-Links entfernt; `index-preview.html` nur für die Vorschau.
- `datenschutz.html`: Verantwortlicher ausgefüllt, Abschnitt „Schriftarten"; Impressum/Datenschutz ohne „bitte ausfüllen"-Rahmen.
- `sw.js` neu: Pflicht-/optionale Dateien, stale-while-revalidate für App-Dateien, Cache zuerst für Schriften/Bilder, Offline-Fallback nur für Seitenaufrufe, Fremd-/no-store-Anfragen unberührt.
- Viewport: `user-scalable=no`/`maximum-scale` entfernt.

## v47 — Kit/Fill/Logo
- Kit aus dem LCD in eine eigene Taste; Fill aus der Tab-Leiste in eine Icon-Taste (Symbol aufsteigende Balken, Licht = aktiv) mit Fill-Sheet (`#fillSheet`); Tab-Leiste 4 Tabs; Fill wirkt nur noch auf Drums (kein Rimshot/Clap); Logo mittig ganz unten im Pattern-Tab.

## v48 — kompakter Header (Variante D)
- Transportleiste: Play, BPM, Pattern-Taste (öffnet Beats), Zahnrad; LCD-Zeile weg; Länge als vier Tasten oben in der Beats-Ansicht; eine Zeile `#spurRow`: Spur ▾ + Kit (Kürzel) + Fill. Kopf bis Übersicht 253 → 133 px (390 px Breite, Drums).

## v49
- Erklärtext im Footer entfernt; Hinweis „Doppeltippen setzt einen Regler zurück" entfernt (Funktion bleibt versteckt, siehe ROADMAP „Aufräumen").

## v50 — Acid-Bass-Modus
- Acid-Generator: Stile Off-Beat / Rolling / Pulse (Gruppe „Bass (nur Acid)"), Grundton des Akkords/Verlaufs pro Takt (VI/VII eine Oktave tiefer), Feld „Lage" (Tief/Hoch), Variation würfelt Oktaven/Akzente neu, Fill = letzter Schlag. Arpeggio-Stile bleiben bei Acid wählbar; bei Cosmic keine Bass-Stile.
