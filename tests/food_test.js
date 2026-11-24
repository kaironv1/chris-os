// Version 2.7: food table, text recognition, day totals, factors from the nutrition log, trend analytics.
// Aufruf: node tests/food_test.js
const assert = require('assert');
const F = require('../src/food.js');
const E = require('../src/engine.js');
const H = require('../src/health.js');

let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };
const P = (t, ctx) => F.parse(t, ctx || {});
const one = (t, ctx) => { const r = P(t, ctx); eq(r.items.length, 1, t + ': ' + JSON.stringify(r.items.map(i => i.name))); return r.items[0]; };

// 1. Table: complete rows, plausible energy (4 kcal per g protein and carbs, 9 per g fat, 2 per g fibre; alcohol is extra)
const names = new Set();
for (const r of F.T) {
  eq(r.length, 10, 'Zeile ' + r[0]);
  ok(r.slice(1, 7).every(x => typeof x === 'number' && isFinite(x) && x >= 0), 'Zahlen ' + r[0]);
  const [kcal, p, c, f, fib] = r.slice(1, 6);
  const calc = 4 * p + 4 * c + 9 * f + 2 * fib;
  if (!r[9].includes('a') && !r[9].includes('i')) ok(Math.abs(kcal - calc) <= Math.max(25, kcal * 0.22), `Energie passt nicht: ${r[0].split('|')[0]} ${kcal} kcal, gerechnet ${Math.round(calc)}`);
  r[0].split('|').forEach(s => { const k = F.norm(s); ok(!names.has(k), 'Name doppelt: ' + s); names.add(k); });
}
ok(F.count >= 300, 'mindestens 300 Lebensmittel und Gerichte');

// 2. Recognition with amounts
let r = P('2 Eier, 1 Scheibe Vollkornbrot mit Butter');
eq(r.items.map(i => [i.name, i.g, i.side]), [['Eier', 110, false], ['Vollkornbrot', 45, false], ['Butter', 10, true]]);
eq(r.unknown, []);
let i = one('Skyr 250g'); eq([i.g, i.p, i.kcal], [250, 27.5, 158]);
i = one('250 g Skyr'); eq(i.g, 250);
i = one('Skyr, 150 g'); eq([i.g, i.def], [150, false], 'Menge nach dem Komma gehört zum Skyr');
i = one('Skyr'); eq([i.g, i.def, i.amt], [150, true, '1 Becher (150 g)']);
r = P('Kaffee mit Milch und Zucker');
eq(r.items.map(x => [x.name, x.g]), [['Kaffee', 150], ['Milch', 30], ['Zucker', 4]], 'Milch im Kaffee ist ein Schuss');
eq(r.items[0].cups, 1);
eq(P('Müsli mit Milch').items[1].g, 150, 'Milch zum Müsli');
i = one('Proteinshake mit Milch'); eq([i.name, i.g], ['Proteinshake mit Milch', 330]);
i = one('2x Kaffee'); eq([i.g, i.cups, i.amt], [300, 2, '2 Tassen (300 ml)']);
i = one('2 Bier'); eq([i.g, i.amt, i.fl.includes('a')], [1000, '2 Flaschen (1000 ml)', true]);
i = one('halbe Pizza'); eq(i.g, 200);
i = one('12 Mandeln'); eq(i.g, 14);
i = one('großer Salat'); eq(i.g, 225);
i = one('0,5 l Wasser'); eq([i.g, i.kcal], [500, 0]);
i = one('Wasser 1 l'); eq(i.g, 1000);
i = one('Milch 1,5 %'); eq(i.name, 'Milch fettarm', 'Fettgehalt wählt fettarme Milch');
i = one('Vollkornnudeln 100 g roh'); eq([i.name, i.kcal], ['Vollkornnudeln roh', 345]);
i = one('Rührei aus 3 Eiern'); eq(i.g, 195);
i = one('Bannane'); eq([i.name, !!i.fuzzy], ['Banane', true], 'Tippfehler');
i = one('Erdbeerjoghurt'); eq(i.key, 'f:fruchtjoghurt');
i = one('Kräutertee'); eq(i.key, 'f:tee');
i = one('Ebbelwoi'); eq([i.g, i.fl.includes('a')], [300, true]);
i = one('Weck'); eq(i.key, 'f:brötchen');
i = one('Frankfurter Kranz'); eq(i.key, 'f:torte', 'längster Treffer gewinnt');
eq(P('Omas Linseneintopf').unknown, []);
r = P('Salz und Pfeffer'); eq([r.items.length, r.unknown.length], [0, 0], 'Gewürze ohne Eintrag');
eq(P('Xyzabc').unknown, ['xyzabc']);
r = P('zum Frühstück 3 Eier und Toast'); eq([r.slot, r.items.length, r.items[0].g], ['frueh', 2, 165]);
i = one('30 g Eiweiß'); eq([i.src, i.p, i.kcal], ['schnell', 30, null]);
eq(P('2 Eier, 2 Scheiben Vollkornbrot mit Butter').items.map(x => x.seg), ['2 Eier', '2 Scheiben Vollkornbrot mit Butter', '2 Scheiben Vollkornbrot mit Butter'], 'Beschriftung in eigener Schreibweise');

