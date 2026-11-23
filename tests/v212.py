"""Version 2.12. Verschlüsselter Raum: kein Menüpunkt, Einstieg über sieben Tipps auf die Versionszeile; Einrichten mit
Passphrase; Inhalt nur als Chiffrat im Speicher; Import im Export-Format, Chronik mit Einordnung und Mustern samt
Matrix, Gesprächsvorbereitung mit Entwurf-Check, Türschwellen-Reset, Check-in mit Motivations-Check; schließt beim
Seitenwechsel, nach einer Minute im Hintergrund und per Knopf; falsche Passphrase; Fingerabdruck (PRF) mit einem
virtuellen Authenticator am PC, wenn Chromium ihn kann. Handy hell und PC dunkel, ohne Konsolenfehler."""
import asyncio, datetime, json, pathlib, re, socket, subprocess, sys, time
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from playwright.async_api import async_playwright
from run import setup, URL

SHOT = pathlib.Path(__file__).resolve().parent
DIST = SHOT.parent / 'dist'
TODAY = datetime.date.today()
AT = datetime.datetime.combine(TODAY, datetime.time(19, 30))
PASS = 'sieben rote fahrräder am fluss'
STORE = "localStorage.getItem('haltung.v1')"

# Erfundener Export im Format von Resonanzraum
EXPORT = {
    'exportiertAm': '2026-11-20T10:00:00.000Z', 'app': 'Resonanzraum',
    'ausgangslage': [{'id': 1, 'slug': 'personen', 'title': 'Personen', 'content': 'Zwei Erwachsene, ein Kind, ein Hund namens Kosmo.', 'sortOrder': 10}],
    'muster': [
        {'id': 1, 'slug': 'kreislauf-a', 'name': 'Kreislauf A', 'kind': 'kern', 'summary': 'Einer löst, die andere fühlt sich nicht gesehen.', 'description': 'Beschreibung A.', 'guideline': 'Erst zuhören.', 'sortOrder': 10},
        {'id': 2, 'slug': 'ironie-test', 'name': 'Ironie als Ventil', 'kind': 'ergaenzend', 'summary': 'Ein Spruch zu viel.', 'description': 'Beschreibung B.', 'guideline': None, 'sortOrder': 20}
    ],
    'eintraege': [
        {'id': 11, 'kind': 'vorfall', 'title': 'Der Picknick-Streit', 'occurredOn': None, 'sequence': 1, 'trigger': 'Regen beim Picknick', 'narrative': 'Es regnete. Ich machte einen Spruch.', 'insight': 'Der Spruch war zu viel.', 'dynamics': 'Lösung traf auf Überforderung.', 'needsSelf': ['Leichtigkeit'], 'needsPartner': ['Gesehen werden'], 'ownPart': 'Ironie.', 'nextStep': 'Erst fragen.', 'analysisStatus': 'fertig', 'source': 'seed', 'createdAt': '2026-10-01T10:00:00.000Z', 'updatedAt': '2026-10-01T10:00:00.000Z'},
        {'id': 12, 'kind': 'gespraech', 'title': 'Küchengespräch', 'occurredOn': '2026-11-10', 'sequence': 0, 'trigger': None, 'narrative': 'Wir haben ruhig geredet.', 'insight': None, 'dynamics': None, 'needsSelf': '["Ruhe"]', 'needsPartner': [], 'ownPart': None, 'nextStep': None, 'analysisStatus': 'keine', 'source': 'manuell', 'createdAt': '2026-11-10T20:00:00.000Z', 'updatedAt': '2026-11-10T20:00:00.000Z'}
    ],
    'eintragMuster': [{'entryId': 11, 'patternId': 1, 'note': 'Picknick-Logistik', 'source': 'seed'}, {'entryId': 11, 'patternId': 2, 'note': None, 'source': 'seed'}],
    'gespraeche': [], 'nachrichten': [],
    'vorbereitungen': [{'id': 1, 'title': 'Über den Urlaub reden', 'situation': 'Urlaubsplanung', 'goal': 'Ein Termin', 'validation': 'Du planst viel allein.', 'woundedPoint': '', 'eyeLevel': '', 'stopSignal': '', 'feedback': None, 'debrief': None, 'status': 'entwurf', 'entryId': 12, 'createdAt': '2026-11-11T10:00:00.000Z', 'updatedAt': '2026-11-11T10:00:00.000Z'}],
    'checkins': [{'id': 1, 'date': (TODAY - datetime.timedelta(days=1)).isoformat(), 'sleepHours': 6.5, 'sleepQuality': 3, 'energy': 3, 'stress': 4, 'meTimeMinutes': 15, 'socialContact': False, 'sportMinutes': 0, 'sportType': None, 'selfCare': None, 'motivations': [], 'motivationType': None, 'ownReason': None, 'note': None}],
    'resets': [{'id': 1, 'variant': 'kurz', 'tensionBefore': 7, 'tensionAfter': 4, 'intention': 'klar', 'parked': ['Mail'], 'completedAt': '2026-11-12T17:40:00.000Z'}]
}
SECRETS = ['Kosmo', 'Picknick', 'Küchengespräch', 'Urlaub', 'Mia', PASS]


