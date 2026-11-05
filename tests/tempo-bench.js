// Tempo-Erkennung auswerten (ohne Browser): node tests/tempo-bench.js js/tempo-detect.js META.json [-v] [--json]
// Läuft BpmDetector wie die UI (Schätzung je Sekunde, gleiche Stopp-Regel) über alle Clips aus META.json.
// Clips erzeugt tests/tempo-bench.py.
// node ev.js algo.js [-v] → alle Clips, Simulation wie UI (Schätzung je s, Stopp-Regel)
const fs=require('fs'); const algo=process.argv[2], verbose=process.argv.includes('-v'), json=process.argv.includes('--json');
const src=fs.readFileSync(algo,'utf8').split('// ---- UI ----')[0];
const A=new Function(src+'\nreturn {BpmDetector,bpmEstimate,tdStopRule:typeof tdStopRule!=="undefined"?tdStopRule:null};')();
function readWav(p){ const b=fs.readFileSync(p); const d=b.subarray(44); const x=new Float32Array(d.length/2); for(let i=0;i<x.length;i++) x[i]=d.readInt16LE(i*2)/32768; return x; }
const meta=JSON.parse(fs.readFileSync(process.argv[3]));
const stopRule=A.tdStopRule||((h,t,r)=>{ const q=h.slice(-4).map(o=>o.bpm); return t>=6&&q.length===4&&Math.max(...q)-Math.min(...q)<=1.2&&r.conf>.35; });
const cls=(v,t)=>v==null?'none':Math.abs(v-t)/t<=.02?'ok':[2,.5].some(k=>Math.abs(v*k-t)/t<=.02)?'okt':'FAIL';
const S={}; let tot={n:0,f:0,fo:0,s:0,so:0,tt:0};
for(const m of meta){ const x=readWav(m.f), sr=48000, d=A.BpmDetector(sr); const hist=[]; let last=0, stop=null;
  for(let i=0;i+128<=x.length;i+=128){ d.push(x.subarray(i,i+128)); const t=(i+128)/sr;
    if(!stop && t-last>=1 && d.seconds()>=4){ last=t; const r=d.estimate(); if(r){ hist.push(r); if(stopRule(hist,t,r)) stop={t,bpm:r.bpm,conf:r.conf}; } } }
  const fin=d.estimate(); if(!stop) stop={t:15,bpm:fin.bpm,conf:fin.conf,timeout:1};
  const cf=cls(fin.bpm,m.bpm), cs=cls(stop.bpm,m.bpm);
  const k=m.v; S[k]=S[k]||{n:0,f:0,s:0,so:0,tt:0}; S[k].n++; S[k].f+=cf==='ok'; S[k].s+=cs==='ok'; S[k].so+=cs!=='FAIL'; S[k].tt+=stop.t;
  tot.n++; tot.f+=cf==='ok'; tot.fo+=cf!=='FAIL'; tot.s+=cs==='ok'; tot.so+=cs!=='FAIL'; tot.tt+=stop.t;
  if(verbose && cs!=='ok') console.log(m.f.padEnd(40), 'soll', m.bpm, 'final', fin.bpm.toFixed(1), cf, '| stop', stop.bpm.toFixed(1), 'nach', stop.t.toFixed(0)+'s', cs, 'conf', stop.conf.toFixed(2), 'verlauf', hist.map(h=>Math.round(h.bpm)).join(' '));
}
for(const k in S) console.log(k.padEnd(6), `final ${S[k].f}/${S[k].n}  stopp ${S[k].s}/${S[k].n} (inkl. Okt ${S[k].so})  Ø ${(S[k].tt/S[k].n).toFixed(1)} s`);
console.log(`GESAMT final ${tot.f}/${tot.n} (Okt ${tot.fo})  stopp ${tot.s}/${tot.n} (Okt ${tot.so})  Ø ${(tot.tt/tot.n).toFixed(1)} s`);
if(json) console.log('JSON'+JSON.stringify({n:tot.n, stop:tot.s, stopOkt:tot.so}));
