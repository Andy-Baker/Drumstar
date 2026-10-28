# Lastmessung (optional, nicht im Standardlauf): python3 tests/run.py bench
# Rendert pro Kit ein dichtes 64-Step-Drum-Pattern offline über das FM-Worklet und misst die Wandzeit (Median aus 5).
# Nur relativ vergleichen (vorher/nachher auf derselben Maschine); absolute Zahlen schwanken stark.
import asyncio, sys
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(); await pg.goto(sys.argv[1]); await pg.wait_for_timeout(1500)
    tot=0
    for kit in await pg.evaluate("__audio.kits()"):
      r=await pg.evaluate("k=>__audio.bench(k,5)",kit); tot+=r['ms']; print(f"{kit:8s} {r['ms']:7.1f} ms für {r['audioSec']:.1f} s Audio  (Echtzeitfaktor {r['audioSec']*1000/r['ms']:.0f}x)")
    print(f'Summe {tot:.1f} ms'); await b.close()
asyncio.run(main())
