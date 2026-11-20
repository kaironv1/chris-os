"""Baut Chris OS aus src/.

  dist/haltung.html   Test-Build mit Startdaten: erfundener Test-Seed oder --seed <datei>. Nur für die Tests.
  dist/chris-os.html  PC-Version zum Ausliefern, ohne Startdaten: Auf einem leeren Browser startet sie mit „Backup einspielen“.
  dist/web/           Handy-Version (PWA) für Vercel: ohne Startdaten, ohne Kommentare, mit Sperre, Offline und Update.

Aufruf: python3 build.py [--seed <datei>] [--min] [--no-web]
  --min     auch den Test-Build bereinigt (minifiziert) bauen, um die Tests gegen den Web-Code laufen zu lassen
  --no-web  dist/web/ nicht neu bauen
Für dist/web/ braucht es esbuild (npm). Gesucht wird in $ESBUILD, im PATH und in den üblichen npm-Ordnern.
Optional prüft $CHRISOS_DENYLIST (Datei außerhalb des Repositorys, ein Begriff pro Zeile) den Web-Build auf persönliche Begriffe.
"""
import base64, hashlib, os, pathlib, re, shutil, subprocess, sys

root = pathlib.Path(__file__).resolve().parent
argv = sys.argv[1:]
seed_file = pathlib.Path(argv[argv.index('--seed') + 1]) if '--seed' in argv else root / 'tests' / 'fixtures' / 'test-seed.json'
MARK = '/*@@UI_HEALTH@@*/'
NAMES = ['parser.js', 'garments.js', 'figure.js', 'engine.js', 'food.js', 'health.js', 'app.js']
APP = (root / 'src' / 'app.js').read_text(encoding='utf-8')
VERSION = re.search(r"const VERSION = '([^']+)'", APP).group(1)
FONT = base64.b64encode((root / 'fonts/package/files/archivo-latin-wdth-normal.woff2').read_bytes()).decode()
CSS = (root / 'src' / 'styles.css').read_text(encoding='utf-8')
ICON_SVG = (root / 'pwa' / 'icons' / 'icon.svg').read_text(encoding='utf-8').strip()
FAVICON = 'data:image/svg+xml;base64,' + base64.b64encode(ICON_SVG.encode()).decode()


def sources():
    js = [(root / 'src' / f).read_text(encoding='utf-8') for f in NAMES]
    ia = NAMES.index('app.js')
    ui = '\n'.join((root / 'src' / f).read_text(encoding='utf-8') for f in ('ui-health.js', 'ui-style.js', 'ui-figure.js', 'ui-food.js', 'ui-trends.js'))
    assert js[ia].count(MARK) == 1, 'marker missing in app.js'
    js[ia] = js[ia].replace(MARK, ui.strip())
    return js


def esbuild_bin():
    cands = [os.environ.get('ESBUILD'), shutil.which('esbuild'), str(root / 'node_modules/.bin/esbuild'),
             '/opt/npm-tools/node_modules/.bin/esbuild', '/opt/npm-tools/node_modules/esbuild/bin/esbuild',
             str(pathlib.Path.home() / '.npm-global/bin/esbuild')]
    for c in cands:
        if c and pathlib.Path(c).exists():
            return c
    raise SystemExit('esbuild fehlt: npm install -g esbuild (oder ESBUILD=<pfad> setzen)')


def minify(code, loader):
    r = subprocess.run([esbuild_bin(), '--minify', '--legal-comments=none', '--charset=utf8', f'--loader={loader}'],
                       input=code.encode('utf-8'), capture_output=True)
    if r.returncode:
        raise SystemExit('esbuild: ' + r.stderr.decode('utf-8', 'replace'))
    return r.stdout.decode('utf-8').strip()


def page(js, css, seed=None, head='', pre=''):
    for s in js:
        assert '</script' not in s.lower()
    scripts = '\n'.join('<script>\n' + s + '\n</script>' for s in js)
    seed_tag = f'<script id="seed" type="application/json">{seed}</script>\n' if seed is not None else ''
    return f"""<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F1F2EE" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121822" media="(prefers-color-scheme: dark)">
<title>Chris OS</title>
{head}<style>
@font-face {{ font-family: 'Archivo'; src: url(data:font/woff2;base64,{FONT}) format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; font-style: normal; font-display: swap; }}
{css}
</style>
</head>
<body>
<noscript>Diese App braucht JavaScript.</noscript>
{seed_tag}{pre}{scripts}
</body>
</html>
"""


dist = root / 'dist'
dist.mkdir(exist_ok=True)
js = sources()

