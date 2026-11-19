"""Ankleide-Figur (2.3): Figur zuerst, Teile-Liste mit Marke, Teil an der Figur antippen und auswählen, Pfeil tauscht,
Umschalter merkt sich die Wahl, fehlender Mantel als Umriss, Handy hell und dunkel, keine Konsolenfehler."""
import asyncio, sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from run import *


async def st(pg, expr):
    return await pg.evaluate(f"(() => {{ const S = window.HaltungDebug.state; return {expr}; }})()")


async def go(pg, h, wait=500):
    await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(wait)


async def rows(pg):
    return await pg.eval_on_selector_all('.board .fig-row', "els => els.map(e => ({ slot: e.dataset.slot || '', name: e.querySelector('.fig-name').textContent.trim(), meta: e.querySelector('.fig-meta').textContent.trim(), hint: e.classList.contains('hint') }))")


async def click_part(pg, slot, fx, fy):
    el = await pg.query_selector(f'.board .fig .fig-part[data-slot="{slot}"]')
    await el.evaluate("e => e.scrollIntoView({ block: 'center' })"); await pg.wait_for_timeout(150)
    box = await el.bounding_box()
    await pg.mouse.click(box['x'] + box['width'] * fx, box['y'] + box['height'] * fy)
    await pg.wait_for_timeout(350)


async def desktop(p):
    b, ctx, pg, errs = await setup(p)
    await pg.goto(URL); await pg.wait_for_timeout(1200)
    # 1. Heute: Figur ist die Standardansicht
    assert await pg.query_selector('.board .fig'), 'Figur fehlt auf Heute'
    assert await pg.get_attribute('.board .view-switch [data-v="figur"]', 'aria-pressed') == 'true'
    # 2. Outfit-Seite: Teile-Liste passt zur Figur, jedes Teil mit Marke oder „Marke offen“
    await go(pg, '#/outfit')
    r = await rows(pg)
    n_parts = await pg.eval_on_selector_all('.board .fig .fig-part', 'els => els.length')
    assert len(r) == n_parts >= 3, (len(r), n_parts)
    titles = await pg.eval_on_selector_all('.board .fig .fig-part title', 'els => els.map(e => e.textContent)')
    for x in r:
        if x['hint']:
            continue
        brand = x['meta'].split(',')[0]
        assert brand, x
        if brand not in ('Marke offen', 'Wunschliste'):
            assert any(t.endswith(' von ' + brand) for t in titles), ('Marke fehlt im Titel', brand, titles)
    label = await pg.get_attribute('.board .fig', 'aria-label')
    assert label.startswith('Figur mit '), label
    print('Liste:', r)
    # 3. Teil an der Figur antippen: Auswahl öffnet sich, Wahl wird übernommen
    bottom_before = next(x['name'] for x in r if x['slot'] == 'bottom')
    await click_part(pg, 'bottom', 0.25, 0.55)
    assert await pg.evaluate("document.getElementById('dlg').open"), 'Auswahl öffnet sich nicht'
    head = await pg.text_content('#dlg .sheet-title')
    assert bottom_before in head, (head, bottom_before)
    opts = await pg.eval_on_selector_all('#dlg .choose .check-name', 'els => els.map(e => e.textContent)')
    assert opts, 'keine Alternativen'
    await pg.click('#dlg button[data-a="o.chooseSet"][data-v="0"]'); await pg.wait_for_timeout(350)
    bottom_after = next(x['name'] for x in await rows(pg) if x['slot'] == 'bottom')
    assert bottom_after == opts[0] and bottom_after != bottom_before, (bottom_before, bottom_after, opts[0])
    assert 'getauscht gegen' in await pg.text_content('#toast')
    print('Auswahl über die Figur:', bottom_before, 'durch', bottom_after)
    # 4. Pfeil in der Liste tauscht das Teil; Fokus bleibt auf dem Pfeil
    top = [x for x in await rows(pg) if x['slot'].startswith('t')][-1]
    await pg.focus(f'.board .fig-swap[data-k="{top["slot"]}"]')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(350)
    r2 = await rows(pg)
    top2 = next((x for x in r2 if x['slot'] == top['slot']), None)
    assert top2 and top2['name'] != top['name'], (top, top2)
    assert await pg.evaluate("document.activeElement && document.activeElement.classList.contains('fig-swap')"), 'Fokus verloren'
    print('Tausch mit Pfeil:', top['name'], 'durch', top2['name'])
    # 5. Umschalter: Teile, gespeichert über Neuladen, zurück zur Figur
    await pg.click('.board .view-switch [data-v="teile"]'); await pg.wait_for_timeout(300)
    assert await pg.query_selector('.board .lay-split') and not await pg.query_selector('.board .fig')
    assert await st(pg, 'S.settings.outfitView') == 'teile'
    await pg.reload(); await pg.wait_for_timeout(1100)
    assert await pg.query_selector('.board .lay-split'), 'Wahl nicht gemerkt'
    await pg.click('.board .view-switch [data-v="figur"]'); await pg.wait_for_timeout(300)
    await pg.reload(); await pg.wait_for_timeout(1100)
    assert await pg.query_selector('.board .fig'), 'Figur nach Neuladen fehlt'
    print('Umschalter gemerkt')
    # 6. Kein Mantel und keine Winterjacke verfügbar: Umriss an der Figur und Hinweis in der Liste
    await st(pg, "(S.wardrobe.items.filter(i => i.role === 'coat' || i.role === 'winter').forEach(i => { i.laundry = true; }), S.wardrobe.choice = {}, true)")
    await pg.evaluate('window.HaltungDebug.render()'); await pg.wait_for_timeout(100)
    await pg.evaluate("location.hash='#/heute'"); await pg.wait_for_timeout(300)
    await pg.evaluate("location.hash='#/outfit'"); await pg.wait_for_timeout(500)
    need = await st(pg, 'true')
    hint = await pg.query_selector('.board .fig .fig-hint')
    hint_row = [x for x in await rows(pg) if x['hint']]
    print('Umriss:', bool(hint), hint_row)
    assert hint and hint_row and hint_row[0]['meta'].startswith('Noch nicht erfasst'), 'Umriss oder Hinweis fehlt'
    await pg.screenshot(path=str(pathlib.Path(__file__).parent / 'figur_desktop.png'), full_page=False)
    await b.close()
    return errs


