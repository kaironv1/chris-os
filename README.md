# Chris OS

Persönliche App für Heute, Training, Gesundheit, Pflege und Outfit. Eine HTML-Datei, die lokal im Browser oder als installierbare Web-App läuft. Alle Daten bleiben auf dem Gerät.

## Stand

- Version 2.2 läuft als `chris-os.html`. Der Quellcode 2.2 kommt als Nächstes hierher.
- Bausteine für 2.3, eigenständig getestet, noch nicht in die App eingebaut:
  - Ankleide-Figur: `src/figure.js`
  - Handy-Version: `pwa/` mit Fingerabdruck-Sperre, Service Worker, Manifest, Icons und Hosting-Dateien

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/figure.js` | Ankleide-Figur: `Figure.svg(outfit, { attr, label, cls })`, `Figure.parts(outfit)`, `Figure.named(teil)` |
| `pwa/lock.js` | Sperre per Passkey (Plattform-Authentifikator), nach 60 Sekunden im Hintergrund erneut Abfrage |
| `pwa/pwa.js`, `pwa/sw.js` | Offline-Betrieb und Update-Hinweis; `@@VERSION@@` setzt der Build |
| `pwa/manifest.webmanifest`, `pwa/icons/` | Name und Icons der installierbaren App |
| `pwa/vercel.json` | Sicherheits-Header für Vercel (CSP mit Open-Meteo, Passkeys erlaubt, kein Cache für `sw.js` und `index.html`) |
| `pwa/.htaccess` | Dieselben Header für deutschen Webspace (Apache), falls die App später umzieht; wird für Vercel nicht ausgeliefert |
| `pwa/test-index.html` | Testseite für die Handy-Bausteine |
| `tools/make_site.py` | Stellt die auslieferbare Seite zusammen und bettet `lock.js` und `pwa.js` in `index.html` ein |
| `tools/icons.js` | Erzeugt die Icons |
| `tests/test_pwa.py` | Sperre, Fehlversuch, Neu einrichten, Offline und Update mit virtuellem Authentifikator |
| `dev/figur-vorschau/` | Vorschau der Figur mit erfundenen Beispiel-Teilen, Galerie und Test |

## Bauen und testen

Voraussetzungen: Python 3 mit Playwright, Google Chrome unter `/usr/bin/google-chrome`, Node mit `sharp` für die Icons.

```bash
# Figur-Vorschau
python3 dev/figur-vorschau/build_preview.py
python3 dev/figur-vorschau/tests/test_preview.py

# Handy-Bausteine
python3 tools/make_site.py pwa pwa/test-index.html pwa/site-test test-1
python3 tests/test_pwa.py

# Icons neu erzeugen
node tools/icons.js pwa/icons
```

Ziel bei jedem Test: keine Konsolenfehler.

## Datenschutz

- Nicht ins Repository: `seed.json`, Backups, Fotos, `uploads/`, `alt/` und persönliche Builds.
- Tests laufen mit erfundenen Daten.
- Online geht nur der öffentliche Web-Build ohne persönliche Daten (`dist/web/`). Die Daten kommen per Backup aufs Gerät.

## Regeln für Inhalte

- Oberfläche auf Deutsch, Satzanfang groß, aktive Verben, keine Pfeile in Texten.
- Gesundheit: keine Diagnosen, keine Dosis-Empfehlungen, Hinweis „Die Hinweise ersetzen keine ärztliche Beratung“.
