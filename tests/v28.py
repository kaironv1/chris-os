"""Version 2.8. Wochenrückblick montags auf Heute (bis Mittwoch, ausblendbar): Schlaf, Beschwerden, Training, Eiweiß
und Outfit-Tage gegen die Vorwoche, ein Satz je Bereich. Wetter, Pollen und Luftqualität je Tag von Open-Meteo, auch
für vergangene Tage (past_days, ältere Tage aus dem Archiv), leise gespeichert; Pollenhinweis auf Heute; in den
Verläufen ein eigenes Panel und der Vergleich mit den Beschwerden, im Detail als Einflüsse. Fehler beim Dienst werden
gebremst. Web-Build unter der CSP. Handy und PC, hell und dunkel, ohne Konsolenfehler und ohne seitliches Herausragen."""
import asyncio, datetime, json, math, pathlib, re, shutil, sys, tempfile, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import setup, URL, env_routes, fixture
from serve_web import serve

SHOT = pathlib.Path(__file__).resolve().parent
ROOT = SHOT.parent
TODAY = datetime.date.today()
MON = TODAY - datetime.timedelta(days=TODAY.weekday())
AT = datetime.datetime.combine(MON, datetime.time(8, 30))
KW = (MON - datetime.timedelta(days=7)).isocalendar()[1]
ST = "JSON.parse(localStorage.getItem('haltung.v1'))"


def aq(d, k):
    """Birkenpollen stark an jedem vierten Tag und heute, sonst schwach; Luft an jedem zehnten Tag mäßig."""
    return {'european_aqi': 48 if k % 10 == 4 else 24, 'birch_pollen': 120 if k % 4 == 1 or k == 0 else 3, 'grass_pollen': 4, 'alder_pollen': 0}


def wx(d, k):
    """Luftdruck fällt alle neun Tage um 8 hPa, die Temperatur schwankt sanft."""
    return {'temperature_2m': 8 + 3 * math.sin(k / 6), 'pressure_msl': 1006 if k % 9 == 0 else 1014, 'precipitation': 0}


# 60 Tage Check-ins: gereizte Augen an Birkentagen, Kopfschmerzen bei fallendem Luftdruck; dazu die letzten zwei Wochen
# mit Schlaf, Training, Eiweiß und getragenen Outfits für den Rückblick. Gespeichert, damit ein Neuladen sie findet.
SYNTH = """((old) => {
  const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today(), D = S.health.days = {};
  const lastW = [7, 6.5, 7.5, 7, 6, 8, 7.5];
  for (let k = old || 60; k >= 1; k--) {
    if (old && k > 60 && k !== old) continue;
    const d = E.addDays(t, -k);
    const x = { sym: {}, meas: [], f: {}, t: Date.now(), sleepH: k <= 7 ? lastW[7 - k] : k <= 14 ? 6.5 : 7, mood: 3, energy: 3, stress: 2 };
    if (k % 4 === 1) x.sym.augen = 2;
    if (k % 9 === 0) x.sym.kopf = 1;
    if (k === 3) x.sym.nase_lauf = 1;
    if (!Object.keys(x.sym).length) x.none = true;
    D[d] = x;
  }
  const ex = S.training.plans[0].items[0].ex;
  const sess = (k, i) => ({ id: 'syn' + i, date: E.addDays(t, -k), plan: 'A', name: 'Ganzkörper A', minutes: 50, entries: [{ ex, sets: [{ kg: 20, reps: 10, done: true }] }] });
  S.training.sessions = S.training.sessions.filter(s => s.imported).concat([sess(6, 1), sess(3, 2), sess(10, 3)]);
  S.training.runs = [{ id: 'r1', date: E.addDays(t, -5), min: 30 }];
  S.training.routineLog = [7, 4, 2, 12, 9].map(k => ({ date: E.addDays(t, -k), id: 'dehnen' }));
  S.training.protein = {};
  [[7, 140], [6, 120], [5, 135], [4, 150], [3, 100], [14, 100], [12, 110], [10, 90]].forEach(([k, g]) => { S.training.protein[E.addDays(t, -k)] = g; });
  const ids = S.wardrobe.items.filter(i => i.status === 'aktiv').slice(0, 3).map(i => i.id);
  S.wardrobe.wear = [7, 6, 4, 2, 12, 10, 8].map(k => ({ date: E.addDays(t, -k), items: ids, key: 'syn', occasion: 'smart' }));
  localStorage.setItem('haltung.v1', JSON.stringify(S));
  return Object.keys(D).length;
})"""

