"use strict";
// =========================================================================
// DRUMSETS — vier Klangcharaktere, dieselben Presets/Patterns bleiben erhalten
// =========================================================================
const KITS={
  rock:{ name:'ROCK KIT', desc:'Live · akustisch · druckvoll', voices:{
    // Kick: bestehender Click bleibt (knackiger Attack), zusätzlich ein kurzer
    // Impact-Noise-Burst für den Beater-auf-Fell-Transienten echter Kicks.
    bd:{baseFreq:52, startMult:2.1, pitchEndMult:0.5, pitchDecay:0.045, clickLevel:0.14, trim:0.65,
        impactNoiseLevel:0.04, impactNoiseFreq:2100, ampDecay:0.26,
        ops:[{ratio:1,level:0.5,decay:0.22,feedback:0.75},{ratio:1.5,level:3.3,decay:0.03}]},
    // Snare: zweites, unabhängiges Rauschband für den Snare-Teppich/Sizzle,
    // getrennt vom Fell-Rauschband — deutlich mehr Textur als ein einzelnes Band.
    sd:{baseFreq:230, ampDecay:0.11, fmLevel:0.35, noiseFreqBase:2400, noiseFreqTune:1300, noiseQ:1.1, noiseDecay:0.22, noiseLevel:0.55,
        wireNoiseLevel:0.28, wireFreq:3800, wireQ:0.45, wireDecay:0.3,
        ops:[{ratio:1,level:0.75,decay:0.12,feedback:0.55},{ratio:2.2,level:4,decay:0.018}]},
    lt:{baseFreq:78, startMult:1.9, pitchEndMult:0.4, pitchDecay:0.18, ampDecay:0.48, trim:0.82,
        ops:[{ratio:1,level:0.95,decay:0.44,feedback:0.35},{ratio:1.6,level:2.0,decay:0.14}]},
    ht:{baseFreq:145, startMult:1.9, pitchEndMult:0.4, pitchDecay:0.18, ampDecay:0.48, trim:0.82,
        ops:[{ratio:1,level:0.95,decay:0.44,feedback:0.35},{ratio:1.6,level:2.0,decay:0.14}]},
    rs:{baseFreq:560, ampDecay:0.045, fmLevel:0.45, clickLevel:0.3, clickFreq:3800,
        ops:[{ratio:1,level:0.85,decay:0.045},{ratio:3.6,level:6.5,decay:0.012,feedback:0.4}]},
    hc:{centerFreqBase:1050, centerFreqTune:1200, bursts:[0,0.009,0.019,0.033,0.05]},
    // Hi-Hat: originale 6(+1)-Oszillator-Technik statt FM-Feedback — dichteres,
    // "wäscheres" Spektrum, näher an einer echten Metallscheibe als reine FM.
    // Etwas tiefer/wärmer getunt als beim 808-Authentic-Kit für einen weniger
    // elektronischen, akustischeren Charakter. choke:true = Closed kappt Open.
    ch:{engine:'sixosc', baseFreq:130, ratios:[1.8,2.6,3.87,5.15,6.62,8.05,9.7], bpFreq:9000, bpQ:0.65, hpFreq:6200,
        decayClosed:0.055, decayClosedAccent:0.095, decayOpen:0.55, decayOpenAccent:0.75, fmLevel:0.55, choke:true},
    oh:{engine:'sixosc', baseFreq:130, ratios:[1.8,2.6,3.87,5.15,6.62,8.05,9.7], bpFreq:9000, bpQ:0.65, hpFreq:6200,
        decayClosed:0.055, decayClosedAccent:0.095, decayOpen:0.55, decayOpenAccent:0.75, fmLevel:0.55, choke:true},
    // Crash: dieselbe Oszillatorbank wie Hi-Hat (physikalisch korrekt — beides
    // Metallscheiben), aber tiefer/dunkler gefiltert mit langem Ausklang und
    // zusätzlicher Rausch-Wäsche für mehr Fülle im Decay.
    cy:{engine:'sixosc', baseFreq:115, ratios:[1.8,2.6,3.87,5.15,6.62,8.05,9.7], bpFreq:7500, bpQ:0.55, hpFreq:5000,
        ampDecay:2.4, fmLevel:0.36, noiseLevel:0.16, noiseDecay:2.0},
    // Cowbell: zwei-Ton-Verhältnis (~1:1.48) auf derselben 6-Osc-Engine wie Hi-Hat/
    // Crash, aber mit nur 2 Ratios und tiefem Bandpass statt Hochpass-lastigem
    // Metall-Spektrum — wärmer/runder als das klassische 808-Cowbell, passend zum
    // "live/akustisch"-Charakter des Rock Kits.
    cb:{engine:'sixosc', baseFreq:540, ratios:[1,1.48], bpFreq:620, bpQ:1.0, hpFreq:300, ampDecay:0.35, fmLevel:0.6},
    // Claves: wiederverwendet die Rimshot-FM-Struktur (playRim), aber ohne den
    // Noise-Klick-Layer (clickLevel:0) — reiner, kurzer Holz-Klick statt Snare-artigem Crack.
    cl:{baseFreq:2600, ampDecay:0.045, fmLevel:0.5, clickLevel:0, clickFreq:3000,
        ops:[{ratio:1,level:0.4,decay:0.04,feedback:0.4},{ratio:2.4,level:2,decay:0.015}]},
    // Maracas: reiner gefilterter Rauschausbruch (playMaracas), kein Trägerton.
    mr:{hpFreq:6000, bpFreq:9500, bpQ:1.0, noiseLevel:0.5, noiseDecay:0.07}
  }},
  // Sample-Kits: echte Aufnahmen (siehe SAMPLE-KITS weiter unten). voices = Rock-Synth als Ersatz,
  // solange die Samples laden, und für Stimmen ohne Aufnahme (Clap, Cowbell, Claves, Maracas).
  // samples.fallback: Kit, das Stimmen ohne eigene Aufnahme spielt. samples.kb: Größe aller Dateien in KB (Anzeige vor dem ersten Laden;
  // tests/test-ui.py prüft, dass die Zahl zu samples/<dir>/ passt).
  studio:{ name:'STUDIO KIT', desc:'Echte Aufnahmen · modern, trocken', voices:null,
    samples:{dir:'studio', kb:1805, voices:['bd','sd','rs','ch','hl','hf','oh','lt','ht','cy','rd','rb']} },
  s67:{ name:'STUDIO 67', desc:'Echte Aufnahmen · 1967er Snare, lockere Hi-Hat', voices:null,
    samples:{dir:'s67', kb:718, voices:['sd','ch','lt','ht','cy'], fallback:'studio'} },
  hyb:{ name:'HYBRID', desc:'Echte Aufnahmen · bearbeitete Pop-Snare', voices:null,
    samples:{dir:'hyb', kb:493, voices:['sd','rs','cy'], fallback:'studio'} },
  rusty:{ name:'RUSTY KIT', desc:'Echte Aufnahmen · großes 80er-Rockkit', voices:null,
    samples:{dir:'rusty', kb:1853, voices:['bd','sd','rs','ch','hl','hf','oh','lt','ht','cy','rd','rb']} },
  // Latin-Perc (#60): kein Drum-Kit zur Auswahl (hidden), nur Quelle beim Stimmen-Tauschen im Set-Editor.
  // Virtuosity Drums (VSCO 2 Pro, Timbales Karoryfer) + VCSL, CC0. Bau: tools/build-latin.py
  latin:{ name:'LATIN PERC', desc:'Echte Aufnahmen · Conga, Bongos, Timbales, Schellenkranz', voices:null, hidden:true,
    samples:{dir:'latin', kb:1029, voices:['cgh','cgm','tu','bgh','bgm','bgl','bglm','tih','til','tb','tbh','tbr']} },
  vintage:{ name:'VINTAGE 73', desc:'Echte Aufnahmen · 70er, gedämpft', voices:null,
    samples:{dir:'vintage', kb:878, voices:['bd','sd','rs','ch','hl','hf','oh','lt','ht'], fallback:'studio'} },
  fm909:{ name:'FM-909', desc:'Klassisch · punchy', voices:{
    bd:{baseFreq:58, startMult:1.8, pitchEndMult:0.36, pitchDecay:0.08, clickLevel:0.25, ampDecay:0.32,
        ops:[{ratio:1,level:1,decay:0.32,feedback:0.3},{ratio:1.4,level:6,decay:0.05}]},
    sd:{baseFreq:200, ampDecay:0.12, fmLevel:0.4, noiseFreqBase:1600, noiseFreqTune:800, noiseQ:0.8, noiseDecay:0.16, noiseLevel:0.85,
        ops:[{ratio:1,level:1,decay:0.15,feedback:0.15},{ratio:1.8,level:5,decay:0.02}]},
    lt:{baseFreq:95, startMult:1.3, pitchEndMult:0.54, pitchDecay:0.12, ampDecay:0.32,
        ops:[{ratio:1,level:1,decay:0.3,feedback:0.1},{ratio:2.0,level:3,decay:0.09}]},
    ht:{baseFreq:175, startMult:1.3, pitchEndMult:0.54, pitchDecay:0.12, ampDecay:0.32,
        ops:[{ratio:1,level:1,decay:0.3,feedback:0.1},{ratio:2.0,level:3,decay:0.09}]},
    rs:{baseFreq:480, ampDecay:0.05, fmLevel:0.55, clickLevel:0.3, clickFreq:3200,
        ops:[{ratio:1,level:1,decay:0.05},{ratio:3.1,level:8,decay:0.014,feedback:0.2}]},
    hc:{centerFreqBase:800, centerFreqTune:900, bursts:[0,0.012,0.024,0.038]},
    ch:{baseFreq:1100, decayClosed:0.055, decayClosedAccent:0.09, decayOpen:0.4, decayOpenAccent:0.55, fmLevel:0.55, filterFreq:6000,
        ops:[{ratio:1,level:1,decay:1,feedback:1.8},{ratio:1.41,level:4,decay:0.6,feedback:0.6},{ratio:2.0,level:3,decay:0.35},{ratio:3.3,level:2,decay:0.25}]},
    oh:{baseFreq:1100, decayClosed:0.055, decayClosedAccent:0.09, decayOpen:0.4, decayOpenAccent:0.55, fmLevel:0.55, filterFreq:6000,
        ops:[{ratio:1,level:1,decay:1,feedback:1.8},{ratio:1.41,level:4,decay:0.6,feedback:0.6},{ratio:2.0,level:3,decay:0.35},{ratio:3.3,level:2,decay:0.25}]},
    cy:{baseFreq:650, ampDecay:1.6, fmLevel:0.32, filterFreq:2600, noiseLevel:0.18, noiseDecay:1.2,
        ops:[{ratio:1,level:1,decay:1.4,feedback:1.4},{ratio:1.41,level:3,decay:0.9,feedback:0.5},{ratio:2.3,level:2.5,decay:0.6},{ratio:3.7,level:2,decay:0.4}]},
    // TODO: eigener FM-909-Charakter für Cowbell/Claves/Maracas — vorerst 1:1 vom
    // Rock-Kit übernommen, nur damit ein Kit-Wechsel während des Testens nicht
    // auf fehlende Presets läuft (kp wäre sonst undefined → Crash beim Trigger).
    cb:{engine:'sixosc', baseFreq:540, ratios:[1,1.48], bpFreq:620, bpQ:1.0, hpFreq:300, ampDecay:0.35, fmLevel:0.6},
    cl:{baseFreq:2600, ampDecay:0.045, fmLevel:0.5, clickLevel:0, clickFreq:3000,
        ops:[{ratio:1,level:0.4,decay:0.04,feedback:0.4},{ratio:2.4,level:2,decay:0.015}]},
    mr:{hpFreq:6000, bpFreq:9500, bpQ:1.0, noiseLevel:0.5, noiseDecay:0.07}
  }},
  fm808:{ name:'FM-808', desc:'Tief · warm · lang', voices:{
    bd:{baseFreq:50, startMult:2.2, pitchEndMult:0.28, pitchDecay:0.35, clickLevel:0.08, ampDecay:0.9,
        ops:[{ratio:1,level:0.6,decay:0.9,feedback:0.15},{ratio:1.5,level:3,decay:0.08}]},
    sd:{baseFreq:180, ampDecay:0.2, fmLevel:0.5, noiseFreqBase:1200, noiseFreqTune:600, noiseQ:0.6, noiseDecay:0.28, noiseLevel:0.7,
        ops:[{ratio:1,level:0.8,decay:0.25,feedback:0.1},{ratio:1.5,level:3,decay:0.05}]},
    lt:{baseFreq:70, startMult:1.4, pitchEndMult:0.6, pitchDecay:0.3, ampDecay:0.55,
        ops:[{ratio:1,level:0.7,decay:0.5,feedback:0.1},{ratio:1.8,level:2,decay:0.15}]},
    ht:{baseFreq:130, startMult:1.4, pitchEndMult:0.6, pitchDecay:0.3, ampDecay:0.55,
        ops:[{ratio:1,level:0.7,decay:0.5,feedback:0.1},{ratio:1.8,level:2,decay:0.15}]},
    rs:{baseFreq:400, ampDecay:0.08, fmLevel:0.45, clickLevel:0, clickFreq:3000,
        ops:[{ratio:1,level:1,decay:0.08},{ratio:2.4,level:5,decay:0.02,feedback:0.15}]},
    hc:{centerFreqBase:700, centerFreqTune:700, bursts:[0,0.015,0.03]},
    ch:{baseFreq:900, decayClosed:0.07, decayClosedAccent:0.11, decayOpen:0.6, decayOpenAccent:0.8, fmLevel:0.5, filterFreq:5000,
        ops:[{ratio:1,level:1,decay:1,feedback:0.9},{ratio:1.41,level:2.5,decay:0.6,feedback:0.3},{ratio:2.0,level:1.8,decay:0.35},{ratio:3.3,level:1.2,decay:0.25}]},
    oh:{baseFreq:900, decayClosed:0.07, decayClosedAccent:0.11, decayOpen:0.6, decayOpenAccent:0.8, fmLevel:0.5, filterFreq:5000,
        ops:[{ratio:1,level:1,decay:1,feedback:0.9},{ratio:1.41,level:2.5,decay:0.6,feedback:0.3},{ratio:2.0,level:1.8,decay:0.35},{ratio:3.3,level:1.2,decay:0.25}]},
    cy:{baseFreq:500, ampDecay:2.0, fmLevel:0.28, filterFreq:2000, noiseLevel:0.2, noiseDecay:1.8,
        ops:[{ratio:1,level:0.8,decay:1.8,feedback:0.8},{ratio:1.41,level:2,decay:1.2,feedback:0.3},{ratio:2.3,level:1.6,decay:0.8},{ratio:3.7,level:1.2,decay:0.5}]},
    // TODO: eigener FM-808-Charakter — vorerst Platzhalter vom Rock-Kit, s.o.
    cb:{engine:'sixosc', baseFreq:540, ratios:[1,1.48], bpFreq:620, bpQ:1.0, hpFreq:300, ampDecay:0.35, fmLevel:0.6},
    cl:{baseFreq:2600, ampDecay:0.045, fmLevel:0.5, clickLevel:0, clickFreq:3000,
        ops:[{ratio:1,level:0.4,decay:0.04,feedback:0.4},{ratio:2.4,level:2,decay:0.015}]},
    mr:{hpFreq:6000, bpFreq:9500, bpQ:1.0, noiseLevel:0.5, noiseDecay:0.07}
  }},
  real808:{ name:'808 AUTHENTIC', desc:'Original-Technik · 6-Osc Hats', voices:{
    // Kick: wie fm808, plus Impact-Noise-Burst (Beater-Transient neben dem Ton)
    bd:{baseFreq:52, startMult:2.1, pitchEndMult:0.3, pitchDecay:0.32, clickLevel:0.1, impactNoiseLevel:0.22, impactNoiseFreq:1800, ampDecay:0.85,
        ops:[{ratio:1,level:0.65,decay:0.85,feedback:0.15},{ratio:1.5,level:3,decay:0.08}]},
    // Snare: zwei getrennte Rauschbänder statt einem — Fell (tiefer) + Teppich-Sizzle (höher, länger)
    sd:{baseFreq:185, ampDecay:0.2, fmLevel:0.45, noiseFreqBase:1100, noiseFreqTune:500, noiseQ:0.6, noiseDecay:0.22, noiseLevel:0.55,
        wireNoiseLevel:0.7, wireFreq:3600, wireQ:0.45, wireDecay:0.32,
        ops:[{ratio:1,level:0.75,decay:0.22,feedback:0.1},{ratio:1.5,level:3,decay:0.05}]},
    lt:{baseFreq:72, startMult:1.4, pitchEndMult:0.6, pitchDecay:0.28, ampDecay:0.5,
        ops:[{ratio:1,level:0.7,decay:0.46,feedback:0.1},{ratio:1.8,level:2,decay:0.14}]},
    ht:{baseFreq:132, startMult:1.4, pitchEndMult:0.6, pitchDecay:0.28, ampDecay:0.5,
        ops:[{ratio:1,level:0.7,decay:0.46,feedback:0.1},{ratio:1.8,level:2,decay:0.14}]},
    rs:{baseFreq:410, ampDecay:0.08, fmLevel:0.42, clickLevel:0, clickFreq:3000,
        ops:[{ratio:1,level:1,decay:0.08},{ratio:2.4,level:5,decay:0.02,feedback:0.15}]},
    hc:{centerFreqBase:700, centerFreqTune:700, bursts:[0,0.015,0.03]},
    // Hi-Hat/Crash: originale 6-Oszillator-Technik statt FM — sechs Rechteckwellen auf
    // unharmonische Verhältnisse (aus der TR-808-Dokumentation), choke:true aktiviert
    // die Choke-Group (Closed-Hat kappt klingenden Open-Hat, wie am echten Kit).
    ch:{engine:'sixosc', baseFreq:105, ratios:[2,3,4.16,5.43,6.79,8.21], bpFreq:10000, bpQ:0.7, hpFreq:7000,
        decayClosed:0.06, decayClosedAccent:0.1, decayOpen:0.5, decayOpenAccent:0.7, fmLevel:0.55, choke:true},
    oh:{engine:'sixosc', baseFreq:105, ratios:[2,3,4.16,5.43,6.79,8.21], bpFreq:10000, bpQ:0.7, hpFreq:7000,
        decayClosed:0.06, decayClosedAccent:0.1, decayOpen:0.5, decayOpenAccent:0.7, fmLevel:0.55, choke:true},
    cy:{engine:'sixosc', baseFreq:95, ratios:[2,3,4.16,5.43,6.79,8.21,10.4], bpFreq:8000, bpQ:0.6, hpFreq:5500,
        ampDecay:2.2, fmLevel:0.4, noiseLevel:0.15, noiseDecay:1.8},
    // TODO: eigener 808-Authentic-Charakter — vorerst Platzhalter vom Rock-Kit, s.o.
    cb:{engine:'sixosc', baseFreq:540, ratios:[1,1.48], bpFreq:620, bpQ:1.0, hpFreq:300, ampDecay:0.35, fmLevel:0.6},
    cl:{baseFreq:2600, ampDecay:0.045, fmLevel:0.5, clickLevel:0, clickFreq:3000,
        ops:[{ratio:1,level:0.4,decay:0.04,feedback:0.4},{ratio:2.4,level:2,decay:0.015}]},
    mr:{hpFreq:6000, bpFreq:9500, bpQ:1.0, noiseLevel:0.5, noiseDecay:0.07}
  }},
  acid:{ name:'ACID DRIVE', desc:'Aggressiv · verzerrt', voices:{
    bd:{baseFreq:62, startMult:1.6, pitchEndMult:0.4, pitchDecay:0.05, clickLevel:0.4, ampDecay:0.16,
        ops:[{ratio:1,level:1.4,decay:0.18,feedback:0.7},{ratio:1.3,level:9,decay:0.03}]},
    sd:{baseFreq:230, ampDecay:0.07, fmLevel:0.5, noiseFreqBase:2200, noiseFreqTune:1200, noiseQ:1.4, noiseDecay:0.09, noiseLevel:1.0,
        ops:[{ratio:1,level:1.3,decay:0.08,feedback:0.5},{ratio:2.1,level:8,decay:0.012}]},
    lt:{baseFreq:110, startMult:1.6, pitchEndMult:0.45, pitchDecay:0.06, ampDecay:0.18,
        ops:[{ratio:1,level:1.2,decay:0.16,feedback:0.4},{ratio:2.2,level:4,decay:0.04}]},
    ht:{baseFreq:200, startMult:1.6, pitchEndMult:0.45, pitchDecay:0.06, ampDecay:0.18,
        ops:[{ratio:1,level:1.2,decay:0.16,feedback:0.4},{ratio:2.2,level:4,decay:0.04}]},
    rs:{baseFreq:520, ampDecay:0.04, fmLevel:0.6, clickLevel:0.35, clickFreq:4200,
        ops:[{ratio:1,level:1.2,decay:0.04},{ratio:3.6,level:10,decay:0.01,feedback:0.4}]},
    hc:{centerFreqBase:1000, centerFreqTune:1100, bursts:[0,0.008,0.016,0.026]},
    ch:{baseFreq:1300, decayClosed:0.045, decayClosedAccent:0.075, decayOpen:0.25, decayOpenAccent:0.32, fmLevel:0.6, filterFreq:7500,
        ops:[{ratio:1,level:1,decay:1,feedback:2.6},{ratio:1.41,level:5,decay:0.5,feedback:1.0},{ratio:2.0,level:3.5,decay:0.3},{ratio:3.3,level:2.5,decay:0.2}]},
    oh:{baseFreq:1300, decayClosed:0.045, decayClosedAccent:0.075, decayOpen:0.25, decayOpenAccent:0.32, fmLevel:0.6, filterFreq:7500,
        ops:[{ratio:1,level:1,decay:1,feedback:2.6},{ratio:1.41,level:5,decay:0.5,feedback:1.0},{ratio:2.0,level:3.5,decay:0.3},{ratio:3.3,level:2.5,decay:0.2}]},
    cy:{baseFreq:800, ampDecay:0.9, fmLevel:0.36, filterFreq:3500, noiseLevel:0.22, noiseDecay:0.7,
        ops:[{ratio:1,level:1.2,decay:0.8,feedback:2.0},{ratio:1.41,level:4,decay:0.5,feedback:0.7},{ratio:2.3,level:3,decay:0.3},{ratio:3.7,level:2.5,decay:0.2}]},
    // TODO: eigener Acid-Drive-Charakter — vorerst Platzhalter vom Rock-Kit, s.o.
    cb:{engine:'sixosc', baseFreq:540, ratios:[1,1.48], bpFreq:620, bpQ:1.0, hpFreq:300, ampDecay:0.35, fmLevel:0.6},
    cl:{baseFreq:2600, ampDecay:0.045, fmLevel:0.5, clickLevel:0, clickFreq:3000,
        ops:[{ratio:1,level:0.4,decay:0.04,feedback:0.4},{ratio:2.4,level:2,decay:0.015}]},
    mr:{hpFreq:6000, bpFreq:9500, bpQ:1.0, noiseLevel:0.5, noiseDecay:0.07}
  }},
  lofi:{ name:'LO-FI DUST', desc:'Gedämpft · vintage', voices:{
    bd:{baseFreq:55, startMult:1.5, pitchEndMult:0.5, pitchDecay:0.15, clickLevel:0.1, ampDecay:0.38,
        ops:[{ratio:1,level:0.8,decay:0.4,feedback:0.1},{ratio:1.3,level:2.5,decay:0.06}]},
    sd:{baseFreq:190, ampDecay:0.12, fmLevel:0.3, noiseFreqBase:1100, noiseFreqTune:400, noiseQ:0.7, noiseDecay:0.14, noiseLevel:0.5,
        ops:[{ratio:1,level:0.7,decay:0.14,feedback:0.05},{ratio:1.6,level:2,decay:0.03}]},
    lt:{baseFreq:85, startMult:1.3, pitchEndMult:0.55, pitchDecay:0.15, ampDecay:0.3,
        ops:[{ratio:1,level:0.7,decay:0.28,feedback:0.05},{ratio:1.8,level:1.6,decay:0.07}]},
    ht:{baseFreq:150, startMult:1.3, pitchEndMult:0.55, pitchDecay:0.15, ampDecay:0.3,
        ops:[{ratio:1,level:0.7,decay:0.28,feedback:0.05},{ratio:1.8,level:1.6,decay:0.07}]},
    rs:{baseFreq:420, ampDecay:0.05, fmLevel:0.35, clickLevel:0.12, clickFreq:2500,
        ops:[{ratio:1,level:0.8,decay:0.05},{ratio:3.1,level:5,decay:0.014,feedback:0.1}]},
    hc:{centerFreqBase:500, centerFreqTune:400, bursts:[0,0.014,0.03,0.05]},
    ch:{baseFreq:800, decayClosed:0.06, decayClosedAccent:0.1, decayOpen:0.35, decayOpenAccent:0.45, fmLevel:0.4, filterType:'lowpass', filterFreq:3500,
        ops:[{ratio:1,level:1,decay:1,feedback:1.2},{ratio:1.41,level:3,decay:0.6,feedback:0.4},{ratio:2.0,level:2,decay:0.35},{ratio:3.3,level:1.4,decay:0.25}]},
    oh:{baseFreq:800, decayClosed:0.06, decayClosedAccent:0.1, decayOpen:0.35, decayOpenAccent:0.45, fmLevel:0.4, filterType:'lowpass', filterFreq:3000,
        ops:[{ratio:1,level:1,decay:1,feedback:1.2},{ratio:1.41,level:3,decay:0.6,feedback:0.4},{ratio:2.0,level:2,decay:0.35},{ratio:3.3,level:1.4,decay:0.25}]},
    cy:{baseFreq:520, ampDecay:1.4, fmLevel:0.22, filterType:'lowpass', filterFreq:2200, noiseLevel:0.12, noiseDecay:1.1,
        ops:[{ratio:1,level:0.8,decay:1.2,feedback:0.8},{ratio:1.41,level:2,decay:0.8,feedback:0.3},{ratio:2.3,level:1.4,decay:0.5},{ratio:3.7,level:1,decay:0.35}]},
    // TODO: eigener Lo-Fi-Charakter — vorerst Platzhalter vom Rock-Kit, s.o.
    cb:{engine:'sixosc', baseFreq:540, ratios:[1,1.48], bpFreq:620, bpQ:1.0, hpFreq:300, ampDecay:0.35, fmLevel:0.6},
    cl:{baseFreq:2600, ampDecay:0.045, fmLevel:0.5, clickLevel:0, clickFreq:3000,
        ops:[{ratio:1,level:0.4,decay:0.04,feedback:0.4},{ratio:2.4,level:2,decay:0.015}]},
    mr:{hpFreq:6000, bpFreq:9500, bpQ:1.0, noiseLevel:0.5, noiseDecay:0.07}
  }},

};
// Ride (v72) für die Synth-Kits: aus dem Crash des Kits abgeleitet (heller, kürzer, weniger Rauschen); .bell = Glocke
function rideFromCy(cy){
  if(cy.engine==='sixosc'){
    const r=Object.assign({},cy,{baseFreq:cy.baseFreq*1.5, bpFreq:(cy.bpFreq||7500)+1500, bpQ:(cy.bpQ||0.55)*1.2, ampDecay:1.8, fmLevel:cy.fmLevel*0.7, noiseLevel:(cy.noiseLevel||0)*0.3, noiseDecay:1.0});
    r.bell=Object.assign({},r,{ratios:[1,1.48,2.76], baseFreq:cy.baseFreq*5, bpFreq:3200, bpQ:1.2, hpFreq:1400, ampDecay:1.3, fmLevel:cy.fmLevel*0.6, noiseLevel:0});
    return r;
  }
  const r=Object.assign({},cy,{baseFreq:cy.baseFreq*1.4, ampDecay:cy.ampDecay*0.8, fmLevel:cy.fmLevel*0.85, noiseLevel:cy.noiseLevel*0.35, noiseDecay:cy.noiseDecay*0.6});
  r.bell=Object.assign({},r,{baseFreq:cy.baseFreq*2.2, filterFreq:cy.filterFreq*1.5, ampDecay:cy.ampDecay*0.6, noiseLevel:cy.noiseLevel*0.1});
  return r;
}
Object.values(KITS).forEach(k=>{ if(k.voices && k.voices.cy && !k.voices.rd) k.voices.rd=rideFromCy(k.voices.cy); });
Object.values(KITS).forEach(k=>{ if(k.samples) k.voices=KITS.rock.voices; });
{ const R=KITS.rock.voices; // Latin: Synth-Ersatz, solange die Aufnahmen laden (Toms bzw. Maracas)
  KITS.latin.voices=Object.assign({},R,{cgh:R.lt,cgm:R.lt,tu:R.lt,bgh:R.ht,bgm:R.ht,bgl:R.ht,bglm:R.ht,tih:R.ht,til:R.lt,tb:R.mr,tbh:R.mr,tbr:R.mr}); }
