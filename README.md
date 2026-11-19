# Chris OS

Persönliche App für Heute, Training, Gesundheit, Pflege und Outfit (früher „Haltung“). Eine einzige HTML-Datei, die lokal in Chrome oder Edge läuft, ohne Server und Login. Alle Daten bleiben im Browser.

## Stand

- Version 2.3 (19.11.2026): Ankleide-Figur am Outfit-Vorschlag. Umschalter „Figur | Teile“, Figur zuerst, die Wahl bleibt gespeichert; neben der Figur die Teile mit Marke („Marke offen“, wenn keine erfasst ist).
- Bausteine für die Handy-Version liegen in `pwa/`, getestet, noch nicht eingebaut.

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
| `build.py` | Baut `dist/haltung.html` (für die Tests) und `dist/chris-os.html` (zum Ausliefern) |
| `pwa/` | Handy-Version: Sperre per Passkey (`lock.js`, 60 Sekunden), Offline und Update (`pwa.js`, `sw.js`), Manifest, Icons, `vercel.json` |
| `tools/` | `make_site.py` stellt die Web-Seite zusammen, `icons.js` erzeugt die Icons |
| `tests/` | Playwright-Tests, Node-Tests, erfundene Testdaten in `tests/fixtures/` |
| `dev/figur-vorschau/` | Vorschau der Figur mit Beispiel-Teilen |

## Bauen

```bash
python3 build.py                                    # mit seed.json, falls vorhanden, sonst mit dem Test-Seed
python3 build.py --seed tests/fixtures/test-seed.json
```

`seed.json` enthält persönliche Daten und liegt nie im Repository. Die App übernimmt beim Öffnen die Daten aus dem Browser; der eingebettete Seed zählt nur beim ersten Start und bei „Alles zurücksetzen“. Migrationen dürfen deshalb keine persönlichen Daten aus dem Seed voraussetzen.

## Testen

Voraussetzungen: Python 3 mit Playwright, Google Chrome unter `/usr/bin/google-chrome`, Node. Wetter und Ortssuche (Open-Meteo) werden in `tests/run.py` gemockt. Aus dem Repository-Ordner starten:

```bash
python3 build.py --seed tests/fixtures/test-seed.json
python3 tests/v3.py          # Migration 2.0 auf 4, Teile-Tausch, Inspiration, Gesundheit
python3 tests/v2.py          # Gesundheit, Ärzte, Medikamente, Bericht, Heimtraining, Dehnen, Backup
python3 tests/interact.py    # Outfit, Training, Foto, Import, Backup
python3 tests/v2_mobile.py   # Handygröße hell und dunkel
python3 tests/figur.py       # Ankleide-Figur: Umschalten, Antippen, Tauschen, Marke, Umriss, Handy
python3 tests/v2_migrate.py  # Migration aus 1.1

# Bausteine
python3 dev/figur-vorschau/build_preview.py && python3 dev/figur-vorschau/tests/test_preview.py
python3 tools/make_site.py pwa pwa/test-index.html pwa/site-test test-1 && python3 tests/test_pwa.py
```

Ziel bei jedem Test: keine Konsolenfehler.

## Daten

- localStorage `haltung.v1` (Zustand `version: 4`; der Schlüssel bleibt trotz neuem Namen), `haltung.wetter`; IndexedDB `haltung-fotos`.
- Ansicht am Outfit-Vorschlag in `settings.outfitView` (`figur` oder `teile`, leer heißt Figur).
- Backup-Datei `chris-os-backup-…json`, intern `app: 'haltung'`.
- `migrate()` in `app.js` hebt ältere Stände an (1.x, 2, 3, 4) und füllt nur Leeres.

## Datenschutz

- Nicht ins Repository: `seed.json`, `src/seed.js` (enthält persönliche Angaben), `uploads/`, `alt/`, Backups, Fotos und persönliche Builds.
- Die Testdaten in `tests/fixtures/` sind erfunden (Person, Orte, Ärzte, Diagnose, Marken); die alten Builds dort sind entsprechend bereinigt.
- Online geht nur der öffentliche Web-Build ohne persönliche Daten (`dist/web/`). Die Daten kommen per Backup aufs Gerät.

## Regeln für Inhalte

- Oberfläche auf Deutsch, Satzanfang groß, aktive Verben, keine Pfeile in Texten, keine Mittelpunkte als Trenner, keine Großbuchstaben-Labels.
- Gesundheit: keine Diagnosen, keine Dosis-Empfehlungen („Dosis wie verordnet“), Hinweis „Die Hinweise ersetzen keine ärztliche Beratung“, bei Warnzeichen 116 117 und 112.
