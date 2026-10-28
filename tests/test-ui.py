# Drumstar-Test (Playwright, headless): Beats-Liste, Pads, Mixer, Song, Kit.
# Start über tests/run.py (bereitet index.html vor und startet den Server).
# Direkt: python3 test-ui.py AUSGABEORDNER URL
import asyncio, sys
from playwright.async_api import async_playwright
OUT=sys.argv[1]; URL=sys.argv[2] if len(sys.argv)>2 else 'http://localhost:8768/index.html'; res=[]
def ok(n,c,x=''): res.append(('PASS ' if c else 'FAIL ')+n+(' '+str(x) if x else '')); print(res[-1],flush=True)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg=await b.new_page(viewport={'width':390,'height':844},accept_downloads=True); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)[:200]))
    await pg.goto(URL,wait_until='domcontentloaded'); await pg.wait_for_timeout(1800)
    await pg.click('#lcdPatternBtn'); await pg.wait_for_timeout(400)
    rows=await pg.evaluate("document.querySelectorAll('#patternList .pattern-row').length"); ok('Beats-Liste da', rows>0, rows)
    h=await pg.evaluate("document.querySelector('#patternList .pattern-row').offsetHeight"); ok('Zeilenhöhe ≥ 56', h>=56, h)
    await pg.click('#patternList .pattern-row:nth-child(2) .prow-top .prow-btn:last-child'); await pg.wait_for_timeout(200)
    ok('⋯ klappt Aktionen auf', await pg.evaluate("document.querySelectorAll('#patternList .pattern-row.open .prow-more .act').length")==5)
    await pg.screenshot(path=OUT+'/beats_open.png')
    # Duplizieren über Menü
    n0=rows; await pg.click('#patternList .pattern-row.open .prow-more .act:first-child'); await pg.wait_for_timeout(500)
    ok('Duplizieren', await pg.evaluate("document.querySelectorAll('#patternList .pattern-row').length")==n0+1)
    # Umbenennen
    await pg.click('#patternList .pattern-row:nth-child(1) .prow-top .prow-btn:last-child'); await pg.wait_for_timeout(150)
    await pg.click('#patternList .pattern-row.open .prow-more .act:nth-child(2)'); await pg.wait_for_timeout(200)
    ok('Umbenennen-Formular', await pg.evaluate("!!document.querySelector('.prow-rename-input')"))
    await pg.screenshot(path=OUT+'/beats_rename.png')
    await pg.keyboard.press('Escape'); await pg.click('#beatTabs button[data-t=drums]'); await pg.wait_for_timeout(200)
    # Gruppen-Tab
    await pg.click('#beatTabs button[data-t=drums]'); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT+'/beats_drums.png')
    await pg.click('#beatTabs button[data-t=all]'); await pg.wait_for_timeout(300)
    # Laden
    await pg.click('#patternList .pattern-row:nth-child(3) .prow-top .pload'); await pg.wait_for_timeout(500)
    ok('Laden schließt Overlay', not await pg.evaluate("document.getElementById('patternsOverlay').classList.contains('open')"))
    # Pads
    await pg.click('#padsToggleBtn'); await pg.wait_for_timeout(300)
    await pg.evaluate("const i=document.getElementById('padDelayIn'); i.value=40; i.dispatchEvent(new Event('input'))")
    ok('Pad-Delay Wert', (await pg.text_content('#padDelayV'))=='40%')
    q0=await pg.evaluate("document.getElementById('padQuantizeBtn').classList.contains('on')"); await pg.click('#padQuantizeBtn'); q1=await pg.evaluate("document.getElementById('padQuantizeBtn').classList.contains('on')")
    ok('Quantize umschalten', q0!=q1)
    gh=await pg.evaluate("document.getElementById('padGrid').offsetHeight"); ok('Pads füllen Höhe', gh>450, gh)
    await pg.screenshot(path=OUT+'/pads.png')
    # Mixer
    await pg.click('#mixerToggleBtn'); await pg.wait_for_timeout(500)
    r=await pg.evaluate("(()=>{const m=document.querySelector('#mixerMaster .mix-strip').getBoundingClientRect(), c=document.getElementById('mixerChannels').getBoundingClientRect(); return [m.left, c.right]})()")
    ok('Master überlappt keinen Kanal', r[0]>=r[1]-1, r)
    fh=await pg.evaluate("getComputedStyle(document.getElementById('mixerOverlay')).getPropertyValue('--fh')"); ok('Fader-Höhe angepasst', fh.strip()!='', fh)
    await pg.screenshot(path=OUT+'/mixer.png')
    # Song
    await pg.click('#songToggleBtn'); await pg.wait_for_timeout(400)
    await pg.click('#arrHelpBtn'); ok('Hilfe klappt auf', await pg.evaluate("document.getElementById('arrHelp').classList.contains('open')"))
    await pg.click('#arrToggle button[data-v="1"]'); await pg.wait_for_timeout(200)
    ok('Song AN', await pg.evaluate("document.querySelector('#arrToggle button[data-v=\"1\"]').classList.contains('on')"))
    await pg.click('#arrToggle button[data-v="1"]'); await pg.wait_for_timeout(100)
    ok('Erneut AN tippen bleibt AN', await pg.evaluate("document.querySelector('#arrToggle button[data-v=\"1\"]').classList.contains('on')"))
    await pg.screenshot(path=OUT+'/song_on.png')
    await pg.click('#arrToggle button[data-v="0"]'); await pg.wait_for_timeout(100)
    ok('Song AUS', await pg.evaluate("document.querySelector('#arrToggle button[data-v=\"0\"]').classList.contains('on')"))
    await pg.click('#patternTabBtn'); await pg.wait_for_timeout(200)
    # Kit + eigene Sets
    await pg.click('#lcdKitBtn'); await pg.wait_for_timeout(300); await pg.screenshot(path=OUT+'/kit.png'); await pg.click('#kitPickerCloseBtn')
    ok('Keine Fehler', not errs, errs)
    await b.close()
  print(sum(r.startswith('PASS') for r in res),'/',len(res))
  sys.exit(0 if all(r.startswith('PASS') for r in res) else 1)
asyncio.run(main())
