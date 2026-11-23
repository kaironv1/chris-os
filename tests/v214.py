"""Version 2.14. Ein Jahr erfundener Daten (Check-ins, Ernährung, Wetter, Training, Outfits): Datenmenge, Zeit je Seite,
keine Seite ragt am Handy (360 px) seitlich heraus, Training, Verlauf mit Dehnen vom Timer (stürzte vor 2.14 ab).
Speicher: Zeile „Speicher auf diesem Gerät“ mit Belegung, Fotos und Schutz durch den Browser, Hinweis auf Heute ab
85 Prozent, ein bleibender Hinweis mit Backup-Knopf, wenn Speichern scheitert, der verschwindet, sobald es wieder
klappt. Raum: Ein angefangener Eintrag oder ein angefangenes Muster übersteht einen kurzen Wechsel in eine andere App und
jeden Neuaufbau der Ansicht (vorher war das Formular danach leer). Ohne Konsolenfehler."""
import asyncio, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from run import async_playwright, setup, URL

GEN = r"""(() => {
  const D = window.HaltungDebug, S = D.state, E = D.E, F = window.Food, t = E.today();
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const MEALS = { frueh: ['2 Eier, Brot mit Käse, Kaffee mit Milch', '250 g Skyr mit Beeren und Haferflocken', 'Müsli mit Milch, Banane', 'Brötchen mit Butter und Marmelade, Kaffee'],
    mittag: ['Hähnchenbrust mit Reis und Brokkoli', 'Spaghetti Bolognese', 'Currywurst mit Pommes', 'Salat mit Hähnchen', 'Döner', 'Linsensuppe mit Brot'],
    snack: ['Apfel', 'Proteinriegel', 'Handvoll Nüsse', 'Joghurt', 'Banane', '2 Reiswaffeln mit Erdnussbutter'],
    abend: ['Lachs mit Kartoffeln und Spinat', 'Pizza', 'Brot mit Frischkäse und Tomate', 'Chili con Carne', 'Omelett mit Gemüse', 'Nudeln mit Tomatensoße', 'Bier'] };
  const TIMES = { frueh: '07:30', mittag: '12:45', snack: '16:00', abend: '19:30' };
  const items = S.wardrobe.items.map(i => i.id), exIds = Object.keys(S.training.exercises).slice(0, 6);
  S.nutrition.log = {}; S.health.days = {}; S.env.days = {};
  for (let i = 365; i >= 0; i--) {
    const d = E.addDays(t, -i), sick = (i % 41) < 4;
    S.health.days[d] = { sleepH: 6 + Math.round(rnd() * 6) / 2, sleepQ: 2 + Math.floor(rnd() * 4), energy: 2 + Math.floor(rnd() * 4), stress: 1 + Math.floor(rnd() * 5), mood: 2 + Math.floor(rnd() * 4),
      sym: sick ? { hals_kratzen: 1 + (i % 2), nase_lauf: 1 } : (rnd() < 0.15 ? { kopf: 1 } : {}), meas: sick ? ['tee'] : [], f: { kaffee: Math.floor(rnd() * 4), wasser: 2, umfeld: (i % 41) === 5 },
      breath: Math.floor(rnd() * 3), note: rnd() < 0.1 ? 'Notiz zum Tag ' + i : '', t: Date.now() };
    const log = [];
    for (const slot of ['frueh', 'mittag', 'snack', 'abend']) {
      if (slot === 'snack' && rnd() < 0.4) continue;
      F.parse(pick(MEALS[slot]), {}).items.forEach(x => log.push(Object.assign({}, x, { id: 'n' + i + slot + log.length, slot, time: TIMES[slot] })));
    }
    S.nutrition.log[d] = log;
    S.env.days[d] = { tn: 2 + Math.round(rnd() * 80) / 10, tx: 8 + Math.round(rnd() * 120) / 10, tm: 6 + Math.round(rnd() * 90) / 10, p: 1005 + Math.round(rnd() * 200) / 10, r: Math.round(rnd() * 50) / 10, fw: 1,
      aq: 15 + Math.floor(rnd() * 40), pol: { er: Math.round(rnd() * 300) / 10, bi: Math.round(rnd() * 300) / 10, gr: Math.round(rnd() * 600) / 10, bf: 0, am: 0 }, fa: 1 };
    S.wardrobe.wear.push({ date: d, items: [pick(items), pick(items), pick(items)], key: 'k' + i, occasion: 'smart' });
    if (i % 7 === 1 || i % 7 === 4) S.training.sessions.push({ id: 's' + i, date: d, plan: 'A', name: 'Ganzkörper A', entries: exIds.map(ex => ({ ex, sets: [1, 2, 3].map(() => ({ kg: 20 + Math.round(rnd() * 40), reps: 8 + Math.floor(rnd() * 5), done: true })) })) });
    if (i % 7 === 6) S.training.runs.push({ id: 'r' + i, date: d, min: 30, km: 5, feel: 'gut' });
    // Dehnen mit dem Timer (Morgens oder Abends) trägt 'dehnen' ein, ohne eigene Routine
    if (i % 7 === 2) S.training.routineLog.push({ date: d, id: 'dehnen', kind: 'abend', min: 10 });
  }
  localStorage.setItem('haltung.v1', JSON.stringify(S)); D.render();
  return { days: Object.keys(S.health.days).length, kb: Math.round(localStorage.getItem('haltung.v1').length / 1024) };
})()"""

