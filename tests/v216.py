"""Version 2.16. Beschwerden im Tagesverlauf und nachträglich. Heute: Die Chips unter „Spürst du was?“ gelten für eine
Tageszeit (Nachts, Morgens, Tagsüber, Abends), vorgewählt nach der Uhr; morgens Kopfschmerzen und abends „Nichts“ ergibt
zwei Einträge, der Tag bleibt ein Tag mit Kopfschmerzen; eine gewählte Tageszeit gilt, solange die Uhr in ihr bleibt.
Gesundheit, Check-in: jeder frühere Tag über Pfeile oder Kalender, ein Hinweis zeigt den nachgetragenen Tag; der
Tagesverlauf als Liste wählt die Tageszeit für Chips, „Keine Beschwerden“, Körperkarte und Fieber; ein Tag ohne
Tageszeiten bleibt in der schlichten Form; Rückgängig; außerhalb von Gesundheit gilt wieder heute; Experiment-Frage für
einen Tag vor über einer Woche mit Datum. Verläufe: „Wann am Tag“ im Detail einer Beschwerde. Bericht und CSV nennen die
Tageszeiten. Alles bei 360 px ohne seitliches Herausragen, ohne Konsolenfehler."""
import asyncio, datetime, pathlib, sys
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from run import async_playwright, setup, URL

TODAY = datetime.date.today()
W = 360
iso = lambda k: (TODAY + datetime.timedelta(days=k)).isoformat()
at = lambda h, m=0: datetime.datetime.combine(TODAY, datetime.time(h, m))
short = lambda k: f'{int(iso(k)[8:10])}.{int(iso(k)[5:7])}.'
FOLD = '[data-fold="checkin"]'

# Ausgangslage: keine Gesundheitstage und Experimente aus dem Test-Seed; ein Tag wie vor 2.16 (vor 12 Tagen,
# Kopfschmerzen mittel) und ein laufendes Experiment seit 12 Tagen für die Frage mit Datum
PREP = r"""(() => {
  const D = window.HaltungDebug, S = D.state, E = D.E, t = E.today();
  S.health.days = {};
  S.health.days[E.addDays(t, -12)] = { sym: { kopf: 2 }, meas: [], f: {}, t: Date.now() };
  S.health.exps = [window.Exp.create({ tpl: 'kaffee', rule: 'Kein Kaffee nach 14 Uhr', days: 14, start: 'heute' }, S.health.profile, E.addDays(t, -12), 'x1')];
  localStorage.setItem('haltung.v1', JSON.stringify(S));
})()"""
# Ragt im Inhalt etwas über die Gerätebreite (eigene seitliche Scroller ausgenommen)?
OVER = r"""((W) => {
  const doc = document.documentElement, bad = [];
  const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const ox = getComputedStyle(p).overflowX; if (/auto|scroll|hidden|clip/.test(ox)) return true; } return false; };
  document.querySelectorAll('#view *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1) && !inScroller(el)) bad.push(el.tagName.toLowerCase() + '.' + String(el.className && el.className.baseVal != null ? el.className.baseVal : el.className).slice(0, 40)); });
  return { sw: doc.scrollWidth, bad: bad.slice(0, 6) };
})"""


async def day(pg, k):
    return await pg.evaluate(f"JSON.parse(localStorage.getItem('haltung.v1')).health.days['{iso(k)}'] || null")


def clean(x):
    """Tag ohne Zeitstempel der Einträge, für Vergleiche."""
    if not x:
        return x
    x = dict(x); x.pop('t', None)
    if 'tz' in x:
        x['tz'] = {k: {kk: vv for kk, vv in v.items() if kk != 't'} for k, v in x['tz'].items()}
    return x


async def text(pg, sel):
    return (await pg.inner_text(sel)).strip()


async def pressed(pg, sel):
    return await pg.eval_on_selector_all(sel, 'els => els.filter(e => e.getAttribute("aria-pressed") === "true").map(e => e.dataset.v)')


async def wide(pg, where, bad):
    o = await pg.evaluate(OVER, W)
    if o['bad'] or o['sw'] > W + 1:
        bad.append((where, o))


async def go(pg, h, wait=300):
    await pg.evaluate(f"location.hash = '{h}'"); await pg.wait_for_timeout(wait)


