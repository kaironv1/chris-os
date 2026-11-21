/* Trips with a packing list (2.11, K52): outfits from the own wardrobe for the weather at the destination, from
   them a packing list with care things and medication. Pure logic, also runs in Node. Only the coordinates of the
   destination leave the device (Open-Meteo, already allowed). */
(function (root) {
  'use strict';
  const E = root.Engine || (typeof require !== 'undefined' ? require('./engine.js') : null);

  const KINDS = [['privat', 'Privat'], ['arbeit', 'Arbeit']];
  const MAX_DAYS = 28;
  // A forecast reaches 16 days; later trips get the values of the same weeks a year earlier
  const FORECAST_DAYS = 15;
  const r1 = v => Math.round(v * 10) / 10;
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  const pl = (n, s, p) => n + ' ' + (n === 1 ? s : p);

  function dates(t) {
    const out = [];
    for (let d = t.from; d <= t.to && out.length < MAX_DAYS; d = E.addDays(d, 1)) out.push(d);
    return out;
  }
  const nights = t => Math.max(0, E.diffDays(t.from, t.to));
  function status(t, today) { return t.to < today ? 'vorbei' : t.from <= today ? 'unterwegs' : 'geplant'; }
  // The occasion of a day: chosen, otherwise leisure, on a work trip smart on weekdays
  function occ(t, d) {
    if (t.occ && t.occ[d]) return t.occ[d];
    if (t.kind === 'arbeit') { const w = E.weekday(d); return w === 0 || w === 6 ? 'freizeit' : 'smart'; }
    return 'freizeit';
  }
  function create(draft, today, id) {
    const from = draft.from || today, to = draft.to && draft.to >= from ? draft.to : from;
    return { id: id || 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: String(draft.name || '').trim(), loc: draft.loc || null, kind: draft.kind === 'arbeit' ? 'arbeit' : 'privat',
      from, to: E.diffDays(from, to) >= MAX_DAYS ? E.addDays(from, MAX_DAYS - 1) : to, occ: {}, wx: null, packed: {}, extra: [], created: Date.now() };
  }
  function title(t) { return t.name || (t.loc ? t.loc.name.replace(/\s*\(.*\)$/, '') : 'Reise'); }
  function range(t) { return t.from === t.to ? E.fmtShort(t.from) : E.fmtShort(t.from) + ' bis ' + E.fmtShort(t.to); }

  // ---------- Weather at the destination ----------
  const DAILY = 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,precipitation_probability_max,uv_index_max';
  const DAILY_ARCH = 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum';
  function wxKind(t, today) { return E.diffDays(today, t.to) <= FORECAST_DAYS && t.to >= today ? 'vorhersage' : 'vorjahr'; }
  function wxUrl(t, today) {
    const loc = t.loc; if (!loc) return null;
    const kind = wxKind(t, today);
    if (kind === 'vorhersage') {
      const from = t.from < today ? today : t.from;
      return { kind, url: 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon + '&daily=' + DAILY + '&timezone=auto&start_date=' + from + '&end_date=' + t.to };
    }
    // Same weeks a year earlier, with a week of margin on both sides
    const y = d => { const p = E.parse(d); p.setFullYear(p.getFullYear() - 1); return E.iso(p); };
    return { kind, url: 'https://archive-api.open-meteo.com/v1/archive?latitude=' + loc.lat + '&longitude=' + loc.lon + '&daily=' + DAILY_ARCH + '&timezone=auto&start_date=' + E.addDays(y(t.from), -7) + '&end_date=' + E.addDays(y(t.to), 7) };
  }
  // Daily values from an answer. Forecast: per day. Previous year: one average for all days of the trip.
  function wxDaily(json, kind, t) {
    const D = json && json.daily;
    if (!D || !Array.isArray(D.time) || !D.time.length) return null;
    const col = k => (D[k] || []);
    const num = v => typeof v === 'number' && isFinite(v);
    const days = {};
    if (kind === 'vorhersage') {
      D.time.forEach((d, i) => {
        const tn = col('temperature_2m_min')[i], tx = col('temperature_2m_max')[i], an = col('apparent_temperature_min')[i], ax = col('apparent_temperature_max')[i];
        if (!num(tn) || !num(tx)) return;
        days[d] = { tn: r1(tn), tx: r1(tx), an: r1(num(an) ? an : tn), ax: r1(num(ax) ? ax : tx), r: num(col('precipitation_probability_max')[i]) ? Math.round(col('precipitation_probability_max')[i]) : (num(col('precipitation_sum')[i]) && col('precipitation_sum')[i] >= 1 ? 70 : 10), code: col('weather_code')[i], uv: col('uv_index_max')[i] };
      });
      return Object.keys(days).length ? { days, kind, n: Object.keys(days).length } : null;
    }
    const rows = D.time.map((d, i) => ({ tn: col('temperature_2m_min')[i], tx: col('temperature_2m_max')[i], an: col('apparent_temperature_min')[i], ax: col('apparent_temperature_max')[i], p: col('precipitation_sum')[i] })).filter(x => num(x.tn) && num(x.tx));
    if (rows.length < 7) return null;
    const m = { tn: r1(avg(rows.map(x => x.tn))), tx: r1(avg(rows.map(x => x.tx))), an: r1(avg(rows.map(x => (num(x.an) ? x.an : x.tn)))), ax: r1(avg(rows.map(x => (num(x.ax) ? x.ax : x.tx)))), r: Math.round(100 * rows.filter(x => num(x.p) && x.p >= 1).length / rows.length), code: null, cold: r1(Math.min(...rows.map(x => x.tn))), warm: r1(Math.max(...rows.map(x => x.tx))) };
    dates(t).forEach(d => { days[d] = Object.assign({}, m); });
    return { days, kind, n: rows.length };
  }
  function wxText(w) {
    if (!w) return 'Noch kein Wetter für das Ziel.';
    return w.kind === 'vorhersage' ? 'Vorhersage von Open-Meteo für das Ziel.' : 'Noch keine Vorhersage so weit voraus: gerechnet mit den Werten derselben Wochen im Vorjahr am Ziel (Open-Meteo, ERA5), grob.';
  }

  // ---------- Outfits for the days ----------
  // The context like at home: outside = the cooler part of the day, during the day = the warmer part
  function ctx(S, t, d) {
    const w = t.wx && t.wx.days && t.wx.days[d];
    let tOut, tDay, rain = 0, code = null, src;
    if (w) { const span = w.ax - w.an; tOut = w.an + 0.3 * span; tDay = w.an + 0.75 * span; rain = w.r || 0; code = w.code; src = t.wx.kind; }
    else { tOut = tDay = E.context(S, d, 'freizeit', null).tOut; src = 'saison'; }
    const effT = (tOut + tDay) / 2 - (S.settings.coldSensitive ? 2 : 0);
    return { date: d, occasion: occ(t, d), dayType: 'frei', tOut, tDay, effT, rain, code, src, home: null, office: null, needWinter: tOut < S.settings.winterBelow, needCoat: tOut < S.settings.coatBelow };
  }
  const BASE = { tee: 1, shirt: 1, polo: 1 }, MID = { knit: 3, cardigan: 3, blazer: 4, jacket: 4, overshirt: 3 };
  // How often a piece can be worn on the trip: shirts once, knits and bottoms about three days, more with several
  // of a kind (qty); on trips over a week a wash is assumed
  function budget(it, n) {
    const per = BASE[it.role] ? 1 : MID[it.role] ? MID[it.role] : it.role === 'bottom' ? 3 : Infinity;
    return per * Math.max(1, it.qty || 1) * Math.max(1, Math.ceil(n / 7));
  }
  const NEW = 3;  // score points a new piece in the bag costs
  function plan(S, t) {
    const ds = dates(t), n = ds.length, uses = new Map(), bag = new Map(), days = [];
    const P = E.pool(S, null, true);
    const use = it => { uses.set(it.id, (uses.get(it.id) || 0) + 1); if (!bag.has(it.id)) bag.set(it.id, it); };
    const ok = it => (uses.get(it.id) || 0) < budget(it, n);
    let shoesN = 0;
    for (const d of ds) {
      const c = ctx(S, t, d);
      const { list } = E.suggest(S, c, { raw: true, laundry: true });
      let best = null, bs = -Infinity;
      for (const o of list.slice(0, 120)) {
        const its = o.tops.concat([o.bottom]);
        if (!its.every(ok)) continue;
        const fresh = its.filter(it => !bag.has(it.id)).length;
        const sc = o.s - NEW * fresh;
        if (sc > bs) { bs = sc; best = o; }
      }
      if (!best) { days.push({ date: d, ctx: c, o: null }); continue; }
      const o = { tops: best.tops, bottom: best.bottom, key: best.key, s: best.s, open: best.open, fBody: best.fBody, shoes: null, outer: null };
      // Shoes: at most two pairs; a pair already in the bag wins if it is nearly as good
      const R = E.rankShoes(P, o, c);
      if (R.length) {
        const inBag = R.filter(x => bag.has(x.sh.id));
        const top = R[0];
        o.shoes = inBag.length && inBag[0].sc >= top.sc - (shoesN >= 2 ? 10 : 4) ? inBag[0].sh : top.sh;
        if (!bag.has(o.shoes.id)) shoesN++;
      }
      o.tops.forEach(use); use(o.bottom); if (o.shoes) use(o.shoes);
      days.push({ date: d, ctx: c, o });
    }
    // One jacket for the whole trip: the warmest that any day needs
    let outer = null, outerHint = null;
    if (days.some(x => x.ctx.needWinter)) { outer = P.winters[0] || P.coats[0] || null; if (!outer) outerHint = 'Winterjacke'; }
    else if (days.some(x => x.ctx.needCoat)) { outer = P.coats[0] || null; if (!outer) outerHint = 'Mantel'; }
    if (outer) bag.set(outer.id, outer);
    const acc = [];
    if (days.some(x => x.ctx.tOut < 5)) { if (P.scarves[0]) acc.push(P.scarves[0]); if (P.beanies[0]) acc.push(P.beanies[0]); }
    if (days.some(x => x.ctx.occasion === 'freizeit' && x.ctx.rain < 70) && P.caps[0]) acc.push(P.caps[0]);
    if (P.belts[0]) acc.push(P.belts[0]);
    if (P.watches[0]) acc.push(P.watches[0]);
    acc.forEach(a => bag.set(a.id, a));
    days.forEach(x => { if (x.o) { x.o.outer = x.ctx.needWinter || x.ctx.needCoat ? outer : null; x.o.outerHint = x.o.outer ? null : (x.ctx.needWinter ? 'Winterjacke' : x.ctx.needCoat ? 'Mantel' : null); } });
    return { days, outer, outerHint, acc, bag: [...bag.values()], uses };
  }

  // ---------- Packing list ----------
  const ORDER = ['Jacken', 'Oberteile', 'Strick', 'Hosen', 'Schuhe', 'Accessoires'];
  function medActive(m, from, to) { return !m.stopped && m.start <= to && (!m.end || m.end >= from); }
  function list(S, t, pl_) {
    const p = pl_ || plan(S, t), n = dates(t).length, ds = dates(t);
    const G = [];
    // Clothes from the plan, with the number of pieces
    const cl = p.bag.slice().sort((a, b) => (ORDER.indexOf(a.group) - ORDER.indexOf(b.group)) || ((a.nos && a.nos[0]) || 999) - ((b.nos && b.nos[0]) || 999));
    const clothes = cl.map(it => {
      const u = p.uses.get(it.id) || 0, per = BASE[it.role] ? 1 : MID[it.role] ? MID[it.role] : it.role === 'bottom' ? 3 : Infinity;
      const count = per === Infinity ? 1 : Math.min(Math.max(1, it.qty || 1), Math.ceil(u / per));
      return { key: 'it:' + it.id, name: it.label, sub: [it.brand || '', u ? pl(u, 'Tag', 'Tage') : ''].filter(Boolean).join(', '), n: count, it };
    });
    const under = Math.min(n, 7) + 1;
    clothes.push({ key: 'x:unter', name: 'Unterwäsche und Socken', sub: n > 7 ? 'für eine Woche, unterwegs waschen' : '', n: under });
    if (nights(t) > 0) clothes.push({ key: 'x:schlaf', name: 'Schlafsachen', n: 1 });
    G.push({ k: 'kleidung', l: 'Kleidung', items: clothes });
    // Care: the products in the house, and the tools of rhythms that fall into the trip
    const care = [];
    (S.grooming.products || []).filter(x => x.have && !x.optional).forEach(x => care.push({ key: 'p:' + x.id, name: x.name, n: 1 }));
    care.push({ key: 'x:zahn', name: 'Zahnbürste und Zahnpasta', n: 1 });
    const tools = new Map();
    for (const task of (S.grooming.tasks || [])) {
      if (task.slot !== 'rhythmus' || !task.with) continue;
      const d = E.due(S, task, t.from);
      if (d.date && d.date <= t.to && (d.date >= t.from || d.diff < 0)) (tools.get(task.with) || tools.set(task.with, []).get(task.with)).push(task.name);
    }
    tools.forEach((names, w) => care.push({ key: 'w:' + w, name: w, sub: names.join(', ') + (names.length === 1 ? ' ist' : ' sind') + ' unterwegs dran', n: 1 }));
    G.push({ k: 'pflege', l: 'Kulturbeutel', items: care });
    // Medication during the trip, number of doses
    const meds = (S.health.meds || []).filter(m => medActive(m, t.from, t.to)).map(m => {
      const days = ds.filter(d => m.start <= d && (!m.end || m.end >= d)).length;
      const doses = days * (m.times || []).length;
      return { key: 'm:' + m.id, name: m.name, sub: [m.dose, doses ? doses + '× (' + pl(days, 'Tag', 'Tage') + ')' : ''].filter(Boolean).join(', '), n: 1 };
    });
    if (meds.length) G.push({ k: 'medikamente', l: 'Medikamente', items: meds });
    // The rest: fixed things, weather-dependent ones, own additions
    const other = [{ key: 'x:papiere', name: 'Ausweis, Karten und Tickets', n: 1 }, { key: 'x:lader', name: 'Ladegerät und Kabel', n: 1 }, { key: 'x:hoerer', name: 'Kopfhörer', n: 1 }];
    const W = p.days.map(x => x.ctx);
    if (W.some(c => c.rain >= 50)) other.push({ key: 'x:schirm', name: 'Regenschirm oder Regenjacke', sub: 'Regen angesagt', n: 1 });
    if (W.some(c => c.tDay >= 22) || p.days.some(x => t.wx && t.wx.days[x.date] && t.wx.days[x.date].uv >= 5)) other.push({ key: 'x:sonne', name: 'Sonnenbrille und Sonnencreme', n: 1 });
    if (t.kind === 'arbeit') other.push({ key: 'x:laptop', name: 'Laptop und Unterlagen', n: 1 });
    (t.extra || []).forEach((x, i) => other.push({ key: 'e:' + i, name: x, n: 1, own: true }));
    G.push({ k: 'sonstiges', l: 'Sonstiges', items: other });
    return G;
  }
  function progress(t, G) {
    const all = G.reduce((a, g) => a.concat(g.items), []);
    const done = all.filter(x => t.packed && t.packed[x.key]).length;
    return { done, total: all.length };
  }
  // The line for Heute: a trip within a week or under way
  function todayLine(S, today) {
    const T = (S.trips || []).filter(t => t.to >= today).sort((a, b) => (a.from < b.from ? -1 : 1));
    const t = T[0]; if (!t) return null;
    const st = status(t, today);
    if (st === 'geplant' && E.diffDays(today, t.from) > 7) return null;
    return { t, st, inDays: E.diffDays(today, t.from) };
  }
  function tempLine(c) {
    return Math.round(c.tOut) + '° bis ' + Math.round(c.tDay) + '° gefühlt' + (c.rain >= 50 ? ', Regen möglich' : '');
  }

  const api = { KINDS, MAX_DAYS, FORECAST_DAYS, dates, nights, status, occ, create, title, range, wxKind, wxUrl, wxDaily, wxText, ctx, budget, plan, list, progress, todayLine, tempLine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Trip = api;
})(typeof window !== 'undefined' ? window : globalThis);
