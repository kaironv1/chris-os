"""Version 2.7. Eiweiß sitzt in der Training-Kachel auf Heute (mit Eingabefeld), dazu das Ernährungsprotokoll unter
Training, Ernährung: Text eintippen, die App erkennt Lebensmittel, Mengen und Nährwerte; eigene Lebensmittel, gemerkte
Portionen und Mahlzeiten, Schnellwahl aus eigenen Worten, CSV. Unter Gesundheit, Verläufe: Kennzahlen, Beschwerden je Tag
oder Woche, Schlaf und Infekt-Anzeichen, häufigste Beschwerden, Körperkarte, Wochentage, Befinden und eine Beschwerde im
Detail. Handy und PC, hell und dunkel, ohne Konsolenfehler und ohne seitliches Herausragen am Handy."""
import asyncio, datetime, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import setup, URL

SHOT = pathlib.Path(__file__).resolve().parent
NOON = datetime.datetime.now().replace(hour=12, minute=40, second=0, microsecond=0)
LOG = "JSON.parse(localStorage.getItem('haltung.v1')).nutrition"
TODAY = "window.HaltungDebug.E.today()"

# 75 days of check-ins: headache after short nights, neck pain on office days, three colds, mood and stress
SYNTH = """(() => {
  const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today(), D = S.health.days = {};
  for (let k = 74; k >= 0; k--) {
    const d = E.addDays(t, -k), wd = E.weekday(d);
    if (k % 11 === 5) continue;
    const short = k % 4 === 0;
    const x = { sym: {}, meas: [], f: {}, t: Date.now(), sleepH: short ? 5.5 : 7 + (k % 3) * 0.5, mood: short ? 2 : 3 + (k % 2), energy: 2 + (k % 4), stress: [2, 3, 4].includes(wd) ? 4 : 2 };
    if (short) x.sym.kopf = 2;
    if ([2, 3, 4].includes(wd) && k % 2) x.sym['bm:nacken'] = k % 3 ? 1 : 2;
    if (k % 9 === 0) x.sym['bm:unterer_ruecken'] = 1;
    [[60, 4], [33, 5], [9, 3]].forEach(([s0, len]) => { if (k <= s0 && k > s0 - len) { x.sym.hals_kratzen = 1 + (s0 - k > 1 ? 1 : 0); if (s0 - k >= 1) x.sym.nase_lauf = 2; if (s0 - k === 2) x.sym.glieder = 2; } if (k > s0 && k <= s0 + 2) x.sleepH = 5.5; });
    if (k % 13 === 0) x.sym.beine_unruhig = 1;
    if (!Object.keys(x.sym).length) x.none = true;
    D[d] = x;
  }
  window.HaltungDebug.render();
  return Object.keys(D).length;
})()"""


async def overflow(pg, w):
    return await pg.evaluate(f'document.documentElement.scrollWidth') <= w


async def type_food(pg, text, scope='#view'):
    inp = pg.locator(f'{scope} .nf-in').first
    await inp.fill('')
    await inp.type(text, delay=5)
    await pg.wait_for_timeout(120)


