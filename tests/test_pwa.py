"""Test der Handy-Version (dist/web) auf localhost, ausgeliefert mit den Headern aus vercel.json (CSP):
Begrüßung ohne Daten, falsche Datei, Backup-Import mit Foto, Sperre anbieten und einrichten, Foto und Wetter
unter der CSP, Start gesperrt, Sichtschutz und Sperre nach dem Hintergrund, Fehlversuch, Sperre in den
Einstellungen, Bericht im neuen Fenster, Kein Zugriff mehr (Daten löschen), erneuter Import, offline, Update.
Vorher: python3 build.py. Ziel: keine Konsolenfehler und keine CSP-Verstöße."""
import asyncio, json, pathlib, re, shutil, sys, tempfile, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import fixture
from serve_web import serve

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8765
URL = f'http://localhost:{PORT}/'
BACKUP = ROOT / 'tests' / 'backup-web.json'
SHOT = ROOT / 'tests'
VIS = "Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis || 'visible' });"
CSP_SPY = "window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));"
PHOTOS = "new Promise(r => { const q = indexedDB.open('haltung-fotos', 1); q.onupgradeneeded = () => q.result.createObjectStore('p'); q.onsuccess = () => { const db = q.result; const c = db.transaction('p').objectStore('p').count(); c.onsuccess = () => { r(c.result); db.close(); }; }; })"
def vis(v): return f"window.__vis = '{v}'; document.dispatchEvent(new Event('visibilitychange'));"


async def until(pg, expr, timeout=15000):
    """Wartet, bis expr wahr ist. Ersetzt wait_for_function, das per eval prüft und an der CSP der App scheitert."""
    t0 = time.time()
    while True:
        try:
            if await pg.evaluate(expr):
                return
        except Exception:
            pass  # zum Beispiel während eines Neuladens
        if time.time() - t0 > timeout / 1000:
            raise AssertionError('Zeitüberschreitung: ' + expr)
        await asyncio.sleep(0.1)


async def routes(ctx):
    async def wx(route):
        await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(fixture(7.5, 60)))
    async def geo(route):
        await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps({'results': [{'name': 'Musterstadt', 'latitude': 50.2, 'longitude': 8.6, 'admin1': 'Hessen', 'country': 'Deutschland'}]}))
    await ctx.route('https://api.open-meteo.com/**', wx)
    await ctx.route('https://geocoding-api.open-meteo.com/**', geo)


async def make_backup(p):
    """Backup wie auf dem PC: Test-Build öffnen, Foto an ein Teil hängen, Backup speichern."""
    b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
    ctx = await b.new_context(accept_downloads=True)
    await routes(ctx)
    pg = await ctx.new_page()
    await pg.goto((ROOT / 'dist' / 'haltung.html').as_uri())
    await pg.wait_for_selector('.shell')
    await pg.evaluate("location.hash='#/outfit/schrank'"); await pg.wait_for_timeout(300)
    await pg.click('button[data-a="item.edit"][data-id="mantel"]'); await pg.wait_for_timeout(300)
    await pg.set_input_files('input[data-c="item.photo"]', str(ROOT / 'tests' / 'fixtures' / 'foto.jpg')); await pg.wait_for_timeout(800)
    await pg.click('button[data-a="item.save"]'); await pg.wait_for_timeout(500)
    await pg.evaluate("location.hash='#/einstellungen'"); await pg.wait_for_timeout(300)
    async with pg.expect_download() as dl:
        await pg.click('button[data-a="backup.export"]')
    await (await dl.value).save_as(str(BACKUP))
    await b.close()
    data = json.loads(BACKUP.read_text(encoding='utf-8'))
    assert data['app'] == 'haltung' and len(data['photos']) == 1, 'Backup ohne Foto'
    return data


