import sys, asyncio
from playwright.async_api import async_playwright
async def main():
    url = sys.argv[1]; out = sys.argv[2]; w = int(sys.argv[3]) if len(sys.argv) > 3 else 1400; h = int(sys.argv[4]) if len(sys.argv) > 4 else 900
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=1)
        errs = []
        pg.on('console', lambda m: errs.append(m.type + ': ' + m.text) if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
        await pg.goto(url)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=out, full_page=True)
        print('console:', errs if errs else 'keine Fehler')
        await b.close()
asyncio.run(main())
