"""Version 2.11. Reisen mit Packliste (K52) unter Outfit: Reise anlegen mit Zielsuche, Tagen und Art; Outfits je Tag
fürs Wetter am Ziel (Vorhersage, für spätere Reisen Vorjahreswerte), Anlass je Tag änderbar; Packliste mit Kleidung,
Kulturbeutel, Medikamenten und Sonstigem, abhaken, Eigenes ergänzen, zurücksetzen; Hinweis auf Heute mit Weg zur
Packliste; Bearbeiten und Löschen. Handy hell und PC dunkel, ohne Konsolenfehler und ohne seitliches Herausragen."""
import asyncio, datetime, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import setup, URL

SHOT = pathlib.Path(__file__).resolve().parent
TODAY = datetime.date.today()
D = lambda k: (TODAY + datetime.timedelta(days=k)).isoformat()
AT = datetime.datetime.combine(TODAY, datetime.time(9, 0))
ST = "JSON.parse(localStorage.getItem('haltung.v1'))"
CALLS = []


def daily(start, end, arch=False):
    """Tageswerte für das Ziel: mild, am dritten Tag Regen."""
    a = datetime.date.fromisoformat(start); b = datetime.date.fromisoformat(end)
    t = [(a + datetime.timedelta(days=i)).isoformat() for i in range((b - a).days + 1)]
    n = len(t)
    d = {'time': t, 'weather_code': [61 if i == 2 else 1 for i in range(n)], 'temperature_2m_max': [15 + (i % 3) for i in range(n)], 'temperature_2m_min': [9] * n,
         'apparent_temperature_max': [14 + (i % 3) for i in range(n)], 'apparent_temperature_min': [7] * n, 'precipitation_sum': [4.0 if i == 2 else 0.0 for i in range(n)]}
    if not arch:
        d['precipitation_probability_max'] = [80 if i == 2 else 15 for i in range(n)]; d['uv_index_max'] = [2] * n
    return {'daily': d}


async def trip_routes(ctx):
    async def fc(route):
        u = route.request.url
        if 'start_date=' in u and 'daily=' in u:
            s = u.split('start_date=')[1].split('&')[0]; e = u.split('end_date=')[1].split('&')[0]
            CALLS.append(('vorhersage', s, e))
            await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(daily(s, e)))
        else:
            await route.fallback()
    async def arch(route):
        u = route.request.url
        if 'daily=' in u:
            s = u.split('start_date=')[1].split('&')[0]; e = u.split('end_date=')[1].split('&')[0]
            CALLS.append(('vorjahr', s, e))
            await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(daily(s, e, True)))
        else:
            await route.fallback()
    await ctx.route('https://api.open-meteo.com/**', fc)
    await ctx.route('https://archive-api.open-meteo.com/**', arch)


async def go(pg, h, wait=300):
    await pg.evaluate(f"location.hash = '{h}'"); await pg.wait_for_timeout(wait)


async def text(pg, sel):
    return re.sub(r'\s+', ' ', await pg.evaluate(f"document.querySelector({json.dumps(sel)}).textContent")).strip()


