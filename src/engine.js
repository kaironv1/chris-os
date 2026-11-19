/* Pure logic: dates, weather context, outfit engine, training progression, grooming schedule. */
(function (root) {
  'use strict';

  // ---------- Dates ----------
  const pad = n => String(n).padStart(2, '0');
  const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const weekday = s => parse(s).getDay();
  const weekStart = s => { const d = parse(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return iso(d); };
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WD_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const fmtLong = s => { const d = parse(s); return WD_LONG[d.getDay()] + ', ' + d.getDate() + '. ' + MON[d.getMonth()]; };
  const fmtShort = s => { const d = parse(s); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; };
  const fmtDate = s => { const d = parse(s); return d.getDate() + '. ' + MON[d.getMonth()] + ' ' + d.getFullYear(); };
  function fmtRel(s, ref) {
    const n = diffDays(ref || today(), s);
    if (n === 0) return 'heute'; if (n === 1) return 'morgen'; if (n === -1) return 'gestern';
    if (n > 1 && n < 7) return 'in ' + n + ' Tagen'; if (n < -1 && n > -7) return 'vor ' + (-n) + ' Tagen';
    return 'am ' + fmtShort(s);
  }
  function isoWeek(s) {
    const d = parse(s); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const w1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - w1) / 864e5 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  }
  const fmtNum = (n, d = 1) => (Math.round(n * Math.pow(10, d)) / Math.pow(10, d)).toLocaleString('de-DE');
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); }

  // ---------- Weather ----------
  const WMO = c => {
    if (c == null) return { k: 'cloud', t: '' };
    if (c === 0) return { k: 'sun', t: 'Klar' };
    if (c <= 2) return { k: 'suncloud', t: 'Leicht bewölkt' };
    if (c === 3) return { k: 'cloud', t: 'Bewölkt' };
    if (c === 45 || c === 48) return { k: 'fog', t: 'Nebel' };
    if (c >= 51 && c <= 57) return { k: 'rain', t: 'Nieselregen' };
    if (c >= 61 && c <= 67) return { k: 'rain', t: 'Regen' };
    if (c >= 71 && c <= 77) return { k: 'snow', t: 'Schnee' };
    if (c >= 80 && c <= 82) return { k: 'rain', t: 'Schauer' };
    if (c >= 85 && c <= 86) return { k: 'snow', t: 'Schneeschauer' };
    if (c >= 95) return { k: 'storm', t: 'Gewitter' };
    return { k: 'cloud', t: '' };
  };
  function dayWeather(w, date) {
    if (!w || !w.hourly || !w.daily) return null;
    const H = w.hourly, hours = [];
    for (let i = 0; i < H.time.length; i++) {
      if (H.time[i].slice(0, 10) !== date) continue;
      hours.push({ h: +H.time[i].slice(11, 13), t: H.temperature_2m[i], a: H.apparent_temperature[i], p: (H.precipitation_probability || [])[i] || 0 });
    }
    if (hours.length < 12) return null;
    const sel = (a, b) => hours.filter(x => x.h >= a && x.h <= b);
    const avg = arr => arr.reduce((s, x) => s + x, 0) / Math.max(1, arr.length);
    const di = w.daily.time.indexOf(date);
    const day = sel(7, 20);
    return {
      tMin: w.daily.temperature_2m_min[di], tMax: w.daily.temperature_2m_max[di], uv: (w.daily.uv_index_max || [])[di],
      aMorning: avg(sel(7, 9).map(x => x.a)), aDay: avg(sel(9, 18).map(x => x.a)), aEvening: avg(sel(17, 19).map(x => x.a)),
      aMin: Math.min(...day.map(x => x.a)), rain: Math.max(...day.map(x => x.p)), code: (w.daily.weather_code || w.daily.weathercode || [])[di]
    };
  }
  const SEASON_T = [2, 3, 7, 11, 15, 18, 20, 20, 16, 11, 6, 3];

  function context(S, date, occasion, wx) {
    const dayType = S.settings.week[weekday(date)] || 'frei';
    const home = wx && wx.home ? dayWeather(wx.home, date) : null;
    const office = wx && wx.office && dayType === 'buero' ? dayWeather(wx.office, date) : null;
    const ov = (S.wardrobe.tempOverride || {})[date];
    let tOut, tDay, rain = 0, code = null, src;
    if (ov != null && ov !== '') { tOut = tDay = +ov; src = 'manuell'; }
    else if (home) {
      tOut = office ? Math.min(home.aMorning, office.aEvening) : Math.min(home.aMorning, home.aDay);
      tDay = office ? office.aDay : home.aDay;
      rain = Math.max(home.rain, office ? office.rain : 0);
      code = home.code; src = 'wetter';
    } else { tOut = tDay = SEASON_T[parse(date).getMonth()]; src = 'saison'; }
    const effT = (tOut + tDay) / 2 - (S.settings.coldSensitive ? 2 : 0);
    return { date, occasion, dayType, tOut, tDay, effT, rain, code, src, home, office,
      needWinter: tOut < S.settings.winterBelow, needCoat: tOut < S.settings.coatBelow };
  }

  // ---------- Outfit engine ----------
  const OCC = {
    smart: { label: 'Smart Casual', f: [2.6, 3.6] },
    termin: { label: 'Termin', f: [3.5, 4.6] },
    freizeit: { label: 'Freizeit', f: [1.9, 3.1] },
    abend: { label: 'Abend', f: [2.7, 3.8] }
  };
  function defaultOccasion(S, date) {
    const t = S.settings.week[weekday(date)] || 'frei';
    return t === 'frei' ? 'freizeit' : 'smart';
  }
  const isHeavy = it => /cord|grob|wollig|sehr dick/i.test(it.texture || '') || it.w >= 2.6;
  const isLinen = it => (it.material || []).some(m => /leinen/i.test(m));
  function topBand(t) { if (t >= 24) return [0.9, 1.9]; if (t >= 19) return [1.0, 2.3]; if (t >= 14) return [2.2, 4.0]; if (t >= 8) return [3.0, 5.0]; return [3.4, 5.6]; }
  function bottomBand(t) { if (t >= 22) return [0.6, 1.6]; if (t >= 14) return [1.0, 2.0]; if (t >= 6) return [1.3, 2.4]; return [1.6, 2.6]; }

  function pool(S, extra) {
    const items = S.wardrobe.items.filter(i => i.status === 'aktiv' && !i.laundry);
    if (extra) items.push(extra);
    const by = r => items.filter(i => i.role === r);
    return { items, tees: by('tee'), polos: by('polo'), shirts: by('shirt'), overs: by('overshirt'), knits: by('knit'), cards: by('cardigan'), blazers: by('blazer'), jackets: by('jacket'), bottoms: by('bottom'), shoes: by('shoes'), coats: by('coat'), winters: by('winter'), caps: by('cap'), scarves: by('scarf'), beanies: by('beanie'), belts: by('belt'), watches: by('watch') };
  }

  function combos(P) {
    const out = [];
    const add = (tops, open) => { for (const b of P.bottoms) out.push({ tops, bottom: b, open: !!open }); };
    for (const t of P.tees) {
      add([t]);
      for (const s of P.shirts) add([t, s], true);
      for (const o of P.overs) add([t, o], true);
      for (const k of P.knits) add([t, k]);
      for (const c of P.cards) add([t, c]);
      for (const bl of P.blazers) add([t, bl]);
      for (const j of P.jackets) add([t, j]);
    }
    for (const s of P.shirts) {
      add([s]);
      for (const k of P.knits) add([s, k]);
      for (const c of P.cards) add([s, c]);
      for (const bl of P.blazers) { add([s, bl]); for (const k of P.knits) add([s, k, bl]); }
      for (const o of P.overs) if (s.cat !== 'Business-Hemd') add([s, o], true);
    }
    for (const p of P.polos) { add([p]); for (const s of P.shirts) if (s.cat !== 'Business-Hemd') add([p, s], true); for (const bl of P.blazers) add([p, bl]); for (const o of P.overs) add([p, o], true); }
    for (const k of P.knits) add([k]);
    return out;
  }

  const keyOf = (tops, bottom) => tops.map(t => t.id).join('+') + '|' + bottom.id;
  function curatedIndex(S) {
    const idx = new Map();
    for (const o of S.wardrobe.outfits) {
      if (!o.bottom) continue;
      const tops = [...o.base, ...o.layer].filter(Boolean);
      idx.set(tops.join('+') + '|' + o.bottom, o);
      // also index by base+bottom for partial matches
    }
    return idx;
  }
  function wearCounts(S, date, days) {
    const from = addDays(date, -days), m = new Map();
    for (const w of S.wardrobe.wear) if (w.date > from && w.date < date) for (const id of w.items) m.set(id, (m.get(id) || 0) + 1);
    return m;
  }
  function recentKeys(S, date, days) {
    const from = addDays(date, -days), s = new Set();
    for (const w of S.wardrobe.wear) if (w.date > from && w.date < date && w.key) s.add(w.key);
    return s;
  }

  function scoreCombo(c, ctx, env) {
    const { tops, bottom } = c;
    const outer = tops[tops.length - 1];
    let s = 50; const R = [];
    // formality
    let topF = outer.f;
    if (c.open && tops.length > 1) topF = (outer.f + tops[0].f) / 2 + 0.2;
    if (tops.length > 1 && tops[0].role === 'shirt' && ['knit', 'cardigan', 'blazer'].includes(outer.role)) topF = Math.max(outer.f, (tops[0].f + outer.f) / 2 + 0.3);
    const fBody = topF * 0.6 + bottom.f * 0.4;
    const [lo, hi] = OCC[ctx.occasion].f;
    if (fBody < lo) s -= (lo - fBody) * 22; else if (fBody > hi) s -= (fBody - hi) * 18;
    if (ctx.occasion === 'termin') {
      if (!tops.some(t => t.cat === 'Business-Hemd' || t.role === 'blazer')) s -= 10;
      if (tops[0].role === 'tee' && !tops.some(t => t.role === 'blazer')) s -= 18;
      if (bottom.cat === 'Jeans') s -= 8;
      if (c.open) s -= 6;
    }
    if (ctx.occasion === 'smart' && tops.length === 1 && tops[0].role === 'tee' && ctx.effT < 22) s -= 5;
    if (ctx.occasion === 'freizeit' && tops.some(t => t.cat === 'Business-Hemd')) s -= 6;
    if (tops.some(t => t.print) && ctx.occasion !== 'freizeit') s -= 10;
    // weather
    const topW = tops.reduce((a, t) => a + t.w, 0) - (c.open ? 0.3 : 0);
    const [tl, th] = topBand(ctx.effT), [bl, bh] = bottomBand(ctx.effT);
    if (topW < tl) s -= (tl - topW) * 14; else if (topW > th) s -= (topW - th) * 14;
    if (bottom.w < bl) s -= (bl - bottom.w) * 10; else if (bottom.w > bh) s -= (bottom.w - bh) * 10;
    const all = tops.concat([bottom]);
    if (all.some(isLinen) && ctx.effT < 14) s -= 15;
    if (all.some(isHeavy) && ctx.effT > 22) s -= 12;
    if (ctx.rain >= 60 && all.some(isLinen)) s -= 4;
    // color harmony
    const vis = all;
    const fams = new Set(vis.map(i => i.fam));
    const accents = vis.filter(i => i.fam === 'accent');
    const accentKeys = new Set(accents.map(i => i.colorKey));
    if (accentKeys.size > 1) s -= 22; else if (accents.length > 1) s -= 6;
    const hues = new Set(vis.filter(i => !i.nl && i.fam !== 'neutral').map(i => i.fam === 'accent' ? i.colorKey : i.fam));
    if (hues.size >= 3) s -= 12 * (hues.size - 2);
    if (fams.has('blue') && fams.has('earth')) { s += 9; R.push([7, 'Blau mit Erdtönen']); }
    else if (vis.some(i => i.fam === 'earth') && vis.every(i => i.fam === 'earth' || i.fam === 'neutral')) { s += 4; R.push([4, 'Erdtöne']); }
    else if (vis.some(i => i.fam === 'blue') && vis.every(i => i.fam === 'blue' || i.fam === 'neutral')) { s += 3; R.push([3, 'Blautöne']); }
    if (vis.filter(i => i.pattern && i.pattern !== 'uni').length >= 2) s -= 16;
    s += Math.min(6, vis.filter(i => i.fam === 'blue' || i.fam === 'earth').length * 2);
    const dL = Math.abs(outer.L - bottom.L);
    if (dL >= 28) { s += 4; R.push([3, 'Kontrast zwischen oben und unten']); }
    else if (dL < 10 && outer.fam === bottom.fam && outer.fam !== 'neutral') { s += 2; R.push([3, 'Ton in Ton']); }
    if (ctx.occasion === 'abend') { const avgL = vis.reduce((a, i) => a + i.L, 0) / vis.length; if (avgL < 45) { s += 5; R.push([5, 'Dunklere Töne für den Abend']); } }
    // slim build
    if (tops.length >= 2 && ctx.effT < 22) { s += 6; R.push([6, 'Lagenlook trägt auf, gut für deine schlanke Statur']); }
    const tex = all.filter(i => /cord|grob|dick|wollig|gerippt/i.test(i.texture || '')).length;
    if (tex && ctx.effT < 20) { s += Math.min(6, tex * 3); R.push([4, 'Strukturierte Stoffe geben Volumen']); }
    if (/slim/i.test(bottom.fit || '')) s -= 6;
    if (tops.some(t => /slim/i.test(t.fit || ''))) s -= 2;
    if (tops.some(t => /relaxed|oversized/i.test(t.fit || ''))) s += 2;
    if (bottom.L >= 60 || /cord|grob|dick/i.test(bottom.texture || '')) { s += 3; R.push([3, 'Helle oder kräftige Hose lässt die Beine voller wirken']); }
    // curated list + feedback
    const key = keyOf(tops, bottom);
    const cur = env.curated.get(key);
    if (cur) { s += 12; R.push([8, 'Aus deiner Liste: „' + cur.name + '“']); }
    const r = env.ratings[key];
    if (r === 1) { s += 10; R.push([9, 'Hat dir gefallen']); }
    if (r === -1) s -= 60;
    const ids = all.map(i => i.id);
    for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
      const pk = ids[a] < ids[b] ? ids[a] + '~' + ids[b] : ids[b] + '~' + ids[a];
      if (env.pairs[pk]) s += env.pairs[pk] * 2;
    }
    // freshness
    for (const t of tops) { const n = env.worn7.get(t.id) || 0; if (n >= (t.qty || 1)) s -= 18; }
    if ((env.worn3.get(bottom.id) || 0) >= (bottom.qty || 1)) s -= 6;
    if (env.recent.has(key)) s -= 20;
    // daily variation
    s += (hash(ctx.date + key + (env.reroll || 0)) % 70) / 10;
    return { s, R, fBody, key, cur };
  }

  function pickShoes(P, o, ctx) { const r = rankShoes(P, o, ctx); return r.length ? r[0].sh : null; }
  function rankShoes(P, o, ctx) {
    const out = [];
    for (const sh of P.shoes) {
      let sc = -Math.abs(sh.f - o.fBody) * 6;
      const b = o.bottom;
      const brownish = sh.fam === 'earth';
      const blackish = sh.fam === 'neutral' && sh.L < 30;
      if (brownish && (b.fam === 'blue' || b.fam === 'earth' || (b.fam === 'neutral' && b.L > 40))) sc += 3;
      if (blackish && b.fam === 'neutral' && b.L < 45) sc += 3;
      if (blackish && (b.fam === 'earth' || (b.L > 60))) sc -= 3;
      if (sh.cat === 'Sneaker') { if (o.fBody > 3.4) sc -= 8; if (ctx.rain >= 60) sc -= 2; if (ctx.occasion === 'freizeit') sc += 2.5; if (ctx.occasion === 'smart' && o.fBody <= 3.2) sc += 1.5; }
      if (sh.cat === 'Business-Schuhe' && ctx.occasion !== 'termin') sc -= 2;
      out.push({ sh, sc });
    }
    return out.sort((a, b) => b.sc - a.sc);
  }

  function finish(P, o, ctx, S) {
    o.shoes = pickShoes(P, o, ctx);
    o.outer = null; o.outerHint = null;
    if (ctx.needWinter) { o.outer = P.winters[0] || P.coats[0] || null; if (!o.outer) o.outerHint = 'Winterjacke'; }
    else if (ctx.needCoat) { o.outer = P.coats[0] || null; if (!o.outer) o.outerHint = 'Mantel'; }
    o.acc = [];
    if (ctx.occasion === 'freizeit' && P.caps.length && ctx.rain < 70) o.acc.push(P.caps[0]);
    if (ctx.tOut < 5) { if (P.scarves[0]) o.acc.push(P.scarves[0]); if (P.beanies[0] && ctx.occasion !== 'termin') o.acc.push(P.beanies[0]); }
    if (P.belts.length && o.shoes) { const want = o.shoes.fam === 'earth' ? 'earth' : 'neutral'; const belt = P.belts.find(b => b.fam === want) || P.belts[0]; o.acc.push(belt); }
    if (P.watches[0]) o.acc.push(P.watches[0]);
    // reasons
    const R = o.R.slice().sort((a, b) => b[0] - a[0]);
    const seen = new Set(), reasons = [];
    for (const [, t] of R) { if (!seen.has(t)) { seen.add(t); reasons.push(t); } if (reasons.length >= 3) break; }
    const t = Math.round(ctx.tOut);
    if (o.outer || o.outerHint) reasons.push(t + '° gefühlt unterwegs, dazu ' + (o.outer ? o.outer.cat : o.outerHint));
    o.reasons = reasons;
    return o;
  }

  function suggest(S, ctx, opts) {
    opts = opts || {};
    const P = pool(S, opts.extra);
    if (!P.bottoms.length || !(P.tees.length + P.shirts.length + P.knits.length + P.polos.length)) return { fav: null, alts: [], list: [] };
    const env = {
      curated: curatedIndex(S), ratings: S.wardrobe.ratings || {}, pairs: S.wardrobe.pairs || {},
      worn7: wearCounts(S, ctx.date, 7), worn3: wearCounts(S, ctx.date, 3), recent: recentKeys(S, ctx.date, 14),
      reroll: ((S.wardrobe.reroll || {})[ctx.date + ':' + ctx.occasion]) || 0
    };
    const list = combos(P).map(c => Object.assign(c, scoreCombo(c, ctx, env)));
    list.sort((a, b) => b.s - a.s);
    if (opts.raw) return { list };
    const core = o => new Set(o.tops.map(t => t.id).concat([o.bottom.id]));
    const overlap = (a, b) => { const A = core(a); let n = 0; for (const x of core(b)) if (A.has(x)) n++; return n; };
    let fav = list[0];
    if (opts.pick) fav = list.find(o => o.key === opts.pick) || fav;
    const alts = [];
    for (const o of list) {
      if (alts.length >= 2) break;
      if (o === fav) continue;
      if (overlap(o, fav) > 1) continue;
      if (alts.some(a => overlap(a, o) > 1)) continue;
      alts.push(o);
    }
    [fav, ...alts].forEach(o => finish(P, o, ctx, S));
    return { fav, alts, list };
  }

  // Alternatives for one piece of the current outfit that keep all other pieces, best first.
  // slot: 't0'..'t2' (tops from the inside out), 'bottom', 'shoes', 'outer'.
  function swapOptions(S, ctx, cur, slot) {
    if (!cur) return [];
    const P = pool(S);
    if (slot === 'shoes') {
      if (!cur.shoes) return [];
      const base = { fBody: cur.fBody, bottom: cur.bottom };
      const ranked = rankShoes(P, base, ctx);
      const best = ranked.length ? ranked[0].sc : 0;
      return ranked.filter(r => r.sh.id !== cur.shoes.id && r.sc >= best - 7).map(r => ({ item: r.sh, fit: r.sc >= best - 2 ? 2 : 1 }));
    }
    if (slot === 'outer') {
      if (!cur.outer) return [];
      const opts = (ctx.needWinter ? P.winters.concat(P.coats) : P.coats.concat(P.winters)).filter(x => x.id !== cur.outer.id);
      return opts.map(x => ({ item: x, fit: x.role === cur.outer.role ? 2 : 1 }));
    }
    const { list } = suggest(S, ctx, { raw: true });
    const me = list.find(c => c.key === cur.key);
    const curS = me ? me.s : (cur.s || 80);
    const floor = Math.max(58, curS - 18);
    const ids = c => c.tops.map(t => t.id);
    let found;
    if (slot === 'bottom') {
      const tk = ids(cur).join('+');
      found = list.filter(c => c.bottom.id !== cur.bottom.id && ids(c).join('+') === tk).map(c => ({ c, item: c.bottom }));
    } else {
      const i = +slot.slice(1);
      found = list.filter(c => c.bottom.id === cur.bottom.id && c.tops.length === cur.tops.length && c.open === cur.open &&
        c.tops.every((t, j) => j === i ? t.id !== cur.tops[i].id : t.id === cur.tops[j].id)).map(c => ({ c, item: c.tops[i] }));
    }
    return found.filter(x => x.c.s >= floor).sort((a, b) => b.c.s - a.c.s)
      .map(x => ({ item: x.item, key: x.c.key, fit: x.c.s >= curS - 6 ? 2 : 1 }));
  }
  // Apply the stored choice of the day (picked combo plus swapped shoes or outerwear).
  function applyChoice(S, o, ch) {
    if (!o || !ch) return o;
    const by = id => S.wardrobe.items.find(i => i.id === id && i.status === 'aktiv' && !i.laundry);
    if (ch.shoes && by(ch.shoes)) {
      o.shoes = by(ch.shoes);
      const belts = (o.acc || []).filter(a => a.role === 'belt');
      if (belts.length) {
        const want = o.shoes.fam === 'earth' ? 'earth' : 'neutral';
        const pick = S.wardrobe.items.find(i => i.role === 'belt' && i.status === 'aktiv' && i.fam === want);
        if (pick) o.acc = o.acc.map(a => a.role === 'belt' ? pick : a);
      }
    }
    if (ch.outer && o.outer && by(ch.outer)) o.outer = by(ch.outer);
    return o;
  }

  // Build a renderable outfit from stored ids (curated list or wear log)
  function fromIds(S, ids, ctx) {
    const by = id => S.wardrobe.items.find(i => i.id === id);
    const items = ids.map(by).filter(Boolean);
    const order = ['tee', 'polo', 'shirt', 'knit', 'cardigan', 'overshirt', 'blazer', 'jacket'];
    const tops = items.filter(i => order.includes(i.role)).sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role));
    return {
      tops, bottom: items.find(i => i.role === 'bottom') || null, shoes: items.find(i => i.role === 'shoes') || null,
      outer: items.find(i => i.role === 'coat' || i.role === 'winter') || null,
      acc: items.filter(i => ['cap', 'belt', 'watch', 'scarf', 'beanie'].includes(i.role)), reasons: []
    };
  }
  function outfitIds(o) { return [...o.tops.map(t => t.id), o.bottom && o.bottom.id, o.shoes && o.shoes.id, o.outer && o.outer.id, ...(o.acc || []).map(a => a.id)].filter(Boolean); }

  // Count good combos (for gap analysis) across a cool and a mild day
  function goodCombos(S, extra) {
    let n = 0;
    for (const effT of [7, 17]) {
      const ctx = { date: '2000-01-01', occasion: 'smart', effT, tOut: effT, tDay: effT, rain: 0, needCoat: false, needWinter: false };
      const { list } = suggest(S, ctx, { raw: true, extra });
      n += list.filter(o => o.s >= 66 && (!extra || o.tops.includes(extra) || o.bottom === extra)).length;
    }
    return n;
  }

  // ---------- Training ----------
  function sessionsSorted(S) { return S.training.sessions.slice().sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0); }
  function lastEntry(S, exId) {
    for (const s of sessionsSorted(S)) {
      const e = s.entries.find(x => x.ex === exId && x.sets.some(st => st.done));
      if (e) return { date: s.date, sets: e.sets.filter(st => st.done), imported: !!s.imported };
    }
    return null;
  }
  const roundTo = (x, step) => Math.round(x / step) * step;
  function suggestion(S, ex) {
    const last = lastEntry(S, ex.id);
    const time = ex.type === 'time';
    if (!last) return { kg: ex.max ? Math.min(ex.start, ex.max) : ex.start, reps: ex.repMin, state: 'start', why: ex.estimate ? 'Startgewicht geschätzt. Wähle es so, dass ' + ex.repMax + ' saubere Wiederholungen gerade noch gehen.' : (time ? 'Starte mit ' + ex.repMin + ' Sekunden.' : 'Startwert') };
    const sets = last.sets;
    const kg = Math.max(...sets.map(s => +s.kg || 0));
    const reps = sets.map(s => +s.reps || 0);
    const enough = sets.length >= Math.min(ex.sets, 3) || sets.length >= ex.sets;
    const allTop = enough && reps.every(r => r >= ex.repMax);
    const anyLow = reps.some(r => r < ex.repMin);
    if (time) {
      if (allTop) return { kg: 0, reps: ex.repMax, state: 'up', why: 'Ziel geschafft. Halte ' + ex.repMax + ' s mit noch mehr Spannung oder enger gestellten Füßen.' };
      return { kg: 0, reps: Math.min(Math.max(...reps) + 5, ex.repMax), state: 'same', why: '5 Sekunden mehr als beim letzten Mal anpeilen.' };
    }
    if (allTop && ex.inc > 0 && ex.max && kg + ex.inc > ex.max) return { kg: ex.max, reps: ex.repMax + 2, state: 'up', why: 'Mehr Gewicht geben deine Hanteln nicht her. Jetzt ' + (ex.repMax + 2) + ' Wiederholungen anpeilen oder 3 Sekunden langsam ablassen.' };
    if (allTop && ex.inc > 0) { const n = roundTo(kg + ex.inc, ex.inc < 1 ? 0.25 : 0.5); return { kg: n, reps: ex.repMin, state: 'up', why: 'Letztes Mal alle Sätze mit ' + ex.repMax + ' Wdh. Jetzt die nächste Stufe.' }; }
    if (allTop) return { kg, reps: ex.repMax + 2, state: 'up', why: 'Alle Sätze geschafft. Mehr Wiederholungen oder eine schwerere Variante.' };
    if (anyLow) return { kg, reps: ex.repMin, state: 'hold', why: 'Gewicht halten, bis alle Sätze mindestens ' + ex.repMin + ' Wdh. schaffen.' };
    return { kg, reps: Math.min(Math.min(...reps) + 1, ex.repMax), state: 'same', why: 'Gleiches Gewicht, je Satz eine Wiederholung mehr anpeilen.' };
  }
  const e1rm = (kg, reps) => kg * (1 + reps / 30);
  function sessionStats(s, exercises) {
    let sets = 0, vol = 0;
    for (const e of s.entries) for (const st of e.sets) if (st.done) { sets++; const ex = exercises[e.ex]; if (!ex || ex.type !== 'time') vol += (+st.kg || 0) * (+st.reps || 0); }
    return { sets, vol };
  }
  function series(S, exId) {
    const pts = [];
    for (const s of sessionsSorted(S).reverse()) {
      const e = s.entries.find(x => x.ex === exId);
      if (!e) continue;
      const done = e.sets.filter(x => x.done && +x.reps > 0);
      if (!done.length) continue;
      const top = done.reduce((a, b) => (+b.kg > +a.kg || (+b.kg === +a.kg && +b.reps > +a.reps)) ? b : a);
      pts.push({ date: s.date, kg: +top.kg, reps: +top.reps, imported: !!s.imported });
    }
    return pts;
  }
  function weekCounts(S, date) {
    const ws = weekStart(date), we = addDays(ws, 6);
    const inW = d => d >= ws && d <= we;
    return {
      gym: S.training.sessions.filter(s => !s.imported && inW(s.date)).length,
      run: S.training.runs.filter(r => inW(r.date)).length,
      routine: S.training.routineLog.filter(r => (r.id === 'haltung' || r.id === 'dehnen') && inW(r.date)).length
    };
  }
  function nextPlan(S) {
    const real = sessionsSorted(S).filter(s => !s.imported && (s.plan === 'A' || s.plan === 'B'));
    if (!real.length) return 'A';
    return real[0].plan === 'A' ? 'B' : 'A';
  }

  // ---------- Grooming ----------
  function initGrooming(S, date) {
    for (const t of S.grooming.tasks) {
      if (t.slot !== 'rhythmus' || S.grooming.last[t.id]) continue;
      if (t.weekend) { let d = date; while (weekday(d) !== 0) d = addDays(d, -1); if (d === date) d = addDays(d, -7); S.grooming.last[t.id] = d; }
      else S.grooming.last[t.id] = addDays(date, (t.first || 0) - t.every);
    }
  }
  function nextWeekend(d) { while (weekday(d) !== 6 && weekday(d) !== 0) d = addDays(d, 1); return d; }
  function due(S, t, date) {
    const last = S.grooming.last[t.id];
    if (!last) return { state: 'unknown', diff: null, date: null };
    let d = addDays(last, t.every);
    if (t.weekend) d = nextWeekend(addDays(last, t.every - 1));
    const diff = diffDays(date, d);
    return { date: d, diff, state: diff < 0 ? 'overdue' : diff === 0 ? 'today' : diff <= 2 ? 'soon' : 'ok' };
  }
  function dueList(S, date) {
    return S.grooming.tasks.filter(t => t.slot === 'rhythmus' || t.slot === 'vorsorge')
      .map(t => ({ t, d: due(S, t, date) }))
      .filter(x => x.d.state === 'overdue' || x.d.state === 'today')
      .sort((a, b) => a.d.diff - b.d.diff);
  }
  function dailyTasks(S, date, slot) {
    const done = S.grooming.daily[date] || {};
    const month = parse(date).getMonth() + 1;
    return S.grooming.tasks.filter(t => t.slot === slot).map(t => ({ t, done: !!done[t.id], optional: !!t.optional || (t.seasonal && (month < 3 || month > 10)) }));
  }
  function everyText(n) {
    if (n === 1) return 'täglich'; if (n === 3) return '2× pro Woche'; if (n === 7) return 'wöchentlich'; if (n === 14) return 'alle 2 Wochen';
    if (n === 21) return 'alle 3 Wochen'; if (n === 30 || n === 31) return 'monatlich'; if (n === 90) return 'alle 3 Monate'; if (n === 182 || n === 183) return 'halbjährlich';
    if (n === 365) return 'jährlich'; if (n === 730) return 'alle 2 Jahre'; if (n === 1095) return 'alle 3 Jahre'; if (n === 1825) return 'alle 5 Jahre'; if (n === 3650) return 'alle 10 Jahre';
    return n % 7 === 0 ? 'alle ' + (n / 7) + ' Wochen' : 'alle ' + n + ' Tage';
  }

  const api = { iso, parse, today, addDays, diffDays, weekday, weekStart, WD, WD_LONG, MON, fmtLong, fmtShort, fmtDate, fmtRel, isoWeek, fmtNum, hash,
    WMO, dayWeather, context, OCC, defaultOccasion, suggest, swapOptions, applyChoice, fromIds, outfitIds, keyOf, goodCombos, pool,
    lastEntry, suggestion, e1rm, sessionStats, series, weekCounts, nextPlan, sessionsSorted,
    initGrooming, due, dueList, dailyTasks, everyText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
