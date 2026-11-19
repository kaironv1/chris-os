/* Beispiel-Teile für die Vorschau. In der App kommen die Teile aus dem Kleiderschrank (S.wardrobe.items). */
(function (root) {
  'use strict';
  const W = [
    { id: 'tw', label: 'T-Shirt weiß', cat: 'T-Shirt', hex: '#F3F1EC', fit: 'Regular' },
    { id: 'to', label: 'T-Shirt olivgrün', cat: 'T-Shirt', hex: '#6B6B3E', fit: 'Regular' },
    { id: 'tn', label: 'T-Shirt navy', cat: 'T-Shirt', hex: '#1F2A44', fit: 'Relaxed' },
    { id: 'ts', label: 'T-Shirt Siebträger', cat: 'T-Shirt', hex: '#E6DCC8', print: true, fit: 'Regular' },
    { id: 'tx', label: 'T-Shirt sand oversized', cat: 'T-Shirt', hex: '#C9B99A', fit: 'Oversized' },
    { id: 'tg', label: 'T-Shirt gestreift', cat: 'T-Shirt', hex: '#F3F1EC', hex2: '#2D4270', pattern: 'gestreift' },
    { id: 'pn', label: 'Kragenshirt navy', cat: 'Kragenshirt', hex: '#1F2A44' },
    { id: 'hb', label: 'Hemd hellblau', cat: 'Hemd', hex: '#A9C4DE', material: ['Baumwolle'], texture: 'fein' },
    { id: 'hg', label: 'Hemd grau', cat: 'Hemd', hex: '#8E8E8B' },
    { id: 'hl', label: 'Leinenhemd beige', cat: 'Hemd', hex: '#D2C2A2', material: ['Leinen'] },
    { id: 'hk', label: 'Hemd kariert', cat: 'Hemd', hex: '#3E5C8A', pattern: 'kariert', hex2: '#DCD3C2', texture: 'dick' },
    { id: 'bw', label: 'Business-Hemd weiß', cat: 'Business-Hemd', hex: '#F4F2EE' },
    { id: 'oo', label: 'Overshirt oliv', cat: 'Overshirt', hex: '#6B6B3E', texture: 'dick' },
    { id: 'oc', label: 'Overshirt Cord braun', cat: 'Overshirt', hex: '#6A4A34', texture: 'Cord' },
    { id: 'kg', label: 'Pullover dunkelgrün', cat: 'Pullover', hex: '#2F4A3A', texture: 'grob' },
    { id: 'kn', label: 'Pullover navy', cat: 'Pullover', hex: '#1F2A44', texture: 'fein' },
    { id: 'kr', label: 'Rollkragenpullover beige', cat: 'Pullover', hex: '#D2C2A2', texture: 'gerippt' },
    { id: 'kh', label: 'Hoodie grau', cat: 'Pullover', hex: '#8E8E8B', fit: 'Relaxed' },
    { id: 'cb', label: 'Cardigan braun', cat: 'Cardigan', hex: '#6A4A34', texture: 'grob' },
    { id: 'sn', label: 'Sakko navy', cat: 'Sakko', hex: '#233150', material: ['Wolle'] },
    { id: 'jj', label: 'Jeansjacke', cat: 'Jacke', hex: '#4F6F98', texture: 'Denim-Optik' },
    { id: 'jb', label: 'Bomberjacke oliv', cat: 'Jacke', hex: '#4F5232' },
    { id: 'mc', label: 'Mantel camel', cat: 'Mantel', hex: '#A9794D', material: ['Wolle'] },
    { id: 'wn', label: 'Daunenjacke navy', cat: 'Winterjacke', hex: '#1F2A44' },
    { id: 'wp', label: 'Parka oliv', cat: 'Winterjacke', hex: '#55573A' },
    { id: 'jd', label: 'Jeans dunkelblau', cat: 'Jeans', hex: '#2D4270', fit: 'Regular' },
    { id: 'jh', label: 'Jeans hellblau', cat: 'Jeans', hex: '#7F9CC0', fit: 'Relaxed' },
    { id: 'ce', label: 'Chino beige', cat: 'Stoffhose', hex: '#D2C2A2', fit: 'Regular' },
    { id: 'sg', label: 'Stoffhose grau', cat: 'Stoffhose', hex: '#6E6F70', fit: 'Slim', f: 4 },
    { id: 'cc', label: 'Cordhose cognac', cat: 'Stoffhose', hex: '#8E5531', texture: 'Cord', fit: 'Tapered' },
    { id: 'sw', label: 'Sneaker weiß', cat: 'Sneaker', hex: '#F4F2EE' },
    { id: 'lb', label: 'Loafer braun', cat: 'Loafer', hex: '#6A4A34' },
    { id: 'ls', label: 'Loafer schwarz', cat: 'Loafer', hex: '#1D1D1F' },
    { id: 'bb', label: 'Business-Schuhe braun', cat: 'Business-Schuhe', hex: '#5A3B28' },
    { id: 'cb2', label: 'Chelsea Boots braun', cat: 'Stiefel', hex: '#6A4A34' },
    { id: 'ka', label: 'Kappe navy', cat: 'Kappe', hex: '#1F2A44' },
    { id: 'mu', label: 'Mütze grau', cat: 'Mütze', hex: '#5E5F61', texture: 'gerippt' },
    { id: 'sc', label: 'Schal anthrazit', cat: 'Schal', hex: '#3F4042' },
    { id: 'gu', label: 'Gürtel braun', cat: 'Gürtel', hex: '#5A3B28' },
    { id: 'uh', label: 'Uhr', cat: 'Uhr', hex: '#2B2B2B' }
  ];
  const OUTFITS = [
    { id: 'buero', name: 'Büro', note: 'Smart, 16 Grad', tops: ['tw', 'hb'], open: true, bottom: 'ce', shoes: 'sw' },
    { id: 'termin', name: 'Termin', note: 'Formell, 12 Grad', tops: ['bw', 'sn'], bottom: 'sg', shoes: 'bb', acc: ['gu', 'uh'] },
    { id: 'herbst', name: 'Herbst', note: 'Lagen, 9 Grad', tops: ['hb', 'kg'], bottom: 'jd', shoes: 'lb', outer: 'mc' },
    { id: 'winter', name: 'Winter', note: 'Kalt, 1 Grad', tops: ['hk', 'kn'], bottom: 'cc', shoes: 'cb2', outer: 'wn', acc: ['mu', 'sc'] },
    { id: 'freizeit', name: 'Freizeit', note: 'Wochenende, 21 Grad', tops: ['ts'], bottom: 'jh', shoes: 'sw', acc: ['ka'] },
    { id: 'overshirt', name: 'Overshirt', note: 'Smart, 14 Grad', tops: ['to', 'oc'], open: true, bottom: 'ce', shoes: 'lb' },
    { id: 'fehlt', name: 'Mantel fehlt', note: 'Mantel noch nicht erfasst', tops: ['hg', 'cb'], bottom: 'jd', shoes: 'cb2', outerHint: 'Mantel' }
  ];
  const GALLERY = [
    { id: 'g1', tops: ['pn'], bottom: 'jh', shoes: 'sw', acc: ['ka'] },
    { id: 'g2', tops: ['tw', 'jj'], bottom: 'ce', shoes: 'sw' },
    { id: 'g3', tops: ['tn', 'jb'], bottom: 'jd', shoes: 'sw' },
    { id: 'g4', tops: ['kh'], bottom: 'jd', shoes: 'sw', outer: 'wp', acc: ['mu'] },
    { id: 'g5', tops: ['kr'], bottom: 'sg', shoes: 'bb', outer: 'mc' },
    { id: 'g6', tops: ['tg', 'cb'], bottom: 'cc', shoes: 'lb' },
    { id: 'g7', tops: ['hl'], bottom: 'ce', shoes: 'ls', acc: ['uh'] },
    { id: 'g8', tops: ['bw'], bottom: 'sg', shoes: 'bb', acc: ['gu'] },
    { id: 'g9', tops: ['hb', 'sn'], bottom: 'jd', shoes: 'lb' },
    { id: 'g10', tops: ['tw', 'oo'], open: true, bottom: 'jh', shoes: 'sw' },
    { id: 'g11', tops: ['pn', 'hb'], open: true, bottom: 'ce', shoes: 'lb' },
    { id: 'g12', tops: ['hb', 'oo'], open: true, bottom: 'jd', shoes: 'cb2' },
    { id: 'g13', tops: ['bw', 'kn', 'sn'], bottom: 'sg', shoes: 'bb', outer: 'mc', acc: ['sc'] },
    { id: 'g14', tops: ['kn'], bottom: 'sg', shoes: 'ls', acc: ['uh'] },
    { id: 'g15', tops: ['tx'], bottom: 'jh', shoes: 'sw', acc: ['ka'] }
  ];
  const byId = id => W.find(i => i.id === id) || null;
  function resolve(def) {
    return {
      tops: (def.tops || []).map(byId).filter(Boolean), bottom: byId(def.bottom), shoes: byId(def.shoes),
      outer: def.outer ? byId(def.outer) : null, outerHint: def.outerHint || null, acc: (def.acc || []).map(byId).filter(Boolean), open: !!def.open
    };
  }
  root.Demo = { W, OUTFITS, GALLERY, byId, resolve };
})(typeof window !== 'undefined' ? window : this);
