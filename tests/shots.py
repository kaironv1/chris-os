import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *
async def main():
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p)
        await pg.goto(URL); await pg.wait_for_timeout(1200)
        await pg.screenshot(path='tests/s_heute.png', full_page=True)
        for route, name in [('#/training','training'),('#/pflege','pflege'),('#/outfit','outfit'),('#/outfit/schrank','schrank'),('#/outfit/listen','listen'),('#/outfit/analyse','analyse'),('#/einstellungen','settings'),('#/training/fortschritt','fortschritt')]:
            await pg.evaluate(f"location.hash='{route}'"); await pg.wait_for_timeout(700)
            await pg.screenshot(path=f'tests/s_{name}.png', full_page=True)
        print('\n'.join(errs) or 'no console errors')
        await b.close()
asyncio.run(main())
