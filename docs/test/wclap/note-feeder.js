// Drumstar WebCLAP-Test (#67): schickt Noten vom Hauptthread an die WCLAP-Prozessoren im selben AudioWorklet-Scope.
// Der Host (vendor/clap-audionode) liest pro Block globalThis.clapRouting[id].events und gibt sie ans Plugin.
if (!globalThis.clapRouting) globalThis.clapRouting = Object.create(null);
class NoteFeeder extends AudioWorkletProcessor {
	constructor() {
		super();
		this.port.onmessage = e => {
			const d = e.data;
			if (d.bytes) {
				const ids = d.target != null ? [d.target] : Object.keys(globalThis.clapRouting);
				ids.forEach(id => { const r = globalThis.clapRouting[id]; if (r) r.events.push(new Uint8Array(d.bytes)); });
			} else if (d.probe != null) {
				const r = globalThis.clapRouting[d.probe]; this.port.postMessage({probe: r ? r.events.length : -1});
			} else if (d.keys) {
				this.port.postMessage({keys: Object.keys(globalThis.clapRouting)});
			}
		};
	}
	process() { return true; }
}
registerProcessor('drumstar-note-feeder', NoteFeeder);
