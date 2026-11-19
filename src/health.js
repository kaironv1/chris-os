/* Health logic: symptom catalog, episodes, early warning, breath factors, home workout, stretching, calendar files. */
(function (root) {
  'use strict';
  const E = root.Engine || (typeof require !== 'undefined' ? require('./engine.js') : null);

  // ---------- Catalogs ----------
  const SYMPTOMS = [
    { g: 'Infekt', id: 'hals_kratzen', l: 'Halskratzen', inf: 1, fach: ['allg', 'hno'] },
    { g: 'Infekt', id: 'hals_schmerz', l: 'Halsschmerzen', inf: 1.5, fach: ['allg', 'hno'] },
    { g: 'Infekt', id: 'nase_lauf', l: 'Laufende Nase', inf: 1, fach: ['allg', 'hno'] },
    { g: 'Infekt', id: 'nase_zu', l: 'Verstopfte Nase', inf: 1, fach: ['allg', 'hno', 'zahn'] },
    { g: 'Infekt', id: 'niesen', l: 'Niesen', inf: 0.7, fach: ['allg', 'hno'] },
    { g: 'Infekt', id: 'husten', l: 'Husten', inf: 1.2, fach: ['allg', 'hno'] },
    { g: 'Infekt', id: 'glieder', l: 'Gliederschmerzen', inf: 1.5, fach: ['allg'] },
    { g: 'Infekt', id: 'kopf', l: 'Kopfschmerzen', inf: 0.8, fach: ['allg'] },
    { g: 'Infekt', id: 'froesteln', l: 'Frösteln', inf: 1.2, fach: ['allg'] },
    { g: 'Infekt', id: 'fieber', l: 'Fieber', inf: 3, fach: ['allg'] },
    { g: 'Infekt', id: 'muede', l: 'Abgeschlagen', inf: 0.5, weak: true, fach: ['allg'] },
    { g: 'Mund', id: 'trocken_mund', l: 'Trockener Mund', fach: ['zahn', 'hno'] },
    { g: 'Mund', id: 'zahnfleisch', l: 'Zahnfleischbluten', fach: ['zahn'] },
    { g: 'Mund', id: 'sodbrennen', l: 'Sodbrennen', fach: ['allg', 'zahn'] },
    { g: 'Körper', id: 'verspannt', l: 'Verspannt', fach: ['ortho'] },
    { g: 'Körper', id: 'schwindel', l: 'Schwindel', fach: ['allg'] },
    { g: 'Körper', id: 'magen', l: 'Magen-Darm', fach: ['allg'] },
    { g: 'Körper', id: 'schlaf', l: 'Schlecht geschlafen', fach: ['allg', 'neuro'] },
    { g: 'Körper', id: 'beine_unruhig', l: 'Unruhige Beine', fach: ['neuro'] },
    { g: 'Haut', id: 'haut_trocken', l: 'Trockene Haut', fach: ['haut'] },
    { g: 'Haut', id: 'haut_rot', l: 'Ausschlag oder Rötung', fach: ['haut'] },
    { g: 'Augen', id: 'augen', l: 'Gereizte Augen', fach: ['augen'] },
    { g: 'Warnzeichen', id: 'atemnot', l: 'Atemnot', red: true, fach: ['allg'] },
    { g: 'Warnzeichen', id: 'brustschmerz', l: 'Brustschmerz', red: true, fach: ['allg'] }
  ];
  // Chris' colds usually start with aching limbs and/or a sore throat, the runny nose follows.
  const QUICK = ['glieder', 'hals_schmerz', 'hals_kratzen', 'nase_lauf', 'nase_zu', 'muede', 'kopf', 'verspannt'];
  // Body map: front (v) and back (h)
  const REGIONS = [
    { id: 'kopf', l: 'Kopf', side: 'v', fach: ['allg'] }, { id: 'hals', l: 'Hals', side: 'v', fach: ['allg', 'hno'] },
    { id: 'schulter_r', l: 'Schulter rechts', side: 'v', fach: ['ortho'] }, { id: 'schulter_l', l: 'Schulter links', side: 'v', fach: ['ortho'] },
    { id: 'brust', l: 'Brust', side: 'v', fach: ['allg'] }, { id: 'bauch', l: 'Bauch', side: 'v', fach: ['allg'] },
    { id: 'arm_r', l: 'Arm rechts', side: 'v', fach: ['ortho'] }, { id: 'arm_l', l: 'Arm links', side: 'v', fach: ['ortho'] },
    { id: 'hand_r', l: 'Hand rechts', side: 'v', fach: ['ortho'] }, { id: 'hand_l', l: 'Hand links', side: 'v', fach: ['ortho'] },
    { id: 'huefte_r', l: 'Hüfte rechts', side: 'v', fach: ['ortho'] }, { id: 'huefte_l', l: 'Hüfte links', side: 'v', fach: ['ortho'] },
    { id: 'knie_r', l: 'Knie rechts', side: 'v', fach: ['ortho'] }, { id: 'knie_l', l: 'Knie links', side: 'v', fach: ['ortho'] },
    { id: 'schienbein_r', l: 'Schienbein rechts', side: 'v', fach: ['ortho'] }, { id: 'schienbein_l', l: 'Schienbein links', side: 'v', fach: ['ortho'] },
    { id: 'fuss_r', l: 'Fuß rechts', side: 'v', fach: ['ortho'] }, { id: 'fuss_l', l: 'Fuß links', side: 'v', fach: ['ortho'] },
    { id: 'nacken', l: 'Nacken', side: 'h', fach: ['ortho'] },
    { id: 'oberer_ruecken', l: 'Oberer Rücken', side: 'h', fach: ['ortho'] }, { id: 'unterer_ruecken', l: 'Unterer Rücken', side: 'h', fach: ['ortho'] },
    { id: 'gesaess', l: 'Gesäß', side: 'h', fach: ['ortho'] },
    { id: 'oberschenkel_hl', l: 'Oberschenkel hinten links', side: 'h', fach: ['ortho'] }, { id: 'oberschenkel_hr', l: 'Oberschenkel hinten rechts', side: 'h', fach: ['ortho'] },
    { id: 'wade_l', l: 'Wade links', side: 'h', fach: ['ortho'] }, { id: 'wade_r', l: 'Wade rechts', side: 'h', fach: ['ortho'] },
    { id: 'ferse_l', l: 'Ferse links', side: 'h', fach: ['ortho'] }, { id: 'ferse_r', l: 'Ferse rechts', side: 'h', fach: ['ortho'] }
  ];
  const FACTORS = [
    { id: 'umfeld', l: 'Jemand im Umfeld krank' }, { id: 'menschen', l: 'Viel unter Menschen' }, { id: 'kalt', l: 'Ausgekühlt oder gefroren' },
    { id: 'alkohol', l: 'Alkohol' }, { id: 'knoblauch', l: 'Knoblauch oder Zwiebeln' }, { id: 'spaet', l: 'Spät oder schwer gegessen' },
    { id: 'nuechtern', l: 'Lange nichts gegessen' }, { id: 'skip_zunge', l: 'Zungenschaber ausgelassen' },
    { id: 'skip_floss', l: 'Zahnseide ausgelassen' }, { id: 'skip_nase', l: 'Nasenspülung ausgelassen' }
  ];
  const FACH = { allg: 'Hausarzt', hno: 'HNO', haut: 'Haut', augen: 'Augen', zahn: 'Zahn', ortho: 'Orthopädie', neuro: 'Neurologie' };
  const INT = ['', 'leicht', 'mittel', 'stark'];
  const BREATH = ['gut', 'mittel', 'schlecht'];
  const symById = id => SYMPTOMS.find(s => s.id === id);
  const regById = id => REGIONS.find(r => r.id === id);
  function symLabel(key) {
    if (key.startsWith('bm:')) { const r = regById(key.slice(3)); return 'Schmerz ' + (r ? r.l : key.slice(3)); }
    if (key.startsWith('c:')) return key.slice(2);
    const s = symById(key); return s ? s.l : key;
  }
  function symFach(key) {
    if (key.startsWith('bm:')) { const r = regById(key.slice(3)); return r ? r.fach : ['ortho']; }
    if (key.startsWith('c:')) return ['allg'];
    const s = symById(key); return s ? s.fach : ['allg'];
  }

  // ---------- Day helpers ----------
  const dayOf = (S, d) => (S.health.days || {})[d] || null;
  function hasData(day) { return !!day && (day.mood != null || day.energy != null || day.stress != null || day.sleepH != null || day.sleepQ != null || day.breath != null || day.temp != null || Object.keys(day.sym || {}).length > 0 || !!day.none); }
  function infScore(day) {
    if (!day || !day.sym) return 0;
    let s = 0, strong = 0;
    for (const [k, v] of Object.entries(day.sym)) {
      const d = symById(k); if (!d || !d.inf || !v) continue;
      if (d.weak) continue; s += d.inf * v; strong++;
    }
    if (strong && day.sym.muede) s += 0.5 * day.sym.muede;
    if (day.temp != null && day.temp >= 38 && !(day.sym.fieber)) s += 3;
    return Math.round(s * 10) / 10;
  }
  function infSyms(day) { return Object.entries((day && day.sym) || {}).filter(([k, v]) => v && symById(k) && symById(k).inf && !(symById(k).weak)).map(([k]) => k); }
  function describe(day, keys) {
    keys = keys || Object.keys((day && day.sym) || {}).filter(k => day.sym[k]);
    return keys.map(k => symLabel(k) + (day.sym[k] ? ' ' + INT[day.sym[k]] : '')).join(', ');
  }

  // ---------- Episodes ----------
  function episodes(S, today) {
    const days = S.health.days || {};
    const dates = Object.keys(days).filter(d => hasData(days[d])).sort();
    const eps = [];
    let cur = null, lastSick = null;
    for (const d of dates) {
      const sc = infScore(days[d]);
      if (sc > 0) {
        if (cur && lastSick && E.diffDays(lastSick, d) <= 2) { cur.end = d; cur.days.push(d); cur.max = Math.max(cur.max, sc); cur.total += sc; }
        else { cur = { start: d, end: d, days: [d], max: sc, total: sc }; eps.push(cur); }
        lastSick = d;
      } else if (cur) { cur = null; }
    }
    const ov = S.health.epOut || {};
    for (const ep of eps) {
      const first = days[ep.start];
      ep.first = infSyms(first);
      ep.fever = ep.days.some(d => (days[d].sym && days[d].sym.fieber) || (days[d].temp != null && days[d].temp >= 38));
      const early = new Set();
      ep.days.filter(d => E.diffDays(ep.start, d) <= 1).forEach(d => (days[d].meas || []).forEach(m => early.add(m)));
      ep.early = [...early];
      ep.length = E.diffDays(ep.start, ep.end) + 1;
      const ongoing = E.diffDays(ep.end, today) <= 1;
      let auto = (ep.fever || ep.max >= 5 || ep.length >= 5) ? 'krank' : (ep.length >= 3 || ep.max >= 3) ? 'leicht' : 'abgewendet';
      if (ongoing && auto !== 'krank') auto = 'laeuft';
      ep.auto = auto;
      ep.outcome = ov[ep.start] || auto;
      ep.manual = !!ov[ep.start];
    }
    return eps;
  }
  const OUTCOME = { abgewendet: 'abgewendet', leicht: 'leichte Erkältung', krank: 'richtig krank', laeuft: 'läuft noch' };

  function measureStats(S, eps) {
    const done = eps.filter(e => e.outcome !== 'laeuft');
    const ms = (S.health.measures || []);
    return ms.map(m => {
      const used = done.filter(e => e.early.includes(m.id));
      const not = done.filter(e => !e.early.includes(m.id));
      const ok = used.filter(e => e.outcome === 'abgewendet').length;
      const okNot = not.filter(e => e.outcome === 'abgewendet').length;
      return { m, n: used.length, ok, rate: used.length ? ok / used.length : null, nNot: not.length, rateNot: not.length ? okNot / not.length : null };
    }).filter(x => x.n > 0).sort((a, b) => (b.rate - a.rate) || (b.n - a.n));
  }

  // Factor shares in the 2 days before an episode vs. ordinary days
  function onsetFactors(S, eps) {
    const days = S.health.days || {};
    const all = Object.keys(days).filter(d => hasData(days[d])).sort();
    const sick = new Set(), pre = new Set();
    eps.forEach(e => { e.days.forEach(d => sick.add(d)); [1, 2].forEach(k => pre.add(E.addDays(e.start, -k))); pre.add(e.start); });
    const tests = [
      ['Wenig Schlaf (unter 6,5 h)', d => d.sleepH != null ? d.sleepH < 6.5 : null],
      ['Viel Stress', d => d.stress != null ? d.stress >= 4 : null],
      ['Jemand im Umfeld krank', d => !!(d.f && d.f.umfeld)],
      ['Viel unter Menschen', d => !!(d.f && d.f.menschen)],
      ['Ausgekühlt oder gefroren', d => !!(d.f && d.f.kalt)],
      ['Alkohol', d => !!(d.f && d.f.alkohol)],
      ['Hartes Training', (d, date) => S.training.sessions.some(s => !s.imported && s.date === date)]
    ];
    const res = [];
    for (const [label, fn] of tests) {
      let pn = 0, pk = 0, bn = 0, bk = 0;
      for (const d of all) {
        const v = fn(days[d], d); if (v == null) continue;
        if (pre.has(d)) { pk++; if (v) pn++; } else if (!sick.has(d)) { bk++; if (v) bn++; }
      }
      if (pk >= 3 && bk >= 5) {
        const p = pn / pk, b = bn / bk;
        if (p > b) res.push({ label, p, b, pk, bk, lift: b > 0 ? p / b : 9 });
      }
    }
    return res.sort((a, b) => b.lift - a.lift);
  }

  // ---------- Early warning ----------
  // Sleep account: missing hours against the personal goal over the last four nights.
  function sleepDebt(S, date) {
    const P = (S.health && S.health.profile) || {};
    const target = P.sleepGoal || 7.5;
    let debt = 0, nights = 0;
    for (let k = 0; k < 4; k++) {
      const x = dayOf(S, E.addDays(date, -k));
      if (x && x.sleepH != null) { debt += Math.max(0, target - x.sleepH); nights++; }
    }
    return { debt: Math.round(debt * 10) / 10, nights, target };
  }
  function bedtime(S) { const P = (S.health && S.health.profile) || {}; return P.bed || '22:30'; }
  function warning(S, date, wxToday) {
    const today = dayOf(S, date), yday = dayOf(S, E.addDays(date, -1));
    const src = hasData(today) ? today : (hasData(yday) ? yday : null);
    const basedOnYesterday = !hasData(today) && hasData(yday);
    const R = []; let score = 0;
    const red = [];
    if (src) {
      const inf = infScore(src);
      if (inf > 0) { score += Math.min(6, inf * 1.5); R.push(describe(src, infSyms(src).concat(src.sym.muede ? ['muede'] : [])) + (basedOnYesterday ? ' (gestern)' : '')); }
      if (src.sym && (src.sym.atemnot || src.sym.brustschmerz)) red.push(src.sym.atemnot ? 'Atemnot' : 'Brustschmerz');
      if (src.temp != null && src.temp >= 39) red.push('Fieber ab 39 °C');
      // streak
      let streak = 0, d = hasData(today) ? date : E.addDays(date, -1);
      while (infScore(dayOf(S, d)) > 0) { streak++; d = E.addDays(d, -1); }
      if (streak >= 2) { score += 1; R.push('seit ' + streak + ' Tagen'); }
      const feverDays = [0, 1, 2, 3].map(k => dayOf(S, E.addDays(date, -k))).filter(x => x && ((x.sym && x.sym.fieber) || (x.temp != null && x.temp >= 38))).length;
      if (feverDays >= 3) red.push('Fieber seit mehreren Tagen');
    }
    // Sleep is Chris' main trigger: count the debt of the last nights, not just one night.
    const P = (S.health && S.health.profile) || {};
    const sd = sleepDebt(S, date);
    const sleepTrigger = (P.triggers || []).includes('schlaf');
    let sleepPts = 0;
    if (sd.nights >= 2 && sd.debt >= 3) { sleepPts = sd.debt >= 4.5 ? 2 : 1.5; score += sleepPts; R.push('Schlafdefizit ' + E.fmtNum(sd.debt) + ' h in ' + sd.nights + ' Nächten' + (sleepTrigger ? ', dein häufigster Auslöser' : '')); }
    else {
      const lastNight = [today, yday].find(x => x && x.sleepH != null);
      if (lastNight && lastNight.sleepH < 6) { sleepPts = 1; score += 1; R.push('kurze Nacht (' + E.fmtNum(lastNight.sleepH) + ' h)'); }
    }
    const st = src && src.stress; if (st != null && st >= 4) { score += 1; R.push('viel Stress'); }
    const f = (src && src.f) || {};
    if (f.umfeld) { score += 1.5; R.push('Ansteckung im Umfeld'); }
    if (f.kalt) { score += 0.5; R.push('ausgekühlt'); }
    const early = src && (P.early || []).filter(k => src.sym && src.sym[k]);
    if (early && early.length && infScore(src) > 0) { score += 0.5; R.push('dein typisches Frühzeichen'); }
    if (src && infScore(src) > 0 && S.training.sessions.some(s => !s.imported && (s.date === date || s.date === E.addDays(date, -1)))) { score += 0.5; R.push('Training trotz Anzeichen'); }
    // personal pattern
    let personal = null;
    if (src && infScore(src) > 0) {
      const eps = episodes(S, date).filter(e => e.outcome !== 'laeuft' && E.diffDays(e.end, date) > 1);
      const now = infSyms(src);
      const similar = eps.filter(e => e.first.some(k => now.includes(k)));
      if (similar.length >= 3) {
        const conv = similar.filter(e => e.outcome !== 'abgewendet').length;
        const rate = conv / similar.length;
        personal = { n: similar.length, conv, rate };
        if (rate >= 0.6) { score += 2; R.push('wurde bei dir in ' + conv + ' von ' + similar.length + ' Fällen eine Erkältung'); }
        else if (rate <= 0.3) { score -= 1; R.push('verlief bei dir meist harmlos (' + (similar.length - conv) + ' von ' + similar.length + ')'); }
      }
    }
    // Any infection sign counts as an early warning: that's the moment measures still help.
    const signs = !!(src && infScore(src) > 0);
    // Too little sleep alone is a prevention hint, not an alarm (otherwise it would fire most weekdays).
    const level = red.length ? 'arzt' : score >= 5 ? 'schonen' : (signs || (score >= 2 && score - sleepPts >= 1)) ? 'achtung' : 'ruhig';
    const ms = measureStats(S, episodes(S, date)).filter(x => x.n >= 2 && x.rate >= 0.5).slice(0, 2);
    const tips = [];
    const myMeas = (P.measures || []).map(id => (S.health.measures.find(m => m.id === id) || {}).l).filter(Boolean);
    const bed = bedtime(S);
    if (level === 'achtung') {
      const mine = (P.measures || []).filter(id => !(id === 'schlaf' && sd.debt >= 2)).map(id => (S.health.measures.find(m => m.id === id) || {}).l).filter(Boolean);
      if (signs && mine.length) tips.push('Jetzt gegensteuern, wie du es kennst: ' + mine.join(', ') + '.');
      tips.push(sd.debt >= 2 ? 'Heute spätestens ' + bed + ' Uhr ins Bett, Ziel ' + E.fmtNum(sd.target) + ' Stunden.' : 'Heute früh schlafen, Ziel 8 Stunden.');
      if (!signs || !myMeas.length) tips.push('Viel trinken, gern warm.');
      tips.push('Training nur locker, oder dehnen statt schwer.');
      const then = (P.then || []).filter(k => !(src && src.sym && src.sym[k]));
      if (signs && early && early.length && then.length) tips.push('Bei dir folgt meist der Schnupfen. Die extra Nasenspülung lohnt sich schon jetzt.');
    } else if (level === 'schonen') {
      tips.push('Krafttraining heute ausfallen lassen.', 'Ruhe, Schlaf und viel trinken.', 'Bei Fieber gar kein Sport.');
    } else if (level === 'arzt') {
      tips.push('Bitte ärztlich abklären. Bei Atemnot, Brustschmerz oder sehr hohem Fieber sofort die Praxis oder den ärztlichen Bereitschaftsdienst (116 117) anrufen, im Notfall die 112.');
    }
    if ((level === 'achtung' || level === 'schonen') && ms.length) tips.push('Hat bei dir bisher geholfen: ' + ms.map(x => x.m.l + ' (' + x.ok + ' von ' + x.n + ')').join(', ') + '.');
    // Prevention hints while everything is calm: the sleep account and contacts.
    const prevent = [];
    if (level === 'ruhig') {
      if (sd.nights >= 2 && sd.debt >= 3) prevent.push({ k: 'schlaf', text: 'Schlafkonto: ' + E.fmtNum(sd.debt) + ' h zu wenig in ' + sd.nights + ' Nächten', tip: 'Heute bis ' + bed + ' Uhr ins Bett.' + (sleepTrigger ? ' Schlafmangel ist dein häufigster Auslöser.' : '') });
      if (f.umfeld) prevent.push({ k: 'umfeld', text: 'Ansteckung im Umfeld', tip: 'Hände waschen, viel trinken, früh schlafen.' });
    }
    return { level, score: Math.round(score * 10) / 10, reasons: level === 'ruhig' && !signs ? [] : R, tips, red, basedOnYesterday, personal, hasToday: hasData(today), prevent, sleep: sd };
  }
  const LEVEL = { ruhig: 'Alles ruhig', achtung: 'Achtung', schonen: 'Schonen', arzt: 'Arzt fragen' };

  // ---------- Breath ----------
  function breathFactors(S) {
    const days = S.health.days || {};
    const rated = Object.keys(days).filter(d => days[d] && days[d].breath != null).sort();
    const tests = [
      ['3 oder mehr Kaffee', (t) => t.f && t.f.kaffee != null ? t.f.kaffee >= 3 : null],
      ['Wenig getrunken (unter 1,5 l)', (t) => t.f && t.f.wasser != null ? t.f.wasser < 1.5 : null],
      ['Alkohol am Vortag', (t, p) => p ? !!(p.f && p.f.alkohol) : null],
      ['Knoblauch oder Zwiebeln', (t, p) => !!((t.f && t.f.knoblauch) || (p && p.f && p.f.knoblauch))],
      ['Zungenschaber ausgelassen', (t) => !!(t.f && t.f.skip_zunge)],
      ['Zahnseide am Vorabend ausgelassen', (t, p) => p ? !!(p.f && p.f.skip_floss) : null],
      ['Nasenspülung am Vorabend ausgelassen', (t, p) => p ? !!(p.f && p.f.skip_nase) : null],
      ['Verstopfte Nase', (t) => !!(t.sym && t.sym.nase_zu)],
      ['Trockener Mund', (t) => !!(t.sym && t.sym.trocken_mund)],
      ['Sodbrennen', (t) => !!(t.sym && t.sym.sodbrennen)],
      ['Spät gegessen am Vorabend', (t, p) => p ? !!(p.f && p.f.spaet) : null],
      ['Lange nichts gegessen', (t) => !!(t.f && t.f.nuechtern)],
      ['Wenig Schlaf', (t) => t.sleepH != null ? t.sleepH < 6.5 : null],
      ['Viel Stress', (t) => t.stress != null ? t.stress >= 4 : null],
      ['Infekt-Anzeichen', (t) => infScore(t) > 0],
      ['Sport am selben Tag', (t, p, d) => S.training.sessions.some(s => !s.imported && s.date === d) || S.training.runs.some(r => r.date === d)]
    ];
    const out = [];
    for (const [label, fn] of tests) {
      const w = [], wo = [];
      for (const d of rated) {
        const v = fn(days[d], days[E.addDays(d, -1)], d);
        if (v == null) continue;
        (v ? w : wo).push(days[d].breath);
      }
      if (w.length >= 3 && wo.length >= 3) {
        const a = w.reduce((s, x) => s + x, 0) / w.length, b = wo.reduce((s, x) => s + x, 0) / wo.length;
        out.push({ label, nWith: w.length, nWithout: wo.length, avgWith: a, avgWithout: b, diff: a - b });
      }
    }
    const dist = [0, 0, 0]; rated.forEach(d => dist[days[d].breath]++);
    return { rated: rated.length, dist, factors: out.sort((x, y) => y.diff - x.diff) };
  }

  // ---------- Home workout ----------
  const HOME_SLOTS = {
    ganz: [['h_goblet', 'h_split'], ['h_row'], ['h_floor', 'pushup'], ['h_rdl', 'h_hip'], ['h_revfly', 'h_ytw'], ['deadbug', 'plank', 'h_side'], ['h_press', 'dblatraise'], ['dbcurl', 'h_tri']],
    ober: [['h_row'], ['h_floor', 'pushup'], ['h_revfly'], ['h_press'], ['h_ytw', 'h_wall'], ['dblatraise'], ['dbcurl'], ['h_tri']],
    unter: [['h_goblet'], ['h_rdl'], ['h_split'], ['h_hip'], ['h_calf'], ['deadbug'], ['h_side'], ['h_birddog']],
    haltung: [['h_revfly'], ['h_row'], ['h_hip'], ['deadbug'], ['h_ytw'], ['h_birddog'], ['h_wall'], ['h_side']]
  };
  const HOME_FOCUS = { ganz: 'Ganzkörper', ober: 'Oberkörper', unter: 'Beine und Rumpf', haltung: 'Haltung' };
  function homeCount(min) { return min <= 20 ? 4 : min <= 30 ? 6 : 8; }
  function homePlan(focus, min, picks) {
    const slots = HOME_SLOTS[focus] || HOME_SLOTS.ganz;
    const n = homeCount(min);
    return slots.slice(0, n).map((opts, i) => ({ slot: i, ex: (picks && picks[i] && opts.includes(picks[i])) ? picks[i] : opts[0], opts, ss: 'H' + Math.floor(i / 2) }));
  }

  // ---------- Stretching ----------
  const STRETCHES = [
    { id: 'katzekuh', n: 'Katze-Kuh', sec: 45, cue: 'Im Vierfüßlerstand den Rücken rund und lang machen, im Rhythmus des Atems.', tags: ['ruecken'], when: 'beide' },
    { id: 'thorax', n: 'Thorax-Rotation', sec: 30, side: true, cue: 'Im Vierfüßlerstand eine Hand an den Hinterkopf, Ellbogen zur Decke aufdrehen.', tags: ['ruecken', 'brust', 'nacken'], when: 'beide' },
    { id: 'worlds', n: 'Weltbeste Dehnung', sec: 40, side: true, cue: 'Großer Ausfallschritt, Hand innen neben den Fuß, Oberkörper zur Seite aufdrehen.', tags: ['huefte', 'ruecken', 'beine'], when: 'morgen' },
    { id: 'hueftkreis', n: 'Hüftkreisen im Stand', sec: 30, cue: 'Hände an die Hüfte, große, langsame Kreise in beide Richtungen.', tags: ['huefte'], when: 'morgen' },
    { id: 'armkreis', n: 'Armkreisen rückwärts', sec: 30, cue: 'Große Kreise, Schultern weg von den Ohren.', tags: ['schulter', 'nacken'], when: 'morgen' },
    { id: 'wandengel', n: 'Wandengel', sec: 45, cue: 'Po, Rücken und Hinterkopf an der Wand, Arme langsam hoch und runter schieben.', tags: ['schulter', 'nacken', 'brust'], when: 'beide' },
    { id: 'hocke', n: 'Tiefe Hocke halten', sec: 40, cue: 'Fersen am Boden, Ellbogen schieben die Knie sanft nach außen.', tags: ['huefte', 'fuesse'], when: 'morgen' },
    { id: 'beinpendel', n: 'Beinpendel', sec: 25, side: true, cue: 'An der Wand festhalten, Bein locker vor und zurück schwingen.', tags: ['huefte', 'beine'], when: 'morgen' },
    { id: 'kurzfuss', n: 'Kurzfuß', sec: 30, side: true, cue: 'Zehen lang lassen, Fußballen Richtung Ferse ziehen und halten.', tags: ['fuesse'], when: 'beide' },
    { id: 'kinn', n: 'Kinn zurückschieben', sec: 30, cue: 'Leichtes Doppelkinn, Blick geradeaus, langsam wiederholen.', tags: ['nacken'], when: 'beide' },
    { id: 'kind', n: 'Kindhaltung', sec: 60, cue: 'Gesäß zu den Fersen, Arme lang nach vorn, ruhig in den Rücken atmen.', tags: ['ruecken', 'schulter'], when: 'abend' },
    { id: 'tuer', n: 'Brustdehnung im Türrahmen', sec: 40, side: true, cue: 'Unterarm an den Rahmen, Oberkörper sanft wegdrehen.', tags: ['brust', 'schulter'], when: 'beide' },
    { id: 'hueftbeuger', n: 'Hüftbeuger im Halbkniestand', sec: 45, side: true, cue: 'Po des hinteren Beins anspannen, Becken einrollen. Die Dehnung spürst du vorn an der Hüfte.', tags: ['huefte'], when: 'beide' },
    { id: 'taube', n: 'Taube', sec: 60, side: true, cue: 'Vorderes Bein angewinkelt vor dir, Oberkörper langsam nach vorn sinken lassen.', tags: ['huefte', 'ruecken'], when: 'abend' },
    { id: 'hamstring', n: 'Beinrückseite im Liegen', sec: 45, side: true, cue: 'Handtuch um den Fuß, gestrecktes Bein sanft zu dir ziehen.', tags: ['beine'], when: 'abend' },
    { id: 'nackenseite', n: 'Nacken seitlich', sec: 30, side: true, cue: 'Ohr Richtung Schulter, die andere Schulter sanft nach unten schieben.', tags: ['nacken'], when: 'beide' },
    { id: 'trapez', n: 'Nacken diagonal', sec: 30, side: true, cue: 'Nase Richtung Achsel, die Hand liegt nur leicht auf dem Hinterkopf.', tags: ['nacken'], when: 'abend' },
    { id: 'drehung', n: 'Liegende Drehung', sec: 45, side: true, cue: 'Auf dem Rücken, Knie zur Seite sinken lassen, Blick zur Gegenseite.', tags: ['ruecken'], when: 'abend' },
    { id: 'wade', n: 'Wade an der Wand', sec: 30, side: true, cue: 'Ferse am Boden, Knie gestreckt, Becken Richtung Wand.', tags: ['beine', 'fuesse'], when: 'abend' },
    { id: 'schmetterling', n: 'Schmetterling', sec: 45, cue: 'Fußsohlen aneinander, Knie sinken lassen, Rücken lang.', tags: ['huefte'], when: 'abend' },
    { id: 'atmung', n: 'Ruhige Atmung', sec: 60, cue: '4 Sekunden ein, 6 Sekunden aus. Hilft beim Runterkommen.', tags: ['ganz'], when: 'abend', last: true }
  ];
  const STRETCH_FOCUS = { ganz: 'Ganzkörper', nacken: 'Nacken und Schultern', huefte: 'Hüfte und Rücken' };
  const FOCUS_TAGS = { ganz: null, nacken: ['nacken', 'schulter', 'brust'], huefte: ['huefte', 'ruecken', 'beine'] };
  const itemSec = s => (s.side ? s.sec * 2 : s.sec) + 5;
  function stretchPlan(when, minutes, focus) {
    const tags = FOCUS_TAGS[focus] || null;
    const pool = STRETCHES.filter(s => (s.when === when || s.when === 'beide') && !s.last);
    const score = s => (tags ? (s.tags.some(t => tags.includes(t)) ? 2 : 0) : 1) + (s.when === when ? 1 : 0);
    const sorted = pool.slice().sort((a, b) => score(b) - score(a));
    const target = minutes * 60;
    const out = []; let t = 0;
    const finisher = when === 'abend' ? STRETCHES.find(s => s.last) : null;
    const reserve = finisher ? itemSec(finisher) : 0;
    for (const s of sorted) { if (t + itemSec(s) > target - reserve + 20) continue; out.push(s); t += itemSec(s); if (t >= target - reserve) break; }
    // natural order: keep library order (dynamic first, standing before floor)
    out.sort((a, b) => STRETCHES.indexOf(a) - STRETCHES.indexOf(b));
    if (finisher) out.push(finisher);
    return out;
  }
  // Estimated time from a dose text: "10×" ~ 3 s per rep, "10× 5 s" = 50 s, "12×, oben 2 s" = 48 s, "30 s je Seite" = 30 s per side
  function doseSec(dose) {
    const reps = /(\d+)\s*×/.exec(dose), hold = /(\d+)\s*s\b/.exec(dose);
    if (reps && hold) return Math.max(20, /oben/.test(dose) ? +reps[1] * (+hold[1] + 2) : +reps[1] * +hold[1]);
    if (hold) return +hold[1];
    if (reps) return Math.max(20, +reps[1] * 3);
    return 40;
  }
  function presetFromRoutine(r) {
    return r.items.map((x, i) => ({ id: r.id + i, n: x.name, sec: doseSec(x.dose), side: /je Seite|je Fuß/.test(x.dose), cue: x.cue + ' (' + x.dose + ')', tags: [] }));
  }

  // ---------- Calendar (.ics) ----------
  const pad = n => String(n).padStart(2, '0');
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n'); }
  function fold(line) { const out = []; let s = line; while (s.length > 73) { out.push(s.slice(0, 73)); s = ' ' + s.slice(73); } out.push(s); return out.join('\r\n'); }
  function stamp() { const d = new Date(); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'; }
  function ics(events) {
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Chris OS//Gesundheit//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    for (const ev of events) {
      L.push('BEGIN:VEVENT', 'UID:' + ev.uid + '@haltung.app', 'DTSTAMP:' + stamp());
      if (ev.allDay) { L.push('DTSTART;VALUE=DATE:' + ev.date.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + E.addDays(ev.date, 1).replace(/-/g, '')); }
      else {
        const [h, m] = (ev.time || '09:00').split(':').map(Number);
        const endMin = h * 60 + m + (ev.minutes || 30);
        const endDate = endMin >= 1440 ? E.addDays(ev.date, 1) : ev.date;
        const eh = Math.floor((endMin % 1440) / 60), em = endMin % 60;
        L.push('DTSTART:' + ev.date.replace(/-/g, '') + 'T' + pad(h) + pad(m) + '00', 'DTEND:' + endDate.replace(/-/g, '') + 'T' + pad(eh) + pad(em) + '00');
      }
      L.push('SUMMARY:' + icsEsc(ev.title));
      if (ev.desc) L.push('DESCRIPTION:' + icsEsc(ev.desc));
      if (ev.rrule) L.push('RRULE:' + ev.rrule);
      for (const a of (ev.alarms || ['PT0M'])) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc(ev.title), 'TRIGGER:' + (a.startsWith('-') || a.startsWith('P') ? a : a), 'END:VALARM');
      L.push('END:VEVENT');
    }
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  // ---------- Vorsorge ----------
  function vorsorgeDue(S, v, today) {
    const birthY = S.profile && S.profile.birth ? +S.profile.birth.slice(0, 4) : null;
    if (v.ageFrom && birthY) {
      const startY = birthY + v.ageFrom;
      if (+today.slice(0, 4) < startY) return { state: 'spaeter', year: startY };
    }
    if (!v.last && v.checked) {
      // Vaccination status confirmed at the check-up, exact date not entered: fine until the next check-up.
      const due = E.addDays(v.checked, 1095);
      return E.diffDays(today, due) < 0 ? { state: 'unknown' } : { state: 'ok', date: due, checked: true };
    }
    if (!v.last) return { state: 'unknown' };
    let due = E.addDays(v.last, v.every);
    if (v.season) {
      // Seasonal: due when the next season opens (e.g. flu shot from October), counted from the season of the last date.
      const y = +v.last.slice(0, 4) + (+v.last.slice(5, 7) >= 8 ? 1 : 0);
      due = y + '-' + v.season;
    }
    const diff = E.diffDays(today, due);
    return { state: diff < 0 ? 'faellig' : diff <= 60 ? 'bald' : 'ok', date: due, diff };
  }
  function firstMondayJan(year) { let d = year + '-01-02'; while (E.weekday(d) !== 1) d = E.addDays(d, 1); return d; }

  // ---------- Report ----------
  function inFach(key, fach) { return fach === 'alle' || symFach(key).includes(fach); }

  const api = { SYMPTOMS, QUICK, REGIONS, FACTORS, FACH, INT, BREATH, symById, regById, symLabel, symFach, hasData, infScore, infSyms, describe,
    episodes, OUTCOME, measureStats, onsetFactors, warning, LEVEL, breathFactors,
    HOME_SLOTS, HOME_FOCUS, homeCount, homePlan, STRETCHES, STRETCH_FOCUS, stretchPlan, presetFromRoutine, itemSec,
    ics, vorsorgeDue, firstMondayJan, inFach, doseSec, sleepDebt, bedtime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Health = api;
})(typeof window !== 'undefined' ? window : globalThis);
