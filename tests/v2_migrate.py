import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *
OLD = (__import__('pathlib').Path(__file__).resolve().parent / 'fixtures' / 'alt' / 'haltung-v1.1.html').as_uri()
async def st(pg, expr): return await pg.evaluate(f"(() => {{ const S = window.HaltungDebug.state; return {expr}; }})()")
async def main():
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p)
        # 1. use v1.1 like before
        await pg.goto(OLD); await pg.wait_for_timeout(900)
        await pg.click('button[data-a="care.daily"] >> nth=0'); await pg.wait_for_timeout(100)
        await pg.click('button[data-a="care.done"] >> nth=0'); await pg.wait_for_timeout(100)
        await pg.evaluate("""(() => { const S = window.HaltungDebug.state; S.grooming.last.zahnarzt = '2026-05-10'; S.grooming.last.hautcheck = '2025-02-01';
            const t = S.grooming.tasks.find(x => x.id === 'brauen'); t.every = 21; S.training.routineLog.push({date: '2026-11-17', id: 'haltung'});
            localStorage.setItem('haltung.v1', JSON.stringify(S)); })()""")
        v1 = await st(pg, '[S.version, S.grooming.tasks.length, Object.keys(S.grooming.daily).length, S.grooming.last.bart]')
        print('v1 state', v1)
        # 2. open v2 in the same browser profile
        await pg.goto(URL); await pg.wait_for_timeout(1200)
        res = await st(pg, """({ version: S.version, tasks: S.grooming.tasks.map(t => t.id).join(','), brauenEvery: S.grooming.tasks.find(t => t.id === 'brauen').every,
            daily: 'daily' in S.grooming, bart: S.grooming.last.bart, zahnarzt: S.grooming.last.zahnarzt || null,
            vsZahn: S.health.vorsorge.find(v => v.id === 'zahn').last, vsHaut: S.health.vorsorge.find(v => v.id === 'haut').last,
            homeEx: Object.values(S.training.exercises).filter(e => e.home).length, routine: S.grooming.routine.morgens.length,
            products: S.grooming.products.length, healthKeys: Object.keys(S.health).sort().join(','), log: S.training.routineLog.length })""")
        print('migrated', json.dumps(res, ensure_ascii=False, indent=1))
        stored = await pg.evaluate("JSON.parse(localStorage.getItem('haltung.v1')).version")
        print('stored version', stored)
        print('heute sections', await pg.eval_on_selector_all('.ledger .sec-title', 'els => els.map(e => e.textContent)'))
        await pg.screenshot(path='tests/v2_heute_migrated.png', full_page=True)
        print('errors', errs)
        await b.close()
asyncio.run(main())
