/* Selbstexperimente (2.9): Vorlagen, Anlegen, Tage, Frage im Check-in, automatische Erkennung, Vergleich mit den Tagen
   davor, Wörter, Erinnerung und Vorschläge aus den eigenen Daten. Aufruf: node tests/exp_test.js */
'use strict';
const assert = require('assert');
const path = require('path');
const X = require(path.join(__dirname, '..', 'src', 'exp.js'));
const E = require(path.join(__dirname, '..', 'src', 'engine.js'));
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); n++; };
const T = '2026-11-23';
const P = { bed: '22:30', wake: '06:00', sleepGoal: 7.5, triggers: ['schlaf'], breathHint: 'hunger' };
const add = k => E.addDays(T, k);
const state = () => ({ health: { days: {}, profile: Object.assign({}, P), exps: [] }, nutrition: { log: {} }, training: { routineLog: [] } });

// 1. Vorlagen und Messgrößen
eq(X.TPL.map(t => t.id), ['bett', 'kaffee', 'fruehstueck', 'wasser', 'dehnen', 'alkohol', 'eigen']);
eq(X.TPL.map(t => t.rule(P)), ['Um 22:30 ins Bett', 'Kein Kaffee nach 14 Uhr', 'Morgens etwas essen', 'Jeden Tag 2 Liter trinken', 'Abends 10 Minuten dehnen', 'Kein Alkohol', '']);
ok(X.TPL.every(t => t.m.every(k => X.measure(k))), 'alle Vorlagen-Werte bekannt');
eq(X.measure('sleepQ').l, 'Schlafqualität');
eq([X.measure('sym:kopf').l, X.measure('sym:kopf').s, X.measure('sym:kopf').kind], ['Tage mit „Kopfschmerzen“', '„Kopfschmerzen“', 'share']);
eq([X.measure('xyz'), X.measure('sym:'), X.measure(null)], [null, null, null]);
eq(X.BASE.map(k => X.measure(k).l), ['Schlaf', 'Schlafqualität', 'Befinden', 'Energie', 'Stress', 'Atem', 'Tage mit Beschwerden']);

// 2. Anlegen: Vorgaben, geänderte Zeiten, freie Regeln
const mk = (d, id) => X.create(d, P, T, id || 'x1');
let e = mk({ tpl: 'bett', rule: 'Um 22:30 ins Bett', when: 'abend', measures: ['sleepH', 'sleepQ'], expect: ' Mehr Schlaf ', days: 14, start: 'heute' });
eq([e.rule, e.at, e.free, e.when, e.days, e.start, e.end, e.expect, e.stopped, e.log, e.verdict], ['Um 22:30 ins Bett', '22:30', false, 'abend', 14, T, add(13), 'Mehr Schlaf', null, {}, null]);
eq(mk({ tpl: 'bett', rule: 'Um 22:00 ins  Bett' }).at, '22:00', 'neue Uhrzeit übernommen');
eq(mk({ tpl: 'bett', rule: 'Um 22 Uhr ins Bett' }).free, true, 'andere Form: freie Regel');
eq([mk({ tpl: 'bett', rule: 'Kein Handy im Bett' }).free, mk({ tpl: 'bett', rule: 'Kein Handy im Bett' }).at], [true, null]);
eq([mk({ tpl: 'kaffee', rule: 'Kein Kaffee nach 15:30 Uhr' }).at, mk({ tpl: 'kaffee', rule: 'Kein Kaffee nach 15:30 Uhr' }).free], ['15:30', false]);
eq(mk({ tpl: 'kaffee', rule: 'Kein Kaffee nach 16 Uhr' }).at, '16:00');
eq(mk({ tpl: 'kaffee', rule: 'Kein Tee nach 16 Uhr' }).free, true, 'anderer Inhalt');
eq([mk({ tpl: 'fruehstueck', rule: 'Morgens etwas essen' }).free, mk({ tpl: 'fruehstueck', rule: 'Morgens etwas essen' }).at], [false, null]);
eq(mk({ tpl: 'fruehstueck', rule: 'Morgens Eiweiß essen' }).free, true);
eq(mk({ tpl: 'eigen', rule: 'Kein Handy im Bett', when: 'abend' }).free, true);
e = mk({ tpl: 'kaffee', rule: 'Kein Kaffee nach 14 Uhr', days: 10, start: 'morgen', measures: ['sleepQ', 'unbekannt', 'mood', 'energy', 'stress', 'breath', 'sym'] });
eq([e.days, e.start, e.end, e.measures], [14, add(1), add(14), ['sleepQ', 'mood', 'energy', 'stress', 'breath']], 'Dauer, Start morgen, höchstens fünf Werte');
eq(mk({ tpl: 'dehnen', rule: 'Abends 10 Minuten dehnen', measures: [] }).measures, ['sleepQ', 'sym:verspannt', 'mood'], 'ohne Wahl die Vorlage');
eq(mk({ tpl: 'wasser', rule: 'Jeden Tag 2 Liter trinken', when: 'tag' }).when, 'tag');