async def checkin(p):
    b, ctx, pg, errs = await setup(p, w=W, h=800, mobile=True)
    bad = []
    await pg.clock.set_fixed_time(at(8, 30))
    await pg.goto(URL + '#/heute'); await pg.wait_for_selector(FOLD)
    await pg.evaluate(PREP); await pg.reload(); await pg.wait_for_selector(FOLD)

    # 1. Heute um 8:30: Morgens ist gewählt, Kopfschmerzen landen dort
    assert await pg.eval_on_selector_all(f'{FOLD} .tzseg button', 'els => els.map(e => e.textContent)') == ['Nachts', 'Morgens', 'Tagsüber', 'Abends']
    assert await pressed(pg, f'{FOLD} .tzseg button') == ['morgen']
    await pg.click(f'{FOLD} button[data-a="hc.sym"][data-k="kopf"]'); await pg.wait_for_timeout(150)
    x = await day(pg, 0)
    assert clean(x)['tz'] == {'morgen': {'sym': {'kopf': 1}, 'none': False}} and x['sym'] == {'kopf': 1}, x
    assert 'on' in await pg.get_attribute(f'{FOLD} button[data-a="hc.sym"][data-k="kopf"]', 'class')
    assert 'morgens Kopfschmerzen leicht' in await text(pg, f'{FOLD} .fold-sum')
    await wide(pg, 'Heute morgens', bad)

    # 2. Abends um 20:15: Abends gewählt, der Morgen steht darunter, „Nichts“ hält fest, dass es vorbei ist
    await pg.clock.set_fixed_time(at(20, 15)); await pg.reload(); await pg.wait_for_selector(FOLD)
    assert await pressed(pg, f'{FOLD} .tzseg button') == ['abend']
    assert 'on' not in await pg.get_attribute(f'{FOLD} button[data-a="hc.sym"][data-k="kopf"]', 'class')
    assert await text(pg, f'{FOLD} .tz-other') == 'Heute schon: Morgens: Kopfschmerzen leicht.'
    await pg.click(f'{FOLD} button[data-a="hc.none"]'); await pg.wait_for_timeout(150)
    x = await day(pg, 0)
    assert clean(x)['tz'] == {'morgen': {'sym': {'kopf': 1}, 'none': False}, 'abend': {'sym': {}, 'none': True}}, x
    assert (x['sym'], x['none']) == ({'kopf': 1}, False), x
    assert 'morgens Kopfschmerzen leicht, abends nichts gespürt' in await text(pg, f'{FOLD} .fold-sum')
    assert await pg.locator(f'{FOLD} .tzseg button[data-v="abend"] .tzdot.free').count() == 1
    assert await pg.locator(f'{FOLD} .tzseg button[data-v="morgen"] .tzdot:not(.free)').count() == 1

    # 3. Morgens nachträglich ändern: die Wahl gilt, bis die Uhr die Tageszeit wechselt
    await pg.click(f'{FOLD} .tzseg button[data-v="morgen"]'); await pg.wait_for_timeout(120)
    assert 'on' in await pg.get_attribute(f'{FOLD} button[data-a="hc.sym"][data-k="kopf"]', 'class')
    await pg.click(f'{FOLD} button[data-a="hc.sym"][data-k="kopf"]'); await pg.wait_for_timeout(150)
    assert (await day(pg, 0))['tz']['morgen']['sym'] == {'kopf': 2}
    assert await pressed(pg, f'{FOLD} .tzseg button') == ['morgen']
    await pg.clock.set_fixed_time(at(10, 55)); await pg.reload(); await pg.wait_for_selector(FOLD)
    await pg.click(f'{FOLD} .tzseg button[data-v="nacht"]'); await pg.wait_for_timeout(120)
    assert await pressed(pg, f'{FOLD} .tzseg button') == ['nacht']
    await pg.clock.set_fixed_time(at(11, 5)); await pg.evaluate('window.HaltungDebug.render()'); await pg.wait_for_timeout(120)
    assert await pressed(pg, f'{FOLD} .tzseg button') == ['tags'], 'nach 11 Uhr gilt wieder die Uhr'
    await pg.clock.set_fixed_time(at(20, 15)); await pg.reload(); await pg.wait_for_selector(FOLD)

    # 4. Gesundheit, Check-in: der Tagesverlauf als Liste, Abends gewählt
    await go(pg, '#/gesundheit')
    rows = await pg.eval_on_selector_all('.tzlist .tzrow', 'els => els.map(e => [e.dataset.v, e.querySelector(".tzt").textContent])')
    assert rows == [['ganz', '–'], ['nacht', '–'], ['morgen', 'Kopfschmerzen mittel'], ['tags', '–'], ['abend', 'nichts gespürt']], rows
    assert await pressed(pg, '.tzlist .tzrow') == ['abend']
    assert (await text(pg, '.tz-cap')).startswith('Abends: tippen für leicht, mittel, stark, wieder aus.')
    assert await pg.get_attribute('.tz-cap button[data-a="hc.none"]', 'aria-pressed') == 'true'
    assert await pg.locator('.hday-note').count() == 0
    assert await pg.get_attribute('button[data-a="hc.day"][data-v="1"]', 'disabled') is not None
    await wide(pg, 'Gesundheit heute', bad)

    # 5. Nachtragen für einen Tag vor zehn Tagen über den Kalender: zuerst für den ganzen Tag wie bisher
    await pg.fill('input[data-c="hc.dateIn"]', iso(-10)); await pg.wait_for_timeout(250)
    long10 = await pg.evaluate(f"window.HaltungDebug.E.fmtLong('{iso(-10)}')")
    assert await text(pg, '.hday-note .hday-txt span') == f'Du trägst nach für {long10}.'
    assert await pressed(pg, '.seg button[data-a="hc.date"]') == []
    assert await pressed(pg, '.tzlist .tzrow') == ['ganz']
    await pg.click('.schips button[data-a="hc.sym"][data-k="hals_kratzen"]'); await pg.wait_for_timeout(150)
    x = await day(pg, -10)
    assert 'tz' not in x and x['sym'] == {'hals_kratzen': 1}, x
    await wide(pg, 'Gesundheit, Nachtrag', bad)
    # Morgens Halsschmerzen mittel und der Nacken auf der Körperkarte
    await pg.click('.tzrow[data-v="morgen"]'); await pg.wait_for_timeout(150)
    assert (await text(pg, '.tz-cap')).startswith('Morgens:')
    await pg.click('.schips button[data-a="hc.sym"][data-k="hals_schmerz"]'); await pg.wait_for_timeout(120)
    await pg.click('.schips button[data-a="hc.sym"][data-k="hals_schmerz"]'); await pg.wait_for_timeout(120)
    await pg.click('g[data-a="hc.bm"][data-k="nacken"]'); await pg.wait_for_timeout(150)
    assert 'Schmerzen morgens: Nacken (leicht)' in await text(pg, '.bm + p')
    assert 'Gilt für: Morgens' in await text(pg, '#view .two-col > div:nth-child(2) .panel')
    # Abends nichts mehr, dann doch Fieber gemessen
    await pg.click('.tzrow[data-v="abend"]'); await pg.wait_for_timeout(150)
    await pg.click('.tz-cap button[data-a="hc.none"]'); await pg.wait_for_timeout(150)
    x = await day(pg, -10)
    assert clean(x)['tz'] == {'ganz': {'sym': {'hals_kratzen': 1}, 'none': False}, 'morgen': {'sym': {'hals_schmerz': 2, 'bm:nacken': 1}, 'none': False}, 'abend': {'sym': {}, 'none': True}}, x
    assert (x['sym'], x['none']) == ({'hals_kratzen': 1, 'hals_schmerz': 2, 'bm:nacken': 1}, False), x
    await pg.fill('input[data-c="hc.temp"]', '38,4'); await pg.press('input[data-c="hc.temp"]', 'Tab'); await pg.wait_for_timeout(200)
    x = await day(pg, -10)
    assert (x['temp'], x['tz']['abend']['sym'], x['tz']['abend']['none'], x['sym']['fieber']) == (38.4, {'fieber': 2}, False, 2), x
    # „Keine Beschwerden“ nimmt das Fieber aus dem Abend, Rückgängig bringt es zurück
    await pg.click('.tz-cap button[data-a="hc.none"]'); await pg.wait_for_timeout(150)
    assert 'fieber' not in (await day(pg, -10))['sym']
    await pg.click('#toast button[data-a="toast.undo"]'); await pg.wait_for_timeout(200)
    x = await day(pg, -10)
    assert (x['tz']['abend']['sym'], x['tz']['abend']['none'], x['sym']['fieber']) == ({'fieber': 2}, False, 2), x
    rows = await pg.eval_on_selector_all('.tzlist .tzrow', 'els => els.map(e => e.querySelector(".tzt").textContent)')
    assert rows == ['Halskratzen leicht', '–', 'Halsschmerzen mittel, Schmerz Nacken leicht', '–', 'Fieber mittel'], rows
    # Experiment-Frage für diesen Tag mit Datum statt Wochentag
    q = await text(pg, '.exp-row .exp-q')
    assert q == f'Am {short(-10)} ab 14 Uhr ohne Kaffee?', q

    # 6. Pfeile: einen Tag weiter, zwei zurück, zurück zu heute
    await pg.click('button[data-a="hc.day"][data-v="1"]'); await pg.wait_for_timeout(150)
    assert await pg.input_value('input[data-c="hc.dateIn"]') == iso(-9)
    await pg.click('button[data-a="hc.day"][data-v="-1"]'); await pg.wait_for_timeout(120)
    await pg.click('button[data-a="hc.day"][data-v="-1"]'); await pg.wait_for_timeout(150)
    assert await pg.input_value('input[data-c="hc.dateIn"]') == iso(-11)
    await pg.click('.hday-note button[data-a="hc.day"][data-v="0"]'); await pg.wait_for_timeout(150)
    assert await pg.input_value('input[data-c="hc.dateIn"]') == iso(0) and await pg.locator('.hday-note').count() == 0
    # Ein Datum in der Zukunft wird heute
    await pg.fill('input[data-c="hc.dateIn"]', iso(3)); await pg.wait_for_timeout(200)
    assert await pg.input_value('input[data-c="hc.dateIn"]') == iso(0)

    # 7. Gestern gewählt, dann zu Heute und zurück: wieder heute
    await pg.click('.seg button[data-a="hc.date"] >> nth=1'); await pg.wait_for_timeout(150)
    assert await pg.locator('.hday-note').count() == 1
    await go(pg, '#/gesundheit/verlauf'); await go(pg, '#/gesundheit')
    assert await pressed(pg, '.seg button[data-a="hc.date"]') == [iso(-1)], 'innerhalb von Gesundheit bleibt der Tag'
    await go(pg, '#/heute'); await go(pg, '#/gesundheit')
    assert await pressed(pg, '.seg button[data-a="hc.date"]') == [iso(0)]

    # 8. Ein Tag von vor 2.16 steht als ganzer Tag da und kommt in seine schlichte Form zurück
    await pg.fill('input[data-c="hc.dateIn"]', iso(-12)); await pg.wait_for_timeout(250)
    assert await pressed(pg, '.tzlist .tzrow') == ['ganz']
    assert await text(pg, '.tzrow[data-v="ganz"] .tzt') == 'Kopfschmerzen mittel'
    assert 'on' in await pg.get_attribute('.schips button[data-a="hc.sym"][data-k="kopf"]', 'class')
    await pg.click('.tzrow[data-v="abend"]'); await pg.wait_for_timeout(120)
    await pg.click('.tz-cap button[data-a="hc.none"]'); await pg.wait_for_timeout(150)
    assert clean(await day(pg, -12))['tz'] == {'ganz': {'sym': {'kopf': 2}, 'none': False}, 'abend': {'sym': {}, 'none': True}}
    await pg.click('.tz-cap button[data-a="hc.none"]'); await pg.wait_for_timeout(150)
    x = await day(pg, -12)
    assert 'tz' not in x and x['sym'] == {'kopf': 2}, x

    # 9. Über diese App nennt die Neuerung
    await go(pg, '#/einstellungen', 400)
    assert 'Zuletzt neu: Beschwerden im Tagesverlauf.' in await text(pg, '[data-a="about.tap"]')
    assert not bad, bad
    assert not errs, errs
    print('Check-in bei %d px: Tageszeiten auf Heute, Tagesverlauf und Nachtragen unter Gesundheit, Körperkarte, Fieber, Rückgängig, schlichte Form, Experiment-Frage mit Datum.' % W)
    await b.close()


