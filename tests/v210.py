"""Version 2.10. Zeile zum Experiment im Wochenrückblick (K51): Läuft ein Experiment, zeigt der Rückblick am Montag, an
wie vielen Tagen der Vorwoche die Regel eingehalten wurde, dazu den Zwischenstand von bis zu zwei Werten; ein in der
Vorwoche beendetes Experiment steht mit seinem Ergebnis in Worten; ohne Experiment fehlt die Zeile. Handy hell, PC
dunkel, ohne Konsolenfehler und ohne seitliches Herausragen."""
import asyncio, datetime, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import setup, URL

SHOT = pathlib.Path(__file__).resolve().parent
TODAY = datetime.date.today()
MON = TODAY - datetime.timedelta(days=TODAY.weekday())
AT = datetime.datetime.combine(MON, datetime.time(8, 30))
ST = "JSON.parse(localStorage.getItem('haltung.v1'))"

# Check-ins der letzten vier Wochen; das Experiment „Kein Kaffee nach 14 Uhr“ startete am Mittwoch der Vorwoche (vor 5
# Tagen) und läuft 14 Tage. Freitag nicht eingehalten, die anderen vier Tage schon; die Morgen danach schlafen besser.
# Mit mode 'fertig' endete stattdessen ein 7-Tage-Experiment am Sonntag, mit 'keins' gibt es kein Experiment.
SYN = """((mode) => {
  const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today(), D = S.health.days = {};
  for (let k = 28; k >= 0; k--) D[E.addDays(t, -k)] = { sym: {}, meas: [], f: {}, none: true, t: Date.now(), sleepH: k % 2 ? 7 : 6.5, sleepQ: 3, energy: 3, mood: 3 };
  S.health.exps = [];
  if (mode === 'laeuft') {
    const T0 = E.addDays(t, -5), at = k => E.addDays(T0, k);
    const ex = { id: 'k1', tpl: 'kaffee', rule: 'Kein Kaffee nach 14 Uhr', at: '14:00', free: false, when: 'abend', measures: ['sleepQ', 'sleepH', 'energy'], expect: '', days: 14, start: T0, end: at(13), stopped: null, log: {}, verdict: null, created: Date.now() };
    [0, 1, 3, 4].forEach(k => { ex.log[at(k)] = true; D[at(k + 1)].sleepQ = 4; D[at(k + 1)].sleepH = 7.5; });
    ex.log[at(2)] = false;
    S.health.exps = [ex];
  }
  if (mode === 'fertig') {
    const T0 = E.addDays(t, -7), at = k => E.addDays(T0, k);
    const ex = { id: 'w1', tpl: 'wasser', rule: 'Jeden Tag 2 Liter trinken', at: null, free: false, when: 'tag', measures: ['energy'], expect: '', days: 7, start: T0, end: at(6), stopped: null, log: {}, verdict: null, created: Date.now() };
    for (let k = 0; k < 7; k++) ex.log[at(k)] = k !== 3;
    S.health.exps = [ex];
  }
  localStorage.setItem('haltung.v1', JSON.stringify(S));
})"""


async def rows(pg):
    return await pg.evaluate("[...document.querySelectorAll('.rv-list li')].map(li => [li.querySelector('.rv-k').textContent, li.querySelector('.rv-t').textContent])")


async def open_review(pg):
    await pg.wait_for_selector('[data-fold="review"]')
    if await pg.get_attribute('button.fold-head[data-k="review"]', 'aria-expanded') == 'false':
        await pg.click('button.fold-head[data-k="review"]'); await pg.wait_for_timeout(150)


async def main():
    async with async_playwright() as p:
        for w, h, mobile, dark in ((390, 844, True, False), (1440, 900, False, True)):
            b, ctx, pg, errs = await setup(p, w, h, mobile=mobile, dark=dark, unfold=False)
            await pg.clock.set_fixed_time(AT)
            await pg.goto(URL); await pg.wait_for_selector('.fold-head')
            # 1. Laufendes Experiment: Zusammenfassung, Zeile, Link
            await pg.evaluate(SYN + "('laeuft')")
            await pg.reload(); await pg.wait_for_selector('.fold-head')
            sm = await pg.inner_text('[data-fold="review"] .fold-sum')
            assert sm.endswith(', Experiment an 4 von 5 Tagen'), sm
            await open_review(pg)
            R = dict(await rows(pg))
            assert list(R) == ['Schlaf', 'Beschwerden', 'Training', 'Eiweiß', 'Outfit', 'Experiment'], list(R)
            assert R['Experiment'] == 'Kein Kaffee nach 14 Uhr: an 4 von 5 Tagen eingehalten; Schlafqualität bisher 4 statt 3, Schlaf 7,5 h statt 6,8 h.', R['Experiment']
            assert await pg.locator('#fold-review a.rv-exp').count() == 1
            assert await pg.evaluate('document.documentElement.scrollWidth') <= w, 'Rückblick ragt nicht heraus'
            await pg.screenshot(path=str(SHOT / f"v210_review_{'handy' if mobile else 'pc'}.png"), full_page=True)
            await pg.click('#fold-review a.rv-exp'); await pg.wait_for_timeout(300)
            assert await pg.evaluate('location.hash') == '#/gesundheit/experimente'
            assert await pg.locator('.exp-card, .exp-run, .exp-strip').count() >= 1 or 'Kein Kaffee nach 14 Uhr' in await pg.inner_text('#view')
            # 2. Am Sonntag beendet: Ergebnis in Worten, zu wenige Einträge davor für den Vergleich
            await pg.evaluate("location.hash = '#/heute'")
            await pg.evaluate(SYN + "('fertig')")
            await pg.reload(); await pg.wait_for_selector('.fold-head')
            await open_review(pg)
            R = dict(await rows(pg))
            assert R['Experiment'] == 'Jeden Tag 2 Liter trinken ist abgeschlossen: an 6 von 7 Tagen eingehalten. Kein klarer Unterschied: Energie.', R['Experiment']
            assert (await pg.inner_text('[data-fold="review"] .fold-sum')).endswith(', Experiment an 6 von 7 Tagen')
            # 3. Ohne Experiment keine Zeile und kein Link
            await pg.evaluate(SYN + "('keins')")
            await pg.reload(); await pg.wait_for_selector('.fold-head')
            await open_review(pg)
            assert [r[0] for r in await rows(pg)] == ['Schlaf', 'Beschwerden', 'Training', 'Eiweiß', 'Outfit']
            assert 'Experiment' not in await pg.inner_text('[data-fold="review"] .fold-sum')
            assert await pg.locator('#fold-review a.rv-exp').count() == 0
            await b.close()
            assert not errs, errs
            print(f"Experiment im Wochenrückblick {'am Handy' if mobile else 'am PC dunkel'} ok")


asyncio.run(main())
