"""Version 2.9. Selbstexperimente unter Gesundheit: Vorlagen mit Gründen aus den eigenen Daten, Dialog (Vorlage, Regel,
Wann, Werte, Erwartung, Dauer, Start), Abhaken im Check-in auf Heute und im großen Check-in, Erkennung aus dem
Ernährungsprotokoll, Tage zum Nachtragen, Kalender-Erinnerung, Beenden; Ergebnis mit Vergleich zu den Tagen davor,
Tag-für-Tag-Diagramm und Fazit, Bericht für den Arzt. Pollen auf die eigenen Arten beschränkt (K48): aus den Angaben zu
Allergien oder gewählt, Kopfzeile auf Heute, Verläufe und Einstellungen. Handy und PC, hell und dunkel, Web-Build
unter der CSP, ohne Konsolenfehler und ohne seitliches Herausragen."""
import asyncio, datetime, json, pathlib, re, shutil, sys, tempfile, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import setup, URL, env_routes, fixture
from serve_web import serve

SHOT = pathlib.Path(__file__).resolve().parent
ROOT = SHOT.parent
TODAY = datetime.date.today()
MON = TODAY - datetime.timedelta(days=TODAY.weekday())
THU = MON + datetime.timedelta(days=3)  # Donnerstag: kein Wochenrückblick
ST = "JSON.parse(localStorage.getItem('haltung.v1'))"
D = lambda k: (THU + datetime.timedelta(days=k)).isoformat()
at = lambda k, h=8, m=30: datetime.datetime.combine(THU + datetime.timedelta(days=k), datetime.time(h, m))
short = lambda iso: f'{int(iso[8:10])}.{int(iso[5:7])}.'


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


async def go(pg, h, wait=300):
    await pg.evaluate(f"location.hash = '{h}'"); await pg.wait_for_timeout(wait)


async def clock(pg, when):
    await pg.clock.set_fixed_time(when)
    await pg.reload(); await pg.wait_for_selector('.fold-head')


async def text(pg, sel):
    return re.sub(r'\s+', ' ', await pg.evaluate(f"document.querySelector({json.dumps(sel)}).textContent")).strip()


# 28 Tage Check-ins vor heute: Schlaf 6,5 oder 7 h, sonst mittel; für die Vorlagen und die Tage davor
SYN1 = """(() => {
  const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today(), D = S.health.days = {};
  for (let k = 28; k >= 1; k--) D[E.addDays(t, -k)] = { sym: {}, meas: [], f: {}, none: true, t: Date.now(), sleepH: k % 2 ? 7 : 6.5, sleepQ: 3, energy: 3, mood: 3 };
  S.health.exps = [];
  localStorage.setItem('haltung.v1', JSON.stringify(S));
})()"""

# Ein abgeschlossenes Experiment „Kein Kaffee nach 14 Uhr“ über 14 Tage bis vorgestern, an 11 Tagen eingehalten; die
# Werte vom Morgen danach wie in tests/exp_test.js
SYN2 = """(() => {
  const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today(), T0 = E.addDays(t, -15), at = k => E.addDays(T0, k);
  const D = S.health.days = {};
  const qB = [3, 2, 3, 4, 3, 3, 2, 3, 3, 4, 3, 3, 3, 2], hB = [6.5, 6, 7, 6.5, 6.5, 7, 6, 6.5, 6.5, 7, 6, 6.5, 6.5, 6.5], eB = [3, 3, 4, 2, 3, 3, 3, 4, 2, 3, 3, 3, 4, 3];
  for (let i = 0; i < 14; i++) D[at(i - 13)] = { sym: {}, meas: [], f: {}, none: true, t: Date.now(), sleepQ: qB[i], sleepH: hB[i], energy: eB[i] };
  const ex = { id: 'k1', tpl: 'kaffee', rule: 'Kein Kaffee nach 14 Uhr', at: '14:00', free: false, when: 'abend', measures: ['sleepQ', 'sleepH', 'energy'], expect: 'Ich schlafe besser.', days: 14, start: T0, end: at(13), stopped: null, log: {}, verdict: null, created: Date.now() };
  const no = [2, 6, 10], qK = [4, 4, 3, 4, 5, 4, 4, 4, 3, 4, 4], hK = [7.5, 7, 7.5, 8, 7, 7.5, 7, 7.5, 7, 7.5, 8];
  let ki = 0;
  for (let k = 0; k < 14; k++) {
    const miss = no.includes(k); ex.log[at(k)] = !miss;
    const x = miss ? { sleepQ: 3, sleepH: 6.5, energy: 3 } : { sleepQ: qK[ki], sleepH: hK[ki], energy: eB[ki] };
    if (!miss) ki++;
    D[at(k + 1)] = Object.assign({ sym: {}, meas: [], f: {}, none: true, t: Date.now() }, x);
  }
  S.health.exps = [ex];
  localStorage.setItem('haltung.v1', JSON.stringify(S));
  return [T0, at(13)];
})()"""

