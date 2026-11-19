import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *
from v2 import SYNTH
async def go(pg, h, wait=450): await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(wait)
async def run(dark):
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p, 412, 915, dark=dark, mobile=True)
        await pg.goto(URL); await pg.wait_for_timeout(1000)
        await pg.evaluate(SYNTH)
        await pg.evaluate("(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E; S.health.days[E.today()] = { sym: { hals_kratzen: 1, 'bm:nacken': 2 }, meas: ['tee'], f: { kaffee: 2, wasser: 2 }, sleepH: 6, mood: 3, breath: 1, t: Date.now() }; S.meta.dismissed.welcome = true; window.HaltungDebug.render(); })()")
        tag = 'd' if dark else 'm'
        await go(pg, '#/heute'); await pg.screenshot(path=f'tests/v2_{tag}_heute.png', full_page=True)
        await go(pg, '#/gesundheit'); await pg.screenshot(path=f'tests/v2_{tag}_checkin.png', full_page=True)
        await go(pg, '#/gesundheit/muster', 900); await pg.screenshot(path=f'tests/v2_{tag}_muster.png', full_page=True)
        await go(pg, '#/gesundheit/aerzte'); await pg.screenshot(path=f'tests/v2_{tag}_aerzte.png', full_page=True)
        await go(pg, '#/training/zuhause'); await pg.screenshot(path=f'tests/v2_{tag}_zuhause.png', full_page=True)
        await pg.click('button[data-a="st.start"]'); await pg.wait_for_timeout(400)
        await pg.screenshot(path=f'tests/v2_{tag}_player.png', full_page=False)
        await go(pg, '#/pflege'); await pg.screenshot(path=f'tests/v2_{tag}_pflege.png', full_page=True)
        ov = await pg.evaluate("[...document.querySelectorAll('#view *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 8).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right))")
        print(tag, 'overflow', ov)
        print(tag, 'errors', errs)
        await b.close()
async def main():
    await run(False); await run(True)
asyncio.run(main())
