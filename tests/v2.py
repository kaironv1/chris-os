import asyncio, sys, json, base64, struct, zlib, datetime, re
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *

async def st(pg, expr): return await pg.evaluate(f"(() => {{ const S = window.HaltungDebug.state; const H = window.HaltungDebug.H; const E = window.HaltungDebug.E; return {expr}; }})()")
async def go(pg, h, wait=350): await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(wait)
async def dl_text(pg, sel):
    async with pg.expect_download() as d:
        await pg.click(sel)
    dd = await d.value
    return dd.suggested_filename, open(await dd.path(), encoding='utf-8').read()

def png_bytes(w=40, h=40, rgb=(200, 120, 80)):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')

# 70 days of synthetic check-ins with four infection episodes and a coffee/tongue-scraper breath pattern
SYNTH = """(() => {
  const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today();
  const D = S.health.days = {};
  const eps = { 60: [['hals_kratzen',1]], 59: [['hals_kratzen',1]],
    45: [['hals_kratzen',1],['nase_lauf',1]], 44: [['glieder',2],['nase_lauf',2],['fieber',2]], 43: [['glieder',2],['husten',2],['fieber',2]], 42: [['husten',2],['nase_lauf',1]], 41: [['husten',1]],
    30: [['hals_kratzen',1]], 29: [['hals_kratzen',1]],
    15: [['hals_kratzen',2],['nase_lauf',1]], 14: [['nase_lauf',2],['husten',1]], 13: [['nase_lauf',1],['husten',1]], 12: [['husten',1]] };
  const meas = { 60: ['nase_extra','tee'], 59: ['nase_extra'], 30: ['nase_extra','schlaf'], 29: ['nase_extra'], 15: ['tee'], 14: ['tee','schlaf'] };
  for (let i = 70; i >= 1; i--) {
    const d = E.addDays(t, -i);
    const k = (i * 7) % 5;
    const x = { sym: {}, meas: meas[i] || [], f: { kaffee: k % 4 + 1, wasser: [1.5, 2, 2.5, 1, 2][k] }, mood: 3 + (i % 3 === 0 ? 1 : 0), sleepH: 7 + (i % 4 === 0 ? 0.5 : 0), stress: 2 + (i % 5 === 0 ? 2 : 0), t: Date.now() };
    if (eps[i]) eps[i].forEach(([s, v]) => x.sym[s] = v);
    if ([62, 61, 47, 46, 32, 31, 17, 16].includes(i)) { x.sleepH = 5.5; x.f.umfeld = true; x.stress = 4; }
    if (i % 6 === 0) x.f.skip_zunge = true;
    x.breath = (x.f.kaffee >= 3 ? 1 : 0) + (x.f.skip_zunge ? 1 : 0);
    if (x.breath > 2) x.breath = 2;
    if (x.sym.fieber) x.temp = 38.4;
    D[d] = x;
  }
  window.HaltungDebug.render();
  return Object.keys(D).length;
})()"""