// 3. Tage und Zustand
e = mk({ tpl: 'kaffee', rule: 'Kein Kaffee nach 14 Uhr', when: 'abend', days: 14 });
eq([add(-1), T, add(13), add(14)].map(d => X.status(e, d)), ['geplant', 'laeuft', 'laeuft', 'fertig']);
eq([X.ruleDays(e, add(-1)).length, X.ruleDays(e, add(4)).length, X.ruleDays(e, add(30)).length], [0, 5, 14]);
eq([X.dayNo(e, T), X.dayNo(e, add(13))], [1, 14]);
const es = Object.assign({}, e, { stopped: add(5) });
eq([X.status(es, add(7)), X.lastDay(es), X.ruleDays(es, add(7)).length, X.inRange(es, add(6))], ['abgebrochen', add(5), 6, false]);
eq(X.status(Object.assign({}, e, { stopped: e.end }), add(20)), 'fertig', 'am letzten Tag beendet');

// 4. Frage im Check-in: gestern zuerst, heute erst ab der passenden Stunde
let S = state();
eq([X.askDay(S, e, T, 9), X.askDay(S, e, T, 20), X.askDay(S, e, add(1), 8)], [null, T, T]);
e.log[T] = true;
eq([X.askDay(S, e, add(1), 8), X.askDay(S, e, add(1), 21)], [null, add(1)]);
eq(X.askDay(S, e, add(14), 8), add(13), 'nach dem Ende noch der letzte Tag');
e.log[add(13)] = false;
eq(X.askDay(S, e, add(14), 8), null);
eq(X.askDay(S, Object.assign({}, e, { stopped: add(3) }), add(5), 8), null, 'beendet: keine Frage');
const eb = mk({ tpl: 'bett', rule: 'Um 22:30 ins Bett' }), ef = mk({ tpl: 'fruehstueck', rule: 'Morgens etwas essen', when: 'tag' });
eq([X.askDay(S, eb, T, 23), X.askDay(S, eb, add(1), 7)], [null, T], 'Bettzeit erst am Morgen danach');
eq([X.askDay(S, ef, T, 9), X.askDay(S, ef, T, 10)], [null, T]);
const efree = mk({ tpl: 'eigen', rule: 'Kein Handy im Bett', when: 'tag' });
eq([X.fromHour(efree), X.fromHour(Object.assign({}, efree, { when: 'abend' }))], [18, 24]);
eq([X.ask(e, 'Gestern'), X.ask(eb, 'Gestern'), X.ask(ef, 'Heute'), X.ask(efree, 'Heute')], ['Gestern ab 14 Uhr ohne Kaffee?', 'Gestern bis 22:30 Uhr im Bett?', 'Heute morgens etwas gegessen?', 'Heute eingehalten?']);
eq(X.ask(mk({ tpl: 'kaffee', rule: 'Kein Kaffee nach 15:30 Uhr' }), 'Heute'), 'Heute ab 15:30 Uhr ohne Kaffee?');

