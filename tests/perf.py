import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *
async def main():
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p)
        await pg.goto(URL); await pg.wait_for_timeout(1000)
        for r in ['#/outfit/analyse', '#/heute', '#/outfit', '#/outfit/listen', '#/outfit/schrank', '#/training']:
            t = await pg.evaluate(f"(() => {{ const t0 = performance.now(); location.hash = '{r}'; window.HaltungDebug.render(); return Math.round(performance.now() - t0); }})()")
            print(r, t, 'ms')
            await pg.wait_for_timeout(300)
        print('\n'.join(errs) or 'no console errors')
        await b.close()
asyncio.run(main())