REVIEW = {
    'Schlaf': 'Im Schnitt 7,1 h, 35 Minuten mehr als in der Vorwoche; dein Ziel sind 7,5 h.',
    'Beschwerden': 'An 3 von 7 eingetragenen Tagen, in der Vorwoche an 2 von 7; am häufigsten Gereizte Augen (2 Tage). Infekt-Anzeichen an 1 Tag.',
    'Training': 'Kraft 2 von 2, Laufen 1 von 1, Dehnen 3 von 3; in der Vorwoche Kraft 1, Laufen 0, Dehnen 2.',
    'Eiweiß': 'Ziel von 130 g an 3 von 5 Tagen mit Einträgen erreicht, im Schnitt 129 g; in der Vorwoche 100 g.',
    'Outfit': 'An 4 Tagen ein Outfit als getragen markiert, in der Vorwoche an 3 Tagen.',
}
SUM = 'Schlaf 7,1 h, Beschwerden an 3 Tagen, Kraft 2 von 2, Eiweiß-Ziel an 3 Tagen, Outfit an 4 Tagen'


async def until(pg, expr, timeout=15000):
    """Wartet per evaluate (wait_for_function scheitert an der CSP des Web-Builds)."""
    t0 = time.time()
    while True:
        try:
            if await pg.evaluate(expr):
                return
        except Exception:
            pass
        if time.time() - t0 > timeout / 1000:
            raise AssertionError('Zeitüberschreitung: ' + expr)
        await asyncio.sleep(0.1)


async def overflow(pg, w):
    return await pg.evaluate('document.documentElement.scrollWidth') <= w


async def prepare(p, w, h, mobile=False, dark=False, old=None):
    """Kontext mit Montag 8:30, eigenen Antworten für Wetter, Pollen und Luft, Testdaten gespeichert und neu geladen."""
    b, ctx, pg, errs = await setup(p, w, h, mobile=mobile, dark=dark, unfold=False)
    reqs = []
    await env_routes(ctx, today=MON, aq=aq, wx=wx, log=reqs)
    await pg.clock.set_fixed_time(AT)
    await pg.goto(URL); await pg.wait_for_selector('.fold-head')
    await until(pg, f"{ST}.env && {ST}.env.at")
    first = list(reqs)
    await pg.evaluate(SYNTH + f"({old or 0})")
    await pg.reload(); await pg.wait_for_selector('.fold-head')
    await until(pg, f"Object.keys({ST}.env.days).length >= 62")
    return b, ctx, pg, errs, reqs, first