// 5. Automatisch erkannt: nur eindeutige Fälle, was Chris abhakt, gilt
S = state();
const ek = mk({ tpl: 'kaffee', rule: 'Kein Kaffee nach 14 Uhr' });
S.nutrition.log[T] = [{ name: 'Kaffee', cups: 1, time: '09:30', slot: 'frueh', fl: 'dhk' }];
eq(X.auto(S, ek, T), null, 'Kaffee vor 14 Uhr');
S.nutrition.log[T].push({ name: 'Kaffee', cups: 1, time: '15:10', slot: 'snack', fl: 'dhk' }, { name: 'Espresso', cups: 1, time: '14:20', slot: 'mittag', fl: 'dhk' });
eq(X.auto(S, ek, T), { v: false, why: 'Kaffee um 14:20 im Ernährungsprotokoll' }, 'der erste nach 14 Uhr');
eq(X.auto(S, mk({ tpl: 'kaffee', rule: 'Kein Kaffee nach 16 Uhr' }), T), null, 'eigene Uhrzeit');
eq(X.kept(S, ek, T), { v: false, why: 'Kaffee um 14:20 im Ernährungsprotokoll', auto: true });
ek.log[T] = true;
eq(X.kept(S, ek, T), { v: true, manual: true }, 'abgehakt geht vor');
eq(X.kept(S, ek, add(1)), null);
S.nutrition.log[add(1)] = [{ name: 'Kaffee mit Milch', slot: 'frueh', time: '06:40', kcal: 40, fl: 'dhk', cups: 1 }];
eq(X.auto(S, ef, add(1)), null, 'nur ein Getränk ist kein Frühstück');
S.nutrition.log[add(1)].push({ name: 'Brot mit Käse', slot: 'frueh', time: '07:10', kcal: 320, fl: '' });
eq(X.auto(S, ef, add(1)), { v: true, why: 'Frühstück im Ernährungsprotokoll um 07:10' });
eq(X.auto(S, mk({ tpl: 'fruehstueck', rule: 'Morgens Eiweiß essen' }), add(1)), null, 'freie Regel: keine Erkennung');
const ew = mk({ tpl: 'wasser', rule: 'Jeden Tag 2 Liter trinken', when: 'tag' });
S.health.days[T] = { sym: {}, f: { wasser: 1.5 } };
eq(X.auto(S, ew, T), { v: false, why: 'Im Check-in 1,5 l getrunken' });
S.health.days[T].f.wasser = 2.5;
eq(X.auto(S, ew, T).v, true);
S.nutrition.log[add(2)] = [{ name: 'Wasser', g: 500, fl: 'dw' }, { name: 'Tee', g: 1000, fl: 'dhw' }];
eq(X.auto(S, ew, add(2)), { v: false, why: 'Im Ernährungsprotokoll 1,5 l getrunken' });
const ed = mk({ tpl: 'dehnen', rule: 'Abends 10 Minuten dehnen' });
S.training.routineLog = [{ date: T, id: 'dehnen', kind: 'morgen' }];
eq(X.auto(S, ed, T), null, 'morgens zählt nicht');
S.training.routineLog.push({ date: T, id: 'dehnen', kind: 'abend' });
eq(X.auto(S, ed, T), { v: true, why: 'Abends gedehnt mit dem Timer' });
const ea = mk({ tpl: 'alkohol', rule: 'Kein Alkohol' });
S.health.days[add(3)] = { sym: {}, f: { alkohol: true } };
S.nutrition.log[add(4)] = [{ name: 'Ebbelwoi', fl: 'da' }];
eq([X.auto(S, ea, add(3)), X.auto(S, ea, add(4)), X.auto(S, ea, add(5))], [{ v: false, why: 'Alkohol im Check-in' }, { v: false, why: 'Alkohol im Ernährungsprotokoll' }, null]);
eq(X.auto(S, eb, T), null, 'Bettzeit: keine Daten');