# 60 Tage Check-ins: gereizte Augen an Tagen mit Gräserpollen; Allergien im Bericht als Text
SYN3 = """((allergy) => {
  const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today(), D = S.health.days = {};
  for (let k = 60; k >= 1; k--) { const x = { sym: {}, meas: [], f: {}, t: Date.now(), sleepH: 7, mood: 3 }; if (k % 3 === 2) x.sym.augen = 2; else x.none = true; D[E.addDays(t, -k)] = x; }
  S.health.record.allergies = allergy; delete S.health.profile.pollen;
  localStorage.setItem('haltung.v1', JSON.stringify(S));
})"""


def aq3(d, k):
    """Gräser mäßig an jedem dritten Tag und heute, Birke stark an jedem vierten Tag und heute."""
    return {'european_aqi': 24, 'birch_pollen': 120 if k % 4 == 1 or k == 0 else 3, 'grass_pollen': 30 if k % 3 == 2 or k == 0 else 4, 'alder_pollen': 0}


async def main():
    async with async_playwright() as p:
        # 1. Handy: Experiment anlegen, abhaken, Erkennung, nachtragen, Erinnerung, beenden
        b, ctx, pg, errs = await setup(p, 390, 844, mobile=True)
        await pg.clock.set_fixed_time(at(0))
        await pg.goto(URL); await pg.wait_for_selector('.fold-head')
        await pg.evaluate(SYN1)
        await pg.reload(); await pg.wait_for_selector('.fold-head')
        # Muster: Schlafmangel als Auslöser, daraus ein Experiment
        await go(pg, '#/gesundheit/muster')
        await pg.click('button[data-a="exp.new"][data-k="bett"]'); await pg.wait_for_timeout(200)
        assert await pg.get_attribute('#dlg button[data-a="exp.tpl"][data-k="bett"]', 'aria-pressed') == 'true'
        assert await pg.input_value('#dlg input[name="rule"]') == 'Um 22:30 ins Bett'
        await pg.click('#dlg button[data-a="dlg.close"]'); await pg.wait_for_timeout(100)
        # Experimente: Reiter, Vorlagen mit Gründen zuerst
        await go(pg, '#/gesundheit/experimente')
        assert await pg.get_attribute('.tabs a[href="#/gesundheit/experimente"]', 'aria-current') == 'page'
        cards = await pg.evaluate("[...document.querySelectorAll('.exp-tpl')].map(li => [li.querySelector('.check-name').textContent, (li.querySelector('.exp-fit') || {}).textContent || ''])")
        assert [c[0] for c in cards] == ['Um 22:30 ins Bett', 'Morgens etwas essen', 'Kein Kaffee nach 14 Uhr', 'Jeden Tag 2 Liter trinken', 'Abends 10 Minuten dehnen', 'Kein Alkohol'], cards
        assert cards[0][1] == 'Schlafmangel ist dein häufigster Auslöser, zuletzt 6,8 h statt 7,5 h Schlaf.', cards[0]
        assert cards[1][1] == 'Passt zu deinem Verdacht: Mundgeruch bei Hunger.' and cards[2][1] == '', cards
        assert 'Vergleicht Schlafqualität, Tage mit „Verspannt“ und Befinden, jeweils am Morgen danach.' in await text(pg, '.exp-tpls')
        assert await overflow(pg, 390), 'Vorlagen ragen nicht heraus'
        await pg.screenshot(path=str(SHOT / 'x_vorlagen_handy.png'), full_page=True)
        # Dialog: Vorlage Kaffee, dann Bett und zurück; Erwartung, Dauer und Werte bleiben beim Umschalten erhalten
        await pg.click('.exp-tpl button[data-a="exp.new"][data-k="kaffee"]'); await pg.wait_for_timeout(200)
        pressed = lambda grp: pg.evaluate(f"[...document.querySelectorAll('#dlg button[data-a=\"{grp}\"][aria-pressed=\"true\"]')].map(b => b.textContent)")
        assert await pressed('exp.tpl') == ['Kein Kaffee nach 14 Uhr'] and await pressed('exp.m') == ['Schlaf', 'Schlafqualität', 'Energie'], await pressed('exp.m')
        assert await pressed('exp.when') == ['Abends'] and await pressed('exp.days') == ['14 Tage'] and await pressed('exp.start') == ['Heute']
        assert await pg.input_value('#dlg input[name="expect"]') == 'Ich schlafe besser.'
        await pg.click('#dlg button[data-a="exp.days"][data-v="21"]'); await pg.wait_for_timeout(100)
        await pg.click('#dlg button[data-a="exp.tpl"][data-k="bett"]'); await pg.wait_for_timeout(100)
        assert await pg.input_value('#dlg input[name="rule"]') == 'Um 22:30 ins Bett' and await pressed('exp.days') == ['21 Tage'], 'Dauer bleibt beim Wechsel der Vorlage'
        await pg.click('#dlg button[data-a="exp.tpl"][data-k="kaffee"]'); await pg.wait_for_timeout(100)
        await pg.fill('#dlg input[name="expect"]', 'Ich schlafe tiefer')
        await pg.click('#dlg button[data-a="exp.m"][data-k="mood"]'); await pg.wait_for_timeout(100)
        assert await pg.input_value('#dlg input[name="expect"]') == 'Ich schlafe tiefer', 'Erwartung bleibt beim Antippen'
        assert await pressed('exp.m') == ['Schlaf', 'Schlafqualität', 'Befinden', 'Energie']
        await pg.click('#dlg button[data-a="exp.m"][data-k="sleepH"]'); await pg.wait_for_timeout(100)
        await pg.click('#dlg button[data-a="exp.save"]'); await pg.wait_for_timeout(300)
        e = (await pg.evaluate(f"{ST}.health.exps"))[0]
        assert {k: e[k] for k in ('tpl', 'rule', 'at', 'free', 'when', 'measures', 'expect', 'days', 'start', 'end', 'stopped', 'log', 'verdict')} == {
            'tpl': 'kaffee', 'rule': 'Kein Kaffee nach 14 Uhr', 'at': '14:00', 'free': False, 'when': 'abend', 'measures': ['sleepQ', 'energy', 'mood'], 'expect': 'Ich schlafe tiefer',
            'days': 21, 'start': D(0), 'end': D(20), 'stopped': None, 'log': {}, 'verdict': None}, e
        assert await pg.evaluate("location.hash") == '#/gesundheit/experimente'
        assert 'Experiment gestartet' in await pg.inner_text('#toast')
        assert [await text(pg, '.exp-card .sec-title'), await text(pg, '.exp-card .sec-head .tag')] == ['Kein Kaffee nach 14 Uhr', 'Tag 1 von 21']
        assert f'Läuft vom {short(D(0))} bis {short(D(20))} Abhaken kannst du jeden Tag beim Check-in oder hier unten.' in await text(pg, '.exp-card'), await text(pg, '.exp-card')
        cls = await pg.evaluate("[...document.querySelectorAll('.xd')].map(b => b.className.replace('xd ', ''))")
        assert len(cls) == 21 and cls[0] == 'open today' and all(c == 'fut' for c in cls[1:]), cls
        assert await pg.locator('.xd.fut[disabled]').count() == 20
        assert 'Ab vier Tagen mit eingehaltener Regel' in await text(pg, '.exp-result')
        assert await pg.locator('button[data-a="exp.new"]').count() == 0, 'kein zweites Experiment'
        # Heute um 8:30: noch keine Frage, die Regel gilt ab 14 Uhr
        await go(pg, '#/heute')
        assert await text(pg, '.exp-row .exp-cell') == 'Kein Kaffee nach 14 Uhr, Tag 1 von 21. Ändern'
        assert 'Experiment' not in await text(pg, '[data-fold="checkin"] .fold-sum')
        # Abends: Frage für heute, abhaken
        await clock(pg, at(0, 21, 0))
        assert await text(pg, '[data-fold="checkin"] .exp-q') == 'Heute ab 14 Uhr ohne Kaffee?'
        assert (await text(pg, '[data-fold="checkin"] .fold-sum')).endswith('Experiment: heute offen'), await text(pg, '[data-fold="checkin"] .fold-sum')
        await pg.click('.exp-row button[data-a="exp.set"][data-v="1"]'); await pg.wait_for_timeout(150)
        assert (await pg.evaluate(f"{ST}.health.exps[0].log")) == {D(0): True}
        assert await text(pg, '.exp-row .exp-cell') == 'Kein Kaffee nach 14 Uhr, Tag 1 von 21. Heute eingehalten. Ändern'
        assert 'Experiment' not in await text(pg, '[data-fold="checkin"] .fold-sum')
        # Freitag früh: gestern eingehalten, heute noch nichts
        await clock(pg, at(1))
        assert await text(pg, '.exp-row .exp-cell') == 'Kein Kaffee nach 14 Uhr, Tag 2 von 21. Gestern eingehalten. Ändern'
        # Kaffee am Freitag um 15:10 im Ernährungsprotokoll: Samstag erkennt die App „nicht eingehalten“
        await pg.evaluate(f"""(() => {{ const S = window.HaltungDebug.state; S.nutrition.log['{D(1)}'] = [{{ id: 'n1', name: 'Kaffee', key: 'f:kaffee', g: 200, amt: '1 Tasse', kcal: 4, p: 0.4, c: 0, f: 0, fib: 0, slot: 'snack', time: '15:10', fl: 'dhk', cups: 1 }}]; localStorage.setItem('haltung.v1', JSON.stringify(S)); }})()""")
        await clock(pg, at(2))
        assert await text(pg, '.exp-row .exp-cell') == 'Kein Kaffee nach 14 Uhr, Tag 3 von 21. Gestern nicht eingehalten: Kaffee um 15:10 im Ernährungsprotokoll. Ändern'
        assert await pg.locator('.exp-row .exp-yn').count() == 0
        await go(pg, '#/gesundheit/experimente')
        cls = await pg.evaluate("[...document.querySelectorAll('.xd')].slice(0, 3).map(b => b.className.replace('xd ', ''))")
        assert cls == ['yes', 'no auto', 'open today'], cls
        assert 'Eingehalten an 1 von 3 Tagen, nicht eingehalten an 1, 1 offen.' in await text(pg, '.exp-card')
        await pg.click(f'.xd[data-d="{D(1)}"]'); await pg.wait_for_timeout(150)
        dlg = await text(pg, '#dlg')
        assert 'Gestern ab 14 Uhr ohne Kaffee?' in dlg and 'Kaffee um 15:10 im Ernährungsprotokoll.' in dlg and 'Wie erkannt' in dlg, dlg
        await pg.click('#dlg button[data-a="exp.mark"][data-v="1"]'); await pg.wait_for_timeout(150)
        assert (await pg.evaluate(f"{ST}.health.exps[0].log"))[D(1)] is True
        assert await pg.get_attribute(f'.xd[data-d="{D(1)}"]', 'class') == 'xd yes'
        await pg.screenshot(path=str(SHOT / 'x_laeuft_handy.png'), full_page=True)
        assert await overflow(pg, 390), 'laufendes Experiment ragt nicht heraus'
        # Großer Check-in für gestern: abgehakt; noch einmal tippen nimmt es zurück, dann gilt die Erkennung
        await go(pg, '#/gesundheit')
        await pg.click(f'button[data-a="hc.date"][data-v="{D(1)}"]'); await pg.wait_for_timeout(150)
        assert await text(pg, '.exp-row .exp-q') == 'Gestern ab 14 Uhr ohne Kaffee?'
        assert await pg.get_attribute('.exp-row button[data-v="1"]', 'aria-pressed') == 'true'
        await pg.click('.exp-row button[data-v="1"]'); await pg.wait_for_timeout(150)
        assert await pg.get_attribute('.exp-row button[data-v="0"]', 'aria-pressed') == 'true'
        assert await text(pg, '.exp-row .exp-auto') == 'Kaffee um 15:10 im Ernährungsprotokoll. Tippe an, um es zu ändern.'
        assert D(1) not in await pg.evaluate(f"{ST}.health.exps[0].log")
        # Kalender: täglich 13:45 bis zum Ende
        await go(pg, '#/gesundheit/experimente')
        async with pg.expect_download() as dl:
            await pg.click('button[data-a="exp.ics"]')
        f = await dl.value
        ics = open(await f.path(), encoding='utf-8').read()
        assert f.suggested_filename == 'experiment-kein-kaffee-nach-14-uhr.ics', f.suggested_filename
        assert 'RRULE:FREQ=DAILY;COUNT=19' in ics and 'SUMMARY:Experiment: ab 14 Uhr kein Kaffee mehr' in ics and f'DTSTART:{D(2).replace("-", "")}T134500' in ics, ics
        # Beenden: die Tage bis gestern bleiben, das Ergebnis braucht mehr Tage
        await pg.click('button[data-a="exp.stop"]'); await pg.wait_for_timeout(100)
        await pg.click('#dlg button[data-a="confirm.ok"]'); await pg.wait_for_timeout(200)
        e = (await pg.evaluate(f"{ST}.health.exps"))[0]
        assert e['stopped'] == D(1), e
        assert [await text(pg, '.exp-done .sec-title'), await text(pg, '.exp-done .sec-head .tag')] == ['Kein Kaffee nach 14 Uhr', f'{short(D(0))} bis {short(D(1))}, abgebrochen']
        assert 'Für einen Vergleich braucht es mindestens vier Tage mit eingehaltener Regel; es waren 1.' in await text(pg, '.exp-done')
        assert await pg.locator('.exp-start').count() == 1 and await pg.locator('.exp-done button[data-a="exp.again"]').count() == 1
        await go(pg, '#/heute')
        assert await pg.locator('.exp-row').count() == 0, 'abgebrochen: keine Zeile im Check-in'
        # Geplant für morgen: Zeile auf Heute, Verwerfen
        await go(pg, '#/gesundheit/experimente')
        await pg.click('.exp-tpl button[data-k="fruehstueck"]'); await pg.wait_for_timeout(150)
        assert await pressed('exp.when') == ['Tagsüber'] and await pressed('exp.m') == ['Befinden', 'Energie', 'Atem'], await pressed('exp.m')
        await pg.click('#dlg button[data-a="exp.start"][data-v="morgen"]'); await pg.wait_for_timeout(100)
        await pg.click('#dlg button[data-a="exp.save"]'); await pg.wait_for_timeout(250)
        assert [await text(pg, '.exp-card .sec-title'), await text(pg, '.exp-card .sec-head .tag')] == ['Morgens etwas essen', 'startet morgen']
        assert await pg.locator('.exp-result').count() == 0 and await pg.locator('.xd:not([disabled])').count() == 0
        await go(pg, '#/heute')
        assert await text(pg, '.exp-row .exp-cell') == 'Morgens etwas essen, startet morgen.'
        await go(pg, '#/gesundheit/experimente')
        await pg.click('button[data-a="exp.stop"]'); await pg.wait_for_timeout(100)
        await pg.click('#dlg button[data-a="confirm.ok"]'); await pg.wait_for_timeout(200)
        assert len(await pg.evaluate(f"{ST}.health.exps")) == 1 and 'verworfen' in await pg.inner_text('#toast')
        # Löschen
        await pg.click('.exp-done button[data-a="exp.del"]'); await pg.wait_for_timeout(100)
        await pg.click('#dlg button[data-a="confirm.ok"]'); await pg.wait_for_timeout(200)
        assert await pg.evaluate(f"{ST}.health.exps") == [] and await pg.locator('.exp-done').count() == 0
        await b.close()
        assert not errs, errs
        print('Experiment anlegen, abhaken, erkennen, beenden am Handy ok')

        # 2. Ergebnis eines abgeschlossenen Experiments: Handy, dann PC hell und dunkel
        for w, h, mobile, dark in ((390, 844, True, False), (1440, 900, False, False), (1440, 900, False, True)):
            b, ctx, pg, errs = await setup(p, w, h, mobile=mobile, dark=dark)
            await pg.clock.set_fixed_time(at(0))
            await pg.goto(URL); await pg.wait_for_selector('.fold-head')
            t0, t13 = await pg.evaluate(SYN2)
            await pg.reload(); await pg.wait_for_selector('.fold-head')
            # Heute: abgeschlossen, Ergebnis ansehen
            assert await text(pg, '.exp-row .exp-cell') == '„Kein Kaffee nach 14 Uhr“ ist abgeschlossen. Ergebnis ansehen'
            await pg.click('.exp-row a[href="#/gesundheit/experimente"]'); await pg.wait_for_selector('.exp-done')
            assert [await text(pg, '.exp-done .sec-title'), await text(pg, '.exp-done .sec-head .tag')] == ['Kein Kaffee nach 14 Uhr', f'{short(t0)} bis {short(t13)}']
            body = await text(pg, '.exp-done')
            assert 'Deine Erwartung: Ich schlafe besser.' in body and 'Eingehalten an 11 von 14 Tagen, nicht eingehalten an 3.' in body, body
            assert [await text(pg, '.exp-done-body .sec-title'), await text(pg, '.exp-done-body .sec-meta')] == ['Ergebnis', 'eingehalten an 11 von 14']
            assert await text(pg, '.exp-done .exp-line') == 'Besser: Schlafqualität, Schlaf. Kein klarer Unterschied: Energie.'
            rows = await pg.evaluate("[...document.querySelectorAll('.exp-done .exp-res')].map(li => [li.querySelector('.check-name').textContent, li.querySelector('.tag').textContent, li.querySelector('.check-meta').textContent])")
            assert rows == [['Schlafqualität', 'besser', '3,9 mit Regel, 2,9 in den 14 Tagen davor, 3 an Tagen ohne Regel.'],
                            ['Schlaf', 'besser', '7,4 h mit Regel, 6,5 h in den 14 Tagen davor, 6,5 h an Tagen ohne Regel.'],
                            ['Energie am Tag danach', 'kein klarer Unterschied', '3 mit Regel, 3,1 in den 14 Tagen davor, 3 an Tagen ohne Regel.']], rows
            dots = await pg.evaluate("[...document.querySelector('.exp-done .exp-res .db').querySelectorAll('.db-dot')].map(d => [d.className, d.style.left])")
            assert dots == [['db-dot pre', '48.2%'], ['db-dot on', '72.7%']], dots
            assert 'vorher oder ohne Regel' not in await text(pg, '.exp-done .legend')
            # Tag für Tag: 28 Tage, Experiment als Fläche, Tabelle, Tooltip per Tastatur
            assert await pg.locator('.chart[data-id="exp-k1"] svg rect.st-band.exp').count() == 1
            await pg.click('.exp-done .table-view summary')
            head = await pg.evaluate("[...document.querySelectorAll('.exp-done .table-view th')].map(t => t.textContent)")
            assert head == ['Zeitraum', 'Schlafqualität', 'Schlaf', 'Energie am Tag danach'], head
            assert await pg.locator('.exp-done .table-view tbody tr').count() == 28
            await pg.focus('.chart[data-id="exp-k1"]'); await pg.wait_for_timeout(100)
            tip = await pg.inner_text('.chart[data-id="exp-k1"] .tip')
            assert tip.split('\n')[0].endswith(', Regel eingehalten') and 'Schlafqualität: 4 von 5' in tip and 'Schlaf: 8 h' in tip, tip
            for _ in range(3):
                await pg.keyboard.press('ArrowLeft'); await pg.wait_for_timeout(60)
            tip = await pg.inner_text('.chart[data-id="exp-k1"] .tip')
            assert tip.split('\n')[0].endswith(', Regel nicht eingehalten') and 'Schlafqualität: 3 von 5' in tip and 'Schlaf: 6,5 h' in tip, tip
            if mobile:
                assert await overflow(pg, 390), 'Ergebnis ragt nicht heraus'
                await pg.screenshot(path=str(SHOT / 'x_ergebnis_handy.png'), full_page=True)
            else:
                await pg.locator('.exp-done').screenshot(path=str(SHOT / f'x_ergebnis_pc{"_dunkel" if dark else ""}.png'))
            if mobile:
                # Fazit, dann verschwindet der Hinweis auf Heute
                await pg.click('.exp-done button[data-a="exp.verdict"][data-v="besser"]'); await pg.wait_for_timeout(150)
                assert (await pg.evaluate(f"{ST}.health.exps[0].verdict")) == 'besser'
                assert await pg.get_attribute('.exp-done button[data-a="exp.verdict"][data-v="besser"]', 'aria-pressed') == 'true'
                # Noch einmal: Dialog mit denselben Einstellungen
                await pg.click('.exp-done button[data-a="exp.again"]'); await pg.wait_for_timeout(150)
                assert await pg.input_value('#dlg input[name="rule"]') == 'Kein Kaffee nach 14 Uhr' and await pressed('exp.m') == ['Schlaf', 'Schlafqualität', 'Energie'] and await pressed('exp.start') == ['Heute']
                await pg.click('#dlg button[data-a="dlg.close"]'); await pg.wait_for_timeout(100)
                await go(pg, '#/heute')
                assert await pg.locator('.exp-row').count() == 0
                # Bericht für den Arzt
                await go(pg, '#/gesundheit/bericht', 500)
                async with ctx.expect_page() as pp:
                    await pg.click('button[data-a="rep.open"]')
                rp = await pp.value; await rp.wait_for_load_state(); await rp.wait_for_timeout(200)
                rep = await rp.inner_text('body')
                assert 'Selbstexperimente' in rep and f'Kein Kaffee nach 14 Uhr, {short(t0)}{t0[:4]} bis {short(t13)}{t13[:4]}: eingehalten an 11 von 14 Tagen. Schlafqualität 3,9 mit Regel, 2,9 davor; Schlaf 7,4 h mit Regel, 6,5 h davor; Energie 3 mit Regel, 3,1 davor.' in rep, rep
                await rp.close()
            await b.close()
            assert not errs, errs
        print('Ergebnis, Diagramm, Fazit und Bericht ok (Handy, PC hell und dunkel)')

        # 3. Pollen auf die eigenen Arten beschränkt (K48)
        b, ctx, pg, errs = await setup(p, 390, 844, mobile=True, unfold=False)
        await env_routes(ctx, today=THU, aq=aq3)
        await pg.clock.set_fixed_time(at(0))
        await pg.goto(URL); await pg.wait_for_selector('.fold-head')
        await pg.evaluate(SYN3 + "('Gräserpollen (leicht)')")
        await pg.reload(); await pg.wait_for_selector('.fold-head')
        await until(pg, f"Object.keys({ST}.env.days).length >= 60")
        await pg.reload(); await pg.wait_for_selector('.fold-head')
        assert await pg.inner_text('.page-sub .env-line') == 'Pollen: Gräser mäßig', 'nur Gräser aus den Angaben zu Allergien'
        await go(pg, '#/gesundheit/verlauf', 500); await pg.wait_for_selector('.tr-env .chart svg')
        chips = lambda: pg.evaluate("[...document.querySelectorAll('.tr-env .pol-sel .chip')].map(c => [c.textContent, c.getAttribute('aria-pressed')])")
        assert await chips() == [['Erle', 'false'], ['Birke', 'false'], ['Gräser', 'true'], ['Beifuß', 'false'], ['Ambrosia', 'false']]
        assert await text(pg, '.tr-env .pol-hint') == 'Aus deinen Angaben zu Allergien übernommen. Tippe an, um es zu ändern.'
        lines = await pg.evaluate("[...document.querySelectorAll('.tr-env-sum li')].map(li => li.textContent)")
        assert lines[1] == 'Gräserpollen mäßig oder stärker an 11 Tagen. Andere Arten: Birke an 9 Tagen.', lines
        links = await pg.evaluate("[...document.querySelectorAll('.tr-env .checklist li')].map(li => [li.querySelector('.check-name').textContent, li.querySelector('.check-meta').textContent])")
        assert links == [['Gereizte Augen: Gräserpollen mäßig oder stärker', 'an 10 von 10 Tagen mit Gereizte Augen, sonst an 0 % der Tage']], links
        await pg.focus('.chart[data-id="trenv"]'); await pg.wait_for_timeout(100)
        tip = await pg.inner_text('.chart[data-id="trenv"] .tip')
        assert 'Gräserpollen: Gräser mäßig; andere: Birke stark' in tip, tip
        await pg.click('.tr-env .table-view summary')
        head = await pg.evaluate("[...document.querySelectorAll('.tr-env .table-view th')].map(t => t.textContent)")
        assert head == ['Zeitraum', 'Beschwerden', 'Temperatur', 'Luftdruck', 'Gräserpollen', 'Luftqualität'], head
        assert await overflow(pg, 390)
        await pg.locator('.tr-env').screenshot(path=str(SHOT / 'x_pollen_handy.png'))
        # Birke dazu: beide Arten, auch auf Heute
        await pg.click('.tr-env .pol-sel .chip[data-k="bi"]'); await pg.wait_for_timeout(200)
        assert await pg.evaluate(f"{ST}.health.profile.pollen") == ['bi', 'gr']
        assert await text(pg, '.tr-env .pol-hint') == 'Oben auf Heute stehen nur diese Arten, in den Verläufen stehen sie vorn.'
        lines = await pg.evaluate("[...document.querySelectorAll('.tr-env-sum li')].map(li => li.textContent)")
        assert lines[1] == 'Deine Pollen mäßig oder stärker: Gräser an 11 Tagen, Birke an 9 Tagen.', lines
        await pg.click('.tr-env .table-view summary')
        assert (await pg.evaluate("[...document.querySelectorAll('.tr-env .table-view th')].map(t => t.textContent)"))[4] == 'Deine Pollen'
        await go(pg, '#/heute')
        assert await pg.inner_text('.page-sub .env-line') == 'Pollen: Birke stark, Gräser mäßig'
        # Alle ab: wieder alle Arten, die Angaben zu Allergien zählen nicht mehr
        await go(pg, '#/einstellungen')
        set_chips = lambda: pg.evaluate("[...document.querySelectorAll('.pol-sel.in-settings .chip')].map(c => c.getAttribute('aria-pressed'))")
        assert await set_chips() == ['false', 'true', 'true', 'false', 'false']
        await pg.click('.pol-sel.in-settings .chip[data-k="bi"]'); await pg.wait_for_timeout(150)
        await pg.click('.pol-sel.in-settings .chip[data-k="gr"]'); await pg.wait_for_timeout(150)
        assert await pg.evaluate(f"{ST}.health.profile.pollen") == [] and await set_chips() == ['false'] * 5
        assert await text(pg, '.pol-sel.in-settings .pol-hint') == 'Ohne Auswahl zählen alle Arten.'
        assert await overflow(pg, 390), 'Einstellungen ragen nicht heraus'
        await go(pg, '#/gesundheit/verlauf', 500)
        lines = await pg.evaluate("[...document.querySelectorAll('.tr-env-sum li')].map(li => li.textContent)")
        assert lines[1] == 'Pollen mäßig oder stärker: Gräser an 11 Tagen, Birke an 9 Tagen.', lines
        await b.close()
        assert not errs, errs
        print('Pollen auf eigene Arten beschränkt ok')

        # 4. Web-Build unter der CSP: Backup einspielen, Experiment starten, abhaken
        backup = ROOT / 'tests' / 'backup-web.json'
        if backup.exists():
            tmp = pathlib.Path(tempfile.mkdtemp(prefix='chrisos-v29-'))
            site = tmp / 'web'
            shutil.copytree(ROOT / 'dist' / 'web', site)
            srv = serve(site, 8769)
            try:
                br = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
                ctx = await br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, accept_downloads=True)
                await ctx.add_init_script("window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));")
                async def wxr(route):
                    await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(fixture(7.5, 60)))
                await ctx.route('https://api.open-meteo.com/**', wxr)
                await env_routes(ctx)
                pg = await ctx.new_page()
                werrs = []
                pg.on('console', lambda m: werrs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
                pg.on('pageerror', lambda e: werrs.append(f'PAGEERROR: {e}'))
                await pg.clock.set_fixed_time(at(0, 21, 0))
                await pg.goto('http://localhost:8769/'); await pg.wait_for_selector('#welcome-file', state='attached')
                await pg.set_input_files('#welcome-file', str(backup))
                await until(pg, "!!document.querySelector('.fold-head')")
                await pg.evaluate("location.hash = '#/gesundheit/experimente'"); await until(pg, "!!document.querySelector('.exp-start')")
                await pg.click('.exp-tpl button[data-k="bett"]'); await until(pg, "!!document.querySelector('#exp-form')")
                await pg.click('#dlg button[data-a="exp.save"]'); await until(pg, "!!document.querySelector('.exp-card')")
                async with pg.expect_download() as dl:
                    await pg.click('button[data-a="exp.ics"]')
                ics = open(await (await dl.value).path(), encoding='utf-8').read()
                assert 'T221500' in ics and 'COUNT=14' in ics, ics
                await pg.clock.set_fixed_time(at(1))
                await pg.evaluate("location.hash = '#/heute'"); await pg.reload()
                await until(pg, "!!document.querySelector('.fold-head')")
                await pg.click('button.fold-head[data-k="checkin"]'); await until(pg, "!!document.querySelector('.exp-row')")
                assert await text(pg, '.exp-row .exp-q') == 'Gestern bis 22:30 Uhr im Bett?'
                await pg.click('.exp-row button[data-v="1"]'); await pg.wait_for_timeout(200)
                assert (await pg.evaluate(f"{ST}.health.exps[0].log")) == {D(0): True}
                assert await pg.evaluate('window.__csp') == [], await pg.evaluate('window.__csp')
                assert not werrs, werrs
                await br.close()
            finally:
                srv.shutdown()
            print('Web-Build unter der CSP ok')
        else:
            print('Web-Build übersprungen: erst tests/test_pwa.py ausführen (legt das Backup an)')
        print('Version 2.9: alle Tests bestanden, keine Konsolenfehler')


asyncio.run(main())
