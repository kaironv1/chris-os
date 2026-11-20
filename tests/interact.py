import pathlib
import asyncio, sys, json
sys.path.insert(0, __import__('os').path.dirname(__import__('os').path.abspath(__file__)))
from run import *
async def st(pg, expr): return await pg.evaluate(f"(() => {{ const S = window.HaltungDebug.state; return {expr}; }})()")
async def main():
    async with async_playwright() as p:
        b, ctx, pg, errs = await setup(p)
        await pg.goto(URL); await pg.wait_for_timeout(1000)
        out = []
        # 1. wear today's outfit
        await pg.click('button[data-a="wear"]'); await pg.wait_for_timeout(300)
        out.append(('wear logged', await st(pg, 'S.wardrobe.wear.length')))
        await pg.click('.g-wash >> nth=1'); await pg.wait_for_timeout(200)
        out.append(('laundry items', await st(pg, 'S.wardrobe.items.filter(i=>i.laundry).map(i=>i.label)')))
        await pg.screenshot(path='tests/i_worn.png', clip={'x':240,'y':200,'width':1200,'height':560})
        # undo wear
        await pg.click('button[data-a="wear.undo"]'); await pg.wait_for_timeout(200)
        out.append(('wear after undo', await st(pg, 'S.wardrobe.wear.length')))
        # rating + reroll
        await pg.click('button[data-a="rate"][data-v="1"]'); await pg.wait_for_timeout(200)
        out.append(('ratings', await st(pg, 'Object.keys(S.wardrobe.ratings).length')))
        await pg.click('button[data-a="reroll"]'); await pg.wait_for_timeout(300)
        # 2. care
        await pg.click('button[data-a="care.done"] >> nth=0'); await pg.wait_for_timeout(150)
        out.append(('care', await st(pg, '[S.grooming.last.bart, window.HaltungDebug.E.dueList(S, window.HaltungDebug.E.today()).length]')))
        # 3. protein: since 2.7 inside the Training tile, typed as text and recognised
        await pg.fill('[data-fold="training"] .nf-in', 'Magerquark, 3 Eier'); await pg.wait_for_timeout(100)
        await pg.click('[data-fold="training"] button[data-a="nf.add"]'); await pg.wait_for_timeout(150)
        out.append(('protein', await st(pg, 'S.nutrition.log[window.HaltungDebug.E.today()].map(e => e.name + " " + e.p + " g")')))
        assert len(out[-1][1]) == 2, out[-1]
        # 4. training session B
        await pg.evaluate("location.hash='#/training'"); await pg.wait_for_timeout(400)
        await pg.click('button[data-a="session.start"][data-plan="B"]'); await pg.wait_for_timeout(500)
        await pg.click('button[data-a="warm"] >> nth=0')
        # fill first exercise (hip thrust): set 1 reps 10 then check
        await pg.fill('input[data-i="set.reps"][data-e="0"][data-s="0"]', '10')
        await pg.click('button[data-a="set.done"][data-e="0"][data-s="0"]'); await pg.wait_for_timeout(400)
        rest_visible = await pg.is_visible('#rest')
        out.append(('rest visible', rest_visible, await pg.text_content('#rest .rest-time')))
        await pg.click('button[data-a="set.done"][data-e="0"][data-s="1"]'); await pg.wait_for_timeout(100)
        await pg.click('button[data-a="set.done"][data-e="0"][data-s="2"]'); await pg.wait_for_timeout(100)
        # latpull: 3 sets at suggestion 70 x 8
        for i in range(3):
            await pg.click(f'button[data-a="set.done"][data-e="1"][data-s="{i}"]'); await pg.wait_for_timeout(80)
        # swap split squat to leg extension
        await pg.select_option('select[data-c="ex.swap"][data-e="2"]', 'legext'); await pg.wait_for_timeout(200)
        await pg.click('button[data-a="set.done"][data-e="2"][data-s="0"]'); await pg.wait_for_timeout(80)
        # plank (time) set
        await pg.click('button[data-a="set.done"][data-e="7"][data-s="0"]'); await pg.wait_for_timeout(80)
        await pg.screenshot(path='tests/i_session.png', full_page=False)
        await pg.click('button[data-a="rest.stop"]')
        await pg.click('.session-head button[data-a="session.finish"]'); await pg.wait_for_timeout(500)
        out.append(('sessions', await st(pg, 'S.training.sessions.map(s=>[s.name, s.entries.map(e=>e.ex+":"+e.sets.map(x=>x.kg+"x"+x.reps).join("/")).join(" | ")])')))
        out.append(('toast', await pg.text_content('#toast')))
        out.append(('next plan', await st(pg, 'window.HaltungDebug.E.nextPlan(S)')))
        out.append(('latpull suggestion now', await st(pg, 'JSON.stringify(window.HaltungDebug.E.suggestion(S, S.training.exercises.latpull))')))
        # 5. run + routine
        await pg.click('button[data-a="run.open"]'); await pg.wait_for_timeout(200)
        await pg.fill('#run-form input[name="km"]', '5,2' if False else '5.2')
        await pg.click('button[data-a="run.save"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-a="routine.open"][data-id="haltung"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-a="routine.tick"] >> nth=0')
        await pg.click('button[data-a="routine.save"]'); await pg.wait_for_timeout(200)
        out.append(('runs/routines', await st(pg, '[S.training.runs.length, S.training.routineLog.length]')))
        await pg.evaluate("location.hash='#/training/fortschritt'"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='tests/i_progress.png', full_page=False)
        # 6. wardrobe: edit item + photo
        await pg.evaluate("location.hash='#/outfit/schrank'"); await pg.wait_for_timeout(400)
        await pg.click('button[data-a="item.edit"][data-id="mantel"]'); await pg.wait_for_timeout(300)
        await pg.select_option('#item-form select[name="colorKey"]', 'navy')
        await pg.fill('#item-form input[name="brand"]', 'Testmarke')
        await pg.set_input_files('input[data-c="item.photo"]', str(pathlib.Path(__file__).resolve().parent / 'fixtures' / 'foto.jpg')); await pg.wait_for_timeout(800)
        await pg.click('button[data-a="item.save"]'); await pg.wait_for_timeout(600)
        out.append(('mantel', await st(pg, 'JSON.stringify((({label,colorKey,hex,brand,incomplete,unknownColor})=>({label,colorKey,hex,brand,incomplete,unknownColor}))(S.wardrobe.items.find(i=>i.id==="mantel")))')))
        out.append(('photo url', await pg.evaluate("!!document.querySelector('.wcard img')")))
        # 7. import excel (merge)
        await pg.click('button[data-a="import.open"]'); await pg.wait_for_timeout(200)
        await pg.set_input_files('input[data-c="import.file"]', str(pathlib.Path(__file__).resolve().parent / 'fixtures' / 'outfits.xlsx')); await pg.wait_for_timeout(800)
        out.append(('import preview', (await pg.text_content('#imp-res'))[:200]))
        await pg.click('button[data-a="import.apply"][data-mode="merge"]'); await pg.wait_for_timeout(500)
        out.append(('after import', await st(pg, '[S.wardrobe.items.length, S.wardrobe.outfits.length, S.wardrobe.items.find(i=>i.id==="mantel").brand]')))
        out.append(('toast', await pg.text_content('#toast')))
        # 8. backup export
        await pg.evaluate("location.hash='#/einstellungen'"); await pg.wait_for_timeout(300)
        async with pg.expect_download() as dl:
            await pg.click('button[data-a="backup.export"]')
        d = await dl.value
        path = str(pathlib.Path(__file__).resolve().parent / 'backup.json')
        await d.save_as(path)
        data = json.load(open(path))
        out.append(('backup', d.suggested_filename, list(data.keys()), len(data['photos']), round(len(json.dumps(data))/1024), 'KB'))
        # 9. reset then import backup
        await pg.click('button[data-a="reset"]'); await pg.wait_for_timeout(200)
        await pg.click('button[data-a="confirm.ok"]'); await pg.wait_for_timeout(600)
        out.append(('after reset sessions', await st(pg, 'S.training.sessions.length')))
        await pg.evaluate("location.hash='#/einstellungen'"); await pg.wait_for_timeout(300)
        await pg.set_input_files('input[data-c="backup.import"]', path); await pg.wait_for_timeout(400)
        await pg.click('button[data-a="confirm.ok"]'); await pg.wait_for_timeout(900)
        out.append(('after restore', await st(pg, '[S.training.sessions.length, S.training.runs.length, S.wardrobe.items.find(i=>i.id==="mantel").brand]')))
        # 10. reload persistence
        await pg.reload(); await pg.wait_for_timeout(900)
        out.append(('after reload', await st(pg, '[S.training.sessions.length, Object.keys(S.wardrobe.ratings).length]')))
        out.append(('photo after reload', await pg.evaluate("location.hash='#/outfit/schrank'; new Promise(r=>setTimeout(()=>r(!!document.querySelector('.wcard img')),500))")))
        for o in out: print(o)
        print('\n'.join(errs) or 'no console errors')
        await b.close()
asyncio.run(main())