# 1. Test-Build mit Startdaten
seed_txt = seed_file.read_text(encoding='utf-8')
import json
seed_txt = json.dumps(json.loads(seed_txt), ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
test_js, test_css = (js, CSS) if '--min' not in argv else ([minify(s, 'js') for s in js], minify(CSS, 'css'))
fav = f'<link rel="icon" href="{FAVICON}">\n'
out = dist / 'haltung.html'
out.write_text(page(test_js, test_css, seed=seed_txt, head=fav), encoding='utf-8')
print(out, round(out.stat().st_size / 1024), 'KB', '(Test, Startdaten: ' + seed_file.name + (', bereinigt' if '--min' in argv else '') + ')')

# 2. PC-Version ohne Startdaten
pc = dist / 'chris-os.html'
pc.write_text(page(js, CSS, head=fav), encoding='utf-8')
print(pc, round(pc.stat().st_size / 1024), 'KB', '(PC, ohne Startdaten)')

# 3. Web-Version (PWA)
if '--no-web' not in argv:
    stage = dist / '.web-stage'
    if stage.exists():
        shutil.rmtree(stage)
    shutil.copytree(root / 'pwa', stage / 'pwa', ignore=shutil.ignore_patterns('site-test', '.htaccess', 'test-index.html'))
    for name in ('lock.js', 'pwa.js', 'sw.js'):
        f = stage / 'pwa' / name
        f.write_text(minify(f.read_text(encoding='utf-8'), 'js') + '\n', encoding='utf-8')
    head = ('<meta name="robots" content="noindex, nofollow">\n'
            '<link rel="manifest" href="manifest.webmanifest">\n'
            '<link rel="icon" href="icons/icon.svg" type="image/svg+xml">\n'
            '<link rel="icon" href="icons/favicon-32.png" sizes="32x32" type="image/png">\n'
            '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
            "<script>try{if(localStorage.getItem('chrisos.lock'))document.documentElement.classList.add('is-locked')}catch(e){}</script>\n")
    pre = '<script src="lock.js"></script>\n<script src="pwa.js"></script>\n'
    html = page([minify(s, 'js') for s in js], minify(CSS, 'css'), head=head, pre=pre)
    index = stage / 'index.html'
    index.write_text(html, encoding='utf-8')
    h = hashlib.sha1(html.encode('utf-8'))
    for f in sorted((stage / 'pwa').rglob('*')):
        if f.is_file():
            h.update(f.name.encode()); h.update(f.read_bytes())
    tag = VERSION + '-' + h.hexdigest()[:8]
    subprocess.run([sys.executable, str(root / 'tools' / 'make_site.py'), str(stage / 'pwa'), str(index), str(dist / 'web'), tag], check=True)
    shutil.rmtree(stage)

    # Prüfung: nichts Persönliches und keine Startdaten im öffentlichen Code
    web = dist / 'web'
    text = '\n'.join(f.read_text(encoding='utf-8') for f in web.rglob('*') if f.suffix in ('.html', '.js', '.json', '.webmanifest', '.svg'))
    text = re.sub(r'base64,[A-Za-z0-9+/=]+', 'base64,', text)  # eingebettete Schrift: Zufallstreffer vermeiden
    problems = []
    if 'id="seed"' in text:
        problems.append('Startdaten (Seed) eingebettet')
    for pat in (r'\bAlex\b', 'Musterstadt', 'Beispieldorf', 'Morgenrot', r'\b19\d\d-\d\d-\d\d\b', r'\b\d{1,2}\.\d{1,2}\.19\d\d\b', r"Chris['’]", r'/\*[\s\-]', r'(?<![:\w\\])//\s', r'@@'):
        if re.search(pat, text):
            problems.append('Treffer für ' + pat)
    deny = os.environ.get('CHRISOS_DENYLIST')
    if deny and pathlib.Path(deny).exists():
        for n, term in enumerate(pathlib.Path(deny).read_text(encoding='utf-8').splitlines(), 1):
            term = term.strip()
            if term and not term.startswith('#') and re.search(r'(?<!\w)' + re.escape(term) + r'(?!\w)', text, re.I):
                problems.append(f'Persönlicher Begriff aus Zeile {n} der Sperrliste gefunden')
    if problems:
        raise SystemExit('Web-Build gestoppt: ' + '; '.join(problems))
    size = sum(f.stat().st_size for f in web.rglob('*') if f.is_file())
    print(web, round(size / 1024), 'KB', '(Web, Version ' + tag + ', geprüft)')
