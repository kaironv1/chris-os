"""Zwei Geräte (K39, K40): Handy als Hauptgerät, PC über die Web-Adresse mit Windows Hello.
Handy und PC laufen in getrennten Browser-Kontexten gegen den Web-Build mit den Headern aus vercel.json (CSP).
Geprüft: Begrüßung je Gerät, Backup mit Uhrzeit und Gerät im Dateinamen, Datenstand nach dem Einspielen,
Hinweis am Zweitgerät (alter Stand, eigene Änderungen), Warnung vor dem Überschreiben (Änderungen gehen
verloren, älteres Backup), Rückweg vom PC zum Handy ohne Warnung, Hauptgerät umstellen, Wortlaut Windows Hello
in Angebot, Einstellungen und Sperrbildschirm.
Vorher: python3 build.py und python3 tests/test_pwa.py (liefert tests/backup-web.json).
Ziel: keine Konsolenfehler und keine CSP-Verstöße."""
import asyncio, datetime, json, pathlib, re, shutil, sys, tempfile, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import fixture, env_routes
from serve_web import serve

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8767
URL = f'http://localhost:{PORT}/'
BACKUP = ROOT / 'tests' / 'backup-web.json'
SHOT = ROOT / 'tests'
ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
CSP_SPY = "window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));"
NAME = re.compile(r'^chris-os-backup-\d{4}-\d\d-\d\d-\d{4}-(handy|pc)\.json$')


async def until(pg, expr, timeout=15000):
    """Wartet, bis expr wahr ist (wait_for_function scheitert an der CSP der App)."""
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


async def routes(ctx):
    async def wx(route):
        await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps(fixture(7.5, 60)))
    async def geo(route):
        await route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'}, body=json.dumps({'results': []}))
    await ctx.route('https://api.open-meteo.com/**', wx)
    await ctx.route('https://geocoding-api.open-meteo.com/**', geo)
    await env_routes(ctx)


class Device:
    """Ein Gerät: eigener Browser-Kontext, eigene Daten, eigener Passkey."""
    def __init__(self, tag):
        self.tag, self.errs = tag, []

    async def open(self, browser, **opts):
        self.ctx = await browser.new_context(accept_downloads=True, **opts)
        await routes(self.ctx)
        await self.ctx.add_init_script(CSP_SPY)
        self.pg = await self.ctx.new_page()
        self.pg.on('console', lambda m: self.errs.append(f'{self.tag} {m.type}: {m.text}') if m.type == 'error' else None)
        self.pg.on('pageerror', lambda e: self.errs.append(f'{self.tag} pageerror: {e}'))
        self.cdp = await self.ctx.new_cdp_session(self.pg)
        await self.cdp.send('WebAuthn.enable')
        self.auth = (await self.cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'transport': 'internal', 'hasResidentKey': True, 'hasUserVerification': True, 'isUserVerified': True, 'automaticPresenceSimulation': True}}))['authenticatorId']
        await self.pg.goto(URL)
        await self.pg.wait_for_selector('#welcome .welcome-btn')
        return self

    async def uv(self, v):
        await self.cdp.send('WebAuthn.setUserVerified', {'authenticatorId': self.auth, 'isUserVerified': v})

    async def S(self, expr):
        return await self.pg.evaluate(f"(() => {{ const S = window.HaltungDebug.state; return {expr}; }})()")

    async def go(self, h):
        await self.pg.evaluate(f"location.hash='{h}'")
        await self.pg.wait_for_timeout(300)

    async def change(self):
        """Eine echte Änderung über die Oberfläche: im Ernährungsprotokoll etwas eintragen (seit 2.7)."""
        await self.go('#/training/ernaehrung')
        await self.pg.fill('#view .nf-in', 'Skyr mit Beeren')
        await self.pg.click('#view button[data-a="nf.add"]')
        await self.pg.wait_for_timeout(250)

    async def export(self, path):
        await self.go('#/einstellungen')
        async with self.pg.expect_download() as dl:
            await self.pg.click('button[data-a="backup.export"]')
        d = await dl.value
        await d.save_as(str(path))
        return d.suggested_filename, json.loads(pathlib.Path(path).read_text(encoding='utf-8'))

    async def ask_import(self, path):
        """Backup in den Einstellungen wählen; gibt Titel und Text der Rückfrage zurück."""
        await self.go('#/einstellungen')
        await self.pg.set_input_files('#view input[data-c="backup.import"]', str(path))
        await self.pg.wait_for_selector('#dlg[open]')
        return await self.pg.inner_text('#dlg .sheet-title'), await self.pg.inner_text('#dlg .how-text')

    async def note(self):
        await self.go('#/heute')
        loc = self.pg.locator('[data-note="device"]')
        return await loc.inner_text() if await loc.count() else ''


