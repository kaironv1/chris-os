/* Beschwerden im Tagesverlauf (2.16): Tageszeiten, Einträge je Tageszeit, Tagessumme in day.sym, Rückkehr zur
   schlichten Form, Verlauf in Worten, Tageszeiten in der Auswertung einer Beschwerde; Episoden, Verläufe und
   Frühwarnung rechnen weiter mit dem ganzen Tag. Aufruf: node tests/health_test.js */
'use strict';
const assert = require('assert');
const path = require('path');
const H = require(path.join(__dirname, '..', 'src', 'health.js'));
const E = require(path.join(__dirname, '..', 'src', 'engine.js'));
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); n++; };
const T = '2026-11-27';
const add = k => E.addDays(T, k);
const state = () => ({ health: { days: {}, profile: {}, measures: [], epOut: {} }, training: { sessions: [], runs: [] }, settings: { week: {} }, nutrition: { log: {} } });
const clean = x => JSON.parse(JSON.stringify(x, (k, v) => (k === 't' ? undefined : v)));

// 1. Tageszeiten: Reihenfolge, Wörter, Uhrzeiten; Nachts ist der Anfang des Datums wie der Schlaf der letzten Nacht
eq(H.TZ.map(z => z.id), ['ganz', 'nacht', 'morgen', 'tags', 'abend']);
eq(H.TZ.map(z => z.l), ['Ganzer Tag', 'Nachts', 'Morgens', 'Tagsüber', 'Abends']);
eq(H.TZ.map(z => z.h), ['ohne Tageszeit', '0 bis 5 Uhr', '5 bis 11 Uhr', '11 bis 18 Uhr', 'ab 18 Uhr']);
eq([0, 4, 5, 10, 11, 17, 18, 23].map(H.tzAt), ['nacht', 'nacht', 'morgen', 'morgen', 'tags', 'tags', 'abend', 'abend']);
eq([H.tzById('abend').w, H.tzById('xyz').id], ['abends', 'ganz']);

// 2. Ein Tag wie bisher ist ein Eintrag für den ganzen Tag
eq(H.parts(null), []);
eq(H.parts({ sym: {}, meas: [], f: {} }), [], 'leerer Tag ohne Einträge');
eq(H.parts({ sym: { kopf: 2, hals_kratzen: 0 } }), [{ k: 'ganz', sym: { kopf: 2, hals_kratzen: 0 }, none: false }]);
eq(H.parts({ sym: {}, none: true }), [{ k: 'ganz', sym: {}, none: true }]);
eq(H.entryText(H.parts({ sym: { kopf: 2, 'bm:nacken': 1 } })[0]), 'Kopfschmerzen mittel, Schmerz Nacken leicht');
eq(H.entryText({ sym: {}, none: true }), 'nichts gespürt');
eq(H.entryText(null), '');

// 3. Morgens Kopfschmerzen, abends nichts mehr: zwei Einträge, die Tagessumme bleibt ein Tag mit Kopfschmerzen
let x = { sym: {}, meas: [], f: {} };
H.tzEntry(x, 'morgen').sym.kopf = 2; H.syncDay(x);
eq(clean(x), { sym: { kopf: 2 }, meas: [], f: {}, tz: { morgen: { sym: { kopf: 2 }, none: false } }, none: false });
H.tzEntry(x, 'abend').none = true; H.syncDay(x);
eq([x.sym, x.none, H.hasData(x)], [{ kopf: 2 }, false, true]);
eq(H.parts(x).map(p => [p.k, H.entryText(p)]), [['morgen', 'Kopfschmerzen mittel'], ['abend', 'nichts gespürt']]);
eq(H.courseText(x, 'kopf'), 'morgens mittel, abends ohne');
eq(H.course(x, 'kopf'), [{ k: 'morgen', v: 2 }, { k: 'abend', v: 0 }]);
eq([H.tzWords(x, 'kopf'), H.tzWords(x, 'hals_kratzen'), H.courseText(x, 'hals_kratzen')], ['morgens', '', '']);
ok(typeof x.tz.abend.t === 'number', 'Eintrag merkt sich die Zeit der letzten Änderung');
// Tagsüber leichter: die Tagessumme ist das Stärkste über den Tag
H.tzEntry(x, 'tags').sym.kopf = 1; H.tzEntry(x, 'tags').sym.hals_kratzen = 3; H.syncDay(x);
eq([x.sym, H.courseText(x, 'kopf'), H.tzWords(x, 'hals_kratzen')], [{ kopf: 2, hals_kratzen: 3 }, 'morgens mittel, tagsüber leicht, abends ohne', 'tagsüber']);
// Eine Beschwerde in einem Eintrag mit „nichts gespürt“ hebt das „nichts“ auf
const ab = H.tzEntry(x, 'abend'); ab.sym.niesen = 1; H.syncDay(x);
eq([x.tz.abend.none, x.sym.niesen], [false, 1]);

