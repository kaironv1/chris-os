"""PC-Version ohne Startdaten (dist/chris-os.html, file://): Begrüßung, Backup einspielen, keine Sperre und kein
Update-Bereich, Alles zurücksetzen führt zurück zur Begrüßung. Braucht tests/backup-web.json aus test_pwa.py."""
import asyncio, json, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from run import setup, async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKUP = ROOT / 'tests' / 'backup-web.json'


async def main():
    data = json.loads(BACKUP.read_text(encoding='utf-8'))
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p, 1280, 860)
        await pg.goto((ROOT / 'dist' / 'chris-os.html').as_uri())
        await pg.wait_for_selector('#welcome .welcome-btn')
        assert await pg.locator('.shell').count() == 0
        assert await pg.evaluate("!(window.Lock && window.Lock.init) && typeof PWA === 'undefined' && !document.getElementById('seed')")
        await pg.screenshot(path=str(ROOT / 'tests' / 'pc_welcome.png'))
        print('Begrüßung ohne Startdaten ok')
        await pg.set_input_files('#welcome-file', str(BACKUP))
        await pg.wait_for_selector('.shell')
        n = await pg.evaluate('window.HaltungDebug.state.wardrobe.items.length')
        assert n == len(data['state']['wardrobe']['items']), n
        assert await pg.locator('#dlg[open]').count() == 0, 'ohne Sperre kein Angebot'
        await pg.evaluate("location.hash='#/einstellungen'"); await pg.wait_for_timeout(300)
        txt = await pg.inner_text('#view')
        assert 'Sperre und Updates' not in txt and 'in diesem Browser' in txt and 'Danach kannst du ein Backup einspielen' in txt
        print('Backup eingespielt, Einstellungen ohne Sperre ok')
        await pg.reload(); await pg.wait_for_selector('.shell')
        assert await pg.evaluate('window.HaltungDebug.state.wardrobe.items.length') == n
        await pg.evaluate("location.hash='#/einstellungen'"); await pg.wait_for_timeout(300)
        await pg.click('button[data-a="reset"]'); await pg.wait_for_timeout(200)
        async with pg.expect_navigation():
            await pg.click('button[data-a="confirm.ok"]')
        await pg.wait_for_selector('#welcome .welcome-btn')
        assert await pg.evaluate("localStorage.getItem('haltung.v1') === null")
        print('Zurücksetzen führt zur Begrüßung')
        await b.close()
        assert not [e for e in errs if not e.startswith('warning')], errs
        print('PC-Version ok, keine Konsolenfehler')

asyncio.run(main())
