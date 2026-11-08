# WebCLAP-Machbarkeitstest (#67)
Testseite: https://andy-baker.github.io/Drumstar/docs/test/wclap/ – kein Teil der App.

Fremdcode (unverändert, nur für diesen Test):
- `vendor/clap-audionode/` aus github.com/WebCLAP/browser-test-host @ b42ade6 (Geraint Luff / Signalsmith Audio) – **keine Lizenzdatei im Repo, vor einem Einbau in die App klären**
- `vendor/clap-audionode/wclap-js/` aus github.com/WebCLAP/wclap-js @ c9ffa8c (Version, gegen die `host.wasm` gebaut ist); `es6/targz.mjs` MIT; `es6/wasi/` aus WebCLAP/wasi.wasm @ bf488c5, MIT
- `plugins/oxo-synth2.wclap.tar.gz` + `oxo-synth2-patches.json`: Oxo Synth2 (chab, MIT), Build aus github.com/andremichelle/open-webclap; flach neu gepackt (`module.wasm` oben), weil der Loader dieser Host-Version keinen Unterordner findet
- `plugins/clack_plugin_polysynth.wasm`: clack-Beispiel (MIT/Apache) aus WebCLAP/examples

Eigenes: `index.html`, `note-feeder.js` (schickt CLAP-Noten-Events über `globalThis.clapRouting` an den Host-Prozessor im selben AudioWorklet).
Lektionen: Host-Knoten braucht einen (stillen) Eingang, sonst rechnet Chrome ihn nach dem Laden nie mehr. Live-CPU im Worklet ohne Cross-Origin-Isolation unbrauchbar (keine genaue Uhr) → Rechenlast per OfflineAudioContext (Renderzeit / Audiodauer).
