# v54 → v55
## v54 (Spielen-Modus im Roll-Fenster)
Klaviatur (1,5 Oktaven), Balken-Anzeige, Rec, Halten, Anschlag nach Tastenhöhe. Nur Acid/Cosmic.
## v55 (Piano-Spur)
- Neue dritte Melodiespur `piano` (PNO, gelb #ffd166), polyphon, keine Slides; Gruppe/Beat-Tab PIANO.
- Klang: additive Teiltöne (6 + Doppelsaite), höhere Teiltöne klingen schneller aus; Regler Ton / Härte / Ausklang im Synth-Sheet.
- Helper `isPoly(tr)` und `trOct(tr)` ersetzen die Cosmic-Sonderfälle (Akkorde, keine Slides, Notennamen).
- Roll-Fenster: Instrumentmenü zeigt 3 Spuren, Spielen-Modus mit Piano-Stimmen (Halten, Rec).
- Laden älterer Stände ohne Piano: Spur startet leer mit Standardklang.
- Noch nicht auf echtem Handy gehört; Klang ist ein erster Entwurf.
