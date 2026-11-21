// Reisen mit Packliste (2.11): Anlegen, Tage und Status, Anlass, Wetter-Adressen und Tageswerte, Kontext,
// Budgets, Plan mit wenig Gepäck, Packliste, Fortschritt, Zeile für Heute. Testdaten aus tests/fixtures.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const T = require('../src/trip.js');
const E = require('../src/engine.js');
let n = 0;
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };
const state = () => { const S = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'test-seed.json'), 'utf8')); S.trips = []; S.health.meds = S.health.meds || []; return S; };
const TODAY = '2026-11-22';

// 1. Anlegen, Tage, Nächte, Status, Titel, Zeitraum
let t = T.create({ name: ' Städtetrip ', loc: { name: 'Musterküste (Küste)', lat: 38.7, lon: -9.1 }, from: '2026-12-03', to: '2026-12-07', kind: 'privat' }, TODAY, 't1');
eq([t.id, t.name, t.kind, t.from, t.to, t.occ, t.packed, t.extra, t.wx], ['t1', 'Städtetrip', 'privat', '2026-12-03', '2026-12-07', {}, {}, [], null]);
eq(T.dates(t), ['2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06', '2026-12-07']);
eq([T.nights(t), T.status(t, TODAY), T.status(t, '2026-12-05'), T.status(t, '2026-12-08'), T.title(t), T.range(t)], [4, 'geplant', 'unterwegs', 'vorbei', 'Städtetrip', '3.12. bis 7.12.']);
// Ohne Namen heißt die Reise wie das Ziel (ohne Klammer); Ende vor dem Beginn wird zum Beginn; höchstens 28 Tage
const t0 = T.create({ loc: { name: 'Musterküste (Küste)', lat: 1, lon: 2 }, from: '2026-12-03', to: '2026-12-01' }, TODAY);
eq([T.title(t0), t0.to, T.range(t0), T.nights(t0), t0.id.startsWith('t')], ['Musterküste', '2026-12-03', '3.12.', 0, true]);
eq(T.create({ from: '2027-01-01', to: '2027-03-01' }, TODAY).to, '2027-01-28');
eq([T.title(T.create({}, TODAY)), T.create({}, TODAY).from], ['Reise', TODAY]);
// 2. Anlass: privat immer Freizeit, Arbeit an Werktagen Smart Casual, gewählt geht vor
const ta = T.create({ from: '2026-12-03', to: '2026-12-07', kind: 'arbeit' }, TODAY, 'a');  // Do bis Mo
eq(T.dates(ta).map(d => T.occ(ta, d)), ['smart', 'smart', 'freizeit', 'freizeit', 'smart']);
ta.occ['2026-12-03'] = 'termin';
eq([T.occ(ta, '2026-12-03'), T.occ(t, '2026-12-03')], ['termin', 'freizeit']);
// 3. Wetter-Adressen: Vorhersage bis 15 Tage voraus (ab heute, nicht ab einem Beginn in der Vergangenheit), sonst Vorjahr
let q = T.wxUrl(t, TODAY);
eq(q.kind, 'vorhersage');
ok(q.url.startsWith('https://api.open-meteo.com/v1/forecast?latitude=38.7&longitude=-9.1&daily=') && q.url.includes('&start_date=2026-12-03&end_date=2026-12-07') && q.url.includes('apparent_temperature_min') && q.url.includes('timezone=auto'), q.url);
eq(T.wxUrl(t, '2026-12-05').url.includes('start_date=2026-12-05&end_date=2026-12-07'), true);
q = T.wxUrl(T.create({ loc: t.loc, from: '2027-02-10', to: '2027-02-14' }, TODAY), TODAY);
eq(q.kind, 'vorjahr');
ok(q.url.startsWith('https://archive-api.open-meteo.com/v1/archive?') && q.url.includes('start_date=2026-02-03&end_date=2026-02-21') && !q.url.includes('probability'), q.url);
eq([T.wxKind(t, TODAY), T.wxKind(t, '2026-11-21'), T.wxKind(t, '2026-12-08'), T.wxUrl(T.create({}, TODAY), TODAY)], ['vorhersage', 'vorjahr', 'vorjahr', null], '15 Tage voraus noch Vorhersage, 16 nicht mehr; vorbei ebenfalls nicht');
// 4. Tageswerte aus einer Vorhersage und aus dem Vorjahr
const fc = { daily: { time: ['2026-12-03', '2026-12-04'], weather_code: [1, 61], temperature_2m_max: [15, 16], temperature_2m_min: [9, 9], apparent_temperature_max: [14, 15], apparent_temperature_min: [7, 7.4], precipitation_sum: [0, 4], precipitation_probability_max: [15, 80], uv_index_max: [2, 1] } };
let w = T.wxDaily(fc, 'vorhersage', t);
eq(w, { kind: 'vorhersage', n: 2, days: { '2026-12-03': { tn: 9, tx: 15, an: 7, ax: 14, r: 15, code: 1, uv: 2 }, '2026-12-04': { tn: 9, tx: 16, an: 7.4, ax: 15, r: 80, code: 61, uv: 1 } } });
// Ohne gefühlte Temperatur und ohne Wahrscheinlichkeit: Lufttemperatur und Regenmenge ersatzweise
eq(T.wxDaily({ daily: { time: ['2026-12-03'], temperature_2m_max: [10], temperature_2m_min: [2], precipitation_sum: [3] } }, 'vorhersage', t).days['2026-12-03'], { tn: 2, tx: 10, an: 2, ax: 10, r: 70, code: undefined, uv: undefined });
eq([T.wxDaily(null, 'vorhersage', t), T.wxDaily({ daily: { time: [] } }, 'vorhersage', t), T.wxDaily({ daily: { time: ['2026-12-03'], temperature_2m_max: [null], temperature_2m_min: [1] } }, 'vorhersage', t)], [null, null, null]);
const arch = { daily: { time: [], temperature_2m_max: [], temperature_2m_min: [], apparent_temperature_max: [], apparent_temperature_min: [], precipitation_sum: [] } };
for (let i = 0; i < 19; i++) { arch.daily.time.push(E.addDays('2025-11-26', i)); arch.daily.temperature_2m_max.push(10 + (i % 4)); arch.daily.temperature_2m_min.push(2 + (i % 2)); arch.daily.apparent_temperature_max.push(9); arch.daily.apparent_temperature_min.push(0); arch.daily.precipitation_sum.push(i % 3 === 0 ? 2 : 0); }
w = T.wxDaily(arch, 'vorjahr', t);
eq([w.kind, w.n, Object.keys(w.days)], ['vorjahr', 19, T.dates(t)]);
eq(w.days['2026-12-05'], { tn: 2.5, tx: 11.4, an: 0, ax: 9, r: 37, code: null, cold: 2, warm: 13 });
eq(T.wxDaily({ daily: { time: arch.daily.time.slice(0, 5), temperature_2m_max: [1, 2, 3, 4, 5], temperature_2m_min: [0, 0, 0, 0, 0] } }, 'vorjahr', t), null, 'unter sieben Tagen kein Mittel');
ok(T.wxText(null).startsWith('Noch kein Wetter') && T.wxText({ kind: 'vorhersage' }).startsWith('Vorhersage') && T.wxText({ kind: 'vorjahr' }).includes('Vorjahr'));
// 5. Kontext: unterwegs der kühlere Teil des Tages, tagsüber der wärmere; ohne Wetter die Jahreszeit
const S = state();
t.wx = { kind: 'vorhersage', days: { '2026-12-03': { tn: 9, tx: 15, an: 7, ax: 17, r: 80, code: 61 } } };
let c = T.ctx(S, t, '2026-12-03');
eq([c.tOut, c.tDay, c.rain, c.code, c.src, c.occasion, c.needCoat, c.needWinter, c.dayType], [10, 14.5, 80, 61, 'vorhersage', 'freizeit', true, false, 'frei']);
eq(c.effT, 12.25 - 2, 'kälteempfindlich: 2 Grad weniger');
c = T.ctx(S, t, '2026-12-04');
eq([c.src, c.tOut, c.rain, c.code], ['saison', 3, 0, null]);
eq(T.tempLine(T.ctx(S, t, '2026-12-03')), '10° bis 15° gefühlt, Regen möglich');
// 6. Budgets: Hemden einmal, Strick drei Tage, Hosen drei Tage, Schuhe beliebig; mehr bei Stückzahl und ab acht Tagen
eq([T.budget({ role: 'tee' }, 5), T.budget({ role: 'shirt', qty: 3 }, 5), T.budget({ role: 'knit' }, 5), T.budget({ role: 'bottom' }, 5), T.budget({ role: 'shoes' }, 5), T.budget({ role: 'tee' }, 8), T.budget({ role: 'bottom' }, 15)], [1, 3, 3, 3, Infinity, 2, 9]);
// 7. Plan: ein Outfit je Tag, Teile werden wiederverwendet, höchstens zwei Paar Schuhe, eine Jacke, Budgets eingehalten
T.dates(t).forEach((d, i) => { t.wx.days[d] = { tn: 9, tx: 15 + i, an: 7, ax: 14 + i, r: i === 2 ? 80 : 20, code: i === 2 ? 61 : 1 }; });
const laundry = S.wardrobe.items.find(i => i.role === 'bottom' && i.status === 'aktiv'); laundry.laundry = true;
let p = T.plan(S, t);
eq(p.days.length, 5);
ok(p.days.every(x => x.o && x.o.tops.length && x.o.bottom && x.o.shoes), 'jeder Tag ein ganzes Outfit');
const shoes = new Set(p.days.map(x => x.o.shoes.id));
ok(shoes.size <= 2, 'höchstens zwei Paar Schuhe: ' + shoes.size);
ok(p.outer && p.outer.role === 'coat' && p.days.every(x => x.o.outer === p.outer), 'ein Mantel für alle Tage (9° gefühlt)');
ok(p.bag.length < 5 * 4, 'weniger Teile als Tage mal Teile: ' + p.bag.length);
for (const it of p.bag) ok((p.uses.get(it.id) || 0) <= T.budget(it, 5), 'Budget ' + it.label);
const bottoms = p.bag.filter(i => i.role === 'bottom');
ok(bottoms.length <= 2 && bottoms.length >= 1, 'ein bis zwei Hosen: ' + bottoms.length);
const tees = p.days.map(x => x.o.tops[0].id);
eq(new Set(tees).size, tees.length, 'kein Hemd oder T-Shirt zweimal');
// Teile in der Wäsche zählen mit; der Plan ist bei gleichen Daten gleich
ok(S.wardrobe.items.some(i => i.laundry) && p.bag.length > 0);
eq(T.plan(S, t).bag.map(i => i.id), p.bag.map(i => i.id), 'deterministisch');
// Warme Reise: keine Jacke; sehr kalte: Winterjacke oder Hinweis
const tw = T.create({ from: '2026-12-03', to: '2026-12-05' }, TODAY, 'w'); tw.wx = { kind: 'vorhersage', days: {} };
T.dates(tw).forEach(d => { tw.wx.days[d] = { tn: 22, tx: 30, an: 23, ax: 31, r: 0, code: 0 }; });
const pw = T.plan(S, tw);
eq([pw.outer, pw.outerHint, pw.days.every(x => !x.o.outer)], [null, null, true]);
const tc = T.create({ from: '2026-12-03', to: '2026-12-05' }, TODAY, 'c'); tc.wx = { kind: 'vorhersage', days: {} };
T.dates(tc).forEach(d => { tc.wx.days[d] = { tn: -5, tx: 1, an: -8, ax: -1, r: 0, code: 71 }; });
const pc = T.plan(S, tc);
ok((pc.outer && pc.outer.role === 'winter') || pc.outerHint === 'Winterjacke');
ok(pc.acc.some(a => a.role === 'scarf') || !S.wardrobe.items.some(i => i.role === 'scarf' && i.status === 'aktiv'), 'Schal bei Kälte, wenn vorhanden');
// Anlass Termin bringt ein formelleres Outfit
const tt = T.create({ from: '2026-12-03', to: '2026-12-03' }, TODAY, 'tt'); tt.wx = t.wx; tt.occ['2026-12-03'] = 'termin';
const pt = T.plan(S, tt);
ok(pt.days[0].o.fBody > T.plan(S, Object.assign({}, tt, { occ: {} })).days[0].o.fBody, 'Termin formeller als Freizeit');
// 8. Packliste: Gruppen, Mengen, Unterwäsche, Kulturbeutel, Werkzeug für Rhythmen, Medikamente, Sonstiges, Eigenes
S.health.meds = [{ id: 'm1', name: 'Beispielmittel', dose: '1 Tablette', times: ['08:00', '20:00'], start: '2026-11-20', end: '2026-12-04', stopped: false }, { id: 'm2', name: 'Altes', dose: '', times: ['08:00'], start: '2026-01-01', end: '2026-02-01' }, { id: 'm3', name: 'Abgesetzt', times: ['08:00'], start: '2026-11-01', end: null, stopped: true }];
S.grooming.last = { bart: '2026-12-01', kopf: '2026-11-20', naegel: '2026-11-01' };
t.extra = ['Buch', 'Ladekabel Uhr'];
const G = T.list(S, t, p);
eq(G.map(g => [g.k, g.l]), [['kleidung', 'Kleidung'], ['pflege', 'Kulturbeutel'], ['medikamente', 'Medikamente'], ['sonstiges', 'Sonstiges']]);
const K = G[0].items;
eq(K[0].name, p.outer.label, 'Jacke zuerst');
eq(K.slice(-2).map(x => [x.key, x.name, x.n]), [['x:unter', 'Unterwäsche und Socken', 6], ['x:schlaf', 'Schlafsachen', 1]]);
ok(K.filter(x => x.it).every(x => x.n >= 1 && x.key === 'it:' + x.it.id));
const sh = K.find(x => x.it && x.it.role === 'shoes');
ok(sh && /\d Tage?$/.test(sh.sub), 'Schuhe mit Tagen: ' + sh.sub);
const PF = G[1].items;
ok(PF.some(x => x.key === 'x:zahn') && PF.filter(x => x.key.startsWith('p:')).length === S.grooming.products.filter(x => x.have && !x.optional).length);
const tool = PF.find(x => x.key.startsWith('w:'));
ok(tool && tool.name === 'Beispiel' && tool.sub.includes('Bart auf 3-Tage-Länge trimmen') && tool.sub.includes('Fingernägel') && tool.sub.endsWith(' sind unterwegs dran'), 'Werkzeug mit fälligen Rhythmen: ' + (tool && tool.sub));
eq(PF.filter(x => x.key.startsWith('w:')).length, 1, 'ein Eintrag je Werkzeug');
eq(G[2].items.map(x => [x.name, x.sub]), [['Beispielmittel', '1 Tablette, 4× (2 Tage)']]);
const O = G[3].items;
eq(O.map(x => x.key), ['x:papiere', 'x:lader', 'x:hoerer', 'x:schirm', 'e:0', 'e:1']);
eq(O.slice(-2).map(x => [x.name, x.own]), [['Buch', true], ['Ladekabel Uhr', true]]);
// Warm: Sonnenbrille, kein Schirm; Arbeit: Laptop; ohne Medikamente keine Gruppe
const Gw = T.list(S, Object.assign({}, tw, { kind: 'arbeit', extra: [] }), pw);
eq(Gw[Gw.length - 1].items.map(x => x.key), ['x:papiere', 'x:lader', 'x:hoerer', 'x:sonne', 'x:laptop']);
eq(Gw.map(g => g.k), ['kleidung', 'pflege', 'medikamente', 'sonstiges']);
eq(T.list(state(), tw, pw).map(g => g.k), ['kleidung', 'pflege', 'sonstiges'], 'ohne Medikamente keine Gruppe');
eq(T.list(S, tw, pw)[0].items.some(x => x.key === 'x:schlaf'), true);
eq(T.list(S, T.create({ from: '2026-12-03', to: '2026-12-03' }, TODAY, 'd1'))[0].items.some(x => x.key === 'x:schlaf'), false, 'Tagesausflug ohne Schlafsachen');
// Lange Reise: Unterwäsche für eine Woche mit Hinweis
const tl = T.create({ from: '2026-12-03', to: '2026-12-14' }, TODAY, 'l');
const ul = T.list(S, tl)[0].items.find(x => x.key === 'x:unter');
eq([ul.n, ul.sub], [8, 'für eine Woche, unterwegs waschen']);
// 9. Fortschritt
eq(T.progress(t, G), { done: 0, total: G.reduce((a, g) => a + g.items.length, 0) });
t.packed = { 'x:unter': true, 'e:0': true, 'nix': true };
eq(T.progress(t, G).done, 2);
// 10. Zeile für Heute: die nächste Reise binnen einer Woche oder unterwegs, sonst nichts
S.trips = [t, T.create({ from: '2027-01-10', to: '2027-01-12' }, TODAY, 'far')];
eq(T.todayLine(S, '2026-11-25'), null, 'noch acht Tage hin');
eq([T.todayLine(S, '2026-11-26').t.id, T.todayLine(S, '2026-11-26').st, T.todayLine(S, '2026-11-26').inDays], ['t1', 'geplant', 7]);
eq([T.todayLine(S, '2026-12-05').st, T.todayLine(S, '2026-12-05').inDays], ['unterwegs', -2]);
eq(T.todayLine(S, '2026-12-08'), null, 'vorbei, die nächste ist weit');
eq(T.todayLine(S, '2027-01-11').t.id, 'far');
eq(T.todayLine({ trips: [] }, TODAY), null);

console.log('trip_test: ' + n + ' Prüfungen bestanden');
