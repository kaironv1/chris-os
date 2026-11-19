import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *
async def main():
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p, 412, 915, mobile=True)
        await pg.goto(URL); await pg.wait_for_timeout(1000)
        await pg.screenshot(path='tests/m_heute.png', full_page=True)
        await pg.click('button[data-a="session.start"]'); await pg.wait_for_timeout(500)
        await pg.click('button[data-a="set.done"][data-e="0"][data-s="0"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='tests/m_session.png', full_page=False)
        await pg.click('button[data-a="rest.stop"]')
        for r, n in [('#/outfit','outfit'),('#/outfit/schrank','schrank'),('#/pflege','pflege')]:
            await pg.evaluate(f"location.hash='{r}'"); await pg.wait_for_timeout(500)
            await pg.screenshot(path=f'tests/m_{n}.png', full_page=False)
        await b.close()
        b, ctx, pg, errs2 = await setup(p, 1440, 900, dark=True)
        await pg.goto(URL); await pg.wait_for_timeout(1000)
        await pg.screenshot(path='tests/d_heute.png', full_page=False)
        await pg.evaluate("location.hash='#/training/fortschritt'"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='tests/d_progress.png', full_page=False)
        await pg.evaluate("location.hash='#/outfit/schrank'"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='tests/d_schrank.png', full_page=False)
        print('\n'.join(errs + errs2) or 'no console errors')
        await b.close()
asyncio.run(main())
