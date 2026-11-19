# Chris OS

Persönliche App für Heute, Training, Gesundheit, Pflege und Outfit (früher „Haltung“). Eine einzige HTML-Datei: am PC lokal in Chrome oder Edge, am Handy als installierbare Web-App (PWA) von Vercel. Ohne Konto, alle Daten bleiben auf dem Gerät.

## Stand

- Version 2.4 (19.11.2026): Handy-Version als PWA auf Vercel mit Fingerabdruck-Sperre (Passkey), offline und Update auf Knopfdruck. Ohne Startdaten: Auf einem Gerät ohne Daten startet die App mit „Backup einspielen“, am PC wie am Handy (K38). Der öffentliche Code ist ohne Kommentare und ohne persönliche Sätze (K37).
- Version 2.3: Ankleide-Figur am Outfit-Vorschlag mit Teile-Liste und Marke.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/parser.js` | Kleiderliste und Excel einlesen, Farben, Kategorien (`window.WardrobeParser`) |
| `src/garments.js` | SVG-Silhouetten der Teile (`window.Garments`) |
| `src/figure.js` | Ankleide-Figur: `Figure.svg(outfit, { attr, label, cls })`, `Figure.parts`, `Figure.named` |
| `src/engine.js` | Datum, Wetter, Outfit-Logik (Kombinationen, Bewertung, Teile-Tausch), Training, Pflege (`window.Engine`) |
| `src/health.js` | Gesundheit: Symptome, Frühwarnung, Schlafkonto, Vorsorge, Heimtraining, Dehnen, Kalender-Dateien (`window.Health`) |
| `src/app.js` | Oberfläche, Router, Speicher, Migration. Der Marker `/*@@UI_HEALTH@@*/` wird beim Build durch `ui-health.js`, `ui-style.js` und `ui-figure.js` ersetzt |
| `src/ui-health.js` | Oberfläche Gesundheit, Heimtraining, Dehnen, Pflege-Erinnerungen |
| `src/ui-style.js` | Outfit: einzelnes Teil tauschen, Stil-Inspiration |
| `src/ui-figure.js` | Outfit: Umschalter Figur oder Teile, Teile-Liste mit Marke, Tausch und Auswahl an der Figur |
| `src/styles.css` | Design (Archivo, Denimblau, Oliv, Cognac; hell und dunkel) |
| `fonts/` | Schrift Archivo (SIL Open Font License 1.1) |
| `build.py` | Baut `dist/haltung.html` (Tests, mit Startdaten), `dist/chris-os.html` (PC, ohne Startdaten) und `dist/web/` (Handy-Version, bereinigt per esbuild) |
| `pwa/` | Handy-Version: Sperre per Passkey (`lock.js`, 60 Sekunden), Offline und Update (`pwa.js`, `sw.js`), Manifest, Icons, `vercel.json` mit CSP |
| `dist/web/` | Öffentlicher Web-Build, liegt im Repository; Vercel veröffentlicht ihn bei jedem Push auf `main` |
| `tools/` | `make_site.py` stellt die Web-Seite zusammen, `icons.js` erzeugt die Icons |
| `tests/` | Playwright-Tests, Node-Tests, erfundene Testdaten in `tests/fixtures/`, `serve_web.py` liefert den Web-Build mit den Vercel-Headern aus |
| `dev/figur-vorschau/` | Vorschau der Figur mit Beispiel-Teilen |

## Bauen

```bash
python3 build.py                                    # alle drei Ziele, Test-Build mit dem erfundenen Test-Seed
python3 build.py --seed <datei>                     # Test-Build mit anderen Startdaten
python3 build.py --min                              # Test-Build ebenfalls bereinigt, um die Tests gegen den Web-Code laufen zu lassen
CHRISOS_DENYLIST=/pfad/sperrliste.txt python3 build.py   # Web-Build zusätzlich auf persönliche Begriffe prüfen
```

- Nur der Test-Build enthält Startdaten. PC- und Web-Version starten auf einem Gerät ohne Daten mit „Backup einspielen“ (K38); einen persönlichen Seed braucht es nicht mehr.
- `dist/web/` entsteht aus denselben Quellen, bereinigt mit esbuild (ohne Kommentare), plus Manifest, Icons, Service Worker und `vercel.json`. Die Version im Service Worker ist `VERSION` aus `app.js` plus ein Hash des Inhalts; jede Änderung löst auf dem Handy den Hinweis „Neue Version bereit“ aus.
- `build.py` bricht ab, wenn im Web-Build Startdaten, Testnamen, Geburtsdaten oder Kommentare stehen. Die Sperrliste mit persönlichen Begriffen liegt bewusst nicht im Repository.
- Migrationen dürfen keine persönlichen Daten aus Startdaten voraussetzen. Ohne Seed laufen sie gegen leere Listen.

## Testen

Voraussetzungen: Python 3 mit Playwright, Google Chrome unter `/usr/bin/google-chrome`, Node, esbuild. Wetter und Ortssuche (Open-Meteo) werden gemockt. Aus dem Repository-Ordner starten:

```bash
python3 build.py
python3 tests/v3.py          # Migration 2.0 auf 4, Teile-Tausch, Inspiration, Gesundheit
python3 tests/v2.py          # Gesundheit, Ärzte, Medikamente, Bericht, Heimtraining, Dehnen, Backup
python3 tests/interact.py    # Outfit, Training, Foto, Import, Backup
python3 tests/v2_mobile.py   # Handygröße hell und dunkel
python3 tests/figur.py       # Ankleide-Figur: Umschalten, Antippen, Tauschen, Marke, Umriss, Handy
python3 tests/v2_migrate.py  # Migration aus 1.1
python3 tests/test_pwa.py    # Handy-Version mit CSP: Begrüßung, Backup-Import, Sperre, Fehlversuch, Daten löschen, offline, Update
python3 tests/pc_start.py    # PC-Version ohne Startdaten (nach test_pwa.py, nutzt dessen Backup)
python3 dev/figur-vorschau/build_preview.py && python3 dev/figur-vorschau/tests/test_preview.py
```

Ziel bei jedem Test: keine Konsolenfehler. `test_pwa.py` liefert den Web-Build über `tests/serve_web.py` mit den Headern aus `vercel.json` aus; Playwrights `wait_for_function` scheitert dort an der CSP (kein `unsafe-eval`), deshalb wartet der Test per `evaluate`. Zum Ausprobieren im Browser: `python3 tests/serve_web.py`, dann http://localhost:8766/ öffnen.

## Veröffentlichen

- Vercel-Projekt `chris-os` im Team von kaironv1 (Hobby-Tarif), verknüpft mit diesem Repository. Einstellungen: Root Directory `dist/web`, kein Framework, kein Build-Befehl. Jeder Push auf `main` geht online; `ignoreCommand` in `vercel.json` überspringt Pushes, die `dist/web/` nicht ändern.
- Ablauf: Quellen ändern, `python3 build.py`, alle Tests, `dist/web/` mit committen, pushen.
- Die Adresse bleibt fest: Daten und Passkey hängen an ihr. Ein Umzug heißt einmal Backup einspielen und Sperre neu einrichten.

## Daten

- localStorage `haltung.v1` (Zustand `version: 4`; der Schlüssel bleibt trotz neuem Namen), `haltung.wetter`; IndexedDB `haltung-fotos`.
- Ansicht am Outfit-Vorschlag in `settings.outfitView` (`figur` oder `teile`, leer heißt Figur).
- Backup-Datei `chris-os-backup-…json`, intern `app: 'haltung'`.
- Sperre: Passkey-ID in localStorage `chrisos.lock`. „Kein Zugriff mehr?“ löscht `haltung.v1`, `haltung.wetter` und die Foto-Datenbank.
- `migrate()` in `app.js` hebt ältere Stände an (1.x, 2, 3, 4) und füllt nur Leeres.

## Datenschutz

- Nicht ins Repository: `seed.json`, `src/seed.js` (enthält persönliche Angaben), `uploads/`, `alt/`, Backups, Fotos und persönliche Builds.
- Die Testdaten in `tests/fixtures/` sind erfunden (Person, Orte, Ärzte, Diagnose, Marken); die alten Builds dort sind entsprechend bereinigt.
- Online geht nur der öffentliche Web-Build ohne persönliche Daten und ohne Kommentare (`dist/web/`). Die Daten kommen per Backup aufs Gerät, direkt per Kabel oder Quick Share. Keine Tracker, `noindex` für Suchmaschinen.
- Sätze über den Nutzer entstehen aus seinen Daten (Kleiderschrank, Einstellungen, Gesundheitsprofil), nicht aus festem Text im Code.

## Regeln für Inhalte

- Oberfläche auf Deutsch, Satzanfang groß, aktive Verben, keine Pfeile in Texten, keine Mittelpunkte als Trenner, keine Großbuchstaben-Labels.
- Gesundheit: keine Diagnosen, keine Dosis-Empfehlungen („Dosis wie verordnet“), Hinweis „Die Hinweise ersetzen keine ärztliche Beratung“, bei Warnzeichen 116 117 und 112.
