const E = require('../src/engine.js');
const S = require(require('fs').existsSync(require('path').join(__dirname, '..', 'seed.json')) ? '../seed.json' : './fixtures/test-seed.json');
S.meta.setup = '2026-11-18';
const fmt = o => o ? `${o.s.toFixed(1)} | ${o.tops.map(t=>t.label).join(' + ')}${o.open?' (offen)':''} | ${o.bottom.label} | ${o.shoes?o.shoes.label:'-'} | ${o.outer?o.outer.label:(o.outerHint||'')} | ${o.acc.map(a=>a.label).join(',')} | f=${o.fBody.toFixed(2)}\n      → ${o.reasons.join(' / ')}` : 'none';
const cases = [
  ['2026-11-18','smart', 4, 7, 'Mi Büro Nov'],
  ['2026-11-21','freizeit', 5, 8, 'Sa Freizeit'],
  ['2026-11-19','termin', 8, 10, 'Termin'],
  ['2026-07-15','smart', 22, 26, 'Sommer Smart'],
  ['2026-07-18','freizeit', 24, 28, 'Sommer Freizeit'],
  ['2026-10-02','abend', 12, 14, 'Abend Herbst'],
  ['2026-04-14','smart', 13, 17, 'Frühling Smart'],
];
for (const [d, occ, tOut, tDay, name] of cases) {
  const ctx = { date: d, occasion: occ, dayType: 'buero', tOut, tDay, effT: (tOut+tDay)/2 - 2, rain: 20, needWinter: tOut < 6, needCoat: tOut < 15 };
  const t0 = Date.now();
  const r = E.suggest(S, ctx);
  console.log(`\n== ${name} (${occ}, effT ${ctx.effT}) combos=${r.list.length} in ${Date.now()-t0}ms`);
  console.log(' FAV', fmt(r.fav));
  r.alts.forEach((a,i)=>console.log(' ALT'+(i+1), fmt(a)));
  console.log(' top10 scores', r.list.slice(0,10).map(o=>o.s.toFixed(0)).join(','), ' p50', r.list[Math.floor(r.list.length/2)].s.toFixed(0), ' >=66:', r.list.filter(o=>o.s>=66).length);
}
// gap analysis
const t0 = Date.now();
const base = E.goodCombos(S);
console.log('\nbase good', base, (Date.now()-t0)+'ms');
for (const w of S.wardrobe.items.filter(i => i.status === 'wunsch')) {
  const extra = Object.assign({}, w, { status: 'aktiv' });
  console.log(w.label, '+', E.goodCombos(S, extra));
}