// 6. Vergleich: Kaffee-Regel über 14 Tage, Wirkung am Morgen danach
S = state();
const T0 = '2026-11-01', at = k => E.addDays(T0, k);
const ex = X.create({ tpl: 'kaffee', rule: 'Kein Kaffee nach 14 Uhr', when: 'abend', measures: ['sleepQ', 'sleepH', 'energy', 'sym:kopf', 'breath'], days: 14 }, P, T0, 'k1');
S.health.exps.push(ex);
const qBefore = [3, 2, 3, 4, 3, 3, 2, 3, 3, 4, 3, 3, 3, 2], hBefore = [6.5, 6, 7, 6.5, 6.5, 7, 6, 6.5, 6.5, 7, 6, 6.5, 6.5, 6.5];
const eBefore = [3, 3, 4, 2, 3, 3, 3, 4, 2, 3, 3, 3, 4, 3];
// Morgens vor dem Start (Tage -13 bis 0) zählen für die 14 Tage davor
for (let i = 0; i < 14; i++) S.health.days[at(i - 13)] = { sym: i % 5 === 0 ? { kopf: 1 } : {}, sleepQ: qBefore[i], sleepH: hBefore[i], energy: eBefore[i], f: {} };
const notKept = [2, 6, 10];
const qKept = [4, 4, 3, 4, 5, 4, 4, 4, 3, 4, 4], hKept = [7.5, 7, 7.5, 8, 7, 7.5, 7, 7.5, 7, 7.5, 8];
let ki = 0;
for (let k = 0; k < 14; k++) {
  const no = notKept.includes(k);
  ex.log[at(k)] = !no;
  const x = no ? { sleepQ: 3, sleepH: 6.5, energy: 3 } : { sleepQ: qKept[ki], sleepH: hKept[ki], energy: eBefore[ki] };
  if (!no) ki++;
  S.health.days[at(k + 1)] = Object.assign({ sym: {}, f: {} }, x);
}
let R = X.evaluate(S, ex, at(15));
eq([R.state, R.days, R.total, R.yes, R.no, R.open, R.before, R.beforeFull, R.ready], ['fertig', 14, 14, 11, 3, 0, 14, true, true]);
const by = k => R.res.find(r => r.key === k);
eq(by('sleepQ').ref, 'before');
eq([by('sleepQ').g.before.n, by('sleepQ').g.kept.n, by('sleepQ').g.not.n], [14, 11, 3]);
ok(Math.abs(by('sleepQ').g.before.mean - 41 / 14) < 1e-9 && Math.abs(by('sleepQ').g.kept.mean - 43 / 11) < 1e-9, 'Mittelwerte Schlafqualität');
eq(R.res.map(r => [r.key, r.verdict]), [['sleepQ', 'besser'], ['sleepH', 'besser'], ['energy', 'gleich'], ['sym:kopf', 'besser'], ['breath', 'wenig']], '3 von 14 Kopfschmerz-Tagen gegen keinen: auffällig genug');
eq(by('sym:kopf').lag, 1);
eq([by('sym:kopf').g.before.sum, by('sym:kopf').g.before.n, by('sym:kopf').g.kept.sum], [3, 14, 0]);
eq(X.verdictLine(R), 'Besser: Schlafqualität, Schlaf, Tage mit „Kopfschmerzen“. Kein klarer Unterschied: Energie. Zu wenige Einträge: Atem.');
eq([X.fmt(by('sleepQ').m, by('sleepQ').g.kept), X.fmt(by('sleepQ').m, by('sleepQ').g.before), X.fmt(by('sleepH').m, by('sleepH').g.kept), X.fmt(by('sym:kopf').m, by('sym:kopf').g.before)], ['3,9', '2,9', '7,4 h', 'an 3 von 14 Tagen']);
// Zwischenstand während des Experiments: nur Tage bis heute, der Morgen danach fehlt noch
R = X.evaluate(S, ex, at(4));
eq([R.state, R.days, R.yes, R.no, R.open], ['laeuft', 5, 4, 1, 0]);
eq(R.res.find(r => r.key === 'sleepQ').g.kept.n, 3, 'der Morgen nach heute fehlt noch: 3 Werte für die Regeltage bis gestern');
// Zu wenige Tage mit Regel
const ex3 = Object.assign({}, ex, { id: 'k3', log: { [at(0)]: true, [at(1)]: true, [at(2)]: true } });
R = X.evaluate(S, ex3, at(15));
eq([R.yes, R.ready, R.res[0].verdict], [3, false, 'wenig']);
// Ohne Einträge davor: Vergleich mit den Tagen ohne Regel
const S2 = JSON.parse(JSON.stringify(S));
for (let i = 0; i < 14; i++) delete S2.health.days[at(i - 13)];
R = X.evaluate(S2, S2.health.exps[0], at(15));
const q2 = R.res.find(r => r.key === 'sleepQ');
eq([q2.ref, q2.g.before.n, q2.g.not.n, q2.verdict], ['not', 0, 3, 'besser']);
// Tag-Regel: Atem am selben Tag, Schlaf in der Nacht danach
const et = X.create({ tpl: 'fruehstueck', rule: 'Morgens etwas essen', when: 'tag', measures: ['breath', 'sleepQ', 'mood'] }, P, T0, 't1');
eq(['breath', 'sleepQ', 'mood', 'sym'].map(k => X.lagOf(et, k)), [0, 1, 0, 0]);
eq(['breath', 'sleepQ', 'mood', 'sym:kopf'].map(k => X.lagOf(ex, k)), [1, 1, 1, 1]);
// Tage eines früheren Experiments zählen nicht als „davor“
const S3 = state(), e0 = X.create({ tpl: 'bett', rule: 'Um 22:30 ins Bett' }, P, at(-20), 'b0'), e1 = X.create({ tpl: 'kaffee', rule: 'Kein Kaffee nach 14 Uhr' }, P, T0, 'k2');
S3.health.exps.push(e0, e1);
const bd = X.beforeDays(S3, e1, at(20));
eq([bd.length, bd[0], bd[bd.length - 1]], [6, at(-6), at(-1)]);
eq(X.evaluate(S3, e1, at(20)).beforeFull, false);
eq(X.beforeDays(S3, e0, at(20)).length, 14, 'ein späteres Experiment stört das frühere nicht');
// Werte eines Tages
const S4 = state();
S4.health.days[T] = { sym: { kopf: 2, 'bm:nacken': 1 }, sleepH: 7, breath: 1, mood: 4, f: {} };
S4.health.days[add(1)] = { sym: {}, none: true, f: {} };
S4.health.days[add(2)] = { sym: {}, f: {} };
eq(['sleepH', 'breath', 'mood', 'energy', 'sym', 'sym:kopf', 'sym:augen'].map(k => X.value(S4, k, T)), [7, 1, 4, null, 1, 1, 0]);
eq([X.value(S4, 'sym', add(1)), X.value(S4, 'sym', add(2)), X.value(S4, 'mood', add(9))], [0, null, null], 'ohne Eintrag kein Wert');