async def main():
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p)
        await pg.goto(URL); await pg.wait_for_timeout(1000)
        out = []
        # ---------- Heute: compact check-in ----------
        await pg.click('.ledger button[data-a="hc.set"][data-k="mood"][data-v="4"]'); await pg.wait_for_timeout(120)
        await pg.click('.ledger button[data-a="hc.set"][data-k="sleepH"][data-v="6"]'); await pg.wait_for_timeout(120)
        await pg.click('.ledger button[data-a="hc.step"][data-v="0.5"]'); await pg.wait_for_timeout(120)
        await pg.click('.ledger button[data-a="hc.breath"][data-v="1"]'); await pg.wait_for_timeout(120)
        await pg.click('.ledger button[data-a="hc.sym"][data-k="hals_kratzen"]'); await pg.wait_for_timeout(120)
        out.append(('heute checkin', await st(pg, 'JSON.stringify(S.health.days[E.today()])')))
        out.append(('warn pill after 1 sign', await pg.inner_text('.page-sub .wp') if await pg.query_selector('.page-sub .wp') else None))
        # ---------- synthetic history + warning levels ----------
        out.append(('synth days', await pg.evaluate(SYNTH)))
        await pg.evaluate("(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E; S.health.days[E.today()] = { sym: { hals_kratzen: 1 }, meas: [], f: {}, sleepH: 6, mood: 3, t: Date.now() }; window.HaltungDebug.render(); })()")
        w1 = await st(pg, 'JSON.stringify(H.warning(S, E.today()))')
        out.append(('warning hals+sleep6', w1))
        out.append(('training card hint', (await pg.inner_text('.ledger section:nth-child(2)'))[:240]))
        await pg.evaluate("(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E; Object.assign(S.health.days[E.today()].sym, { glieder: 2, fieber: 2 }); window.HaltungDebug.render(); })()")
        out.append(('warning +glieder+fieber', await st(pg, 'H.warning(S, E.today()).level')))
        out.append(('training card schonen', (await pg.inner_text('.ledger section:nth-child(2)'))[:200]))
        await pg.screenshot(path='tests/v2_heute_schonen.png', full_page=True)
        await pg.evaluate("(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E; S.health.days[E.today()].sym.atemnot = 1; window.HaltungDebug.render(); })()")
        out.append(('warning +atemnot', await st(pg, 'JSON.stringify([H.warning(S, E.today()).level, H.warning(S, E.today()).red])')))
        # back to mild state for the rest
        await pg.evaluate("(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E; S.health.days[E.today()] = { sym: { hals_kratzen: 1 }, meas: ['tee'], f: { kaffee: 2, wasser: 2 }, sleepH: 6, mood: 3, breath: 1, t: Date.now() }; window.HaltungDebug.render(); })()")
        out.append(('outfit scarf hint', [t for t in await pg.eval_on_selector_all('.why li', 'els => els.map(e => e.textContent)') if 'Schal' in t or 'Hals' in t]))
        # ---------- Muster ----------
        await go(pg, '#/gesundheit/muster', 900)
        out.append(('episodes', await st(pg, 'H.episodes(S, E.today()).map(e => e.start.slice(5) + " " + e.length + "d " + e.outcome + " early:" + e.early.join("+")).join(" | ")')))
        out.append(('measure stats', await st(pg, 'H.measureStats(S, H.episodes(S, E.today())).map(x => x.m.l + " " + x.ok + "/" + x.n).join(", ")')))
        out.append(('onset factors', await st(pg, 'H.onsetFactors(S, H.episodes(S, E.today())).map(x => x.label + " " + Math.round(x.p*100) + "% vs " + Math.round(x.b*100) + "%").join(", ")')))
        out.append(('breath factors top3', await st(pg, 'H.breathFactors(S).factors.slice(0,3).map(f => f.label + " +" + f.diff.toFixed(2)).join(", ")')))
        out.append(('muster headings', await pg.eval_on_selector_all('#view .sec-title', 'els => els.map(e => e.textContent)')))
        out.append(('heat cells', await pg.eval_on_selector_all('.hc-cell', 'els => { const c = {}; els.forEach(e => { const k = e.className.replace("hc-cell ", ""); c[k] = (c[k] || 0) + 1; }); return c; }')))
        await pg.select_option('select[data-c="ep.out"] >> nth=0', 'krank'); await pg.wait_for_timeout(200)
        out.append(('epOut override', await st(pg, 'JSON.stringify(S.health.epOut)')))
        await pg.screenshot(path='tests/v2_muster.png', full_page=True)
        # ---------- Check-in page ----------
        await go(pg, '#/gesundheit', 500)
        await pg.click('g[data-a="hc.bm"][data-k="nacken"]'); await pg.wait_for_timeout(120)
        await pg.click('g[data-a="hc.bm"][data-k="nacken"]'); await pg.wait_for_timeout(120)
        await pg.focus('g[data-a="hc.bm"][data-k="knie_l"]'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        await pg.click('button[data-a="hc.meas"][data-k="gurgeln"]'); await pg.wait_for_timeout(120)
        await pg.click('button[data-a="hc.f"][data-k="umfeld"]'); await pg.wait_for_timeout(120)
        await pg.click('button[data-a="hc.fnum"][data-k="kaffee"][data-v="3"]'); await pg.wait_for_timeout(120)
        await pg.fill('input[data-c="hc.temp"]', '38,6'); await pg.press('input[data-c="hc.temp"]', 'Tab'); await pg.wait_for_timeout(200)
        await pg.fill('textarea[data-i="hc.noteI"]', 'Seit dem Nachmittag müde'); await pg.wait_for_timeout(800)
        await pg.click('button[data-a="hc.set"][data-k="stress"][data-v="4"]'); await pg.wait_for_timeout(150)
        out.append(('checkin page state', await st(pg, 'JSON.stringify(S.health.days[E.today()])')))
        # custom symptom + custom measure
        await pg.click('button[data-a="hc.custom"]'); await pg.wait_for_timeout(150)
        await pg.fill('#cust-in', 'Ohrendruck'); await pg.click('button[data-a="hc.customSave"]'); await pg.wait_for_timeout(150)
        await pg.click('button[data-a="hc.measadd"]'); await pg.wait_for_timeout(150)
        await pg.fill('#meas-in', 'Ingwertee'); await pg.click('button[data-a="hc.measSave"]'); await pg.wait_for_timeout(150)
        out.append(('custom', await st(pg, 'JSON.stringify([Object.keys(S.health.days[E.today()].sym), S.health.measures.slice(-1)[0].l])')))
        # yesterday edit
        await pg.click('button[data-a="hc.date"] >> nth=1'); await pg.wait_for_timeout(200)
        await pg.click('button[data-a="hc.breath"][data-v="2"]'); await pg.wait_for_timeout(150)
        out.append(('yesterday breath', await st(pg, 'S.health.days[E.addDays(E.today(), -1)].breath')))
        await pg.click('button[data-a="hc.date"] >> nth=2'); await pg.wait_for_timeout(200)
        # observation with photo
        await pg.click('button[data-a="obs.new"]'); await pg.wait_for_timeout(200)
        await pg.fill('#obs-form textarea[name="text"]', 'Muttermal am linken Unterarm wirkt dunkler')
        await pg.select_option('#obs-form select[name="region"]', 'arm_l')
        await pg.set_input_files('#obs-form input[type="file"]', files=[{'name': 'mal.png', 'mimeType': 'image/png', 'buffer': png_bytes()}]); await pg.wait_for_timeout(500)
        await pg.click('button[data-a="obs.save"]'); await pg.wait_for_timeout(500)
        out.append(('obs', await st(pg, 'JSON.stringify(S.health.obs)'), await pg.eval_on_selector_all('.obs-art img', 'els => els.length')))
        await pg.screenshot(path='tests/v2_checkin.png', full_page=True)
        # ---------- Ärzte & Vorsorge ----------
        await go(pg, '#/gesundheit/aerzte', 500)
        await pg.click('button[data-a="doc.edit"][data-id="d-hausarzt"]'); await pg.wait_for_timeout(200)
        await pg.fill('#doc-form input[name="name"]', 'Dr. Beispiel, Musterstadt'); await pg.fill('#doc-form input[name="phone"]', '0123 456789')
        await pg.click('button[data-a="doc.save"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-a="appt.new"]'); await pg.wait_for_timeout(200)
        d3 = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()
        await pg.fill('#appt-form input[name="date"]', d3); await pg.fill('#appt-form input[name="time"]', '10:30'); await pg.fill('#appt-form input[name="reason"]', 'Check-up mit Blutbild')
        await pg.select_option('#appt-form select[name="vs"]', 'checkup')
        await pg.click('button[data-a="appt.save"]'); await pg.wait_for_timeout(200)
        fn, ics = await dl_text(pg, 'button[data-a="ics.appt"] >> nth=0')
        out.append(('appt ics', fn, [l for l in ics.splitlines() if l.startswith(('DTSTART', 'SUMMARY', 'TRIGGER'))]))
        await pg.click('button[data-a="q.new"][data-id="d-hausarzt"]'); await pg.wait_for_timeout(200)
        await pg.fill('#q-in', 'Lohnt sich ein Vitamin-D-Test im Winter?'); await pg.click('button[data-a="q.save"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-a="appt.quick"][data-id="d-zahn"]'); await pg.wait_for_timeout(200)
        await pg.fill('#note-form input[name="reason"]', 'Kontrolle und Zahnreinigung'); await pg.fill('#note-form textarea[name="talk"]', 'Alles gut, leichte Zahnfleischtasche unten rechts')
        await pg.fill('#note-form textarea[name="next"]', 'Interdentalbürsten nutzen'); await pg.select_option('#note-form select[name="follow"]', '182'); await pg.select_option('#note-form select[name="vs"]', 'zahn')
        await pg.click('button[data-a="note.save"]'); await pg.wait_for_timeout(250)
        out.append(('after note', await st(pg, 'JSON.stringify({ zahn: S.health.vorsorge.find(v => v.id === "zahn").last, fu: S.health.followups.map(f => f.text + " bis " + f.by), q: S.health.questions.length, appts: S.health.appts.length, doc: S.health.doctors[0].name })')))
        await pg.fill('input[data-c="vs.last"][data-id="augen"]', '2024-06-01'); await pg.press('input[data-c="vs.last"][data-id="augen"]', 'Tab'); await pg.wait_for_timeout(200)
        out.append(('vorsorge states', await st(pg, 'S.health.vorsorge.map(v => v.id + ":" + H.vorsorgeDue(S, v, E.today()).state).join(" ")')))
        fn, ics = await dl_text(pg, 'button[data-a="ics.jan"]')
        out.append(('jan ics', fn, [l for l in ics.splitlines() if l.startswith(('DTSTART', 'RRULE', 'SUMMARY'))]))
        await pg.screenshot(path='tests/v2_aerzte.png', full_page=True)
        # ---------- Medikamente ----------
        await go(pg, '#/gesundheit/medikamente', 400)
        await pg.click('button[data-a="med.new"]'); await pg.wait_for_timeout(200)
        await pg.fill('#med-form input[name="name"]', 'Antibiotikum'); await pg.fill('#med-form input[name="dose"]', '1 Tablette')
        await pg.check('#med-form input[name="time"][value="20:00"]')
        await pg.fill('#med-form input[name="days"]', '7'); await pg.fill('#med-form input[name="note"]', 'nach dem Essen')
        await pg.select_option('#med-form select[name="by"]', 'd-hausarzt')
        await pg.click('button[data-a="med.save"]'); await pg.wait_for_timeout(250)
        out.append(('med', await st(pg, 'JSON.stringify(S.health.meds)')))
        await pg.click('button[data-a="med.take"] >> nth=0'); await pg.wait_for_timeout(150)
        out.append(('intake', await st(pg, 'JSON.stringify(S.health.intake)')))
        fn, ics = await dl_text(pg, 'button[data-a="ics.med"]')
        out.append(('med ics', fn, ics.count('BEGIN:VEVENT'), [l for l in ics.splitlines() if l.startswith(('DTSTART', 'RRULE'))]))
        await pg.screenshot(path='tests/v2_meds.png', full_page=True)
        # ---------- Bericht ----------
        await go(pg, '#/gesundheit/bericht', 600)
        await pg.click('button[data-a="rep.range"][data-v="alle"]'); await pg.wait_for_timeout(300)
        await pg.fill('input[data-c="rec.set"][data-k="allergies"]', 'Hausstaub'); await pg.press('input[data-c="rec.set"][data-k="allergies"]', 'Tab'); await pg.wait_for_timeout(200)
        await pg.screenshot(path='tests/v2_bericht.png', full_page=True)
        async with ctx.expect_page() as pp:
            await pg.click('button[data-a="rep.open"]')
        rp = await pp.value; await rp.wait_for_load_state(); await rp.wait_for_timeout(300)
        rtxt = await rp.inner_text('body')
        out.append(('report sections', re.findall(r'\n(Feste Angaben|Medikamente|Zusammenfassung|Infekt-Episoden|Tage mit Beschwerden|Mundgeruch|Beobachtungen|Frühere Arztgespräche|Fragen an Sie)\n', '\n' + rtxt + '\n')))
        out.append(('report imgs', await rp.eval_on_selector_all('img', 'els => els.length')))
        await rp.set_viewport_size({'width': 900, 'height': 1200}); await rp.screenshot(path='tests/v2_report.png', full_page=False)
        await rp.close()
        # zahn-only report
        await pg.click('button[data-a="rep.fach"][data-v="zahn"]'); await pg.wait_for_timeout(250)
        async with ctx.expect_page() as pp:
            await pg.click('button[data-a="rep.open"]')
        rp = await pp.value; await rp.wait_for_load_state()
        z = await rp.inner_text('body'); await rp.close()
        out.append(('zahn report has Mundgeruch / no Gliederschmerzen', 'Mundgeruch' in z, 'Gliederschmerzen' not in z, 'Zahnfleischtasche' in z))
        fn, csv = await dl_text(pg, 'button[data-a="rep.csv"]')
        out.append(('csv', fn, csv.splitlines()[0][:80], len(csv.splitlines())))
        # ---------- Training: home workout ----------
        await go(pg, '#/training/zuhause', 400)
        await pg.click('button[data-a="home.min"][data-v="45"]'); await pg.wait_for_timeout(150)
        await pg.click('button[data-a="home.focus"][data-v="ober"]'); await pg.wait_for_timeout(150)
        await pg.select_option('select[data-c="home.pick"][data-slot="1"]', 'pushup'); await pg.wait_for_timeout(150)
        await pg.screenshot(path='tests/v2_zuhause.png', full_page=True)
        await pg.click('button[data-a="home.start"]'); await pg.wait_for_timeout(400)
        out.append(('home session', await st(pg, 'JSON.stringify([S.training.active.plan, S.training.active.name, S.training.active.entries.map(e => e.ex)])')))
        out.append(('home warmup', await pg.eval_on_selector_all('.warm .check-name, details .check-name', 'els => els.map(e => e.textContent.trim()).slice(0, 6)')))
        await pg.click('button[data-a="set.done"][data-e="0"][data-s="0"]'); await pg.wait_for_timeout(150)
        await pg.click('button[data-a="rest.stop"]'); await pg.wait_for_timeout(100)
        await pg.click('.session-head button[data-a="session.finish"]'); await pg.wait_for_timeout(400)
        out.append(('weekCounts', await st(pg, 'JSON.stringify(E.weekCounts(S, E.today()))')))
        # ---------- Stretching player ----------
        await go(pg, '#/training/zuhause', 300)
        await pg.click('button[data-a="st.when"][data-v="abend"]'); await pg.wait_for_timeout(120)
        await pg.click('button[data-a="st.min"][data-v="5"]'); await pg.wait_for_timeout(120)
        await pg.click('button[data-a="st.start"]'); await pg.wait_for_timeout(300)
        t0 = await pg.inner_text('[data-pl-time]')
        await pg.click('button[data-a="pl.toggle"]'); await pg.wait_for_timeout(2300)
        t1 = await pg.inner_text('[data-pl-time]')
        out.append(('player countdown', t0, t1, await pg.inner_text('.pl-name')))
        await pg.screenshot(path='tests/v2_player.png', full_page=True)
        n = await pg.eval_on_selector_all('.pl-list li', 'els => els.length')
        for _ in range(n):
            await pg.click('button[data-a="pl.next"]'); await pg.wait_for_timeout(80)
        await pg.wait_for_timeout(400)
        out.append(('player done', await pg.inner_text('#view h1'), await st(pg, 'JSON.stringify(S.training.routineLog.slice(-1))')))
        # preset from Heute (Büro-Pause) logs via "nur eintragen"
        await go(pg, '#/training', 300)
        await pg.click('button[data-a="pl.preset"][data-k="haltung"]'); await pg.wait_for_timeout(300)
        out.append(('haltung preset items', await pg.eval_on_selector_all('.pl-list li', 'els => els.map(e => e.textContent)')))
        await pg.click('button[data-a="pl.log"]'); await pg.wait_for_timeout(200)
        out.append(('after log', await st(pg, 'JSON.stringify([E.weekCounts(S, E.today()), S.training.routineLog.map(r => r.id)])')))
        # ---------- Pflege ----------
        await go(pg, '#/pflege', 400)
        out.append(('pflege tasks', await pg.eval_on_selector_all('#view .checklist .check-name', 'els => els.map(e => e.textContent).join(", ")')))
        await pg.click('button[data-a="care.done"] >> nth=0'); await pg.wait_for_timeout(150)
        await pg.click('button[data-a="care.new"]'); await pg.wait_for_timeout(150)
        await pg.fill('#care-form input[name="name"]', 'Zungenschaber erneuern'); await pg.fill('#care-form input[name="every"]', '90')
        await pg.click('button[data-a="care.save"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-a="routine.editOpen"]'); await pg.wait_for_timeout(150)
        await pg.fill('#rt-m', 'Kalt duschen\nZähne putzen\nZungenschaber\nKörper und Gesicht eincremen\nSonnenschutz bei Sonne'); await pg.click('button[data-a="routine.editSave"]'); await pg.wait_for_timeout(200)
        out.append(('pflege after', await st(pg, 'JSON.stringify([S.grooming.tasks.length, S.grooming.routine.morgens.length, S.grooming.tasks.slice(-1)[0].name])')))
        await pg.click('button[data-a="care.icsOpen"]'); await pg.wait_for_timeout(200)
        fn, ics = await dl_text(pg, 'button[data-a="care.icsSave"]')
        out.append(('care ics', fn, ics.count('BEGIN:VEVENT'), [l for l in ics.splitlines() if l.startswith('RRULE')][:3]))
        await pg.screenshot(path='tests/v2_pflege.png', full_page=True)
        # ---------- Heute after everything ----------
        await go(pg, '#/heute', 500)
        await pg.screenshot(path='tests/v2_heute.png', full_page=True)
        out.append(('heute reminders', (await pg.inner_text('.ledger section:nth-child(3)'))[:400]))
        out.append(('badges', await pg.eval_on_selector_all('.rail [data-badge]', 'els => els.map(e => e.dataset.badge + "=" + (e.classList.contains("hidden") ? 0 : e.textContent))')))
        # ---------- Backup roundtrip with health data + photo ----------
        await go(pg, '#/einstellungen', 400)
        out.append(('version text', (await pg.inner_text('#view'))[-260:].replace('\n', ' ')))
        async with pg.expect_download() as d:
            await pg.click('button[data-a="backup.export"]')
        bpath = await (await d.value).path()
        bk = json.load(open(bpath))
        out.append(('backup', bk['version'], [k for k in bk['photos'] if k.startswith('obs:')], len(bk['state']['health']['days'])))
        await pg.click('button[data-a="reset"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-a="confirm.ok"]'); await pg.wait_for_timeout(600)
        out.append(('after reset', await st(pg, 'JSON.stringify([Object.keys(S.health.days).length, S.health.obs.length])')))
        await go(pg, '#/einstellungen', 400)
        await pg.set_input_files('input[data-c="backup.import"]', bpath); await pg.wait_for_timeout(300)
        await pg.click('button[data-a="confirm.ok"]'); await pg.wait_for_timeout(900)
        out.append(('after restore', await st(pg, 'JSON.stringify([Object.keys(S.health.days).length, S.health.obs.length, S.health.meds.length])')))
        await go(pg, '#/gesundheit', 500)
        out.append(('restored obs photo', await pg.eval_on_selector_all('.obs-art img', 'els => els.length')))
        await pg.reload(); await pg.wait_for_timeout(900)
        out.append(('after reload', await st(pg, 'JSON.stringify([S.version, Object.keys(S.health.days).length])')))
        for o in out: print(*o)
        print('ERRORS', errs)
        await b.close()
if __name__ == '__main__':
    asyncio.run(main())
