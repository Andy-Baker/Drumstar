# Sample-Kits – Quellen und Aufbereitung

Alle Aufnahmen sind frei nutzbar (Public Domain bzw. CC0, keine Namensnennung nötig). Wir nennen die Quellen trotzdem.

| Kit (Ordner) | Quelle | Lizenz |
|---|---|---|
| STUDIO KIT (`studio`), STUDIO 67 (`s67`), HYBRID (`hyb`) | **SM Drums** („Deeply Sampled Free Drums“) von Scott McLean, Tod Stillwell, Suleiman Ali – github.com/sfzinstruments/SMDrums | Public Domain |
| RUSTY KIT (`rusty`) | **Big Rusty Drums**, Karoryfer Samples – github.com/sfzinstruments/karoryfer.big-rusty-drums | CC0 1.0 |
| VINTAGE 73 (`vintage`) | **Gogodze Phu Vol II**, Karoryfer Samples – github.com/sfzinstruments/karoryfer.gogodze-phu-vol-ii | CC0 1.0 |

## Format
`<kit>/<stimme>.mp3`, mono 44,1 kHz, LAME VBR q4: Sync-Klick bei 0 s, ab 0,1 s zwölf Slots
(Layer 1–4 × Round Robin 1–3) zu je `SMP_LEN[stimme]` Sekunden (bd 0,9 · sd 0,7 · rs 0,6 · ch 0,5 · hl 0,9 · hf 0,6 · oh 2,5 · lt 2,0 · ht 1,8 · cy 4,0 · rd 3,5 · rb 3,5).
Spielweisen (v72): hl = Hi-Hat locker, hf = Hi-Hat Pedal, rd = Ride Fläche, rb = Ride Bell.
Layer 1–4 = Ghost leise, Ghost, Normal, Akzent.

## Aufbereitung (`tools/build-samples.py`)
- Layer nach Spitzenpegel gewählt (Ziel −19 / −12 / −5 / 0 dB unter dem lautesten Schlag), danach Abstände nach Lautheit (60 ms) höchstens so groß wie das Ziel.
- Mehrere Mikrofone (Rusty, Vintage): auf das Nahmikro zeitlich ausgerichtet und Polarität korrigiert (Kreuzkorrelation), dann gemischt. Snare-Unterfell ist umgepolt.
- Jede Stimme auf die Lautheit der Studio-Stimme abgeglichen (60 ms ab Anschlag, Becken 400 ms). Wo das die Spitze übersteuern würde, Peak-Limiter (je Stufe relativ zur eigenen Spitze, max. 6 dB).
- Ende ausgeblendet (letzte 40 %).
- Studio 67: 1967er Ludwig-Snare (Snare67_NR), lockere Hi-Hat, Tom 2/3, Crash 17". Hybrid: Snare_HyB 1–3 als Round Robin, Hybrid-Rimshot, Crash 15". Fehlende Stimmen kommen aus dem Studio Kit (`samples.fallback`).
- Vintage: Kick-/Snare-/Front-/Overhead-Mikro, ohne Retro- und Fenster-Mikro. Hat keine Becken (Crash und Ride aus Studio).
- Ride/Pedal/locker (v72): Studio = Ride 17" + Bell, Hat Foot; „locker“ = offene Hi-Hat, nach 0,18 s abgedämpft (SM Drums hat keine halb offene, „02 Hat, Loose“ klingt fast wie zu). Rusty = ride_22 rd/bl, hihat_14 chik und lc. Vintage = hf, hl. Studio 67/Hybrid nehmen diese Stimmen aus Studio. Einzelne Stimmen neu bauen: `VOICES=hl python3 tools/build-samples.py studio`.
