"""Version 2.6. Heute mit einklappbaren Kacheln: Outfit, Wie geht's dir, Erinnerungen und Training starten zu und zeigen
eine Zeile Zusammenfassung; ein Tipp klappt auf und wieder zu, die Wahl gilt für die Sitzung. Seit 2.7 steckt Eiweiß in der Training-Kachel.
Check-in: jede Angabe speichert sofort, sichtbar als „Gespeichert …“ mit kurzem Aufleuchten, auch nach dem Neuladen;
morgens zählt auch „Gestern insgesamt“. Dazu Gerät und Startgewicht je Übung im Gym-Plan (K8) und ähnliche Marken angleichen (K5).
Handy und PC, hell und dunkel, ohne Konsolenfehler."""
import asyncio, datetime, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import setup, URL

SHOT = pathlib.Path(__file__).resolve().parent
KEYS = ['outfit', 'checkin', 'reminders', 'training']


async def state(pg):
    return await pg.evaluate("[...document.querySelectorAll('[data-fold]')].map(f => [f.dataset.fold, f.querySelector('.fold-head').getAttribute('aria-expanded'), !f.querySelector('.fold-body').hidden, f.querySelector('.fold-sum').textContent])")


async def toggle(pg, k):
    await pg.click(f'button.fold-head[data-k="{k}"]')
    await pg.wait_for_timeout(150)


