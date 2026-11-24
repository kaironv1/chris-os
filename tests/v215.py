"""Version 2.15. Dialoge am Handy (360 px): jeder Dialog passt in die Breite, nichts ragt über den Rand, nichts scrollt
seitlich (vorher schob die Ortssuche ihren Knopf aus dem Dialog). Eigene Lebensmittel: Beim Bearbeiten stehen Werte mit
Nachkommastelle und große Werte richtig in den Feldern, und Speichern lässt sie unverändert (vorher standen „17,5“ oder
„1.155“ im Zahlenfeld, das Feld blieb leer oder zeigte 1,155, und Speichern machte daraus 0). Raum bei 360 px: Tor,
alle Reiter, Detailansichten, Formulare, Entwurf-Check und Türschwellen-Overlay passen in die Breite. Gesprächsvorbereitung:
Angefangenes übersteht App-Wechsel und Neuaufbau, ein Reiterwechsel speichert es wie „Zurück“, Schließen und Seitenwechsel
ebenfalls; ein Neuaufbau ohne Änderung zählt nicht als geändert. Nichts im Klartext gespeichert, ohne Konsolenfehler."""
import asyncio, datetime, json, pathlib, re, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from run import async_playwright, setup, URL

TODAY = datetime.date.today()
W = 360

# Daten für die Dialoge: Ernährung heute, zwei eigene Lebensmittel (Werte je 100 g; je Portion mit Nachkommastelle bzw.
# über 1000 kcal), ein kommender und ein vergangener Termin, ein Medikament, eine Reise, Outfit als Teile-Liste
PREP = r"""(() => {
  const D = window.HaltungDebug, S = D.state, E = D.E, t = E.today(), F = window.Food;
  S.nutrition.log[t] = F.parse('2 Eier, Brot mit Käse, Kaffee mit Milch', {}).items.map((x, i) => Object.assign({}, x, { id: 'n' + i, slot: 'frueh', time: '07:30' }));
  S.nutrition.foods = [{ id: 'f1', name: 'Haferriegel Test', alias: '', dp: 45, kcal: 383, p: 22, c: 38.9, f: 12.4, fib: 5.1 },
    { id: 'f2', name: 'Familienpizza Test', alias: '', dp: 350, kcal: 330, p: 12.5, c: 36, f: 14, fib: 2.2 }];
  S.health.appts.push({ id: 'a1', doc: S.health.doctors[0].id, date: E.addDays(t, 3), time: '09:30', reason: 'Kontrolle mit einem ziemlich langen Grund für den Termin' });
  S.health.appts.push({ id: 'a0', doc: S.health.doctors[0].id, date: E.addDays(t, -20), time: '10:00', reason: 'Check-up' });
  S.health.meds.push({ id: 'm1', name: 'Testmittel', dose: '1 Tablette', times: ['08:00', '20:00'], start: E.addDays(t, -2), end: E.addDays(t, 5), note: '', by: '' });
  S.trips = [{ id: 't1', name: 'Städtetrip', loc: { name: 'Musterstadt', lat: 50.2, lon: 8.6 }, kind: 'privat', from: E.addDays(t, 10), to: E.addDays(t, 13), occ: {}, wx: null, packed: {}, extra: [], created: Date.now() }];
  S.health.exps = [];
  S.settings.outfitView = 'teile';
  S.wardrobe.wear = S.wardrobe.wear.filter(w => w.date !== t);
  localStorage.setItem('haltung.v1', JSON.stringify(S));
})()"""
EXP = r"""(() => {
  const D = window.HaltungDebug, S = D.state, E = D.E, t = E.today();
  S.health.exps = [window.Exp.create({ tpl: 'kaffee', days: 14, start: 'heute' }, S.health.profile, E.addDays(t, -6), 'x1')];
  localStorage.setItem('haltung.v1', JSON.stringify(S));
})()"""