// Spielweisen pro Step (v72, Mockup kit-stimmen-mockup.html Variante B): Drum-Spuren nutzen das sonst leere
// tr.notes[s] als Spielweise (0 = Standard). v = Sample-Stimme im Sample-Kit. Zieht automatisch mit beim
// Kopieren, Undo, Song-Clips, Länge ändern, Speichern und Beats.
// Rollen (#2 Stufe 1): wofür eine Stimme im Beat steht. Fill und Würfeln fragen die Rolle der Zeile ab statt fester
// IDs, damit eine getauschte Stimme (Stufe 2: z. B. Shaker auf der LT-Zeile) automatisch richtig behandelt wird.
// Feine Rollen fürs Verhalten; ROLE_GROUP fasst sie für die Anzeige zusammen (Kick · Snare · Hi-Hat · Tom · Becken · Perc).
const VOICE_ROLE={ bd:'kick', sd:'snare', rs:'rim', ch:'hat', hl:'hat', hf:'hat', oh:'openhat', lt:'tom', ht:'tom',
                   cy:'crash', rd:'ride', rb:'ride', hc:'clap', cb:'perc', cl:'perc', mr:'perc',
                   cgh:'perc', cgm:'perc', tu:'perc', bgh:'perc', bgm:'perc', bgl:'perc', bglm:'perc', tih:'perc', til:'perc', tb:'perc', tbh:'perc', tbr:'perc' };
