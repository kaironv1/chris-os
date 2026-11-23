"""Version 2.13. K59: Der Check-in im Raum übernimmt Schlaf, Schlafqualität und Energie aus „Wie geht’s dir?“, solange
sie dort nicht eingetragen sind, markiert als „übernommen“ (auch in der Tabelle der letzten 14 Tage); Anspannung nicht.
Gespeichert wird im Raum erst mit der ersten eigenen Angabe des Tages. Eigene Werte und Leeren gelten nur im Raum,
übernommene Werte folgen späteren Korrekturen im normalen Check-in, und nichts fließt aus dem Raum zurück. Der Export
enthält die übernommenen Werte. Handy hell und PC dunkel, ohne Konsolenfehler."""
import asyncio, datetime, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import setup, URL

SHOT = pathlib.Path(__file__).resolve().parent
TODAY = datetime.date.today()
YDAY = TODAY - datetime.timedelta(days=1)
AT = datetime.datetime.combine(TODAY, datetime.time(19, 30))
PASS = 'drei blaue boote im hafen'
STORE = "localStorage.getItem('haltung.v1')"
ALL3 = ['Schlaf letzte Nacht (Stunden)', 'Schlafqualität', 'Energie gerade']


async def text(pg, sel):
    return re.sub(r'\s+', ' ', await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{textContent: ''}}).textContent")).strip()


async def taps(pg, n=7):
    el = pg.locator('[data-a="about.tap"]')
    await el.scroll_into_view_if_needed()
    for _ in range(n):
        await el.click(); await pg.wait_for_timeout(40)
    await pg.wait_for_timeout(150)


async def open_room(pg, new=False):
    await pg.evaluate("location.hash = '#/einstellungen'"); await pg.wait_for_timeout(250)
    await taps(pg)
    if new:
        await pg.wait_for_selector('#vt-setup')
        await pg.fill('#vt-setup input[name="p1"]', PASS); await pg.fill('#vt-setup input[name="p2"]', PASS)
        await pg.click('button[data-a="vt.setup"]')
    else:
        await pg.wait_for_selector('#vt-unlock')
        await pg.fill('#vt-unlock input[name="p"]', PASS); await pg.click('button[data-a="vt.unlock"]')
    await pg.wait_for_selector('.vt-tabs', timeout=20000)


async def checkin_tab(pg):
    await pg.click('.vt-tabs a[data-k="checkin"]'); await pg.wait_for_selector('.vt-trend')


async def start_state(pg):
    await pg.click('.vt-tabs a[data-k="start"]'); await pg.wait_for_selector('.vt-lead')
    s = await pg.evaluate("document.querySelector('.vt .kv-list li strong').textContent")
    await checkin_tab(pg)
    return s


async def health_day(pg, d):
    st = json.loads(await pg.evaluate(STORE))
    return ((st.get('health') or {}).get('days') or {}).get(d.isoformat())


async def marked(pg):
    return await pg.evaluate("[...document.querySelectorAll('.vt .field > span')].filter(s => s.querySelector('.vt-pre')).map(s => s.firstChild.textContent.trim())")


async def pressed(pg, sel):
    return await pg.evaluate(f"[...document.querySelectorAll({json.dumps(sel + '[aria-pressed=\"true\"]')})].map(e => e.dataset.v)")


async def row(pg, i):
    return await pg.evaluate(f"[...document.querySelectorAll('.vt-trend tbody tr')[{i}].children].map(e => [e.textContent, e.classList.contains('vt-pre')])")


async def hc(pg, d, k, v):
    await pg.click(f'button[data-a="hc.set"][data-d="{d.isoformat()}"][data-k="{k}"][data-v="{v}"]'); await pg.wait_for_timeout(80)


