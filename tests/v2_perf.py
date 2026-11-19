import asyncio, sys
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *
GEN = """(() => {
  const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today();
  for (let i = 400; i >= 1; i--) {
    const d = E.addDays(t, -i), sick = (i % 37) < 3;
    S.health.days[d] = { sym: sick ? { hals_kratzen: 1 + (i % 2), nase_lauf: 1 } : {}, meas: sick ? ['tee'] : [], f: { kaffee: i % 4, wasser: 2, umfeld: (i % 37) === 4 }, mood: 3 + i % 2, sleepH: 6 + (i % 5) * 0.5, stress: 2 + i % 3, breath: i % 3, note: i % 9 ? '' : 'Notiz ' + i, t: Date.now() };
  }
  window.HaltungDebug.render(); return Object.keys(S.health.days).length;
})()"""
async def main():
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p)
        await pg.goto(URL); await pg.wait_for_timeout(900)
        print('days', await pg.evaluate(GEN))
        for h in ['#/heute', '#/gesundheit', '#/gesundheit/muster', '#/gesundheit/bericht', '#/gesundheit/aerzte', '#/training', '#/pflege']:
            ms = await pg.evaluate(f"(() => {{ location.hash = '{h}'; const t0 = performance.now(); window.HaltungDebug.render(); return Math.round(performance.now() - t0); }})()")
            print(h, ms, 'ms')
        print('state KB', await pg.evaluate("Math.round(localStorage.getItem('haltung.v1').length / 1024)"))
        print('errors', errs)
        await b.close()
asyncio.run(main())