# Seitliches Herausragen: Breite des Dokuments oder des Layout-Viewports über der Gerätebreite. Elemente in einem
# Container, der selbst seitlich scrollt (Tabellen, Reiter), zählen nicht.
OVER = r"""((W) => {
  const doc = document.documentElement, bad = [];
  const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true; } return false; };
  if (doc.scrollWidth > W + 1 || window.innerWidth > W + 1)
    document.querySelectorAll('#view *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > W + 1 && !inScroller(el)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className.baseVal != null ? el.className.baseVal : el.className).split(' ').join('.') + ' ' + Math.round(r.right)); });
  return { sw: doc.scrollWidth, iw: window.innerWidth, bad: bad.slice(0, 6) };
})"""

ROUTES = ['#/heute', '#/training', '#/training/zuhause', '#/training/verlauf', '#/training/fortschritt', '#/training/ernaehrung',
          '#/gesundheit', '#/gesundheit/verlauf', '#/gesundheit/muster', '#/gesundheit/experimente', '#/gesundheit/aerzte',
          '#/gesundheit/medikamente', '#/gesundheit/bericht', '#/pflege', '#/pflege/einkauf', '#/outfit', '#/outfit/schrank',
          '#/outfit/listen', '#/outfit/analyse', '#/outfit/inspiration', '#/outfit/reisen', '#/einstellungen']

STUB = "Object.defineProperty(navigator, 'storage', { configurable: true, value: { persisted: async () => %s, persist: async () => %s } });"
FAIL_ON = """(() => { window.__set = window.__set || Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (k === 'haltung.v1') throw new DOMException('voll', 'QuotaExceededError'); return window.__set.call(this, k, v); }; })()"""
FAIL_OFF = "(() => { if (window.__set) Storage.prototype.setItem = window.__set; })()"


async def text(pg, sel):
    return re.sub(r'\s+', ' ', await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{textContent: ''}}).textContent")).strip()


async def toast(pg):
    return await pg.evaluate("(() => { const t = document.getElementById('toast'); return t.classList.contains('hidden') ? '' : t.textContent.replace(/\\s+/g, ' ').trim(); })()")


async def year(p):
    b, ctx, pg, errs = await setup(p, w=360, h=760, mobile=True)
    await pg.goto(URL); await pg.wait_for_timeout(900)
    info = await pg.evaluate(GEN)
    assert info['days'] == 366, info
    # Ein Jahr sind rund 1 MB, weit unter den etwa 5 MB, die der Browser für Einträge hergibt
    assert 500 < info['kb'] < 2048, info
    t0 = await pg.evaluate("(() => { const t0 = performance.now(); localStorage.setItem('haltung.v1', JSON.stringify(window.HaltungDebug.state)); return performance.now() - t0; })()")
    assert t0 < 400, t0
    slow, wide = [], []
    for r in ROUTES:
        ms = await pg.evaluate(f"(() => {{ location.hash = '{r}'; const t0 = performance.now(); window.HaltungDebug.render(); return Math.round(performance.now() - t0); }})()")
        await pg.wait_for_timeout(120)
        o = await pg.evaluate(OVER, 360)
        if ms > 1500:
            slow.append((r, ms))
        if o['bad'] or o['iw'] > 361 or o['sw'] > 361:
            wide.append((r, o))
    assert not slow, slow
    assert not wide, wide
    # Training, Verlauf: Dehnen vom Timer steht mit Minuten da
    await pg.evaluate("location.hash = '#/training/verlauf'"); await pg.wait_for_timeout(200)
    v = await text(pg, '#view')
    assert re.search(r'Dehnen.{0,40}, 10 Min\.', v), v[:400]
    assert 'Laufen' in v and 'Ganzkörper A' in v, v[:300]
    # Muster: der lange Knopf bricht um, statt herauszuragen
    await pg.evaluate("location.hash = '#/gesundheit/muster'"); await pg.wait_for_timeout(200)
    btn = pg.locator('button', has_text='Bettzeit-Erinnerung')
    if await btn.count():
        bb = await btn.first.bounding_box()
        assert bb['x'] + bb['width'] <= 360, bb
    assert not errs, errs
    print('Jahr: %d Tage, %d KB, alle %d Seiten unter 1,5 s und ohne seitliches Herausragen bei 360 px.' % (info['days'], info['kb'], len(ROUTES)))
    await b.close()