async def mobile(p, dark):
    b, ctx, pg, errs = await setup(p, 390, 844, dark=dark, mobile=True)
    await pg.goto(URL); await pg.wait_for_timeout(1200)
    if dark:
        await st(pg, "(S.settings.theme = 'dark', localStorage.setItem('haltung.v1', JSON.stringify(S)), true)")
        await pg.reload(); await pg.wait_for_timeout(1000)
    await go(pg, '#/outfit')
    assert await pg.query_selector('.board .fig')
    overflow = await pg.evaluate('document.documentElement.scrollWidth > window.innerWidth')
    assert not overflow, 'waagerechter Überlauf'
    # Antippen am Handy: Schuhe
    await click_part(pg, 'shoes', 0.2, 0.7)
    assert await pg.evaluate("document.getElementById('dlg').open"), 'Auswahl am Handy öffnet sich nicht'
    await pg.click('#dlg button[data-a="dlg.close"]'); await pg.wait_for_timeout(200)
    board = await pg.query_selector('.board')
    await board.screenshot(path=str(pathlib.Path(__file__).parent / f'figur_mobil_{"dunkel" if dark else "hell"}.png'))
    await b.close()
    return errs


async def main():
    async with async_playwright() as p:
        errs = await desktop(p)
        errs += await mobile(p, False)
        errs += await mobile(p, True)
        print('ERRORS', errs)
        assert not errs, errs
        print('Alle Figur-Tests bestanden')
asyncio.run(main())
