# v79 – Effekte (30.10.2026)

Mockup `docs/mockups/effekte-mockup.html` v7, Issues #16, #35, #36. Entscheidungen in `DECISIONS.md` (Abschnitt Effekte).

**Neu**
- **Effektkette pro Spur**: EQ fest als erstes Glied (mit Kurve, Spektrum beim Abspielen), dazu bis zu 4 Effekte (Verzerrung, Filter, Kompressor), jeder einmal, an/aus per Punkt, Reihenfolge per „Ordnen“, Presets.
- **Delay**: Notenwert (1/16 … 1/2, punktiert, Triolen), Mono/Ping-Pong, Feedback, Ton, Pegel, Presets, Echo-Zeitleiste, „Ohne Delay vergleichen“. Folgt dem Tempo.
- **Hall**: Größe, Ton, Pegel, Presets.
- **Master-Effekte** (Kompressor, Limiter u. a.) über den Knopf in der Master-Spalte.
- **Klang → Mix & FX**: Laut, Pan, Sends (Name antippen → Gerät), Effekte, Groove eingeklappt. Geräte-Regler ohne Zahlen (Wert beim Ziehen im Label, Zurücksetzen bei Abweichung).
- **Mixer**: alle Kanäle gleich hoch bis zur Tab-Leiste; sichtbar nur Fader, Meter, M/S und ein Knopf zu den Kanal-Einstellungen (Punkte = Effekte). Drums als Gruppe (zugeklappt, „DRUMS ›“ klappt auf), Hall/Delay am Ende, Master fest.
- Gespeichert mit dem Beat (`schemaVersion: 8`); ältere Beats laden neutral, Hall/Delay wie bisher.

**Geändert**
- Sends zapfen nach EQ und Effekten ab (vorher vor dem EQ).
- Pan- und EQ-Drehregler im Mixer entfallen (jetzt in den Kanal-Einstellungen bzw. im EQ-Gerät).
- WAV-Export baut denselben Effekt-Aufbau wie live.

**Tests**: `tests/test-fx.py` (44 Checks: Standardklang, EQ im/aus dem Signalweg, Delay-Zeit, Ping-Pong im Export, Insert im Export, Gruppe, Speichern/Laden inkl. alter Beats, Mix & FX, Geräte, EQ-Kurve, Mixer).

**Am Handy prüfen**: Klang der Effekte, Ping-Pong, Federn beim Ziehen der EQ-Punkte, Last bei mehreren Effekten.