async def text(pg, sel):
    return re.sub(r'\s+', ' ', await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{textContent: ''}}).textContent")).strip()


async def taps(pg, n=7):
    el = pg.locator('[data-a="about.tap"]')
    await el.scroll_into_view_if_needed()
    for _ in range(n):
        await el.click(); await pg.wait_for_timeout(40)
    await pg.wait_for_timeout(150)


async def no_secrets(pg, where):
    s = await pg.evaluate(STORE)
    for w in SECRETS:
        assert w not in s, f'{w} steht im Klartext im Speicher ({where})'
    assert '"vault"' in s


async def virtual_authenticator(pg):
    """Virtueller Authenticator mit PRF über CDP; None, wenn Chromium das nicht kann."""
    try:
        cdp = await pg.context.new_cdp_session(pg)
        await cdp.send('WebAuthn.enable')
        r = await cdp.send('WebAuthn.addVirtualAuthenticator', {'options': {'protocol': 'ctap2', 'ctap2Version': 'ctap2_1', 'transport': 'internal', 'hasResidentKey': True, 'hasUserVerification': True, 'isUserVerified': True, 'hasPrf': True, 'automaticPresenceSimulation': True}})
        return r.get('authenticatorId')
    except Exception as e:
        print('Kein virtueller Authenticator mit PRF:', str(e)[:120])
        return None


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); return s.getsockname()[1]


async def main():
    # WebAuthn braucht http://localhost; die Handy-Hälfte läuft wie alle Tests von der Datei
    port = free_port()
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1', '-d', str(DIST)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.6)
    try:
        await run_all(f'http://localhost:{port}/haltung.html')
    finally:
        srv.terminate()