// 4. Ein Tag von früher wird beim ersten Eintrag je Tageszeit zu seinem Eintrag für den ganzen Tag; nichts geht verloren
x = { sym: { hals_kratzen: 1 }, meas: ['tee'], f: { kaffee: 2 }, sleepH: 6 };
H.tzEntry(x, 'abend').sym.husten = 2; H.syncDay(x);
eq([clean(x.tz), x.sym, x.meas, x.f, x.sleepH], [{ ganz: { sym: { hals_kratzen: 1 }, none: false }, abend: { sym: { husten: 2 }, none: false } }, { hals_kratzen: 1, husten: 2 }, ['tee'], { kaffee: 2 }, 6]);
eq(H.parts(x).map(p => p.k), ['ganz', 'abend']);
// Kommt der Eintrag am Abend wieder weg, ist der Tag wieder in der schlichten Form wie vorher
delete x.tz.abend.sym.husten; H.syncDay(x);
eq(clean(x), { sym: { hals_kratzen: 1 }, meas: ['tee'], f: { kaffee: 2 }, sleepH: 6, none: false });
// „Nichts gespürt“ für den ganzen Tag bleibt erhalten
x = { sym: {}, none: true }; H.tzEntry(x, 'morgen').sym.kopf = 1; H.syncDay(x);
eq([clean(x.tz), x.sym, x.none], [{ ganz: { sym: {}, none: true }, morgen: { sym: { kopf: 1 }, none: false } }, { kopf: 1 }, false]);
delete x.tz.morgen; H.syncDay(x);
eq(clean(x), { sym: {}, none: true });
// Alles weg: keine Einträge, kein „nichts“
x = { sym: {} }; H.tzEntry(x, 'nacht').sym.beine_unruhig = 1; H.syncDay(x); delete x.tz.nacht.sym.beine_unruhig; H.syncDay(x);
eq(clean(x), { sym: {}, none: false });
// Unbekannte Tageszeit landet beim ganzen Tag; leere Werte fallen weg, Stärken über 3 werden 3
x = { sym: {} }; H.tzEntry(x, 'mittag').sym.kopf = 5; H.syncDay(x);
eq(clean(x), { sym: { kopf: 3 }, none: false });
x = { sym: {} }; const em = H.tzEntry(x, 'morgen'); em.sym = { kopf: 0, niesen: 2 }; H.syncDay(x);
eq(x.tz.morgen.sym, { niesen: 2 });

// 5. Auswertung einer Beschwerde: wann am Tag und ob sie später am Tag fehlte; Tage ohne Tageszeit zählen nicht mit
const S = state(), D = S.health.days;
const day = (k, entries) => { const y = { sym: {}, meas: [], f: {} }; Object.entries(entries).forEach(([tz, s]) => { const e = H.tzEntry(y, tz); if (s === 'none') e.none = true; else Object.assign(e.sym, s); }); H.syncDay(y); D[add(k)] = y; };
day(-1, { morgen: { kopf: 2 }, abend: 'none' });
day(-2, { morgen: { kopf: 1 }, tags: { kopf: 1 } });
day(-3, { nacht: { kopf: 1 }, morgen: { kopf: 2 }, tags: 'none' });
day(-4, { abend: { kopf: 1 } });
D[add(-5)] = { sym: { kopf: 2 }, meas: [], f: {} };
D[add(-6)] = { sym: {}, none: true, meas: [], f: {} };
const X = H.symDetail(S, 'kopf', add(-13), T);
eq([X.n, X.of], [5, 6], 'fünf Tage mit Kopfschmerzen, sechs erfasst');
eq(X.tz, { n: { nacht: 1, morgen: 3, tags: 1, abend: 1 }, days: 4, eased: 2 });
eq(H.symDetail(S, 'niesen', add(-13), T).tz, { n: { nacht: 0, morgen: 0, tags: 0, abend: 0 }, days: 0, eased: 0 });

// 6. Alles, was Tage zählt, nutzt die Tagessumme: Verläufe, Episoden, Frühwarnung
const tr = H.trend(S, add(-13), T);
eq([tr.symDays, tr.top[0].key, tr.top[0].n, tr.top[0].lv], [5, 'kopf', 5, [0, 2, 3, 0]]);
const S2 = state();
const sick = (k, entries) => { const y = { sym: {}, meas: [], f: {} }; Object.entries(entries).forEach(([tz, s]) => Object.assign(H.tzEntry(y, tz).sym, s)); H.tzEntry(y, 'abend').none = true; H.syncDay(y); S2.health.days[add(k)] = y; };
sick(-2, { morgen: { hals_kratzen: 1 } });
sick(-1, { morgen: { hals_kratzen: 1 }, tags: { nase_lauf: 1 } });
const eps = H.episodes(S2, T);
eq([eps.length, eps[0].start, eps[0].length, eps[0].first], [1, add(-2), 2, ['hals_kratzen']]);
const w = H.warning(S2, T);
eq([w.level, w.basedOnYesterday], ['achtung', true], 'Anzeichen von gestern zählen, auch wenn abends nichts mehr war');
eq(w.reasons[0], 'Halskratzen leicht, Laufende Nase leicht (gestern)');
eq(H.infScore(S2.health.days[add(-1)]), 2, 'Infekt-Wert aus der Tagessumme');

console.log('health_test: ' + n + ' Prüfungen bestanden');
