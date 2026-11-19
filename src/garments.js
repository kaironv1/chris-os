/* Garment silhouettes as SVG, colored and textured per item. viewBox 0 0 120 120 */
(function (root) {
  'use strict';

  function hexToRgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  function rgbToHex(r) { return '#' + r.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(A.map((v, i) => v + (B[i] - v) * t)); }
  function lum(hex) { const [r, g, b] = hexToRgb(hex).map(v => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

  // Global texture patterns (dark ink for light fabrics, light ink for dark fabrics)
  function defs() {
    const p = (id, w, h, body, rot) => `<pattern id="${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse"${rot ? ` patternTransform="rotate(${rot})"` : ''}>${body}</pattern>`;
    const sets = [['d', 'rgba(20,20,20,.17)', 'rgba(20,20,20,.09)'], ['l', 'rgba(255,255,255,.16)', 'rgba(255,255,255,.08)']];
    let out = '';
    for (const [k, c, c2] of sets) {
      out += p('tx-cord-' + k, 3.2, 10, `<rect width="1.3" height="10" fill="${c}"/>`);
      out += p('tx-rib-' + k, 4, 10, `<rect width="1.6" height="10" fill="${c2}"/>`);
      out += p('tx-knit-' + k, 6, 6, `<path d="M0 1 L3 4 L6 1" fill="none" stroke="${c}" stroke-width="1"/>`);
      out += p('tx-denim-' + k, 4, 4, `<path d="M0 4 L4 0" stroke="${c}" stroke-width=".9"/>`, 0);
      out += p('tx-twill-' + k, 5, 5, `<path d="M0 5 L5 0" stroke="${c2}" stroke-width="1.2"/>`, 0);
      out += p('tx-linen-' + k, 4, 4, `<rect width="4" height=".7" fill="${c2}"/><rect width=".7" height="4" fill="${c2}"/>`);
      out += p('tx-grob-' + k, 7, 7, `<circle cx="1.5" cy="1.5" r=".7" fill="${c}"/><circle cx="5" cy="4.5" r=".6" fill="${c2}"/><circle cx="3" cy="6" r=".5" fill="${c}"/>`);
    }
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${out}</defs></svg>`;
  }

  // ---------- shapes ----------
  const S = {
    tee: {
      body: 'M46 17 Q60 28 74 17 L96 24 L109 45 L93 52 L86 46 L86 104 Q60 108 34 104 L34 46 L27 52 L11 45 L24 24 Z',
      det: (c) => `<path d="M46 17 Q60 28 74 17" fill="none" stroke="${c}" stroke-width="2.2"/><path d="M93 52 L86 46 M27 52 L34 46" stroke="${c}" stroke-width="1.2"/>`
    },
    shirt: {
      body: 'M47 14 L73 14 L95 22 L111 92 L100 97 L88 50 L88 107 Q60 113 32 107 L32 50 L20 97 L9 92 L25 22 Z',
      det: (c, it) => {
        let d = `<path d="M47 14 L60 27 L52 34 L43 19 Z M73 14 L60 27 L68 34 L77 19 Z" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="1.2" stroke-linejoin="round"/>`;
        d += `<path d="M60 27 L60 110" stroke="${c}" stroke-width="1.3"/>`;
        for (const y of [42, 56, 70, 84, 98]) d += `<circle cx="62.5" cy="${y}" r="1.5" fill="${c}"/>`;
        d += `<path d="M98 86 L109 82 M22 86 L11 82" stroke="${c}" stroke-width="1.3"/>`;
        if (it && it.cat === 'Business-Hemd') d += `<path d="M44 46 L54 46" stroke="${c}" stroke-width="1" opacity=".6"/>`;
        return d;
      }
    },
    polo: {
      body: 'M47 15 L73 15 L95 22 L110 90 L100 95 L88 50 L88 106 Q60 110 32 106 L32 50 L20 95 L10 90 L25 22 Z',
      det: (c) => `<path d="M47 15 L60 25 L53 31 L44 19 Z M73 15 L60 25 L67 31 L76 19 Z" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="1.2"/><path d="M60 25 L60 50" stroke="${c}" stroke-width="1.3"/><circle cx="62.5" cy="34" r="1.4" fill="${c}"/><circle cx="62.5" cy="44" r="1.4" fill="${c}"/><path d="M33 100 L87 100 M100 89 L109 85 M20 89 L11 85" stroke="${c}" stroke-width="1.2" opacity=".8"/>`
    },
    overshirt: {
      body: 'M46 13 L74 13 L97 21 L112 90 L101 95 L89 50 L90 108 L30 108 L31 50 L19 95 L8 90 L23 21 Z',
      det: (c) => `<path d="M46 13 L60 26 L51 33 L42 18 Z M74 13 L60 26 L69 33 L78 18 Z" fill="${c}" fill-opacity=".22" stroke="${c}" stroke-width="1.2"/><path d="M60 26 L60 108" stroke="${c}" stroke-width="1.3"/><rect x="37" y="40" width="16" height="15" rx="1.5" fill="none" stroke="${c}" stroke-width="1.2"/><rect x="67" y="40" width="16" height="15" rx="1.5" fill="none" stroke="${c}" stroke-width="1.2"/><path d="M37 44 L53 44 M67 44 L83 44" stroke="${c}" stroke-width="1.2"/>` + [42, 58, 74, 90].map(y => `<circle cx="62.5" cy="${y}" r="1.6" fill="${c}"/>`).join('')
    },
    knit: {
      body: 'M45 16 Q60 26 75 16 L95 22 L111 90 L101 96 L89 50 L89 104 L31 104 L31 50 L19 96 L9 90 L25 22 Z',
      det: (c) => `<path d="M45 16 Q60 26 75 16" fill="none" stroke="${c}" stroke-width="3"/><path d="M31 97 L89 97" stroke="${c}" stroke-width="1.3"/><path d="M98 87 L110 83 M22 87 L10 83" stroke="${c}" stroke-width="1.3"/>`
    },
    cardigan: {
      body: 'M45 15 L75 15 L95 22 L111 90 L101 96 L89 50 L89 106 L31 106 L31 50 L19 96 L9 90 L25 22 Z',
      det: (c) => `<path d="M45 15 L60 50 L75 15" fill="none" stroke="${c}" stroke-width="2"/><path d="M60 50 L60 106" stroke="${c}" stroke-width="1.3"/>` + [60, 72, 84, 96].map(y => `<circle cx="62.5" cy="${y}" r="1.6" fill="${c}"/>`).join('') + `<path d="M31 99 L89 99" stroke="${c}" stroke-width="1.2"/>`
    },
    blazer: {
      body: 'M45 13 L75 13 L97 19 L112 94 L101 98 L90 50 L91 110 L29 110 L30 50 L19 98 L8 94 L23 19 Z',
      det: (c) => `<path d="M45 13 L55 50 L60 64 L65 50 L75 13" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M45 13 L41 30 L49 34 L55 50 M75 13 L79 30 L71 34 L65 50" fill="none" stroke="${c}" stroke-width="1.2"/><circle cx="60" cy="74" r="2" fill="${c}"/><circle cx="60" cy="88" r="2" fill="${c}"/><path d="M36 86 L50 86 M70 86 L84 86 M72 40 L82 40" stroke="${c}" stroke-width="1.2"/>`
    },
    jacket: {
      body: 'M44 14 L76 14 L97 21 L111 88 L101 92 L90 52 L90 100 L30 100 L30 52 L19 92 L9 88 L23 21 Z',
      det: (c) => `<path d="M44 14 Q60 22 76 14" fill="none" stroke="${c}" stroke-width="3"/><path d="M60 19 L60 100" stroke="${c}" stroke-width="1.6"/><path d="M30 93 L90 93 M98 82 L110 78 M22 82 L10 78" stroke="${c}" stroke-width="2.4" opacity=".7"/>`
    },
    coat: {
      body: 'M45 10 L75 10 L96 17 L110 96 L100 100 L90 50 L93 116 L27 116 L30 50 L20 100 L10 96 L24 17 Z',
      det: (c) => `<path d="M45 10 L54 48 L60 58 L66 48 L75 10" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M45 10 L40 28 L48 32 L54 48 M75 10 L80 28 L72 32 L66 48" fill="none" stroke="${c}" stroke-width="1.2"/><path d="M60 58 L60 116" stroke="${c}" stroke-width="1.2"/><circle cx="66" cy="68" r="2" fill="${c}"/><circle cx="66" cy="84" r="2" fill="${c}"/><circle cx="66" cy="100" r="2" fill="${c}"/><path d="M36 82 L48 82 M72 82 L84 82" stroke="${c}" stroke-width="1.2"/>`
    },
    winter: {
      body: 'M42 10 L78 10 L98 20 L112 92 L101 96 L91 54 L92 108 Q60 114 28 108 L29 54 L19 96 L8 92 L22 20 Z',
      det: (c) => `<path d="M42 10 L42 22 Q60 28 78 22 L78 10" fill="none" stroke="${c}" stroke-width="1.6"/><path d="M60 24 L60 110" stroke="${c}" stroke-width="1.6"/><path d="M30 40 Q60 45 90 40 M30 56 Q60 61 90 56 M30 72 Q60 77 90 72 M30 88 Q60 93 91 88 M96 44 L104 42 M96 62 L107 59 M98 80 L109 76 M24 44 L16 42 M24 62 L13 59 M22 80 L11 76" fill="none" stroke="${c}" stroke-width="1.2" opacity=".75"/>`
    },
    bottom: {
      body: 'M36 9 L84 9 L89 113 L67 113 L60 46 L53 113 L31 113 Z',
      det: (c, it) => {
        let d = `<path d="M35.5 17 L84.5 17" stroke="${c}" stroke-width="1.4"/><path d="M60 17 L60 40" stroke="${c}" stroke-width="1.2"/>`;
        d += `<path d="M44 9 L44 17 M76 9 L76 17" stroke="${c}" stroke-width="1.4"/>`;
        if (it && it.cat === 'Jeans') d += `<path d="M37 21 Q46 29 44 35 M83 21 Q74 29 76 35" fill="none" stroke="${c}" stroke-width="1.2"/><path d="M40 112 L41 60 M80 112 L79 60" stroke="${c}" stroke-width=".9" stroke-dasharray="2 2" opacity=".6"/>`;
        else d += `<path d="M38 22 L46 30 M82 22 L74 30" stroke="${c}" stroke-width="1.2"/>`;
        if (it && /bügelfalte/i.test(it.details || '')) d += `<path d="M44 24 L42 112 M76 24 L78 112" stroke="${c}" stroke-width="1" opacity=".7"/>`;
        return d;
      }
    },
    sneaker: {
      body: 'M14 86 L12 67 Q13 55 23 52 Q30 56 37 58 L47 45 Q57 46 61 52 Q75 58 89 64 Q104 68 110 77 Q112 84 106 86 Z',
      det: (c) => `<rect x="9" y="84" width="104" height="11" rx="5" fill="#F3F3EF" stroke="var(--garment-line)" stroke-width="1.2"/><path d="M11 90 L111 90" stroke="rgba(0,0,0,.12)" stroke-width="1"/><path d="M51 51 L57 59 M58 53 L64 61 M65 56 L71 64 M72 59 L78 66" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><path d="M24 79 Q52 70 92 75" fill="none" stroke="${c}" stroke-width="1.2" opacity=".7"/><path d="M14 70 L22 70" stroke="${c}" stroke-width="1.4" opacity=".6"/>`
    },
    loafer: {
      body: 'M12 86 Q12 70 29 66 Q50 64 72 60 Q98 62 108 76 Q111 85 104 88 L12 88 Z',
      det: (c) => `<path d="M48 64 Q61 74 76 62" fill="none" stroke="${c}" stroke-width="1.8"/><path d="M58 61 Q82 59 98 70" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 2" opacity=".8"/><path d="M11 89 L105 89" stroke="${c}" stroke-width="3"/><rect x="12" y="87" width="24" height="9" rx="1.5" fill="${c}"/>`
    },
    dress: {
      body: 'M12 86 Q11 66 29 62 L47 60 Q60 51 74 57 Q100 61 108 76 Q111 85 104 88 L12 88 Z',
      det: (c) => `<path d="M50 59 L58 66 M55 56 L63 63 M61 55 L68 61" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><path d="M84 60 Q91 70 90 86" fill="none" stroke="${c}" stroke-width="1.2"/><path d="M11 89 L105 89" stroke="${c}" stroke-width="3"/><rect x="12" y="87" width="24" height="9" rx="1.5" fill="${c}"/>`
    },
    boot: {
      body: 'M30 22 L58 22 L60 64 Q90 66 105 78 Q109 87 100 89 L18 89 Q14 70 28 64 Z',
      det: (c) => `<path d="M30 30 L58 30" stroke="${c}" stroke-width="1.3"/><path d="M18 89 L100 89" stroke="${c}" stroke-width="2.6"/><rect x="18" y="88" width="22" height="7" rx="1.5" fill="${c}" opacity=".8"/>`
    },
    cap: {
      body: 'M24 76 Q24 40 60 38 Q96 40 96 76 Z',
      det: (c, it, fill) => `<path d="M58 76 L112 80 Q104 92 60 88 Z" fill="${fill}" stroke="var(--garment-line)" stroke-width="1.4"/><path d="M60 38 L60 76 M42 42 Q36 58 38 76 M78 42 Q84 58 82 76" fill="none" stroke="${c}" stroke-width="1.2"/><circle cx="60" cy="38" r="3" fill="${c}"/>`
    },
    beanie: { body: 'M26 80 Q24 34 60 32 Q96 34 94 80 Z', det: (c) => `<rect x="24" y="72" width="72" height="14" rx="3" fill="${c}" opacity=".35"/><path d="M34 74 L34 86 M46 74 L46 86 M58 74 L58 86 M70 74 L70 86 M82 74 L82 86" stroke="${c}" stroke-width="1"/>` },
    scarf: { body: 'M30 20 Q60 34 90 20 L94 34 Q70 48 66 56 L74 108 L56 108 L52 56 Q42 46 26 34 Z', det: (c) => `<path d="M58 100 L58 108 M64 100 L64 108 M70 100 L70 108" stroke="${c}" stroke-width="1.2"/>` },
    belt: { body: 'M8 52 L112 52 L112 68 L8 68 Z', det: (c) => `<rect x="20" y="46" width="22" height="28" rx="3" fill="none" stroke="${c}" stroke-width="3"/><path d="M31 52 L31 68" stroke="${c}" stroke-width="2.4"/><circle cx="58" cy="60" r="1.6" fill="${c}"/><circle cx="68" cy="60" r="1.6" fill="${c}"/><circle cx="78" cy="60" r="1.6" fill="${c}"/>` },
    watch: { body: 'M48 10 L72 10 L72 110 L48 110 Z', det: (c) => `<circle cx="60" cy="60" r="20" fill="#F4F4F0" stroke="${c}" stroke-width="4"/><path d="M60 60 L60 48 M60 60 L68 64" stroke="#333" stroke-width="2" stroke-linecap="round"/>` }
  };

  function shapeKey(it) {
    switch (it.cat) {
      case 'T-Shirt': return 'tee';
      case 'Kragenshirt': return 'polo';
      case 'Hemd': case 'Business-Hemd': return 'shirt';
      case 'Overshirt': return 'overshirt';
      case 'Pullover': return 'knit';
      case 'Cardigan': return 'cardigan';
      case 'Sakko': return 'blazer';
      case 'Jacke': return 'jacket';
      case 'Mantel': return 'coat';
      case 'Winterjacke': return 'winter';
      case 'Jeans': case 'Stoffhose': return 'bottom';
      case 'Sneaker': return 'sneaker';
      case 'Loafer': return 'loafer';
      case 'Business-Schuhe': return 'dress';
      case 'Stiefel': return 'boot';
      case 'Kappe': return 'cap';
      case 'Mütze': return 'beanie';
      case 'Schal': return 'scarf';
      case 'Gürtel': return 'belt';
      case 'Uhr': return 'watch';
      default: return 'tee';
    }
  }

  function textureOf(it) {
    const t = (it.texture || '').toLowerCase(), m = (it.material || []).join(' ').toLowerCase();
    if (/cord/.test(t)) return 'cord';
    if (it.cat === 'Jeans' || /denim/.test(t)) return 'denim';
    if (/leinen/.test(m)) return 'linen';
    if (/gerippt/.test(t)) return 'rib';
    if (it.cat === 'Pullover' || it.cat === 'Cardigan') return /grob|wollig/.test(t) ? 'knit' : 'rib';
    if (it.cat === 'Kragenshirt') return 'rib';
    if (/grob/.test(t)) return 'grob';
    if (/dick/.test(t)) return 'twill';
    return null;
  }

  let uid = 0;
  function svg(it, opts) {
    opts = opts || {};
    const key = shapeKey(it);
    const sh = S[key];
    const fill = it.hex || '#999999';
    const dark = lum(fill) < 0.32;
    const detail = dark ? mix(fill, '#ffffff', 0.32) : mix(fill, '#000000', 0.28);
    const tex = textureOf(it);
    const id = 'g' + (++uid);
    let extraDefs = '';
    let patFill = '';
    const second = it.hex2 || (dark ? mix(fill, '#ffffff', 0.7) : mix(fill, '#000000', 0.55));
    if (it.pattern === 'kariert') {
      extraDefs = `<pattern id="${id}p" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${fill}"/><rect width="12" height="4" fill="${second}" opacity=".55"/><rect width="4" height="12" fill="${second}" opacity=".55"/><rect width="4" height="4" fill="${second}" opacity=".9"/></pattern>`;
      patFill = `url(#${id}p)`;
    } else if (it.pattern === 'gepunktet') {
      extraDefs = `<pattern id="${id}p" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${fill}"/><circle cx="3" cy="3" r=".9" fill="${second}"/></pattern>`;
      patFill = `url(#${id}p)`;
    } else if (it.pattern === 'gestreift') {
      extraDefs = `<pattern id="${id}p" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="${fill}"/><rect width="6" height="1.6" fill="${second}"/></pattern>`;
      patFill = `url(#${id}p)`;
    } else if (it.hex2 && /gerippt/i.test(it.texture || '')) {
      extraDefs = `<pattern id="${id}p" width="5" height="10" patternUnits="userSpaceOnUse"><rect width="5" height="10" fill="${fill}"/><rect width="1.4" height="10" fill="${second}" opacity=".6"/></pattern>`;
      patFill = `url(#${id}p)`;
    }
    const outline = it.unknownColor ? 'stroke-dasharray="4 3"' : '';
    const label = opts.label || it.label || '';
    let s = `<svg viewBox="0 0 120 120" role="img" aria-label="${esc(label)}" focusable="false">`;
    if (extraDefs) s += `<defs>${extraDefs}</defs>`;
    const lift = ['sneaker','loafer','dress','boot'].includes(key) ? ' transform="translate(0,-10) scale(1)"' : '';
    s += `<g${lift}>`;
    s += `<path d="${sh.body}" fill="${patFill || fill}" stroke="var(--garment-line)" stroke-width="1.5" stroke-linejoin="round" ${outline}/>`;
    if (tex && !patFill) s += `<path d="${sh.body}" fill="url(#tx-${tex}-${dark ? 'l' : 'd'})"/>`;
    s += sh.det(detail, it, fill);
    if (it.print) s += `<circle cx="72" cy="40" r="4.5" fill="none" stroke="${detail}" stroke-width="1.4"/>`;
    s += `</g></svg>`;
    return s;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  const api = { svg, defs, shapeKey, mix, lum };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Garments = api;
})(typeof window !== 'undefined' ? window : globalThis);