async def main():
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='chrisos-web-'))
    site = tmp / 'web'
    shutil.copytree(ROOT / 'dist' / 'web', site)
    srv = serve(site, PORT)
    try:
        async with async_playwright() as p:
            data = await make_backup(p)
            n_items = len(data['state']['wardrobe']['items'])
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, accept_downloads=True)
            await routes(ctx)
            await ctx.add_init_script(CSP_SPY)
            errs = []
            def watch(page, tag):
                page.on('console', lambda m: errs.append(f'{tag} {m.type}: {m.text}') if m.type == 'error' else None)
                page.on('pageerror', lambda e: errs.append(f'{tag} pageerror: {e}'))
            pg = await ctx.new_page()
            watch(pg, 'app')
            cdp = await ctx.new_cdp_session(pg)
            await cdp.send('WebAuthn.enable')
            auth = (await cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True, 'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}}))['authenticatorId']
            async def uv(v): await cdp.send('WebAuthn.setUserVerified', {'authenticatorId': auth, 'isUserVerified': v})
            async def S(expr): return await pg.evaluate(f"(() => {{ const S = window.HaltungDebug.state; return {expr}; }})()")

            # 1. Erststart ohne Daten: Begrüßung statt App, hell und dunkel
            await pg.emulate_media(color_scheme='dark')
            await pg.goto(URL)
            await pg.wait_for_selector('#welcome .welcome-btn')
            await pg.screenshot(path=str(SHOT / 'w_welcome_dark.png'))
            await pg.emulate_media(color_scheme='light')
            await pg.reload()
            await pg.wait_for_selector('#welcome .welcome-btn')
            await pg.screenshot(path=str(SHOT / 'w_welcome.png'))
            assert await pg.title() == 'Chris OS'
            assert await pg.locator('.shell').count() == 0
            assert await pg.evaluate("typeof Lock === 'object' && typeof PWA === 'object'")
            assert await pg.evaluate("navigator.serviceWorker.ready.then(() => true)")
            print('Begrüßung ohne Daten ok')

            # 2. Falsche Datei wird abgelehnt
            await pg.set_input_files('#welcome-file', str(ROOT / 'tests' / 'fixtures' / 'test-seed.json'))
            await pg.wait_for_selector('.welcome-msg.err')
            assert 'kein Backup' in await pg.inner_text('.welcome-msg')
            print('Falsche Datei abgelehnt')

            # 3. Backup einspielen: App startet, Sperre wird angeboten
            await pg.set_input_files('#welcome-file', str(BACKUP))
            await pg.wait_for_selector('.shell')
            assert await pg.locator('#welcome').count() == 0
            assert await S('S.wardrobe.items.length') == n_items
            await pg.wait_for_selector('#dlg[open]')
            assert 'Fingerabdruck-Sperre einrichten?' in await pg.inner_text('#dlg')
            assert 'Backup geladen' in await pg.inner_text('#toast')
            await pg.screenshot(path=str(SHOT / 'w_offer.png'))
            print('Backup eingespielt, Sperre angeboten')

            # 4. Sperre aus dem Angebot einrichten
            await pg.click('#dlg [data-a="lock.setup"]')
            await until(pg, "!!localStorage.getItem('chrisos.lock')")
            await until(pg, "document.getElementById('toast').textContent.includes('Sperre eingerichtet')")
            print('Sperre eingerichtet')

            # 5. Foto aus dem Backup und Wetter unter der CSP
            await pg.evaluate("location.hash='#/outfit/schrank'")
            await pg.wait_for_selector('.wcard img')
            await until(pg, "!!localStorage.getItem('haltung.wetter')")
            assert await pg.evaluate(PHOTOS) == 1
            await pg.evaluate("location.hash='#/heute'"); await pg.wait_for_timeout(400)
            await pg.screenshot(path=str(SHOT / 'w_heute.png'))
            print('Foto und Wetter ok')

            # 6. Neustart: gesperrt, Entsperren per Fingerabdruck
            await pg.reload()
            await pg.wait_for_selector('#lock', state='attached')
            await until(pg, "Lock.status().mode === 'open' && !document.documentElement.classList.contains('is-locked')")
            assert await pg.is_visible('.shell main#view')
            print('Start gesperrt, per Fingerabdruck entsperrt')

            # 7. Kurz im Hintergrund nur Sichtschutz, nach Ablauf der Frist Sperre und neue Abfrage
            await pg.evaluate(VIS)
            await pg.evaluate(vis('hidden'))
            assert await pg.evaluate('Lock.status().mode') == 'covered'
            await pg.evaluate(vis('visible'))
            assert await pg.evaluate('Lock.status().mode') == 'open'
            await pg.evaluate('Lock.setGrace(0)')
            await pg.evaluate(vis('hidden'))
            await pg.evaluate(vis('visible'))
            assert await pg.evaluate('Lock.status().mode') == 'locked'
            await until(pg, "Lock.status().mode === 'open'")
            await pg.evaluate('Lock.setGrace(60)')
            print('Hintergrund: Sichtschutz und Sperre ok')

            # 8. Fehlversuch: Fingerabdruck nicht bestätigt, App bleibt gesperrt
            await uv(False)
            await pg.evaluate('Lock.lockNow()')
            await pg.wait_for_timeout(1500)
            assert await pg.evaluate('Lock.status().mode') == 'locked'
            m = await pg.inner_text('#lock .lock-msg')
            await pg.screenshot(path=str(SHOT / 'w_lock.png'))
            await uv(True)
            await pg.click('#lock [data-l="go"]')
            await until(pg, "Lock.status().mode === 'open'")
            print('Fehlversuch bleibt gesperrt:', m)

            # 9. Einstellungen: jetzt sperren, ausschalten, wieder einrichten
            await pg.evaluate("location.hash='#/einstellungen'")
            await pg.wait_for_selector('[data-a="lock.now"]')
            await pg.locator('[data-a="lock.now"]').scroll_into_view_if_needed()
            await pg.screenshot(path=str(SHOT / 'w_settings.png'))
            await pg.click('[data-a="lock.now"]')
            await until(pg, "Lock.status().mode === 'open'")
            await pg.click('[data-a="lock.off"]')
            await until(pg, "localStorage.getItem('chrisos.lock') === null")
            await pg.wait_for_selector('[data-a="lock.on"]')
            await pg.click('[data-a="lock.on"]')
            await until(pg, "!!localStorage.getItem('chrisos.lock')")
            await pg.wait_for_selector('[data-a="lock.off"]')
            print('Sperre in den Einstellungen ok')

            # 10. Bericht im neuen Fenster: die Blob-Seite erbt die CSP
            await pg.evaluate("location.hash='#/gesundheit/bericht'")
            await pg.wait_for_selector('[data-a="rep.open"]')
            async with ctx.expect_page() as pop:
                await pg.click('[data-a="rep.open"]')
            rp = await pop.value
            watch(rp, 'bericht')
            await rp.wait_for_load_state()
            assert 'Gesundheitsübersicht' in await rp.title()
            assert not await rp.evaluate('window.__csp || []')
            await rp.close()
            print('Bericht ok')

            # 11. Kein Zugriff mehr: Daten auf dem Gerät löschen, dann Begrüßung
            await uv(False)
            await pg.evaluate('Lock.lockNow()')
            await pg.wait_for_timeout(800)
            await pg.click('#lock [data-l="help"]')
            async with pg.expect_navigation():
                await pg.click('#lock [data-l="wipe"]')
            await pg.wait_for_selector('#welcome .welcome-btn')
            assert await pg.evaluate("localStorage.getItem('chrisos.lock') === null && localStorage.getItem('haltung.v1') === null")
            assert await pg.evaluate(PHOTOS) == 0
            await uv(True)
            print('Kein Zugriff mehr: Daten gelöscht, Begrüßung')

            # 12. Wieder einspielen, Sperre auf später
            await pg.set_input_files('#welcome-file', str(BACKUP))
            await pg.wait_for_selector('#dlg[open]')
            await pg.click('#dlg [data-a="dlg.close"]')
            assert await S('S.wardrobe.items.length') == n_items
            assert await pg.evaluate("localStorage.getItem('chrisos.lock') === null")
            print('Erneut eingespielt, Sperre später')

            # 13. Offline startklar, mit Daten
            await until(pg, 'navigator.serviceWorker.controller !== null')
            await until(pg, "!!localStorage.getItem('haltung.wetter')")
            await ctx.set_offline(True)
            await pg.reload()
            await pg.wait_for_selector('.shell')
            assert await S('S.wardrobe.items.length') == n_items
            await ctx.set_offline(False)
            print('Offline ok')

            # 14. Neue Version: Hinweis, auf Knopfdruck laden
            sw = site / 'sw.js'
            old = sw.read_text(encoding='utf-8')
            tag = re.search(r'VERSION\s*=\s*["\']([^"\']+)["\']', old).group(1)
            sw.write_text(old.replace(tag, tag + '-neu'), encoding='utf-8')
            await pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
            await pg.wait_for_selector('#toast [data-a="toast.act"]', timeout=15000)
            assert 'Neue Version bereit' in await pg.inner_text('#toast')
            async with pg.expect_navigation():
                await pg.click('#toast [data-a="toast.act"]')
            await until(pg, f"caches.keys().then(k => k.includes('chrisos-{tag}-neu') && !k.includes('chrisos-{tag}'))")
            await pg.wait_for_selector('.shell')
            print('Update ok')

            csp = await pg.evaluate('window.__csp')
            await b.close()
            assert not csp, csp
            assert not errs, errs
            print('Alle Tests der Handy-Version bestanden, keine Konsolenfehler, keine CSP-Verstöße')
    finally:
        srv.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)

asyncio.run(main())