async def main():
    async with async_playwright() as p:
        # 1. Heute am Handy: Eiweiß steckt in der Training-Kachel
        b, ctx, pg, errs = await setup(p, 390, 844, mobile=True, unfold=False)
        await pg.clock.set_fixed_time(NOON)
        await pg.goto(URL); await pg.wait_for_selector('.fold-head')
        assert await pg.locator('#view .ledger > section').count() == 3, 'keine eigene Eiweiß-Kachel mehr'
        sm = await pg.inner_text('[data-fold="training"] .fold-sum')
        assert 'Als Nächstes' in sm or 'kein Krafttraining' in sm or 'locker' in sm, sm
        assert re.search(r'Eiweiß 0 von \d+ g', sm), sm
        await pg.click('button.fold-head[data-k="training"]'); await pg.wait_for_timeout(150)
        assert await pg.locator('[data-fold="training"] .pblock .nf-in').count() == 1
        await type_food(pg, '2 Eier, Skyr mit Beeren', '[data-fold="training"]')
        prev = await pg.inner_text('[data-fold="training"] .nf-prev')
        assert 'Eier' in prev and 'Skyr' in prev and 'Beeren' in prev and 'Zusammen' in prev, prev
        await pg.press('[data-fold="training"] .nf-in', 'Enter'); await pg.wait_for_timeout(200)
        log = await pg.evaluate(f"{LOG}.log[{TODAY}]")
        assert [e['name'] for e in log] == ['Eier', 'Skyr', 'Beeren'] and all(e['slot'] == 'mittag' and e['time'] == '12:40' for e in log), log
        assert 'Eingetragen: 31 g Eiweiß' in await pg.inner_text('#toast'), await pg.inner_text('#toast')
        assert await pg.input_value('[data-fold="training"] .nf-in') == '', 'Feld wieder leer'
        assert await pg.inner_text('[data-fold="training"] .prot-val') == '31 g'
        await pg.click('#toast [data-a="toast.undo"]'); await pg.wait_for_timeout(150)
        assert await pg.evaluate(f"({LOG}.log[{TODAY}] || []).length") == 0, 'Rückgängig'
        await type_food(pg, '2 Eier, Skyr mit Beeren, Zaubertrank', '[data-fold="training"]')
        assert '„zaubertrank“ nicht erkannt' in await pg.inner_text('[data-fold="training"] .nf-prev')
        await pg.click('[data-fold="training"] button[data-a="nf.add"]'); await pg.wait_for_timeout(200)
        assert await pg.evaluate(f"{LOG}.log[{TODAY}].length") == 3
        assert await pg.input_value('[data-fold="training"] .nf-in') == 'zaubertrank', 'Nicht Erkanntes bleibt stehen'
        await pg.click('[data-fold="training"] button[data-a="nf.newFood"]'); await pg.wait_for_selector('#dlg[open] #fd-form')
        assert await pg.input_value('#fd-form input[name="name"]') == 'Zaubertrank'
        for k, v in (('dp', '250'), ('kcal', '120'), ('p', '20'), ('c', '8'), ('f', '1')):
            await pg.fill(f'#fd-form input[name="{k}"]', v)
        await pg.click('#dlg [data-a="nf.saveFood"]'); await pg.wait_for_timeout(200)
        foods = await pg.evaluate(f"{LOG}.foods")
        assert foods[0]['name'] == 'Zaubertrank' and foods[0]['p'] == 8 and foods[0]['kcal'] == 48, foods
        assert 'Zaubertrank' in await pg.inner_text('[data-fold="training"] .nf-prev'), 'jetzt erkannt'
        await pg.click('[data-fold="training"] button[data-a="nf.add"]'); await pg.wait_for_timeout(200)
        assert await pg.inner_text('[data-fold="training"] .prot-val') == '51 g'
        assert await overflow(pg, 390), 'Heute ragt nicht heraus'
        await pg.screenshot(path=str(SHOT / 'n_heute_handy.png'), full_page=True)
        await pg.click('button.fold-head[data-k="training"]'); await pg.wait_for_timeout(150)
        assert re.search(r'Eiweiß 51 von \d+ g', await pg.inner_text('[data-fold="training"] .fold-sum'))

        # 2. Ernährung: Tagesbilanz, Eintrag ändern (Portion merken), Mahlzeit merken, Schnellwahl, CSV
        await pg.evaluate("location.hash = '#/training/ernaehrung'"); await pg.wait_for_selector('.bal')
        assert await pg.locator('.tabs a[aria-current="page"]').inner_text() == 'Ernährung'
        bal = await pg.inner_text('.bal')
        assert '51 g' in bal and 'kcal' in bal, bal
        rows = pg.locator('.meal .nf-entry')
        assert await rows.count() == 4
        await rows.filter(has_text='Skyr').first.click(); await pg.wait_for_selector('#dlg[open] #nf-form')
        assert 'deine Portion' in await pg.inner_text('#dlg'), 'Hinweis auf gemerkte Portion'
        await pg.fill('#nf-form input[name="g"]', '250')
        await pg.click('#dlg [data-a="nf.save"]'); await pg.wait_for_timeout(200)
        assert 'Gemerkt: Skyr künftig 250 g' in await pg.inner_text('#toast')
        st = await pg.evaluate(LOG)
        assert st['portions']['f:skyr'] == 250 and any(e['name'] == 'Skyr' and e['g'] == 250 and e['p'] == 27.5 for e in st['log'][await pg.evaluate(TODAY)]), st
        await type_food(pg, 'Skyr')
        assert 'deine Portion (250 g)' in await pg.inner_text('#view .nf-prev')
        await pg.click('button[data-a="nf.slot"][data-v="abend"]'); await pg.wait_for_timeout(100)
        await pg.click('#view button[data-a="nf.add"]'); await pg.wait_for_timeout(200)
        assert (await pg.evaluate(f"{LOG}.log[{TODAY}].slice(-1)[0].slot")) == 'abend', 'Mahlzeit gewählt'
        await pg.click('.meal:has(h3:text("Mittag")) button[data-a="nf.mealSave"]'); await pg.wait_for_selector('#meal-in')
        await pg.fill('#meal-in', 'Mein Mittag')
        await pg.click('#dlg [data-a="nf.mealOk"]'); await pg.wait_for_timeout(200)
        meals = await pg.evaluate(f"{LOG}.meals")
        assert meals[0]['name'] == 'Mein Mittag' and len(meals[0]['items']) == 4, meals
        chip = pg.locator('.nf-quick button', has_text='Mein Mittag')
        assert await chip.count() == 1
        n0 = await pg.evaluate(f"{LOG}.log[{TODAY}].length")
        await chip.click(); await pg.wait_for_timeout(200)
        assert await pg.evaluate(f"{LOG}.log[{TODAY}].length") == n0 + 4
        await type_food(pg, 'Mein Mittag')
        assert 'Zaubertrank' in await pg.inner_text('#view .nf-prev'), 'Mahlzeit per Name'
        # Schnellwahl aus eigenen Worten: dreimal getippt, einmal je Tag gezählt
        await pg.evaluate("""(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E, F = window.Food;
          [1, 2, 3].forEach(k => { const d = E.addDays(E.today(), -k); S.nutrition.log[d] = F.parse('Haferflocken mit Milch, Kaffee', {}).items.map((x, i) => Object.assign(x, { id: 'h' + k + i, t: Date.now() - k * 864e5, slot: 'frueh', time: '07:30' })); });
          window.HaltungDebug.render(); })()""")
        labels = await pg.locator('.nf-quick button').all_inner_texts()
        assert any('Haferflocken mit Milch' in x for x in labels) and any(x.strip().endswith('Kaffee') for x in labels), labels
        async with pg.expect_download() as dl:
            await pg.click('button[data-a="nf.csv"]')
        csv = pathlib.Path(await (await dl.value).path()).read_text(encoding='utf-8-sig')
        assert csv.startswith('"Datum";"Uhrzeit";"Mahlzeit";"Lebensmittel"') and 'Zaubertrank' in csv and 'Haferflocken' in csv, csv[:300]
        # Kalorien-Ziel aus den Einstellungen erscheint in der Bilanz
        await pg.evaluate("window.HaltungDebug.state.settings.kcalGoal = 2600; window.HaltungDebug.render()")
        assert re.search(r'noch [\d.]+ kcal bis 2\.600', await pg.inner_text('.bal')), await pg.inner_text('.bal')
        assert await pg.locator('.chart[data-id="nprot"] svg').count() == 1 and await pg.locator('.legend', has_text='Frühstück').count() >= 1
        # Löschen mit Rückgängig, nur Eiweiß schätzen
        n1 = await pg.evaluate(f"{LOG}.log[{TODAY}].length")
        await pg.locator('.meal .nf-entry').first.click(); await pg.wait_for_selector('#dlg[open] #nf-form')
        await pg.click('#dlg [data-a="nf.del"]'); await pg.wait_for_timeout(150)
        assert await pg.evaluate(f"{LOG}.log[{TODAY}].length") == n1 - 1
        await pg.click('#toast [data-a="toast.undo"]'); await pg.wait_for_timeout(150)
        assert await pg.evaluate(f"{LOG}.log[{TODAY}].length") == n1
        before = await pg.evaluate(f"window.HaltungDebug.state.training.protein[{TODAY}] || 0")
        await pg.click('#view details.how summary'); await pg.click('button[data-a="protein.add"][data-v="20"]'); await pg.wait_for_timeout(150)
        assert await pg.evaluate(f"window.HaltungDebug.state.training.protein[{TODAY}]") == before + 20
        assert await overflow(pg, 390), 'Ernährung ragt nicht heraus'
        await pg.screenshot(path=str(SHOT / 'n_ernaehrung_handy.png'), full_page=True)
        # Fortschritt zählt Protokoll und Schnelleinträge zusammen
        await pg.evaluate("location.hash = '#/training/fortschritt'"); await pg.wait_for_timeout(300)
        total = await pg.evaluate("(() => { const S = window.HaltungDebug.state, d = window.HaltungDebug.E.today(); return Math.round((S.training.protein[d] || 0) + S.nutrition.log[d].reduce((s, e) => s + (e.p || 0), 0)); })()")
        tbl = await pg.evaluate("document.querySelector('.panel:has(.chart[data-id=\"prot\"]) details.table-view').textContent")
        assert f'{total} g' in tbl, (total, tbl[-200:])
        # Check-in: Einflüsse aus dem Protokoll
        await pg.evaluate("""(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E, F = window.Food, d = E.today();
          S.nutrition.log[d].push(...F.parse('3 Espresso, Brot mit Hummus', {}).items.map((x, i) => Object.assign(x, { id: 'k' + i, t: Date.now(), slot: 'mittag', time: '12:00' }))); window.HaltungDebug.render(); })()""")
        await pg.evaluate("location.hash = '#/gesundheit'"); await pg.wait_for_timeout(300)
        hint = await pg.inner_text('.nutri-hint')
        assert '3 Kaffee' in hint and 'Knoblauch oder Zwiebeln' in hint, hint
        await b.close()
        assert not errs, errs
        print('Ernährung am Handy ok')

        # 3. Verläufe am Handy: alle Teile, Zeiträume, Detail, Tooltip
        b, ctx, pg, errs = await setup(p, 390, 844, mobile=True, unfold=False)
        await pg.goto(URL + '#/gesundheit/verlauf'); await pg.wait_for_selector('.tabs')
        assert 'braucht es ein paar Check-ins' in await pg.inner_text('#view .empty'), 'leer: Hinweis'
        n = await pg.evaluate(SYNTH); await pg.wait_for_timeout(300)
        assert n > 60
        tiles = await pg.locator('.tr-stats').first.inner_text()
        assert 'Tage mit Beschwerden' in tiles and 'Schlaf im Schnitt' in tiles, tiles
        assert await pg.locator('.chart[data-id="trmx"] svg rect.mx-c').count() > 30
        assert await pg.locator('.chart[data-id="trst"] svg path').count() > 10
        assert await pg.locator('.rank li').count() >= 4
        assert await pg.locator('.chart[data-id="trbody"] .bh.b3').count() >= 1, 'Nacken am häufigsten'
        assert await pg.locator('.wdg .wdc').count() == 7
        assert await pg.locator('.chart[data-id="trmood"]').count() == 1
        det = await pg.inner_text('#view .panel:has(.tr-det)')
        assert 'Wenig Schlaf (unter 6,5 h)' in det, det
        assert await overflow(pg, 390), 'Verläufe ragt nicht heraus'
        box = await pg.locator('.chart[data-id="trmx"]').bounding_box()
        await pg.mouse.move(box['x'] + box['width'] - 4, box['y'] + 10); await pg.wait_for_timeout(100)
        tip = await pg.inner_text('.chart[data-id="trmx"] .tip')
        assert re.search(r'\d+\.\d+\.', tip), tip
        await pg.screenshot(path=str(SHOT / 'n_verlauf_handy.png'), full_page=True)
        await pg.click('.chip[data-a="tr.sym"]:has-text("Schmerz Nacken")'); await pg.wait_for_timeout(200)
        assert 'Bürotag' in await pg.inner_text('#view .panel:has(.tr-det)'), 'Nacken an Bürotagen'
        for rng, cols in (('90', 90), ('365', None)):
            await pg.click(f'button[data-a="tr.range"][data-v="{rng}"]'); await pg.wait_for_timeout(250)
            assert await overflow(pg, 390), rng
            c = await pg.evaluate("window.HaltungDebug && document.querySelectorAll('.chart[data-id=\"trdet\"] svg rect.mx-c').length")
            assert c > 0, rng
        await pg.screenshot(path=str(SHOT / 'n_verlauf_jahr_handy.png'), full_page=True)
        await b.close()
        assert not errs, errs
        print('Verläufe am Handy ok')

        # 4. PC hell und dunkel
        for dark in (False, True):
            b, ctx, pg, errs = await setup(p, 1440, 900, dark=dark, unfold=False)
            await pg.clock.set_fixed_time(NOON)
            await pg.goto(URL + '#/gesundheit/verlauf'); await pg.wait_for_selector('.tabs')
            await pg.evaluate(SYNTH); await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(SHOT / f'n_verlauf_pc{"_dunkel" if dark else ""}.png'), full_page=True)
            st = pg.locator('.chart[data-id="trst"]')
            bb = await st.bounding_box()
            await pg.mouse.move(bb['x'] + bb['width'] * 0.8, bb['y'] + 40); await pg.wait_for_timeout(100)
            t2 = await pg.inner_text('.chart[data-id="trst"] .tip')
            assert 'Schlaf' in t2 and 'Infekt-Anzeichen' in t2, t2
            await pg.evaluate("location.hash = '#/training/ernaehrung'"); await pg.wait_for_selector('.bal')
            await type_food(pg, 'Spaghetti Bolognese, großer Salat mit Hähnchen')
            await pg.click('#view button[data-a="nf.add"]'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=str(SHOT / f'n_ernaehrung_pc{"_dunkel" if dark else ""}.png'), full_page=True)
            await b.close()
            assert not errs, errs
        print('PC hell und dunkel ok')
        print('Version 2.7: alle Tests bestanden, keine Konsolenfehler')

asyncio.run(main())