// 7. Wörter
const m = k => X.measure(k);
eq([X.fmt(m('sleepH'), { n: 2, mean: 7.25 }), X.fmt(m('mood'), { n: 3, mean: 3.91 }), X.fmt(m('breath'), { n: 3, mean: 0.3 }), X.fmt(m('breath'), { n: 3, mean: 1.4 }), X.fmt(m('sym'), { n: 1, sum: 1, mean: 1 }), X.fmt(m('sym'), { n: 0 })],
  ['7,3 h', '3,9', 'frisch', 'schlecht', 'an 1 von 1 Tag', '–']);
eq([X.fmtDay(m('sleepH'), 7), X.fmtDay(m('mood'), 4), X.fmtDay(m('breath'), 1), X.fmtDay(m('sym'), 1), X.fmtDay(m('sym'), 0), X.fmtDay(m('mood'), null)], ['7 h', '4 von 5', 'geht so', 'ja', 'nein', 'kein Eintrag']);
eq([X.label(ex, m('mood')), X.label(ex, m('sym')), X.label(ex, m('sym:verspannt')), X.label(ex, m('sleepQ')), X.label(et, m('mood')), X.label(et, m('sleepH'))],
  ['Befinden am Tag danach', 'Beschwerden am Tag danach', '„Verspannt“ am Tag danach', 'Schlafqualität', 'Befinden', 'Schlaf']);