async def main():
    src = json.loads(BACKUP.read_text(encoding='utf-8'))
    tmp = pathlib.Path(tempfile.mkdtemp(prefix='chrisos-2geraete-'))
    site = tmp / 'web'
    shutil.copytree(ROOT / 'dist' / 'web', site)
    srv = serve(site, PORT)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
            handy = await Device('handy').open(b, viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent=ANDROID)
            pc = await Device('pc').open(b, viewport={'width': 1280, 'height': 860}, user_agent=WINDOWS)
            H, P = handy.pg, pc.pg

            # 1. Begrüßung je Gerät: Quelle des Backups, Installieren, kein Konto
            th, tp = await H.inner_text('#welcome'), await P.inner_text('#welcome')
            assert 'Am PC in Chris OS: Einstellungen, Daten' in th and 'tippen' in th and 'Zum Startbildschirm hinzufügen' in th, th
            assert 'Am Handy in Chris OS: Mehr, Daten' in tp and 'klicken' in tp and 'Symbol rechts in der Adressleiste' in tp, tp
            assert 'Ein Konto oder eine Anmeldung gibt es nicht' in th
            await P.screenshot(path=str(SHOT / 'z_pc_welcome.png'))
            print('Begrüßung je Gerät ok')

            # 2. Handy: erstes Backup einspielen (wie A3), Sperre auf später
            await H.set_input_files('#welcome-file', str(BACKUP))
            await H.wait_for_selector('#dlg[open]')
            assert 'Fingerabdruck-Sperre einrichten?' in await H.inner_text('#dlg')
            await H.click('#dlg [data-a="dlg.close"]')
            r = await handy.S('S.meta.restored')
            assert r['at'] and r['exported'] == src['exported'] and r['from'] == src.get('device'), r
            assert await handy.note() == '', 'Hauptgerät ohne Geräte-Hinweis'
            print('Handy eingerichtet, Datenstand', r)

            # 3. Handy: Eintrag, dann Backup mit Uhrzeit und Gerät im Namen
            await handy.change()
            assert await handy.S('S.meta.changedAt > S.meta.restored.at')
            await handy.go('#/einstellungen')
            ts = await H.inner_text('#view')
            assert 'Hier ist dein Handy' in ts and 'Fingerabdruck-Sperre' in ts
            assert await H.get_attribute('[data-a="main.dev"][data-v="handy"]', 'aria-pressed') == 'true'
            n1, h1 = await handy.export(tmp / 'h1.json')
            assert NAME.match(n1) and n1.endswith('-handy.json'), n1
            assert h1['device'] == 'handy' and h1['state']['meta']['savedAt'] == h1['exported']
            assert not await handy.S('S.meta.changedAt > S.meta.savedAt'), 'Backup zählt nicht als Änderung'
            print('Backup vom Handy:', n1)

            # 4. PC über die Web-Adresse (K40): Backup vom Handy, Sperre mit Windows Hello
            await P.set_input_files('#welcome-file', str(tmp / 'h1.json'))
            await P.wait_for_selector('#dlg[open]')
            t = await P.inner_text('#dlg')
            assert 'Sperre mit Windows Hello einrichten?' in t and 'Gesicht, Fingerabdruck oder PIN' in t, t
            await P.click('#dlg [data-a="lock.setup"]')
            await until(P, "!!localStorage.getItem('chrisos.lock')")
            await until(P, "document.getElementById('toast').textContent.includes('Windows Hello')")
            r = await pc.S('S.meta.restored')
            assert r['from'] == 'handy' and r['exported'] == h1['exported'], r
            assert await pc.note() == '', 'frisch eingespielt: kein Hinweis'
            print('PC eingerichtet, Sperre mit Windows Hello')

            # 5. PC: Stand von vorgestern, Hinweis auf ein frisches Backup vom Handy
            old = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=2)).isoformat().replace('+00:00', 'Z')
            await P.evaluate(f"(() => {{ const S = window.HaltungDebug.state; S.meta.restored.exported = '{old}'; window.HaltungDebug.render(); }})()")
            t = await pc.note()
            assert 'Daten vom Handy, Stand:' in t and 'frisches Backup vom Handy' in t, t
            assert await P.locator('[data-note="device"] input[data-c="backup.import"]').count() == 1
            await P.screenshot(path=str(SHOT / 'z_pc_stand.png'))
            await P.evaluate(f"(() => {{ const S = window.HaltungDebug.state; S.meta.restored.exported = '{h1['exported']}'; window.HaltungDebug.render(); }})()")
            print('Hinweis alter Stand:', t)

            # 6. PC: eigener Eintrag, Hinweis „fehlt am Handy“
            await pc.change()
            t = await pc.note()
            assert 'das am Handy noch fehlt' in t and await P.locator('[data-note="device"] [data-a="backup.export"]').count() == 1, t
            await P.screenshot(path=str(SHOT / 'z_pc_aenderung.png'))
            print('Hinweis eigene Änderung:', t)

            # 7. PC: Einstellungen mit Windows Hello und Datenstand
            await pc.go('#/einstellungen')
            ts = await P.inner_text('#view')
            assert 'Sperre mit Windows Hello' in ts and 'Windows Hello (Gesicht, Fingerabdruck oder PIN)' in ts, ts
            assert 'Zuletzt eingespielt: Backup vom Handy (' in ts and 'Hier ist dein PC' in ts, ts
            await P.locator('[data-a="main.dev"]').first.scroll_into_view_if_needed()
            await P.screenshot(path=str(SHOT / 'z_pc_einstellungen.png'))
            print('Einstellungen am PC ok')

            # 8. PC: dasselbe Backup noch einmal einspielen würde den Eintrag löschen, also Warnung
            title, text = await pc.ask_import(tmp / 'h1.json')
            assert title == 'Trotzdem laden?' and 'Änderungen von hier fehlen darin' in text, (title, text)
            assert 'Backup vom Handy (' in text
            await P.click('#dlg [data-a="dlg.close"]')
            assert await pc.S('S.meta.changedAt > S.meta.restored.at'), 'Abbrechen ändert nichts'
            print('Warnung vor Verlust:', text)

            # 9. PC: Backup zurück ans Handy, dort ohne Warnung
            n2, p1 = await pc.export(tmp / 'p1.json')
            assert n2.endswith('-pc.json') and p1['device'] == 'pc' and p1['state']['meta']['restored']['exported'] == h1['exported'], n2
            prot_pc = await pc.S('JSON.stringify(S.nutrition.log)')
            title, text = await handy.ask_import(tmp / 'p1.json')
            assert title == 'Backup laden?' and 'Achtung' not in text and 'Backup vom PC (' in text, (title, text)
            await H.click('#dlg [data-a="confirm.ok"]')
            await until(H, "document.getElementById('toast').textContent.includes('Backup geladen')")
            assert await handy.S('S.meta.restored.from') == 'pc'
            assert await handy.S('JSON.stringify(S.nutrition.log)') == prot_pc, 'Eintrag vom PC am Handy'
            print('Rückweg PC zum Handy ohne Warnung')

            # 10. Handy: älteres Backup wählen, Warnung
            await handy.change()
            title, text = await handy.ask_import(tmp / 'h1.json')
            assert title == 'Trotzdem laden?' and 'älter als der Stand auf diesem Gerät' in text, (title, text)
            await H.click('#dlg [data-a="dlg.close"]')
            print('Warnung bei älterem Backup:', text)

            # 11. Hauptgerät umstellen: dann ist das Handy das Zweitgerät
            await handy.go('#/einstellungen')
            await H.click('[data-a="main.dev"][data-v="pc"]'); await H.wait_for_timeout(200)
            assert await handy.S('S.settings.mainDevice') == 'pc'
            t = await handy.note()
            assert 'das am PC noch fehlt' in t, t
            await handy.go('#/einstellungen')
            await H.click('[data-a="main.dev"][data-v="handy"]'); await H.wait_for_timeout(200)
            assert await handy.note() == ''
            print('Hauptgerät umstellbar')

            # 12. Sperrbildschirm am PC: Wortlaut Windows Hello, auch bei „Kein Zugriff mehr?“
            await pc.uv(False)
            await P.evaluate('Lock.lockNow()')
            await P.wait_for_timeout(1200)
            await P.click('#lock [data-l="help"]')
            assert 'Ohne Windows Hello kommst du nicht mehr' in await P.inner_text('#lock')
            await P.click('#lock [data-l="back"]')
            assert await P.inner_text('#lock .lock-msg') == 'Entsperre mit Windows Hello.'
            await P.screenshot(path=str(SHOT / 'z_pc_lock.png'))
            await pc.uv(True)
            await P.click('#lock [data-l="go"]')
            await until(P, "Lock.status().mode === 'open'")
            print('Sperrbildschirm am PC ok')

            csp = (await H.evaluate('window.__csp')) + (await P.evaluate('window.__csp'))
            await b.close()
            errs = handy.errs + pc.errs
            assert not csp, csp
            assert not errs, errs
            print('Zwei Geräte: alle Tests bestanden, keine Konsolenfehler, keine CSP-Verstöße')
    finally:
        srv.shutdown()
        shutil.rmtree(tmp, ignore_errors=True)

asyncio.run(main())