async def main():
    async with async_playwright() as p:
        for w, h, mobile, dark in ((390, 844, True, False), (1440, 900, False, True)):
            b, ctx, pg, errs = await setup(p, w, h, mobile=mobile, dark=dark)
            await pg.clock.install(time=AT)
            await pg.goto(URL); await pg.wait_for_selector('.fold-head')
            # 1. Normaler Check-in: heute Schlaf 7,5 h, Qualität 4, Energie 2, Stress 5; gestern nur Schlaf 6 h
            await pg.evaluate("location.hash = '#/gesundheit'")
            await pg.wait_for_selector(f'button[data-a="hc.set"][data-d="{TODAY.isoformat()}"][data-k="sleepH"]')
            await hc(pg, TODAY, 'sleepH', 7)
            await pg.click(f'button[data-a="hc.step"][data-d="{TODAY.isoformat()}"][data-k="sleepH"][data-v="0.5"]'); await pg.wait_for_timeout(80)
            await hc(pg, TODAY, 'sleepQ', 4); await hc(pg, TODAY, 'energy', 2); await hc(pg, TODAY, 'stress', 5)
            await pg.click(f'.seg button[data-a="hc.date"][data-v="{YDAY.isoformat()}"]'); await pg.wait_for_timeout(120)
            await hc(pg, YDAY, 'sleepH', 6)
            before = await health_day(pg, TODAY)
            assert (before['sleepH'], before['sleepQ'], before['energy'], before['stress']) == (7.5, 4, 2, 5), before
            # 2. Raum einrichten, Check-in: vorbelegt und markiert, Anspannung leer, noch nichts gespeichert
            await open_room(pg, new=True)
            assert await start_state(pg) == 'offen'
            assert await pg.input_value('input[data-k="sleepHours"]') == '7.5'
            assert await marked(pg) == ALL3, await marked(pg)
            assert await pressed(pg, '.chip[data-k="sleepQuality"]') == ['4']
            assert await pressed(pg, '.scale button[data-k="energy"]') == ['2']
            assert await pressed(pg, '.scale button[data-k="stress"]') == [], 'Anspannung bleibt leer'
            assert 'Mit „übernommen“ markierte Werte stammen aus „Wie geht’s dir?“' in await pg.inner_text('.vt')
            r = await row(pg, 13)
            assert r[1] == ['7,5', True] and r[2] == ['2', True] and r[3] == ['', False], r
            r = await row(pg, 12)
            assert r[1] == ['6', True] and r[2] == ['', False], r
            assert 'Kursiv: aus „Wie geht’s dir?“ übernommen.' in await pg.inner_text('.vt')
            await pg.screenshot(path=str(SHOT / f"v213_checkin_{'handy' if mobile else 'pc'}.png"), full_page=True)
            # 3. Erste eigene Angabe (Anspannung 3): jetzt gespeichert, die übernommenen Werte bleiben markiert
            await pg.click('.scale button[data-k="stress"][data-v="3"]'); await pg.wait_for_timeout(200)
            assert await pressed(pg, '.scale button[data-k="stress"]') == ['3']
            assert await marked(pg) == ALL3, await marked(pg)
            assert await start_state(pg) == 'eingetragen'
            # 4. Energie im Raum ändern: gilt nur hier, nicht mehr markiert
            await pg.click('.scale button[data-k="energy"][data-v="5"]'); await pg.wait_for_timeout(150)
            assert await pressed(pg, '.scale button[data-k="energy"]') == ['5']
            assert await marked(pg) == ALL3[:2], await marked(pg)
            assert (await row(pg, 13))[2] == ['5', False]
            # 5. Übernommene Schlafqualität mit einem Tipp leeren: bleibt leer
            await pg.click('.chip[data-k="sleepQuality"][data-v="4"]'); await pg.wait_for_timeout(150)
            assert await pressed(pg, '.chip[data-k="sleepQuality"]') == []
            assert await marked(pg) == ALL3[:1], await marked(pg)
            # 6. Gestern: nur der Schlaf ist vorbelegt
            await pg.click('.seg button[data-a="vt.ci.day"][data-v="1"]'); await pg.wait_for_timeout(150)
            assert await pg.input_value('input[data-k="sleepHours"]') == '6' and await marked(pg) == ALL3[:1]
            assert await pressed(pg, '.scale button[data-k="energy"]') == []
            await pg.click('.seg button[data-a="vt.ci.day"][data-v="0"]'); await pg.wait_for_timeout(150)
            # 7. Nichts fließt zurück
            await pg.wait_for_timeout(300)
            await pg.click('button[data-a="vt.lock"]'); await pg.wait_for_timeout(250)
            assert await health_day(pg, TODAY) == before, 'der normale Check-in bleibt unverändert'
            st = json.loads(await pg.evaluate(STORE))
            assert set(st['vault'].keys()) == {'v', 'id', 'at', 'kdf', 'pass', 'prfEval', 'prf', 'data'}
            # 8. Korrektur im normalen Check-in: Schlaf 8 h folgt, eigene Energie und geleerte Qualität bleiben
            await pg.evaluate("location.hash = '#/gesundheit'"); await pg.wait_for_timeout(250)
            await pg.click(f'.seg button[data-a="hc.date"][data-v="{TODAY.isoformat()}"]'); await pg.wait_for_timeout(120)
            await hc(pg, TODAY, 'sleepH', 8); await hc(pg, TODAY, 'energy', 3); await hc(pg, TODAY, 'sleepQ', 2)
            await open_room(pg)
            await checkin_tab(pg)
            assert await pg.input_value('input[data-k="sleepHours"]') == '8' and await marked(pg) == ALL3[:1], await marked(pg)
            assert await pressed(pg, '.scale button[data-k="energy"]') == ['5']
            assert await pressed(pg, '.chip[data-k="sleepQuality"]') == []
            # 9. Export enthält die übernommenen Werte (beim Öffnen nachgezogen), ohne Hilfsfelder
            await pg.click('.vt-tabs a[data-k="mehr"]'); await pg.wait_for_selector('button[data-a="vt.export"]')
            async with pg.expect_download() as dl:
                await pg.click('button[data-a="vt.export"]')
            ex = json.loads(pathlib.Path(await (await dl.value).path()).read_text(encoding='utf-8'))
            ci = [c for c in ex['checkins'] if c['date'] == TODAY.isoformat()]
            assert len(ci) == 1 and (ci[0]['sleepHours'], ci[0]['sleepQuality'], ci[0]['energy'], ci[0]['stress']) == (8, None, 5, 3), ci
            assert 'src' not in ci[0] and len(ex['checkins']) == 1, ex['checkins']
            await pg.click('button[data-a="vt.lock"]'); await pg.wait_for_timeout(250)
            after = await health_day(pg, TODAY)
            assert (after['sleepH'], after['sleepQ'], after['energy'], after['stress']) == (8, 2, 3, 5) and set(after) == set(before), after
            assert await pg.evaluate('document.documentElement.scrollWidth') <= w
            await b.close()
            assert not errs, errs
            print(f"K59 im Raum {'am Handy' if mobile else 'am PC dunkel'} ok")


asyncio.run(main())