# Ragt im offenen Dialog etwas über den Inhaltsbereich (Innenabstand eingerechnet), über den Bildschirm, oder scrollt
# der Dialog seitlich? Elemente in einem eigenen seitlichen Scroller und unsichtbare (clip) zählen nicht.
DLG = r"""((W) => {
  const d = document.getElementById('dlg'); if (!d || !d.open) return { open: false };
  const R = d.getBoundingClientRect(), inner = d.querySelector('.sheet-inner'), cs = getComputedStyle(inner), bad = [];
  const L = R.left + parseFloat(cs.paddingLeft), Rr = R.right - parseFloat(cs.paddingRight);
  const skip = el => { for (let p = el; p && p !== inner; p = p.parentElement) { const c = getComputedStyle(p); if (c.position === 'absolute' && c.clip !== 'auto') return true; if (p !== el && /auto|scroll|hidden|clip/.test(c.overflowX)) return true; } return false; };
  inner.querySelectorAll('*').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.right > Rr + 1 || r.left < L - 1) && !skip(el)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className).slice(0, 24) + ' ' + Math.round(r.left) + '-' + Math.round(r.right)); });
  return { open: true, title: ((d.querySelector('.sheet-title') || {}).textContent || '').trim(), left: R.left, right: R.right, sw: inner.scrollWidth, cw: inner.clientWidth, doc: document.documentElement.scrollWidth, bad: bad.slice(0, 6) };
})"""

# Seiten und der Raum: nichts im Inhalt (oder im Overlay der Türschwelle) ragt über die Gerätebreite
OVER = r"""((W) => {
  const doc = document.documentElement, bad = [];
  const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (/auto|scroll|hidden|clip/.test(ox)) return true; } return false; };
  document.querySelectorAll('#view *, .vt-ritual *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1) && !inScroller(el)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className).slice(0, 24) + ' ' + Math.round(r.left) + '-' + Math.round(r.right)); });
  return { sw: doc.scrollWidth, iw: window.innerWidth, bad: bad.slice(0, 6) };
})"""

STEPS = [
    ('#/training', 'ex.edit'), ('#/training', 'run.open'), ('#/training', 'routine.open'), ('#/training/fortschritt', 'weight.open'),
    ('#/training/ernaehrung', 'nf.edit'), ('#/training/ernaehrung', 'nf.newFood'), ('#/training/ernaehrung', 'nf.editFood'),
    ('#/training/ernaehrung', 'nf.mealSave'), ('#/training/ernaehrung', 'protein.edit'),
    ('#/outfit', 'o.choose'), ('#/outfit/reisen', 'trip.new'), ('#/outfit/reisen', 'trip.edit'),
    ('#/gesundheit/experimente', 'exp.new'), ('#/gesundheit/experimente', 'exp.day'),
    ('#/gesundheit', 'hc.custom'), ('#/gesundheit', 'hc.measadd'), ('#/gesundheit', 'obs.new'),
    ('#/gesundheit/aerzte', 'appt.new'), ('#/gesundheit/aerzte', 'appt.edit'), ('#/gesundheit/aerzte', 'appt.note'),
    ('#/gesundheit/aerzte', 'doc.new'), ('#/gesundheit/aerzte', 'doc.edit'), ('#/gesundheit/aerzte', 'q.new'),
    ('#/gesundheit/medikamente', 'med.new'), ('#/gesundheit/medikamente', 'med.edit'),
    ('#/pflege', 'care.icsOpen'), ('#/pflege', 'care.new'), ('#/pflege', 'routine.editOpen'),
    ('#/outfit/schrank', 'item.new'), ('#/outfit/schrank', 'item.edit'), ('#/outfit/schrank', 'import.open'), ('#/outfit/schrank', 'photos.bulk'),
    ('#/einstellungen', 'loc.open'),
]


async def text(pg, sel):
    return re.sub(r'\s+', ' ', await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || {{textContent: ''}}).textContent")).strip()


async def close_dlg(pg):
    await pg.evaluate("(() => { const d = document.getElementById('dlg'); if (d.open) d.close(); })()")
    await pg.wait_for_timeout(80)


