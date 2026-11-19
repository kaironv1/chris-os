import base64, json, pathlib, sys
root = pathlib.Path(__file__).parent
# Seed: --seed <datei>, sonst seed.json (persönlich, nie ins Repository), sonst der erfundene Test-Seed
argv = sys.argv[1:]
seed_file = pathlib.Path(argv[argv.index('--seed') + 1]) if '--seed' in argv else root/'seed.json'
if not seed_file.exists() and '--seed' not in argv:
    seed_file = root/'tests'/'fixtures'/'test-seed.json'
    print('Hinweis: seed.json fehlt, gebaut wird mit dem erfundenen Test-Seed')
font = base64.b64encode((root/'fonts/package/files/archivo-latin-wdth-normal.woff2').read_bytes()).decode()
css = (root/'src/styles.css').read_text(encoding='utf-8')
seed = json.loads(seed_file.read_text(encoding='utf-8'))
seed_txt = json.dumps(seed, ensure_ascii=False, separators=(',',':')).replace('</', '<\\/')
names = ['parser.js','garments.js','figure.js','engine.js','health.js','app.js']
js = [(root/'src'/f).read_text(encoding='utf-8') for f in names]
ia = names.index('app.js')
ui_health = '\n'.join((root/'src'/f).read_text(encoding='utf-8') for f in ('ui-health.js', 'ui-style.js', 'ui-figure.js'))
assert js[ia].count('/*@@UI_HEALTH@@*/') == 1, 'marker missing in app.js'
js[ia] = js[ia].replace('/*@@UI_HEALTH@@*/', ui_health.strip())
scripts = '\n'.join('<script>\n' + s + '\n</script>' for s in js)
for s in js: assert '</script' not in s.lower()
favicon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%232F4E85'/%3E%3Cpath d='M11 8v16M21 8v16M11 16h10' stroke='white' stroke-width='3' stroke-linecap='round'/%3E%3C/svg%3E"
html = f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F1F2EE" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121822" media="(prefers-color-scheme: dark)">
<title>Chris OS</title>
<link rel="icon" href="{favicon}">
<style>
@font-face {{ font-family: 'Archivo'; src: url(data:font/woff2;base64,{font}) format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; font-style: normal; font-display: swap; }}
{css}
</style>
</head>
<body>
<noscript>Diese App braucht JavaScript.</noscript>
<script id="seed" type="application/json">{seed_txt}</script>
{scripts}
</body>
</html>
"""
out = root/'dist'/'haltung.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
(root/'dist'/'chris-os.html').write_text(html, encoding='utf-8')  # delivered name since 2.2; tests keep using haltung.html
print(out, round(out.stat().st_size/1024), 'KB')
