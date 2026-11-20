# Chris OS

Persönliche App für Heute, Training, Gesundheit, Pflege und Outfit (früher „Haltung“). Eine einzige HTML-Datei, als installierbare Web-App (PWA) von Vercel: am Handy (Hauptgerät) und am PC in Chrome oder Edge (K39, K40). Ohne Konto, alle Daten bleiben auf dem Gerät; das andere Gerät bekommt sie per Backup.

## Stand

- Version 2.7 (20.11.2026): Ernährungsprotokoll unter Training, Ernährung. Der Nutzer tippt, was er gegessen hat („2 Eier, Brot mit Käse“, „Skyr 250 g“, „Kaffee mit Milch“); die App erkennt offline Lebensmittel, Mengen, Beilagen nach „mit“, Tippfehler und rohe Varianten aus einer Tabelle mit rund 300 Lebensmitteln und Gerichten und rechnet Kalorien, Eiweiß, Kohlenhydrate, Fett und Ballaststoffe. Eigene Lebensmittel, gemerkte Portionen und Mahlzeiten, Schnellwahl aus den eigenen Worten, CSV. Eiweiß sitzt jetzt in der Training-Kachel auf Heute (mit Eingabefeld). Unter Gesundheit, Verläufe: Kennzahlen, Beschwerden je Tag oder Woche, Schlaf und Infekt-Anzeichen auf einer Zeitachse, häufigste Beschwerden, Körperkarte nach Häufigkeit, Wochentage, Befinden, Energie und Stress, eine Beschwerde im Detail mit Zusammenhängen. Kaffee, Alkohol, Knoblauch, spätes Essen und lange Pausen aus dem Protokoll zählen für die Muster mit.
- Version 2.6 (20.11.2026): Heute mit einklappbaren Kacheln (Outfit, Wie geht’s dir, Erinnerungen, Training). Sie starten zu, zeigen eine Zeile Zusammenfassung und merken sich für die Sitzung, was offen ist; Eiweiß bleibt offen. Check-in mit sichtbarem „Gespeichert …“, das nach jeder Angabe kurz aufleuchtet, auch für „Gestern insgesamt“. Im Gym-Plan lassen sich Gerät oder Ort und Startgewicht je Übung anpassen (K8). Der Kleiderschrank erkennt ähnlich geschriebene Marken und gleicht sie auf Wunsch an (K5). Marken stehen in Liste und Figur einheitlich so, wie sie eingetragen sind.
- Version 2.5 (19.11.2026): Zwei Geräte. Handy als Hauptgerät, PC ebenfalls über die Web-Adresse (K39, K40). Die App merkt sich den Datenstand (letzte Änderung, letztes Backup, zuletzt eingespieltes Backup mit Gerät und Uhrzeit), warnt vor dem Einspielen, wenn dabei Änderungen verloren gingen oder das Backup älter ist, und zeigt am Zweitgerät, wenn sein Stand alt ist oder dort Einträge stehen, die am Hauptgerät noch fehlen. Backup-Dateien tragen Uhrzeit und Gerät im Namen. Am Windows-PC heißt die Sperre „Sperre mit Windows Hello“.
- Version 2.4 (19.11.2026): Handy-Version als PWA auf Vercel mit Fingerabdruck-Sperre (Passkey), offline und Update auf Knopfdruck. Ohne Startdaten: Auf einem Gerät ohne Daten startet die App mit „Backup einspielen“, am PC wie am Handy (K38). Der öffentliche Code ist ohne Kommentare und ohne persönliche Sätze (K37).
- Version 2.3: Ankleide-Figur am Outfit-Vorschlag mit Teile-Liste und Marke.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/parser.js` | Kleiderliste und Excel einlesen, Farben, Kategorien (`window.WardrobeParser`) |
| `src/garments.js` | SVG-Silhouetten der Teile (`window.Garments`) |
| `src/figure.js` | Ankleide-Figur: `Figure.svg(outfit, { attr, label, cls })`, `Figure.parts`, `Figure.named` |
| `src/engine.js` | Datum, Wetter, Outfit-Logik (Kombinationen, Bewertung, Teile-Tausch), Training, Pflege (`window.Engine`) |
| `src/food.js` | Ernährung: Lebensmitteltabelle (Werte je 100 g), Texterkennung `Food.parse(text, { foods, portions, meals })`, Tagessummen, Faktoren für die Muster (`window.Food`) |
| `src/health.js` | Gesundheit: Symptome, Frühwarnung, Schlafkonto, Vorsorge, Heimtraining, Dehnen, Kalender-Dateien, Verläufe (`trend`, `symDetail`) (`window.Health`) |
| `src/app.js` | Oberfläche, Router, Speicher, Migration, Diagramme (`SVGR` und `HOVER` je Diagrammtyp). Der Marker `/*@@UI_HEALTH@@*/` wird beim Build durch `ui-health.js`, `ui-style.js`, `ui-figure.js`, `ui-food.js` und `ui-trends.js` ersetzt |
| `src/ui-health.js` | Oberfläche Gesundheit, Heimtraining, Dehnen, Pflege-Erinnerungen |
| `src/ui-style.js` | Outfit: einzelnes Teil tauschen, Stil-Inspiration |
| `src/ui-figure.js` | Outfit: Umschalter Figur oder Teile, Teile-Liste mit Marke, Tausch und Auswahl an der Figur |
| `src/ui-food.js` | Ernährung: Eingabe mit Live-Erkennung (auch in der Training-Kachel auf Heute), Tagesbilanz, Liste, Dialoge, eigene Lebensmittel und Mahlzeiten, CSV |
| `src/ui-trends.js` | Gesundheit, Verläufe: Matrix der Beschwerden, kleine Diagramme auf einer Zeitachse, Rangliste, Körperkarte, Wochentage, Detail |
| `src/styles.css` | Design (Archivo, Denimblau, Oliv, Cognac; hell und dunkel) |
| `fonts/` | Schrift Archivo (SIL Open Font License 1.1) |
| `build.py` | Baut `dist/haltung.html` (Tests, mit Startdaten), `dist/chris-os.html` (PC-Datei ohne Startdaten, seit K40 nur noch Reserve) und `dist/web/` (Web-App für Handy und PC, bereinigt per esbuild) |
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
python3 tests/pc_start.py    # PC-Datei ohne Startdaten (nach test_pwa.py, nutzt dessen Backup)
python3 tests/zwei_geraete.py # Handy (Android) und PC (Windows) im Wechsel: Datenstand, Hinweise, Warnungen, Windows Hello (nach test_pwa.py)
python3 tests/v26.py         # Heute-Kacheln auf und zu, Speichern sichtbar, Übung anpassen, Marken angleichen
python3 tests/v27.py         # Eiweiß in der Training-Kachel, Ernährungsprotokoll, Verläufe unter Gesundheit
node tests/food_test.js      # Lebensmitteltabelle (Energie plausibel), Texterkennung, Summen, Faktoren, Verläufe
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
- Offene Heute-Kacheln in sessionStorage `chrisos.open` (nur für die Sitzung, Standard: alle zu). Die Tests über `run.setup()` öffnen alle Kacheln per Init-Skript; `setup(..., unfold=False)` prüft den Standard.
- Ernährung in `nutrition` (seit 2.7): `log[Datum]` mit Einträgen (`name`, `key`, `g`, `amt`, `kcal`, `p`, `c`, `f`, `fib`, `slot` frueh, mittag, snack oder abend, `time`, `seg` als eigene Schreibweise, `def` für Standardportion, `cups` für Kaffee), `foods` (eigene Lebensmittel, Werte je 100 g, `dp` Portion), `portions` (gemerkte Portion je Lebensmittel), `meals` (gemerkte Mahlzeiten). Eiweiß am Tag = Protokoll plus `training.protein[Datum]` (Schnelleinträge und Korrekturen, auch negativ). Kalorien-Ziel in `settings.kcalGoal` (leer oder 0 heißt ohne).
- Übungen in `training.exercises`: `where` (Gerät oder Ort) und `start` (Startgewicht) sind in der App änderbar; Speichern löscht `estimate`.
- Als verschieden markierte Marken in `meta.dismissed['brand:<schlüssel>']`.
- Backup-Datei `chris-os-backup-<Datum>-<Uhrzeit>-<handy|pc>.json`, intern `app: 'haltung'`, dazu `exported` (Zeitpunkt) und `device` (Gerät).
- Datenstand in `meta`: `changedAt` (letzte Änderung; `save(true)` zählt nicht, etwa beim Backup oder Ein- und Ausblenden), `savedAt` (letztes Backup), `restored` mit `at`, `exported` und `from` (zuletzt eingespieltes Backup). Hauptgerät in `settings.mainDevice` (`handy` oder `pc`, leer heißt Handy). Das Gerät selbst erkennt die App am Browser (Android oder iPhone heißt Handy).
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