// Stimmen, die keine eigene Zeile haben (Latin #60): Name und Kürzel für Set-Editor, Übersicht, Mixer
const VOICE_INFO={ cgh:{n:'CONGA',s:'CG'}, tu:{n:'TUMBA',s:'TU'}, bgh:{n:'BONGO HOCH',s:'BH'}, bgl:{n:'BONGO TIEF',s:'BL'},
                   tih:{n:'TIMBAL HOCH',s:'TH'}, til:{n:'TIMBAL TIEF',s:'TL'}, tb:{n:'SCHELLENKRANZ',s:'TB'} };
function voiceName(v){ const i=VOICE_INFO[v]; if(i) return i.n; const t=TRACKS.find(x=>x.id===v); return t?t.name:v.toUpperCase(); }
function voiceShort(v){ const i=VOICE_INFO[v]; return i ? i.s : v.toUpperCase(); }
const ROLE_GROUP={ kick:'Kick', snare:'Snare', rim:'Snare', hat:'Hi-Hat', openhat:'Hi-Hat', tom:'Tom', crash:'Becken', ride:'Becken', clap:'Perc', perc:'Perc' };
// Stufe 2: drumSet.voices[id]={t:'syn',kitId,v} = Zeile spielt Stimme v aus Kit kitId (ohne v: dieselbe Stimme).
// Mixer-Kanal, Gruppe, Noten, Tune/Laut bleiben an der Zeile; Klang, Rolle, Spielweisen und Name folgen der Stimme.
function trSwap(tr){ const o=drumSet.voices[tr.id]; return (o && o.t==='syn' && o.v && o.v!==tr.id && VOICE_FNS[o.v]) ? o.v : null; }
function trVoice(tr){ return trSwap(tr)||tr.id; }
function trLabel(tr){ const s=trSwap(tr); return s ? voiceName(s) : tr.name; }
function trShort(tr){ const s=trSwap(tr); return s ? voiceShort(s) : (tr.short||tr.id.toUpperCase()); }
function trRole(tr){ return VOICE_ROLE[trVoice(tr)]||'perc'; }
function roleTracks(role){ return TRACKS.filter(t=>t.type!=='arp' && !t.isSample && trRole(t)===role); }
const ART={ ch:[{k:'Z',n:'Zu',v:'ch'},{k:'L',n:'Locker',v:'hl'},{k:'P',n:'Pedal',v:'hf'}],
            rd:[{k:'F',n:'Fläche',v:'rd'},{k:'B',n:'Bell',v:'rb'}],
            // Crash (#56): frei ausklingen oder mit der Hand abstoppen — sofort, nach 1/16 oder nach 1/8 (tempoabhängig)
            cy:[{k:'C',n:'Crash',v:'cy'},{k:'K',n:'Kurz',v:'cy'},{k:'S',n:'1/16',v:'cy',st:1},{k:'A',n:'1/8',v:'cy',st:2}],
            // Latin (#60): Spielweisen = eigene Aufnahmen
            cgh:[{k:'O',n:'Offen',v:'cgh'},{k:'G',n:'Gedämpft',v:'cgm'}],
            bgh:[{k:'O',n:'Offen',v:'bgh'},{k:'G',n:'Gedämpft',v:'bgm'}],
            bgl:[{k:'O',n:'Offen',v:'bgl'},{k:'G',n:'Gedämpft',v:'bglm'}],
            tb:[{k:'S',n:'Schütteln',v:'tb'},{k:'A',n:'Schlag',v:'tbh'},{k:'W',n:'Wirbel',v:'tbr'}] };