async def main():
    async with async_playwright() as p:
        # 1. Handy: alles zu, Zusammenfassungen sichtbar, Eiweiß in der Training-Kachel (2.7)
        b, ctx, pg, errs = await setup(p, 390, 844, mobile=True, unfold=False)
        await pg.goto(URL); await pg.wait_for_selector('.fold-head')
        st = await state(pg)
        assert [s[0] for s in st] == KEYS, st
        assert all(s[1] == 'false' and not s[2] for s in st), st
        assert all(s[3].strip() for s in st), 'jede Kachel hat eine Zusammenfassung'
        assert re.search(r'^(Smart Casual|Termin|Freizeit|Abend|Getragen): ', st[0][3]), st[0][3]
        assert await pg.locator('[data-fold="outfit"] .fold-sw i').count() >= 3, 'Farbpunkte der Teile'
        assert await pg.locator('.fig-stage').count() == 0, 'Figur wird erst beim Aufklappen gebaut'
        assert await pg.locator('[data-fold="training"] .fold-sum .fs-line').count() == 2, 'zweite Zeile: Eiweiß'
        assert 'Eiweiß' in await pg.inner_text('[data-fold="training"] .fold-sum')
        assert await pg.evaluate('document.documentElement.scrollWidth') <= 390, 'nichts ragt seitlich heraus'
        await pg.screenshot(path=str(SHOT / 'k_handy_zu.png'), full_page=True)
        print('zu:', [(s[0], s[3]) for s in st])

        # 2. Check-in aufklappen, Schlaf antippen: sofort gespeichert und sichtbar
        await toggle(pg, 'checkin')
        assert (await state(pg))[1][1] == 'true'
        assert await pg.evaluate("document.activeElement.dataset.k") == 'checkin', 'Fokus bleibt auf dem Kopf'
        assert 'speichert sich sofort' in await pg.inner_text('[data-fold="checkin"] .autosave')
        await pg.click('[data-fold="checkin"] button[data-a="hc.set"][data-k="sleepH"][data-v="7"]')
        await pg.wait_for_timeout(150)
        badge = pg.locator('[data-fold="checkin"] .fold-head .saved')
        assert re.match(r'Gespeichert \d\d:\d\d$', (await badge.inner_text()).strip()), await badge.inner_text()
        assert 'just' in (await badge.get_attribute('class')), 'leuchtet nach der Änderung kurz auf'
        stored = await pg.evaluate("JSON.parse(localStorage.getItem('haltung.v1')).health.days[window.HaltungDebug.E.today()].sleepH")
        assert stored == 7, stored
        await pg.click('[data-fold="checkin"] button[data-a="hc.sym"] >> nth=1'); await pg.wait_for_timeout(150)
        await pg.screenshot(path=str(SHOT / 'k_handy_checkin.png'), full_page=True)

        # 3. Neu laden: Daten und offene Kachel bleiben (Sitzung), Aufleuchten nicht
        await pg.reload(); await pg.wait_for_selector('.fold-head')
        assert (await state(pg))[1][1] == 'true', 'aufgeklappt bleibt in der Sitzung'
        assert await pg.get_attribute('[data-fold="checkin"] button[data-k="sleepH"][data-v="7"]', 'aria-pressed') == 'true'
        assert 'just' not in (await pg.get_attribute('[data-fold="checkin"] .saved', 'class'))
        await toggle(pg, 'checkin')
        st = await state(pg)
        assert st[1][1] == 'false' and st[1][3].startswith('Schlaf 7 h, '), st[1]
        assert await pg.locator('[data-fold="checkin"] .saved').count() == 1, 'Gespeichert auch zugeklappt'
        print('Check-in zu:', st[1][3])

        # 4. Die anderen Kacheln auf und zu
        for k, sel in (('outfit', '[data-fold="outfit"] .board-occ'), ('reminders', '#fold-reminders'), ('training', '[data-fold="training"] .goal-row')):
            await toggle(pg, k)
            assert await pg.locator(sel).first.is_visible(), k
        assert await pg.locator('.fig-stage, .lay-split').count() >= 1, 'Outfit offen mit Figur oder Teilen'
        assert await pg.evaluate('document.documentElement.scrollWidth') <= 390, 'auch offen nichts seitlich heraus'
        await pg.screenshot(path=str(SHOT / 'k_handy_offen.png'), full_page=True)
        for k in ('outfit', 'reminders', 'training'):
            await toggle(pg, k)
        assert all(s[1] == 'false' for s in await state(pg))
        await b.close()
        assert not errs, errs

        # 5. Neue Sitzung: wieder alles zu; PC hell und dunkel
        for dark in (False, True):
            b, ctx, pg, errs = await setup(p, 1440, 900, dark=dark, unfold=False)
            await pg.goto(URL); await pg.wait_for_selector('.fold-head')
            assert all(s[1] == 'false' for s in await state(pg)), 'neue Sitzung startet zu'
            await pg.screenshot(path=str(SHOT / f'k_pc_zu{"_dunkel" if dark else ""}.png'))
            await toggle(pg, 'outfit'); await toggle(pg, 'checkin')
            await pg.screenshot(path=str(SHOT / f'k_pc_offen{"_dunkel" if dark else ""}.png'))
            await b.close()
            assert not errs, errs
        print('PC hell und dunkel ok')

        # 6. Morgens: „Gestern insgesamt“ zählt als gespeichert und bleibt mit Wert sichtbar
        b, ctx, pg, errs = await setup(p, 390, 844, mobile=True, unfold=False)
        now = datetime.datetime.now()
        await pg.clock.set_fixed_time(now.replace(hour=8, minute=30, second=0, microsecond=0))
        await pg.goto(URL); await pg.wait_for_selector('.fold-head')
        await pg.evaluate("(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E; delete S.health.days[E.today()]; const y = S.health.days[E.addDays(E.today(), -1)]; if (y) { y.mood = null; y.t = 0; } window.HaltungDebug.render(); })()")
        await toggle(pg, 'checkin')
        row = pg.locator('[data-fold="checkin"] .hrow', has_text='Gestern insgesamt')
        assert await row.count() == 1
        await row.locator('button[data-v="4"]').click(); await pg.wait_for_timeout(150)
        assert await row.locator('button[data-v="4"]').get_attribute('aria-pressed') == 'true', 'Wert bleibt sichtbar'
        assert await pg.locator('[data-fold="checkin"] .fold-head .saved').count() == 1
        await toggle(pg, 'checkin')
        assert (await state(pg))[1][3] == 'Gestern eingetragen, heute noch offen', await state(pg)
        await b.close()
        assert not errs, errs

        # 7. Gym-Plan: Gerät und Startgewicht selbst eintragen (K8)
        b, ctx, pg, errs = await setup(p, 390, 844, mobile=True, unfold=False)
        await pg.goto(URL + '#/training'); await pg.wait_for_selector('.plan-card')
        est = await pg.evaluate("Object.values(window.HaltungDebug.state.training.exercises).filter(e => e.estimate && e.type !== 'time').map(e => e.id)")
        ids = await pg.evaluate("[...document.querySelectorAll('.plan-card [data-a=\"ex.edit\"]')].map(b => b.dataset.id)")
        exid = next(i for i in ids if i in est)
        li = pg.locator(f'.plan-card li:has([data-a="ex.edit"][data-id="{exid}"])').first
        assert await li.locator('.ex-next.guess').count() == 1
        await li.locator('[data-a="ex.edit"]').click()
        await pg.wait_for_selector('#dlg[open] #ex-form')
        assert 'Noch geschätzt' in await pg.inner_text('#dlg')
        await pg.fill('#ex-form input[name="where"]', '711 #23')
        await pg.fill('#ex-form input[name="start"]', '42.5')
        await pg.screenshot(path=str(SHOT / 'k_uebung.png'))
        await pg.click('#dlg [data-a="ex.save"]'); await pg.wait_for_timeout(200)
        ex = await pg.evaluate(f"JSON.parse(localStorage.getItem('haltung.v1')).training.exercises['{exid}']")
        assert ex['where'] == '711 #23' and ex['start'] == 42.5 and not ex['estimate'], ex
        li = pg.locator(f'.plan-card li:has([data-a="ex.edit"][data-id="{exid}"])').first
        assert '711 #23' in await li.inner_text() and await li.locator('.ex-next.guess').count() == 0
        assert await pg.evaluate('document.documentElement.scrollWidth') <= 390
        await b.close()
        assert not errs, errs
        print('Übung angepasst:', ex['name'], ex['where'], ex['start'])

        # 8. Kleiderschrank: ähnliche Marken angleichen oder als verschieden markieren (K5)
        b, ctx, pg, errs = await setup(p, 390, 844, mobile=True, unfold=False)
        await pg.goto(URL + '#/outfit/schrank'); await pg.wait_for_selector('.wgrid')
        assert await pg.locator('.brand-note').count() == 0, 'ohne Varianten kein Hinweis'
        await pg.evaluate("""(() => { const W = window.HaltungDebug.state.wardrobe.items.filter(i => i.brand);
          W[0].brand = 'Nordwerk'; W[1].brand = 'Nordwerk'; W[2].brand = 'nordwerks'; W[3].brand = 'Ost Wind'; W[4].brand = 'Ostwind';
          window.HaltungDebug.render(); })()""")
        rows = pg.locator('.brand-note .brand-row')
        assert await rows.count() == 2, await pg.inner_text('.brand-note')
        t = await rows.nth(0).inner_text()
        assert re.search(r'„Nordwerk“ \(\d+ Teile\) und „nordwerks“ \(1 Teil\)', t), t
        await pg.screenshot(path=str(SHOT / 'k_marken.png'))
        await rows.nth(0).locator('button', has_text='Alle als „Nordwerk“').click(); await pg.wait_for_timeout(200)
        n = await pg.evaluate("JSON.parse(localStorage.getItem('haltung.v1')).wardrobe.items.filter(i => i.brand === 'Nordwerk').length")
        left = await pg.evaluate("JSON.parse(localStorage.getItem('haltung.v1')).wardrobe.items.filter(i => i.brand === 'nordwerks').length")
        assert n >= 3 and left == 0, (n, left)
        assert 'angeglichen' in await pg.inner_text('#toast')
        await pg.locator('.brand-note button', has_text='Sind verschiedene').click(); await pg.wait_for_timeout(200)
        assert await pg.locator('.brand-note').count() == 0
        assert await pg.evaluate("JSON.parse(localStorage.getItem('haltung.v1')).meta.dismissed['brand:ostwind']") is True
        assert await pg.evaluate('document.documentElement.scrollWidth') <= 390
        await b.close()
        assert not errs, errs
        print('Marken angeglichen und Ausnahme gemerkt')
        print('Version 2.6: alle Tests bestanden, keine Konsolenfehler')

asyncio.run(main())
