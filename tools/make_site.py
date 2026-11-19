"""Stellt die auslieferbare Seite zusammen: index.html, sw.js mit Version, Manifest, Icons, vercel.json.
Bindet die Seite lock.js oder pwa.js per <script src> ein, werden beide in index.html eingebettet. So steckt alles,
was die App braucht, in einer Datei, und der Service Worker hält sie offline bereit.
Aufruf: python3 tools/make_site.py <pwa-ordner> <index.html> <ziel> <version>"""
import shutil, sys, pathlib
src = pathlib.Path(sys.argv[1]); index = pathlib.Path(sys.argv[2]); out = pathlib.Path(sys.argv[3]); version = sys.argv[4]
if out.exists(): shutil.rmtree(out)
(out / 'icons').mkdir(parents=True)
html = index.read_text(encoding='utf-8')
for name in ('lock.js', 'pwa.js'):
    tag = f'<script src="{name}"></script>'
    if tag in html:
        code = (src / name).read_text(encoding='utf-8')
        assert '</script' not in code.lower(), name
        html = html.replace(tag, '<script>\n' + code + '</script>', 1)
(out / 'index.html').write_text(html, encoding='utf-8')
(out / 'sw.js').write_text((src / 'sw.js').read_text(encoding='utf-8').replace('@@VERSION@@', version), encoding='utf-8')
for name in ('manifest.webmanifest', 'vercel.json'):
    shutil.copy(src / name, out / name)
for icon in sorted((src / 'icons').iterdir()):
    shutil.copy(icon, out / 'icons' / icon.name)
print('Seite', out, 'Version', version)