# Verläufe und Bericht: Kopfschmerzen an vier Tagen mit Tageszeit, an einem nur für den ganzen Tag; gereizte Augen nur
# ohne Tageszeit
TREND = r"""(() => {
  const D = window.HaltungDebug, S = D.state, E = D.E, H = window.Health, t = E.today();
  S.health.days = {}; S.health.exps = [];
  const put = (k, entries) => { const x = { sym: {}, meas: [], f: {}, t: Date.now(), sleepH: 7, mood: 3 };
    Object.entries(entries).forEach(([tz, s]) => { const e = H.tzEntry(x, tz); if (s === 'none') e.none = true; else Object.assign(e.sym, s); });
    H.syncDay(x); S.health.days[E.addDays(t, k)] = x; };
  put(-1, { morgen: { kopf: 2 }, abend: 'none' });
  put(-2, { morgen: { kopf: 1 }, tags: { kopf: 1 } });
  put(-3, { nacht: { kopf: 1 }, morgen: { kopf: 2 }, tags: 'none' });
  put(-4, { abend: { kopf: 1 } });
  put(-5, { ganz: { kopf: 2, augen: 1 } });
  put(-6, { ganz: { augen: 2 } });
  for (let k = 7; k <= 12; k++) put(-k, { ganz: 'none' });
  localStorage.setItem('haltung.v1', JSON.stringify(S));
})()"""


