# Chris OS

Persönliche App für Heute, Training, Gesundheit, Pflege und Outfit (früher „Haltung“). Eine einzige HTML-Datei, als installierbare Web-App (PWA) von Vercel: am Handy (Hauptgerät) und am PC in Chrome oder Edge (K39, K40). Ohne Konto, alle Daten bleiben auf dem Gerät; das andere Gerät bekommt sie per Backup.

## Stand

- Version 2.13 (23.11.2026): Der Check-in im Raum übernimmt Schlaf, Schlafqualität und Energie aus „Wie geht’s dir?“ (K59), solange sie im Raum nicht eingetragen sind; Anspannung nicht. Übernommene Werte sind als „übernommen“ markiert, in der Tabelle der letzten 14 Tage kursiv. Gespeichert wird im Raum erst mit der ersten eigenen Angabe des Tages; dann merkt sich der Eintrag in `src` je Feld `hc` (übernommen, folgt späteren Korrekturen im normalen Check-in, nachgezogen beim Öffnen per `ciSync`) oder `du` (im Raum gesetzt oder geleert). Aus dem Raum fließt nichts zurück. Logik in `ciFrom`, `ciView`, `ciSet` und `ciSync` (`src/ui-vault.js`).
- Version 2.12 (23.11.2026): Verschlüsselter Raum. Kein Menüpunkt und keine Route: sieben schnelle Tipps auf die Versionszeile unter Einstellungen öffnen das Tor (`about.tap`). Inhalt liegt nur als Chiffrat in `S.vault` (AES-256-GCM); der zufällige Datenschlüssel ist mit einem Schlüssel aus der Passphrase (PBKDF2-SHA256, 600.000 Runden) verpackt und je Gerät mit einem Schlüssel aus dem Passkey (WebAuthn PRF, HKDF); das Gerät merkt sich seine Credential-Id in `localStorage chrisos.vk`. Inhalt nur im Speicher, solange der Raum offen ist; zu beim Seitenwechsel, nach einer Minute im Hintergrund und per Knopf. Module: Chronik mit Ausgangslage, Einträgen und systemischer Einordnung, Muster mit Matrix, Gesprächsvorbereitung entlang vier Prinzipien mit lokalem Entwurf-Check, Türschwellen-Reset mit Atemführung, Check-in mit Motivations-Check; Import und Export im Format des Resonanzraum-Exports. Logik in `src/vault.js` (`Vault`), Oberfläche in `src/ui-vault.js`. Noch ohne KI (K58).
- Version 2.11 (22.11.2026): Reisen mit Packliste (K52) als Reiter „Reisen“ unter Outfit. Reise anlegen mit Zielsuche (Open-Meteo Geocoding), Von und Bis, Art (privat oder Arbeit). Wetter am Ziel: Vorhersage bis 15 Tage voraus (`api.open-meteo.com`, Tageswerte mit gefühlter Temperatur), für spätere Reisen die Werte derselben Wochen im Vorjahr aus dem Archiv (ERA5, ±7 Tage, ein Mittel für alle Tage). Je Tag ein Outfit aus dem Schrank über die Engine, mit Abzug für jedes neue Teil im Koffer und Budgets (Hemden einmal, Strick und Hosen drei Tage, höchstens zwei Paar Schuhe, eine Jacke, ab acht Tagen Wäsche unterwegs, Teile in der Wäsche zählen mit); Anlass je Tag änderbar. Packliste mit Kleidung (Stückzahlen), Kulturbeutel (vorhandene Produkte, Werkzeug für Rhythmen, die in die Reise fallen), Medikamenten (Einnahmen gezählt), Sonstigem (Papiere, Ladegerät, Schirm bei Regen, Sonnenschutz bei Wärme, Laptop bei Arbeit) und Eigenem; abhaken, zurücksetzen. Hinweis auf Heute binnen einer Woche vor der Reise und unterwegs. Logik in `src/trip.js` (`Trip`), Oberfläche in `src/ui-trip.js`, Daten `S.trips`.
- Version 2.10 (21.11.2026): Der Wochenrückblick am Montag zeigt eine Zeile zum Experiment (K51): Lief in der Vorwoche eines, steht dort, an wie vielen Tagen dieser Woche die Regel eingehalten wurde (offene Tage mitgezählt), dazu der Zwischenstand von bis zu zwei Werten (Tage mit Regel gegen die Tage davor, zuerst die mit Unterschied); ein in der Woche beendetes Experiment steht mit seinem Ergebnis in Worten. Die Zusammenfassung nennt „Experiment an 4 von 5 Tagen“, unten führt „Experiment ansehen“ zu Gesundheit, Experimente. Logik in `Exp.week`, `Exp.weekText`, `Exp.weekSum` (`src/exp.js`).
- Version 2.9 (20.11.2026): Selbstexperimente unter Gesundheit, Experimente. Eine Regel für 7 bis 28 Tage (Vorlagen: Bettzeit aus dem Profil, kein Kaffee nach 14 Uhr, morgens etwas essen, 2 Liter trinken, abends dehnen, kein Alkohol, oder eine eigene Regel), dazu Werte aus dem Check-in (Schlaf, Schlafqualität, Befinden, Energie, Stress, Atem, Tage mit Beschwerden oder mit einer bestimmten Beschwerde) und eine Erwartung. Abhaken im Check-in auf Heute (gestern zuerst, heute ab einer passenden Uhrzeit) und im großen Check-in; Kaffee nach der Uhrzeit, Frühstück, Trinkmenge, Abend-Dehnen und Alkohol erkennt die App aus Ernährungsprotokoll, Check-in und Training, Abgehaktes geht vor. Vergleich der Tage mit Regel mit genauso vielen Tagen davor (Schlaf zählt für die Nacht danach, bei Abend-Regeln alles vom Tag danach), mindestens vier Tage je Seite, Schwellen je Wert plus Effektstärke; Ergebnis als Zeilen mit Hantel-Diagramm, Tag für Tag als kleine Diagramme mit Fläche für das Experiment, Fazit, Kalender-Erinnerung (.ics), Abschnitt im Bericht für den Arzt. Pollen auf die eigenen Arten beschränkbar (K48): aus den Angaben zu Allergien oder gewählt unter Verläufe und Einstellungen; Heute nennt nur diese, die Verläufe stellen sie vorn und vergleichen die Beschwerden nur mit ihnen.
- Version 2.8 (20.11.2026): Wochenrückblick auf Heute, montags bis mittwochs, einklappbar und ausblendbar: Schlaf, Beschwerden, Training, Eiweiß und Outfit-Tage der Vorwoche gegen die Woche davor, ein Satz je Bereich, dazu ein Hinweis aus den Verläufen. Wetter, Pollen und Luftqualität je Tag für den Wohnort von Open-Meteo (Air Quality API mit Pollen aus CAMS, Forecast mit past_days, ältere Tage aus dem Archiv), leise gespeichert in `S.env`; Pollen ab mäßig und schlechte Luft stehen oben auf Heute. Unter Gesundheit, Verläufe ein Panel „Wetter, Pollen und Luft“ auf derselben Zeitachse wie die Beschwerden, mit Zusammenhängen; Kälte, Temperatursturz, fallender Luftdruck, Luftqualität und Pollen je Art zählen im Detail einer Beschwerde als Einflüsse.
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
| `src/env.js` | Wetter, Pollen und Luft je Tag: Belastungsstufen (Pollen nach MeteoSchweiz, Europäischer Luftqualitätsindex), Tageswerte aus Stundenwerten, was abgefragt wird (`need`), Adressen, Einflüsse für die Muster (`tests`), Überblick (`summary`) (`window.Env`) |
| `src/food.js` | Ernährung: Lebensmitteltabelle (Werte je 100 g), Texterkennung `Food.parse(text, { foods, portions, meals })`, Tagessummen, Faktoren für die Muster (`window.Food`) |
| `src/health.js` | Gesundheit: Symptome, Frühwarnung, Schlafkonto, Vorsorge, Heimtraining, Dehnen, Kalender-Dateien, Verläufe (`trend`, `symDetail`) (`window.Health`) |
| `src/exp.js` | Selbstexperimente: Vorlagen, Messgrößen, Anlegen (`create`), Tage und Zustand, Frage im Check-in (`askDay`), Erkennung aus vorhandenen Daten (`auto`, `kept`), Vergleich (`evaluate`), Wörter, Erinnerung, Vorschläge aus den eigenen Daten (`hints`), Zeile für den Wochenrückblick (`week`, `weekText`, `weekSum`) (`window.Exp`) |
| `src/app.js` | Oberfläche, Router, Speicher, Migration, Diagramme (`SVGR` und `HOVER` je Diagrammtyp). Der Marker `/*@@UI_HEALTH@@*/` wird beim Build durch `ui-health.js`, `ui-style.js`, `ui-figure.js`, `ui-food.js`, `ui-trends.js`, `ui-review.js`, `ui-exp.js`, `ui-trip.js` und `ui-vault.js` ersetzt |
| `src/ui-health.js` | Oberfläche Gesundheit, Heimtraining, Dehnen, Pflege-Erinnerungen |
| `src/ui-style.js` | Outfit: einzelnes Teil tauschen, Stil-Inspiration |
| `src/ui-figure.js` | Outfit: Umschalter Figur oder Teile, Teile-Liste mit Marke, Tausch und Auswahl an der Figur |
| `src/ui-food.js` | Ernährung: Eingabe mit Live-Erkennung (auch in der Training-Kachel auf Heute), Tagesbilanz, Liste, Dialoge, eigene Lebensmittel und Mahlzeiten, CSV |
| `src/ui-trends.js` | Gesundheit, Verläufe: Matrix der Beschwerden, kleine Diagramme auf einer Zeitachse, Rangliste, Körperkarte, Wochentage, Wetter, Pollen und Luft, Detail |
| `src/ui-review.js` | Heute: Wochenrückblick (montags bis mittwochs), seit 2.10 mit Zeile zum Experiment |
| `src/trip.js` | Reisen: Anlegen, Tage, Anlass, Wetter am Ziel (`wxUrl`, `wxDaily`), Kontext, Outfits mit wenig Gepäck (`plan`), Packliste (`list`), Fortschritt, Zeile für Heute (`window.Trip`) |
| `src/ui-trip.js` | Outfit, Reisen: Liste, Dialog mit Zielsuche, Detail mit Tagen und Packliste, Hinweis auf Heute, Wetter laden |
| `src/vault.js` | Verschlüsselter Raum: Schlüssel aus Passphrase und PRF, Datenschlüssel verpacken, Inhalt lesen und schreiben, Datenmodell, Import und Export, Klang-Check, Motive (`window.Vault`) |
| `src/ui-vault.js` | Verschlüsselter Raum: verstecktes Tor, Einrichten und Öffnen, Chronik, Muster, Gespräch, Türschwelle, Check-in, Mehr |
| `src/ui-exp.js` | Gesundheit, Experimente: Vorlagen, Dialog, laufendes Experiment mit Tagen, Ergebnis mit Hantel-Diagramm und Tag für Tag, Zeile im Check-in, Abschnitt im Bericht |
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

