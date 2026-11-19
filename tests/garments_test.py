import pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = ROOT / 'seed.json' if (ROOT / 'seed.json').exists() else ROOT / 'tests' / 'fixtures' / 'test-seed.json'
import asyncio, json
from playwright.async_api import async_playwright
seed = json.load(open(SEED, encoding='utf-8'))
items = seed['wardrobe']['items']
css = open(ROOT / 'src' / 'styles.css', encoding='utf-8').read()
js = open(ROOT / 'src' / 'garments.js', encoding='utf-8').read()
html = f"""<!doctype html><html><head><meta charset=utf-8><style>{css}
body{{padding:20px}} .grid{{display:grid;grid-template-columns:repeat(10,1fr);gap:10px}} .t{{background:var(--board);border-radius:10px;padding:6px}} .t p{{font-size:11px;text-align:center}}</style></head>
<body><div id=defs></div><div class=grid id=g></div><script>{js}</script><script>
const items={json.dumps(items)};
document.getElementById('defs').innerHTML=Garments.defs();
document.getElementById('g').innerHTML=items.map(i=>'<div class=t><div class=g-art>'+Garments.svg(i)+'</div><p>'+i.label+'</p></div>').join('');
</script></body></html>"""
open(ROOT / 'tests' / 'garments.html', 'w', encoding='utf-8').write(html)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        for theme in ['light','dark']:
            pg = await b.new_page(viewport={'width':1400,'height':1100}, device_scale_factor=1)
            await pg.goto((ROOT / 'tests' / 'garments.html').as_uri())
            if theme=='dark':
                await pg.evaluate("document.documentElement.dataset.theme='dark'")
            await pg.wait_for_timeout(300)
            await pg.screenshot(path=str(ROOT / 'tests' / f'garments_{theme}.png'), full_page=True)
        await b.close()
asyncio.run(main())