async def main():
    async with async_playwright() as p:
        # 1. Handy am Montag: erst gestern und heute, nach den Check-ins die Tage davor; Pollenhinweis; Rückblick
        b, ctx, pg, errs, reqs, first = await prepare(p, 390, 844, mobile=True)
        assert len(first) == 2 and all('past_days=1&forecast_days=1' in u for u in first), first
        assert any('air-quality-api.open-meteo.com' in u and 'birch_pollen' in u for u in first) and any('api.open-meteo.com/v1/forecast' in u and 'pressure_msl' in u for u in first), first
        later = reqs[2:]
        assert len(later) == 2 and all('past_days=61&forecast_days=1' in u for u in later), later
        env = await pg.evaluate(f"(() => {{ const S = {ST}, E = window.HaltungDebug.E, t = E.today(); return [S.env.days[E.addDays(t, -1)], S.env.days[E.addDays(t, -9)], S.env.days[E.addDays(t, -2)], S.env.loc, S.meta.changedAt || null]; }})()")
        y, d9, d2, loc, changed = env
        assert y['pol']['bi'] == 120 and y['pol']['gr'] == 4 and y['pol']['er'] == 0 and y['aq'] == 24 and y['p'] == 1014 and y['fw'] == 1 and y['fa'] == 1, y
        assert abs(y['tx'] - y['tn'] - 6) < 0.6 and y['tn'] < y['tm'] < y['tx'], y
        assert d9['p'] == 1006 and d2['pol']['bi'] == 3, (d9, d2)
        assert loc == '50.21,8.60', loc
        assert changed is None, 'leise gespeichert: kein neuer Datenstand ' + str(changed)
        line = await pg.inner_text('.page-sub .env-line')
        assert line == 'Pollen: Birke stark', line
        # Rückblick zugeklappt mit Zusammenfassung und Kalenderwoche
        assert await pg.locator('[data-fold="review"]').count() == 1
        assert await pg.get_attribute('button.fold-head[data-k="review"]', 'aria-expanded') == 'false'
        sm = await pg.inner_text('[data-fold="review"] .fold-sum')
        assert sm == SUM, sm
        assert await pg.inner_text('[data-fold="review"] .fold-badge') == f'KW {KW}'
        assert await pg.locator('#view .ledger > section').count() == 3, 'Rückblick steht über den Kacheln, nicht darin'
        await pg.click('button.fold-head[data-k="review"]'); await pg.wait_for_timeout(150)
        rows = await pg.evaluate("[...document.querySelectorAll('.rv-list li')].map(li => [li.querySelector('.rv-k').textContent, li.querySelector('.rv-t').textContent])")
        assert dict(rows) == REVIEW and [r[0] for r in rows] == list(REVIEW), rows
        hint = await pg.inner_text('[data-fold="review"] .rv-hint')
        assert hint == 'Aus deinen Verläufen: Tage mit Gereizte Augen hatten oft auch „Birkenpollen mäßig oder stärker“ (an 15 von 15). Ein Hinweis, kein Beweis.', hint
        assert 'verglichen mit der Woche davor' in await pg.inner_text('#fold-review')
        assert await overflow(pg, 390), 'Rückblick ragt nicht heraus'
        await pg.screenshot(path=str(SHOT / 'w_heute_handy.png'), full_page=True)
        # Dienstag noch da, Donnerstag weg; wieder Montag: ausblenden bleibt nach dem Neuladen
        for days, seen in ((1, True), (2, True), (3, False), (6, False), (0, True)):
            await pg.clock.set_fixed_time(AT + datetime.timedelta(days=days))
            await pg.reload(); await pg.wait_for_selector('.fold-head')
            assert (await pg.locator('[data-fold="review"]').count() == 1) == seen, (days, seen)
        if await pg.get_attribute('button.fold-head[data-k="review"]', 'aria-expanded') == 'false':  # bleibt in der Sitzung offen
            await pg.click('button.fold-head[data-k="review"]'); await pg.wait_for_timeout(150)
        await pg.click('#fold-review button[data-a="dismiss"]'); await pg.wait_for_timeout(150)
        assert await pg.locator('[data-fold="review"]').count() == 0
        await pg.reload(); await pg.wait_for_selector('.fold-head')
        assert await pg.locator('[data-fold="review"]').count() == 0, 'ausgeblendet bleibt ausgeblendet'
        assert await pg.evaluate(f"{ST}.meta.dismissed['review:' + window.HaltungDebug.E.addDays(window.HaltungDebug.E.weekStart(window.HaltungDebug.E.today()), -7)]") is True
        print('Rückblick und Pollenhinweis am Handy ok')

        # 2. Verläufe am Handy: Panel Wetter, Pollen und Luft, Zusammenhänge, Detail, Jahr
        await pg.evaluate("location.hash = '#/gesundheit/verlauf'"); await pg.wait_for_selector('.tr-env .chart svg')
        env_txt = await pg.inner_text('.tr-env')
        for s in ('Wetter, Pollen und Luft', 'an deinem Wohnort, je Tag', 'Beschwerden', 'Temperatur', 'Luftdruck', 'Pollen', 'Luftqualität'):
            assert s in env_txt, (s, env_txt)
        lines = await pg.evaluate("[...document.querySelectorAll('.tr-env-sum li')].map(li => li.textContent)")
        assert re.fullmatch(r'Temperatur von \d+ bis \d+ °C, an 4 Tagen fiel der Luftdruck um 5 hPa oder mehr\.', lines[0]), lines
        assert lines[1:] == ['Pollen mäßig oder stärker: Birke an 9 Tagen.', 'Luftqualität im Schnitt ausreichend (Index 26), an 3 Tagen mäßig oder schlechter.'], lines
        links = await pg.evaluate("[...document.querySelectorAll('.tr-env .checklist li')].map(li => [li.querySelector('.check-name').textContent, li.querySelector('.check-meta').textContent])")
        assert links == [['Gereizte Augen: Birkenpollen mäßig oder stärker', 'an 8 von 8 Tagen mit Gereizte Augen, sonst an 0 % der Tage'],
                         ['Kopfschmerzen: Luftdruck fällt (5 hPa zum Vortag)', 'an 3 von 3 Tagen mit Kopfschmerzen, sonst an 0 % der Tage']], links
        src = await pg.inner_text('.tr-env .tr-src')
        assert 'Open-Meteo.com' in src and 'Copernicus Atmosphere Monitoring Service (CAMS)' in src and 'MeteoSchweiz' in src, src
        # Tooltip per Tastatur: heute, dann gestern
        await pg.focus('.chart[data-id="trenv"]'); await pg.wait_for_timeout(100)
        tip = await pg.inner_text('.chart[data-id="trenv"] .tip')
        assert 'Beschwerden: kein Eintrag' in tip and 'Luftdruck: 1006 hPa' in tip and 'Pollen: Birke stark, Gräser schwach' in tip and 'Luftqualität: 24, ausreichend' in tip, tip
        assert re.search(r'Temperatur: \d+ bis \d+ °C', tip), tip
        await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(100)
        tip = await pg.inner_text('.chart[data-id="trenv"] .tip')
        assert 'Beschwerden: 1 Beschwerde' in tip and 'Luftdruck: 1014 hPa' in tip, tip
        # Tabellenansicht
        await pg.click('.tr-env .table-view summary')
        head = await pg.evaluate("[...document.querySelectorAll('.tr-env .table-view th')].map(t => t.textContent)")
        assert head == ['Zeitraum', 'Beschwerden', 'Temperatur', 'Luftdruck', 'Pollen', 'Luftqualität'], head
        assert await pg.locator('.tr-env .table-view tbody tr').count() == 30
        first_row = await pg.evaluate("[...document.querySelector('.tr-env .table-view tbody tr').children].map(t => t.textContent)")
        assert first_row[1] == '' and first_row[3] == '1006 hPa' and first_row[4] == 'stark' and first_row[5] == '24, ausreichend', first_row
        assert await overflow(pg, 390), 'Verläufe mit Umwelt ragt nicht heraus'
        await pg.locator('.tr-env').screenshot(path=str(SHOT / 'w_umwelt_handy.png'))
        # Detail: gereizte Augen mit Birkenpollen und Tagestemperatur
        await pg.click('button[data-a="tr.sym"][data-k="augen"]'); await pg.wait_for_timeout(200)
        det = await pg.evaluate("document.querySelector('.tr-det').closest('.panel').textContent")
        assert 'Birkenpollen mäßig oder stärker' in det and 'Tagestemperatur' in det and 'Wetter, Pollen und Luft mit den Tagen ohne' not in det, det
        # Jahr: Wochen statt Tage, ohne Archiv-Abfrage (alle Check-ins sind jünger als 92 Tage)
        n = len(reqs)
        await pg.click('button[data-a="tr.range"][data-v="365"]'); await pg.wait_for_timeout(300)
        assert 'an deinem Wohnort, je Woche' in await pg.inner_text('.tr-env .sec-head')
        assert await pg.locator('.chart[data-id="trenv"] svg').count() == 1
        await pg.wait_for_timeout(300)
        assert len(reqs) == n and not any('archive-api' in u for u in reqs), reqs[n:]
        await b.close()
        assert not errs, errs
        print('Verläufe mit Wetter, Pollen und Luft am Handy ok')

        # 3. PC hell und dunkel
        for dark in (False, True):
            b, ctx, pg, errs, reqs, first = await prepare(p, 1440, 900, dark=dark)
            await pg.evaluate("location.hash = '#/gesundheit/verlauf'"); await pg.wait_for_selector('.tr-env .chart svg')
            await pg.locator('.chart[data-id="trenv"]').scroll_into_view_if_needed()
            box = await pg.locator('.chart[data-id="trenv"]').bounding_box()
            await pg.mouse.move(box['x'] + box['width'] - 8, box['y'] + 80); await pg.wait_for_timeout(100)
            assert 'Pollen: Birke stark' in await pg.inner_text('.chart[data-id="trenv"] .tip')
            await pg.locator('.tr-env').screenshot(path=str(SHOT / f'w_umwelt_pc{"_dunkel" if dark else ""}.png'))
            await pg.evaluate("location.hash = '#/heute'"); await pg.wait_for_selector('[data-fold="review"]')
            await pg.click('button.fold-head[data-k="review"]'); await pg.wait_for_timeout(150)
            await pg.screenshot(path=str(SHOT / f'w_heute_pc{"_dunkel" if dark else ""}.png'))
            await b.close()
            assert not errs, errs
        print('PC hell und dunkel ok')

        # 4. Ältere Check-ins: Archiv für die Tage vor den letzten 92
        b, ctx, pg, errs, reqs, first = await prepare(p, 1280, 860, old=120)
        await until(pg, f"(() => {{ const S = {ST}, E = window.HaltungDebug.E; const x = S.env.days[E.addDays(E.today(), -100)]; return x && x.tm != null && x.aq != null; }})()")
        t = MON
        a, z = (t - datetime.timedelta(days=121)).isoformat(), (t - datetime.timedelta(days=93)).isoformat()
        arch = [u for u in reqs if 'start_date=' in u]
        assert len(arch) == 2 and any(u.startswith('https://archive-api.open-meteo.com/v1/archive?') for u in arch) and any(u.startswith('https://air-quality-api.open-meteo.com/') for u in arch), arch
        assert all(f'start_date={a}&end_date={z}' in u for u in arch), arch
        assert any('past_days=92' in u for u in reqs), reqs
        old_day = await pg.evaluate(f"{ST}.env.days[window.HaltungDebug.E.addDays(window.HaltungDebug.E.today(), -121)]")
        assert old_day['fw'] == 1 and old_day['fa'] == 1, old_day
        await b.close()
        assert not errs, errs
        print('Archiv für ältere Check-ins ok')

        # 5. Dienst gestört: Luftqualität antwortet mit 500, das Wetter kommt trotzdem; neuer Versuch erst nach 10 Minuten
        b, ctx, pg, errs = await setup(p, 1280, 860, unfold=False)
        aqlog = []
        async def broken(route):
            aqlog.append(route.request.url)
            await route.fulfill(status=500, headers={'Access-Control-Allow-Origin': '*'}, body='kaputt')
        await env_routes(ctx, today=MON, aq=aq, wx=wx)
        await ctx.route('https://air-quality-api.open-meteo.com/**', broken)
        await pg.clock.set_fixed_time(AT)
        await pg.goto(URL); await pg.wait_for_selector('.fold-head')
        await until(pg, f"(() => {{ const S = {ST}, E = window.HaltungDebug.E; const x = S.env.days[E.today()]; return x && x.tm != null; }})()")
        assert len(aqlog) == 1
        assert await pg.evaluate(f"{ST}.env.at") is None, 'unvollständig: gilt nicht als frisch'
        await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(300)
        assert len(aqlog) == 1, 'gebremst'
        await pg.clock.set_fixed_time(AT + datetime.timedelta(minutes=11))
        await pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg.wait_for_timeout(300)
        assert len(aqlog) == 2, 'nach 10 Minuten neuer Versuch'
        await pg.evaluate("location.hash = '#/gesundheit/verlauf'"); await pg.wait_for_timeout(300)
        rest = [e for e in errs if 'status of 500' not in e]
        assert not rest, rest
        await b.close()
        print('Störung gebremst ok')

        # 6. Web-Build unter der CSP: Backup einspielen, Wetter, Pollen und Luft kommen an, keine CSP-Verstöße
        backup = ROOT / 'tests' / 'backup-web.json'
        if backup.exists():
            tmp = pathlib.Path(tempfile.mkdtemp(prefix='chrisos-v28-'))
            # Backup wie aus 2.7, ohne gespeicherte Umweltwerte: Die App holt sie unter der CSP selbst
            data = json.loads(backup.read_text(encoding='utf-8'))
            data['state'].pop('env', None)
            backup = tmp / 'backup-ohne-umwelt.json'
            backup.write_text(json.dumps(data), encoding='utf-8')
            site = tmp / 'web'
            shutil.copytree(ROOT / 'dist' / 'web', site)
            srv = serve(site, 8768)
            try:
                br = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
                ctx = await br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
                await ctx.add_init_script("window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));")
                async def wxr(route):
                    await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(fixture(7.5, 60)))
                await ctx.route('https://api.open-meteo.com/**', wxr)
                weblog = []
                await env_routes(ctx, aq=aq, wx=wx, log=weblog)
                pg = await ctx.new_page()
                werrs = []
                pg.on('console', lambda m: werrs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
                pg.on('pageerror', lambda e: werrs.append(f'PAGEERROR: {e}'))
                await pg.goto('http://localhost:8768/'); await pg.wait_for_selector('#welcome-file', state='attached')
                await pg.set_input_files('#welcome-file', str(backup))
                await until(pg, f"(() => {{ try {{ const S = {ST}; return S && S.env && Object.keys(S.env.days).length >= 2 && S.env.at; }} catch (e) {{ return false; }} }})()")
                assert any('air-quality-api' in u for u in weblog) and any('past_days=' in u and 'api.open-meteo.com/v1/forecast' in u for u in weblog), weblog
                assert await pg.evaluate('window.__csp') == [], await pg.evaluate('window.__csp')
                assert not werrs, werrs
                await br.close()
            finally:
                srv.shutdown()
            print('Web-Build unter der CSP ok')
        else:
            print('Web-Build übersprungen: erst tests/test_pwa.py ausführen (legt das Backup an)')
        print('Version 2.8: alle Tests bestanden, keine Konsolenfehler')


asyncio.run(main())
