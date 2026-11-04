"""Drumstar-Tests starten (Playwright, headless Chromium, 390x844).

Aufruf aus dem Repo-Ordner:
    python3 tests/run.py            # alle Tests
    python3 tests/run.py editor ui  # nur ausgewählte (audio | ui | editor | fx | walkthrough)
    python3 tests/run.py schnell    # alles außer audio (~2 min statt ~8½ min)

Wann welcher Satz: siehe CLAUDE.md („Tests“). audio (~6½ min) nur bei Änderungen am Klang.

Voraussetzung (einmalig):  pip install playwright && python3 -m playwright install chromium

Ablauf: Repo wird in einen Temp-Ordner kopiert, dort in js/*.js (Datei mit der Hook-Stelle) der Test-Hook
(tests/hook.js: window.__T, __sel, __pv, __audio …) eingesetzt und ein lokaler Server gestartet. Die echten
Dateien bleiben unverändert. Screenshots landen in tests/out/ (nicht im Git).
Kein Hörtest: Klang und Last am Gerät beurteilen.
"""
import pathlib, shutil, socket, subprocess, sys, tempfile, time

ROOT = pathlib.Path(__file__).resolve().parent.parent
TESTS = pathlib.Path(__file__).resolve().parent
OUT = TESTS / 'out'
HOOK_FROM = "let activeTrackIdx=0;"
HOOK_TO = HOOK_FROM + "\n" + (pathlib.Path(__file__).resolve().parent / "hook.js").read_text(encoding="utf8")

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

def main():
    pick = sys.argv[1:] or ['audio', 'ui', 'editor', 'fx', 'walkthrough', 'sw', 'tempo']
    if pick == ['schnell']: pick = ['ui', 'editor', 'fx', 'walkthrough', 'sw', 'tempo']
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='drumstar-test-'))
    site = tmp / 'site'
    shutil.copytree(ROOT, site, ignore=shutil.ignore_patterns('.git', 'tests'))
    hits = [f for f in sorted((site / 'js').glob('*.js')) if HOOK_FROM in f.read_text(encoding='utf8')]
    if len(hits) != 1:
        sys.exit(f'Test-Hook: "{HOOK_FROM}" muss in genau einer Datei unter js/ stehen (gefunden: {len(hits)})')
    hits[0].write_text(hits[0].read_text(encoding='utf8').replace(HOOK_FROM, HOOK_TO, 1), encoding='utf8')
    port = free_port(); url = f'http://127.0.0.1:{port}/index.html'
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'],
                           cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    results = {}
    try:
        for name in pick:
            out = OUT / name; out.mkdir(parents=True, exist_ok=True)
            script = str(TESTS / f'test-{name}.py')
            args = {'ui': [script, str(out), url],
                    'editor': [script, url, str(out)],
                    'fx': [script, url, str(out)],
                    'walkthrough': [script, 'X', url, str(out)],
                    'sw': [script, url, str(out), str(site)],
                    'tempo': [script, url, str(out)]}.get(name, [script, url])
            print(f'\n=== {name} ===', flush=True)
            results[name] = subprocess.call([sys.executable] + args) == 0
    finally:
        srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
    print('\n' + '  '.join(f"{n}: {'OK' if ok else 'FEHLER'}" for n, ok in results.items()))
    print(f'Screenshots: {OUT}')
    sys.exit(0 if all(results.values()) else 1)

if __name__ == '__main__':
    main()