// 3. Own foods, learned portions, saved meals
const ctx = { foods: [{ id: 'a1', name: 'Mein Shake', alias: 'Abendshake', dp: 300, kcal: 40, p: 8, c: 2, f: 0.5, fib: 0 }], portions: { 'f:skyr': 250 },
  meals: [{ id: 'm1', name: 'Mein Frühstück', items: [{ key: 'f:ei', name: 'Eier', g: 110, p: 13.9, kcal: 160, c: 0.8, f: 10.9, fib: 0 }, { key: 'f:kaffee', name: 'Kaffee', g: 150, p: 0.3, kcal: 3, c: 0.5, f: 0, fib: 0, cups: 1 }] }] };
i = one('Mein Shake', ctx); eq([i.key, i.g, i.p, i.src], ['c:a1', 300, 24, 'eigen']);
i = one('2 Abendshake', ctx); eq(i.g, 600);
i = one('Skyr', ctx); eq([i.g, i.amt], [250, 'deine Portion (250 g)']);
r = P('Mein Frühstück', ctx); eq(r.items.map(x => [x.name, x.src]), [['Eier', 'mahlzeit'], ['Kaffee', 'mahlzeit']]);

// 4. Totals, slots, factors
let t = F.totals(P('Skyr, Apfel, Wasser').items);
eq([t.kcal, Math.round(t.p), t.inc, t.fv, t.water], [173, 17, false, 150, 250]);
t = F.totals([{ kcal: null, p: 20 }, { kcal: 100, p: 5, c: 10, f: 2, fib: 1 }]); eq([t.kcal, t.p, t.inc], [100, 25, true]);
eq(['06:30', '12:00', '16:00', '19:30', '23:15'].map(F.slotAt), ['frueh', 'mittag', 'snack', 'abend', 'snack']);
const day = (text, time) => P(text).items.map(x => Object.assign(x, { time }));
let fx = F.factors([...day('Kaffee', '07:30'), ...day('2 Espresso', '13:00'), ...day('Pizza, 2 Bier', '21:30'), ...day('Brot mit Hummus', '08:00')]);
eq([fx.kaffee, fx.alkohol, fx.spaet, fx.knoblauch], [3, true, true, true]);
fx = F.factors([...day('Müsli mit Milch', '07:00'), ...day('Hähnchenbrust mit Reis', '13:30'), ...day('Lachs mit Kartoffeln', '19:00')]);
ok(!fx.nuechtern && !fx.spaet, 'regelmäßig gegessen');
fx = F.factors([...day('Hähnchenbrust mit Reis', '12:30'), ...day('Lachs mit Kartoffeln', '18:00'), ...day('Brot mit Käse', '20:30')]);
ok(fx.nuechtern, 'erste Mahlzeit erst mittags');
eq(F.scale({ g: 100, kcal: 200, p: 10, c: 20, f: 5, fib: 2, cups: 0 }, 150), { g: 150, kcal: 300, p: 15, c: 30, f: 7.5, fib: 3, cups: 0 });