async def storage(p):
    # Belegung, Fotos, Schutz durch den Browser (persist gewährt)
    b, ctx, pg, errs = await setup(p, w=412, h=860, mobile=True)
    await ctx.add_init_script(STUB % ('false', 'true'))
    await pg.goto(URL); await pg.wait_for_timeout(700)
    await pg.evaluate("""new Promise(res => { const r = indexedDB.open('haltung-fotos', 1); r.onupgradeneeded = () => r.result.createObjectStore('p');
      r.onsuccess = () => { const t = r.result.transaction('p', 'readwrite'); t.objectStore('p').put(new Blob([new Uint8Array(150 * 1024)], { type: 'image/jpeg' }), 'probe'); t.oncomplete = () => { r.result.close(); res(); }; }; })""")
    await pg.goto(URL + '#/einstellungen'); await pg.reload(); await pg.wait_for_timeout(900)
    row = await text(pg, '[data-row="storage"]')
    assert row.startswith('Speicher auf diesem Gerät'), row
    m = re.search(r'Einträge (\d+) KB von etwa 5 MB \((\d+) %\), Fotos (\d+) KB\.', row)
    assert m and 60 < int(m.group(1)) < 400 and int(m.group(2)) <= 8 and int(m.group(3)) == 150, row
    assert 'Der Browser hält die Daten fest' in row and 'Fast voll' not in row, row
    # Fast voll: Hinweis auf Heute vor allen anderen, Satz in den Einstellungen
    await pg.evaluate("localStorage.setItem('test.fuellung', 'x'.repeat(4500000))")
    await pg.goto(URL + '#/heute'); await pg.reload(); await pg.wait_for_timeout(700)
    note = await text(pg, '[data-note="storage"]')
    m = re.search(r'zu (\d+) % voll', note)
    assert m and 85 <= int(m.group(1)) <= 95 and 'Backup speichern' in note, note
    await pg.goto(URL + '#/einstellungen'); await pg.wait_for_timeout(700)
    assert 'Fast voll: Speichere ein Backup.' in await text(pg, '[data-row="storage"]')
    await pg.evaluate("localStorage.removeItem('test.fuellung')")
    await pg.goto(URL + '#/heute'); await pg.reload(); await pg.wait_for_timeout(500)
    assert await pg.locator('[data-note="storage"]').count() == 0
    # Speichern scheitert: Hinweis bleibt stehen, Backup aus dem Speicher der Seite, verschwindet, sobald es klappt
    await pg.goto(URL + '#/einstellungen'); await pg.wait_for_timeout(600)
    before = await pg.evaluate("window.HaltungDebug.state.settings.coldSensitive")
    await pg.evaluate(FAIL_ON)
    await pg.click('label.toggle:has([data-c="cold"])'); await pg.wait_for_timeout(300)
    msg = await toast(pg)
    assert msg.startswith('Speichern fehlgeschlagen.') and msg.endswith('Backup speichern'), msg
    await pg.wait_for_timeout(4200)
    assert (await toast(pg)).startswith('Speichern fehlgeschlagen.'), 'Hinweis verschwand von selbst'
    async with pg.expect_download() as dl:
        await pg.click('#toast [data-a="toast.act"]')
    d = await dl.value
    assert d.suggested_filename.startswith('chris-os-backup-'), d.suggested_filename
    data = json.loads(pathlib.Path(await d.path()).read_text(encoding='utf-8'))
    assert data['state']['settings']['coldSensitive'] == (not before), 'Backup enthält die Änderung aus dem Speicher der Seite'
    assert json.loads(await pg.evaluate("localStorage.getItem('haltung.v1')"))['settings']['coldSensitive'] == before
    await pg.click('label.toggle:has([data-c="cold"])'); await pg.wait_for_timeout(300)
    assert (await toast(pg)).startswith('Speichern fehlgeschlagen.')
    await pg.evaluate(FAIL_OFF)
    await pg.click('label.toggle:has([data-c="cold"])'); await pg.wait_for_timeout(300)
    assert await toast(pg) == '', await toast(pg)
    assert json.loads(await pg.evaluate("localStorage.getItem('haltung.v1')"))['settings']['coldSensitive'] == (not before)
    assert not errs, errs
    await b.close()
    # Browser darf löschen (persist abgelehnt), PC dunkel
    b, ctx, pg, errs = await setup(p, dark=True)
    await ctx.add_init_script(STUB % ('false', 'false'))
    await pg.goto(URL + '#/einstellungen'); await pg.wait_for_timeout(900)
    row = await text(pg, '[data-row="storage"]')
    assert 'darf der Browser die Daten löschen' in row and 'Fotos' not in row, row
    assert not errs, errs
    await b.close()
    print('Speicher: Belegung, Fotos, Schutz, Hinweis ab 85 % und Hinweis bei Speicherfehler geprüft.')


