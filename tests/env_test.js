/* Wetter, Pollen und Luft je Tag (2.8): Belastungsstufen, Tageswerte aus Stundenwerten, was abgefragt wird,
   Einflüsse für die Muster und der Vergleich mit Beschwerden in Health.symDetail. Aufruf: node tests/env_test.js */
'use strict';
const assert = require('assert');
const path = require('path');
const Env = require(path.join(__dirname, '..', 'src', 'env.js'));
const E = require(path.join(__dirname, '..', 'src', 'engine.js'));
const H = require(path.join(__dirname, '..', 'src', 'health.js'));
let n = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); n++; };

// 1. Pollen-Stufen nach MeteoSchweiz (Tagesmittel, Pollen je m³)
const L = (id, v) => Env.polLevel(id, v);
eq([L('bi', 0), L('bi', 0.9), L('bi', 1), L('bi', 10.9), L('bi', 11), L('bi', 69), L('bi', 70), L('bi', 299), L('bi', 300)], [0, 0, 1, 1, 2, 2, 3, 3, 4], 'Birke');
eq([L('er', 10), L('er', 11), L('er', 70), L('er', 249), L('er', 250)], [1, 2, 3, 3, 4], 'Erle');
eq([L('gr', 19), L('gr', 20), L('gr', 49), L('gr', 50), L('gr', 149), L('gr', 150)], [1, 2, 2, 3, 3, 4], 'Gräser');
eq([L('bf', 5), L('bf', 6), L('bf', 14), L('bf', 15), L('bf', 50)], [1, 2, 2, 3, 4], 'Beifuß');
eq([L('am', 5), L('am', 6), L('am', 10), L('am', 11), L('am', 39), L('am', 40)], [1, 2, 2, 3, 3, 4], 'Ambrosia');
eq([L('bi', null), L('xx', 5), L('bi', NaN)], [null, null, null], 'ohne Wert');
eq(Env.LEVEL, ['keine', 'schwach', 'mäßig', 'stark', 'sehr stark']);

// 2. Europäischer Luftqualitätsindex
eq([0, 19.9, 20, 39, 40, 59, 60, 80, 99, 100, 180].map(v => Env.aqiBand(v).l), ['gut', 'gut', 'ausreichend', 'ausreichend', 'mäßig', 'mäßig', 'schlecht', 'sehr schlecht', 'sehr schlecht', 'extrem schlecht', 'extrem schlecht']);
eq(Env.aqiBand(null), null);

// 3. Pollen eines Tages: höchste Stufe, Arten stärkste zuerst
const day = { pol: { er: 0, bi: 120, gr: 25, bf: 2, am: 0 } };
eq(Env.pollen(day).max, 3);
eq(Env.pollen(day).list.map(p => p.id), ['bi', 'gr', 'bf']);
eq(Env.polText(day), 'Birke stark, Gräser mäßig, Beifuß schwach');
eq(Env.polText(day, 2), 'Birke stark, Gräser mäßig');
eq(Env.pollen({ pol: {} }), null);
eq(Env.pollen({}), null);
eq(Env.polText({ pol: { bi: 0.4 } }), '', 'unter 1 keine');

// 4. Tageswerte aus Stundenwerten
const today = '2026-11-20';
function hourly(days, f) {
  const H0 = { time: [] };
  days.forEach((d, k) => { for (let h = 0; h < 24; h++) { H0.time.push(d + 'T' + String(h).padStart(2, '0') + ':00'); Object.entries(f(d, h, k)).forEach(([key, v]) => { (H0[key] || (H0[key] = [])).push(v); }); } });
  return { hourly: H0 };
}
const wxJson = hourly(['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'], (d, h, k) => ({ temperature_2m: 5 + k + (h < 12 ? -2 : 2), pressure_msl: 1010 + k, precipitation: h === 6 ? 1.2 : 0 }));
const wx = Env.daily(wxJson, 'wx', today);
eq(Object.keys(wx), ['2026-11-18', '2026-11-19', '2026-11-20'], 'kein Tag nach heute');
eq(wx['2026-11-18'], { tn: 3, tx: 7, tm: 5, p: 1010, r: 1.2, fw: 1 });
eq(wx['2026-11-20'].tm, 7);
const part = hourly(['2026-11-19'], () => ({ temperature_2m: 4, pressure_msl: null, precipitation: 0 }));
part.hourly.time = part.hourly.time.slice(0, 10); part.hourly.temperature_2m = part.hourly.temperature_2m.slice(0, 10);
eq(Env.daily(part, 'wx', today)['2026-11-19'], { fw: 1 }, 'unvollständiger Tag: nur als abgefragt markiert');
const aqJson = hourly(['2026-11-19', '2026-11-20'], (d, h, k) => ({ european_aqi: k ? 50 : 20 + h % 3, alder_pollen: null, birch_pollen: k ? 80 : null, grass_pollen: 0, mugwort_pollen: null, ragweed_pollen: null }));
const aq = Env.daily(aqJson, 'aq', today);
eq(aq['2026-11-19'], { aq: 21, pol: { gr: 0 }, fa: 1 });
eq(aq['2026-11-20'], { aq: 50, pol: { bi: 80, gr: 0 }, fa: 1 });
eq(Env.daily({}, 'aq', today), {});
eq(Env.daily({ hourly: { time: 'x' } }, 'wx', today), {});