// 5. Trends and one complaint in detail (synthetic: headache after short nights, neck pain on office days)
const today = E.today(), days = {};
const S = { health: { days, measures: [], profile: { sleepGoal: 7.5 } }, training: { sessions: [] }, settings: { week: { 0: 'frei', 1: 'ho', 2: 'buero', 3: 'buero', 4: 'buero', 5: 'ho', 6: 'frei' } }, nutrition: { log: {} } };
for (let k = 59; k >= 0; k--) {
  const d = E.addDays(today, -k), wd = E.weekday(d);
  if (k === 20) continue;
  const short = k % 4 === 0;
  const x = { sym: {}, meas: [], f: {}, sleepH: short ? 5.5 : 7.5, mood: short ? 2 : 4 };
  if (short) x.sym.kopf = 2;
  if ([2, 3, 4].includes(wd) && k % 2) x.sym['bm:nacken'] = 1;
  if (k >= 40 && k <= 43) x.sym.hals_kratzen = 1;
  if (!Object.keys(x.sym).length) x.none = true;
  days[d] = x;
}
// Nutrition log says beer the evening before some short nights
S.nutrition.log[E.addDays(today, -9)] = day('2 Bier', '20:00');
const from = E.addDays(today, -59), T = H.trend(S, from, today);
eq(T.logged.length, 59);
ok(T.top[0].key === 'kopf' || T.top[0].key === 'bm:nacken', 'häufigste Beschwerde');
eq(T.counts.kopf.n, 14, 'jeder vierte Tag, ein Tag ohne Eintrag');
eq(T.regions.map(x => x.id), ['nacken']);
ok(T.longest >= 1 && T.freeNow >= 0, 'Phasen ohne Beschwerden');
eq(T.wd.length, 7);
ok(T.avg.sleepH > 6.5 && T.avg.sleepH < 7.5, 'Schlaf im Schnitt');
const X = H.symDetail(S, 'kopf', from, today);
eq([X.n, X.longest, X.lv[2]], [14, 1, 14]);
ok(X.sleep.with < X.sleep.without && X.mood.with < X.mood.without, 'Schlaf und Befinden schlechter an Kopfschmerztagen');
eq(X.factors[0].label, 'Wenig Schlaf (unter 6,5 h)', 'Zusammenhang erkannt');
const N = H.symDetail(S, 'bm:nacken', from, today);
ok(N.factors.some(f => f.label === 'Bürotag'), 'Nacken an Bürotagen');
// Factors from the nutrition log reach the health patterns
eq(H.dayF(S, E.addDays(today, -9)).f.alkohol, true);
days[E.addDays(today, -9)].f.alkohol = false;
eq(H.dayF(S, E.addDays(today, -9)).f.alkohol, false, 'Eintrag von Hand geht vor');

// 2.14: no alcohol from words that only look like it, seasonal foods, compounds with a real front part
const keyOf = t => P(t).items.map(x => x.key).join('+');
const alc = t => P(t).items.some(x => x.fl.includes('a'));
['Marzipan', 'Sprite', 'Kinderpunsch', 'Glühwein ohne Alkohol', 'Pommes rot weiß', 'Energy Balls'].forEach(t => ok(!alc(t), 'kein Alkohol: ' + t));
['Glühwein', 'Weißbier', 'Rotwein', 'IPA', 'Hugo', 'Weinbrand', 'Eierpunsch'].forEach(t => ok(alc(t), 'Alkohol: ' + t));
eq(P('Sprite').items[0].key, 'f:cola', 'Sprite ist Limonade, kein Spritz');
eq(P('Glühwien').items.length, 0, 'Tippfehler wird nie zu Alkohol');
eq([keyOf('Bananne'), keyOf('Kaffe'), keyOf('Joghurth')], ['f:banane', 'f:kaffee', 'f:joghurt'], 'andere Tippfehler weiter erkannt');
eq(P('weiß').items.length, 0, 'weiß ist kein Eis');
eq([keyOf('Erdbeereis'), keyOf('Wassereis'), keyOf('Softeis'), keyOf('Kräutertee'), keyOf('Milchreis'), keyOf('Basmatireis')], ['f:eis', 'f:eis', 'f:eis', 'f:tee', 'f:pudding', 'f:reis']);
eq([keyOf('Stollen'), keyOf('Langos'), keyOf('Entenbrust'), keyOf('Wildschwein'), keyOf('Zwiebelkuchen')], ['f:stollen', 'f:langos', 'f:gans', 'f:wild', 'f:zwiebelkuchen'], 'nicht mehr Stulle, Mango, Pute, Schwein oder Kuchen');
eq([keyOf('Whey Shake'), keyOf('Schnitzel Wiener Art'), keyOf('Beef Jerky'), keyOf('Pommes Schranke'), keyOf('Tomaten mit Mozzarella')],
  ['f:proteinshake', 'f:schnitzel', 'f:beef_jerky', 'f:pommes_rot_weiss', 'f:caprese'], 'ein Eintrag statt zwei');
i = one('2 Dominosteine'); eq([i.g, i.amt], [24, '2 Stück (24 g)']);
i = one('eine Tüte gebrannte Mandeln'); eq([i.key, i.g], ['f:gebrannte_mandeln', 100]);
i = one('2 Scheiben Stollen'); eq(i.g, 100);
i = one('Kinderpunsch'); eq([i.g, i.fl], [200, 'dh'], 'heiß, ohne Alkohol');
ok(F.count >= 360, 'mindestens 360 Lebensmittel und Gerichte');