function artOf(tr,a){ const L=ART[trVoice(tr)]; return L ? (L[a|0]||L[0]) : null; }
function artLetter(tr,abs){ const L=ART[trVoice(tr)]; if(!L || !(tr.steps[abs]>0)) return ''; const a=tr.notes?tr.notes[abs]|0:0; return a>0&&L[a]?L[a].k:''; }
function artSynth(tr,a,kp){ // Synth-Kits: Spielweise über die Parameter des Kits
  const v=trVoice(tr);
  if(v==='rd' && a===1) return kp.bell||kp;
  if(v!=='ch' || !a) return kp;
  const f=a===1?4:0.7, o=Object.assign({},kp,{decayClosed:kp.decayClosed*f, decayClosedAccent:kp.decayClosedAccent*f});
  if(kp.ops) o.ops=kp.ops.map(x=>Object.assign({},x,{decay:x.decay*f}));
  if(a===2) o.fmLevel=kp.fmLevel*0.6; // Pedal: leiser, kurz
  return o;
}
let currentKitId='rock';

const VOICE_FNS={
  bd:playKick, sd:playSnare, lt:playTom, ht:playTom, rs:playRim, hc:playClap,
  // Kits mit kp.engine==='sixosc' nutzen die originale 6-Oszillator-Technik
  // (siehe playMetallicSix), alle anderen bleiben beim bisherigen FM-Ansatz —
  // so bleiben alte und neue Kits direkt vergleichbar.
  ch:(t,v,tu,a,kp)=> kp.engine==='sixosc' ? playMetallicSix(t,v,tu,a,kp,'closed') : playHat(t,v,tu,a,kp,false),
  oh:(t,v,tu,a,kp)=> kp.engine==='sixosc' ? playMetallicSix(t,v,tu,a,kp,'open') : playHat(t,v,tu,a,kp,true),
  cy:(t,v,tu,a,kp)=> kp.engine==='sixosc' ? playMetallicSix(t,v,tu,a,kp,'cymbal') : playCrash(t,v,tu,a,kp),
  rd:(t,v,tu,a,kp)=> kp.engine==='sixosc' ? playMetallicSix(t,v,tu,a,kp,'cymbal') : playCrash(t,v,tu,a,kp),
  // Cowbell: dieselbe Oszillatorbank/Filterkette wie Hi-Hat/Crash (playMetallicSix,
  // Modus 'cymbal'), aber mit nur 2 statt 6 Ratios (klassisches zwei-Ton-808-Cowbell-
  // Verhältnis) — kein neuer Code nötig, nur ein anderes Preset auf derselben Engine.
  cb:(t,v,tu,a,kp)=> playMetallicSix(t,v,tu,a,kp,'cymbal'),
  // Claves: wiederverwendet playRim (kurzer FM-Klick) ohne den zusätzlichen
  // Noise-Klick-Layer (clickLevel:0 im Preset) — klingt trocken/hölzern statt metallisch.
  cl: playRim,
  mr: playMaracas,
  cgh:playTom, tu:playTom, bgh:playTom, bgl:playTom, tih:playTom, til:playTom, tb:playMaracas // Latin: nur Ersatz, solange die Aufnahmen laden
};
// Drum-Set: pro Stimme optional eine eigene Quelle statt des Basis-Kits. drumSet.voices[id] = {t:'syn',kitId} | {t:'smp',sampleId};
// ohne Eintrag folgt die Stimme dem Basis-Kit (currentKitId). drumSet.buffers[id] = dekodierte Samples. Fehlt ein Sample: Fallback auf Synth.
const drumSet={voices:{}, buffers:{}};
let currentSet={id:null, name:null, dirty:false}; // geladenes eigenes Set (oder null = Standard-Kit), dirty = ungespeicherte Änderungen
let lastOpenSample=null;
function voiceKitId(id){ const v=drumSet.voices[id]; return (v && v.t==='syn' && KITS[v.kitId]) ? v.kitId : currentKitId; }
function chokeOpenSample(time){
  if(!lastOpenSample) return; const o=lastOpenSample; lastOpenSample=null;
  try{ o.g.gain.cancelScheduledValues(time); o.g.gain.setValueAtTime(o.g.gain.value, time); o.g.gain.linearRampToValueAtTime(0.0001, time+0.025); o.src.stop(time+0.03); }catch(e){}
}
function playDrumSample(tr, time, velocity){
  const b=drumSet.buffers[tr.id]; if(!b || !audioCtx) return false;
  const src=audioCtx.createBufferSource(); src.buffer=b.buffer; src.playbackRate.value=Math.pow(2,(tr.tune-0.5)*2);
  const g=audioCtx.createGain(); g.gain.value=Math.max(0.0001, tr.vol*velocity*0.8);
  src.connect(g).connect(getBus());
  src.start(time, Math.min(b.offset||0, Math.max(0,b.buffer.duration-0.01)));
  if(tr.id==='oh') lastOpenSample={src,g};
  return true;
}
// =========================================================================
// SAMPLE-KITS — echte Aufnahmen (Quellen/Lizenzen: samples/README.md).
// Pro Stimme 4 Lautstärke-Layer passend zu den 4 Velocity-Stufen (Ghost leise,
// Ghost, Normal, Akzent) × 3 Round-Robins, pro Schlag minimale Variation
// (±8 Cent, ±1,5 dB) und ein kurzer Raum. Jede Stimme ist auf die Lautheit der
// Studio-Stimme abgeglichen. Lädt erst, wenn ein Kit gebraucht wird.
// Datei samples/<kit>/<stimme>.mp3: Sync-Klick bei 0 s, ab 0,1 s zwölf Slots
// (Layer 1–4 × Round Robin 1–3) zu je SMP_LEN[stimme] Sekunden.
// =========================================================================
const SMP_LEN={bd:0.9, sd:0.7, rs:0.6, ch:0.5, hl:0.9, hf:0.6, oh:2.5, lt:2.0, ht:1.8, cy:4.0, rd:3.5, rb:3.5,
  cgh:1.2, cgm:0.5, tu:1.4, bgh:0.8, bgm:0.4, bgl:0.9, bglm:0.45, tih:1.6, til:1.8, tb:0.6, tbh:0.9, tbr:1.6}; // Latin = LEN in tools/build-latin.py
