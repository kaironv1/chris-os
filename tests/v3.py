import asyncio, sys, json, re, datetime
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *

V20 = (__import__('pathlib').Path(__file__).resolve().parent / 'fixtures' / 'alt' / 'haltung-v2.0.html').as_uri()
async def st(pg, expr): return await pg.evaluate(f"(() => {{ const S = window.HaltungDebug.state; const H = window.HaltungDebug.H; const E = window.HaltungDebug.E; return {expr}; }})()")
async def go(pg, h, wait=400): await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(wait)
async def dl_text(pg, sel):
    async with pg.expect_download() as d:
        await pg.click(sel)
    dd = await d.value
    return dd.suggested_filename, open(await dd.path(), encoding='utf-8').read()
async def board_ids(pg):
    return await pg.eval_on_selector_all('.board .lay-split .g-cap, .board .fig-list .fig-name', 'els => els.map(e => e.textContent.trim())')

async def main():
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p)
        out = []
        # ---------- 1. v2.0 state -> v3 ----------
        await pg.goto(V20); await pg.wait_for_timeout(900)
        await pg.evaluate("""(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E;
            S.health.doctors.find(d => d.id === 'd-zahn').name = 'Mein Zahnarzt';
            S.health.vorsorge.find(v => v.id === 'haut').last = '2025-03-01';
            S.health.days[E.addDays(E.today(), -1)] = { sym: { hals_kratzen: 1 }, meas: ['tee'], f: {}, sleepH: 6, t: Date.now() };
            localStorage.setItem('haltung.v1', JSON.stringify(S)); })()""")
        await pg.goto(URL); await pg.wait_for_timeout(1200)
        out.append(('migrated', await st(pg, """JSON.stringify({ v: S.version, docs: S.health.doctors.map(d => d.id + '=' + d.name).join('; '),
            vs: S.health.vorsorge.map(v => v.id + ':' + (v.last || '-') + (v.checked ? '/chk' : '') + (v.season ? '/' + v.season : '')).join(' '),
            rec: S.health.record, prof: S.health.profile.early, meas: S.health.measures.map(m => m.l).join(', '),
            appts: S.health.appts.map(a => a.reason + ' ' + a.date), fu: S.health.followups.map(f => f.text), keptDay: !!S.health.days[E.addDays(E.today(), -1)],
            row: [S.training.exercises.h_row.start, S.training.exercises.h_row.max, S.training.exercises.h_row.repMax], eq: S.training.equipment.dumbbells.max })""")))
        # ---------- 2. Vorsorge display ----------
        await go(pg, '#/gesundheit/aerzte', 500)
        out.append(('vorsorge', await pg.eval_on_selector_all('#view .checklist li .check-name + span, #view .check-meta', 'els => els.map(e => e.textContent.trim()).filter(t => /Impfpass|Oktober|geschätzt|fällig|Datum/.test(t)).slice(0, 8)')))
        await pg.screenshot(path='tests/v3_aerzte.png', full_page=True)
        # ---------- 3. Outfit: swap one piece ----------
        await go(pg, '#/heute', 600)
        before = await board_ids(pg)
        slots = await pg.eval_on_selector_all('.board button[data-a="o.swap"]', 'els => els.map(e => e.dataset.k)')
        out.append(('board before', before, slots))
        top_slot = [s for s in slots if s.startswith('t')][-1]
        await pg.click(f'.board button[data-a="o.swap"][data-k="{top_slot}"]'); await pg.wait_for_timeout(300)
        after1 = await board_ids(pg)
        out.append(('swap top', after1, await pg.text_content('#toast')))
        await pg.click(f'.board button[data-a="o.swap"][data-k="{top_slot}"]'); await pg.wait_for_timeout(300)
        out.append(('swap top again', await board_ids(pg)))
        # choose a trouser in the dialog
        await pg.click('.board button[data-a="o.choose"][data-k="bottom"]'); await pg.wait_for_timeout(300)
        opts = await pg.eval_on_selector_all('#dlg .choose .check-name', 'els => els.map(e => e.textContent)')
        await pg.screenshot(path='tests/v3_choose.png')
        await pg.click('#dlg button[data-a="o.chooseSet"][data-v="1"]'); await pg.wait_for_timeout(300)
        out.append(('chooser', opts[:5], await board_ids(pg)))
        out.append(('choice stored', await st(pg, 'JSON.stringify(S.wardrobe.choice)')))
        # undo via toast
        await pg.click('#toast button'); await pg.wait_for_timeout(300)
        out.append(('after undo', await board_ids(pg)))
        # outer: swap until exhausted -> new overall suggestion
        if 'outer' in slots:
            await pg.click('.board button[data-a="o.swap"][data-k="outer"]'); await pg.wait_for_timeout(300)
            t1 = await pg.text_content('#toast')
            await pg.click('.board button[data-a="o.swap"][data-k="outer"]'); await pg.wait_for_timeout(300)
            out.append(('outer swaps', t1, await pg.text_content('#toast'), await st(pg, 'JSON.stringify(S.wardrobe.reroll)')))
        # persistence across reload, then wear the swapped outfit
        await pg.click(f'.board button[data-a="o.swap"][data-k="{top_slot}"]'); await pg.wait_for_timeout(300)
        shown = await board_ids(pg)
        await pg.reload(); await pg.wait_for_timeout(1000)
        out.append(('after reload same', shown == await board_ids(pg)))
        await pg.screenshot(path='tests/v3_heute.png', full_page=True)
        await pg.click('.board button[data-a="wear"]'); await pg.wait_for_timeout(300)
        out.append(('worn items', await st(pg, 'S.wardrobe.wear.slice(-1)[0].items.map(id => S.wardrobe.items.find(i => i.id === id).label).join(", ")')))
        await pg.click('.board button[data-a="wear.undo"]'); await pg.wait_for_timeout(300)
        # ---------- 4. Inspiration ----------
        await go(pg, '#/outfit/inspiration', 300)
        await pg.wait_for_timeout(2500)
        cards = await pg.eval_on_selector_all('.idea .idea-name', 'els => els.map(e => e.textContent)')
        stats = await pg.eval_on_selector_all('.idea .idea-stat', 'els => els.map(e => e.textContent)')
        out.append(('ideas', list(zip(cards, stats))))
        await pg.screenshot(path='tests/v3_inspiration.png', full_page=True)
        await pg.click('.idea button[data-a="idea.wish"] >> nth=0'); await pg.wait_for_timeout(1500)
        await pg.click('.idea button[data-a="idea.hide"] >> nth=0'); await pg.wait_for_timeout(1500)
        out.append(('after wish/hide', await st(pg, 'JSON.stringify([S.wardrobe.items.filter(i => i.id.startsWith("w-i-")).map(i => i.label + ":" + i.status + ":" + i.role), Object.keys(S.wardrobe.ideaHide || {})])'),
                    await pg.eval_on_selector_all('.idea .idea-name', 'els => els.length')))
        # "Habe ich schon" opens the item dialog with a preset
        if await pg.query_selector('.idea button[data-a="idea.have"]'):
            await pg.click('.idea button[data-a="idea.have"] >> nth=0'); await pg.wait_for_timeout(300)
            out.append(('have dialog', await pg.eval_on_selector('#item-form select[name="cat"]', 'e => e.value') if await pg.query_selector('#item-form select[name="cat"]') else 'no cat select'))
            await pg.click('#dlg button[data-a="dlg.close"]'); await pg.wait_for_timeout(200)
        # ---------- 5. Health personalisation ----------
        await pg.evaluate("""(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today();
            [3, 2, 1].forEach(k => { S.health.days[E.addDays(t, -k)] = { sym: {}, meas: [], f: {}, sleepH: 6, mood: 3, t: Date.now() }; });
            S.health.days[t] = { sym: {}, meas: [], f: {}, sleepH: 6, t: Date.now() }; window.HaltungDebug.render(); })()""")
        await go(pg, '#/heute', 500)
        out.append(('prevent on Heute', (await pg.inner_text('.ledger section:nth-child(1)'))[-260:].replace('\n', ' ')))
        await pg.click('.ledger button[data-a="hc.sym"][data-k="glieder"]'); await pg.wait_for_timeout(250)
        w = await st(pg, 'JSON.stringify(H.warning(S, E.today()))')
        out.append(('glieder + sleep debt', w))
        await pg.click('.ledger button[data-a="hc.breath"][data-v="1"]'); await pg.wait_for_timeout(250)
        await pg.click('.ledger button[data-a="hc.f"][data-k="nuechtern"]'); await pg.wait_for_timeout(250)
        out.append(('hunger', await st(pg, 'JSON.stringify(S.health.days[E.today()].f)')))
        await pg.screenshot(path='tests/v3_heute_health.png', full_page=True)
        await go(pg, '#/gesundheit/muster', 800)
        fn, ics = await dl_text(pg, 'button[data-a="ics.bed"]')
        out.append(('bed ics', fn, [l for l in ics.splitlines() if l.startswith(('DTSTART', 'RRULE', 'SUMMARY'))]))
        out.append(('hunch', (await pg.inner_text('.hunch'))[:200].replace('\n', ' ') if await pg.query_selector('.hunch') else None))
        await pg.screenshot(path='tests/v3_muster.png', full_page=True)
        await go(pg, '#/gesundheit', 400)
        fn, ics = await dl_text(pg, 'button[data-a="ics.checkin"]')
        out.append(('checkin ics', fn, [l for l in ics.splitlines() if l.startswith(('DTSTART', 'RRULE'))]))
        # ---------- 6. Neurology report ----------
        await pg.evaluate("""(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E, t = E.today();
            [5, 4, 2].forEach(k => { const d = E.addDays(t, -k); S.health.days[d] = Object.assign(S.health.days[d] || { meas: [], f: {} }, { sym: { beine_unruhig: 2 }, sleepH: 5.5, sleepQ: 2, t: Date.now() }); });
            window.HaltungDebug.render(); })()""")
        await go(pg, '#/gesundheit/bericht', 500)
        await pg.click('button[data-a="rep.fach"][data-v="neuro"]'); await pg.wait_for_timeout(300)
        async with ctx.expect_page() as pp:
            await pg.click('button[data-a="rep.open"]')
        rp = await pp.value; await rp.wait_for_load_state(); txt = await rp.inner_text('body'); await rp.close()
        out.append(('neuro report', re.findall(r'\n(Feste Angaben|Unruhige Beine|Tage mit Beschwerden|Fragen an Sie)\n', '\n' + txt + '\n'), 'Nahrungsergänzung' in txt, 'Schlafqualität' in txt, txt[txt.find('Unruhige Beine\n'):][:160].replace('\n', ' ')))
        # ---------- 7. Home workout at the dumbbell limit ----------
        await pg.evaluate("""(() => { const S = window.HaltungDebug.state, E = window.HaltungDebug.E;
            S.training.sessions.push({ id: 's-home-test', plan: 'home', name: 'Heimtraining', date: E.addDays(E.today(), -2), start: Date.now() - 864e5 * 2, end: Date.now() - 864e5 * 2 + 18e5,
              entries: [{ ex: 'h_row', sets: [1, 2, 3].map(() => ({ kg: 14, reps: 15, done: true })) }] });
            window.HaltungDebug.render(); })()""")
        out.append(('row suggestion', await st(pg, 'JSON.stringify(E.suggestion(S, S.training.exercises.h_row))')))
        await go(pg, '#/training/zuhause', 400)
        out.append(('equipment note', 'bis je 14 kg' in await pg.inner_text('#view')))
        # ---------- mobile + dark ----------
        await pg.set_viewport_size({'width': 412, 'height': 915})
        await go(pg, '#/heute', 500); await pg.screenshot(path='tests/v3_m_heute.png', full_page=True)
        await go(pg, '#/outfit/inspiration', 2500); await pg.screenshot(path='tests/v3_m_inspiration.png', full_page=True)
        ov = await pg.evaluate("[...document.querySelectorAll('#view *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(e).position !== 'fixed').slice(0, 6).map(e => e.tagName + '.' + e.className)")
        out.append(('mobile overflow', ov))
        await pg.emulate_media(color_scheme='dark')
        await go(pg, '#/heute', 500); await pg.screenshot(path='tests/v3_d_heute.png', full_page=False)
        for o in out: print(*o)
        print('ERRORS', errs)
        await b.close()

if __name__ == '__main__':
    asyncio.run(main())