async def open_dlg(pg, route, action):
    await pg.evaluate(f"location.hash = '{route}'"); await pg.wait_for_timeout(250)
    if action == 'trip.edit':  # Bearbeiten steht im Detail der Reise
        await pg.locator('[data-a="trip.open"]').first.click(); await pg.wait_for_timeout(250)
    loc = pg.locator(f'[data-a="{action}"]')
    assert await loc.count(), f'kein Auslöser für {action} unter {route}'
    # Auslöser in zugeklappten Bereichen (etwa „Nur Eiweiß schätzen“) erst aufklappen
    await pg.evaluate(f"(() => {{ for (let d = document.querySelector('[data-a=\"{action}\"]').closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) d.open = true; }})()")
    await loc.first.scroll_into_view_if_needed(); await loc.first.click(); await pg.wait_for_timeout(300)
    o = await pg.evaluate(DLG, W)
    assert o['open'], f'{action}: Dialog ging nicht auf'
    return o


async def dialogs(p):
    b, ctx, pg, errs = await setup(p, w=W, h=760, mobile=True)
    await pg.goto(URL); await pg.wait_for_timeout(800)
    await pg.evaluate(PREP); await pg.reload(); await pg.wait_for_timeout(900)
    wide = []
    for i, (route, action) in enumerate(STEPS):
        if action == 'exp.day':  # erst die Vorlagen ohne Experiment, dann ein laufendes für den Tages-Dialog
            await pg.evaluate(EXP); await pg.reload(); await pg.wait_for_timeout(800)
        o = await open_dlg(pg, route, action)
        if o['bad'] or o['sw'] > o['cw'] + 1 or o['right'] > W + 0.5 or o['left'] < -0.5 or o['doc'] > W + 1:
            wide.append((action, o))
        await close_dlg(pg)
    assert not wide, wide
    # Unteransichten, die man erst per Tipp erreicht: Reise-Detail (vorher ragte „Hinzufügen“ der Packliste heraus),
    # Dehnen-Player, laufendes Heimtraining
    await pg.evaluate("(() => { const S = window.HaltungDebug.state; S.trips[0].extra = ['Ein ziemlich langer eigener Punkt für die Packliste']; localStorage.setItem('haltung.v1', JSON.stringify(S)); })()")
    await pg.evaluate("location.hash = '#/outfit/reisen'"); await pg.reload(); await pg.wait_for_timeout(700)
    await pg.locator('[data-a="trip.open"]').first.click(); await pg.wait_for_timeout(400)
    sub = [('Reise-Detail', await pg.evaluate(OVER, W))]
    add = await pg.locator('#trip-add').bounding_box()
    assert add and add['width'] > 120, add
    await pg.evaluate("location.hash = '#/training'"); await pg.wait_for_timeout(300)
    await pg.locator('[data-a="pl.preset"]').first.click(); await pg.wait_for_timeout(400)
    sub.append(('Dehnen-Player', await pg.evaluate(OVER, W)))
    await pg.locator('[data-a="pl.stop"]').first.click(); await pg.wait_for_timeout(300)
    await pg.evaluate("location.hash = '#/training/zuhause'"); await pg.wait_for_timeout(300)
    await pg.locator('[data-a="home.start"]').first.click(); await pg.wait_for_timeout(400)
    sub.append(('Heimtraining', await pg.evaluate(OVER, W)))
    sub = [x for x in sub if x[1]['bad'] or x[1]['sw'] > W + 1 or x[1]['iw'] > W + 1]
    assert not sub, sub
    # Ortssuche: Feld und Knopf nebeneinander im Dialog
    await open_dlg(pg, '#/einstellungen', 'loc.open')
    q, btn = await pg.locator('#loc-q').bounding_box(), await pg.locator('[data-a="loc.search"]').bounding_box()
    dl = await pg.locator('#dlg').bounding_box()
    assert btn['x'] + btn['width'] <= dl['x'] + dl['width'] - 20 and q['width'] > 120 and abs(q['y'] - btn['y']) < 30, (q, btn, dl)
    await close_dlg(pg)
    # Eigenes Lebensmittel bearbeiten: Werte je Portion mit Punkt, Speichern ändert nichts außer dem Bearbeiteten
    o = await open_dlg(pg, '#/training/ernaehrung', 'nf.editFood')
    vals = await pg.evaluate("['dp', 'kcal', 'p', 'c', 'f', 'fib'].map(k => document.querySelector('#fd-form [name=' + k + ']').value)")
    assert vals == ['45', '172.4', '9.9', '17.5', '5.6', '2.3'], vals
    await pg.fill('#fd-form [name="alias"]', 'Riegel')
    await pg.click('[data-a="nf.saveFood"]'); await pg.wait_for_timeout(300)
    f1 = await pg.evaluate("window.HaltungDebug.state.nutrition.foods.find(x => x.id === 'f1')")
    assert (f1['alias'], f1['kcal'], f1['p'], f1['c'], f1['f'], f1['fib'], f1['dp']) == ('Riegel', 383, 22, 38.9, 12.4, 5.1, 45), f1
    # Über 1000 kcal je Portion: vorher „1.155“, also 1,155 kcal, nach dem Speichern 0
    await pg.evaluate("location.hash = '#/training/ernaehrung'"); await pg.wait_for_timeout(250)
    await pg.locator('[data-a="nf.editFood"][data-id="f2"]').first.click(); await pg.wait_for_timeout(300)
    vals = await pg.evaluate("['dp', 'kcal', 'p', 'c', 'f', 'fib'].map(k => document.querySelector('#fd-form [name=' + k + ']').value)")
    assert vals == ['350', '1155', '43.8', '126', '49', '7.7'], vals
    await pg.click('[data-a="nf.saveFood"]'); await pg.wait_for_timeout(300)
    f2 = await pg.evaluate("window.HaltungDebug.state.nutrition.foods.find(x => x.id === 'f2')")
    assert (f2['kcal'], f2['p'], f2['c'], f2['f'], f2['fib']) == (330, 12.5, 36, 14, 2.2), f2
    # Werte je 100 g eingeben geht weiter
    o = await open_dlg(pg, '#/training/ernaehrung', 'nf.newFood')
    await pg.fill('#fd-form [name="name"]', 'Linsenchips Test'); await pg.fill('#fd-form [name="dp"]', '30')
    await pg.click('#dlg .seg button[data-v="100"]')
    for k, v in (('kcal', '440'), ('p', '24.5'), ('c', '52'), ('f', '13'), ('fib', '9.5')):
        await pg.fill(f'#fd-form [name="{k}"]', v)
    await pg.click('[data-a="nf.saveFood"]'); await pg.wait_for_timeout(300)
    f3 = await pg.evaluate("window.HaltungDebug.state.nutrition.foods.find(x => x.name === 'Linsenchips Test')")
    assert (f3['kcal'], f3['p'], f3['c'], f3['f'], f3['fib'], f3['dp']) == (440, 24.5, 52, 13, 9.5, 30), f3
    assert not errs, errs
    print('Dialoge: %d bei %d px ohne seitliches Herausragen; eigene Lebensmittel behalten ihre Werte beim Bearbeiten.' % (len(STEPS), W))
    await b.close()