Voraussetzungen: Python 3 mit Playwright, Google Chrome unter `/usr/bin/google-chrome`, Node, esbuild. Wetter, Pollen, Luftqualität und Ortssuche (Open-Meteo) werden gemockt (`run.env_routes` für die Umweltabfragen). Aus dem Repository-Ordner starten:

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
python3 tests/v28.py         # Wochenrückblick, Wetter, Pollen und Luft je Tag, Verläufe mit Umwelt, Archiv, Störung, Web-Build unter der CSP (nach test_pwa.py)
python3 tests/v29.py         # Selbstexperimente (anlegen, abhaken, erkennen, Ergebnis, Bericht), eigene Pollenarten, Web-Build unter der CSP (nach test_pwa.py)
python3 tests/v210.py        # Experiment im Wochenrückblick: laufend mit Zwischenstand, beendet mit Ergebnis, ohne Experiment keine Zeile
python3 tests/v211.py        # Reisen mit Packliste: anlegen mit Zielsuche, Outfits je Tag, Anlass ändern, Packliste, Heute-Hinweis, Vorjahreswerte, bearbeiten, löschen
python3 tests/v212.py        # Verschlüsselter Raum: Einstieg, Einrichten, Import, Chronik, Muster, Vorbereitung, Türschwelle, Check-in, Schließen, PRF am PC (startet einen http.server auf localhost)
python3 tests/v213.py        # Check-in im Raum mit Schlaf, Schlafqualität und Energie aus „Wie geht’s dir?“: markiert, eigene Werte und Leeren, Korrektur folgt, nichts fließt zurück, Export
node tests/food_test.js      # Lebensmitteltabelle (Energie plausibel), Texterkennung, Summen, Faktoren, Verläufe
node tests/env_test.js       # Pollen-Stufen, Luftqualität, Tageswerte, was abgefragt wird, Einflüsse, Vergleich mit Beschwerden, eigene Pollenarten
node tests/exp_test.js       # Selbstexperimente: Anlegen, Tage, Frage, Erkennung, Vergleich, Wörter, Erinnerung, Vorschläge, Zeile für den Wochenrückblick
node tests/trip_test.js      # Reisen: Anlegen, Anlass, Wetter-Adressen und Tageswerte, Kontext, Budgets, Plan, Packliste, Zeile für Heute
node tests/vault_test.js     # Verschlüsselter Raum: Schlüssel, Verpacken, Lesen und Schreiben, Import und Export, Matrix, Motive, Klang-Check
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
- Selbstexperimente in `health.exps` (seit 2.9): je Experiment `id`, `tpl` (Vorlage), `rule`, `at` (Uhrzeit in der Regel, etwa Bettzeit), `free` (frei formulierte Regel ohne Erkennung), `when` (`abend` oder `tag`), `measures` (z. B. `sleepQ`, `sym`, `sym:kopf`), `expect`, `days`, `start`, `end`, `stopped`, `log` (Datum: wahr oder falsch, abgehakt), `verdict` (`besser`, `gleich` oder `schlechter`, das eigene Fazit), `created`. Eigene Pollenarten in `health.profile.pollen` (`er`, `bi`, `gr`, `bf`, `am`; leer heißt alle; ohne Eintrag gelten die Arten aus `health.record.allergies`).
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
