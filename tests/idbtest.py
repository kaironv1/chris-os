import asyncio, json, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--allow-file-access-from-files'] if len(sys.argv)>1 else [])
        ctx = await b.new_context()
        pg = await ctx.new_page()
        await pg.goto((__import__('pathlib').Path(__file__).resolve().parent / 'idbtest.html').as_uri())
        await pg.wait_for_timeout(1500)
        print(await pg.title())
        await b.close()
asyncio.run(main())
