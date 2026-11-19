"""Playwright-Test der Vorschau: keine Konsolenfehler, Outfits, Tausch, Auswahl, Dunkel-Modus, Screenshots."""
import asyncio, pathlib
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'dist' / 'ankleide-figur-vorschau.html').as_uri()
SHOTS = ROOT / 'shots'
SHOTS.mkdir(exist_ok=True)

async def run(p, name, vp, scale, scheme):
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = await b.new_context(viewport=vp, device_scale_factor=scale, color_scheme=scheme, is_mobile=vp['width'] < 500, has_touch=vp['width'] < 500)
    pg = await ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
    await pg.goto(URL)
    await pg.wait_for_selector('#fig svg')
    chips = await pg.query_selector_all('[data-occ]')
    assert len(chips) == 7, len(chips)
    # jedes Outfit einmal rendern
    for i in range(len(chips)):
        await pg.click(f'[data-occ="{i}"]')
        n = await pg.eval_on_selector_all('#fig .fig-part', 'els => els.length')
        rows = await pg.eval_on_selector_all('#parts .part', 'els => els.length')
        assert n >= 3 and rows >= 3, (i, n, rows)
    # Tausch über das Symbol: Hose wechselt
    await pg.click('[data-occ="0"]')
    before = await pg.inner_text('#parts')
    await pg.click('[data-swap="bottom:0"]')
    after = await pg.inner_text('#parts')
    assert before != after, 'Tausch ohne Wirkung'
    # Auswahl über die Figur: Schuhe antippen, anderes Paar wählen
    box = await (await pg.query_selector('#fig [data-pick="shoes:0"]')).bounding_box()
    await pg.mouse.click(box['x'] + box['width'] * 0.2, box['y'] + box['height'] * 0.75)
    await pg.wait_for_selector('#sheet:not([hidden]) .opt')
    if name == 'mobil-hell':
        await pg.screenshot(path=str(SHOTS / f'{name}-auswahl.png'))
    opts = await pg.query_selector_all('#sheet .opt:not(.on)')
    label = await opts[0].inner_text()
    await opts[0].click()
    assert await pg.is_hidden('#sheet'), 'Auswahl nicht geschlossen'
    assert label.strip() in await pg.inner_text('#parts'), 'Auswahl nicht übernommen'
    # fehlender Mantel: Umriss, dann Mantel wählen
    await pg.click('[data-occ="6"]')
    assert await pg.query_selector('#fig .fig-hint'), 'Umriss fehlt'
    await pg.click('[data-swap="outer:0"]')
    await pg.wait_for_selector('#sheet:not([hidden]) .opt')
    await pg.click('#sheet .opt')
    assert not await pg.query_selector('#fig .fig-hint'), 'Umriss bleibt'
    # Darstellung umschalten
    await pg.click('[data-th="dark"]')
    assert await pg.get_attribute('html', 'data-theme') == 'dark'
    await pg.click('[data-th="auto"]')
    # Screenshots
    shots = {'mobil-hell': 0, 'mobil-dunkel': 2, 'desktop': 1}
    await pg.click(f'[data-occ="{shots[name]}"]')
    await pg.wait_for_timeout(100)
    await pg.screenshot(path=str(SHOTS / f'{name}.png'), full_page=(name != 'desktop'))
    await b.close()
    return errs

async def main():
    async with async_playwright() as p:
        total = []
        for name, vp, scale, scheme in (('mobil-hell', {'width': 390, 'height': 844}, 2, 'light'), ('mobil-dunkel', {'width': 390, 'height': 844}, 2, 'dark'), ('desktop', {'width': 1280, 'height': 900}, 1, 'light')):
            errs = await run(p, name, vp, scale, scheme)
            print(name, 'ok', errs if errs else 'keine Konsolenfehler')
            total += errs
        assert not total, total
        print('Alle Vorschau-Tests bestanden')
asyncio.run(main())
