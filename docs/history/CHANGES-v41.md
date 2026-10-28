# CHANGES v41 — UX-Umbau nach Mockup v9 (`v12/index.html`, `v12/sw.js`)

Basis: `index.html` v40 (`mrm44-v40`). Ergebnis: Ordner `v12/` mit `index.html` + `sw.js` (`CACHE='mrm44-v41'`, registriert `./sw.js`). Referenz war das Mockup v9 (nur Referenz, nicht im Projektwissen).

## Oberfläche
- **Transportleiste** (`#transport`): `position:sticky`, bündig oben (Safe-Area), enthält nur Play, Tempo-Kachel („128 BPM“) und Zahnrad `#settingsBtn`. Logo/Kopfzeile/Schrauben per CSS ausgeblendet. Alte Random/Clear-Tasten (`#randomBtn`/`#clearBtn`) bleiben unsichtbar im DOM, ihr Code läuft weiter.
- **Einstellungs-Sheet** `#setSheet` (Master, Swing, Humanize als Schieberegler). Die drei Drehregler sind entfernt; `masterVolKnobRef` ist jetzt ein Shim (`setValue` → `syncSettingsUI()`), `applyPatternData` ruft `syncSettingsUI()` statt Knobs neu zu bauen. Sheets liegen außerhalb von `#unit`-Inhalt, direkt vor dem `<script>` (sonst Stacking-Kontext von `#panelContent` unter der Tab-Leiste).
- **LCD:** Kit-Zeile, Pattern-Zeile mit Längen-Button `#lenBtn` + Dropdown `#lenMenu` (`lenUiRender`, ruft `setPatternLength`). `#lengthRow` ausgeblendet (Code bleibt).
- **Spur-LCD** `#grpBtn`/`#grpMenu` ersetzt `#groupBar` (ausgeblendet, bleibt Datenquelle). `grpSelRender()` wird in `setPatternGroup` mitgerufen. Hilfsfunktionen `$id`, `closeMenus`, `toggleMenu`.
- **Übersicht:** Zeilen 34 px, M/S/🎲 in den Zeilen ausgeblendet; Mute = gedimmt + durchgestrichen, Solo = gelber Name + gelber Hintergrund (`refreshSoloVisuals` setzt Klasse `solo`), andere Zeilen gedimmt (`solo-dim`).
- **Spurleiste** `#trackBar`: Name, `#tbM`/`#tbS` (44 px, `syncTbMS()`), Vorhör-Taste (blieb erhalten), Klang-Symbol `#tbSound`. Das Klang-Sheet `#soundSheet` wird pro Öffnen gebaut (`openSoundSheet`/`soundRow`): Laut, Tune (Acid: Grundton), Hall, Delay, Feel. `tbVolKnob` ist jetzt `null` (Aufrufer prüfen mit `&&`).
- **Steps:** Pinsel `#brushRow` (Ghost leise .15, Ghost .35, Normal .85, Akzent 1.3), `stepBrush`; Tippen setzt die Stärke, gleiche Stärke löscht. Für Acid ausgeblendet (Tonhöhen-Editor). `#bigGrid` füllt freien Platz (`flex:1`, min. 260 px, 4 Zeilen `1fr`, kein Seitenverhältnis); `#panelContent`/`#tabContent`/`#tabPattern` wachsen mit.
- **Symbolleiste** `#trackActions`: Zufall, Leeren, Rückgängig (Symbole, 48 px), Seite/Alle-Umschalter `#taScope` (nur bei >1 Seite sichtbar). `#taToast` ausgeblendet, `taSay()` ist ein No-op → keine Meldungen mehr.
- **Seiten:** `◀ Seite x/y ▶ ⧉`, Pin-Verhalten: Beim Abspielen blättert die Ansicht mit; manuelles Blättern/Kopieren setzt `pagePinned` und zeigt `#pinBtn` („Seite fixiert · tippen zum Mitlaufen“). Start/Stop löst die Fixierung. Playhead wird nur auf der sichtbaren Seite gezeichnet.
- **Undo global:** `taSnapshot()` sichert alle Spuren (steps/notes/slides, Acid-Filterwerte) + `PATTERN_LENGTH`; `taUndoBtn` stellt alles wieder her (auch Länge). Snapshot vor `setPatternLength`; kein Reset mehr bei Spurwechsel.

## Nicht angefasst / ungeprüft
Acid-Tonhöhen-Editor, Sample-Steuerung, Fill-, Mixer-, Song-Tab im neuen Layout. Kein Audio-Test, kein Gerätetest (nur Playwright 390×844: Layout, Länge ändern, Leeren+Undo, Solo-Klasse, Pinsel, Klang-Sheet, keine Konsolenfehler).

## Toter/ausgeblendeter Code (Aufräumen offen)
`#groupBar`/`.gb`, `#lengthRow`/`.len-chip`, `#taToast`/`taSay`, `.btn-cluster` (Random/Clear global), `tbKnobs`, alte `.ta-btn`/`.ov-mute/solo/rand`-Regeln, Song-Modus-Slots (aus v40).