async def trends(p):
    b, ctx, pg, errs = await setup(p, w=W, h=800, mobile=True)
    bad = []
    await pg.goto(URL + '#/heute'); await pg.wait_for_selector(FOLD)
    await pg.evaluate(TREND); await pg.reload(); await pg.wait_for_selector(FOLD)
    await go(pg, '#/gesundheit/verlauf', 700)
    await pg.click('button[data-a="tr.sym"][data-k="kopf"]'); await pg.wait_for_timeout(300)
    vals = await pg.eval_on_selector_all('.tr-tz .tzg .wdc', 'els => els.map(e => [e.querySelector("b").textContent, e.querySelector(".wdv").textContent])')
    assert vals == [['Nachts', '1'], ['Morgens', '3'], ['Tagsüber', '1'], ['Abends', '1']], vals
    note = await text(pg, '.tr-tz p')
    assert note == 'Mit Tageszeit an 4 Tagen eingetragen, am häufigsten morgens (3 Tage). An 2 Tagen stand später am selben Tag ein Eintrag ohne Kopfschmerzen.', note
    await wide(pg, 'Verläufe, Detail', bad)
    await pg.click('button[data-a="tr.sym"][data-k="augen"]'); await pg.wait_for_timeout(300)
    assert await pg.locator('.tr-tz').count() == 0
    assert 'je Tageszeit ein' in await text(pg, '#view')
    # Bericht und CSV mit den Tageszeiten
    await go(pg, '#/gesundheit/bericht', 500)
    async with ctx.expect_page() as pp:
        await pg.click('button[data-a="rep.open"]')
    rp = await pp.value; await rp.wait_for_load_state(); await rp.wait_for_timeout(200)
    rep = await rp.inner_text('body')
    for s in ['Kopfschmerzen (mittel; morgens)', 'Kopfschmerzen (leicht; morgens, tagsüber)', 'Kopfschmerzen (mittel; nachts, morgens)',
              'Kopfschmerzen (leicht; abends)', 'Kopfschmerzen (mittel), Gereizte Augen (leicht)']:
        assert s in rep, (s, rep[:900])
    await rp.close()
    async with pg.expect_download() as dl:
        await pg.click('button[data-a="rep.csv"]')
    csv = open(await (await dl.value).path(), encoding='utf-8-sig').read()
    assert f'"{iso(-2)}"' in csv and 'Kopfschmerzen leicht (morgens, tagsüber)' in csv and 'Kopfschmerzen mittel (morgens)' in csv, csv[:400]
    assert not bad, bad
    assert not errs, errs
    print('Verläufe: „Wann am Tag“ mit Tageszeiten und Satz; ohne Tageszeit ein Hinweis; Bericht und CSV nennen die Tageszeiten.')
    await b.close()


async def main():
    async with async_playwright() as p:
        await checkin(p)
        await trends(p)


if __name__ == '__main__':
    asyncio.run(main())