async def run_all(HTTP_URL):
    async with async_playwright() as p:
        for w, h, mobile, dark in ((390, 844, True, False), (1440, 900, False, True)):
            b, ctx, pg, errs = await setup(p, w, h, mobile=mobile, dark=dark)
            await pg.clock.install(time=AT)
            await pg.goto(URL if mobile else HTTP_URL); await pg.wait_for_selector('.fold-head')
            # 1. Nichts zu sehen: kein Reiter, kein Wort
            for hsh in ('#/heute', '#/einstellungen', '#/gesundheit', '#/outfit'):
                await pg.evaluate(f"location.hash = '{hsh}'"); await pg.wait_for_timeout(250)
                body = await pg.evaluate("document.body.innerText")
                assert 'Resonanzraum' not in body and 'Raum einrichten' not in body, hsh
            assert '"vault"' not in (await pg.evaluate(STORE) or '')
            # 2. Sieben Tipps auf die Versionszeile: Einrichten
            await pg.evaluate("location.hash = '#/einstellungen'"); await pg.wait_for_timeout(250)
            await taps(pg, 5)
            assert 'Raum einrichten' not in await pg.evaluate("document.body.innerText"), 'fünf Tipps reichen nicht'
            await pg.wait_for_timeout(4200)  # Zähler verfällt
            await taps(pg, 7)
            await pg.wait_for_selector('#vt-setup')
            assert '#/einstellungen' == await pg.evaluate('location.hash')
            await pg.fill('#vt-setup input[name="p1"]', 'kurz'); await pg.fill('#vt-setup input[name="p2"]', 'kurz'); await pg.click('button[data-a="vt.setup"]'); await pg.wait_for_timeout(200)
            assert 'mindestens 12 Zeichen' in await pg.evaluate("document.body.innerText")
            await pg.fill('#vt-setup input[name="p1"]', PASS); await pg.fill('#vt-setup input[name="p2"]', PASS + 'x'); await pg.click('button[data-a="vt.setup"]'); await pg.wait_for_timeout(200)
            assert 'verschieden' in await pg.evaluate("document.body.innerText")
            await pg.fill('#vt-setup input[name="p2"]', PASS); await pg.fill('#vt-setup input[name="partner"]', 'Mia')
            await pg.click('button[data-a="vt.setup"]'); await pg.wait_for_selector('.vt-tabs', timeout=20000)
            assert (await text(pg, '.vt .page-title')) == 'Resonanzraum'
            assert 'Leitsatz des Tages' in await pg.inner_text('.vt-lead')
            await no_secrets(pg, 'nach dem Einrichten')
            # 3. Import der erfundenen Export-Datei
            await pg.click('.vt-tabs a[data-k="mehr"]'); await pg.wait_for_selector('input[data-c="vt.import"]', state='attached')
            await pg.set_input_files('input[data-c="vt.import"]', {'name': 'export.json', 'mimeType': 'application/json', 'buffer': json.dumps(EXPORT).encode('utf-8')})
            await pg.wait_for_function("document.body.innerText.includes('Eingelesen:')", timeout=10000)
            msg = await text(pg, '.vt .note p')
            assert msg == 'Eingelesen: 1 Abschnitte, 2 Muster, 2 Einträge, 1 Vorbereitungen, 1 Check-ins, 1 Resets.', msg
            await pg.wait_for_timeout(400)
            await no_secrets(pg, 'nach dem Import')
            # 4. Chronik: Liste, Suche, Detail mit Einordnung und Mustern
            await pg.click('.vt-tabs a[data-k="chronik"]'); await pg.wait_for_selector('.vt-list')
            rows = await pg.evaluate("[...document.querySelectorAll('.vt-row strong')].map(e => e.textContent)")
            assert rows == ['Küchengespräch', 'Der Picknick-Streit'], rows
            assert 'Kosmo' in await pg.evaluate("document.querySelector('.vt-sections textarea').value")
            await pg.fill('input[data-i="vt.q"]', 'picknick'); await pg.wait_for_timeout(200)
            assert await pg.locator('.vt-row').count() == 1
            await pg.click('.vt-row'); await pg.wait_for_selector('.vt-entry')
            t = await pg.inner_text('.vt-entry')
            assert 'Der Picknick-Streit' in t and 'Lösung traf auf Überforderung.' in t and 'Bedürfnisse von Mia' in t and 'Kreislauf A: Picknick-Logistik' in t and 'Ironie als Ventil' in t, t
            await pg.screenshot(path=str(SHOT / f"v212_eintrag_{'handy' if mobile else 'pc'}.png"), full_page=True)
            # Neuer Eintrag mit Muster
            await pg.click('button[data-a="vt.back"]'); await pg.click('button[data-a="vt.entry.new"]'); await pg.wait_for_selector('#vt-entry')
            await pg.fill('#vt-entry input[name="title"]', 'Abendessen ohne Streit'); await pg.fill('#vt-entry textarea[name="narrative"]', 'Wir haben gelacht.')
            await pg.click('.seg button[data-a="vt.entry.kind"][data-v="gespraech"]'); await pg.wait_for_timeout(100)
            assert await pg.evaluate("document.querySelector('#vt-entry input[name=title]').value") == 'Abendessen ohne Streit', 'Formwerte bleiben beim Umschalten'
            await pg.click('#vt-entry .chip[data-k]'); await pg.wait_for_timeout(100)
            await pg.click('button[data-a="vt.entry.save"]'); await pg.wait_for_selector('.vt-entry')
            assert 'Abendessen ohne Streit' in await pg.inner_text('.vt-entry') and 'Gespräch' in await pg.inner_text('.vt-entry')
            # 5. Muster mit Matrix
            await pg.click('.vt-tabs a[data-k="muster"]'); await pg.wait_for_selector('.vt-matrix')
            assert await pg.locator('.vt-matrix .vt-dot').count() == 3, 'drei Verknüpfungen'
            assert await pg.locator('.vt-list .vt-row').count() == 2
            await pg.click('.vt-list .vt-row'); await pg.wait_for_selector('.vt-entry')
            assert 'Aufgetaucht in' in await pg.inner_text('.vt-entry') and 'Erst zuhören.' in await pg.inner_text('.vt-entry')
            # 6. Vorbereitung und Entwurf-Check
            await pg.click('.vt-tabs a[data-k="vorbereitung"]'); await pg.wait_for_selector('.vt-list')
            assert 'Über den Urlaub reden' in await pg.inner_text('.vt-list')
            await pg.fill('textarea[data-i="vt.draft"]', 'Ja, aber ich nehme schon wahr, dass du immer so planst.'); await pg.wait_for_timeout(250)
            found = await pg.evaluate("[...document.querySelectorAll('.vt-findings li strong')].map(e => e.textContent)")
            assert found == ['Ja, aber', 'Therapeutensprache', 'Verallgemeinerung'], found
            assert await pg.locator('.vt-marked mark').count() == 3
            await pg.click('.vt-list .vt-row'); await pg.wait_for_selector('#vt-prep')
            assert 'Was ist an Mias Punkt berechtigt?' in await pg.inner_text('#vt-prep')
            await pg.fill('#vt-prep textarea[name="woundedPoint"]', 'Dass ich mich übergangen fühle.')
            await pg.click('.seg button[data-a="vt.prep.status"][data-v="bereit"]'); await pg.wait_for_timeout(200)
            assert await pg.evaluate("document.querySelector('#vt-prep textarea[name=woundedPoint]').value") == 'Dass ich mich übergangen fühle.'
            await pg.click('button[data-a="vt.prep.list"]'); await pg.wait_for_selector('.vt-list')
            assert 'Bereit' in await pg.inner_text('.vt-list .vt-row .tag')
            # 7. Check-in mit Motivations-Check
            await pg.click('.vt-tabs a[data-k="checkin"]'); await pg.wait_for_selector('.vt-trend')
            await pg.fill('input[data-k="sleepHours"]', '7.5'); await pg.press('input[data-k="sleepHours"]', 'Tab'); await pg.wait_for_timeout(150)
            await pg.click('.scale button[data-k="energy"][data-v="4"]'); await pg.wait_for_timeout(100)
            assert await pg.locator('.vt-motiv').count() == 0
            await pg.click('.chip[data-k="sport"][data-v="30"]'); await pg.wait_for_selector('.vt-motiv')
            await pg.click('.chip[data-a="vt.ci.motive"][data-v="friedensangebot"]'); await pg.wait_for_timeout(150)
            t = await pg.inner_text('.vt-motiv')
            assert 'Damit Mia zufrieden ist' in t and 'Selbstoptimierung auf Bewährung' in t and 'wenn Mia es nie erfährt' in t, t
            sel = await pg.evaluate("[...document.querySelectorAll('.vt-trend tr.is-sel td')].map(e => e.textContent)")
            assert sel[1:6] == ['7,5', '4', '', '', '30'] and sel[7] == 'aus Angst', sel
            # 8. Türschwelle: Reset durchlaufen
            await pg.click('.vt-tabs a[data-k="tuer"]'); await pg.wait_for_selector('.vt-tension')
            assert '12.11.' in await pg.inner_text('.vt .tbl'), 'importierter Reset in der Liste'
            await pg.click('.vt-tension button[data-v="6"]'); await pg.click('button[data-a="vt.rt.start"]'); await pg.wait_for_selector('.vt-ritual')
            assert (await text(pg, '.vt-rt-title')) == 'Ankommen'
            await pg.clock.run_for(1200)
            assert (await text(pg, '.vt-rt-cue')) == 'Einatmen …'
            await pg.clock.run_for(4100)
            assert (await text(pg, '.vt-rt-cue')) == 'Langsam ausatmen …'
            await pg.click('.vt-ritual button[data-a="vt.rt.next"]'); await pg.wait_for_timeout(100)
            assert (await text(pg, '.vt-rt-title')) == 'Ablegen'
            await pg.fill('#vt-park', 'Mail vom Amt'); await pg.press('#vt-park', 'Enter'); await pg.wait_for_timeout(100)
            assert 'Mail vom Amt' in await pg.inner_text('.vt-parked')
            await pg.click('.vt-ritual button[data-a="vt.rt.next"]'); await pg.wait_for_timeout(100)
            assert (await text(pg, '.vt-rt-title')) == 'Körper' and 'noch 20 Sekunden' in await text(pg, '.vt-rt-cue')
            await pg.clock.run_for(20500)
            assert (await text(pg, '.vt-rt-cue')) == 'Fertig'
            await pg.click('.vt-ritual button[data-a="vt.rt.next"]'); await pg.wait_for_timeout(100)
            assert (await text(pg, '.vt-rt-title')) == 'Ein Wort für den Abend' and 'für Mia' in await text(pg, '.vt-rt-text')
            await pg.click('.vt-ritual .chip[data-v="ruhig"]'); await pg.click('.vt-ritual button[data-a="vt.rt.next"]'); await pg.wait_for_timeout(100)
            assert (await text(pg, '.vt-rt-title')) == 'Die Tür' and 'ruhig' in await pg.inner_text('.vt-rt-body')
            await pg.clock.run_for(11500)
            assert (await text(pg, '.vt-rt-cue')) == 'Gut.'
            await pg.click('.vt-ritual button[data-a="vt.rt.next"]'); await pg.wait_for_timeout(100)
            assert (await text(pg, '.vt-rt-title')) == 'Und jetzt?'
            await pg.click('.vt-ritual .vt-tension button[data-v="3"]'); await pg.click('button[data-a="vt.rt.finish"]'); await pg.wait_for_timeout(300)
            assert await pg.locator('.vt-ritual').count() == 0
            row = await pg.evaluate("[...document.querySelector('.vt .tbl tbody tr').children].map(e => e.textContent)")
            assert row[1:] == ['6', '3', 'ruhig'], row
            await pg.wait_for_timeout(400)
            await no_secrets(pg, 'nach dem Reset')
            # 9. Schließen, Seitenwechsel, falsche Passphrase, wieder öffnen
            await pg.click('button[data-a="vt.lock"]'); await pg.wait_for_timeout(250)
            assert 'Resonanzraum' not in await pg.evaluate("document.body.innerText") and 'Über diese App' in await pg.evaluate("document.body.innerText"), 'Schließen führt zurück zu den Einstellungen, ohne Spur'
            await pg.evaluate("location.hash = '#/heute'"); await pg.wait_for_selector('.fold-head')
            assert 'Resonanzraum' not in await pg.evaluate("document.body.innerText")
            await pg.evaluate("location.hash = '#/einstellungen'"); await pg.wait_for_timeout(250)
            assert await pg.locator('#vt-unlock').count() == 0 and 'Über diese App' in await pg.evaluate("document.body.innerText")
            await taps(pg, 7); await pg.wait_for_selector('#vt-unlock')
            await pg.fill('#vt-unlock input[name="p"]', 'falsche phrase 1234'); await pg.press('#vt-unlock input[name="p"]', 'Enter')
            await pg.wait_for_function("document.body.innerText.includes('passt nicht')", timeout=20000)
            await pg.fill('#vt-unlock input[name="p"]', PASS); await pg.click('button[data-a="vt.unlock"]'); await pg.wait_for_selector('.vt-tabs', timeout=20000)
            assert '3 Einträge, 2 Muster' in await pg.inner_text('.vt')
            # Offen und dann Seitenwechsel: zu
            await pg.evaluate("location.hash = '#/training'"); await pg.wait_for_timeout(250)
            assert 'Resonanzraum' not in await pg.evaluate("document.body.innerText")
            await pg.evaluate("location.hash = '#/einstellungen'"); await pg.wait_for_timeout(250)
            assert await pg.locator('.vt-tabs').count() == 0
            # 10. Eine Minute im Hintergrund: zu
            await taps(pg, 7); await pg.wait_for_selector('#vt-unlock')
            await pg.fill('#vt-unlock input[name="p"]', PASS); await pg.click('button[data-a="vt.unlock"]'); await pg.wait_for_selector('.vt-tabs', timeout=20000)
            await pg.evaluate("Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
            await pg.clock.run_for(61000); await pg.wait_for_timeout(100)
            await pg.evaluate("Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
            await pg.wait_for_timeout(300)
            assert await pg.locator('.vt-tabs').count() == 0 and await pg.locator('#vt-unlock').count() == 0, 'nach einer Minute zu und weg'
            # 11. Backup enthält nur das Chiffrat
            st = json.loads(await pg.evaluate(STORE))
            assert set(st['vault'].keys()) == {'v', 'id', 'at', 'kdf', 'pass', 'prfEval', 'prf', 'data'} and st['vault']['kdf']['iters'] == 600000
            # 12. Fingerabdruck (PRF) am PC mit virtuellem Authenticator
            if not mobile:
                auth = await virtual_authenticator(pg)
                if auth:
                    await taps(pg, 7); await pg.wait_for_selector('#vt-unlock')
                    assert await pg.locator('button[data-a="vt.prf"]').count() == 0
                    await pg.fill('#vt-unlock input[name="p"]', PASS); await pg.click('button[data-a="vt.unlock"]'); await pg.wait_for_selector('.vt-tabs', timeout=20000)
                    assert 'Unter „Mehr“ kannst du den Fingerabdruck' in await pg.inner_text('.vt')
                    await pg.click('.vt-tabs a[data-k="mehr"]'); await pg.click('button[data-a="vt.prf.on"]')
                    try:
                        await pg.wait_for_function("document.body.innerText.includes('Fingerabdruck eingerichtet') || document.body.innerText.includes('keine PRF')", timeout=15000)
                    except Exception:
                        print('PRF: keine Rückmeldung', (await pg.evaluate("document.body.innerText"))[:300])
                    if 'keine PRF' in await pg.evaluate("document.body.innerText"):
                        print('Virtueller Authenticator ohne PRF-Ergebnis; Passphrase-Weg geprüft.')
                    else:
                        assert 'dieses dabei' in await pg.inner_text('.vt')
                        st = json.loads(await pg.evaluate(STORE)); assert len(st['vault']['prf']) == 1
                        await pg.click('button[data-a="vt.lock"]'); await pg.wait_for_timeout(250); await taps(pg, 7); await pg.wait_for_selector('button[data-a="vt.prf"]')
                        await pg.click('button[data-a="vt.prf"]'); await pg.wait_for_selector('.vt-tabs', timeout=15000)
                        assert '3 Einträge' in await pg.inner_text('.vt')
                        print('PRF-Weg geprüft.')
                    await pg.screenshot(path=str(SHOT / 'v212_mehr_pc.png'), full_page=True)
            assert await pg.evaluate('document.documentElement.scrollWidth') <= w
            await b.close()
            assert not errs, errs
            print(f"Verschlüsselter Raum {'am Handy' if mobile else 'am PC dunkel'} ok")


asyncio.run(main())
