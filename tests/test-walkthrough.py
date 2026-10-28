# Drumstar-Test (Playwright, headless): alle Spurgruppen, Sheets, Overlays + Performance-Messung beim Abspielen.
# Start über tests/run.py (bereitet index.html vor und startet den Server).
# Direkt: python3 test-walkthrough.py X URL AUSGABEORDNER
import asyncio, sys, json
from playwright.async_api import async_playwright
SP=sys.argv[1]; DIR=sys.argv[2]; OUT=sys.argv[3]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg=await b.new_page(viewport={'width':390,'height':844})
    errs=[]; pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)[:200])); pg.on('requestfailed',lambda r: errs.append('REQFAIL '+r.url)); pg.on('console',lambda m: m.type in('error','warning') and errs.append(m.type+': '+m.text[:200]))
    await pg.goto(DIR); await pg.wait_for_timeout(1200)
    log=[]
    async def step(name, js, shot=None, wait=350):
        try:
            await pg.evaluate(js); await pg.wait_for_timeout(wait)
            if shot: await pg.screenshot(path=f'{OUT}/{shot}.png')
            log.append('ok   '+name)
        except Exception as e: log.append('FAIL '+name+' '+str(e)[:160])
    C=lambda i:f"document.getElementById('{i}').click()"
    def closeAll(): return "document.querySelectorAll('.sheet.open .shx').forEach(x=>x.click()); document.querySelectorAll('[id$=CloseBtn]').forEach(x=>{ if(x.offsetParent) x.click(); })"
    async def grp(n):
        await pg.click('#grpBtn'); await pg.click(f'#grpMenu button:has-text("{n}")'); await pg.wait_for_timeout(200)
    await pg.screenshot(path=f'{OUT}/00_start.png', full_page=True)
    for g in ['DRUMS','PERC','ACID','COSMIC','SAMPLE','KEYS']:
        try: await grp(g); await pg.screenshot(path=f'{OUT}/01_{g}.png', full_page=True); log.append('ok   grp '+g)
        except Exception as e: log.append('FAIL grp '+g+' '+str(e)[:100])
        await step(g+' sound sheet', C('tbSound'), f'02_sound_{g}')
        await pg.evaluate(closeAll()); await pg.wait_for_timeout(250)
        await step(g+' synth sheet', "const b=document.getElementById('tbSynth'); if(b&&b.offsetParent) b.click()", f'03_synth_{g}')
        await pg.evaluate(closeAll()); await pg.wait_for_timeout(250)
        await step(g+' random', C('taRandBtn')); await step(g+' undo', C('taUndoBtn'))
    await grp('DRUMS')
    await step('settings', C('settingsBtn'), '10_settings'); await pg.evaluate(closeAll())
    await step('kit picker', C('lcdKitBtn'), '11_kit'); await pg.evaluate(closeAll())
    await step('fill', C('fillBtn'), '12_fill'); await pg.evaluate(closeAll())
    await step('patterns', C('lcdPatternBtn'), '13_patterns'); await pg.evaluate(closeAll())
    await step('tempo', "document.querySelector('[id^=tempoChip],#tempoChip,#bpmBtn')?.click()", '14_tempo'); await pg.evaluate(closeAll())
    await grp('COSMIC')
    await step('harmony open', "document.querySelector('#hmPanel button')?.click()", '15_harmony', 400)
    await step('harmony chord mode', "[...document.querySelectorAll('#hmModes button')].find(b=>b.textContent.trim()==='Akkord')?.click()", '16_harmony_chord')
    await step('harmony tpl', C('hmTplBtn'), '17_tpl'); await pg.evaluate(closeAll())
    await step('roll open', C('prPv'), '18_roll', 500)
    await step('roll mode play', "document.querySelector('#prTool [data-pm=play]').click()", '19_roll_play')
    await step('roll gear', "document.querySelector('#prTop [data-pa=opt]').click()", '20_roll_gear'); await pg.evaluate(closeAll())
    await step('roll back', C('prBack'))
    await grp('ACID')
    await step('xy open', C('arpXyBtn'), '21_xy', 400); await step('xy close', C('xyCloseBtn'))
    await step('pads tab', C('padsToggleBtn'), '22_pads')
    await step('mixer tab', C('mixerToggleBtn'), '23_mixer')
    await step('song tab', C('songToggleBtn'), '24_song')
    await step('pattern tab', C('patternTabBtn'))
    # Playback + Perf
    cdp=await pg.context.new_cdp_session(pg); await cdp.send('Performance.enable')
    m0={x['name']:x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}
    await pg.click('#playBtn', force=True); await pg.wait_for_timeout(6000)
    m1={x['name']:x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}
    await pg.click('#playBtn', force=True)
    perf={k:round(m1[k]-m0[k],3) for k in ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount']}
    perf['Nodes']=m1['Nodes']; perf['JSHeapMB']=round(m1['JSHeapUsedSize']/1e6,1)
    # roll playback perf
    await grp('COSMIC'); await pg.evaluate(C('prPv')); await pg.wait_for_timeout(400)
    m0={x['name']:x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}
    await pg.evaluate("document.querySelector('[data-pa=play]').click()"); await pg.wait_for_timeout(6000)
    m1={x['name']:x['value'] for x in (await cdp.send('Performance.getMetrics'))['metrics']}
    await pg.evaluate("document.querySelector('[data-pa=play]').click()")
    perf2={k:round(m1[k]-m0[k],3) for k in ['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount']}
    dom=await pg.evaluate("({nodes:document.getElementsByTagName('*').length, listeners: null, timers: null})")
    print(json.dumps({'log':log,'errs':errs,'perf_main_6s':perf,'perf_roll_6s':perf2,'dom':dom},indent=1,ensure_ascii=False))
    await b.close()
  fails=[l for l in log if l.startswith('FAIL')]; perr=[e for e in errs if e.startswith('PAGEERR')]
  sys.exit(1 if fails or perr else 0)
asyncio.run(main())