PASS = 'neun gelbe drachen im wind'
VIS = "Object.defineProperty(document, 'hidden', { configurable: true, get: () => %s }); document.dispatchEvent(new Event('visibilitychange'))"


async def room(p):
    b, ctx, pg, errs = await setup(p, w=390, h=844, mobile=True)
    await pg.goto(URL + '#/einstellungen'); await pg.wait_for_timeout(800)
    el = pg.locator('[data-a="about.tap"]'); await el.scroll_into_view_if_needed()
    for _ in range(7):
        await el.click(); await pg.wait_for_timeout(40)
    await pg.wait_for_selector('#vt-setup')
    await pg.fill('#vt-setup input[name="p1"]', PASS); await pg.fill('#vt-setup input[name="p2"]', PASS)
    await pg.click('button[data-a="vt.setup"]'); await pg.wait_for_selector('.vt-tabs', timeout=20000)
    # Eintrag schreiben, kurz in eine andere App, zurück: alles steht noch da, der Raum ist offen
    await pg.click('.vt-tabs a[data-k="chronik"]'); await pg.wait_for_timeout(200)
    await pg.click('button[data-a="vt.entry.new"]'); await pg.wait_for_selector('#vt-entry')
    await pg.fill('#vt-entry [name="title"]', 'Ein Abend mit Umweg')
    await pg.fill('#vt-entry [name="narrative"]', 'Erst lief es gut, dann kam der Satz zu viel.')
    await pg.evaluate(VIS % 'true'); await pg.wait_for_timeout(400)
    await pg.evaluate(VIS % 'false'); await pg.wait_for_timeout(400)
    vals = await pg.evaluate("['title', 'narrative'].map(k => (document.querySelector('#vt-entry [name=' + k + ']') || {}).value)")
    assert vals == ['Ein Abend mit Umweg', 'Erst lief es gut, dann kam der Satz zu viel.'], vals
    # Neuaufbau von außen (wie nach dem Wetter oder einer neuen Version): der Text bleibt
    await pg.fill('#vt-entry [name="insight"]', 'Pause hilft.')
    await pg.evaluate("window.HaltungDebug.render()"); await pg.wait_for_timeout(200)
    vals = await pg.evaluate("['title', 'insight'].map(k => (document.querySelector('#vt-entry [name=' + k + ']') || {}).value)")
    assert vals == ['Ein Abend mit Umweg', 'Pause hilft.'], vals
    await pg.click('button[data-a="vt.entry.save"]'); await pg.wait_for_timeout(400)
    assert 'Ein Abend mit Umweg' in await text(pg, '#view')
    # Muster: dasselbe
    await pg.click('.vt-tabs a[data-k="muster"]'); await pg.wait_for_timeout(200)
    await pg.click('button[data-a="vt.pattern.new"]'); await pg.wait_for_selector('#vt-pattern')
    await pg.fill('#vt-pattern [name="name"]', 'Umweg-Muster'); await pg.fill('#vt-pattern [name="description"]', 'Wenn es eng wird, ein Spruch.')
    await pg.evaluate("window.HaltungDebug.render()"); await pg.wait_for_timeout(200)
    vals = await pg.evaluate("['name', 'description'].map(k => (document.querySelector('#vt-pattern [name=' + k + ']') || {}).value)")
    assert vals == ['Umweg-Muster', 'Wenn es eng wird, ein Spruch.'], vals
    # Nichts davon steht im Klartext im Speicher
    raw = await pg.evaluate("localStorage.getItem('haltung.v1')")
    assert 'Umweg' not in raw and 'Pause hilft' not in raw and PASS not in raw
    assert not errs, errs
    print('Raum: Eintrag und Muster überstehen App-Wechsel und Neuaufbau.')
    await b.close()


async def main():
    async with async_playwright() as p:
        await year(p)
        await storage(p)
        await room(p)
    print('v214: alles in Ordnung')

asyncio.run(main())
