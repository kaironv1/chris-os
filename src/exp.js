/* Self-experiments (2.9): keep one rule for some days, then compare with the days before. Pure logic, also runs in Node. */
(function (root) {
  'use strict';
  const E = root.Engine || (typeof require !== 'undefined' ? require('./engine.js') : null);
  const Hl = () => root.Health || (typeof require !== 'undefined' ? require('./health.js') : null);
  const Fd = () => root.Food || (typeof require !== 'undefined' ? require('./food.js') : null);

  // What can be compared: values from the check-in. better: 1 means higher is better. thr: the smallest difference
  // that counts (hours, scale points, share of days). sleep: entered the next morning for the night after a day.
  const M = {
    sleepH: { l: 'Schlaf', better: 1, thr: 0.25, kind: 'h', sleep: true, lo: 4, hi: 10 },
    sleepQ: { l: 'Schlafqualität', better: 1, thr: 0.3, kind: 'scale', sleep: true, lo: 1, hi: 5 },
    mood: { l: 'Befinden', better: 1, thr: 0.3, kind: 'scale', lo: 1, hi: 5 },
    energy: { l: 'Energie', better: 1, thr: 0.3, kind: 'scale', lo: 1, hi: 5 },
    stress: { l: 'Stress', better: -1, thr: 0.3, kind: 'scale', lo: 1, hi: 5 },
    breath: { l: 'Atem', better: -1, thr: 0.3, kind: 'breath', lo: 0, hi: 2 },
    sym: { l: 'Tage mit Beschwerden', s: 'Beschwerden', better: -1, thr: 0.15, kind: 'share', lo: 0, hi: 1 }
  };
  const BASE = ['sleepH', 'sleepQ', 'mood', 'energy', 'stress', 'breath', 'sym'];
  function measure(key) {
    if (M[key]) return Object.assign({ key }, M[key]);
    if (typeof key === 'string' && key.startsWith('sym:') && key.length > 4) {
      const s = '„' + Hl().symLabel(key.slice(4)) + '“';
      return { key, l: 'Tage mit ' + s, s, better: -1, thr: 0.15, kind: 'share', lo: 0, hi: 1, sym: key.slice(4) };
    }
    return null;
  }

  // ---------- Templates ----------
  // when: 'abend' (the effect shows from the next morning) or 'tag' (the same day). from: from which hour the
  // question about today makes sense (24: only the next morning). at: time in the rule; remind: reminder time.
  const pad = n => String(n).padStart(2, '0');
  const hm = (t, add) => { const p = String(t || '').split(':').map(Number); const x = (((p[0] || 0) * 60 + (p[1] || 0) + (add || 0)) % 1440 + 1440) % 1440; return pad(Math.floor(x / 60)) + ':' + pad(x % 60); };
  const bed = P => (P && P.bed) || '22:30';
  const wake = P => (P && P.wake) || '06:30';
  const hour = t => String(+String(t).slice(0, 2)) + (String(t).slice(3, 5) !== '00' ? ':' + String(t).slice(3, 5) : '');
  const TPL = [
    { id: 'bett', rule: P => 'Um ' + bed(P) + ' ins Bett', at: P => bed(P), when: 'abend', m: ['sleepH', 'sleepQ', 'energy', 'mood'],
      expect: 'Ich schlafe mehr und habe tagsüber mehr Energie.', ask: (w, at) => w + ' bis ' + at + ' Uhr im Bett?', from: 24,
      remind: at => ({ time: hm(at, -15), title: 'Experiment: in 15 Minuten ins Bett' }) },
    { id: 'kaffee', rule: () => 'Kein Kaffee nach 14 Uhr', at: () => '14:00', when: 'abend', m: ['sleepQ', 'sleepH', 'energy'],
      expect: 'Ich schlafe besser.', ask: (w, at) => w + ' ab ' + hour(at) + ' Uhr ohne Kaffee?', from: 20,
      remind: at => ({ time: hm(at, -15), title: 'Experiment: ab ' + hour(at) + ' Uhr kein Kaffee mehr' }) },
    { id: 'fruehstueck', rule: () => 'Morgens etwas essen', when: 'tag', m: ['breath', 'energy', 'mood'],
      expect: 'Mein Atem ist frischer und ich habe mehr Energie.', ask: w => w + ' morgens etwas gegessen?', from: 10,
      remind: (at, P) => ({ time: hm(wake(P), 30), title: 'Experiment: morgens etwas essen' }) },
    { id: 'wasser', rule: () => 'Jeden Tag 2 Liter trinken', when: 'tag', m: ['energy', 'breath', 'sym'],
      expect: 'Ich habe mehr Energie und weniger Beschwerden.', ask: w => w + ' 2 Liter getrunken?', from: 19,
      remind: () => ({ time: '12:00', title: 'Experiment: heute 2 Liter trinken' }) },
    { id: 'dehnen', rule: () => 'Abends 10 Minuten dehnen', when: 'abend', m: ['sleepQ', 'sym:verspannt', 'mood'],
      expect: 'Ich schlafe ruhiger und bin seltener verspannt.', ask: w => w + ' abends gedehnt?', from: 22,
      remind: () => ({ time: '21:00', title: 'Experiment: abends 10 Minuten dehnen' }) },
    { id: 'alkohol', rule: () => 'Kein Alkohol', when: 'abend', m: ['sleepQ', 'energy', 'mood'],
      expect: 'Ich schlafe besser und bin morgens fitter.', ask: w => w + ' ohne Alkohol?', from: 24,
      remind: () => ({ time: '18:00', title: 'Experiment: heute ohne Alkohol' }) },
    { id: 'eigen', rule: () => '', when: 'abend', m: ['sleepQ', 'mood', 'energy'], expect: '', ask: w => w + ' eingehalten?', from: 24,
      remind: () => ({ time: '20:00', title: 'Experiment' }) }
  ];
  const tplById = id => TPL.find(t => t.id === id) || TPL[TPL.length - 1];
  const DAYS = [7, 14, 21, 28];

  // A new experiment from the dialog: the rule may be edited. A changed time in a timed rule (bed time, coffee) is
  // taken over; other changed rules count as free rules without automatic checks.
  function create(d, P, today, id) {
    const T = tplById(d.tpl), rule = String(d.rule || '').trim().replace(/\s+/g, ' '), def = T.rule(P);
    const tm = /(\d{1,2})(?:[:.](\d{2}))?\s*Uhr|(\d{1,2})[:.](\d{2})/.exec(rule);
    const at = tm && +(tm[1] || tm[3]) < 24 ? pad(+(tm[1] || tm[3])) + ':' + (tm[2] || tm[4] || '00') : null;
    const shape = s => s.toLowerCase().replace(/\d{1,2}([:.]\d{2})?/g, '#').replace(/\s+/g, ' ').trim();
    const timed = !!T.at, free = T.id === 'eigen' || (rule !== def && !(timed && at && shape(rule) === shape(def)));
    const days = DAYS.includes(+d.days) ? +d.days : 14;
    const start = d.start === 'morgen' ? E.addDays(today, 1) : today;
    const measures = (d.measures || []).filter(k => measure(k)).slice(0, 5);
    return { id, tpl: T.id, rule: rule || def, at: timed && !free ? (at || T.at(P)) : null, free, when: d.when === 'tag' ? 'tag' : 'abend', measures: measures.length ? measures : T.m.slice(),
      expect: String(d.expect || '').trim(), days, start, end: E.addDays(start, days - 1), stopped: null, log: {}, verdict: null, created: Date.now() };
  }

  // ---------- Days ----------
  const lastDay = e => (e.stopped && e.stopped < e.end ? e.stopped : e.end);
  function status(e, today) {
    if (today < e.start) return 'geplant';
    if (e.stopped) return e.stopped >= e.end ? 'fertig' : 'abgebrochen';
    return today <= e.end ? 'laeuft' : 'fertig';
  }
  function ruleDays(e, today) {
    const z = lastDay(e) < today ? lastDay(e) : today, out = [];
    for (let d = e.start; d <= z; d = E.addDays(d, 1)) out.push(d);
    return out;
  }
  const dayNo = (e, d) => E.diffDays(e.start, d) + 1;
  const inRange = (e, d) => d >= e.start && d <= lastDay(e);
  const fromHour = e => (e.free ? (e.when === 'tag' ? 18 : 24) : tplById(e.tpl).from);
  function ask(e, w) {
    const T = e.free ? tplById('eigen') : tplById(e.tpl);
    return T.ask(w, e.at || '');
  }

  // Whether a day kept the rule, from data the app already has. Only clear cases count: a coffee after the time
  // breaks the rule, a breakfast in the log keeps it. Returns { v, why } or null.
  function auto(S, e, d) {
    if (e.free) return null;
    const L = (S.nutrition && S.nutrition.log && S.nutrition.log[d]) || [];
    const x = (S.health && S.health.days && S.health.days[d]) || {}, f = x.f || {};
    const fl = n => String(n.fl || '');
    if (e.tpl === 'kaffee') {
      const at = e.at || '14:00', late = L.filter(n => n.cups > 0 && n.time && n.time >= at).sort((a, b) => (a.time < b.time ? -1 : 1))[0];
      return late ? { v: false, why: 'Kaffee um ' + late.time + ' im Ernährungsprotokoll' } : null;
    }
    if (e.tpl === 'fruehstueck') {
      const fr = L.filter(n => n.slot === 'frueh' && !fl(n).includes('d') && (n.kcal == null || n.kcal >= 50)).sort((a, b) => ((a.time || '') < (b.time || '') ? -1 : 1))[0];
      return fr ? { v: true, why: 'Frühstück im Ernährungsprotokoll' + (fr.time ? ' um ' + fr.time : '') } : null;
    }
    if (e.tpl === 'wasser') {
      const w = f.wasser != null ? f.wasser : (Fd() ? Fd().factors(L).wasser : null);
      return w == null ? null : { v: w >= 2, why: (f.wasser != null ? 'Im Check-in ' : 'Im Ernährungsprotokoll ') + E.fmtNum(w, 1) + ' l getrunken' };
    }
    if (e.tpl === 'dehnen') {
      const r = ((S.training && S.training.routineLog) || []).some(r => r.date === d && r.kind === 'abend');
      return r ? { v: true, why: 'Abends gedehnt mit dem Timer' } : null;
    }
    if (e.tpl === 'alkohol') {
      if (f.alkohol) return { v: false, why: 'Alkohol im Check-in' };
      if (L.some(n => fl(n).includes('a'))) return { v: false, why: 'Alkohol im Ernährungsprotokoll' };
    }
    return null;
  }
  // Effective answer of a day: what Chris ticked wins over the automatic check
  function kept(S, e, d) {
    const m = e.log && e.log[d];
    if (m === true || m === false) return { v: m, manual: true };
    const a = auto(S, e, d);
    return a ? { v: a.v, why: a.why, auto: true } : null;
  }
  // The day to ask about in the check-in: yesterday while open, then today once the question makes sense
  function askDay(S, e, today, h) {
    if (e.stopped) return null;
    const y = E.addDays(today, -1);
    if (inRange(e, y) && !kept(S, e, y)) return y;
    if (inRange(e, today) && h >= fromHour(e) && !kept(S, e, today)) return today;
    return null;
  }

  // ---------- Comparison ----------
  const MIN = 4;
  function stat(v) {
    const n = v.length;
    if (!n) return { n: 0, mean: null, sd: 0, sum: 0 };
    const sum = v.reduce((s, x) => s + x, 0), mean = sum / n;
    return { n, mean, sum, sd: n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) * (x - mean), 0) / (n - 1)) : 0 };
  }
  function pooled(a, b) { const df = a.n + b.n - 2; return df > 0 ? Math.sqrt(((a.n - 1) * a.sd * a.sd + (b.n - 1) * b.sd * b.sd) / df) : 0; }
  // Sleep is entered the next morning, so it always belongs to the night after the day; after an evening rule the
  // other values count from the next day, too
  const lagOf = (e, key) => ((M[key] && M[key].sleep) || e.when === 'abend' ? 1 : 0);
  function value(S, key, o) {
    const x = (S.health.days || {})[o];
    if (!Hl().hasData(x)) return null;
    const m = measure(key);
    if (!m) return null;
    if (m.kind === 'share') { const on = Object.keys(x.sym || {}).filter(k => x.sym[k]); return m.sym ? (on.includes(m.sym) ? 1 : 0) : (on.length ? 1 : 0); }
    return x[key] == null ? null : x[key];
  }
  // The same number of days before the start, without days of another experiment
  function beforeDays(S, e, today) {
    const busy = new Set();
    (S.health.exps || []).forEach(o => { if (o.id !== e.id && o.start < e.start) ruleDays(o, today).forEach(d => busy.add(d)); });
    const out = [];
    for (let i = e.days; i >= 1; i--) { const d = E.addDays(e.start, -i); if (!busy.has(d)) out.push(d); }
    return out;
  }
  function evaluate(S, e, today) {
    const days = ruleDays(e, today);
    const K = days.map(d => [d, kept(S, e, d)]);
    const yes = K.filter(([, k]) => k && k.v).map(([d]) => d), no = K.filter(([, k]) => k && k.v === false).map(([d]) => d);
    const before = beforeDays(S, e, today);
    const res = (e.measures || []).map(key => {
      const m = measure(key);
      if (!m) return null;
      const lag = lagOf(e, key);
      const vals = ds => ds.map(d => E.addDays(d, lag)).filter(o => o <= today).map(o => value(S, key, o)).filter(v => v != null);
      const g = { before: stat(vals(before)), kept: stat(vals(yes)), not: stat(vals(no)) };
      const ref = g.before.n >= MIN ? 'before' : g.not.n >= 3 ? 'not' : null;
      let diff = null, verdict = 'wenig';
      if (ref && g.kept.n >= MIN) {
        const r = g[ref], sd = pooled(g.kept, r);
        diff = g.kept.mean - r.mean;
        const big = Math.abs(diff) >= m.thr - 1e-9 && (sd < 1e-9 || Math.abs(diff) / sd >= 0.5);
        verdict = !big ? 'gleich' : diff * m.better > 0 ? 'besser' : 'schlechter';
      }
      return { key, m, lag, g, ref, diff, verdict };
    }).filter(Boolean);
    return { state: status(e, today), days: days.length, total: e.days, yes: yes.length, no: no.length, open: days.length - yes.length - no.length,
      before: before.length, beforeFull: before.length === e.days, yesDays: yes, noDays: no, res, ready: yes.length >= MIN };
  }

  // ---------- Words ----------
  const VERDICT = { besser: 'besser', schlechter: 'schlechter', gleich: 'kein klarer Unterschied', wenig: 'zu wenige Einträge' };
  const breathWord = v => (v < 0.5 ? 'frisch' : v < 1.3 ? 'mittel' : 'schlecht');
  function fmt(m, s) {
    if (!s || !s.n) return '–';
    if (m.kind === 'h') return E.fmtNum(s.mean, 1) + ' h';
    if (m.kind === 'scale') return E.fmtNum(s.mean, 1);
    if (m.kind === 'breath') return breathWord(s.mean);
    return 'an ' + s.sum + ' von ' + s.n + (s.n === 1 ? ' Tag' : ' Tagen');
  }
  function fmtDay(m, v) {
    if (v == null) return 'kein Eintrag';
    if (m.kind === 'h') return E.fmtNum(v, 1) + ' h';
    if (m.kind === 'scale') return v + ' von 5';
    if (m.kind === 'breath') return ['frisch', 'geht so', 'schlecht'][v] || '';
    return v ? 'ja' : 'nein';
  }
  // Label with the day the value belongs to: after an evening rule the next day counts
  function label(e, m) {
    if (m.sleep || !lagOf(e, m.key)) return m.l;
    return (m.kind === 'share' ? m.s : m.l) + ' am Tag danach';
  }
  function verdictLine(R) {
    const by = v => R.res.filter(r => r.verdict === v).map(r => r.m.l);
    const out = [];
    if (by('besser').length) out.push('Besser: ' + by('besser').join(', '));
    if (by('schlechter').length) out.push('Schlechter: ' + by('schlechter').join(', '));
    if (by('gleich').length) out.push('Kein klarer Unterschied: ' + by('gleich').join(', '));
    if (by('wenig').length) out.push('Zu wenige Einträge: ' + by('wenig').join(', '));
    return out.length ? out.join('. ') + '.' : '';
  }
  function remind(e, P) {
    const T = e.free ? tplById('eigen') : tplById(e.tpl), r = T.remind(e.at, P);
    if (e.free) return { time: e.when === 'tag' ? '09:00' : '20:00', title: 'Experiment: ' + e.rule };
    return r;
  }

  // ---------- Line in the weekly review (2.10, K51) ----------
  // The experiment that ran in the week ws..we: how many of its days in that week kept the rule, and the interim
  // comparison for up to two values (kept days against the days before). A planned one is not shown.
  const pl = (n, s, p) => n + ' ' + (n === 1 ? s : p);
  function week(S, ws, we, today) {
    const L = (S.health.exps || []).filter(e => e.start <= we && lastDay(e) >= ws && status(e, today) !== 'geplant');
    const cand = L.map(e => ({ e, days: ruleDays(e, today).filter(d => d >= ws && d <= we) })).filter(c => c.days.length)
      .sort((a, b) => b.days.length - a.days.length || (a.e.start < b.e.start ? 1 : -1));
    if (!cand.length) return null;
    const { e, days } = cand[0];
    const K = days.map(d => kept(S, e, d));
    const R = evaluate(S, e, today);
    const rank = r => (r.verdict === 'besser' || r.verdict === 'schlechter' ? 0 : r.verdict === 'gleich' ? 1 : 2);
    const cmp = R.res.filter(r => r.ref && r.g.kept.n >= MIN).sort((a, b) => rank(a) - rank(b)).slice(0, 2)
      .map(r => ({ key: r.key, l: r.m.l, kept: fmt(r.m, r.g.kept), ref: fmt(r.m, r.g[r.ref]), verdict: r.verdict }));
    return { e, state: R.state, days: days.length, yes: K.filter(k => k && k.v).length, open: K.filter(k => !k).length, cmp, R };
  }
  function weekText(W) {
    if (!W) return '';
    const { e, R } = W;
    if (W.state !== 'laeuft') {
      const all = R.days === W.days ? 'an ' + R.yes + ' von ' + pl(R.days, 'Tag', 'Tagen') + ' eingehalten' : 'in dieser Woche an ' + W.yes + ' von ' + pl(W.days, 'Tag', 'Tagen') + ' eingehalten, insgesamt an ' + R.yes + ' von ' + R.days;
      return e.rule + ' ist ' + (W.state === 'fertig' ? 'abgeschlossen' : 'beendet') + ': ' + all + '. ' + (R.ready ? verdictLine(R) : 'Für einen Vergleich waren es zu wenige Tage mit Regel.');
    }
    let t = e.rule + ': an ' + W.yes + ' von ' + pl(W.days, 'Tag', 'Tagen') + ' eingehalten' + (W.open ? ', ' + pl(W.open, 'Tag', 'Tage') + ' noch offen' : '');
    if (W.cmp.length) t += '; ' + W.cmp.map((c, i) => c.l + (i ? ' ' : ' bisher ') + c.kept + ' statt ' + c.ref).join(', ') + '.';
    else t += R.yes < MIN ? '; der Vergleich kommt ab ' + MIN + ' Tagen mit Regel.' : '; zum Vergleich fehlen noch Einträge im Check-in.';
    return t;
  }
  const weekSum = W => (W ? 'Experiment an ' + W.yes + ' von ' + pl(W.days, 'Tag', 'Tagen') : '');

  // ---------- Suggestions from the own data ----------
  // One line per template, only where the data gives a reason: sleep against the goal, late coffee, the breath hunch
  function hints(S, today) {
    const P = (S.health && S.health.profile) || {}, D = (S.health && S.health.days) || {};
    const past = n => Array.from({ length: n }, (_, i) => E.addDays(today, -i - 1));
    const d14 = past(14), d30 = past(30), out = {};
    const L = d => (S.nutrition && S.nutrition.log && S.nutrition.log[d]) || [];
    const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
    const sl = d14.map(d => D[d] && D[d].sleepH).filter(v => v != null), goal = P.sleepGoal || 7.5, b = [];
    if ((P.triggers || []).includes('schlaf')) b.push('Schlafmangel ist dein häufigster Auslöser');
    if (sl.length >= 5 && mean(sl) < goal - 0.25) b.push((b.length ? 'zuletzt ' : 'Zuletzt ') + E.fmtNum(mean(sl), 1) + ' h statt ' + E.fmtNum(goal, 1) + ' h Schlaf');
    if (b.length) out.bett = b.join(', ') + '.';
    const late = d30.filter(d => L(d).some(n => n.cups > 0 && n.time && n.time >= '14:00')).length;
    if (late >= 3) out.kaffee = 'Kaffee nach 14 Uhr an ' + late + ' der letzten 30 Tage.';
    if (P.breathHint === 'hunger') out.fruehstueck = 'Passt zu deinem Verdacht: Mundgeruch bei Hunger.';
    const w = d14.map(d => D[d] && D[d].f && D[d].f.wasser).filter(v => v != null);
    if (w.length >= 5 && mean(w) < 2) out.wasser = 'Im Schnitt ' + E.fmtNum(mean(w), 1) + ' l am Tag laut Check-in.';
    const sym = k => d30.filter(d => D[d] && D[d].sym && D[d].sym[k]).length, vs = sym('verspannt'), rl = sym('beine_unruhig');
    const dh = [vs >= 3 ? 'Verspannt an ' + vs : '', rl >= 3 ? (vs >= 3 ? 'unruhige Beine an ' : 'Unruhige Beine an ') + rl : ''].filter(Boolean);
    if (dh.length) out.dehnen = dh.join(', ') + ' der letzten 30 Tage.';
    const al = d30.filter(d => (D[d] && D[d].f && D[d].f.alkohol) || L(d).some(n => String(n.fl || '').includes('a'))).length;
    if (al >= 3) out.alkohol = 'Alkohol an ' + al + ' der letzten 30 Tage.';
    return out;
  }

  const api = { M, BASE, MIN, TPL, DAYS, tplById, measure, create, lastDay, status, ruleDays, dayNo, inRange, fromHour, ask, auto, kept, askDay,
    lagOf, value, beforeDays, evaluate, VERDICT, fmt, fmtDay, label, verdictLine, remind, hints, hm, week, weekText, weekSum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Exp = api;
})(typeof window !== 'undefined' ? window : globalThis);
