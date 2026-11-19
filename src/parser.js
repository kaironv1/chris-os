/* Wardrobe + outfit parsing, XLSX reading. Shared by the app (browser) and the seed builder (Node). */
(function (root) {
  'use strict';

  // ---------- Colors ----------
  // name: display name, hex: main color, hex2: secondary (pattern), fam: blue|earth|neutral|accent, nl: works like a neutral
  const COLORS = {
    'weiß':            { name: 'Weiß', hex: '#F3F2EE', fam: 'neutral', nl: 1 },
    'hellgrau':        { name: 'Hellgrau', hex: '#B9BCC0', fam: 'neutral', nl: 1 },
    'grau':            { name: 'Grau', hex: '#8D9096', fam: 'neutral', nl: 1 },
    'grau verwaschen': { name: 'Grau verwaschen', hex: '#959894', fam: 'neutral', nl: 1 },
    'dunkelgrau':      { name: 'Dunkelgrau', hex: '#4B4F55', fam: 'neutral', nl: 1 },
    'dunkleres grau':  { name: 'Dunkelgrau', hex: '#55595F', fam: 'neutral', nl: 1 },
    'anthrazit':       { name: 'Anthrazit', hex: '#3A3D42', fam: 'neutral', nl: 1 },
    'schwarz':         { name: 'Schwarz', hex: '#1F1F21', fam: 'neutral', nl: 1 },
    'angehelltes schwarz': { name: 'Schwarz verwaschen', hex: '#3B3C40', fam: 'neutral', nl: 1 },
    'schwarz-weiß':    { name: 'Schwarz-Weiß', hex: '#2B2C2F', hex2: '#E6E6E2', fam: 'neutral', nl: 1 },
    'schwarz-grau':    { name: 'Schwarz-Grau', hex: '#2E2F33', hex2: '#9A9CA1', fam: 'neutral', nl: 1 },
    'braungrau':       { name: 'Braungrau', hex: '#7A6E62', fam: 'earth', nl: 1 },
    'beige':           { name: 'Beige', hex: '#CDBA98', fam: 'earth', nl: 1 },
    'hellbeige':       { name: 'Hellbeige', hex: '#E4D8C3', fam: 'earth', nl: 1 },
    'khaki':           { name: 'Khaki', hex: '#9B8E66', fam: 'earth', nl: 1 },
    'hellbraun':       { name: 'Hellbraun', hex: '#A5805A', fam: 'earth' },
    'braun':           { name: 'Braun', hex: '#6A4A34', fam: 'earth' },
    'dunkelbraun':     { name: 'Dunkelbraun', hex: '#4A3426', fam: 'earth' },
    'cognac':          { name: 'Cognac', hex: '#8E5531', fam: 'earth' },
    'olivgrün':        { name: 'Olivgrün', hex: '#6B6B3E', fam: 'earth' },
    'dunkelgrün':      { name: 'Dunkelgrün', hex: '#2F4A3A', fam: 'earth' },
    'grün':            { name: 'Grün', hex: '#4E7A55', fam: 'accent' },
    'hellgrün':        { name: 'Hellgrün', hex: '#A9C59A', fam: 'accent' },
    'weinrot':         { name: 'Weinrot', hex: '#6E2430', fam: 'accent' },
    'rot':             { name: 'Rot', hex: '#A3302F', fam: 'accent' },
    'hellblau':        { name: 'Hellblau', hex: '#A9C4DE', fam: 'blue' },
    'jeansblau':       { name: 'Jeansblau', hex: '#4F6F98', fam: 'blue' },
    'blau':            { name: 'Blau', hex: '#3E5C8A', fam: 'blue' },
    'dunkleres blau':  { name: 'Dunkelblau', hex: '#2D4270', fam: 'blue' },
    'dunkelblau':      { name: 'Dunkelblau', hex: '#233150', fam: 'blue', nl: 1 },
    'navy':            { name: 'Navy', hex: '#1F2A44', fam: 'blue', nl: 1 },
    'sehr dunkles blau': { name: 'Nachtblau', hex: '#1C2438', fam: 'blue', nl: 1 },
    'unbekannt':       { name: 'Farbe offen', hex: '#8C877F', fam: 'neutral', nl: 1, unknown: 1 }
  };

  const ALIASES = [
    [/angehellt[\wäöüß]*\s+schwarz|schwarz\s+verwaschen|washed\s+black/, 'angehelltes schwarz'],
    [/schwarz\s*-?\s*wei(ß|ss)|s\s*\/\s*w/, 'schwarz-weiß'],
    [/schwarz\s*-?\s*grau/, 'schwarz-grau'],
    [/grau\s+verwaschen|verwaschen[\wäöüß]*\s+grau/, 'grau verwaschen'],
    [/sehr\s+dunkl[\wäöüß]*\s+blau|nachtblau|marine/, 'sehr dunkles blau'],
    [/dunkler[\wäöüß]*\s+blau/, 'dunkleres blau'],
    [/dunkler[\wäöüß]*\s+grau/, 'dunkleres grau'],
    [/braun\s*-?\s*grau|taupe/, 'braungrau'],
    [/hell\s*-?\s*beige|creme|ecru|offwhite|off-white/, 'hellbeige'],
    [/hell\s*-?\s*grau/, 'hellgrau'], [/dunkel\s*-?\s*grau/, 'dunkelgrau'], [/anthrazit/, 'anthrazit'],
    [/hell\s*-?\s*blau/, 'hellblau'], [/jeans\s*-?\s*blau|denim/, 'jeansblau'],
    [/dunkel\s*-?\s*blau/, 'dunkelblau'], [/navy/, 'navy'],
    [/hell\s*-?\s*braun|camel/, 'hellbraun'], [/dunkel\s*-?\s*braun/, 'dunkelbraun'], [/cognac/, 'cognac'],
    [/oliv/, 'olivgrün'], [/dunkel\s*-?\s*grün|tannengrün/, 'dunkelgrün'], [/hell\s*-?\s*grün|mint|salbei/, 'hellgrün'],
    [/wein\s*-?\s*rot|bordeaux/, 'weinrot'], [/khaki/, 'khaki'], [/beige|sand/, 'beige'],
    [/wei(ß|ss)/, 'weiß'], [/schwarz/, 'schwarz'], [/grau/, 'grau'], [/braun/, 'braun'],
    [/blau/, 'blau'], [/grün/, 'grün'], [/rot/, 'rot']
  ];
  const COLOR_HINT = /(wei(ß|ss)|schwarz|grau|blau|grün|braun|beige|rot|khaki|oliv|navy|creme|anthrazit|sand|bordeaux|taupe|camel|cognac|denim|ecru)/;

  function canonColor(raw) {
    const s = String(raw || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!s) return null;
    for (const [re, key] of ALIASES) if (re.test(s)) return key;
    return null;
  }
  function colorInfo(key) { return COLORS[key] || COLORS['unbekannt']; }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  // Perceived lightness 0..100 (CIE L*)
  function lightness(hex) {
    const lin = hexToRgb(hex).map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    const Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    return Y > 0.008856 ? 116 * Math.cbrt(Y) - 16 : 903.3 * Y;
  }

  // ---------- Categories ----------
  const CATS = {
    'T-Shirt': { role: 'tee', group: 'Oberteile', f: 2.0, w: 1.0 },
    'Kragenshirt': { role: 'polo', group: 'Oberteile', f: 3.0, w: 1.6 },
    'Hemd': { role: 'shirt', group: 'Oberteile', f: 3.0, w: 1.4 },
    'Business-Hemd': { role: 'shirt', group: 'Oberteile', f: 4.0, w: 1.3 },
    'Overshirt': { role: 'overshirt', group: 'Oberteile', f: 2.8, w: 2.4 },
    'Pullover': { role: 'knit', group: 'Strick', f: 3.0, w: 2.2 },
    'Cardigan': { role: 'cardigan', group: 'Strick', f: 3.2, w: 2.0 },
    'Sakko': { role: 'blazer', group: 'Jacken', f: 4.2, w: 2.0 },
    'Jacke': { role: 'jacket', group: 'Jacken', f: 2.5, w: 2.5 },
    'Mantel': { role: 'coat', group: 'Jacken', f: 3.8, w: 4.0 },
    'Winterjacke': { role: 'winter', group: 'Jacken', f: 2.5, w: 6.0 },
    'Jeans': { role: 'bottom', group: 'Hosen', f: 2.2, w: 1.6 },
    'Stoffhose': { role: 'bottom', group: 'Hosen', f: 3.2, w: 1.3 },
    'Sneaker': { role: 'shoes', group: 'Schuhe', f: 2.6, w: 0 },
    'Loafer': { role: 'shoes', group: 'Schuhe', f: 3.3, w: 0 },
    'Business-Schuhe': { role: 'shoes', group: 'Schuhe', f: 4.0, w: 0 },
    'Stiefel': { role: 'shoes', group: 'Schuhe', f: 3.0, w: 0 },
    'Kappe': { role: 'cap', group: 'Accessoires', f: 1.5, w: 0 },
    'Mütze': { role: 'beanie', group: 'Accessoires', f: 2.0, w: 0 },
    'Schal': { role: 'scarf', group: 'Accessoires', f: 3.0, w: 0 },
    'Gürtel': { role: 'belt', group: 'Accessoires', f: 3.0, w: 0 },
    'Uhr': { role: 'watch', group: 'Accessoires', f: 3.0, w: 0 }
  };
  const CAT_ORDER = Object.keys(CATS);

  function detectCat(text) {
    const s = String(text || '').toLowerCase();
    if (/kragenshirt|polo/.test(s)) return 'Kragenshirt';
    if (/overshirt|hemdjacke|shacket/.test(s)) return 'Overshirt';
    if (/business\s*-?\s*hemd|businesshemd|anzughemd|bürohemd/.test(s)) return 'Business-Hemd';
    if (/hemd|bluse/.test(s)) return 'Hemd';
    if (/t\s*-?\s*shirt|tshirt|longsleeve|shirt/.test(s)) return 'T-Shirt';
    if (/cardigan|strickjacke/.test(s)) return 'Cardigan';
    if (/pullover|pulli|sweater|strick|hoodie|sweat/.test(s)) return 'Pullover';
    if (/sakko|blazer|jackett/.test(s)) return 'Sakko';
    if (/winterjacke|daunen|parka|puffer/.test(s)) return 'Winterjacke';
    if (/mantel|trench/.test(s)) return 'Mantel';
    if (/jacke|bomber|blouson/.test(s)) return 'Jacke';
    if (/jeans/.test(s)) return 'Jeans';
    if (/hose|chino|pants/.test(s)) return 'Stoffhose';
    if (/sneaker|turnschuh/.test(s)) return 'Sneaker';
    if (/loafer|mokassin/.test(s)) return 'Loafer';
    if (/boot|stiefel|chelsea/.test(s)) return 'Stiefel';
    if (/schuh|derby|oxford|budapester/.test(s)) return 'Business-Schuhe';
    if (/kappe|cap\b|basecap/.test(s)) return 'Kappe';
    if (/mütze|beanie/.test(s)) return 'Mütze';
    if (/schal/.test(s)) return 'Schal';
    if (/gürtel/.test(s)) return 'Gürtel';
    if (/uhr\b|armbanduhr/.test(s)) return 'Uhr';
    return null;
  }

  // ---------- Derivation ----------
  function noun(it) {
    const t = it.texture || '', m = (it.material || []).join(' ').toLowerCase();
    if (it.cat === 'Hemd') {
      if (/cord/i.test(t)) return 'Cordhemd';
      if (/leinen/.test(m)) return 'Leinenhemd';
      if (/denim/i.test(t)) return 'Jeanshemd';
      if (it.pattern === 'kariert') return 'Karohemd';
      return 'Hemd';
    }
    if (it.cat === 'Stoffhose') {
      if (/leinen/.test(m)) return 'Leinenhose';
      if (/cord/i.test(t)) return 'Cordhose';
      return 'Stoffhose';
    }
    return it.cat;
  }

  function derive(it) {
    const cat = CATS[it.cat] || CATS['T-Shirt'];
    const c = colorInfo(it.colorKey);
    it.role = cat.role;
    it.group = cat.group;
    it.hex = it.hex || c.hex;
    if (c.hex2 && !it.hex2) it.hex2 = c.hex2;
    it.fam = c.fam; it.nl = !!c.nl;
    it.colorName = it.colorName || c.name;
    it.L = Math.round(lightness(it.hex));
    const t = (it.texture || '').toLowerCase();
    const m = (it.material || []).join(' ').toLowerCase();
    const fit = (it.fit || '').toLowerCase();
    // formality
    let f = cat.f;
    if (it.cat === 'T-Shirt' && /oversized/.test(fit)) f -= 0.2;
    if (it.cat === 'Hemd') {
      if (/leinen/.test(m) || /cord/.test(t)) f -= 0.2;
      if (it.pattern === 'kariert') f -= 0.5;
      if (/relaxed/.test(fit)) f -= 0.3;
      if (/denim/.test(t)) f -= 0.3;
    }
    if (it.cat === 'Business-Hemd' && it.pattern && it.pattern !== 'uni') f -= 0.4;
    if (it.cat === 'Pullover') { if (/grob/.test(t)) f -= 0.2; if (/fein|gerippt/.test(t)) f += 0.2; }
    if (it.cat === 'Jeans' && it.L < 30) f += 0.3;
    if (it.cat === 'Stoffhose') {
      if (/bügelfalte/i.test(it.details || '') || /(?<!baum)wolle|wool/.test(m)) f += 0.7;
      if (/grob/.test(t) || /leinen/.test(m)) f -= 0.6;
      if (it.pattern && it.pattern !== 'uni') f -= 0.2;
    }
    if (it.f == null) it.f = Math.round(f * 10) / 10;
    // warmth
    let w = cat.w;
    if (it.cat === 'T-Shirt' && (/grob|dick/.test(t))) w = 1.2;
    if (it.cat === 'Hemd' || it.cat === 'Business-Hemd') {
      if (/leinen/.test(m)) w = 0.9;
      else if (/cord/.test(t)) w = 2.2;
      else if (/sehr dick/.test(t)) w = 2.6;
      else if (/dick/.test(t)) w = 2.0;
      else if (/grob/.test(t)) w = 1.7;
    }
    if (it.cat === 'Pullover') {
      if (/grob/.test(t)) w = 2.8; else if (/wollig/.test(t)) w = 2.6; else if (/gerippt/.test(t)) w = 2.3; else if (/fein/.test(t)) w = 2.0;
    }
    if (it.role === 'bottom') {
      if (/leinen/.test(m)) w = 0.7;
      else if (/cord/.test(t)) w = 2.2;
      else if (/sehr dick/.test(t) || /(?<!baum)wolle/.test(m)) w = 2.2;
      else if (/wool/.test(m)) w = 1.8;
      else if (/grob/.test(t)) w = 1.8;
    }
    if (it.w == null) it.w = Math.round(w * 10) / 10;
    // seasons
    if (!it.seasons) {
      if (/leinen/.test(m)) it.seasons = ['Frühling', 'Sommer'];
      else if ((it.role === 'bottom' && it.w >= 2) || (it.role !== 'bottom' && it.w >= 2.4 && !['coat', 'winter'].includes(it.role))) it.seasons = ['Herbst', 'Winter', 'Frühling'];
      else if (['coat', 'winter', 'beanie', 'scarf'].includes(it.role)) it.seasons = ['Herbst', 'Winter'];
      else it.seasons = ['ganzjährig'];
    }
    it.unknownColor = !!c.unknown;
    it.label = it.label || (c.unknown ? noun(it) : noun(it) + ' ' + it.colorName.toLowerCase());
    return it;
  }

  // ---------- Text list parser (Chris' format) ----------
  function cap(s) { s = String(s || '').trim(); return s ? s[0].toUpperCase() + s.slice(1) : s; }

  function parseWardrobeText(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
    const blocks = [];
    let cur = null;
    for (const line of lines) {
      const m = line.match(/^(\d{1,4})\s*[.)]\s*(.+)$/);
      if (m && !/^-/.test(line)) { cur = { no: +m[1], head: m[2], attrs: [] }; blocks.push(cur); }
      else if (cur) cur.attrs.push(line.replace(/^[-–•*]\s*/, ''));
    }
    return blocks.map(blockToItem).filter(Boolean);
  }

  function blockToItem(b) {
    let head = b.head;
    let qty = 1;
    const q = head.match(/insgesamt\s*(\d+)/i);
    if (q) { qty = Math.max(1, Math.min(99, +q[1])); head = head.replace(/insgesamt\s*\d+\s*[a-zäöü]?(?=[A-ZÄÖÜ])/, '').replace(/insgesamt\s*\d+\s*/i, ''); }
    let typePart = head, brand = '';
    const v = head.match(/^(.*?)\s+von\s+(.+)$/i);
    if (v) { typePart = v[1]; brand = v[2].trim(); }
    const cat = detectCat(typePart) || detectCat(b.attrs.join(' ')) || 'T-Shirt';
    const brandNorm = brand.trim().split(/\s+/).map(w => w && w === w.toLowerCase() && /^[a-zäöü]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w).join(' ');
    const it = { no: b.no, nos: [b.no], cat, brand: brandNorm, qty, material: [], notes: [] };
    if (/leinen/i.test(typePart)) it.material.push('Leinen');
    let colorRaw = null, pattern = null, patternNote = null;
    const headColor = canonColor(typePart);
    for (const raw of b.attrs) {
      const a = raw.toLowerCase();
      let used = false;
      if (/kariert|karo/.test(a)) { pattern = 'kariert'; used = true; }
      if (/gepunktet|punkte/.test(a)) { pattern = 'gepunktet'; used = true; }
      if (/gestreift|streifen/.test(a)) { pattern = 'gestreift'; used = true; }
      if (/druck|print/.test(a)) { patternNote = cap(raw.replace(/^kein muster,?\s*(aber)?\s*/i, '')); used = true; }
      if (/(^|\s)eingestrickt|stickerei|\bbestickt/.test(a)) { patternNote = cap(raw); used = true; }
      if (/kein\s+muster|uni\b|einfarbig/.test(a)) { if (!pattern) pattern = 'uni'; used = true; }
      if (!colorRaw && COLOR_HINT.test(a) && !/knöpfe|knopf/.test(a) && a.length < 40) { colorRaw = raw; used = true; }
      const mats = [];
      if (/baumwolle|cotton/.test(a)) mats.push('Baumwolle');
      if (/leinen/.test(a)) mats.push('Leinen');
      if (/pol(y|i)y?ester/.test(a)) mats.push('Polyester');
      if (/viskose/.test(a)) mats.push('Viskose');
      if (/techno\s*wool/.test(a)) mats.push('Techno-Wool');
      else if (/(?<!baum)wolle|\bwool/.test(a) && !/wollig/.test(a)) mats.push('Wolle');
      if (/elastan/.test(a)) mats.push('Elastan');
      if (/polyamid/.test(a)) mats.push('Polyamid');
      if (/kaschmir|cashmere/.test(a)) mats.push('Kaschmir');
      if (mats.length) { for (const x of mats) if (!it.material.includes(x)) it.material.push(x); used = true; }
      let tex = null;
      if (/cord/.test(a)) tex = 'Cord';
      else if (/sehr\s+dick/.test(a)) tex = 'sehr dick';
      else if (/dick/.test(a)) tex = 'dick';
      else if (/grob/.test(a)) tex = 'grob';
      else if (/wollig/.test(a)) tex = 'wollig';
      else if (/geriffelt|gerippt/.test(a)) tex = 'gerippt';
      else if (/jeans-?optik|denim/.test(a)) tex = 'Denim-Optik';
      else if (/fein/.test(a)) tex = 'fein';
      if (tex) {
        // keep the more distinctive texture (e.g. "dicker Stoff" + "feiner Strick" -> dick)
        const rank = { 'fein': 1, 'grob': 2, 'gerippt': 2, 'wollig': 3, 'dick': 3, 'Denim-Optik': 3, 'Cord': 4, 'sehr dick': 4 };
        if (!it.texture || (rank[tex] || 0) > (rank[it.texture] || 0)) it.texture = tex;
        used = true;
      }
      let fit = null;
      if (/oversized/.test(a)) fit = /leicht/.test(a) ? 'leicht oversized' : 'Oversized';
      else if (/relaxed/.test(a)) fit = 'Relaxed';
      else if (/tapered/.test(a)) fit = 'Tapered';
      else if (/slim/.test(a)) fit = 'Slim';
      else if (/regular/.test(a)) fit = 'Regular';
      if (fit) { if (!it.fit || it.fit === 'Regular') it.fit = fit; used = true; }
      const det = [];
      if (/rundhals/.test(a)) det.push('Rundhals');
      if (/v-?ausschnitt/.test(a)) det.push('V-Ausschnitt');
      if (/haifisch/.test(a) && !/knöpfe|knopf/.test(a)) det.push('Haifischkragen');
      if (/button-?down/.test(a)) det.push('Button-down');
      if (/bügelfalte/.test(a)) det.push('Bügelfalte');
      if (/knöpfe|knopf/.test(a)) det.push(cap(raw));
      if (det.length) { it.details = [it.details, ...det].filter(Boolean).join(', '); used = true; }
      if (!used) it.notes.push(cap(raw));
    }
    let key = canonColor(colorRaw) || headColor || 'unbekannt';
    if (colorRaw && /gepunktet|kariert/.test(colorRaw.toLowerCase())) {
      const base = colorRaw.toLowerCase().replace(/gepunktet|kariert/g, '').trim();
      key = canonColor(base) || key;
    }
    it.colorKey = key;
    it.colorRaw = colorRaw ? cap(colorRaw) : '';
    it.pattern = pattern || 'uni';
    if (patternNote) it.notes.unshift(patternNote);
    if (patternNote && /druck|print/i.test(patternNote)) it.print = true;
    it.notes = it.notes.join('; ');
    it.details = it.details || '';
    it.fit = it.fit || '';
    it.texture = it.texture || '';
    it.name = cap(typePart.replace(/^(langärmlige?s?|klassische?s?|blaue?n?)\s+/i, '')) || it.cat;
    if (qty > 1) it.notes = (it.notes ? it.notes + '; ' : '') + 'Anzahl ' + qty + ' (bitte prüfen)';
    return derive(it);
  }

  // Merge identical garments (same brand, category, color, texture, fit, material)
  function mergeDuplicates(items) {
    const out = [], byKey = new Map();
    for (const it of items) {
      const k = [it.cat, it.brand, it.colorKey, it.pattern, it.texture, it.fit, (it.material || []).join('+'), it.details].join('|').toLowerCase();
      if (byKey.has(k)) {
        const m = byKey.get(k);
        m.qty += it.qty; m.nos.push(...it.nos);
      } else { byKey.set(k, it); out.push(it); }
    }
    return out;
  }

  // ---------- Tabular rows (CSV / generic Excel) ----------
  const HEAD_MAP = [
    [/^(nr|nummer|no|#)\.?$/i, 'no'], [/kategorie|art|typ/i, 'cat'], [/^(teil|name|bezeichnung|kleidungsst)/i, 'name'],
    [/marke|brand|hersteller/i, 'brand'], [/^farbe|colou?r/i, 'color'], [/muster/i, 'pattern'], [/material|stoff/i, 'material'],
    [/struktur|textur|strick/i, 'texture'], [/passform|fit|schnitt/i, 'fit'], [/formal/i, 'f'], [/saison|jahreszeit/i, 'seasons'],
    [/anzahl|menge|stück/i, 'qty'], [/notiz|anmerkung|bemerkung|details/i, 'notes'], [/status/i, 'status']
  ];
  function rowsToItems(rows) {
    if (!rows.length) return [];
    const head = rows[0].map(c => String(c || '').trim());
    const map = head.map(h => { for (const [re, k] of HEAD_MAP) if (re.test(h)) return k; return null; });
    if (!map.includes('color') || !(map.includes('cat') || map.includes('name'))) return [];
    const items = [];
    rows.slice(1).forEach((r, i) => {
      const o = {};
      map.forEach((k, j) => { if (k && r[j] != null && String(r[j]).trim() !== '') o[k] = String(r[j]).trim(); });
      if (!o.cat && !o.name) return;
      const cat = detectCat(o.cat || '') || detectCat(o.name || '') || 'T-Shirt';
      const text = [o.material, o.texture, o.fit, o.pattern].filter(Boolean).join(' ');
      const tmp = blockToItem({ no: +o.no || 1000 + i, head: (o.name || o.cat) + (o.brand ? ' von ' + o.brand : ''), attrs: [o.color || '', ...(text ? text.split(/[,;]/) : []), o.notes || ''].filter(Boolean) });
      tmp.cat = cat;
      if (o.f && !isNaN(+o.f)) tmp.f = +String(o.f).replace(',', '.');
      if (o.qty && !isNaN(+o.qty)) tmp.qty = +o.qty;
      if (o.seasons) tmp.seasons = o.seasons.split(/[,;\/]/).map(s => s.trim()).filter(Boolean);
      delete tmp.label; delete tmp.role;
      items.push(derive(tmp));
    });
    return items;
  }

  // ---------- Outfit list (Chris' Excel) ----------
  const WISH_RULES = [
    [/navy\s*-?\s*sakko|dunkelblau[\wäöüß]*\s+sakko/i, { key: 'navy-sakko', cat: 'Sakko', colorKey: 'navy', label: 'Sakko navy' }],
    [/grau[\wäöüß]*\s+sakko/i, { key: 'graues-sakko', cat: 'Sakko', colorKey: 'grau', label: 'Sakko grau' }],
    [/oliv[\wäöüß]*\s+stoffhose|oliv[\wäöüß]*\s+hose|oliv[\wäöüß]*\s+chino/i, { key: 'olivgruene-stoffhose', cat: 'Stoffhose', colorKey: 'olivgrün', label: 'Stoffhose olivgrün' }],
    [/dunkelbraun[\wäöüß]*\s+cordhose|braun[\wäöüß]*\s+cordhose/i, { key: 'dunkelbraune-cordhose', cat: 'Stoffhose', colorKey: 'dunkelbraun', texture: 'Cord', material: ['Baumwolle'], label: 'Cordhose dunkelbraun' }],
    [/bomber/i, { key: 'bomberjacke', cat: 'Jacke', colorKey: 'unbekannt', label: 'Bomberjacke' }],
    [/cardigan|strickjacke/i, { key: 'feinstrick-cardigan', cat: 'Cardigan', colorKey: 'unbekannt', texture: 'fein', label: 'Feinstrick-Cardigan' }]
  ];
  const SHOE_RULES = [
    [/wei(ß|ss)[\wäöüß]*\s+sneaker|sneaker/i, 'weisse-sneaker'],
    [/schwarz[\wäöüß]*\s+loafer/i, 'schwarze-loafer'],
    [/loafer/i, 'braune-loafer'],
    [/braun[\wäöüß]*\s+schuh/i, 'braune-schuhe'],
    [/schwarz[\wäöüß]*\s+schuh/i, 'schwarze-schuhe']
  ];

  function parseOutfitRows(rows) {
    if (!rows.length) return null;
    const head = rows[0].map(c => String(c || '').toLowerCase());
    const col = re => head.findIndex(h => re.test(h));
    const ci = { no: col(/outfit|nr/), name: col(/anlass|stil|name/), base: col(/basis|oberteil/), bottom: col(/hose|unterteil/), layer: col(/layer|jacke|schicht/), shoes: col(/schuh/), place: col(/büro|privat|ort/) };
    if (ci.base < 0 || ci.bottom < 0) return null;
    const outfits = [];
    for (const r of rows.slice(1)) {
      const g = i => (i >= 0 && r[i] != null) ? String(r[i]).trim() : '';
      if (!g(ci.base) && !g(ci.bottom)) continue;
      const no = parseInt(g(ci.no), 10);
      if (isNaN(no) && !g(ci.name)) continue;
      outfits.push({
        no: isNaN(no) ? outfits.length + 1 : no,
        name: g(ci.name) || ('Outfit ' + (outfits.length + 1)),
        place: /privat/i.test(g(ci.place)) ? 'Privat' : (/büro/i.test(g(ci.place)) ? 'Büro' : ''),
        cells: { base: g(ci.base), bottom: g(ci.bottom), layer: g(ci.layer), shoes: g(ci.shoes) }
      });
    }
    return outfits;
  }

  // Resolve one outfit cell into references: {nos:[], wish:[], shoes:[], open:bool}
  function resolveCell(text) {
    const res = { nos: [], wish: [], open: /offen/i.test(text), closed: /geschl/i.test(text), raw: text };
    if (!text || text === '-') return res;
    const parts = text.split(/\s\+\s/);
    for (const p of parts) {
      const m = p.match(/\((\d+)\)/);
      if (m) { res.nos.push(+m[1]); continue; }
      if (/neu/i.test(p)) {
        for (const [re, w] of WISH_RULES) if (re.test(p)) { res.wish.push(w); break; }
      }
    }
    return res;
  }
  function resolveShoe(text) {
    for (const [re, k] of SHOE_RULES) if (re.test(text || '')) return k;
    return null;
  }

  // ---------- Minimal XLSX reader (ZIP + XML via regex; works in browser and Node) ----------
  async function inflateRaw(u8) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([u8]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }
  async function unzip(arrayBuffer) {
    const dv = new DataView(arrayBuffer), u8 = new Uint8Array(arrayBuffer);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Keine gültige Excel-Datei (ZIP-Verzeichnis fehlt).');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = {};
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      files[name] = { method, csize, lho };
      p += 46 + nlen + elen + clen;
    }
    return {
      names: Object.keys(files),
      async read(name) {
        const f = files[name]; if (!f) return null;
        const nl = dv.getUint16(f.lho + 26, true), el = dv.getUint16(f.lho + 28, true);
        const start = f.lho + 30 + nl + el;
        const data = u8.subarray(start, start + f.csize);
        const out = f.method === 0 ? data : await inflateRaw(data);
        return new TextDecoder().decode(out);
      }
    };
  }
  function xmlDecode(s) {
    return s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }
  function attrs(s) { const o = {}; s.replace(/([\w:]+)="([^"]*)"/g, (_, k, v) => { o[k] = v; }); return o; }
  function colIndex(ref) { const m = ref.match(/^[A-Z]+/); let n = 0; for (const ch of m[0]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

  async function readXlsx(arrayBuffer) {
    const zip = await unzip(arrayBuffer);
    const wb = await zip.read('xl/workbook.xml');
    if (!wb) throw new Error('Das sieht nicht nach einer Excel-Datei (.xlsx) aus.');
    const relsXml = (await zip.read('xl/_rels/workbook.xml.rels')) || '';
    const rels = {};
    relsXml.replace(/<Relationship\b([^>]*)\/?>/g, (_, a) => { const o = attrs(a); rels[o.Id] = o.Target; });
    const ssXml = (await zip.read('xl/sharedStrings.xml')) || '';
    const shared = [];
    ssXml.replace(/<si>([\s\S]*?)<\/si>/g, (_, inner) => {
      let t = ''; inner.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (__, x) => { t += x; }); shared.push(xmlDecode(t));
    });
    const sheets = [];
    const sheetDefs = [];
    wb.replace(/<sheet\b([^>]*)\/?>/g, (_, a) => { sheetDefs.push(attrs(a)); });
    for (const sd of sheetDefs) {
      let target = rels[sd['r:id']] || '';
      target = target.replace(/^\//, '').replace(/^xl\//, '');
      const xml = await zip.read('xl/' + target);
      if (!xml) continue;
      const rows = [];
      xml.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, (_, ra, inner) => {
        const rIdx = +(attrs(ra).r || rows.length + 1) - 1;
        const row = [];
        inner.replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (__, ca, cin) => {
          const a = attrs(ca); const ci = a.r ? colIndex(a.r) : row.length;
          let v = '';
          if (cin) {
            if (a.t === 'inlineStr') { let t = ''; cin.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (___, x) => { t += x; }); v = xmlDecode(t); }
            else { const m = cin.match(/<v>([\s\S]*?)<\/v>/); if (m) v = a.t === 's' ? (shared[+m[1]] || '') : xmlDecode(m[1]); }
          }
          row[ci] = v;
        });
        rows[rIdx] = row;
      });
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
      sheets.push({ name: sd.name, rows });
    }
    return sheets;
  }

  // Inspect a parsed sheet set and pull out wardrobe items + outfit list
  function analyzeSheets(sheets) {
    const res = { items: [], outfits: [] };
    for (const sh of sheets) {
      const rows = sh.rows.map(r => (r || []).map(c => c == null ? '' : String(c)));
      // outfit table?
      const firstRowIdx = rows.findIndex(r => r.some(c => c.trim()));
      if (firstRowIdx >= 0) {
        const outs = parseOutfitRows(rows.slice(firstRowIdx));
        if (outs && outs.length) res.outfits.push(...outs);
        const tab = rowsToItems(rows.slice(firstRowIdx));
        if (tab.length) res.items.push(...tab);
      }
      // list format inside any column: "1. T-Shirt von ..." + "- weiß" lines
      const width = Math.max(0, ...rows.map(r => r.length));
      for (let c = 0; c < width; c++) {
        const cells = rows.map(r => (r[c] || '').trim()).filter(Boolean);
        const heads = cells.filter(x => /^\d{1,4}\s*[.)]\s*\S/.test(x)).length;
        const dashes = cells.filter(x => /^[-–•]\s*\S/.test(x)).length;
        if (heads >= 2 && dashes >= heads) res.items.push(...parseWardrobeText(cells.join('\n')));
        else {
          // multi-line cells
          const multi = cells.filter(x => x.includes('\n') && /^\d{1,4}\s*[.)]/.test(x));
          if (multi.length) res.items.push(...parseWardrobeText(multi.join('\n')));
        }
      }
    }
    return res;
  }

  function parseCsv(text) {
    const delim = (text.split('\n')[0].match(/;/g) || []).length >= (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  const api = { COLORS, CATS, CAT_ORDER, canonColor, colorInfo, lightness, detectCat, derive, parseWardrobeText, mergeDuplicates, rowsToItems, parseOutfitRows, resolveCell, resolveShoe, readXlsx, analyzeSheets, parseCsv, WISH_RULES, noun };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WardrobeParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
