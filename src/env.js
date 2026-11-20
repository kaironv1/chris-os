/* Environment per day at home: weather, pollen and air quality from Open-Meteo (2.8). Pure logic, also runs in Node. */
(function (root) {
  'use strict';
  const E = root.Engine || (typeof require !== 'undefined' ? require('./engine.js') : null);

  // Pollen of the CAMS European air quality forecast (Open-Meteo, grains per m³). Classes for the daily mean after
  // MeteoSchweiz, Belastungsklassen der allergenen Pollenarten (2024): weak from 1, then moderate, strong, very strong.
  const POLLEN = [
    { id: 'er', v: 'alder_pollen', l: 'Erle', pl: 'Erlenpollen', cls: [1, 11, 70, 250] },
    { id: 'bi', v: 'birch_pollen', l: 'Birke', pl: 'Birkenpollen', cls: [1, 11, 70, 300] },
    { id: 'gr', v: 'grass_pollen', l: 'Gräser', pl: 'Gräserpollen', cls: [1, 20, 50, 150] },
    { id: 'bf', v: 'mugwort_pollen', l: 'Beifuß', pl: 'Beifußpollen', cls: [1, 6, 15, 50] },
    { id: 'am', v: 'ragweed_pollen', l: 'Ambrosia', pl: 'Ambrosiapollen', cls: [1, 6, 11, 40] }
  ];
  const LEVEL = ['keine', 'schwach', 'mäßig', 'stark', 'sehr stark'];
  // European air quality index as Open-Meteo defines it: 0 to 20 good, up to 100 very poor, above extremely poor
  const AQI = [[20, 'gut'], [40, 'ausreichend'], [60, 'mäßig'], [80, 'schlecht'], [100, 'sehr schlecht'], [Infinity, 'extrem schlecht']];
  const WX_VARS = 'temperature_2m,pressure_msl,precipitation';
  const AQ_VARS = 'european_aqi,' + POLLEN.map(p => p.v).join(',');
  // past_days reaches 92 days back; older days come from the archives by date range
  const RECENT = 92;
  const STALE = 3 * 3600e3;
  const r1 = v => Math.round(v * 10) / 10;
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;

  function polLevel(id, v) {
    const p = POLLEN.find(x => x.id === id);
    if (!p || v == null || !isFinite(v)) return null;
    let k = 0;
    p.cls.forEach((c, i) => { if (v >= c) k = i + 1; });
    return k;
  }
  function aqiBand(v) {
    if (v == null || !isFinite(v)) return null;
    const i = AQI.findIndex(a => v < a[0]);
    return { i, l: AQI[i][1] };
  }
  // The pollen types someone reacts to (2.9, K48): chosen in the app, or named in the allergies of the report.
  // null means all types. An explicitly empty choice also means all types, without looking at the report.
  // Whole words only (letters around count, so „Erlebnis“ is no alder); \b would not work with ä and ß
  const word = s => new RegExp('(?<!\\p{L})(' + s + ')(?!\\p{L})', 'u');
  const NAMES = { er: word('erlen?(pollen)?'), bi: word('birken?(pollen)?'), gr: word('gr(ä|ae)ser(n|pollen)?|gras(pollen)?'), bf: word('beifu(ß|ss)(pollen)?'), am: word('ambrosia(pollen)?|ragweed') };
  function fromText(text) {
    const t = String(text || '').toLowerCase();
    return t ? POLLEN.filter(p => NAMES[p.id].test(t)).map(p => p.id) : [];
  }
  function sel(S) {
    const H = (S && S.health) || {}, P = H.profile || {};
    if (Array.isArray(P.pollen)) { const ids = POLLEN.map(p => p.id).filter(id => P.pollen.includes(id)); return ids.length ? ids : null; }
    const t = fromText(H.record && H.record.allergies);
    return t.length ? t : null;
  }
  function selSource(S) {
    const P = (S && S.health && S.health.profile) || {};
    return Array.isArray(P.pollen) ? (P.pollen.length ? 'eigen' : 'alle') : sel(S) ? 'bericht' : null;
  }
  const only = s => (Array.isArray(s) && s.length ? POLLEN.filter(p => s.includes(p.id)) : POLLEN);
  // Pollen of a day: highest class and the types in the air, strongest first (only the chosen types, if given)
  function pollen(x, s) {
    if (!x || !x.pol) return null;
    const list = only(s).map(p => ({ id: p.id, l: p.l, pl: p.pl, v: x.pol[p.id], k: polLevel(p.id, x.pol[p.id]) })).filter(p => p.k != null);
    if (!list.length) return null;
    return { max: Math.max(...list.map(p => p.k)), list: list.filter(p => p.k > 0).sort((a, b) => b.k - a.k || b.v - a.v) };
  }
  function polText(x, min, s) {
    const P = pollen(x, s);
    return P ? P.list.filter(p => p.k >= (min || 1)).map(p => p.l + ' ' + LEVEL[p.k]).join(', ') : '';
  }
  // Types outside the choice (for the Verläufe, which name them after the chosen ones)
  const rest = s => (Array.isArray(s) && s.length ? POLLEN.filter(p => !s.includes(p.id)).map(p => p.id) : []);

  // Daily values from an hourly answer (kind 'wx' or 'aq'), days after today left out. fw and fa mark a day as
  // fetched, so a day the service has no values for is not asked for again and again.
  function daily(json, kind, today) {
    const H = json && json.hourly, out = {};
    if (!H || !Array.isArray(H.time)) return out;
    const by = {};
    H.time.forEach((t, i) => { const d = String(t).slice(0, 10); if (!today || d <= today) (by[d] || (by[d] = [])).push(i); });
    for (const [d, idx] of Object.entries(by)) {
      const col = k => idx.map(i => (H[k] || [])[i]).filter(v => typeof v === 'number' && isFinite(v));
      const x = {};
      if (kind === 'wx') {
        const t = col('temperature_2m'), p = col('pressure_msl'), r = col('precipitation');
        if (t.length >= 20) { x.tn = r1(Math.min(...t)); x.tx = r1(Math.max(...t)); x.tm = r1(avg(t)); }
        if (p.length >= 20) x.p = r1(avg(p));
        if (r.length >= 20) x.r = r1(r.reduce((s, v) => s + v, 0));
        x.fw = 1;
      } else {
        const a = col('european_aqi');
        if (a.length >= 12) x.aq = Math.round(avg(a));
        const pol = {};
        POLLEN.forEach(p => { const v = col(p.v); if (v.length >= 12) pol[p.id] = r1(avg(v)); });
        if (Object.keys(pol).length) x.pol = pol;
        x.fa = 1;
      }
      out[d] = x;
    }
    return out;
  }
  function merge(env, add) {
    let n = 0;
    for (const [d, x] of Object.entries(add || {})) { env.days[d] = Object.assign(env.days[d] || {}, x); n++; }
    return n;
  }
  const complete = x => !!x && !!x.fw && !!x.fa;

  // What to fetch. first: the earliest day that should have values (the day before the first check-in, at most a
  // year back). Recent days per past_days; yesterday and today again once the last fetch is stale (today is partly
  // forecast, yesterday becomes final). Older missing days as one date range for the archives.
  function need(env, first, today, now) {
    const days = (env && env.days) || {};
    const yearAgo = E.addDays(today, -365);
    const lo = !first || first >= today ? E.addDays(today, -1) : first < yearAgo ? yearAgo : first;
    const oldest = E.addDays(today, -RECENT);
    let past = 0;
    for (let d = lo > oldest ? lo : oldest; d < today; d = E.addDays(d, 1)) if (!complete(days[d])) { past = E.diffDays(d, today); break; }
    const stale = !env || !env.at || now - env.at > STALE || E.iso(new Date(env.at)) !== today;
    if (stale || !complete(days[today])) past = Math.max(past, 1);
    let gap = null;
    if (lo < oldest) {
      let a = null, b = null;
      for (let d = lo; d < oldest; d = E.addDays(d, 1)) if (!complete(days[d])) { if (!a) a = d; b = d; }
      if (a) gap = [a, b];
    }
    return { past: Math.min(RECENT, past), gap };
  }
  function url(kind, loc, q) {
    const ranged = !!(q && q.start);
    const base = kind === 'aq' ? 'https://air-quality-api.open-meteo.com/v1/air-quality'
      : ranged ? 'https://archive-api.open-meteo.com/v1/archive' : 'https://api.open-meteo.com/v1/forecast';
    return base + '?latitude=' + loc.lat + '&longitude=' + loc.lon + '&hourly=' + (kind === 'aq' ? AQ_VARS : WX_VARS) + '&timezone=Europe%2FBerlin' +
      (ranged ? '&start_date=' + q.start + '&end_date=' + q.end : '&past_days=' + q.past + '&forecast_days=1');
  }

  // Influences of a day for the patterns, as [label, day => true, false or null without values]. Pollen only for
  // the chosen types, so pollen someone does not react to add no chance findings.
  function tests(env, s) {
    const D = (env && env.days) || {};
    const day = d => D[d] || null, prev = d => D[E.addDays(d, -1)] || null;
    const T = [
      ['Kalter Tag (höchstens 5 °C)', d => { const x = day(d); return x && x.tx != null ? x.tx <= 5 : null; }],
      ['Warmer Tag (ab 25 °C)', d => { const x = day(d); return x && x.tx != null ? x.tx >= 25 : null; }],
      ['Temperatursturz (5 Grad kälter als am Vortag)', d => { const x = day(d), p = prev(d); return x && p && x.tm != null && p.tm != null ? p.tm - x.tm >= 5 : null; }],
      ['Luftdruck fällt (5 hPa zum Vortag)', d => { const x = day(d), p = prev(d); return x && p && x.p != null && p.p != null ? p.p - x.p >= 5 : null; }],
      ['Luftqualität mäßig oder schlechter', d => { const x = day(d); return x && x.aq != null ? x.aq >= 40 : null; }]
    ];
    only(s).forEach(p => T.push([p.pl + ' mäßig oder stärker', d => { const x = day(d), v = x && x.pol ? x.pol[p.id] : null; return v == null ? null : polLevel(p.id, v) >= 2; }]));
    return T;
  }

  // Overview of a range: temperatures, drops, pollen days by type, air quality. With a choice of types, polList
  // holds the chosen ones and other the rest that flew moderately or more.
  function summary(env, from, to, sel) {
    const D = (env && env.days) || {};
    const s = { n: 0, tn: null, tx: null, sturz: 0, druck: 0, aq: null, aqN: 0, aqBad: 0, pol: {}, polDays: 0, other: [] };
    const oth = {}, others = rest(sel);
    let aqSum = 0;
    for (let d = from; d <= to; d = E.addDays(d, 1)) {
      const x = D[d]; if (!x || (x.tm == null && x.aq == null && !x.pol)) continue;
      s.n++;
      const p = D[E.addDays(d, -1)];
      if (x.tn != null) s.tn = s.tn == null ? x.tn : Math.min(s.tn, x.tn);
      if (x.tx != null) s.tx = s.tx == null ? x.tx : Math.max(s.tx, x.tx);
      if (p && x.tm != null && p.tm != null && p.tm - x.tm >= 5) s.sturz++;
      if (p && x.p != null && p.p != null && p.p - x.p >= 5) s.druck++;
      if (x.aq != null) { s.aqN++; aqSum += x.aq; if (x.aq >= 40) s.aqBad++; }
      const P = pollen(x, sel);
      if (P && P.max >= 2) s.polDays++;
      if (P) P.list.forEach(t => { const c = s.pol[t.id] || (s.pol[t.id] = { id: t.id, l: t.l, pl: t.pl, n: 0, mod: 0, max: 0 }); c.n++; if (t.k >= 2) c.mod++; c.max = Math.max(c.max, t.k); });
      const O = others.length ? pollen(x, others) : null;
      if (O) O.list.forEach(t => { if (t.k >= 2) { const c = oth[t.id] || (oth[t.id] = { id: t.id, l: t.l, mod: 0 }); c.mod++; } });
    }
    if (s.aqN) s.aq = Math.round(aqSum / s.aqN);
    s.polList = Object.values(s.pol).sort((a, b) => b.mod - a.mod || b.n - a.n);
    s.other = Object.values(oth).sort((a, b) => b.mod - a.mod);
    return s;
  }

  const api = { POLLEN, LEVEL, AQI, WX_VARS, AQ_VARS, RECENT, STALE, polLevel, aqiBand, fromText, sel, selSource, pollen, polText, rest, daily, merge, complete, need, url, tests, summary };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Env = api;
})(typeof window !== 'undefined' ? window : globalThis);