PASS = 'acht blaue kraniche im nebel'
VIS = "Object.defineProperty(document, 'hidden', { configurable: true, get: () => %s }); document.dispatchEvent(new Event('visibilitychange'))"
D1, D2 = (TODAY - datetime.timedelta(days=1)).isoformat(), (TODAY - datetime.timedelta(days=2)).isoformat()
# Erfundener Export im Format von Resonanzraum, mit langen Wörtern und Titeln für die Breite
EXPORT = {
    'exportiertAm': '2026-11-21T09:00:00.000Z', 'app': 'Resonanzraum',
    'ausgangslage': [{'id': 1, 'slug': 'rahmen', 'title': 'Rahmen', 'content': 'Zwei Erwachsene, zwei Katzen, eine Wohnung mit Balkon. Donnerstags ist Chorprobe.', 'sortOrder': 10},
                     {'id': 2, 'slug': 'themen', 'title': 'Wiederkehrende Themen', 'content': 'Haushaltsorganisationsabsprachen und Wochenendplanungsfragen.', 'sortOrder': 20}],
    'muster': [
        {'id': 1, 'slug': 'rueckzug', 'name': 'Rückzug nach Kritik', 'kind': 'kern', 'summary': 'Einer zieht sich zurück, der andere wird lauter.', 'description': 'Beschreibung eins.', 'guideline': 'Kurz benennen, dann bleiben.', 'sortOrder': 10},
        {'id': 2, 'slug': 'planung', 'name': 'Planungsübernahme', 'kind': 'ergaenzend', 'summary': 'Alles wird vorab geregelt.', 'description': 'Beschreibung zwei.', 'guideline': None, 'sortOrder': 20},
        {'id': 3, 'slug': 'scherz', 'name': 'Scherz als Notausgang', 'kind': 'eigen', 'summary': 'Ein Witz an der falschen Stelle.', 'description': 'Beschreibung drei.', 'guideline': None, 'sortOrder': 30}
    ],
    'eintraege': [
        {'id': 21, 'kind': 'konflikt', 'title': 'Der Einkaufszettel-Zwischenfall am Samstagvormittag', 'occurredOn': '2026-11-01', 'sequence': 0, 'trigger': 'Vergessene Milch',
         'narrative': 'Ein langer Text über den Einkauf. ' * 6, 'insight': 'Vorher fragen.', 'dynamics': 'Planung traf auf Müdigkeit.', 'needsSelf': ['Ruhe'], 'needsPartner': ['Verlässlichkeit'],
         'ownPart': 'Ungeduld.', 'nextStep': 'Liste teilen.', 'analysisStatus': 'fertig', 'source': 'seed', 'createdAt': '2026-11-01T10:00:00.000Z', 'updatedAt': '2026-11-01T10:00:00.000Z'},
        {'id': 22, 'kind': 'gespraech', 'title': 'Balkongespräch', 'occurredOn': '2026-11-05', 'sequence': 0, 'trigger': None, 'narrative': 'Ruhig geredet.', 'insight': None, 'dynamics': None,
         'needsSelf': [], 'needsPartner': [], 'ownPart': None, 'nextStep': None, 'analysisStatus': 'keine', 'source': 'manuell', 'createdAt': '2026-11-05T20:00:00.000Z', 'updatedAt': '2026-11-05T20:00:00.000Z'},
        {'id': 23, 'kind': 'reflexion', 'title': 'Nachgedacht', 'occurredOn': None, 'sequence': 3, 'trigger': None, 'narrative': 'Kurz notiert.', 'insight': 'Mehr Pausen.', 'dynamics': None,
         'needsSelf': [], 'needsPartner': [], 'ownPart': None, 'nextStep': None, 'analysisStatus': 'keine', 'source': 'manuell', 'createdAt': '2026-11-06T20:00:00.000Z', 'updatedAt': '2026-11-06T20:00:00.000Z'},
        {'id': 24, 'kind': 'vorfall', 'title': 'Chorabend', 'occurredOn': '2026-11-13', 'sequence': 0, 'trigger': 'Spät nach Hause', 'narrative': 'Es wurde spät.', 'insight': None, 'dynamics': None,
         'needsSelf': [], 'needsPartner': [], 'ownPart': None, 'nextStep': None, 'analysisStatus': 'keine', 'source': 'manuell', 'createdAt': '2026-11-13T22:00:00.000Z', 'updatedAt': '2026-11-13T22:00:00.000Z'}
    ],
    'eintragMuster': [{'entryId': 21, 'patternId': 1, 'note': 'Rückzug nach dem Satz', 'source': 'seed'}, {'entryId': 21, 'patternId': 2, 'note': None, 'source': 'seed'},
                      {'entryId': 24, 'patternId': 3, 'note': None, 'source': 'seed'}, {'entryId': 22, 'patternId': 1, 'note': None, 'source': 'seed'}],
    'gespraeche': [], 'nachrichten': [],
    'vorbereitungen': [{'id': 1, 'title': 'Über die Wochenendplanung sprechen', 'situation': 'Samstag ist doppelt verplant', 'goal': 'Ein gemeinsamer Plan', 'validation': 'Du hast den Überblick.',
                        'woundedPoint': '', 'eyeLevel': '', 'stopSignal': '', 'feedback': None, 'debrief': None, 'status': 'entwurf', 'entryId': 21, 'createdAt': '2026-11-14T10:00:00.000Z', 'updatedAt': '2026-11-14T10:00:00.000Z'}],
    'checkins': [{'id': 1, 'date': D1, 'sleepHours': 7, 'sleepQuality': 4, 'energy': 3, 'stress': 5, 'meTimeMinutes': 30, 'socialContact': True, 'sportMinutes': 40, 'sportType': 'Laufen',
                  'selfCare': 'Sauna', 'motivations': ['eigen_freude'], 'motivationType': 'eigen', 'ownReason': None, 'note': 'Guter Tag.'},
                 {'id': 2, 'date': D2, 'sleepHours': 5.5, 'sleepQuality': 2, 'energy': 2, 'stress': 8, 'meTimeMinutes': 0, 'socialContact': False, 'sportMinutes': 0, 'sportType': None,
                  'selfCare': None, 'motivations': [], 'motivationType': None, 'ownReason': None, 'note': None}],
    'resets': [{'id': 1, 'variant': 'ausfuehrlich', 'tensionBefore': 8, 'tensionAfter': 3, 'intention': 'neugierig', 'parked': ['Präsentation'], 'completedAt': '2026-11-15T18:10:00.000Z'}]
}
SECRETS = ['Einkaufszettel', 'Balkongespräch', 'Chorabend', 'Wochenendplanung', 'Kraniche', 'Kartoffelsalat', 'Nachbarschaftsfest', PASS]


