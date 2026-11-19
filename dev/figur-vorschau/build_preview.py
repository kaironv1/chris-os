"""Baut die Vorschau als eine HTML-Datei: dist/ankleide-figur-vorschau.html (figure.js aus src/ des Repositorys)."""
import pathlib
root = pathlib.Path(__file__).parent
src = root / 'src'
repo = root.parent.parent
html = (src / 'preview.html').read_text(encoding='utf-8')
for marker, path in (('/*@@FIGURE@@*/', repo / 'src' / 'figure.js'), ('/*@@DEMO@@*/', src / 'demo-data.js'), ('/*@@UI@@*/', src / 'preview-ui.js')):
    code = path.read_text(encoding='utf-8')
    assert '</script' not in code.lower(), path.name
    html = html.replace(marker, code, 1)
out = root / 'dist' / 'ankleide-figur-vorschau.html'
out.parent.mkdir(exist_ok=True)
out.write_text(html, encoding='utf-8')
print(out, len(html) // 1024, 'KB')