// 5. Zusammenführen und Vollständigkeit
const env = { days: {} };
Env.merge(env, wx); Env.merge(env, aq);
ok(Env.complete(env.days['2026-11-19']) && Env.complete(env.days['2026-11-20']), 'Wetter und Luft da');
ok(!Env.complete(env.days['2026-11-18']), 'nur Wetter');
eq(env.days['2026-11-20'].tm, 7); eq(env.days['2026-11-20'].aq, 50);

// 6. Was abgefragt wird
const now = new Date(2026, 10, 20, 9, 0).getTime();
const full = (from, to) => { const D = {}; for (let d = from; d <= to; d = E.addDays(d, 1)) D[d] = { tm: 5, aq: 20, fw: 1, fa: 1 }; return D; };
eq(Env.need({ days: {} }, null, today, now), { past: 1, gap: null }, 'ohne Check-ins: gestern und heute');
eq(Env.need({ days: {} }, '2026-11-17', today, now), { past: 3, gap: null }, 'ab dem Tag vor dem ersten Check-in');
eq(Env.need({ days: {} }, '2026-07-01', today, now), { past: 92, gap: ['2026-07-01', '2026-08-19'] }, 'ältere Tage aus dem Archiv');
eq(Env.need({ days: {} }, '2024-01-01', today, now), { past: 92, gap: ['2025-11-20', '2026-08-19'] }, 'höchstens ein Jahr zurück');
eq(Env.need({ days: full('2026-11-10', today), at: now - 3600e3 }, '2026-11-12', today, now), { past: 0, gap: null }, 'alles da, frisch');
eq(Env.need({ days: full('2026-11-10', today), at: now - 4 * 3600e3 }, '2026-11-12', today, now), { past: 1, gap: null }, 'veraltet: gestern und heute neu');
eq(Env.need({ days: full('2026-11-10', today), at: new Date(2026, 10, 19, 22, 0).getTime() }, '2026-11-12', today, now), { past: 1, gap: null }, 'neuer Tag');
const holes = full('2026-11-01', today); delete holes['2026-11-14']; holes['2026-11-16'] = { tm: 4, fw: 1 };
eq(Env.need({ days: holes, at: now }, '2026-11-05', today, now), { past: 6, gap: null }, 'Lücke ab dem 14.');
eq(Env.need({ days: full('2026-07-01', today), at: now }, '2026-07-01', today, now), { past: 0, gap: null }, 'Archiv schon da');
eq(Env.need({ days: full('2026-11-10', today), at: now }, today, today, now), { past: 0, gap: null }, 'erster Check-in heute');

// 7. Adressen
const loc = { lat: 50.2, lon: 8.58 };
const u1 = Env.url('wx', loc, { past: 5 });
ok(u1.startsWith('https://api.open-meteo.com/v1/forecast?latitude=50.2&longitude=8.58&hourly=temperature_2m,pressure_msl,precipitation&timezone=Europe%2FBerlin') && u1.endsWith('&past_days=5&forecast_days=1'), u1);
const u2 = Env.url('aq', loc, { past: 92 });
ok(u2.startsWith('https://air-quality-api.open-meteo.com/v1/air-quality?') && u2.includes('hourly=european_aqi,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen') && u2.endsWith('&past_days=92&forecast_days=1'), u2);
const u3 = Env.url('wx', loc, { start: '2026-07-01', end: '2026-08-19' });
ok(u3.startsWith('https://archive-api.open-meteo.com/v1/archive?') && u3.endsWith('&start_date=2026-07-01&end_date=2026-08-19') && !u3.includes('past_days'), u3);
const u4 = Env.url('aq', loc, { start: '2026-07-01', end: '2026-08-19' });
ok(u4.startsWith('https://air-quality-api.open-meteo.com/') && u4.includes('start_date=2026-07-01'), u4);