async def taps(pg, n=7):
    el = pg.locator('[data-a="about.tap"]'); await el.scroll_into_view_if_needed()
    for _ in range(n):
        await el.click(); await pg.wait_for_timeout(40)


async def room_setup(pg):
    await pg.goto(URL + '#/einstellungen'); await pg.wait_for_timeout(800)
    await taps(pg); await pg.wait_for_selector('#vt-setup')
    await pg.fill('#vt-setup input[name="p1"]', PASS); await pg.fill('#vt-setup input[name="p2"]', PASS)
    await pg.click('button[data-a="vt.setup"]'); await pg.wait_for_selector('.vt-tabs', timeout=20000)


async def room_open(pg):
    await pg.goto(URL + '#/einstellungen'); await pg.wait_for_timeout(500)
    await taps(pg); await pg.wait_for_selector('#vt-unlock')
    await pg.fill('#vt-unlock input[name="p"]', PASS); await pg.click('button[data-a="vt.unlock"]')
    await pg.wait_for_selector('.vt-tabs', timeout=20000)


async def tab(pg, k):
    await pg.click(f'.vt-tabs a[data-k="{k}"]'); await pg.wait_for_timeout(200)


async def room360(p):
    b, ctx, pg, errs = await setup(p, w=W, h=760, mobile=True)
    wide = []

    async def check(where):
        o = await pg.evaluate(OVER, W)
        if o['bad'] or o['sw'] > W + 1 or o['iw'] > W + 1:
            wide.append((where, o))
    await pg.goto(URL + '#/einstellungen'); await pg.wait_for_timeout(800)
    await taps(pg); await pg.wait_for_selector('#vt-setup')
    await check('Einrichten')
    await pg.fill('#vt-setup input[name="p1"]', PASS); await pg.fill('#vt-setup input[name="p2"]', PASS)
    await pg.click('button[data-a="vt.setup"]'); await pg.wait_for_selector('.vt-tabs', timeout=20000)
    await tab(pg, 'mehr'); await pg.wait_for_selector('input[data-c="vt.import"]', state='attached')
    await pg.set_input_files('input[data-c="vt.import"]', {'name': 'export.json', 'mimeType': 'application/json', 'buffer': json.dumps(EXPORT).encode('utf-8')})
    await pg.wait_for_timeout(900)
    await check('Mehr')
    await pg.click('[data-a="vt.pass"]'); await pg.wait_for_timeout(250)
    o = await pg.evaluate(DLG, W)
    assert o['open'] and not o['bad'] and o['sw'] <= o['cw'] + 1, o
    await close_dlg(pg)
    for k in ['start', 'chronik', 'muster', 'vorbereitung', 'tuer', 'checkin']:
        await tab(pg, k); await check(k)
    # Chronik: Ausgangslage aufgeklappt, Detail mit langem Titel, Formular
    await tab(pg, 'chronik')
    await pg.evaluate("document.querySelectorAll('#view details').forEach(d => d.open = true)"); await pg.wait_for_timeout(100)
    await check('Ausgangslage')
    await pg.locator('.vt-row', has_text='Einkaufszettel').first.click(); await pg.wait_for_timeout(250)
    await check('Eintrag')
    await pg.click('[data-a="vt.entry.edit"]'); await pg.wait_for_selector('#vt-entry'); await check('Eintrag bearbeiten')
    await pg.click('#vt-entry [data-a="vt.back"]'); await pg.wait_for_timeout(200)
    # Muster: Liste mit Matrix, Detail, Formular
    await tab(pg, 'muster'); assert await pg.locator('.vt-matrix').count() == 1
    await pg.locator('.vt-row', has_text='Rückzug').first.click(); await pg.wait_for_timeout(200); await check('Muster')
    await pg.click('[data-a="vt.pattern.edit"]'); await pg.wait_for_selector('#vt-pattern'); await check('Muster bearbeiten')
    await pg.click('#vt-pattern [data-a="vt.back"]'); await pg.wait_for_timeout(200)
    # Gespräch: Entwurf-Check mit Markierungen, Editor
    await tab(pg, 'vorbereitung')
    await pg.fill('[data-i="vt.draft"]', 'Ich nehme wahr, dass du immer planst — ja, aber ich bin stolz auf mich und will das würdigen.')
    await pg.wait_for_timeout(250); assert await pg.locator('mark.vt-falle, mark.vt-klang').count() >= 3
    await check('Entwurf-Check')
    await pg.locator('.vt-row', has_text='Wochenendplanung').first.click(); await pg.wait_for_selector('#vt-prep'); await check('Vorbereitung')
    # Türschwelle mit Overlay
    await tab(pg, 'tuer'); await pg.click('[data-a="vt.rt.start"]'); await pg.wait_for_selector('.vt-ritual'); await pg.wait_for_timeout(200)
    await check('Türschwelle, Overlay')
    await pg.click('.vt-ritual [data-a="vt.rt.cancel"]'); await pg.wait_for_timeout(200)
    # Check-in mit Motivations-Check
    await tab(pg, 'checkin')
    await pg.locator('[data-a="vt.ci.set"][data-k="sport"]').nth(1).click(); await pg.wait_for_timeout(250)
    assert await pg.locator('.vt-motiv').count() == 1
    await pg.locator('.vt-motiv [data-a="vt.ci.motive"]').last.click(); await pg.wait_for_timeout(250)
    await check('Check-in mit Motivations-Check')
    assert not wide, wide
    raw = await pg.evaluate("localStorage.getItem('haltung.v1')")
    assert not [s for s in SECRETS if s in raw], 'Klartext im Speicher'
    assert not errs, errs
    print('Raum bei %d px: Einrichten, alle Reiter, Eintrag, Muster, Formulare, Entwurf-Check, Türschwelle und Check-in passen.' % W)
    await b.close()


