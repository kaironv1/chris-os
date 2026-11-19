"""Test der Handy-Bausteine auf localhost: Passkey-Sperre mit virtuellem Authentifikator, Sperre nach Hintergrund,
Fehlversuch, Neu einrichten, Service Worker offline und Update-Hinweis."""
import asyncio, pathlib, subprocess, sys, time, re
from playwright.async_api import async_playwright
ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'pwa' / 'site-test'
PORT = 8765
URL = f'http://localhost:{PORT}/'
VIS = "Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis || 'visible' });"
def vis(v): return f"window.__vis = '{v}'; document.dispatchEvent(new Event('visibilitychange'));"

async def main():
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', str(SITE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
            ctx = await b.new_context(viewport={'width': 390, 'height': 844})
            pg = await ctx.new_page()
            errs = []
            pg.on('console', lambda m: errs.append(f'{m.type}: {m.text}') if m.type == 'error' else None)
            pg.on('pageerror', lambda e: errs.append(f'pageerror: {e}'))
            cdp = await ctx.new_cdp_session(pg)
            await cdp.send('WebAuthn.enable')
            auth = (await cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True, 'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}}))['authenticatorId']

            await pg.goto(URL)
            await pg.wait_for_function('window.__lockInit')
            init = await pg.evaluate('window.__lockInit')
            assert init == {'enabled': False, 'supported': True}, init
            assert not await pg.is_visible('#lock')
            # 1. Sperre einrichten
            await pg.click('#setup')
            await pg.wait_for_function("document.getElementById('state').textContent === 'Sperre aktiv'")
            assert await pg.evaluate("!!localStorage.getItem('chrisos.lock')")
            print('Einrichten ok')
            # 2. Neustart: gesperrt, Entsperren per Fingerabdruck
            await pg.reload()
            await pg.wait_for_function("document.documentElement.classList.contains('is-locked') || document.getElementById('state').textContent === 'Entsperrt'")
            await pg.wait_for_function("document.getElementById('state').textContent === 'Entsperrt'")
            assert not await pg.is_visible('#lock') and not await pg.evaluate("document.documentElement.classList.contains('is-locked')")
            print('Start gesperrt, entsperrt ok')
            # 3. Hintergrund kurz: nur Sichtschutz, ohne Abfrage zurück
            await pg.evaluate(VIS)
            await pg.evaluate(vis('hidden'))
            assert await pg.evaluate('Lock.status().mode') == 'covered'
            assert await pg.is_visible('#lock')
            await pg.evaluate(vis('visible'))
            assert await pg.evaluate('Lock.status().mode') == 'open'
            print('Kurz im Hintergrund ok')
            # 4. Hintergrund länger als die Frist: Sperre und Abfrage
            await pg.evaluate("Lock.setGrace(0); document.getElementById('state').textContent = ''")
            await pg.evaluate(vis('hidden'))
            await pg.evaluate(vis('visible'))
            await pg.wait_for_function("Lock.status().mode === 'open' && document.getElementById('state').textContent === 'Entsperrt'")
            print('Lange im Hintergrund, erneut entsperrt ok')
            # 5. Fehlversuch: Fingerabdruck nicht bestätigt
            await cdp.send('WebAuthn.setUserVerified', {'authenticatorId': auth, 'isUserVerified': False})
            await pg.evaluate("document.getElementById('state').textContent = ''; Lock.lockNow()")
            await pg.wait_for_timeout(1500)
            assert await pg.evaluate('Lock.status().mode') == 'locked'
            m = await pg.inner_text('#lock .lock-msg')
            assert m in ('Abgebrochen. Tippe auf Entsperren.', 'Nicht erkannt. Versuch es noch einmal.', 'Entsperren hat nicht geklappt. Versuch es noch einmal.'), m
            await cdp.send('WebAuthn.setUserVerified', {'authenticatorId': auth, 'isUserVerified': True})
            await pg.click('#lock [data-l="go"]')
            await pg.wait_for_function("Lock.status().mode === 'open'")
            print('Fehlversuch bleibt gesperrt:', m)
            # 6. Kein Zugriff mehr: Daten löschen, neu einrichten
            await pg.evaluate("Lock.lockNow()")
            await cdp.send('WebAuthn.setUserVerified', {'authenticatorId': auth, 'isUserVerified': False})
            await pg.wait_for_timeout(800)
            await pg.click('#lock [data-l="help"]')
            async with pg.expect_navigation():
                await pg.click('#lock [data-l="wipe"]')
            await pg.wait_for_function('window.__lockInit')
            assert await pg.evaluate("localStorage.getItem('chrisos.lock') === null")
            assert await pg.inner_text('#state') == 'App offen'
            await cdp.send('WebAuthn.setUserVerified', {'authenticatorId': auth, 'isUserVerified': True})
            print('Neu einrichten ok')
            # 7. Service Worker: offline startklar
            await pg.evaluate("navigator.serviceWorker.ready.then(() => true)")
            await pg.reload()
            await pg.wait_for_function('navigator.serviceWorker.controller !== null')
            await ctx.set_offline(True)
            await pg.reload()
            assert await pg.title() == 'Chris OS'
            assert await pg.is_visible('#setup')
            assert await pg.evaluate("typeof Lock === 'object' && typeof PWA === 'object'"), 'Sperre oder Update fehlen offline'
            await ctx.set_offline(False)
            print('Offline ok')
            # 8. Neue Version: Hinweis, dann laden
            sw = SITE / 'sw.js'
            sw.write_text(sw.read_text(encoding='utf-8').replace("'test-1'", "'test-2'"), encoding='utf-8')
            await pg.evaluate("navigator.serviceWorker.getRegistration().then(r => r.update())")
            await pg.wait_for_selector('#upd:not([hidden])', timeout=15000)
            async with pg.expect_navigation():
                await pg.click('#apply')
            await pg.wait_for_function("caches.keys().then(k => k.includes('chrisos-test-2') && !k.includes('chrisos-test-1'))")
            print('Update ok')
            await b.close()
            assert not errs, errs
            print('Alle Handy-Tests bestanden, keine Konsolenfehler')
    finally:
        srv.terminate()
        sw = SITE / 'sw.js'
        sw.write_text(sw.read_text(encoding='utf-8').replace("'test-2'", "'test-1'"), encoding='utf-8')
asyncio.run(main())