// 2.15: adjectives that are also drinks, alcohol-free drinks, words ending in "speise", names with a number word
['dunkles Brot', 'helles Brötchen', '2 helle Brötchen', 'Dunkles Vollkornbrot', 'helle Soße', 'klare Brühe', 'klarer Tee', 'Kurze Nudeln', 'Espresso Shot',
  'Spirulina Shot', 'Roggen-Weizen-Brot', 'Weizen Toast', 'Steak rosé', 'alkoholfreier Sekt', 'Sekt alkoholfrei', 'alkoholfreier Wein', 'Radler alkoholfrei',
  'alkoholfreies Radler', 'Bier 0,0 %', '0,0 Bier', 'Weizen 0,0%', 'Bier ohne Alkohol', 'Virgin Mojito', 'Hugo alkoholfrei', 'alkoholfreier Gin Tonic', 'Kindersekt',
  'Malzbier', 'Ingwerbier', 'Rumkugeln', 'Eierlikörkuchen', 'Götterspeise', 'Bethmännchen'].forEach(t => ok(!alc(t), 'kein Alkohol: ' + t));
['ein Helles', '2 Helle', 'ein Dunkles', 'Weizen', '2 Kurze', 'ein Klarer', 'ein Rosé', '2 Shots', 'Craft Beer', 'Feuerzangenbowle', 'Erdbeerbowle', 'Sangria',
  'Hard Seltzer', 'Jägermeister', 'Eierlikör', 'Baileys', 'Grog', 'Crémant', 'Lillet', 'Campari'].forEach(t => ok(alc(t), 'Alkohol: ' + t));
i = one('alkoholfreier Sekt'); eq([i.key, i.g], ['f:alkoholfreier_wein', 200], 'ein Eintrag statt alkoholfreiem Bier und Sekt');
i = one('Radler alkoholfrei'); eq([i.key, i.name], ['f:alkoholfreies_bier', 'Radler alkoholfrei']);
i = one('2 Bier 0,0'); eq([i.key, i.g], ['f:alkoholfreies_bier', 1000], 'Menge bleibt');
i = one('Virgin Mojito'); eq([i.key, i.name], ['f:alkoholfreier_cocktail', 'Mojito alkoholfrei']);
eq([keyOf('alkoholfreies Bier'), keyOf('Alkoholfreies'), keyOf('Erdinger alkoholfrei'), keyOf('Joghurt 0,0 %')], ['f:alkoholfreies_bier', 'f:alkoholfreies_bier', 'f:alkoholfreies_bier', 'f:fettarmer_joghurt']);
i = one('2 helle Brötchen'); eq([i.key, i.g], ['f:brötchen', one('2 Brötchen').g], 'helle zählt nicht, die Menge bleibt');
eq([keyOf('Espresso Shot'), keyOf('klare Brühe'), keyOf('Steak rosé')], ['f:espresso', 'f:suppe', 'f:steak']);
eq(P('Spirulina Shot').unknown, ['spirulina shot'], 'bleibt sichtbar unerkannt');
eq([keyOf('Götterspeise'), keyOf('Nachspeise'), keyOf('Eierspeise'), keyOf('Quarkspeise'), keyOf('Speiseeis')], ['f:götterspeise', 'f:dessert', 'f:rührei', 'f:quarkspeise', 'f:eis'], 'Speise ist kein Eis');
eq(P('Grießspeise').items.length, 0, 'unbekannte Speise bleibt unerkannt statt Eis');
i = one('ein halbes Hähnchen'); eq([i.key, i.g], ['f:halbes_hähnchen', 350]);
i = one('2 halbe Hähnchen'); eq(i.g, 700);
i = one('halbes Brötchen'); eq([i.key, i.g], ['f:brötchen', one('Brötchen').g / 2], 'halb bleibt eine Menge');
eq([keyOf('Bowl'), keyOf('Poke Bowl'), keyOf('Wan Tan Suppe'), keyOf('Leberkäsweck'), keyOf('Rippchen mit Kraut')], ['f:bowl', 'f:bowl', 'f:ramen', 'f:leberkäsbrötchen', 'f:kotelett+f:sauerkraut']);
eq([keyOf('Cranberries'), keyOf('frische Cranberries'), keyOf('Dampfnudeln'), keyOf('Raclette-Käse'), keyOf('Fondue chinoise')], ['f:rosinen', 'f:beeren', 'f:germknödel', 'f:käse', 'f:fleischfondue']);
i = one('Eiskaffee'); ok(i.fl.includes('k') && i.kcal > 200, 'Eiskaffee mit Eis und Sahne, zählt als Kaffee');
i = one('Kokoswasser'); ok(i.kcal > 40 && i.fl.includes('w'), 'Kokoswasser hat Kalorien');
ok(F.count >= 410, 'mindestens 410 Lebensmittel und Gerichte');

console.log('food_test: ' + n + ' Prüfungen bestanden (' + F.count + ' Lebensmittel und Gerichte)');
