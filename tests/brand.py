import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *
async def main():
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p)
        await pg.goto(URL); await pg.wait_for_timeout(1100)
        board = await pg.query_selector('.board')
        await board.screenshot(path='tests/b_board.png')
        subs = await pg.eval_on_selector_all('.board .g-sub, .board .fig-meta', 'els => els.map(e => e.textContent)')
        alts = await pg.eval_on_selector_all('.board .alt-items', 'els => els.map(e => e.textContent)')
        print('subs:', subs); print('alts:', alts)
        await pg.evaluate("location.hash='#/outfit/listen'"); await pg.wait_for_timeout(500)
        card = await pg.query_selector('.orow >> nth=1'); await card.screenshot(path='tests/b_orow.png')
        await pg.evaluate("location.hash='#/outfit/schrank'"); await pg.wait_for_timeout(400)
        print('wcard:', await pg.eval_on_selector_all('.wcard-sub', 'els => els.slice(0,4).map(e => e.textContent)'))
        await b.close()
        b, ctx, pg, errs2 = await setup(p, 412, 915, mobile=True)
        await pg.goto(URL); await pg.wait_for_timeout(1100)
        board = await pg.query_selector('.board'); await board.screenshot(path='tests/b_board_m.png')
        print('\n'.join(errs + errs2) or 'no console errors')
        await b.close()
asyncio.run(main())