PREP_VALS = "['title', 'situation', 'goal', 'validation', 'woundedPoint', 'debrief'].map(k => (document.querySelector('#vt-prep [name=' + k + ']') || {}).value)"


async def prep(p):
    b, ctx, pg, errs = await setup(p, w=390, h=844, mobile=True)
    await room_setup(pg)
    await tab(pg, 'vorbereitung')
    await pg.click('button[data-a="vt.prep.new"]'); await pg.wait_for_selector('#vt-prep')
    await pg.fill('#vt-prep [name="title"]', 'Kartoffelsalat zum Nachbarschaftsfest')
    await pg.fill('#vt-prep [name="situation"]', 'Wer bringt was mit?')
    await pg.fill('#vt-prep [name="validation"]', 'Du denkst an alle.')
    # Kurz in eine andere App und zurück: alles steht noch da
    await pg.evaluate(VIS % 'true'); await pg.wait_for_timeout(300)
    await pg.evaluate(VIS % 'false'); await pg.wait_for_timeout(300)
    vals = await pg.evaluate(PREP_VALS)
    assert vals[:4] == ['Kartoffelsalat zum Nachbarschaftsfest', 'Wer bringt was mit?', '', 'Du denkst an alle.'], vals
    # Neuaufbau von außen: der Text bleibt und ist gespeichert (wie beim Zurück)
    await pg.fill('#vt-prep [name="goal"]', 'Eine Liste')
    await pg.evaluate("window.HaltungDebug.render()"); await pg.wait_for_timeout(400)
    vals = await pg.evaluate(PREP_VALS)
    assert vals[:4] == ['Kartoffelsalat zum Nachbarschaftsfest', 'Wer bringt was mit?', 'Eine Liste', 'Du denkst an alle.'], vals
    # Ein Neuaufbau ohne Änderung zählt nicht als geändert: das Chiffrat bleibt gleich
    c1 = await pg.evaluate("JSON.stringify(window.HaltungDebug.state.vault.data)")
    await pg.evaluate("window.HaltungDebug.render()"); await pg.wait_for_timeout(400)
    assert await pg.evaluate("JSON.stringify(window.HaltungDebug.state.vault.data)") == c1, 'Neuaufbau ohne Änderung hat neu gespeichert'
    # Reiterwechsel speichert wie „Zurück“
    await pg.fill('#vt-prep [name="woundedPoint"]', 'Mich trifft das.')
    await tab(pg, 'chronik'); await tab(pg, 'vorbereitung')
    assert 'Kartoffelsalat zum Nachbarschaftsfest' in await text(pg, '#view')
    await pg.locator('.vt-row', has_text='Kartoffelsalat').first.click(); await pg.wait_for_selector('#vt-prep')
    assert (await pg.evaluate(PREP_VALS))[4] == 'Mich trifft das.'
    # Schließen mit offener Vorbereitung: beim nächsten Öffnen ist alles da
    await pg.fill('#vt-prep [name="debrief"]', 'Lief gut.')
    await pg.click('.vt [data-a="vt.lock"]'); await pg.wait_for_timeout(500)
    assert await pg.locator('.vt-tabs').count() == 0
    await room_open(pg); await tab(pg, 'vorbereitung')
    await pg.locator('.vt-row', has_text='Kartoffelsalat').first.click(); await pg.wait_for_selector('#vt-prep')
    vals = await pg.evaluate(PREP_VALS)
    assert vals == ['Kartoffelsalat zum Nachbarschaftsfest', 'Wer bringt was mit?', 'Eine Liste', 'Du denkst an alle.', 'Mich trifft das.', 'Lief gut.'], vals
    # Seitenwechsel mit offener Vorbereitung: ebenso
    await pg.fill('#vt-prep [name="debrief"]', 'Lief gut, nächstes Mal früher.')
    await pg.evaluate("location.hash = '#/heute'"); await pg.wait_for_timeout(500)
    await room_open(pg); await tab(pg, 'vorbereitung')
    await pg.locator('.vt-row', has_text='Kartoffelsalat').first.click(); await pg.wait_for_selector('#vt-prep')
    assert (await pg.evaluate(PREP_VALS))[5] == 'Lief gut, nächstes Mal früher.'
    # Stand ändern zählt als Änderung, die Liste zeigt den Stand
    await pg.click('#view .seg button[data-v="bereit"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-a="vt.prep.list"]'); await pg.wait_for_timeout(300)
    assert 'Bereit' in await text(pg, '.vt-list')
    raw = await pg.evaluate("localStorage.getItem('haltung.v1')")
    assert not [s for s in SECRETS if s in raw], 'Klartext im Speicher'
    assert not errs, errs
    print('Gespräch: Angefangenes übersteht App-Wechsel und Neuaufbau, Reiterwechsel, Schließen und Seitenwechsel speichern.')
    await b.close()


async def main():
    async with async_playwright() as p:
        await dialogs(p)
        await room360(p)
        await prep(p)
    print('v215: alles in Ordnung')

asyncio.run(main())
