/* Chris OS, Ankleide-Figur (Figure).
   Zeichnet ein Outfit als Figur in Vorderansicht: 185 cm, schlank. Die Teile liegen in Farbe, Muster und Struktur übereinander.
   viewBox 0 0 100 200: eine Einheit entspricht einem Zentimeter, Körpermitte x = 50, Boden y = 194.
   Eingabe wie aus E.suggest oder E.fromIds: { tops: [innen … außen], bottom, shoes, outer, outerHint, acc: [], open }.
   Ausgabe: SVG-Text. Jedes Teil liegt in <g class="fig-part" data-slot="t0|t1|t2|bottom|shoes|outer|acc">. */
(function (root) {
  'use strict';

  const CX = 50, LW = 0.5, DW = 0.3;
  const LINE = 'var(--garment-line, #2E2B27)';
  const SKIN = 'var(--fig-skin, #E3DBCF)';
  const SKIN_LINE = 'var(--fig-skin-line, rgba(70, 58, 46, .35))';
  const GROUND = 'var(--fig-ground, rgba(0, 0, 0, .12))';
  const METAL = '#B9B1A2';
  const HINT_LINE = 'var(--fig-hint, #8C877F)';

  const ROLE = {
    'T-Shirt': 'tee', 'Kragenshirt': 'polo', 'Hemd': 'shirt', 'Business-Hemd': 'shirt', 'Overshirt': 'overshirt',
    'Pullover': 'knit', 'Cardigan': 'cardigan', 'Sakko': 'blazer', 'Jacke': 'jacket', 'Mantel': 'coat', 'Winterjacke': 'winter',
    'Jeans': 'bottom', 'Stoffhose': 'bottom', 'Sneaker': 'shoes', 'Loafer': 'shoes', 'Business-Schuhe': 'shoes', 'Stiefel': 'shoes',
    'Kappe': 'cap', 'Mütze': 'beanie', 'Schal': 'scarf', 'Gürtel': 'belt', 'Uhr': 'watch'
  };
  const roleOf = it => (it && (it.role || ROLE[it.cat])) || '';
  const txt = it => (it ? [it.label, it.cat, it.notes, [].concat(it.material || []).join(' '), it.texture, it.patternNote].filter(Boolean).join(' ') : '').toLowerCase();
  const capF = s => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  // Same rule as brandOf in app.js: as written, only an all-lowercase brand gets capitals
  const brandText = raw => {
    const b = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!b || b !== b.toLowerCase()) return b;
    return b.split(' ').map((w, i) => (i && /^(und|and|of|de|la|le|les|du|van|von|der|die|das|y|e|et|&)$/.test(w)) || !/^[a-zäöü]/.test(w) ? w : w[0].toUpperCase() + w.slice(1)).join(' ');
  };
  const named = it => capF(it.label || it.cat) + (it.brand ? ' von ' + brandText(it.brand) : '');
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // ---------- Zahlen und Farben ----------
  const f = v => String(Math.round(v * 100) / 100);
  function hexToRgb(h) { h = String(h || '#999999').replace('#', ''); if (h.length === 3) h = h.replace(/./g, c => c + c); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) || 0); }
  function rgbToHex(r) { return '#' + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); }
  function lum(hex) { const [r, g, b] = hexToRgb(hex).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }
  function lerpTab(t, y) {
    let i = 1;
    while (i < t.length - 1 && y > t[i][0]) i++;
    const a = t[i - 1], b = t[i];
    return a[1] + (b[1] - a[1]) * (y - a[0]) / (b[0] - a[0]);
  }

  // ---------- Pfade: Läufe aus Punkten, glatt (Catmull-Rom) oder gerade ----------
  const S = (...p) => ({ p, s: 1 });
  const L = (...p) => ({ p, s: 0 });
  const mx = p => [2 * CX - p[0], p[1]];
  const mirror = runs => runs.map(r => ({ p: r.p.map(mx), s: r.s }));
  // rechte Hälfte von der Mitte oben bis zur Mitte unten, links gespiegelt ergänzt
  const sym = runs => runs.concat(runs.slice().reverse().map(r => ({ p: r.p.map(mx).reverse(), s: r.s })));
  // offene Linie: Lauf beginnt in der Mitte, wird nach links gespiegelt
  const symOpen = run => [{ p: run.p.map(mx).reverse(), s: run.s }, run];
  function cr(p) {
    let d = '';
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i - 1] || p[i], b = p[i], c = p[i + 1], e = p[i + 2] || p[i + 1];
      d += 'C' + f(b[0] + (c[0] - a[0]) / 6) + ' ' + f(b[1] + (c[1] - a[1]) / 6) + ' ' + f(c[0] - (e[0] - b[0]) / 6) + ' ' + f(c[1] - (e[1] - b[1]) / 6) + ' ' + f(c[0]) + ' ' + f(c[1]);
    }
    return d;
  }
  function path(runs, open) {
    let d = '', cur = null;
    for (const r of runs) {
      const p = r.p;
      if (!p || !p.length) continue;
      if (!cur) d += 'M' + f(p[0][0]) + ' ' + f(p[0][1]);
      else if (Math.abs(cur[0] - p[0][0]) > 1e-3 || Math.abs(cur[1] - p[0][1]) > 1e-3) d += 'L' + f(p[0][0]) + ' ' + f(p[0][1]);
      if (r.s) d += cr(p); else for (let i = 1; i < p.length; i++) d += 'L' + f(p[i][0]) + ' ' + f(p[i][1]);
      cur = p[p.length - 1];
    }
    return open ? d : d + 'Z';
  }
  const pair = runs => [path(mirror(runs)), path(runs)];
  const edgeX = (edge, y) => lerpTab(edge.map(p => [p[1], p[0]]), y);

  // ---------- Zeichenkontext, Strukturen, Farben eines Teils ----------
  let uid = 0;
  function newCtx() {
    const id = 'fg' + (++uid);
    return {
      id, n: 0, tex: {},
      defs: [`<linearGradient id="${id}-sh" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".2"/><stop offset=".17" stop-color="#000" stop-opacity=".05"/><stop offset=".46" stop-color="#fff" stop-opacity=".07"/><stop offset=".56" stop-color="#fff" stop-opacity=".07"/><stop offset=".83" stop-color="#000" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".2"/></linearGradient>`]
    };
  }
  function texDef(id, key, onDark) {
    const ink = onDark ? '#ffffff' : '#000000', o = onDark ? 0.17 : 0.14;
    const P = (w, h, body, tr) => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${tr ? ` patternTransform="${tr}"` : ''}>${body}</pattern>`;
    switch (key) {
      case 'denim': return P(0.8, 0.8, `<rect width=".8" height=".26" fill="${ink}" opacity="${f(o * 1.5)}"/>`, 'rotate(-38)');
      case 'cord': return P(1.0, 4, `<rect width=".34" height="4" fill="${ink}" opacity="${f(o * 1.5)}"/>`);
      case 'rib': return P(0.85, 4, `<rect width=".28" height="4" fill="${ink}" opacity="${f(o * 1.6)}"/>`);
      case 'fine': return P(0.7, 4, `<rect width=".18" height="4" fill="${ink}" opacity="${f(o * 1.1)}"/>`);
      case 'knit': return P(1.3, 1.1, `<path d="M0 0L.65 .95L1.3 0" fill="none" stroke="${ink}" stroke-width=".2" opacity="${f(o * 1.5)}"/>`);
      case 'chunky': return P(2.0, 1.7, `<path d="M0 0L1 1.5L2 0" fill="none" stroke="${ink}" stroke-width=".3" opacity="${f(o * 1.5)}"/><path d="M1 0V.5" stroke="${ink}" stroke-width=".22" opacity="${f(o * 1.1)}"/>`);
      case 'twill': return P(1.4, 1.4, `<rect width="1.4" height=".36" fill="${ink}" opacity="${f(o * 1.2)}"/>`, 'rotate(-45)');
      case 'wool': return P(2.4, 2.4, `<g fill="${ink}" opacity="${f(o * 1.3)}"><circle cx=".5" cy=".6" r=".12"/><circle cx="1.7" cy="1.1" r=".1"/><circle cx=".9" cy="1.9" r=".11"/><circle cx="2.1" cy="2.2" r=".09"/></g>`);
      case 'linen': return P(5, 2.2, `<path d="M0 .5H2.2M3 .5H4.6M.8 1.6H3.6M4.2 1.6H5" stroke="${ink}" stroke-width=".16" opacity="${f(o * 1.9)}"/>`);
      case 'pique': return P(0.9, 0.9, `<circle cx=".45" cy=".45" r=".15" fill="${ink}" opacity="${f(o * 1.6)}"/>`);
      case 'quilt': return P(5, 5, `<path d="M0 0H5M0 0V5" stroke="${ink}" stroke-width=".24" opacity="${f(o * 2.4)}"/>`, 'rotate(45)');
      default: return '';
    }
  }
  function useTex(ctx, key, onDark) {
    const id = ctx.id + '-' + key + (onDark ? 'l' : 'd');
    if (!ctx.tex[id]) { ctx.tex[id] = 1; ctx.defs.push(texDef(id, key, onDark)); }
    return id;
  }
  function texKey(it, role) {
    const t = String(it.texture || '').toLowerCase(), m = [].concat(it.material || []).join(' ').toLowerCase(), s = txt(it);
    if (/denim/.test(t) || ((role === 'bottom' || role === 'jacket') && (it.cat === 'Jeans' || /jeans|denim/.test(s)))) return 'denim';
    if (/cord/.test(t) || /\bcord/.test(s)) return 'cord';
    if (role === 'knit' || role === 'cardigan' || role === 'beanie') { if (/gerippt/.test(t)) return 'rib'; if (/grob|dick/.test(t)) return 'chunky'; if (/fein/.test(t)) return 'fine'; return 'knit'; }
    if (role === 'scarf') return 'wool';
    if (/gerippt/.test(t)) return 'rib';
    if (/wollig/.test(t)) return 'wool';
    if (/leinen/.test(m) || /leinen/.test(s)) return 'linen';
    if (role === 'jacket' && /stepp|quilt/.test(s)) return 'quilt';
    if ((role === 'coat' || role === 'blazer' || role === 'overshirt') && /wolle|kaschmir|techno/.test(m)) return 'wool';
    if (role === 'polo') return 'pique';
    if (/dick|grob/.test(t)) return 'twill';
    return null;
  }
  function paint(ctx, it, role, noTex) {
    it = it || {};
    const base = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(it.hex || '') ? it.hex : '#8C877F';
    const dark = lum(base) < 0.32;
    const det = dark ? mix(base, '#ffffff', 0.34) : mix(base, '#000000', 0.3);
    const second = it.hex2 || (dark ? mix(base, '#ffffff', 0.7) : mix(base, '#000000', 0.55));
    const pid = ctx.id + 'p' + (++ctx.n);
    let def = '';
    if (it.pattern === 'kariert') def = `<pattern id="${pid}" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${base}"/><rect width="6" height="2" fill="${second}" opacity=".5"/><rect width="2" height="6" fill="${second}" opacity=".5"/><rect width="2" height="2" fill="${second}" opacity=".85"/><path d="M0 4.4H6M4.4 0V6" stroke="${second}" stroke-width=".16" opacity=".75"/></pattern>`;
    else if (it.pattern === 'gestreift') def = ['shirt', 'overshirt', 'bottom', 'blazer', 'coat'].includes(role)
      ? `<pattern id="${pid}" width="2.2" height="4" patternUnits="userSpaceOnUse"><rect width="2.2" height="4" fill="${base}"/><rect width=".7" height="4" fill="${second}"/></pattern>`
      : `<pattern id="${pid}" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="3" fill="${base}"/><rect width="4" height="1.1" fill="${second}"/></pattern>`;
    else if (it.pattern === 'gepunktet') def = `<pattern id="${pid}" width="1.8" height="1.8" patternUnits="userSpaceOnUse"><rect width="1.8" height="1.8" fill="${base}"/><circle cx=".9" cy=".9" r=".3" fill="${second}"/></pattern>`;
    else if (it.hex2 && /gerippt/i.test(it.texture || '')) def = `<pattern id="${pid}" width="1.6" height="4" patternUnits="userSpaceOnUse"><rect width="1.6" height="4" fill="${base}"/><rect width=".6" height="4" fill="${second}" opacity=".85"/></pattern>`;
    if (def) ctx.defs.push(def);
    const tk = !def && !noTex ? texKey(it, role) : null;
    return { base, fill: def ? `url(#${pid})` : base, dark, det, second, tex: tk ? useTex(ctx, tk, dark) : null, dash: it.unknownColor ? ' stroke-dasharray="1.5 1"' : '', print: !!it.print };
  }
  const HINT = { base: '#8C877F', fill: 'var(--fig-hint, #8C877F)', dark: false, det: '#6E6961', second: '#6E6961', tex: null, dash: ' stroke-dasharray="1.6 1.1"', hint: 1 };
  const withTex = (ctx, P, key) => P.hint ? P : Object.assign({}, P, { tex: useTex(ctx, key, P.dark) });

  // Fläche: Farbe oder Muster, Struktur, Schattierung, Kontur
  function piece(ctx, d, P, o) {
    o = o || {};
    let s = `<path d="${d}" fill="${o.fill || P.fill}"${P.hint ? ' fill-opacity=".1"' : ''}/>`;
    if (P.tex && !o.noTex) s += `<path d="${d}" fill="url(#${P.tex})"/>`;
    if (!o.flat && !P.hint) s += `<path d="${d}" fill="url(#${ctx.id}-sh)"/>`;
    if (o.tone && !P.hint) s += `<path d="${d}" fill="${o.tone}"/>`;
    if (o.extra) s += o.extra;
    return s + `<path d="${d}" fill="none" stroke="${P.hint ? HINT_LINE : LINE}" stroke-width="${o.lw || LW}" stroke-linejoin="round"${P.dash}/>`;
  }
  const both = (ctx, runs, P, o) => pair(runs).map(d => piece(ctx, d, P, o)).join('');
  function line(d, P, o) {
    o = o || {};
    if (P.hint) return '';
    return `<path d="${d}" fill="none" stroke="${o.c || P.det}" stroke-width="${o.w || DW}" stroke-linecap="round" stroke-linejoin="round"${o.op ? ` opacity="${o.op}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
  }
  const lines = (runs, P, o) => pair(runs).map(d => line(d, P, o)).join('');
  const dot = (x, y, r, c, sc) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${c}"${sc ? ` stroke="${sc}" stroke-width=".14"` : ''}/>`;
  const button = (P, x, y, r) => P.hint ? '' : dot(x, y, r || 0.5, P.dark ? mix(P.base, '#000000', 0.35) : mix(P.base, '#ffffff', 0.4), P.det);

  // ---------- Körper ----------
  const LEG = [S([66.6, 99.5], [67.4, 112], [66.0, 128], [64.8, 141]), S([64.8, 141], [65.4, 147], [65.7, 156], [64.6, 172], [63.3, 187]), L([63.3, 187], [63.6, 192.4], [56.8, 192.4], [57.1, 187]), S([57.1, 187], [55.6, 172], [54.6, 156], [55.0, 147], [55.0, 141]), S([55.0, 141], [53.8, 127], [51.6, 115], [50.4, 107]), L([50.4, 107], [51, 99.5])];
  const TORSO = sym([L([50, 36], [55.9, 36.2]), S([55.9, 36.2], [58.6, 39.2], [64.0, 41.6], [70.4, 43.6]), S([70.4, 43.6], [73.2, 45.4], [74.2, 49.4]), L([74.2, 49.4], [66.7, 58]), S([66.7, 58], [66.8, 63], [65.8, 71], [64.6, 81], [64.9, 88], [66.3, 93.5], [66.9, 98], [66.5, 104]), L([66.5, 104], [50, 104])]);
  const NECK = sym([L([50, 25], [55.0, 25]), S([55.0, 25], [55.1, 30], [55.5, 34.5], [56.6, 38.6]), L([56.6, 38.6], [50, 38.6])]);
  const HEAD = sym([S([50, 9.0], [54.9, 9.5], [57.9, 13.0], [58.2, 18.4], [57.6, 24.4], [55.9, 29.0], [53.4, 32.2], [50, 33.3])]);
  const EAR = [S([57.7, 18.8], [59.3, 18.3], [60.0, 21.1], [59.5, 24.0], [58.0, 25.4])];
  const ARM = [S([70.4, 43.6], [73.6, 45.3], [75.0, 49.5], [75.6, 57], [76.1, 64], [76.6, 71], [77.2, 78], [78.8, 85.5], [79.9, 94], [80.7, 103.6]), L([80.7, 103.6], [75.5, 104.2]), S([75.5, 104.2], [73.4, 95], [71.4, 86.5], [69.8, 78.5], [68.4, 70.5], [67.3, 64], [66.7, 58]), S([66.7, 58], [66.5, 52], [68.0, 46.4], [70.4, 43.6])];
  const HAND = [S([75.6, 103.8], [75.2, 107.4], [74.9, 111.6], [75.8, 116.8], [77.8, 121.8], [80.2, 123.1], [81.8, 120.8], [82.0, 115.2], [81.5, 109.6], [80.8, 103.6])];
  let BODY = null;
  function body() {
    if (BODY) return BODY;
    const parts = [...pair(LEG), path(TORSO), path(NECK), ...pair(ARM), ...pair(HAND), ...pair(EAR), path(HEAD)];
    const thumb = pair([S([75.9, 107.4], [76.8, 111.0], [76.5, 114.6])]).map(d => `<path d="${d}" fill="none" stroke="${SKIN_LINE}" stroke-width=".3" stroke-linecap="round"/>`).join('');
    BODY = `<g class="fig-body">${parts.map(d => `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="${LW * 2}" stroke-linejoin="round"/>`).join('')}${parts.map(d => `<path d="${d}" fill="${SKIN}"/>`).join('')}${thumb}</g>`;
    return BODY;
  }

  // ---------- Grundformen für Oberteile ----------
  const W_ST = [58.4, 64, 72, 81, 90, 100, 116, 140];
  const halfW = (y, ws, fl) => lerpTab([[58.4, 17.3], [64, 17.2], [72, 16.8 + ws * 0.5], [81, 16.4 + ws], [90, 16.5 + ws * 0.4 + fl * 0.3], [100, 16.8 + fl * 0.55], [116, 17.2 + fl * 0.8], [140, 17.6 + fl]], y);
  function geo(e, o) {
    o = o || {};
    const drop = o.drop || 0, sb = o.sb || 0, ws = o.ws || 0, fl = o.fl || 0;
    const sp = [70.8 + e * 0.45 + drop + sb, 43.6 + drop * 0.55 - sb * 0.35];
    const sx = y => CX + halfW(y, ws, fl) + e;
    const side = hy => { const p = [[sp[0] - 1.6 + drop * 0.1, 51.4 + drop * 0.3]]; W_ST.forEach(y => { if (y < hy - 1.5) p.push([sx(y), y]); }); p.push([sx(hy), hy]); return p; };
    return { e, drop, sb, sp, sx, side };
  }
  function neckRun(nf, ns) { const dx = ns[0] - CX, dy = nf - ns[1]; return S([CX, nf], [CX + dx * 0.5, nf - dy * 0.1], [CX + dx * 0.87, nf - dy * 0.5], ns); }
  function hemRun(hs, hy, tail) {
    const dx = hs[0] - CX;
    return tail ? S(hs, [CX + dx * 0.8, hs[1] + (hy - hs[1]) * 0.5], [CX + dx * 0.42, hy - 0.12], [CX, hy]) : S(hs, [CX + dx * 0.5, hy + 0.15], [CX, hy]);
  }
  function closedRuns(g, nf, ns, hy, hsy, tail) { const side = g.side(hsy), hs = side[side.length - 1]; return sym([neckRun(nf, ns), L(ns, g.sp), S(g.sp, ...side), hemRun(hs, hy, tail)]); }
  const vEdge = (vy, ns) => [[CX, vy], [CX + (ns[0] - CX) * 0.45, vy - (vy - ns[1]) * 0.42], [CX + (ns[0] - CX) * 0.84, ns[1] + (vy - ns[1]) * 0.18], ns];
  function vRuns(g, vy, ns, hy) { const side = g.side(hy), hs = side[side.length - 1]; return sym([S(...vEdge(vy, ns)), L(ns, g.sp), S(g.sp, ...side), hemRun(hs, hy, false)]); }
  function panelRuns(g, edge, ns, hy, hsy, tail) {
    const side = g.side(hsy), hs = side[side.length - 1], fe = edge[edge.length - 1], top = edge[0], dx = hs[0] - fe[0];
    const hem = tail ? S(fe, [fe[0] + dx * 0.4, hy - 0.2], [fe[0] + dx * 0.78, hsy + (hy - hsy) * 0.45], hs) : S(fe, [fe[0] + dx * 0.5, (fe[1] + hs[1]) / 2 + 0.12], hs);
    return [S(...edge), hem, S(hs, ...side.slice(0, -1).reverse(), g.sp), L(g.sp, ns), S(ns, [ns[0] - (ns[0] - top[0]) * 0.55, ns[1] + (top[1] - ns[1]) * 0.45], top)];
  }
  function bandRuns(nf1, ns1, nf2, ns2) { const a = neckRun(nf1, ns1), b = neckRun(nf2, ns2); return sym([a, L(ns1, ns2), { p: b.p.slice().reverse(), s: 1 }]); }
  function hemBand(g, P, ctx, hb, hy, narrow) {
    const w1 = g.sx(hb), w2 = w1 - narrow;
    return piece(ctx, path(sym([L([CX, hb], [w1, hb], [w2, hy]), S([w2, hy], [CX + (w2 - CX) * 0.5, hy + 0.12], [CX, hy])])), P, { flat: true });
  }

  // Ärmel entlang des Arms: Außen- und Innenkante mit Weite e
  const ARM_O = [[45.3, 73.9, 0.9], [50.2, 75.4, 1], [57.5, 76.1, 1], [65, 76.6, 1], [73, 77.2, 1], [80, 77.9, 0.95], [88, 79.1, 0.85], [96, 80.1, 0.7], [103.6, 80.8, 0.45], [112, 81.4, 0.4]];
  const ARM_I = [[59.6, 67.3, 0.25], [65, 67.9, 0.8], [72.5, 69.0, 1], [80.5, 70.3, 0.95], [88.5, 72.0, 0.8], [97, 73.9, 0.55], [104.4, 75.3, 0.3], [112, 75.8, 0.3]];
  const armO = (y, e) => lerpTab(ARM_O.map(r => [r[0], r[1] + e * r[2]]), y);
  const armI = (y, e) => lerpTab(ARM_I.map(r => [r[0], r[1] - e * r[2]]), y);
  function sleeveRuns(g, yEnd, tilt, o) {
    o = o || {};
    const e = g.e + (o.se || 0), d = g.drop, sb = g.sb;
    const out = [g.sp];
    ARM_O.forEach((r, i) => {
      if (r[0] >= yEnd - 1.2) return;
      const x = r[1] + e * r[2] + (i === 0 ? d * 0.35 + sb * 0.7 : i === 1 ? d * 0.2 + sb * 0.5 : 0);
      out.push([x, r[0] + (i === 0 ? d * 0.5 : i === 1 ? d * 0.3 : 0)]);
    });
    const oe = [armO(yEnd, e), yEnd], yi = yEnd + tilt, ie = [armI(yi, e), yi];
    out.push(oe);
    const inn = [ie];
    ARM_I.slice().reverse().forEach(r => { if (r[0] < yi - 1.2) inn.push([r[1] - e * r[2], r[0]]); });
    const ap = inn[inn.length - 1];
    return { runs: [S(...out), L(oe, ie), S(...inn), S(ap, [67.2 + d * 0.3, 54.5], [68.6 + d * 0.6 + sb * 0.3, 48.6], g.sp)], oe, ie, e };
  }
  function cuffRuns(g, y1, y2, tilt, k, o) {
    o = o || {};
    const e = g.e + (o.se || 0);
    const a = [armO(y1, e) - k, y1], b = [armO(y2, e) - k, y2], c = [armI(y2 + tilt, e) + k * 0.4, y2 + tilt], d = [armI(y1 + tilt, e) + k * 0.4, y1 + tilt];
    return [L(a, b), S(b, [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2 + 0.25], c), L(c, d), S(d, [(a[0] + d[0]) / 2, (a[1] + d[1]) / 2 + 0.2], a)];
  }
  // Hemdkragen, op: 0 geschlossen, 0,45 oberster Knopf offen, 1 offen getragen
  function collarRuns(op, e) {
    const top = [55.5, 34.2 + op * 0.3], out = [58.9 + op * 1.4 + e * 0.15, 40.0 + op * 0.7], tip = [53.7 + op * 2.0, 47.0 + op * 1.6], inn = [50.35 + op * 1.45, 43.5 + op * 1.2];
    return [S(top, [57.3, 35.7 + op * 0.3], out), L(out, tip, inn), S(inn, [51.6 + op * 1.1, 40.6 + op * 0.8], [53.6 + op * 0.6, 37.2 + op * 0.4], top)];
  }
  const BAND = sym([L([50, 40.0], [53.0, 39.3], [54.0, 41.9]), S([54.0, 41.9], [52.0, 43.4], [50, 43.7])]);
  const STAND = [L([55.6, 33.4], [59.0, 34.6], [59.8, 39.8], [53.4, 42.0]), S([53.4, 42.0], [54.9, 37.8], [55.6, 33.4])];

  // ---------- Passform und Lagen ----------
  const BASE_E = { tee: 0.4, polo: 0.55, shirt: 0.7, overshirt: 1.7, knit: 1.3, cardigan: 1.4, blazer: 1.9, jacket: 2.3, coat: 3.1, winter: 4.2 };
  const GAP = { tee: 0.4, polo: 0.5, shirt: 0.55, overshirt: 0.9, knit: 0.75, cardigan: 0.8, blazer: 0.85, jacket: 0.95, coat: 1.0, winter: 1.2 };
  const fitAdj = fit => { fit = String(fit || ''); return /^oversized/i.test(fit) ? 2.0 : /leicht oversized/i.test(fit) ? 1.3 : /relaxed/i.test(fit) ? 0.8 : /slim/i.test(fit) ? -0.45 : 0; };
  const dropOf = (fit, r) => { fit = String(fit || ''); if (!['tee', 'knit', 'overshirt', 'jacket', 'cardigan'].includes(r)) return 0; return /^oversized/i.test(fit) ? 2.4 : /leicht oversized/i.test(fit) ? 1.4 : /relaxed/i.test(fit) ? 0.5 : 0; };
  const wsOf = fit => /slim/i.test(fit || '') ? -0.9 : /relaxed|oversized/i.test(fit || '') ? 0.4 : -0.25;
  function layersOf(o) {
    const tops = (o.tops || []).filter(Boolean);
    let eIn = 0, dIn = 0;
    return tops.map((it, i) => {
      const r = roleOf(it) || 'tee';
      let e = (BASE_E[r] != null ? BASE_E[r] : 1) + fitAdj(it.fit), drop = dropOf(it.fit, r);
      if (i > 0) { e = Math.max(e, eIn + (GAP[r] || 0.6)); drop = Math.max(drop, dIn * 0.8); }
      eIn = e; dIn = drop;
      const open = !!o.open && i === tops.length - 1 && i > 0 && (r === 'shirt' || r === 'overshirt');
      const tucked = i === 0 && r === 'shirt' && it.cat === 'Business-Hemd' && !open && !!o.bottom;
      return { it, r, e, drop, open, tucked, slot: 't' + i };
    });
  }

  // ---------- Oberteile ----------
  function tee(ctx, l) {
    const it = l.it, P = paint(ctx, it, 'tee'), s = txt(it);
    const g = geo(l.e, { drop: l.drop, ws: wsOf(it.fit) });
    const long = /longsleeve|langarm|long sleeve/.test(s);
    const nf = 43.4, ns = [56.7 + l.e * 0.12, 38.3], hy = 100.6 + (l.drop > 1 ? 1.8 : 0);
    let out = piece(ctx, path(closedRuns(g, nf, ns, hy, hy - 0.3, false)), P);
    out += line(path(symOpen(neckRun(nf + 1.0, [ns[0] + 0.8, ns[1] + 0.5])), true), P, { op: 0.8 });
    out += line(path(symOpen(S([CX, hy - 1.05], [g.sx(hy) - 0.3, hy - 1.3])), true), P, { op: 0.45 });
    if (P.print) out += `<circle cx="57.4" cy="52.6" r="2.1" fill="none" stroke="${P.det}" stroke-width=".42"/><path d="M56.3 52.9h2.2M57.4 51.6v1.3" stroke="${P.det}" stroke-width=".3" stroke-linecap="round"/>`;
    const sl = long ? sleeveRuns(g, 100.6, 0.9) : l.drop > 1 ? sleeveRuns(g, 74.5, 2.2) : sleeveRuns(g, 61.4, 2.2);
    out += both(ctx, sl.runs, P);
    if (long) out += both(ctx, cuffRuns(g, 100.6, 105.4, 0.9, 0.4), withTex(ctx, P, 'rib'), { flat: true });
    else out += lines([L([sl.oe[0] - 0.15, sl.oe[1] - 1.2], [sl.ie[0] + 0.1, sl.ie[1] - 1.2])], P, { op: 0.7 });
    return out;
  }
  function polo(ctx, l) {
    const it = l.it, P = paint(ctx, it, 'polo');
    const g = geo(l.e, { drop: l.drop, ws: wsOf(it.fit) });
    const ns = [56.6 + l.e * 0.12, 38.1], hy = 100.8;
    let out = piece(ctx, path(closedRuns(g, 43.8, ns, hy, hy - 0.3, false)), P);
    out += piece(ctx, path([L([48.8, 44.2], [51.2, 44.2], [51.2, 57.6], [48.8, 57.6])]), P, { flat: true }) + button(P, 50, 48.6, 0.45) + button(P, 50, 53.4, 0.45);
    const sl = sleeveRuns(g, 61.2, 2.2);
    out += both(ctx, sl.runs, P);
    out += both(ctx, [L([sl.oe[0] - 0.25, sl.oe[1] - 1.8], sl.oe, sl.ie, [sl.ie[0] + 0.15, sl.ie[1] - 1.8])], withTex(ctx, P, 'rib'), { flat: true });
    out += both(ctx, collarRuns(0.75, l.e), P, { flat: true });
    return out;
  }
  function shirt(ctx, l) {
    const it = l.it, P = paint(ctx, it, 'shirt');
    const biz = it.cat === 'Business-Hemd';
    const g = geo(l.e, { drop: l.drop * 0.5, ws: wsOf(it.fit) });
    const ns = [55.8 + l.e * 0.12, 36.9];
    let out = '';
    if (l.open) {
      const edge = [[51.8, 44.8], [52.5, 56], [53.4, 72], [54.3, 88], [55.2, 104.4]];
      out += both(ctx, panelRuns(g, edge, ns, 104.6, 100.8, true), P);
      out += lines([S(...edge.slice(1).map(p => [p[0] + 2.2, p[1] - 0.4]))], P, { op: 0.55 });
      [52, 60.4, 68.8, 77.2, 85.6, 94].forEach(y => { out += button(P, 100 - edgeX(edge, y) - 1.2, y); });
    } else {
      const hy = l.tucked ? 87.5 : 104.6, hsy = l.tucked ? 87.5 : 100.4;
      out += piece(ctx, path(closedRuns(g, 43.4, ns, hy, hsy, !l.tucked)), P);
      out += piece(ctx, path([L([48.7, 43.6], [51.3, 43.6], [51.3, hy - 0.3], [48.7, hy - 0.3])]), P, { flat: true });
      [49.6, 58, 66.4, 74.8, 83.2, 91.6, 100].forEach(y => { if (y < hy - 2.5) out += button(P, 50, y); });
    }
    const sl = sleeveRuns(g, 101.2, 0.9);
    out += both(ctx, sl.runs, P);
    out += both(ctx, cuffRuns(g, 101.2, 106.2, 0.9, 0.25), P, { flat: true });
    const cb = [armO(103.7, l.e) - 1.1, 103.7];
    out += button(P, cb[0], cb[1], 0.32) + button(P, 100 - cb[0], cb[1], 0.32);
    if (!l.open && biz) out += piece(ctx, path(BAND), P, { flat: true }) + button(P, 50, 41.9, 0.42);
    out += both(ctx, collarRuns(l.open ? 1 : biz ? 0 : 0.45, l.e), P, { flat: true });
    return out;
  }
  function overshirt(ctx, l) {
    const it = l.it, P = paint(ctx, it, 'overshirt');
    const g = geo(l.e, { drop: l.drop, ws: 0.3 });
    const ns = [56.2 + l.e * 0.12, 37.0], hy = 105.8;
    let out = '';
    if (l.open) {
      const edge = [[52.6, 44.0], [53.3, 58], [54.2, 80], [55.4, hy]];
      out += both(ctx, panelRuns(g, edge, ns, hy, hy - 0.3, false), P);
      [54, 63, 72, 81, 90, 99].forEach(y => { out += button(P, 100 - edgeX(edge, y) - 1.3, y, 0.55); });
    } else {
      out += piece(ctx, path(closedRuns(g, 43.4, ns, hy, hy - 0.3, false)), P);
      out += line(path([L([CX, 44], [CX, hy])], true), P, { op: 0.7 });
      [50, 59, 68, 77, 86, 95].forEach(y => { out += button(P, 51.2, y, 0.55); });
    }
    out += both(ctx, [L([56.0, 53.6], [62.8, 53.6], [62.8, 61.8], [59.4, 62.6], [56.0, 61.8])], P, { flat: true });
    out += both(ctx, [L([55.7, 52.2], [63.1, 52.2], [63.1, 55.4], [59.4, 56.4], [55.7, 55.4])], P, { flat: true });
    out += button(P, 59.4, 55.0, 0.42) + button(P, 40.6, 55.0, 0.42);
    const sl = sleeveRuns(g, 100.8, 0.9);
    out += both(ctx, sl.runs, P) + both(ctx, cuffRuns(g, 100.8, 105.6, 0.9, 0.25), P, { flat: true });
    out += both(ctx, collarRuns(1.15, l.e), P, { flat: true });
    return out;
  }
  function knit(ctx, l) {
    const it = l.it, P = paint(ctx, it, 'knit'), s = txt(it);
    const hood = /hoodie|kapuze/.test(s), turtle = /rollkragen|turtleneck/.test(s), vneck = /v-ausschnitt|v-neck|v ausschnitt/.test(s);
    const zip = !hood && /troyer|half-?zip|zipper/.test(s);
    const g = geo(l.e, { drop: l.drop, ws: wsOf(it.fit) + 0.5 });
    const R = withTex(ctx, P, 'rib');
    const hb = 97.8, hy = 101.9;
    let out = '';
    if (vneck) {
      const ns = [57.4 + l.e * 0.12, 38.6], v = vEdge(58.6, ns);
      out += piece(ctx, path(vRuns(g, 58.6, ns, hb)), P);
      out += both(ctx, [S(...v), L(ns, [ns[0] + 1.4, ns[1] + 0.5]), S([ns[0] + 1.4, ns[1] + 0.5], [v[2][0] + 1.35, v[2][1] + 0.6], [v[1][0] + 1.2, v[1][1] + 0.9], [CX, 60.8])], R, { flat: true });
    } else if (turtle) {
      const ns = [57.9 + l.e * 0.1, 41.0];
      out += piece(ctx, path(closedRuns(g, 42.8, ns, hb, hb, false)), P);
      out += piece(ctx, path(sym([S([CX, 31.8], [53.2, 31.6], [55.9, 31.9]), S([55.9, 31.9], [56.6, 35.2], [57.3, 38.6], [58.2, 41.8]), S([58.2, 41.8], [54.6, 43.0], [CX, 43.3])])), R);
      out += line(path(symOpen(S([CX, 36.4], [53.4, 36.1], [56.5, 35.6])), true), P, { op: 0.8 });
    } else {
      const ns1 = [57.3 + l.e * 0.12, 38.8], ns2 = [58.1 + l.e * 0.12, 39.6];
      out += piece(ctx, path(closedRuns(g, hood ? 47.0 : 46.0, ns2, hb, hb, false)), P);
      if (!hood) out += piece(ctx, path(bandRuns(44.4, ns1, 46.0, ns2)), R, { flat: true });
      if (zip) {
        out += both(ctx, STAND, R, { flat: true });
        out += line(path([L([CX, 42.4], [CX, 56.8])], true), P, { w: 0.45, dash: '.45 .3' }) + `<rect x="49.4" y="55.6" width="1.2" height="2.2" rx=".3" fill="${METAL}" stroke="${LINE}" stroke-width=".2"/>`;
      }
    }
    if (hood) {
      out += both(ctx, [S([56.1, 30.6], [59.8, 30.0], [63.6, 33.4], [64.6 + l.e * 0.1, 38.8], [63.0 + l.e * 0.1, 43.6]), L([63.0 + l.e * 0.1, 43.6], [57.8, 46.8]), S([57.8, 46.8], [56.9, 41.0], [56.2, 35.0], [56.1, 30.6])], P);
      out += lines([S([52.4, 46.4], [52.7, 51.8], [52.9, 57.4])], P, { w: 0.42 }) + [52.9, 47.1].map(x => `<rect x="${f(x - 0.35)}" y="57.2" width=".7" height="1.6" rx=".2" fill="${P.det}"/>`).join('');
      out += piece(ctx, path(sym([L([CX, 80.6], [57.6, 80.6], [62.4, 96.0]), L([62.4, 96.0], [CX, 96.0])])), P, { flat: true });
    }
    out += hemBand(g, R, ctx, hb, hy, 0.5);
    const sl = sleeveRuns(g, 100.4, 0.9);
    out += both(ctx, sl.runs, P) + both(ctx, cuffRuns(g, 100.4, 105.4, 0.9, 0.45), R, { flat: true });
    return out;
  }
  function cardigan(ctx, l) {
    const it = l.it, P = paint(ctx, it, 'cardigan');
    const g = geo(l.e, { drop: l.drop, ws: wsOf(it.fit) + 0.4 });
    const R = withTex(ctx, P, 'rib');
    const ns = [57.0 + l.e * 0.12, 38.4], vy = 62.6, hb = 98.4, hy = 102.4, v = vEdge(vy, ns);
    let out = piece(ctx, path(vRuns(g, vy, ns, hb)), P);
    out += hemBand(g, R, ctx, hb, hy, 0.5);
    out += both(ctx, [S(...v), L(ns, [ns[0] + 1.5, ns[1] + 0.5]), S([ns[0] + 1.5, ns[1] + 0.5], [v[2][0] + 1.45, v[2][1] + 0.7], [v[1][0] + 1.3, v[1][1] + 1.0], [51.3, vy + 1.2]), L([51.3, vy + 1.2], [CX, vy])], R, { flat: true });
    out += piece(ctx, path([L([48.7, vy + 0.6], [51.3, vy + 0.6], [51.3, hy], [48.7, hy])]), R, { flat: true });
    [66.2, 73.4, 80.6, 87.8, 95.0].forEach(y => { out += button(P, CX, y, 0.55); });
    const sl = sleeveRuns(g, 100.4, 0.9);
    out += both(ctx, sl.runs, P) + both(ctx, cuffRuns(g, 100.4, 105.4, 0.9, 0.45), R, { flat: true });
    return out;
  }
  function blazer(ctx, l) {
    const it = l.it, P = paint(ctx, it, 'blazer'), e = l.e;
    const g = geo(e, { sb: 1.1, ws: /slim/i.test(it.fit || '') ? -0.7 : -0.3, fl: 1.4 });
    const B = [49.0, 81.4], ns = [56.4 + e * 0.1, 36.6], hsy = 113.0;
    const side = g.side(hsy), hs = side[side.length - 1];
    const roll = [B, [50.6, 72], [53.0, 59], [55.6, 47.6], [56.9, 40.2]];
    const panel = [S(...roll), L([56.9, 40.2], ns, g.sp), S(g.sp, ...side), S(hs, [61.8, 113.7], [55.4, 113.4]), S([55.4, 113.4], [52.7, 105], [50.7, 95.6], [49.4, 87.6], B)];
    const lap = [L([56.9, 40.2], [58.5, 45.9], [63.8 + e * 0.15, 49.2]), S([63.8 + e * 0.15, 49.2], [61.7, 58.6], [56.3, 70.4], [51.4, 79.2], B), S(...roll)];
    const col = [S(ns, [58.6, 37.2], [60.6, 39.0], [61.8 + e * 0.1, 41.8]), L([61.8 + e * 0.1, 41.8], [58.5, 45.9], [56.9, 40.2], ns)];
    const [lp, rp] = pair(panel), [ll, rl] = pair(lap), [lc, rc] = pair(col);
    const T = 'rgba(0,0,0,.07)';
    let out = piece(ctx, lp, P) + piece(ctx, ll, P, { tone: T }) + piece(ctx, lc, P, { flat: true });
    out += piece(ctx, rp, P) + piece(ctx, rl, P, { tone: T }) + piece(ctx, rc, P, { flat: true });
    const sl = sleeveRuns(g, 104.0, 0.9, { se: 0.2 });
    out += both(ctx, sl.runs, P);
    out += both(ctx, [L([56.2, 96.6], [65.4 + e * 0.3, 96.2], [65.5 + e * 0.3, 99.2], [56.3, 99.6])], P, { flat: true });
    out += piece(ctx, path([L([57.4, 58.4], [63.4, 57.6], [63.5, 59.4], [57.5, 60.2])]), P, { flat: true });
    out += button(P, 50.0, 82.0, 0.72) + button(P, 48.3, 91.6, 0.72);
    [0, 1, 2].forEach(i => { const y = 100.4 + i * 1.2, x = armO(y, sl.e) - 1.0; out += button(P, x, y, 0.3) + button(P, 100 - x, y, 0.3); });
    return out;
  }
  function jacket(ctx, l) {
    const it = l.it, P = paint(ctx, it, 'jacket'), s = txt(it), e = l.e;
    const type = /jeans|denim/.test(s) ? 'denim' : /bomber|blouson|college/.test(s) ? 'bomber' : /field|feld|safari|m-?65/.test(s) ? 'field' : /stepp|quilt/.test(s) ? 'quilt' : 'zip';
    const hy = { denim: 97.4, bomber: 99.8, field: 106.4, quilt: 103.2, zip: 102.6 }[type];
    const hb = type === 'denim' ? 93.6 : type === 'bomber' ? 95.8 : 0;
    const g = geo(e, { drop: l.drop, ws: 0.4, fl: type === 'field' ? 0.8 : 0.3 });
    const ns = [56.4 + e * 0.1, 36.8];
    const edge = y2 => [[53.2, 41.8], [53.9, 56], [54.8, 76], [54.8 + (y2 - 76) * 0.035, y2]];
    const by = hb || hy, E1 = edge(by);
    const stitch = type === 'denim' ? mix(P.base, '#D9B36C', 0.62) : P.det;
    let out = both(ctx, panelRuns(g, E1, ns, by, by - 0.2, false), P);
    if (hb) {
      const R = type === 'bomber' ? withTex(ctx, P, 'rib') : P, x1 = edgeX(edge(hy), hb), x2 = edgeX(edge(hy), hy), w1 = g.sx(hb), w2 = w1 - (type === 'bomber' ? 0.8 : 0.1);
      out += both(ctx, [L([x1, hb], [w1, hb], [w2, hy], [x2, hy])], R, { flat: true });
    }
    // Ärmel
    if (type === 'denim') { const sl = sleeveRuns(g, 100.6, 0.9); out += both(ctx, sl.runs, P) + both(ctx, cuffRuns(g, 100.6, 105.2, 0.9, 0.25), P, { flat: true }); }
    else if (type === 'bomber') { const sl = sleeveRuns(g, 100.2, 0.9); out += both(ctx, sl.runs, P) + both(ctx, cuffRuns(g, 100.2, 105.0, 0.9, 0.6), withTex(ctx, P, 'rib'), { flat: true }); }
    else { const sl = sleeveRuns(g, 104.8, 0.9); out += both(ctx, sl.runs, P); }
    // Kragen und Verschluss
    if (type === 'denim') out += both(ctx, collarRuns(1.25, e), P, { flat: true });
    else out += both(ctx, STAND, type === 'bomber' ? withTex(ctx, P, 'rib') : P, { flat: true });
    if (type !== 'denim') out += lines([S(...E1.map(p => [p[0] + 0.55, p[1] + 0.2]))], P, { w: 0.4, dash: '.45 .3', op: 0.9 });
    else [48, 60, 72, 84].forEach(y => { out += button(P, 100 - edgeX(E1, y) - 1.0, y, 0.5); });
    // Taschen und Nähte
    if (type === 'denim') {
      out += both(ctx, [L([56.4, 55.0], [62.8, 55.0], [62.8, 61.4], [56.4, 61.4])], P, { flat: true });
      out += both(ctx, [L([56.2, 52.4], [63.0, 52.4], [63.0, 55.0], [59.6, 56.6], [56.2, 55.0])], P, { flat: true });
      out += lines([L([57.2, 61.4], [57.6, hb])], P, { c: stitch, op: 0.9 }) + lines([L([62.4, 61.4], [62.8, hb])], P, { c: stitch, op: 0.9 });
      out += lines([L([55.8, 51.6], [g.sp[0] - 2.0, 47.0])], P, { c: stitch, op: 0.8 });
      out += button(P, 59.6, 55.6, 0.42) + button(P, 40.4, 55.6, 0.42);
    } else if (type === 'field') {
      out += both(ctx, [L([55.6, 53.0], [62.2, 53.0], [62.2, 61.6], [55.6, 61.6])], P, { flat: true }) + both(ctx, [L([55.4, 51.6], [62.4, 51.6], [62.4, 54.2], [55.4, 54.2])], P, { flat: true });
      out += both(ctx, [L([56.4, 92.0], [65.0 + e * 0.2, 92.0], [65.0 + e * 0.2, 103.4], [56.4, 103.4])], P, { flat: true }) + both(ctx, [L([56.2, 90.6], [65.2 + e * 0.2, 90.6], [65.2 + e * 0.2, 93.4], [56.2, 93.4])], P, { flat: true });
    } else if (type === 'zip' || type === 'quilt') {
      out += lines([L([58.2, 89.0], [60.4, 98.6])], P, { w: 0.42 });
    }
    return out;
  }
  function coat(ctx, it, e, hint) {
    const P = hint ? HINT : paint(ctx, it, 'coat'), s = txt(it);
    const trench = /trench/.test(s);
    const g = geo(e, { sb: 0.6, ws: 0.8, fl: 2.6 });
    const ns = [56.2 + e * 0.08, 36.2], hy = 138.6;
    const edge = [[54.2, 41.2], [54.9, 60], [56.3, 86], [58.0, 112], [59.6, hy]];
    const ly = 76.4, lx = edgeX(edge, ly);
    const lap = [L([54.2, 41.2], [56.1, 40.2], [58.0, 47.6], [64.6 + e * 0.12, 51.6]), S([64.6 + e * 0.12, 51.6], [62.8, 60.4], [59.0, 69.0], [lx + 0.05, ly]), S([lx, ly], [54.9, 60], [54.2, 41.2])];
    const col = [S(ns, [58.8, 36.8], [61.8, 39.0], [62.8 + e * 0.1, 42.6]), L([62.8 + e * 0.1, 42.6], [58.0, 47.6], [56.1, 40.2], ns)];
    const [lp, rp] = pair(panelRuns(g, edge, ns, hy, hy - 0.4, false)), [ll, rl] = pair(lap), [lc, rc] = pair(col);
    const T = 'rgba(0,0,0,.07)';
    const sl = sleeveRuns(g, 104.4, 0.9, { se: 0.5 });
    if (hint) {
      const dl = d => `<path d="${d}" fill="none" stroke="${HINT_LINE}" stroke-width="${LW * 0.8}" stroke-dasharray="1.2 1"/>`;
      return piece(ctx, lp, P) + piece(ctx, rp, P) + both(ctx, sl.runs, P) + [ll, rl, lc, rc].map(dl).join('');
    }
    let out = piece(ctx, lp, P) + piece(ctx, ll, P, { tone: T }) + piece(ctx, lc, P, { flat: true });
    out += piece(ctx, rp, P) + piece(ctx, rl, P, { tone: T }) + piece(ctx, rc, P, { flat: true });
    out += both(ctx, sl.runs, P);
    {
      out += both(ctx, [L([58.6, 99.4], [66.8 + e * 0.3, 99.0], [66.9 + e * 0.3, 101.8], [58.7, 102.2])], P, { flat: true });
      [64, 78, 92].forEach(y => { out += button(P, 100 - edgeX(edge, y) - 1.6, y, 0.75); });
      out += lines([L([sl.oe[0] - 0.3, sl.oe[1] - 4.2], [sl.ie[0] + 0.2, sl.ie[1] - 4.2])], P, { op: 0.6 });
      if (trench) {
        const bx = y => g.sx(y);
        out += both(ctx, [L([edgeX(edge, 83.6), 83.6], [bx(83.6) + 0.2, 83.6], [bx(87.2) + 0.2, 87.2], [edgeX(edge, 87.2), 87.2])], P, { flat: true });
        out += `<rect x="${f(edgeX(edge, 83.2) + 1.4)}" y="83.2" width="3.4" height="4.4" rx=".4" fill="none" stroke="${METAL}" stroke-width=".5"/>`;
      }
    }
    return out;
  }
  function winter(ctx, it, e, hint) {
    const P = hint ? HINT : paint(ctx, it, 'winter'), s = txt(it);
    const puffer = /daunen|puffer|stepp/.test(s);
    const hy = puffer ? 110.6 : 118.6;
    const g = geo(e, { drop: 0.8, ws: 1.2, fl: puffer ? 0.6 : 1.6 });
    const ns = [56.4 + e * 0.08, 36.4];
    const edge = [[53.6, 41.4], [54.3, 58], [55.2, 84], [55.2 + (hy - 84) * 0.04, hy]];
    let out = both(ctx, panelRuns(g, edge, ns, hy, hy - 0.3, false), P);
    const sl = sleeveRuns(g, 102.6, 0.9, { se: 0.4 });
    out += both(ctx, sl.runs, P) + both(ctx, cuffRuns(g, 102.6, 105.6, 0.9, 0.9, { se: 0.4 }), P, { flat: true });
    if (puffer) {
      for (let y = 49; y < hy - 2.5; y += 6.6) { const x1 = edgeX(edge, y) + 0.3, x2 = g.sx(y) - 0.3; out += lines([S([x1, y], [(x1 + x2) / 2, y + 0.55], [x2, y])], P, { op: 0.8 }); }
      for (let y = 55; y < 101; y += 6.6) { const x1 = armI(y + 0.9, sl.e) + 0.3, x2 = armO(y, sl.e) - 0.3; out += lines([S([x1, y + 0.9], [(x1 + x2) / 2, y + 0.9], [x2, y])], P, { op: 0.8 }); }
      out += both(ctx, [L([55.6, 32.6], [59.8, 33.6], [60.8, 40.6], [53.8, 42.4]), S([53.8, 42.4], [55.0, 37.4], [55.6, 32.6])], P, { flat: true });
    } else {
      out += both(ctx, [S([56.1, 30.4], [60.0, 29.6], [64.2, 33.2], [65.4 + e * 0.1, 38.8], [63.8 + e * 0.1, 43.8]), L([63.8 + e * 0.1, 43.8], [57.0, 44.8]), S([57.0, 44.8], [56.6, 40.0], [56.2, 35.0], [56.1, 30.4])], P);
      if (!hint) {
        out += lines([S([edgeX(edge, 93) + 0.3, 93], [g.sx(93) - 0.3, 92.6])], P, { op: 0.7, dash: '.6 .4' });
        out += both(ctx, [L([57.6, 99.6], [66.0 + e * 0.3, 99.2], [66.2 + e * 0.3, 109.2], [57.8, 109.6])], P, { flat: true });
        out += lines([L([57.6, 102.0], [66.1 + e * 0.3, 101.6])], P, { op: 0.8 });
      }
    }
    out += lines([S(...edge.map(p => [p[0] + 0.55, p[1] + 0.2]))], P, { w: 0.4, dash: '.45 .3', op: 0.9 });
    return out;
  }
  function drawTop(ctx, l) {
    switch (l.r) {
      case 'polo': return polo(ctx, l);
      case 'shirt': return shirt(ctx, l);
      case 'overshirt': return overshirt(ctx, l);
      case 'knit': return knit(ctx, l);
      case 'cardigan': return cardigan(ctx, l);
      case 'blazer': return blazer(ctx, l);
      case 'jacket': return jacket(ctx, l);
      case 'coat': return coat(ctx, l.it, l.e);
      case 'winter': return winter(ctx, l.it, l.e);
      default: return tee(ctx, l);
    }
  }

  // ---------- Hose ----------
  const PANTS = {
    Slim: { o: [[65.2, 0], [66.6, 90.5], [67.6, 96.5], [67.7, 104], [66.8, 120], [65.4, 141], [66.0, 156], [65.0, 172], [64.6, 189.6]], i: [[55.8, 189.8], [55.2, 172], [54.4, 156], [54.8, 141], [52.8, 121], [51.5, 113], [50, 108.6]] },
    Regular: { o: [[65.6, 0], [66.9, 90.5], [68.0, 96.5], [68.1, 104], [67.4, 120], [66.0, 141], [66.3, 156], [65.9, 172], [65.4, 189.6]], i: [[55.0, 189.8], [54.6, 172], [53.9, 156], [54.2, 141], [52.6, 121], [51.4, 113], [50, 108.6]] },
    Relaxed: { o: [[66.2, 0], [67.6, 90.5], [68.7, 96.5], [68.9, 104], [68.4, 120], [67.4, 141], [67.4, 156], [67.0, 172], [66.4, 189.6]], i: [[54.0, 189.8], [53.6, 172], [53.2, 156], [53.4, 141], [52.0, 121], [51.0, 113], [50, 108.8]] },
    Tapered: { o: [[65.8, 0], [67.2, 90.5], [68.3, 96.5], [68.5, 104], [67.6, 120], [66.0, 141], [66.1, 156], [65.3, 172], [64.6, 189.6]], i: [[55.8, 189.8], [55.0, 172], [54.0, 156], [54.2, 141], [52.4, 121], [51.2, 113], [50, 108.6]] }
  };
  const pantsFit = it => { const x = String(it.fit || ''); return /slim/i.test(x) ? 'Slim' : /tapered/i.test(x) ? 'Tapered' : /relaxed|oversized|weit|wide/i.test(x) ? 'Relaxed' : 'Regular'; };
  function pants(ctx, it) {
    const P = paint(ctx, it, 'bottom'), s = txt(it), jeans = it.cat === 'Jeans' || /jeans/.test(s);
    const F = PANTS[pantsFit(it)], wb = jeans ? 85.6 : 84.8;
    const o = F.o.map((p, i) => i === 0 ? [p[0], wb] : p), inn = F.i;
    const hO = o[o.length - 1], hI = inn[0], hem = S(hO, [(hO[0] + hI[0]) / 2, 190.6], hI);
    const leg = [S(...o.slice(2)), hem, S(...inn.slice(0, -1), [51.6, 101])];
    let extra = pair(leg).map(d => `<path d="${d}" fill="url(#${ctx.id}-sh)"/>`).join('');
    if (jeans) {
      ctx.defs.push(`<radialGradient id="${ctx.id}-fade"><stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`);
      extra += [60.4, 39.6].map(x => `<ellipse cx="${x}" cy="124" rx="4.4" ry="19" fill="url(#${ctx.id}-fade)"/>`).join('');
    }
    let out = piece(ctx, path(sym([L([CX, wb], o[0]), S(...o), hem, S(...inn)])), P, { flat: true, extra });
    const st = jeans ? { c: mix(P.base, '#D9B36C', 0.6), op: 0.9 } : { op: 0.75 };
    out += line(path(symOpen(S([CX, wb + 3.4], [CX + (o[0][0] - CX) * 0.55, wb + 3.45], [o[0][0] + 0.05, wb + 3.3])), true), P, st);
    out += lines([L([57.6, wb], [57.6, wb + 3.8])], P, { w: 0.45, op: 0.8 }) + lines([L([63.4, wb], [63.4, wb + 3.8])], P, { w: 0.45, op: 0.8 });
    out += line(path([S([51.9, wb + 3.4], [51.9, 98.8], [51.4, 102.4], [CX, 104.2])], true), P, st);
    if (jeans) {
      out += lines([S([57.6, wb + 3.4], [60.6, 90.8], [64.4, 92.2], [67.0, 92.6])], P, st);
      out += lines([S([53.8, 106.6], [56.2, 105.4], [58.8, 105.2])], P, { op: 0.35 }) + lines([S([54.2, 109.2], [56.4, 108.2], [58.6, 108.0])], P, { op: 0.3 });
    } else {
      out += lines([L([60.6, wb + 3.4], [66.6, 95.4])], P, { op: 0.75 });
      if ((it.f || 0) >= 3 || /stoff|anzug|bundfalte/.test(s)) out += lines([S([59.8, 99.0], [60.1, 140], [60.2, 189.0])], P, { op: 0.5 });
    }
    out += lines([S([hI[0] + 0.8, 188.2], [(hO[0] + hI[0]) / 2, 189.0], [hO[0] - 0.8, 188.2])], P, { op: 0.4 });
    return { svg: out, hw: o[0][0] - CX };
  }

  // ---------- Schuhe ----------
  function shoes(ctx, it) {
    const P = paint(ctx, it, 'shoes', true), s = txt(it), c = it.cat || '';
    const type = c === 'Sneaker' || /sneaker|turnschuh/.test(s) ? 'sneaker' : c === 'Loafer' || /loafer|mokassin/.test(s) ? 'loafer' : c === 'Stiefel' || /stiefel|boot/.test(s) ? 'boot' : 'derby';
    const soleTop = type === 'sneaker' ? 191.4 : type === 'boot' ? 192.0 : 192.7;
    const soleC = type === 'sneaker' ? (lum(P.base) > 0.75 ? '#FBFAF7' : '#F1EEE8') : mix(P.base, '#000000', 0.55);
    let out = '';
    [-1, 1].forEach(sd => {
      const X = dx => CX + sd * (10.2 + dx);
      const up = [S([X(-3.6), 186.3], [X(-4.5), 188.5], [X(-5.1), 190.8], [X(-5.25), soleTop + 0.3]), L([X(-5.25), soleTop + 0.3], [X(5.95), soleTop + 0.3]), S([X(5.95), soleTop + 0.3], [X(5.5), 190.6], [X(4.6), 188.3], [X(3.6), 186.3]), S([X(3.6), 186.3], [X(0), 185.7], [X(-3.6), 186.3])];
      const sole = [L([X(-5.55), soleTop], [X(6.25), soleTop], [X(6.35), 193.4]), S([X(6.35), 193.4], [X(5.95), 194.1]), L([X(5.95), 194.1], [X(-5.15), 194.1]), S([X(-5.15), 194.1], [X(-5.65), 193.3]), L([X(-5.65), 193.3], [X(-5.55), soleTop])];
      out += piece(ctx, path(up), P) + piece(ctx, path(sole), P, { fill: soleC, flat: true });
      if (type === 'sneaker') out += line(path([L([X(-5.4), 192.8], [X(6.1), 192.8])], true), P, { c: '#CFC9BF', w: 0.28 }) + line(path([S([X(-4.4), 190.4], [X(0.6), 189.9], [X(5.2), 190.4])], true), P, { op: 0.5 });
      else if (type === 'loafer') out += line(path([S([X(-3.0), 189.6], [X(-3.2), 191.3], [X(0.5), 192.1], [X(4.0), 191.3], [X(3.6), 189.6])], true), P, { op: 0.8 });
      else if (type === 'derby') out += line(path([S([X(-4.7), 191.2], [X(0.4), 190.5], [X(5.3), 191.2])], true), P, { op: 0.75 }) + `<ellipse cx="${f(X(1.0))}" cy="191.9" rx="2" ry=".42" fill="#fff" opacity=".22"/>`;
      else out += line(path([L([X(-5.3), 191.6], [X(6.0), 191.6])], true), P, { op: 0.6 });
    });
    return out;
  }
  function feet() {
    return [-1, 1].map(sd => { const X = dx => CX + sd * (10.2 + dx); const d = path([S([X(-3.4), 186.4], [X(-4.6), 189.6], [X(-5.0), 193.4]), L([X(-5.0), 193.4], [X(5.6), 193.4]), S([X(5.6), 193.4], [X(4.8), 189.4], [X(3.4), 186.4])]); return `<path d="${d}" fill="${SKIN}" stroke="${LINE}" stroke-width="${LW}" stroke-linejoin="round"/>`; }).join('');
  }

  // ---------- Accessoires ----------
  function belt(ctx, it, hw) {
    const P = paint(ctx, it, 'belt', true), y1 = 85.2, y2 = 88.4;
    const band = sym([L([CX, y1], [CX + hw + 0.3, y1 - 0.1], [CX + hw + 0.4, y2 - 0.1]), S([CX + hw + 0.4, y2 - 0.1], [58, y2 + 0.2], [CX, y2 + 0.25])]);
    return piece(ctx, path(band), P, { flat: true }) + `<rect x="47.9" y="84.7" width="4.2" height="4.3" rx=".5" fill="none" stroke="${METAL}" stroke-width=".55"/><path d="M50 85.2V88.5" stroke="${METAL}" stroke-width=".35"/>`;
  }
  function watch(ctx, it) {
    const P = paint(ctx, it, 'watch', true);
    return piece(ctx, path([L([75.5, 106.6], [80.8, 105.8], [81.0, 107.4], [75.6, 108.2])]), P, { flat: true }) + `<rect x="80.1" y="105.3" width="1.7" height="2.8" rx=".5" fill="${METAL}" stroke="${LINE}" stroke-width=".3"/>`;
  }
  function cap(ctx, it) {
    const P = paint(ctx, it, 'cap');
    let out = piece(ctx, path(sym([S([CX, 7.4], [54.6, 7.8], [57.6, 10.6], [58.6, 14.6], [58.9, 17.4]), L([58.9, 17.4], [CX, 17.6])])), P);
    out += line(path([L([CX, 7.6], [CX, 15.6])], true), P, { op: 0.8 }) + lines([S([CX, 7.6], [53.6, 9.6], [55.4, 15.9])], P, { op: 0.8 });
    out += piece(ctx, path(sym([S([CX, 15.6], [55.0, 15.6], [58.4, 16.4], [59.7, 17.9]), S([59.7, 17.9], [58.0, 19.9], [54.6, 20.9], [CX, 21.1])])), P, { tone: 'rgba(0,0,0,.08)' });
    return out + dot(CX, 7.4, 0.75, P.base, P.det);
  }
  function beanie(ctx, it) {
    const P = paint(ctx, it, 'beanie');
    return piece(ctx, path(sym([S([CX, 6.4], [55.3, 6.9], [58.5, 10.4], [59.2, 15.2]), L([59.2, 15.2], [CX, 15.2])])), P)
      + piece(ctx, path(sym([L([CX, 13.4], [59.4, 13.4], [59.5, 19.3]), S([59.5, 19.3], [55.2, 19.8], [CX, 19.9])])), withTex(ctx, P, 'rib'));
  }
  function scarf(ctx, it) {
    const P = paint(ctx, it, 'scarf');
    let out = piece(ctx, path([L([46.8, 43.2], [51.8, 43.6], [53.4, 63.8], [48.9, 64.6])]), P);
    out += piece(ctx, path(sym([S([CX, 36.4], [54.0, 35.4], [57.6, 35.8], [60.0, 38.0]), S([60.0, 38.0], [60.0, 40.8], [57.6, 43.0]), S([57.6, 43.0], [54.2, 44.6], [CX, 45.0])])), P);
    out += piece(ctx, path([L([43.6, 42.4], [48.4, 43.0], [49.4, 67.4], [44.8, 67.8])]), P);
    out += piece(ctx, path([S([44.2, 41.2], [47.6, 40.4], [49.8, 42.2], [49.0, 45.2], [45.4, 45.8], [43.6, 43.6])]), P, { flat: true });
    [45.6, 46.7, 47.8, 48.9].forEach((x, i) => { out += line(path([L([x, 67.7 - i * 0.04], [x + 0.1, 69.2])], true), P, { w: 0.35, c: P.base }); });
    return out;
  }

  // ---------- Gesamtbild ----------
  function parts(o) {
    o = o || {};
    const acc = (o.acc || []).filter(Boolean), find = r => acc.find(a => roleOf(a) === r), out = [];
    const head = find('beanie') || find('cap'); if (head) out.push({ slot: 'acc', it: head });
    const sc = find('scarf'); if (sc) out.push({ slot: 'acc', it: sc });
    if (o.outer) out.push({ slot: 'outer', it: o.outer }); else if (o.outerHint) out.push({ slot: 'outer', it: null, label: o.outerHint, hint: true });
    (o.tops || []).map((it, i) => ({ slot: 't' + i, it })).filter(p => p.it).reverse().forEach(p => out.push(p));
    const bt = find('belt'); if (bt) out.push({ slot: 'acc', it: bt });
    if (o.bottom) out.push({ slot: 'bottom', it: o.bottom });
    if (o.shoes) out.push({ slot: 'shoes', it: o.shoes });
    const wt = find('watch'); if (wt) out.push({ slot: 'acc', it: wt });
    return out;
  }
  function svg(o, opts) {
    o = o || {}; opts = opts || {};
    const ctx = newCtx(), layers = layersOf(o);
    const acc = (o.acc || []).filter(Boolean), find = r => acc.find(a => roleOf(a) === r);
    const wrap = (slot, it, inner) => `<g class="fig-part" data-slot="${slot}"${opts.attr ? ' ' + opts.attr(slot, it) : ''}>${it && (it.label || it.cat) ? `<title>${esc(named(it))}</title>` : ''}${inner}</g>`;
    let s = `<ellipse cx="50" cy="194.3" rx="21" ry="2.1" fill="${GROUND}"/>` + body();
    s += o.shoes ? wrap('shoes', o.shoes, shoes(ctx, o.shoes)) : feet();
    layers.filter(l => l.tucked).forEach(l => { s += wrap(l.slot, l.it, drawTop(ctx, l)); });
    let hw = 15.6;
    if (o.bottom) { const r = pants(ctx, o.bottom); hw = r.hw; s += wrap('bottom', o.bottom, r.svg); }
    const bt = find('belt'); if (bt && o.bottom) s += wrap('acc', bt, belt(ctx, bt, hw));
    layers.filter(l => !l.tucked).forEach(l => { s += wrap(l.slot, l.it, drawTop(ctx, l)); });
    const eLast = layers.length ? layers[layers.length - 1].e : 0.6;
    if (o.outer) {
      const r = roleOf(o.outer), e = Math.max((BASE_E[r] || 3.1) + fitAdj(o.outer.fit), eLast + (GAP[r] || 1));
      s += wrap('outer', o.outer, r === 'winter' ? winter(ctx, o.outer, e) : coat(ctx, o.outer, e));
    } else if (o.outerHint) {
      const w = /winter/i.test(o.outerHint), e = Math.max(w ? 4.2 : 3.1, eLast + 1);
      s += `<g class="fig-part fig-hint" data-slot="outer"${opts.attr ? ' ' + opts.attr('outer', null) : ''}><title>${esc(capF(o.outerHint))}, noch nicht erfasst</title>${w ? winter(ctx, { label: o.outerHint }, e, true) : coat(ctx, { label: o.outerHint }, e, true)}</g>`;
    }
    const sc = find('scarf'); if (sc) s += wrap('acc', sc, scarf(ctx, sc));
    const hd = find('beanie') || find('cap'); if (hd) s += wrap('acc', hd, roleOf(hd) === 'beanie' ? beanie(ctx, hd) : cap(ctx, hd));
    const wt = find('watch'); if (wt) s += wrap('acc', wt, watch(ctx, wt));
    const label = opts.label || 'Figur mit ' + parts(o).map(p => p.it ? named(p.it) : capF(p.label) + ' (noch nicht erfasst)').join(', ');
    return `<svg viewBox="0 0 100 200" class="fig${opts.cls ? ' ' + opts.cls : ''}" role="img" aria-label="${esc(label)}" focusable="false"><defs>${ctx.defs.join('')}</defs>${s}</svg>`;
  }

  const api = { svg, parts, roleOf, named, mix, lum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Figure = api;
})(typeof window !== 'undefined' ? window : this);