async def main():
    async with async_playwright() as p:
        for w, h, mobile, dark in ((390, 844, True, False), (1440, 900, False, True)):
            CALLS.clear()
            b, ctx, pg, errs = await setup(p, w, h, mobile=mobile, dark=dark)
            await trip_routes(ctx)
            await pg.clock.set_fixed_time(AT)
            await pg.goto(URL); await pg.wait_for_selector('.fold-head')
            # Ein Medikament im Zeitraum und eine Hose in der Wäsche (zählt für die Reise trotzdem)
            await pg.evaluate("""(() => { const S = window.HaltungDebug.state; S.health.meds = [{ id: 'm1', name: 'Beispielmittel', dose: '1 Tablette', times: ['08:00', '20:00'], start: '%s', end: null, note: '', by: '' }];
              S.trips = []; localStorage.setItem('haltung.v1', JSON.stringify(S)); })()""" % D(-3))
            await pg.reload(); await pg.wait_for_selector('.fold-head')
            # 1. Reiter Reisen: leer, Reise planen
            await go(pg, '#/outfit/reisen')
            assert await pg.get_attribute('.tabs a[href="#/outfit/reisen"]', 'aria-current') == 'page'
            assert 'Noch keine Reise geplant.' in await pg.inner_text('#view')
            await pg.click('button[data-a="trip.new"]'); await pg.wait_for_selector('#trip-form')
            await pg.fill('#trip-q', 'Musterstadt'); await pg.click('#dlg button[data-a="trip.search"]'); await pg.wait_for_selector('#trip-res button[data-a="trip.loc"]')
            await pg.click('#trip-res button[data-a="trip.loc"]'); await pg.wait_for_timeout(150)
            assert (await text(pg, '#trip-res')) == 'Gewählt: Musterstadt (Hessen)'
            await pg.fill('#trip-form input[name="from"]', D(3)); await pg.fill('#trip-form input[name="to"]', D(7))
            await pg.fill('#trip-form input[name="name"]', 'Städtetrip')
            await pg.click('#dlg button[data-a="trip.save"]'); await pg.wait_for_selector('.trip-daylist')
            await pg.wait_for_function("document.querySelectorAll('.trip-day .trip-wx svg').length >= 5", timeout=5000)
            assert CALLS and CALLS[-1] == ('vorhersage', D(3), D(7)), CALLS
            assert await text(pg, '.trip-head .page-title') == 'Städtetrip'
            assert '4 Nächte, Musterstadt (Hessen)' in await text(pg, '.trip-head .page-sub')
            assert await pg.locator('.trip-day').count() == 5
            assert (await text(pg, '.trip-src')).startswith('Vorhersage von Open-Meteo für das Ziel.')
            wx = await pg.evaluate("[...document.querySelectorAll('.trip-day .trip-wx')].map(e => e.textContent.trim())")
            assert wx[0] == '9° bis 15°' and wx[2] == '9° bis 17°, Regen 80 %', wx
            assert await pg.locator('.trip-day .trip-fit .trip-tile').count() >= 15, 'Outfits je Tag'
            heads = await pg.evaluate("[...document.querySelectorAll('.trip-group .sec-title')].map(e => e.firstChild.textContent.trim())")
            assert heads == ['Kleidung', 'Kulturbeutel', 'Medikamente', 'Sonstiges'], heads
            body = await pg.inner_text('.trip-group:nth-of-type(4)')
            assert 'Regenschirm oder Regenjacke' in body and 'Ladegerät' in body and 'Laptop' not in body, body
            assert 'Beispielmittel' in await pg.inner_text('.trip-group:nth-of-type(3)') and '10× (5 Tage)' in await pg.inner_text('.trip-group:nth-of-type(3)')
            kl = await pg.inner_text('.trip-group:nth-of-type(1)')
            assert '6× Unterwäsche und Socken' in kl and 'Schlafsachen' in kl, kl
            prog = await text(pg, '.trip-pack .trip-prog .num'); total = int(prog.split(' von ')[1].split(' ')[0])
            assert prog.startswith('0 von '), prog
            assert await pg.evaluate('document.documentElement.scrollWidth') <= w, 'ragt nicht heraus'
            await pg.screenshot(path=str(SHOT / f"v211_reise_{'handy' if mobile else 'pc'}.png"), full_page=True)
            # 2. Abhaken, Eigenes, Anlass ändern
            await pg.click('.trip-group:nth-of-type(1) button[data-a="trip.pack"]'); await pg.wait_for_timeout(150)
            assert (await text(pg, '.trip-pack .trip-prog .num')) == f'1 von {total} gepackt'
            await pg.fill('#trip-add', 'Buch'); await pg.press('#trip-add', 'Enter'); await pg.wait_for_timeout(200)
            assert 'Buch' in await pg.inner_text('.trip-group:nth-of-type(4)')
            assert (await text(pg, '.trip-pack .trip-prog .num')) == f'1 von {total + 1} gepackt'
            await pg.click('.trip-group:nth-of-type(4) button[data-a="trip.extra.del"]'); await pg.wait_for_timeout(150)
            assert 'Buch' not in await pg.inner_text('.trip-group:nth-of-type(4)')
            sel = pg.locator('.trip-day').nth(1).locator('select')
            assert await sel.input_value() == 'freizeit'
            await sel.select_option('termin'); await pg.wait_for_timeout(300)
            assert await pg.locator('.trip-day').nth(1).locator('select').input_value() == 'termin'
            total = int((await text(pg, '.trip-pack .trip-prog .num')).split(' von ')[1].split(' ')[0])  # anderes Outfit, andere Liste
            st = await pg.evaluate(ST)
            assert st['trips'][0]['occ'] == {D(4): 'termin'} and st['trips'][0]['wx']['kind'] == 'vorhersage' and len(st['trips'][0]['wx']['days']) == 5, st['trips'][0]['occ']
            # 3. Heute: Hinweis mit Weg zur Packliste
            await go(pg, '#/heute'); await pg.wait_for_selector('.trip-note')
            tn = await text(pg, '.trip-note p'); assert tn == f'Städtetrip in 3 Tagen: 1 von {total} gepackt.', tn
            await pg.click('.trip-note button[data-a="trip.open"]'); await pg.wait_for_selector('.trip-daylist')
            assert await pg.evaluate('location.hash') == '#/outfit/reisen'
            # 4. Zurück zur Liste, zweite Reise in 60 Tagen: Vorjahreswerte, Arbeitsreise mit Laptop
            await pg.click('button[data-a="trip.back"]'); await pg.wait_for_selector('.trip-card')
            assert await pg.locator('.trip-card').count() == 1 and 'in 3 Tagen' in await text(pg, '.trip-card .tag')
            await pg.click('button[data-a="trip.new"]'); await pg.wait_for_selector('#trip-form')
            await pg.fill('#trip-q', 'Musterstadt'); await pg.click('#dlg button[data-a="trip.search"]'); await pg.wait_for_selector('#trip-res button[data-a="trip.loc"]')
            await pg.click('#trip-res button[data-a="trip.loc"]'); await pg.wait_for_timeout(150)
            await pg.fill('#trip-form input[name="from"]', D(60)); await pg.fill('#trip-form input[name="to"]', D(62))
            await pg.check('#trip-form input[name="kind"][value="arbeit"]')
            await pg.click('#dlg button[data-a="trip.save"]'); await pg.wait_for_selector('.trip-daylist')
            try:
                await pg.wait_for_function("document.querySelector('.trip-src') && document.querySelector('.trip-src').textContent.includes('Vorjahr')", timeout=5000)
            except Exception:
                print('DEBUG', CALLS, await text(pg, '.trip-src'), await pg.evaluate("JSON.stringify(window.HaltungDebug.state.trips.map(t => [t.from, t.to, t.loc, t.wx && t.wx.kind]))")); raise
            assert CALLS[-1][0] == 'vorjahr', CALLS
            assert await text(pg, '.trip-head .page-title') == 'Musterstadt'
            assert '(Vorjahr)' in await text(pg, '.trip-day .trip-wx')
            assert 'Laptop und Unterlagen' in await pg.inner_text('.trip-group:last-of-type')
            # 5. Bearbeiten (Name), dann löschen
            await pg.click('button[data-a="trip.edit"]'); await pg.wait_for_selector('#trip-form')
            await pg.fill('#trip-form input[name="name"]', 'Messe'); await pg.click('#dlg button[data-a="trip.save"]'); await pg.wait_for_timeout(300)
            assert await text(pg, '.trip-head .page-title') == 'Messe'
            await pg.click('button[data-a="trip.del"]'); await pg.wait_for_selector('#dlg button[data-a="confirm.ok"]'); await pg.click('#dlg button[data-a="confirm.ok"]'); await pg.wait_for_timeout(300)
            assert await pg.locator('.trip-card').count() == 1
            assert len((await pg.evaluate(ST))['trips']) == 1
            await b.close()
            assert not errs, errs
            print(f"Reisen mit Packliste {'am Handy' if mobile else 'am PC dunkel'} ok")


asyncio.run(main())
