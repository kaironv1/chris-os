  // ---------- Verläufe (Gesundheit) – inserted into app.js at build time ----------
  const TR_RANGES = [['30', '30 Tage'], ['90', '3 Monate'], ['365', '12 Monate']];
  const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const pl2 = (n, a, b) => n + ' ' + (n === 1 ? a : b);
  const dayTip = d => E.WD[E.weekday(d)] + ', ' + E.fmtShort(d);

  // Columns of a time range: days up to 3 months, weeks beyond
  function trCols(from, to) {
    const days = H.datesFrom(from, to);
    if (days.length <= 100) {
      const monthly = days.length > 35;
      return days.map((d, i) => ({ days: [d], tip: dayTip(d), label: monthly ? (d.slice(8) === '01' || i === 0 && +d.slice(8) <= 3 ? E.MON[+d.slice(5, 7) - 1].slice(0, 3) : '') : (E.weekday(d) === 1 ? E.fmtShort(d) : '') }));
    }
    const out = [];
    for (let w = E.weekStart(from); w <= to; w = E.addDays(w, 7)) {
      const ds = days.filter(d => d >= w && d <= E.addDays(w, 6));
      const first = ds.find(d => +d.slice(8) <= 7 && E.weekday(d) === 1) || (+w.slice(8) <= 7 ? w : null);
      out.push({ days: ds, tip: 'KW ' + E.isoWeek(w) + ' (' + E.fmtShort(ds[0]) + ' bis ' + E.fmtShort(ds[ds.length - 1]) + ')', label: first ? E.MON[+first.slice(5, 7) - 1].slice(0, 3) : '' });
    }
    return out;
  }

  // ---------- Matrix: complaints by day or week ----------
  function matrixChart(id, rows, cols, opt) {
    CHARTS[id] = { type: 'matrix', rows, cols, opt };
    return `<div class="chart mx" data-chart="matrix" data-id="${id}" role="img" aria-label="${esc(opt.label)}"><div class="tip" style="display:none"></div></div>`;
  }
  SVGR.matrix = (c, W) => {
    const { rows, cols, opt } = c, n = cols.length, small = W < 520;
    const L = opt.noLabels ? 0 : small ? 104 : 156, R = 2, T = 2, rh = small ? 19 : 21, B = 20;
    const cw = (W - L - R) / n, gap = cw >= 7 ? 2 : cw >= 3.5 ? 1 : 0, H0 = T + rows.length * rh;
    let g = '';
    rows.forEach((r, ri) => {
      const y = T + ri * rh;
      if (!opt.noLabels) g += `<text class="mx-l" x="0" y="${y + rh / 2 + 4}">${esc(trunc(r.label, small ? 14 : 22))}</text>`;
      r.cells.forEach((v, ci) => {
        if (v == null) return;
        const x = L + ci * cw, w = Math.max(0.8, cw - gap);
        g += `<rect class="mx-c v${v}" x="${(x + gap / 2).toFixed(2)}" y="${y + 1}" width="${w.toFixed(2)}" height="${rh - 3}" rx="${Math.min(3, w / 2).toFixed(1)}"/>`;
      });
    });
    let last = -99;
    cols.forEach((col, ci) => { const x = L + (ci + 0.5) * cw; if (col.label && x - last > 34) { g += `<text class="axis" x="${x.toFixed(1)}" y="${H0 + 15}" text-anchor="middle">${esc(col.label)}</text>`; last = x; } });
    c.geo = { L, T, cw, rh, n, H0 };
    return `<svg viewBox="0 0 ${W} ${H0 + B}" width="${W}" height="${H0 + B}" aria-hidden="true">${g}<rect class="mx-cur" x="0" y="0" width="0" height="0" rx="3" style="display:none"/></svg>`;
  };
  // Nearest cell under the pointer, so even thin columns are easy to hit
  HOVER.matrix = (el, tip) => {
    const move = ev => {
      const c = CHARTS[el.dataset.id], G = c && c.geo; if (!G) return;
      const r = el.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
      const ci = Math.floor((x - G.L) / G.cw), ri = Math.floor((y - G.T) / G.rh), cur = el.querySelector('.mx-cur');
      if (ci < 0 || ci >= G.n || ri < 0 || ri >= c.rows.length) { tip.style.display = 'none'; if (cur) cur.style.display = 'none'; return; }
      const row = c.rows[ri];
      if (cur) { cur.setAttribute('x', G.L + ci * G.cw - 0.5); cur.setAttribute('y', G.T + ri * G.rh); cur.setAttribute('width', Math.max(3, G.cw + 1)); cur.setAttribute('height', G.rh - 1); cur.style.display = ''; }
      placeTip(el, tip, G.L + (ci + 0.5) * G.cw, G.T + ri * G.rh, [c.cols[ci].tip, row.tips[ci]]);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerdown', move);
    el.addEventListener('pointerleave', () => { tip.style.display = 'none'; const cur = el.querySelector('.mx-cur'); if (cur) cur.style.display = 'none'; });
  };
  function symRow(key, label, cols) {
    const D = S.health.days;
    const cells = [], tips = [];
    cols.forEach(col => {
      const logged = col.days.filter(d => H.hasData(D[d])), on = logged.filter(d => D[d].sym && D[d].sym[key]);
      const v = on.reduce((m, d) => Math.max(m, Math.min(3, D[d].sym[key])), 0);
      cells.push(logged.length ? v : null);
      tips.push(!logged.length ? 'kein Eintrag' : col.days.length === 1 ? (v ? label + ' ' + H.INT[v] : 'ohne ' + label) : (on.length ? label + ' an ' + pl2(on.length, 'Tag', 'Tagen') + ', am stärksten ' + H.INT[v] : 'ohne ' + label + ', ' + pl2(logged.length, 'Tag', 'Tage') + ' erfasst'));
    });
    return { label, cells, tips };
  }

  // ---------- Small multiples on one time axis ----------
  function stackChart(id, cols, panels, opt) {
    CHARTS[id] = { type: 'stack', cols, panels, opt };
    const head = ['Zeitraum', ...panels.map(p => p.label)];
    const rows = cols.map((col, i) => [col.tip, ...panels.map(p => p.vals[i] == null ? '' : p.fmt(p.vals[i]))]).filter(r => r.slice(1).some(Boolean));
    return `<div class="chart st" data-chart="stack" data-id="${id}" tabindex="0" role="img" aria-label="${esc(opt.label)}. Mit den Pfeiltasten durch die Tage gehen."><div class="tip" style="display:none"></div></div>` + tableHtml(head, rows.reverse());
  }
  SVGR.stack = (c, W) => {
    const { cols, panels, opt } = c, n = cols.length, L = 34, R = 6, LH = 22, GP = 14, B = 20;
    const slot = (W - L - R) / n, X = i => L + (i + 0.5) * slot;
    let y = 0, g = '';
    panels.forEach(pn => {
      const top = y + LH, h = pn.h || 64, bot = top + h, lo = pn.min, hi = pn.max;
      const Y = v => bot - (Math.max(lo, Math.min(hi, v)) - lo) / ((hi - lo) || 1) * h;
      g += `<text class="st-l" x="0" y="${y + 12}">${esc(pn.label)}</text>${pn.note ? `<text class="st-n" x="${W - R}" y="${y + 12}" text-anchor="end">${esc(pn.note)}</text>` : ''}`;
      g += `<line class="gridline" x1="${L}" x2="${W - R}" y1="${Y(hi)}" y2="${Y(hi)}"/><text class="axis" x="${L - 6}" y="${Y(hi) + 4}" text-anchor="end">${esc(pn.fmt(hi, true))}</text>`;
      g += `<line class="baseline" x1="${L}" x2="${W - R}" y1="${bot}" y2="${bot}"/><text class="axis" x="${L - 6}" y="${bot + 4}" text-anchor="end">${esc(pn.fmt(lo, true))}</text>`;
      if (pn.goal != null) g += `<line class="goal" x1="${L}" x2="${W - R}" y1="${Y(pn.goal)}" y2="${Y(pn.goal)}"/>`;
      if (pn.kind === 'bar') {
        const bw = Math.max(1, Math.min(12, slot - (slot >= 5 ? 2 : 0.6)));
        pn.vals.forEach((v, i) => { if (v == null || v <= lo) return; const yy = Y(v), hh = bot - yy, r = Math.min(3, bw / 2, hh); g += `<path d="M${(X(i) - bw / 2).toFixed(2)} ${bot} V${(yy + r).toFixed(2)} Q${(X(i) - bw / 2).toFixed(2)} ${yy.toFixed(2)} ${(X(i) - bw / 2 + r).toFixed(2)} ${yy.toFixed(2)} H${(X(i) + bw / 2 - r).toFixed(2)} Q${(X(i) + bw / 2).toFixed(2)} ${yy.toFixed(2)} ${(X(i) + bw / 2).toFixed(2)} ${(yy + r).toFixed(2)} V${bot} Z" fill="${pn.color}"/>`; });
      } else if (pn.kind === 'range') {
        // Floating bar from the lowest to the highest value (temperature of a day)
        const bw = Math.max(1.5, Math.min(10, slot - (slot >= 5 ? 2 : 0.6)));
        pn.vals.forEach((v, i) => { if (!v) return; const y1 = Y(v[1]), hh = Math.max(2, Y(v[0]) - y1), r = Math.min(3, bw / 2, hh / 2); g += `<rect x="${(X(i) - bw / 2).toFixed(2)}" y="${y1.toFixed(2)}" width="${bw.toFixed(2)}" height="${hh.toFixed(2)}" rx="${r.toFixed(1)}" fill="${pn.color}"/>`; });
      } else if (pn.kind === 'area') {
        let seg = [];
        const flush = () => {
          if (!seg.length) return;
          if (seg.length === 1) { const i = seg[0]; g += `<circle cx="${X(i)}" cy="${Y(pn.vals[i])}" r="2.5" fill="${pn.stroke}"/>`; }
          else {
            const d = seg.map((i, k) => (k ? 'L' : 'M') + X(i).toFixed(2) + ' ' + Y(pn.vals[i]).toFixed(2)).join(' ');
            g += `<path d="${d} L${X(seg[seg.length - 1]).toFixed(2)} ${bot} L${X(seg[0]).toFixed(2)} ${bot} Z" fill="${pn.color}" opacity=".45"/><path d="${d}" fill="none" stroke="${pn.stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
          }
          seg = [];
        };
        pn.vals.forEach((v, i) => { if (v == null) flush(); else seg.push(i); }); flush();
      } else {
        pn.vals.forEach((v, i) => { if (v != null) g += `<circle cx="${X(i).toFixed(2)}" cy="${Y(v).toFixed(2)}" r="${n > 60 ? 1.8 : 2.6}" fill="${pn.color}" opacity=".45"/>`; });
        let d = '', on = false;
        (pn.mean || []).forEach((v, i) => { if (v == null) { on = false; return; } d += (on ? 'L' : 'M') + X(i).toFixed(2) + ' ' + Y(v).toFixed(2) + ' '; on = true; });
        if (d) g += `<path d="${d}" fill="none" stroke="${pn.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      y = bot + GP;
    });
    const H0 = y - GP;
    let bands = '';
    (opt.bands || []).forEach(b => { const x0 = X(b.i0) - slot / 2, x1 = X(b.i1) + slot / 2; bands += `<rect class="st-band" x="${x0.toFixed(1)}" y="${LH - 4}" width="${Math.max(2, x1 - x0).toFixed(1)}" height="${(H0 - LH + 4).toFixed(1)}" rx="3"/>`; });
    let last = -99, ax = '';
    cols.forEach((col, i) => { if (col.label && X(i) - last > 34) { ax += `<text class="axis" x="${X(i).toFixed(1)}" y="${H0 + 15}" text-anchor="middle">${esc(col.label)}</text>`; last = X(i); } });
    c.pos = cols.map((col, i) => ({ x: X(i), y: LH, t: [col.tip].concat(panels.map(pn => pn.label + ': ' + (pn.tips ? pn.tips[i] : (pn.vals[i] == null ? 'kein Eintrag' : pn.fmt(pn.vals[i]))))) }));
    return `<svg viewBox="0 0 ${W} ${H0 + B}" width="${W}" height="${H0 + B}" aria-hidden="true">${bands}${g}${ax}<line class="xhair" x1="0" x2="0" y1="${LH - 4}" y2="${H0}" style="display:none"/></svg>`;
  };
  // Mean over the columns of a range (days or weeks); roll: moving mean over the last k columns
  function colVals(cols, fn, agg) {
    const D = S.health.days;
    return cols.map(col => {
      const v = col.days.map(d => (H.hasData(D[d]) ? fn(D[d], d) : null)).filter(x => x != null);
      if (!v.length) return null;
      return agg === 'max' ? Math.max(...v) : v.reduce((s, x) => s + x, 0) / v.length;
    });
  }
  function roll(vals, k) { return vals.map((_, i) => { const w = vals.slice(Math.max(0, i - k + 1), i + 1).filter(x => x != null); return w.length >= Math.min(3, k) ? w.reduce((s, x) => s + x, 0) / w.length : null; }); }

  // ---------- Body heat map ----------
  SVGR.body = c => c.svg;
  function bodyHeat(id, regions) {
    const max = Math.max(1, ...regions.map(r => r.n)), cnt = Object.fromEntries(regions.map(r => [r.id, r.n]));
    const bin = k => !k ? 0 : k >= max * 0.67 ? 3 : k >= max * 0.34 ? 2 : 1;
    const fig = (side, dx) => `<g transform="translate(${dx} 0)"><g class="bm-base">${BM[side].base}</g>${Object.entries(BM[side].parts).map(([rid, shape]) => { const k = cnt[rid] || 0, r = H.regById(rid); return `<g class="bh b${bin(k)}" data-tip="${esc(r.l + ': ' + (k ? pl2(k, 'Tag', 'Tage') : 'keine Schmerzen eingetragen'))}">${shape}</g>`; }).join('')}<text class="axis" x="60" y="236" text-anchor="middle">${side === 'v' ? 'Vorne' : 'Hinten'}</text></g>`;
    CHARTS[id] = { type: 'body', svg: `<svg viewBox="0 0 270 242" class="bh-svg" aria-hidden="true">${fig('v', 0)}${fig('h', 150)}</svg>` };
    return `<div class="chart bh-wrap" data-chart="body" data-id="${id}" role="img" aria-label="Schmerzstellen nach Häufigkeit: ${esc(regions.map(r => H.regById(r.id).l + ' ' + r.n).join(', ') || 'keine')}"><div class="tip" style="display:none"></div></div>`;
  }

  // ---------- View ----------
  const fmtH = (v, ax) => n0(v, ax ? 0 : 1) + ' h';
  const fmtS = v => n0(v, 1);
  function viewTrends() {
    const t = E.today(), R = ui.trRange || '30', from = E.addDays(t, -(+R) + 1);
    const T = H.trend(S, from, t), D = S.health.days;
    const filters = `<div class="row wrap" style="gap:10px;margin-bottom:18px">${seg('Zeitraum', TR_RANGES, R, { a: 'tr.range' })}<span class="small muted">${pl2(T.logged.length, 'Tag', 'Tage')} erfasst</span></div>`;
    if (T.logged.length < 3) return `${filters}<div class="empty">Für Verläufe braucht es ein paar Check-ins. Trag ein paar Tage lang kurz ein, wie es dir geht; nach einer Woche siehst du hier erste Verläufe, nach einem Monat deine Muster. <a href="#/gesundheit">Zum Check-in</a></div>`;
    const cols = trCols(from, t), daily = cols[0].days.length === 1, unitW = daily ? 'Tag' : 'Woche';
    const goal = (S.health.profile || {}).sleepGoal || 7.5;
    // Tiles
    const epLen = T.eps.length ? Math.round(T.eps.reduce((s, e) => s + e.length, 0) / T.eps.length * 10) / 10 : 0;
    const tiles = `<div class="stats tr-stats">
      <div class="stat"><div class="stat-val">${T.symDays} <span class="stat-of">von ${T.logged.length}</span></div><div class="stat-label">Tage mit Beschwerden</div></div>
      <div class="stat"><div class="stat-val">${T.eps.length}</div><div class="stat-label">${T.eps.length ? (T.eps.length === 1 ? 'Infekt' : 'Infekte') + ', im Schnitt ' + n0(epLen) + ' Tage' : 'Infekte im Zeitraum'}</div></div>
      <div class="stat"><div class="stat-val">${T.freeNow}</div><div class="stat-label">${T.freeNow === 1 ? 'Tag' : 'Tage'} ohne Beschwerden am Stück, längste Phase ${pl2(T.longest, 'Tag', 'Tage')}</div></div>
      <div class="stat"><div class="stat-val">${T.avg.sleepH != null ? n0(T.avg.sleepH) + ' h' : '–'}</div><div class="stat-label">Schlaf im Schnitt, dein Ziel ${n0(goal)} h</div></div></div>`;
    // Matrix of the most frequent complaints
    const top = T.top.slice(0, 8);
    const rows = top.map(c => symRow(c.key, c.label, cols));
    const mx = top.length ? `<div class="panel" style="margin-top:22px"><div class="sec-head"><h2 class="sec-title">Beschwerden im Verlauf</h2><span class="sec-meta">je ${unitW}, die häufigsten ${top.length}</span></div>
        ${matrixChart('trmx', rows, cols, { label: 'Beschwerden je ' + unitW + ': ' + top.map(c => c.label + ' ' + c.n + ' Tage').join(', ') })}
        <div class="legend" style="flex-wrap:wrap"><span><span class="sw" style="background:var(--h1)"></span>leicht</span><span><span class="sw" style="background:var(--h2)"></span>mittel</span><span><span class="sw" style="background:var(--h3)"></span>stark</span><span><span class="sw" style="background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--line-strong)"></span>ohne</span><span class="muted">leer: kein Eintrag</span></div>
        ${tableHtml(['Beschwerde', 'Tage', 'leicht', 'mittel', 'stark', 'zuletzt'], top.map(c => [c.label, String(c.n), String(c.lv[1]), String(c.lv[2]), String(c.lv[3]), E.fmtShort(c.last)]))}</div>`
      : `<div class="panel" style="margin-top:22px"><h2 class="sec-title">Beschwerden im Verlauf</h2><p class="small ink2" style="margin-top:6px">In diesem Zeitraum hast du keine Beschwerden eingetragen. Schön.</p></div>`;
    // Sleep and infection signs on one time axis, infections as bands
    const sleepV = colVals(cols, x => x.sleepH);
    const infV = colVals(cols, x => H.infScore(x), 'max');
    const infTips = cols.map(col => { const ds = col.days.filter(d => H.hasData(D[d])); if (!ds.length) return 'kein Eintrag'; const sick = ds.filter(d => H.infScore(D[d]) > 0); return !sick.length ? 'keine' : col.days.length === 1 ? H.describe(D[sick[0]], H.infSyms(D[sick[0]])) : 'an ' + pl2(sick.length, 'Tag', 'Tagen'); });
    const bands = T.eps.map(e => ({ i0: Math.max(0, cols.findIndex(c => c.days.includes(e.start) || c.days[0] > e.start)), i1: (() => { let k = -1; cols.forEach((c, i) => { if (c.days[0] <= e.end) k = i; }); return k; })(), e })).filter(b => b.i0 >= 0 && b.i1 >= b.i0);
    const sb = T.sleepBefore;
    const sleepNote = sb.n >= 2 && sb.before != null && sb.other != null ? (sb.before < sb.other - 0.3 ? `Vor ${sb.n === T.eps.length ? 'deinen' : sb.n + ' deiner'} Infekten hast du im Schnitt ${n0(sb.before)} h geschlafen, sonst ${n0(sb.other)} h. Das passt zu deinem Auslöser Schlafmangel.` : `Vor deinen Infekten hast du im Schnitt ${n0(sb.before)} h geschlafen, sonst ${n0(sb.other)} h. Ein klarer Unterschied zeigt sich bisher nicht.`) : 'Sobald zwei Infekte mit Schlafangaben davor erfasst sind, vergleicht die App den Schlaf vor einem Infekt mit normalen Tagen.';
    const maxInf = Math.max(4, ...infV.filter(v => v != null));
    const stack = `<div class="panel"><div class="sec-head"><h2 class="sec-title">Schlaf und Infekt-Anzeichen</h2><span class="sec-meta">je ${unitW}</span></div>
      ${stackChart('trst', cols, [
        { label: 'Schlaf', kind: 'bar', vals: sleepV, min: 4, max: 10, goal, color: 'var(--c1)', fmt: fmtH, h: 70, note: 'Linie: Ziel ' + n0(goal) + ' h' },
        { label: 'Infekt-Anzeichen', kind: 'area', vals: infV, min: 0, max: maxInf, color: 'var(--h2)', stroke: 'var(--h3)', fmt: (v, ax) => ax ? (v ? 'stark' : '0') : n0(v), tips: infTips, h: 52 }
      ], { label: 'Schlaf und Infekt-Anzeichen je ' + unitW, bands })}
      ${bands.length ? `<div class="legend"><span><span class="sw st-band-sw"></span>Infekt-Episode</span></div>` : ''}
      <p class="small ink2" style="margin-top:8px">${esc(sleepNote)}</p></div>`;
    // Ranked complaints
    const maxN = Math.max(1, ...T.top.map(c => c.n));
    const rank = `<div class="panel"><div class="sec-head"><h2 class="sec-title">Häufigste Beschwerden</h2><span class="sec-meta">Tage im Zeitraum</span></div>
      ${T.top.length ? `<ul class="rank">${T.top.slice(0, 10).map(c => `<li><span class="rk-l">${esc(c.label)}</span><span class="rk-b" title="leicht ${c.lv[1]}, mittel ${c.lv[2]}, stark ${c.lv[3]}">${[1, 2, 3].map(v => c.lv[v] ? `<i class="v${v}" style="width:${(c.lv[v] / maxN * 100).toFixed(1)}%"></i>` : '').join('')}</span><span class="rk-n num">${c.n}</span></li>`).join('')}</ul>
        <div class="legend"><span><span class="sw" style="background:var(--h1)"></span>leicht</span><span><span class="sw" style="background:var(--h2)"></span>mittel</span><span><span class="sw" style="background:var(--h3)"></span>stark</span></div>` : '<p class="small ink2">Keine Beschwerden im Zeitraum.</p>'}</div>`;
    // Body map and weekdays
    const regs = T.regions;
    const body = `<div class="panel"><div class="sec-head"><h2 class="sec-title">Wo es weh tut</h2><span class="sec-meta">aus der Körperkarte</span></div>
      ${regs.length ? bodyHeat('trbody', regs) + `<div class="legend" style="justify-content:center"><span><span class="sw" style="background:var(--h1)"></span>selten</span><span><span class="sw" style="background:var(--h2)"></span>öfter</span><span><span class="sw" style="background:var(--h3)"></span>am häufigsten</span></div>
        <p class="small ink2" style="margin-top:8px">${esc(regs.slice(0, 3).map(r => H.regById(r.id).l + ' an ' + pl2(r.n, 'Tag', 'Tagen')).join(', '))}.</p>` : '<p class="small ink2">Keine Schmerzstellen eingetragen. Tippe beim Check-in auf die Körperkarte, wenn etwas weh tut oder verspannt ist; dann siehst du hier, wo es sich häuft.</p>'}</div>`;
    const wdOk = T.wd.filter(x => x.n >= 2);
    const wMax = wdOk.length ? wdOk.reduce((a, b) => (b.sym / b.n > a.sym / a.n ? b : a)) : null;
    const wSl = wdOk.filter(x => x.sleep != null);
    const wMin = wSl.length ? wSl.reduce((a, b) => (b.sleep < a.sleep ? b : a)) : null;
    const wdNote = [wMax && wMax.sym ? 'Am häufigsten Beschwerden: ' + E.WD_LONG[wMax.w] + ' (' + Math.round(wMax.sym / wMax.n * 100) + ' %)' : '', wMin && wSl.length >= 3 ? 'am wenigsten Schlaf: ' + E.WD_LONG[wMin.w] + ' (' + n0(wMin.sleep) + ' h)' : ''].filter(Boolean).join(', ');
    const week = `<div class="panel"><div class="sec-head"><h2 class="sec-title">Nach Wochentag</h2><span class="sec-meta">Anteil der Tage mit Beschwerden</span></div>
      <div class="wdg">${T.wd.map(x => { const p = x.n ? Math.round(x.sym / x.n * 100) : 0; const wt = (S.settings.week || {})[x.w]; return `<div class="wdc" title="${esc(E.WD_LONG[x.w] + ': ' + (x.n ? x.sym + ' von ' + x.n + ' Tagen mit Beschwerden' : 'kein Eintrag') + (x.sleep != null ? ', Schlaf ' + n0(x.sleep) + ' h' : ''))}"><span class="wdv num">${x.n ? p + ' %' : '–'}</span><div class="wdb"><i style="height:${p}%"></i></div><b>${E.WD[x.w]}</b><span class="wdt" title="${wt === 'buero' ? 'Bürotag' : wt === 'ho' ? 'Homeoffice' : 'Frei'}">${ic(wt === 'buero' ? 'office' : wt === 'ho' ? 'home' : 'free')}</span><span class="wds num">${x.sleep != null ? n0(x.sleep) + ' h' : ''}</span></div>`; }).join('')}</div>
      <p class="small muted" style="margin-top:6px">Unter den Tagen: Büro, Homeoffice oder frei laut deinem Wochenplan, darunter der Schlaf im Schnitt.</p>
      ${wdNote ? `<p class="small ink2" style="margin-top:6px">${esc(capF(wdNote))}.</p>` : ''}</div>`;
    // Mood, energy, stress
    const mk = (key, label) => { const v = colVals(cols, x => x[key]); return { label, kind: 'dots', vals: v, mean: daily ? roll(v, 7) : v, min: 1, max: 5, color: 'var(--c1)', fmt: (x, ax) => ax ? String(x) : n0(x) + ' von 5', h: 46, note: T.avg[key] != null ? 'im Schnitt ' + n0(T.avg[key]) : '' }; };
    const moodPanels = [mk('mood', 'Befinden'), mk('energy', 'Energie'), mk('stress', 'Stress')].filter(p => p.vals.some(v => v != null));
    const mood = moodPanels.length ? `<div class="panel" style="margin-top:22px"><div class="sec-head"><h2 class="sec-title">Befinden, Energie und Stress</h2><span class="sec-meta">1 bis 5${daily ? ', Linie: Schnitt der letzten 7 Tage' : ', je Woche'}</span></div>
      ${stackChart('trmood', cols, moodPanels, { label: 'Befinden, Energie und Stress je ' + unitW })}</div>` : '';
    return `${filters}${tiles}${mx}
      <div class="two-col" style="margin-top:22px">${stack}${rank}</div>
      <div class="two-col" style="margin-top:22px">${body}${week}</div>
      ${mood}
      ${envPanel(T, from, t, cols, daily, unitW, bands)}
      ${detailPanel(T, from, t, cols)}
      <p class="small muted" style="margin-top:16px">Zusammenhänge sind Hinweise aus deinen Einträgen, keine Beweise. Je regelmäßiger du eincheckst, desto genauer werden sie.</p>`;
  }
  // ---------- Wetter, Pollen und Luft (2.8) ----------
  const ENV_SRC = 'Quellen: Wetter von Open-Meteo.com; Pollen und Luftqualität von Open-Meteo.com aus „CAMS European air quality forecasts, ENSEMBLE data“ des Copernicus Atmosphere Monitoring Service (CAMS); ältere Wettertage aus ERA5, erzeugt mit Informationen des Copernicus Climate Change Service. Pollen als Tagesmittel, Stufen nach MeteoSchweiz.';
  function envPanel(T, from, t, cols, daily, unitW, bands) {
    const ED = (S.env && S.env.days) || {}, EV = window.Env;
    // Check-in days without values (for example after loading a backup): fetch them in the background
    if (S.settings.home && T.logged.some(d => !EV.complete(ED[d]))) setTimeout(refreshEnv, 0);
    const head = `<div class="sec-head"><h2 class="sec-title">Wetter, Pollen und Luft</h2><span class="sec-meta">${S.settings.home ? 'an deinem Wohnort, ' : ''}je ${unitW}</span></div>`;
    const any = cols.some(c => c.days.some(d => ED[d] && (ED[d].tm != null || ED[d].aq != null)));
    if (!any) return `<div class="panel tr-env" style="margin-top:22px">${head}<p class="small ink2">${S.settings.home ? 'Wetter, Pollen und Luftqualität lädt die App beim nächsten Start mit Internet, auch für die vergangenen Tage. Danach vergleicht sie hier deine Beschwerden damit.' : 'Für den Vergleich mit Wetter, Pollen und Luft braucht die App deinen Wohnort. Trag ihn in den Einstellungen ein.'}</p></div>`;
    const agg = (fn, how) => cols.map(col => { const v = col.days.map(d => (ED[d] ? fn(ED[d]) : null)).filter(x => x != null); if (!v.length) return null; return how === 'max' ? Math.max(...v) : v.reduce((s, x) => s + x, 0) / v.length; });
    const symN = colVals(cols, x => Object.keys(x.sym || {}).filter(k => x.sym[k]).length);
    const tn = agg(x => x.tn), tx = agg(x => x.tx), temp = cols.map((c, i) => (tn[i] != null && tx[i] != null ? [tn[i], tx[i]] : null)), tV = temp.filter(Boolean);
    const pres = agg(x => x.p), pV = pres.filter(v => v != null);
    const polV = agg(x => { const P = EV.pollen(x); return P ? P.max : null; }, 'max');
    const aqV = agg(x => x.aq), aV = aqV.filter(v => v != null);
    const polTips = cols.map(col => {
      const xs = col.days.map(d => ED[d]).filter(x => x && x.pol);
      if (!xs.length) return 'kein Wert';
      if (col.days.length === 1) return EV.polText(xs[0]) || 'keine';
      const best = {};
      xs.forEach(x => { const P = EV.pollen(x); if (P) P.list.forEach(q => { best[q.l] = Math.max(best[q.l] || 0, q.k); }); });
      const e = Object.entries(best).sort((a, b) => b[1] - a[1]);
      return e.length ? 'bis ' + e.map(([l, k]) => l + ' ' + EV.LEVEL[k]).join(', ') : 'keine';
    });
    const step5 = (v, up) => (up ? Math.ceil(v / 5) : Math.floor(v / 5)) * 5;
    const panels = [{ label: 'Beschwerden', kind: 'bar', vals: symN, min: 0, max: Math.max(2, ...symN.filter(v => v != null).map(v => Math.ceil(v))), color: 'var(--h2)', h: 44,
      fmt: (v, ax) => ax ? n0(v, 0) : !v ? 'keine' : daily ? pl2(Math.round(v), 'Beschwerde', 'Beschwerden') : n0(v) + ' je Tag', note: daily ? 'Anzahl am Tag' : 'im Schnitt je Tag' }];
    if (tV.length) { const lo = step5(Math.min(...tV.map(v => v[0]))), hi = step5(Math.max(...tV.map(v => v[1])), true); panels.push({ label: 'Temperatur', kind: 'range', vals: temp, min: lo, max: hi > lo ? hi : lo + 5, color: 'var(--c1)', h: 60, fmt: (v, ax) => ax ? n0(v, 0) + '°' : n0(v[0], 0) + ' bis ' + n0(v[1], 0) + ' °C', note: daily ? 'tiefster bis höchster Wert' : 'Schnitt der Tiefst- und Höchstwerte' }); }
    if (pV.length) { const lo = step5(Math.min(...pV)), hi = step5(Math.max(...pV), true); panels.push({ label: 'Luftdruck', kind: 'dots', vals: pres, mean: pres, min: lo, max: hi > lo ? hi : lo + 5, color: 'var(--c1)', h: 46, fmt: (v, ax) => Math.round(v) + (ax ? '' : ' hPa'), note: 'hPa auf Meereshöhe, Tagesmittel' }); }
    if (polV.some(v => v > 0)) panels.push({ label: 'Pollen', kind: 'bar', vals: polV, min: 0, max: 4, color: 'var(--c2)', h: 44, tips: polTips, fmt: (v, ax) => ax ? n0(v, 0) : EV.LEVEL[Math.round(v)], note: 'höchste Stufe, 0 keine bis 4 sehr stark' });
    if (aV.length) panels.push({ label: 'Luftqualität', kind: 'bar', vals: aqV, min: 0, max: Math.max(60, Math.ceil(Math.max(...aV) / 20) * 20), goal: 40, color: 'var(--c1)', h: 44, fmt: (v, ax) => ax ? n0(v, 0) : n0(v, 0) + ', ' + EV.aqiBand(v).l, note: 'Europäischer Index, Linie: ab 40 mäßig' });
    // The range in words, then what coincides with the complaints
    const s = EV.summary(S.env, from, t), lines = [];
    if (s.tn != null) lines.push('Temperatur von ' + n0(s.tn, 0) + ' bis ' + n0(s.tx, 0) + ' °C' + (s.sturz ? ', ' + pl2(s.sturz, 'Temperatursturz', 'Temperaturstürze') + ' um 5 Grad oder mehr' : '') + (s.druck ? ', an ' + pl2(s.druck, 'Tag', 'Tagen') + ' fiel der Luftdruck um 5 hPa oder mehr' : '') + '.');
    const mod = s.polList.filter(q => q.mod);
    lines.push(mod.length ? 'Pollen mäßig oder stärker: ' + mod.map(q => q.l + ' an ' + pl2(q.mod, 'Tag', 'Tagen')).join(', ') + '.' : s.polList.length ? 'Pollen nur schwach: ' + s.polList.map(q => q.l).join(', ') + '.' : 'Kein Pollenflug in diesem Zeitraum.');
    if (s.aq != null) lines.push('Luftqualität im Schnitt ' + EV.aqiBand(s.aq).l + ' (Index ' + s.aq + ')' + (s.aqBad ? ', an ' + pl2(s.aqBad, 'Tag', 'Tagen') + ' mäßig oder schlechter' : '') + '.');
    const links = [];
    T.top.slice(0, 8).forEach(c => { H.symDetail(S, c.key, from, t).factors.filter(f => f.env).forEach(f => links.push({ c, f })); });
    links.sort((a, b) => b.f.lift - a.f.lift || b.f.pk - a.f.pk);
    const linkHtml = links.length ? `<ul class="checklist">${links.slice(0, 4).map(({ c, f }) => `<li><div class="check-body"><div class="row" style="align-items:baseline"><div class="check-name grow">${esc(c.label)}: ${esc(f.label)}</div>${f.lift >= 1.8 && f.pk >= 4 ? '<span class="tag cognac">auffällig</span>' : ''}</div><div class="check-meta">an ${f.pn} von ${f.pk} Tagen mit ${esc(c.label)}, sonst an ${Math.round(f.b * 100)} % der Tage</div></div></li>`).join('')}</ul>`
      : `<p class="small ink2">${T.logged.length >= 21 ? 'Bisher fällt keine deiner Beschwerden mit Wetter, Pollen oder Luft zusammen.' : 'Ab etwa drei Wochen Check-ins vergleicht die App hier deine Beschwerden mit Wetter, Pollen und Luft.'}</p>`;
    return `<div class="panel tr-env" style="margin-top:22px">${head}
      ${stackChart('trenv', cols, panels, { label: 'Beschwerden, Wetter, Pollen und Luft je ' + unitW, bands })}
      ${bands.length ? `<div class="legend"><span><span class="sw st-band-sw"></span>Infekt-Episode</span></div>` : ''}
      <div class="two-col tr-env-cols" style="margin-top:14px">
        <div><h3 class="mini-h">Im Zeitraum</h3><ul class="tr-env-sum">${lines.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>
        <div><h3 class="mini-h">Mit deinen Beschwerden</h3>${linkHtml}</div></div>
      <p class="small muted tr-src" style="margin-top:12px">${esc(ENV_SRC)}</p></div>`;
  }
  // One complaint in detail: when, how long, how strong, and what tends to come with it
  function detailPanel(T, from, t, cols) {
    if (!T.top.length) return '';
    const keys = T.top.slice(0, 12).map(c => c.key);
    if (!ui.trSym || !keys.includes(ui.trSym)) ui.trSym = keys[0];
    const X = H.symDetail(S, ui.trSym, from, t);
    const cmp = (label, c, f) => (c.with != null && c.without != null ? `<li><span>${label}</span><span class="num">${f(c.with)} <span class="muted">damit</span>, ${f(c.without)} <span class="muted">ohne</span></span></li>` : '');
    const cmps = [cmp('Schlaf', X.sleep, v => n0(v) + ' h'), cmp('Schlafqualität', X.sleepQ, v => n0(v)), cmp('Befinden', X.mood, v => n0(v)), cmp('Energie', X.energy, v => n0(v)), cmp('Tagestemperatur', X.temp, v => n0(v) + ' °C')].join('');
    const fs = X.factors.slice(0, 4).map(f => `<li><div class="check-body"><div class="row" style="align-items:baseline"><div class="check-name grow">${esc(f.label)}</div>${f.lift >= 1.8 && f.pk >= 4 ? '<span class="tag cognac">auffällig</span>' : ''}</div><div class="check-meta">an ${f.pn} von ${f.pk} Tagen mit ${esc(X.label)}, sonst an ${Math.round(f.b * 100)} % der Tage</div></div></li>`).join('');
    const strong = X.lv[3] ? ', ' + pl2(X.lv[3], 'Tag', 'Tage') + ' stark' : '';
    return `<div class="panel" style="margin-top:22px"><div class="sec-head"><h2 class="sec-title">Eine Beschwerde genauer</h2><span class="sec-meta">${esc(X.label)}</span></div>
      <div class="schips" role="group" aria-label="Beschwerde wählen" style="margin-bottom:14px">${keys.map(k => `<button class="chip" data-a="tr.sym" data-k="${esc(k)}" aria-pressed="${k === ui.trSym}">${esc(H.symLabel(k))}</button>`).join('')}</div>
      <div class="stats tr-stats small-stats">
        <div class="stat"><div class="stat-val">${X.n} <span class="stat-of">von ${X.of}</span></div><div class="stat-label">Tagen eingetragen${strong}</div></div>
        <div class="stat"><div class="stat-val">${X.runs.length}</div><div class="stat-label">${X.runs.length === 1 ? 'Phase' : 'Phasen'}, die längste ${pl2(X.longest, 'Tag', 'Tage')}</div></div>
        <div class="stat"><div class="stat-val">${X.avgInt != null ? capF(H.INT[Math.round(X.avgInt)]) : '–'}</div><div class="stat-label">meistens${X.last ? ', zuletzt ' + E.fmtRel(X.last) : ''}</div></div></div>
      <div style="margin-top:14px">${matrixChart('trdet', [symRow(X.key, X.label, cols)], cols, { label: X.label + ' im Verlauf', noLabels: true })}</div>
      <div class="two-col tr-det" style="margin-top:10px">
        <div><h3 class="mini-h">Im Vergleich zu Tagen ohne</h3>${cmps ? `<ul class="cmp">${cmps}</ul>` : '<p class="small ink2">Braucht Angaben zu Schlaf oder Befinden an Tagen mit und ohne.</p>'}</div>
        <div><h3 class="mini-h">Was damit zusammenfällt</h3>${fs ? `<ul class="checklist">${fs}</ul>` : `<p class="small ink2">${X.n >= 3 ? 'Bisher fällt nichts Bestimmtes zusammen.' : 'Braucht mindestens drei Tage mit dieser Beschwerde.'} Die App vergleicht Schlaf, Stress, Kaffee, Alkohol, spätes Essen, Training, Bürotage, Wetter, Pollen und Luft mit den Tagen ohne.</p>`}</div></div></div>`;
  }

  Object.assign(A, {
    'tr.range': el => { ui.trRange = el.dataset.v; render(); },
    'tr.sym': el => { ui.trSym = el.dataset.k; render(); }
  });
  // ---------- end Verläufe ----------
