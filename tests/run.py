"""Drumstar-Tests starten (Playwright, headless Chromium, 390x844).

Aufruf aus dem Repo-Ordner:
    python3 tests/run.py            # alle Tests
    python3 tests/run.py editor ui  # nur ausgewählte (audio | ui | editor | walkthrough)

Voraussetzung (einmalig):  pip install playwright && python3 -m playwright install chromium

Ablauf: Repo wird in einen Temp-Ordner kopiert, dort in index.html der Test-Hook
(tests/hook.js: window.__T, __sel, __pv, __audio …) eingesetzt und ein lokaler Server gestartet. Die echte
index.html bleibt unverändert. Screenshots landen in tests/out/ (nicht im Git).
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
    pick = sys.argv[1:] or ['audio', 'ui', 'editor', 'walkthrough']
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='drumstar-test-'))
    site = tmp / 'site'
    shutil.copytree(ROOT, site, ignore=shutil.ignore_patterns('.git', 'tests'))
    idx = site / 'index.html'; html = idx.read_text(encoding='utf8')
    if HOOK_FROM not in html:
        sys.exit(f'Test-Hook nicht gefunden: "{HOOK_FROM}" fehlt in index.html')
    idx.write_text(html.replace(HOOK_FROM, HOOK_TO, 1), encoding='utf8')
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
                    'walkthrough': [script, 'X', url, str(out)]}.get(name, [script, url])
            print(f'\n=== {name} ===', flush=True)
            results[name] = subprocess.call([sys.executable] + args) == 0
    finally:
        srv.terminate(); shutil.rmtree(tmp, ignore_errors=True)
    print('\n' + '  '.join(f"{n}: {'OK' if ok else 'FEHLER'}" for n, ok in results.items()))
    print(f'Screenshots: {OUT}')
    sys.exit(0 if all(results.values()) else 1)

if __name__ == '__main__':
    main()
