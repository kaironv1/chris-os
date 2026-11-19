"""Liefert den Web-Build wie Vercel aus: statische Dateien plus die Header aus vercel.json (CSP und Co.).
Für Tests und zum Ausprobieren: python3 tests/serve_web.py [ordner] [port], dann http://localhost:<port>/ öffnen.
localhost gilt als sicherer Ursprung, deshalb laufen Service Worker und Passkeys auch ohne HTTPS."""
import functools, http.server, json, pathlib, re, sys, threading

ROOT = pathlib.Path(__file__).resolve().parent.parent


def rules(site):
    cfg = json.loads((pathlib.Path(site) / 'vercel.json').read_text(encoding='utf-8'))
    out = []
    for r in cfg.get('headers', []):
        pat = '(.*)'.join(re.escape(p) for p in r['source'].split('(.*)'))
        out.append((re.compile('^' + pat + '$'), [(h['key'], h['value']) for h in r['headers']]))
    return out


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.webmanifest': 'application/manifest+json', '.js': 'text/javascript', '.svg': 'image/svg+xml'}

    def __init__(self, *a, rules=None, **k):
        self.rules = rules or []
        super().__init__(*a, **k)

    def end_headers(self):
        path = self.path.split('?')[0]
        seen = {}
        for rx, hs in self.rules:
            if rx.match(path):
                for key, val in hs:
                    seen[key] = val
        for key, val in seen.items():
            self.send_header(key, val)
        super().end_headers()

    def log_message(self, *a):
        pass


def serve(site, port):
    h = functools.partial(Handler, directory=str(site), rules=rules(site))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


if __name__ == '__main__':
    site = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist' / 'web'
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8766
    serve(site, port)
    print(f'http://localhost:{port}/ ({site})')
    threading.Event().wait()