const STUDIO_LAYER_VEL=[0.15,0.35,0.85,1.3]; // = VEL_GHOST_SOFT, VEL_GHOST, VEL_NORMAL, VEL_ACCENT
const STUDIO_GAIN={bd:1.0, sd:0.9, rs:0.8, ch:0.55, hl:0.55, hf:0.22, oh:0.5, lt:0.85, ht:0.8, cy:0.55, rd:0.6, rb:0.55,
  cgh:0.85, cgm:0.8, tu:0.85, bgh:0.8, bgm:0.8, bgl:0.8, bglm:0.8, tih:0.9, til:0.9, tb:0.55, tbh:0.55, tbr:0.55}; // Latin wie die Referenz-Stimme beim Bau
const STUDIO_OUT=1.75;  // Gesamtpegel, abgeglichen mit dem Rock Kit (tests/test-audio.py)
const STUDIO_ROOM=0.22; // Anteil Raum
const smp={};            // smp[kitId]={state:'loading'|'ready'|'error', buf:{stimme:[layer][rr]={b,off,dur}}, promise}
const smpRR={}, smpRooms=new WeakMap();
// Klang-Optionen der Sample-Kits (Kit-Auswahl → „Klang“, gespeichert mit dem Pattern):
// layers = 4 Lautstärke-Aufnahmen statt einer, rr = 3 Aufnahmen abwechseln, vari 0–100 (50 = ±8 Cent/±1,5 dB), room 0–0,6
const SMP_OPT_DEF={layers:true, rr:true, vari:50, room:STUDIO_ROOM};
const smpOpt=Object.assign({},SMP_OPT_DEF);
function smpKitsInUse(){ // Sample-Kits, die gerade klingen (Basis-Kit + Set-Stimmen) samt Ersatz-Kit
  const s=new Set(); const add=id=>{ const k=KITS[id]; if(k && k.samples){ s.add(id); if(k.samples.fallback) s.add(k.samples.fallback); } };
  add(currentKitId); Object.values(drumSet.voices).forEach(v=>{ if(v && v.t==='syn') add(v.kitId); });
  return [...s];
}
function smpChipText(kid,t){ const c=KITS[kid]._chip; if(c){ const d=c.querySelector('.kd'); if(d) d.textContent=t; } }
// Größe am Chip (mobil sinnvoll), nach dem Laden zusätzlich „gespeichert“. smpCached[kit]=true, sobald alle Dateien im Cache liegen oder einmal geladen wurden.
const smpCached={};
function smpMB(kb){ return (kb/1024).toFixed(1).replace('.',',')+' MB'; }
function smpIdleText(kid){
  const k=KITS[kid]; if(!k || !k.samples) return '';
  const fb=k.samples.fallback, kb=k.samples.kb+(fb ? KITS[fb].samples.kb : 0); // feste Zahl: alles, was das Kit braucht
  return k.desc+' · '+smpMB(kb)+(smpCached[kid] && (!fb || smpCached[fb]) ? ' · gespeichert' : '');
}
function smpChipIdle(){ Object.keys(KITS).forEach(kid=>{ if(KITS[kid].samples && (!smp[kid] || smp[kid].state==='ready')) smpChipText(kid,smpIdleText(kid)); }); }
function smpCheckCache(){
  if(!window.caches) return Promise.resolve();
  return Promise.all(Object.keys(KITS).filter(kid=>KITS[kid].samples).map(kid=>{ const sm=KITS[kid].samples;
    return Promise.all(sm.voices.map(id=>caches.match('samples/'+sm.dir+'/'+id+'.mp3'))).then(r=>{ if(r.every(Boolean)) smpCached[kid]=true; }).catch(()=>{});
  })).then(smpChipIdle);
}
function smpLoad(kid){
  const k=KITS[kid]; if(!k || !k.samples) return Promise.resolve();
  if(k.samples.fallback) smpLoad(k.samples.fallback);
  if(smp[kid] && smp[kid].promise) return smp[kid].promise;
  const st=smp[kid]={state:'loading', buf:{}, promise:null};
  const Ctor=window.OfflineAudioContext||window.webkitOfflineAudioContext;
  const dc=new Ctor(1,1,44100); // nur zum Dekodieren, braucht keinen Tipp zum Starten
  const decode=ab=>new Promise((res,rej)=>{ const r=dc.decodeAudioData(ab,res,rej); if(r && r.then) r.then(res,rej); });
  const ids=k.samples.voices; let done=0;
  const jobs=ids.map(id=>fetch('samples/'+k.samples.dir+'/'+id+'.mp3').catch(()=>{ throw Object.assign(new Error('net'),{net:true}); }).then(x=>{ if(!x.ok) throw new Error(x.status); return x.arrayBuffer(); })
    .then(decode).then(b=>{
      const d=b.getChannelData(0), sr=b.sampleRate, L=SMP_LEN[id];
      let c=0; while(c<d.length && c<sr*0.3 && Math.abs(d[c])<0.4) c++; // Sync-Klick = Dateianfang, MP3-Vorlauf egal
      const t0=c/sr+0.1, set=[[],[],[],[]];
      for(let l=0;l<4;l++) for(let r=0;r<3;r++){
        const s=t0+(l*3+r)*L, a=Math.floor(s*sr), e=Math.min(d.length,Math.floor((s+L)*sr));
        let pk=0; for(let i=a;i<e;i++){ const v=Math.abs(d[i]); if(v>pk) pk=v; }
        let i=a; while(i<e && Math.abs(d[i])<pk*0.02) i++;
        set[l][r]={b, off:Math.max(s,i/sr-0.0015), dur:L-0.02};
      }
      st.buf[id]=set; done++; smpChipText(kid,'Lädt … '+Math.round(done/ids.length*100)+' %');
    }));
  st.promise=Promise.all(jobs).then(()=>{ st.state='ready'; smpCached[kid]=true; smpChipIdle(); })
    .catch(e=>{ st.state='error'; st.promise=null;
      smpChipText(kid, (navigator.onLine===false || (e && e.net)) ? 'Offline · Kit noch nicht gespeichert' : 'Laden fehlgeschlagen · antippen = erneut'); });
  return st.promise;
}
function smpFree(keep){ // Speicher: dekodierte Kits, die gerade nicht klingen, wieder freigeben (lädt bei Bedarf neu)
  Object.keys(smp).forEach(k=>{ if(keep.indexOf(k)<0 && smp[k].state!=='loading'){ delete smp[k]; smpChipText(k,smpIdleText(k)); } });
}
function smpSet(kid,id){ // Aufnahme des Kits, sonst des Ersatz-Kits; null = noch nicht da
  const k=KITS[kid]; if(!k || !k.samples) return null;
  const st=smp[kid];
  if(!st || st.state!=='ready'){ if(!st) smpLoad(kid); return null; }
  if(st.buf[id]) return st.buf[id];
  return k.samples.fallback ? smpSet(k.samples.fallback,id) : null;
}
function smpRoom(dest){ // ein Raum je AudioContext (Live und WAV-Export getrennt) und Ziel (Gruppe bzw. Master), damit Gruppen-Mute/Laut/FX auch den Raum treffen (#42)
  dest=dest||master; let rs=smpRooms.get(audioCtx); if(!rs){ rs=new Map(); smpRooms.set(audioCtx,rs); }
  let r=rs.get(dest);
  if(!r){
    const sr=audioCtx.sampleRate, len=Math.floor(sr*0.9), ir=audioCtx.createBuffer(2,len,sr);
    for(let ch=0;ch<2;ch++){ const d=ir.getChannelData(ch); let seed=ch?7:3;
      for(let i=0;i<len;i++){ seed=(seed*16807)%2147483647; const t=i/sr; d[i]=(seed/2147483647*2-1)*Math.exp(-t*7.5)*(t<0.004?t/0.004:1)*0.6; }
      [0.007,0.011,0.017,0.023,0.031].forEach((t,k)=>{ d[Math.floor((t+ch*0.0013)*sr)]+=(k%2?-1:1)*0.5/(k+1); });
    }
    const input=audioCtx.createGain(); input.gain.value=STUDIO_ROOM;
    const hp=audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=180;
    const conv=audioCtx.createConvolver(); conv.buffer=ir;
    input.connect(hp).connect(conv).connect(dest);
    r={input}; rs.set(dest,r);
  }
  if(r.input.gain.value!==smpOpt.room) r.input.gain.value=smpOpt.room;
  return r.input;
}
// Spielt einen Sample-Schlag. false = (noch) keine Aufnahme → Aufrufer nimmt den Synth.
function smpPlay(kid, tr, time, velocity, choked, vid){
  vid=vid||tr.id; const set=smpSet(kid,vid); if(!set || !audioCtx) return false;
  let l=2, fine;
  if(smpOpt.layers){ l=0; for(let i=1;i<4;i++) if(Math.abs(STUDIO_LAYER_VEL[i]-velocity)<Math.abs(STUDIO_LAYER_VEL[l]-velocity)) l=i;
    fine=Math.pow(Math.max(0.05,velocity)/STUDIO_LAYER_VEL[l],0.7); } // Zwischenwerte (Humanize, Pads)
  else fine=Math.pow(Math.max(0.05,velocity)/STUDIO_LAYER_VEL[2],1.1); // nur eine Aufnahme, Stärke nur über Lautstärke
  const arr=set[l], key=kid+vid+l, last=smpRR[key]; let r=0;
  if(smpOpt.rr){ do{ r=Math.floor(Math.random()*arr.length); }while(arr.length>1 && r===last); }
  smpRR[key]=r; const s=arr[r];
  const vr=(+smpOpt.vari||0)/50;
  const src=audioCtx.createBufferSource(); src.buffer=s.b;
  src.playbackRate.value=Math.pow(2,(tr.tune-0.5)*2+vr*(Math.random()*16-8)/1200);
  const g=audioCtx.createGain();
  const gv=Math.max(0.0001, tr.vol*(STUDIO_GAIN[vid]||0.6)*STUDIO_OUT*fine*Math.pow(10,vr*(Math.random()*3-1.5)/20));
  g.gain.value=gv;
  src.connect(g); g.connect(getBus()); g.connect(smpRoom(grpIn(tr)));
  src.start(time, s.off, s.dur);
  if(choked){ const h=typeof choked==='number' ? Math.max(0.06,choked) : 0.06; g.gain.setValueAtTime(gv,time+h); g.gain.linearRampToValueAtTime(0.0001,time+h+0.04); src.stop(time+h+0.05); } // choked: true = kurz, Zahl = Sekunden bis zum Abgreifen
  if(vid==='oh' || vid==='hl') lastOpenSample={src,g}; // offene/lockere Hi-Hat: nächster Hi-Hat-Schlag würgt ab
  return true;
}
// Regler „Klang“ in der Kit-Auswahl (Mockup kit-klang-mockup.html, Variante B, eingeklappt)
function smpOptHTML(){
  const seg=(k,a,b)=>'<div class="am-seg" data-k="'+k+'"><button data-v="1" class="'+(smpOpt[k]?'on':'')+'">'+a+'</button><button data-v="0" class="'+(smpOpt[k]?'':'on')+'">'+b+'</button></div>';
  return '<div class="ko-l">Lautstärken</div>'+seg('layers','4 STUFEN','1 STUFE')
    +'<div class="ko-h">4 Stufen: leise Schläge sind eigene Aufnahmen. 1 Stufe: nur leiser gedreht.</div>'
    +'<div class="ko-l">Abwechseln</div>'+seg('rr','3 AUFNAHMEN','IMMER GLEICH')
    +'<div class="srow"><label>Variation</label><input type="range" min="0" max="100" step="1" data-k="vari" value="'+smpOpt.vari+'" aria-label="Variation"><b>'+Math.round(smpOpt.vari)+'%</b></div>'
    +'<div class="ko-h">Pro Schlag minimal andere Tonhöhe und Lautstärke. 0 % = maschinengenau.</div>'
    +'<div class="srow"><label>Raum</label><input type="range" min="0" max="60" step="1" data-k="room" value="'+Math.round(smpOpt.room*100)+'" aria-label="Raum"><b>'+Math.round(smpOpt.room*100)+'%</b></div>'
    +'<button class="ko-reset">Zurück auf Standard</button>';
}
function smpOptFill(box){
  box.innerHTML=smpOptHTML();
  box.querySelectorAll('.am-seg[data-k] button').forEach(b=>b.onclick=()=>{ smpOpt[b.parentNode.dataset.k]=b.dataset.v==='1'; smpOptRender(); });
  box.querySelectorAll('input[data-k]').forEach(inp=>inp.oninput=()=>{ const k=inp.dataset.k, v=+inp.value; smpOpt[k]=k==='room'?v/100:v; inp.nextElementSibling.textContent=v+'%'; });
  box.querySelector('.ko-reset').onclick=()=>{ Object.assign(smpOpt,SMP_OPT_DEF); smpOptRender(); };
}
function smpOptToggle(chip){
  const box=chip.querySelector('.kit-opts'), btn=chip.querySelector('.kit-kl'), open=box.hidden;
  document.querySelectorAll('#kitPickerList .kit-opts').forEach(b=>{ b.hidden=true; const k=b.parentNode.querySelector('.kit-kl'); if(k) k.setAttribute('aria-expanded','false'); });
  if(open){ smpOptFill(box); box.hidden=false; btn.setAttribute('aria-expanded','true'); }
}
function smpOptRender(){ document.querySelectorAll('#kitPickerList .kit-opts').forEach(b=>{ if(!b.hidden) smpOptFill(b); }); }
function smpOptCollapse(){ document.querySelectorAll('#kitPickerList .kit-opts').forEach(b=>{ b.hidden=true; const k=b.parentNode.querySelector('.kit-kl'); if(k) k.setAttribute('aria-expanded','false'); }); }
function triggerTrack(tr, time, velocity, art){
  currentTrackBus = tr.bus || master;
  const vid=trVoice(tr);
  if(vid==='ch') chokeOpenSample(time); // Closed Hat kappt ein klingendes Open-Hat-Sample
  if(tr.type==='arp'){ triggerArpStep(time, tr, 0, velocity, false); return; } // Preview: Grundton
  if(tr.isSample){ playSample(time, tr.vol, tr.tune, velocity); return; }
  const ov=drumSet.voices[tr.id];
  if(ov && ov.t==='smp' && playDrumSample(tr, time, velocity)) return;
  if(vid==='cy' && art>0){ const C=ART.cy[art]; triggerChokedCrash(time, tr, velocity, C&&C.st ? C.st*stepDuration() : 0); return; }
  const kid=voiceKitId(tr.id), A=artOf(tr,art);
  if(KITS[kid].samples && smpPlay(kid, tr, time, velocity, false, A?A.v:vid)) return;
  const kp=artSynth(tr, art|0, KITS[kid].voices[vid]);
  VOICE_FNS[vid](time, tr.vol, tr.tune, velocity, kp);
}
// "Choked" Crash: derselbe Crash des aktuellen Kits, mit der Hand abgestoppt
// statt frei ausklingend. Funktioniert für beide Crash-Engines (FM und
// 6-Oszillator) und Sample-Kits.
//
// Wichtig: Das trockene Signal allein reicht nicht — ist auf der Crash-Spur
// Hall oder Delay aufgedreht, würde der Nachhall unabhängig vom Choke normal
// weiterklingen und den Stopp-Effekt komplett überdecken. Deshalb werden die
// Send-Gains dieser Spur für die Dauer des Chokes kurz "geduckt" (runter und
// wieder hoch), unabhängig davon, wie Hall/Delay eingestellt sind.
// hold (#56): 0 = kurz (auch im Fill: nach 60 ms gegriffen, Sends geduckt), sonst Sekunden bis zum Abgreifen
// (1/16 bzw. 1/8 des Tempos). Das Becken klingt immer voll an und wird über eine eigene Gain-Stufe vor dem
// Spur-Bus ausgeblendet (Samples: smpPlay mit choked=Sekunden); beim späten Greifen klingt der Hall nach.
function triggerChokedCrash(time, tr, velocity, hold){
  currentTrackBus = tr.bus || master;
  const ovc=drumSet.voices[tr.id], vid=trVoice(tr);
  if(ovc && ovc.t==='smp' && playDrumSample(tr, time, velocity)) return;
  if(!(hold>0)){ // Kurz: Hall/Delay-Sends kurz ducken, sonst überdeckt der Nachhall den Stopp
    const duckHold=0.11, duckRelease=0.09; // Sekunden: wie lange stumm, wie schnell zurück zur normalen Stärke
    const duckLead=0.006; // Send muss VOR dem Anschlag unten sein — Faltungshall lässt sich danach nicht mehr "zurückrufen"
    [tr.sendGain, tr.delaySendGain].forEach(g=>{
      if(!g) return;
      const normalLevel=g.gain.value;
      if(normalLevel<=0) return;
      g.gain.cancelScheduledValues(time-duckLead);
      g.gain.setValueAtTime(normalLevel, Math.max(0,time-duckLead-0.001));
      g.gain.linearRampToValueAtTime(0.0001, time-duckLead);
      g.gain.setValueAtTime(0.0001, time+duckHold);
      g.gain.linearRampToValueAtTime(normalLevel, time+duckHold+duckRelease);
    });
  }
  const h=hold>0 ? Math.max(0.06,hold) : 0.06; // Zeit bis zum Abgreifen; Anschlag bleibt in jeder Stufe voll
  const ck=voiceKitId(tr.id); if(KITS[ck].samples && smpPlay(ck, tr, time, velocity, h, vid)) return;
  const cut=audioCtx.createGain(); cut.connect(tr.bus || master); currentTrackBus=cut;
  cut.gain.setValueAtTime(1, time+h); cut.gain.linearRampToValueAtTime(0.0001, time+h+0.04);
  const kp=KITS[ck].voices[vid]||KITS[ck].voices.cy;
  if(kp.engine==='sixosc') playMetallicSix(time, tr.vol, tr.tune, velocity, kp, 'cymbal');
  else playCrash(time, tr.vol, tr.tune, velocity, kp);
  currentTrackBus = tr.bus || master;
}