// 8. Einflüsse eines Tages
const E2 = { days: {
  '2026-11-01': { tn: 2, tx: 9, tm: 6, p: 1015, aq: 20, pol: { bi: 5 } },
  '2026-11-02': { tn: -2, tx: 4, tm: 1, p: 1008, aq: 45, pol: { bi: 15 } },
  '2026-11-03': { tn: 15, tx: 26, tm: 20, p: 1009 } } };
const T = Object.fromEntries(Env.tests(E2).map(([l, f]) => [l, f]));
eq(Object.keys(T).length, 10);
eq(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04'].map(T['Kalter Tag (höchstens 5 °C)']), [false, true, false, null]);
eq(['2026-11-01', '2026-11-03'].map(T['Warmer Tag (ab 25 °C)']), [false, true]);
eq(['2026-11-01', '2026-11-02', '2026-11-03'].map(T['Temperatursturz (5 Grad kälter als am Vortag)']), [null, true, false]);
eq(['2026-11-01', '2026-11-02', '2026-11-03'].map(T['Luftdruck fällt (5 hPa zum Vortag)']), [null, true, false]);
eq(['2026-11-01', '2026-11-02', '2026-11-03'].map(T['Luftqualität mäßig oder schlechter']), [false, true, null]);
eq(['2026-11-01', '2026-11-02', '2026-11-03'].map(T['Birkenpollen mäßig oder stärker']), [false, true, null]);
eq(T['Gräserpollen mäßig oder stärker']('2026-11-01'), null);

// 9. Überblick über einen Zeitraum
const s = Env.summary(E2, '2026-10-31', '2026-11-03');
eq([s.n, s.tn, s.tx, s.sturz, s.druck, s.aq, s.aqBad, s.polDays], [3, -2, 26, 1, 1, 33, 1, 1]);
eq(s.polList.map(p => [p.l, p.n, p.mod, p.max]), [['Birke', 2, 1, 2]]);

// 10. Mit Beschwerden: gereizte Augen an Tagen mit viel Birkenpollen, Kopfschmerzen bei fallendem Luftdruck
const t0 = '2026-05-30', S = { health: { days: {}, profile: {} }, training: { sessions: [], runs: [] }, settings: { week: {} }, env: { days: {} } };
for (let k = 60; k >= 0; k--) {
  const d = E.addDays(t0, -k), x = { sym: {}, meas: [], f: {}, sleepH: 7.5, mood: 3 };
  const birch = k % 4 === 1, drop = k % 9 === 0;
  S.env.days[d] = { tn: 10, tx: 20, tm: 15, p: drop ? 1006 : 1014, aq: 25, pol: { bi: birch ? 120 : 3, gr: 4 }, fw: 1, fa: 1 };
  if (birch) x.sym.augen = 2;
  if (drop) x.sym.kopf = 1;
  if (k % 7 === 3) x.sym.augen = 1;
  if (!Object.keys(x.sym).length) x.none = true;
  S.health.days[d] = x;
}
const from = E.addDays(t0, -60);
const augen = H.symDetail(S, 'augen', from, t0), kopf = H.symDetail(S, 'kopf', from, t0);
const fa = augen.factors.find(f => f.label === 'Birkenpollen mäßig oder stärker');
ok(fa && fa.env && fa.pn === 15 && fa.pk === augen.n && fa.b === 0, 'Augen und Birke: ' + JSON.stringify(augen.factors));
const fk = kopf.factors.find(f => f.label === 'Luftdruck fällt (5 hPa zum Vortag)');
ok(fk && fk.env && fk.pn === kopf.n && fk.lift === 9, 'Kopf und Luftdruck: ' + JSON.stringify(kopf.factors));
ok(!augen.factors.some(f => f.label.startsWith('Luftdruck')), 'kein falscher Zusammenhang');
ok(!kopf.factors.some(f => f.label.startsWith('Gräser')), 'Gräser nur schwach');
eq(augen.temp, { with: 15, without: 15 });
ok(augen.factors.filter(f => !f.env).every(f => !f.label.includes('pollen')), 'Kennzeichnung env');
// Ohne gespeicherte Werte keine Umwelt-Einflüsse
const S2 = JSON.parse(JSON.stringify(S)); delete S2.env;
ok(!H.symDetail(S2, 'augen', from, t0).factors.some(f => f.env), 'ohne S.env');
eq(H.symDetail(S2, 'augen', from, t0).temp, { with: null, without: null });

// 11. Eigene Pollenarten (2.9, K48): aus dem Text der Allergien, gewählt in der App, leere Wahl heißt alle
eq(Env.fromText('Gräserpollen (leicht)'), ['gr']);
eq(Env.fromText('Birken- und Gräserpollen'), ['bi', 'gr']);
eq(Env.fromText('Gras, Erle, Beifuß, Ambrosia'), ['er', 'gr', 'bf', 'am']);
eq(Env.fromText('Ragweed'), ['am']);
eq([Env.fromText('Hausstaub (leicht)'), Env.fromText('Erlebnis'), Env.fromText('Grasmilben'), Env.fromText(''), Env.fromText(null)], [[], [], [], [], []], 'nur ganze Wörter');
const Sx = { health: { profile: {}, record: { allergies: 'Heuschnupfen, Gräserpollen' } } };
eq([Env.sel(Sx), Env.selSource(Sx)], [['gr'], 'bericht']);
Sx.health.profile.pollen = ['gr', 'bi'];
eq([Env.sel(Sx), Env.selSource(Sx)], [['bi', 'gr'], 'eigen'], 'Reihenfolge wie in der Tabelle');
Sx.health.profile.pollen = [];
eq([Env.sel(Sx), Env.selSource(Sx)], [null, 'alle'], 'leere Wahl: alle Arten, ohne Bericht');
eq([Env.sel({ health: { profile: {}, record: {} } }), Env.selSource({ health: { profile: {} } }), Env.sel(null)], [null, null, null]);
eq(Env.sel({ health: { profile: { pollen: ['xx'] } } }), null, 'unbekannte Art');
const dd = { pol: { er: 0, bi: 120, gr: 30, bf: 0, am: 0 } };
eq(Env.polText(dd, 2, ['gr']), 'Gräser mäßig');
eq(Env.pollen(dd, ['gr']).max, 2);
eq(Env.pollen(dd, ['am']), { max: 0, list: [] }, 'Art fliegt nicht');
eq(Env.rest(['gr']), ['er', 'bi', 'bf', 'am']);
eq(Env.rest(null), []);
eq(Env.tests({ days: {} }, ['gr']).map(t => t[0]).filter(l => l.includes('pollen')), ['Gräserpollen mäßig oder stärker']);
eq(Env.tests({ days: {} }).filter(t => t[0].includes('pollen')).length, 5, 'ohne Wahl alle fünf');
// Überblick mit Wahl: eigene Arten, andere mit mäßigen Tagen getrennt
const envS = { days: { '2026-06-01': { tm: 18, pol: { bi: 120, gr: 30 } }, '2026-06-02': { tm: 18, pol: { bi: 80, gr: 10 } }, '2026-06-03': { tm: 18, pol: { bi: 5, gr: 2 } } } };
const sg = Env.summary(envS, '2026-06-01', '2026-06-03', ['gr']);
eq(sg.polList.map(q => [q.l, q.n, q.mod]), [['Gräser', 3, 1]]);
eq(sg.other.map(q => [q.l, q.mod]), [['Birke', 2]]);
eq(sg.polDays, 1);
eq(Env.summary(envS, '2026-06-01', '2026-06-03').other, [], 'ohne Wahl keine anderen');
// symDetail vergleicht nur die eigenen Arten: Birke fällt weg, wenn nur Gräser gewählt sind
const S3 = JSON.parse(JSON.stringify(S)); S3.health.profile.pollen = ['gr'];
ok(!H.symDetail(S3, 'augen', from, t0).factors.some(f => f.label.startsWith('Birkenpollen')), 'Birke nicht gewählt');
S3.health.profile.pollen = ['bi'];
ok(H.symDetail(S3, 'augen', from, t0).factors.some(f => f.label.startsWith('Birkenpollen')), 'Birke gewählt');

console.log('env_test: ' + n + ' Prüfungen bestanden');