eq(X.VERDICT, { besser: 'besser', schlechter: 'schlechter', gleich: 'kein klarer Unterschied', wenig: 'zu wenige Einträge' });

// 8. Erinnerung
eq(X.remind(eb, P), { time: '22:15', title: 'Experiment: in 15 Minuten ins Bett' });
eq(X.remind(ek, P), { time: '13:45', title: 'Experiment: ab 14 Uhr kein Kaffee mehr' });
eq(X.remind(mk({ tpl: 'kaffee', rule: 'Kein Kaffee nach 15:30 Uhr' }), P), { time: '15:15', title: 'Experiment: ab 15:30 Uhr kein Kaffee mehr' });
eq(X.remind(ef, P).time, '06:30', 'eine halbe Stunde nach dem Aufstehen');
eq(X.remind(ef, {}).time, '07:00', 'ohne Aufstehzeit 6:30');
eq(X.remind(mk({ tpl: 'eigen', rule: 'Kein Handy im Bett', when: 'abend' }), P), { time: '20:00', title: 'Experiment: Kein Handy im Bett' });
eq([X.hm('00:10', -15), X.hm('23:50', 20), X.hm('7:5', 0)], ['23:55', '00:10', '07:05']);

// 9. Vorschläge aus den eigenen Daten
S = state();
eq(Object.keys(X.hints(Object.assign(state(), { health: { days: {}, profile: {} } }), T)), [], 'ohne Daten keine');
for (let k = 1; k <= 14; k++) S.health.days[add(-k)] = { sym: {}, sleepH: 6.5, f: k <= 5 ? { wasser: 1.5 } : {} };
[1, 3, 8, 12].forEach(k => { S.health.days[add(-k)].sym.verspannt = 1; });
[2, 4, 9].forEach(k => { S.health.days[add(-k)].sym.beine_unruhig = 1; S.health.days[add(-k)].f.alkohol = true; });
[1, 5, 20].forEach(k => { S.nutrition.log[add(-k)] = [{ name: 'Kaffee', cups: 1, time: '15:00', fl: 'dhk' }]; });
const hs = X.hints(S, T);
eq(hs, {
  bett: 'Schlafmangel ist dein häufigster Auslöser, zuletzt 6,5 h statt 7,5 h Schlaf.',
  kaffee: 'Kaffee nach 14 Uhr an 3 der letzten 30 Tage.',
  fruehstueck: 'Passt zu deinem Verdacht: Mundgeruch bei Hunger.',
  wasser: 'Im Schnitt 1,5 l am Tag laut Check-in.',
  dehnen: 'Verspannt an 4, unruhige Beine an 3 der letzten 30 Tage.',
  alkohol: 'Alkohol an 3 der letzten 30 Tage.'
});
S.health.profile.triggers = [];
eq(X.hints(S, T).bett, 'Zuletzt 6,5 h statt 7,5 h Schlaf.');

console.log('exp_test: ' + n + ' Prüfungen bestanden');
