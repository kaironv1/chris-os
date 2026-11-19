  // ---------- Outfit: swap single pieces, style inspiration (inserted into app.js at build time) ----------
  Object.assign(IC, {
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    swap: '<path d="M7 7h11l-3.5-3.5M17 17H6l3.5 3.5"/>',
    spark: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>'
  });

  // ----- swap one piece -----
  const SLOT_NAME = { bottom: 'Hose', shoes: 'Schuhe', outer: 'Jacke' };
  function slotItem(o, slot) {
    if (!o) return null;
    if (slot === 'bottom') return o.bottom;
    if (slot === 'shoes') return o.shoes;
    if (slot === 'outer') return o.outer;
    return o.tops[+String(slot).slice(1)] || null;
  }
  function choiceFor(d, occ, cur) {
    S.wardrobe.choice = S.wardrobe.choice || {};
    const ck = d + ':' + occ;
    return S.wardrobe.choice[ck] || (S.wardrobe.choice[ck] = { key: cur.key });
  }
  function applySwap(ch, cur, slot, opt) {
    if (slot === 'shoes') ch.shoes = opt.item.id;
    else if (slot === 'outer') ch.outer = opt.item.id;
    else { ch.key = opt.key; if (slot === 'bottom') delete ch.shoes; }
  }
  // Options without duplicates that look the same (e.g. two identical olive T-shirts)
  function distinctOptions(opts, curItem, triedIds) {
    const seen = new Set([curItem.label]);
    (triedIds || []).forEach(id => { const it = item(id); if (it) seen.add(it.label); });
    return opts.filter(x => { if ((triedIds || []).includes(x.item.id) || seen.has(x.item.label)) return false; seen.add(x.item.label); return true; });
  }
  function rerollDay(d, occ) {
    const k = d + ':' + occ;
    delete ui.pick[d + '|' + occ];
    if (S.wardrobe.choice) delete S.wardrobe.choice[k];
    S.wardrobe.reroll[k] = (S.wardrobe.reroll[k] || 0) + 1;
  }
  function chooseDialog(d, slot) {
    const occ = occFor(d), { ctx, res } = suggestionFor(d, occ), cur = res.fav;
    const curItem = slotItem(cur, slot); if (!curItem) return;
    const opts = distinctOptions(E.swapOptions(S, ctx, cur, slot), curItem).slice(0, 8);
    ui.chooseCtx = { d, occ, slot, opts };
    openDialog(`${dlgHead('Statt ' + capF(curItem.label))}
      ${opts.length ? `<p class="small muted" style="margin-bottom:10px">Alles hier passt zum Rest des Outfits, das Beste steht oben.</p>
        <ul class="choose-list">${opts.map((x, i) => `<li><button class="choose" data-a="o.chooseSet" data-v="${i}"><span class="choose-art">${art(x.item)}</span><span class="choose-body"><span class="check-name">${esc(capF(x.item.label))}</span><span class="check-meta">${esc(sub(x.item))}</span></span>${x.fit === 2 ? '<span class="tag olive">passt sehr gut</span>' : '<span class="tag">passt</span>'}</button></li>`).join('')}</ul>`
        : `<p class="how-text">Zu den übrigen Teilen passt gerade nichts anderes. Ein neuer Vorschlag stellt das Outfit komplett neu zusammen.</p>`}
      <div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn quiet" data-a="reroll" data-d="${d}">${ic('refresh')}Neuer Vorschlag</button></div>`);
  }

  // ----- style inspiration -----
  // Pieces that would suit Chris' style: smart casual in blue and earth tones, regular or relaxed fit,
  // layers and texture for a slim build, fuller-looking trousers. Clothing is simulated against his wardrobe.
  const IDEAS = [
    { id: 'i-over-navy', label: 'Overshirt navy aus Wollmix', cat: 'Overshirt', colorKey: 'navy', texture: 'dick', material: ['Wolle'], why: 'Dein einziges Overshirt ist beige. In Navy geht es über fast jedes T-Shirt und Hemd, auch im Büro.', look: 'Fester, leicht angerauter Stoff, Brusttaschen, Ärmel enden am Handgelenk.' },
    { id: 'i-over-cord', label: 'Overshirt olivgrün aus Cord', cat: 'Overshirt', colorKey: 'olivgrün', texture: 'cord', material: ['Baumwolle'], why: 'Cord bringt Struktur und optisch Volumen an den Oberkörper.', look: 'Breiter Cord, gerader Schnitt, nicht länger als bis zur Mitte des Pos.' },
    { id: 'i-knit-cream', label: 'Strickpullover wollweiß, grob', cat: 'Pullover', colorKey: 'hellbeige', texture: 'grob', material: ['Wolle'], why: 'Grobstrick lässt schmale Schultern breiter wirken. Wollweiß passt zu allen deinen Blau- und Brauntönen.', look: 'Zopf- oder Rippenstrick, Regular Fit, Bündchen am Saum.' },
    { id: 'i-turtle-brown', label: 'Rollkragenpullover dunkelbraun', cat: 'Pullover', colorKey: 'dunkelbraun', texture: 'gerippt', material: ['Merinowolle'], why: 'Unter dem Mantel elegant, später auch unter einem Sakko. Und er hält den Hals warm, wo deine Erkältungen oft anfangen.', look: 'Merino in feiner Rippe, Kragen nicht zu eng.' },
    { id: 'i-polo-knit', label: 'Strickpolo navy', cat: 'Kragenshirt', colorKey: 'navy', texture: 'gerippt', material: ['Baumwolle'], why: 'Liegt zwischen T-Shirt und Hemd: ideal für Smart Casual, auch unter dem Overshirt.', look: 'Kurze Knopfleiste, gerippte Bündchen, Regular Fit.' },
    { id: 'i-flannel', label: 'Flanellhemd kariert, Blau und Braun', cat: 'Hemd', colorKey: 'dunkelblau', pattern: 'kariert', texture: 'dick', material: ['Baumwolle'], why: 'Dir fehlt ein gemustertes Hemd für kalte Tage. Karo in Blau und Braun verbindet deine beiden Farbwelten.', look: 'Weicher Flanell, kleines bis mittleres Karo, auch offen über dem T-Shirt.' },
    { id: 'i-jeans-raw', label: 'Jeans dunkelblau, gerade geschnitten', cat: 'Jeans', colorKey: 'dunkelblau', material: ['Denim'], fit: 'Regular', why: 'Eine dunkle, unverwaschene Jeans ist das vielseitigste Smart-Casual-Teil. Deine Jeans sind bisher heller oder schwarz.', look: 'Straight oder Regular Fit, fester Denim, Saum mit leichtem Stand auf dem Schuh.' },
    { id: 'i-cord-pants', label: 'Cordhose camel', cat: 'Stoffhose', colorKey: 'hellbraun', texture: 'cord', material: ['Baumwolle'], fit: 'Relaxed', why: 'Kräftiger Stoff und ein heller Ton lassen schmale Beine voller wirken.', look: 'Breiter Cord, gerades bis leicht weites Bein, gern mit Bundfalte.' },
    { id: 'i-chino-navy', label: 'Chino navy', cat: 'Stoffhose', colorKey: 'navy', material: ['Baumwolle'], fit: 'Regular', why: 'Die ruhige Basis für fast jedes Oberteil in Erdtönen.', look: 'Gerader Schnitt, fester Twill, kein Stretch-Slim-Fit.' },
    { id: 'i-chelsea', label: 'Chelsea Boots aus braunem Wildleder', cat: 'Stiefel', colorKey: 'braun', material: ['Wildleder'], rule: 'boots', prio: 18, why: 'Du hast keine Stiefel. Zu Jeans, Cord und Stoffhose sind sie im Herbst und Winter die beste Wahl und geben dem Bein unten mehr Gewicht.', look: 'Runde, schlanke Spitze, Gummisohle gegen Nässe, Wildleder imprägnieren.' },
    { id: 'i-scarf', label: 'Wollschal navy', cat: 'Schal', colorKey: 'navy', material: ['Wolle'], rule: 'scarf', prio: 20, why: 'Du frierst schnell, und deine Erkältungen fangen oft mit Halsschmerzen an. Bisher ist kein Schal erfasst; die App schlägt ihn an kalten Tagen vor.', look: 'Wolle oder Kaschmir-Mix, lang genug zum einmal Umschlingen.' },
    { id: 'i-sneaker-dark', label: 'Sneaker navy aus Wildleder', cat: 'Sneaker', colorKey: 'navy', material: ['Wildleder'], rule: 'darksneaker', prio: 10, why: 'Weiße Sneaker wirken im Winter schnell sommerlich. Ein dunkler Sneaker passt zu Jeans und Chino an grauen Tagen.', look: 'Schlichte Form, keine großen Logos.' },
    { id: 'i-belt', label: 'Ledergürtel braun', cat: 'Gürtel', colorKey: 'braun', material: ['Leder'], rule: 'belt', prio: 12, why: 'Kein Gürtel erfasst. Ein brauner Ledergürtel passt zu deinen braunen Loafern und Schuhen.', look: 'Matt, etwa 3 bis 3,5 cm breit, schlichte Schnalle.' },
    { id: 'i-beanie', label: 'Mütze dunkelgrau, gerippt', cat: 'Mütze', colorKey: 'dunkelgrau', material: ['Merinowolle'], rule: 'beanie', prio: 6, why: 'Für Tage unter 5 Grad, wenn die Kappe nicht mehr reicht.', look: 'Merino, Rippenstrick, umgeschlagener Rand.' }
  ];
  function ideaItem(x) {
    const it = WP.derive(Object.assign({ id: 'idea-' + x.id, nos: [], material: [], pattern: 'uni', fit: '', details: '', texture: '', qty: 1, status: 'aktiv', brand: '' },
      { label: x.label, cat: x.cat, colorKey: x.colorKey, material: x.material || [], pattern: x.pattern || 'uni', texture: x.texture || '', fit: x.fit || '' }));
    it.label = x.label;
    return it;
  }
  // Already owned or on the wishlist: same category and colour, or same category and colour family at a similar lightness
  function ownsSimilar(it) {
    return S.wardrobe.items.some(i => (i.status === 'aktiv' || i.status === 'wunsch') && i.cat === it.cat &&
      (it.pattern === 'uni' || i.pattern === it.pattern) &&
      (i.colorKey === it.colorKey || (!i.unknownColor && i.fam === it.fam && Math.abs(i.L - it.L) < 12) || (i.status === 'wunsch' && i.unknownColor)));
  }
  function ruleApplies(rule) {
    const own = S.wardrobe.items.filter(i => i.status === 'aktiv');
    if (rule === 'boots') return !own.some(i => i.cat === 'Stiefel');
    if (rule === 'scarf') return !own.some(i => i.role === 'scarf');
    if (rule === 'belt') return !own.some(i => i.role === 'belt');
    if (rule === 'beanie') return !own.some(i => i.role === 'beanie');
    if (rule === 'darksneaker') return own.filter(i => i.cat === 'Sneaker').every(i => i.L > 70);
    return false;
  }
  function styleIdeas(lazy) {
    const k = 'ideas|' + ver;
    if (ui.memo[k]) return ui.memo[k];
    if (lazy) { if (!ui.idPending) { ui.idPending = true; setTimeout(() => { styleIdeas(); ui.idPending = false; if (route().sub === 'inspiration') render(); }, 30); } return null; }
    const hidden = S.wardrobe.ideaHide || {};
    const base = Math.max(1, E.goodCombos(S));
    const out = [];
    for (const x of IDEAS) {
      if (hidden[x.id] || S.wardrobe.items.some(i => i.id === 'w-' + x.id)) continue;
      const it = ideaItem(x);
      if (x.rule) { if (ruleApplies(x.rule)) out.push({ x, it, prio: x.prio, stat: 'Lücke im Schrank' }); continue; }
      if (ownsSimilar(it)) continue;
      // Same measure as the gap analysis (good combos on a cool and a mild day), plus the pieces it pairs with
      let plus = 0; const partners = new Set();
      for (const effT of [7, 17]) {
        const { list } = E.suggest(S, { date: '2000-01-01', occasion: 'smart', effT, tOut: effT, tDay: effT, rain: 0, needCoat: false, needWinter: false }, { raw: true, extra: it });
        const good = list.filter(o => o.s >= 66 && (o.tops.includes(it) || o.bottom === it));
        plus += good.length;
        good.forEach(o => o.tops.concat([o.bottom]).forEach(p => { if (p !== it) partners.add(p.id); }));
      }
      const pct = Math.round(plus / base * 100);
      if (pct < 3) continue;
      out.push({ x, it, prio: pct, plus, pct, partners: partners.size, stat: '+' + pct + ' % gute Kombinationen' });
    }
    out.sort((a, b) => b.prio - a.prio);
    const owned = S.wardrobe.items.filter(i => i.status === 'aktiv');
    const groups = {};
    owned.forEach(i => { const g = i.cat === 'Business-Hemd' ? 'Business-Hemden' : i.cat === 'T-Shirt' ? 'T-Shirts' : i.cat === 'Hemd' ? 'Hemden' : i.cat === 'Stoffhose' ? 'Stoffhosen' : i.cat === 'Pullover' ? 'Pullover' : null; if (g) groups[g] = (groups[g] || 0) + (i.qty || 1); });
    const plenty = Object.entries(groups).filter(([, n]) => n >= 6).sort((a, b) => b[1] - a[1]);
    return (ui.memo[k] = { list: out, plenty, base });
  }
  function viewInspiration() {
    const A = styleIdeas(true);
    const card = (r, i) => `<article class="idea${i === 0 ? ' first' : ''}">
        <div class="idea-art">${G.svg(r.it)}</div>
        <div class="idea-body">
          <div class="row" style="align-items:baseline;gap:8px;flex-wrap:wrap"><h3 class="idea-name">${esc(r.x.label)}</h3>${i === 0 ? '<span class="tag olive">zuerst</span>' : ''}</div>
          <p class="idea-stat">${esc(r.stat)}${r.partners ? ', kombinierbar mit ' + r.partners + ' deiner Teile' : ''}</p>
          <p class="idea-why">${esc(r.x.why)}</p>
          <p class="idea-look"><b>Worauf achten:</b> ${esc(r.x.look)}</p>
          <div class="idea-actions">
            <button class="btn sm" data-a="idea.wish" data-id="${r.x.id}">${ic('plus')}Auf die Wunschliste</button>
            <span class="idea-links">${r.x.rule ? `<button class="link-btn small" data-a="idea.have" data-id="${r.x.id}">Habe ich schon</button>` : ''}<button class="link-btn small" data-a="idea.hide" data-id="${r.x.id}">Kein Interesse</button></span>
          </div>
        </div></article>`;
    const hiddenN = Object.keys(S.wardrobe.ideaHide || {}).length;
    return `<p class="lead" style="margin-bottom:6px">Was deinem Schrank für deinen Stil noch fehlt. Jedes Teil ist gegen deine Sachen durchgerechnet: Wie viele gute Kombinationen kommen dazu, und schließt es eine Lücke?</p>
      <p class="small muted" style="margin-bottom:18px">Deine Regeln dahinter: Blau und Erdtöne, Regular oder Relaxed Fit, Lagen und Struktur für mehr Volumen, kräftige oder helle Hosen für die Beine.</p>
      ${!A ? '<div class="panel"><p class="small muted">Rechne Kombinationen durch …</p></div>' : (A.list.length ? `<div class="ideas">${A.list.slice(0, 8).map(card).join('')}</div>` : '<div class="empty">Gerade fehlt deinem Schrank nichts Wichtiges. Schau nach dem nächsten Einkauf wieder rein.</div>')}
      ${A && A.plenty.length ? `<div class="panel" style="margin-top:22px"><h2 class="sec-title" style="margin-bottom:6px">Hier bist du gut ausgestattet</h2><p class="small ink2">${esc(A.plenty.map(([g, n]) => g + ' (' + n + ')').join(', '))}. Davon brauchst du vorerst nichts Neues.</p></div>` : ''}
      ${hiddenN ? `<p class="small muted" style="margin-top:14px">${hiddenN} ${hiddenN === 1 ? 'Idee' : 'Ideen'} ausgeblendet. <button class="link-btn small" data-a="idea.unhide">Wieder zeigen</button></p>` : ''}`;
  }

  const SA = {
    'o.swap': el => {
      const d = el.dataset.d, occ = occFor(d), slot = el.dataset.k;
      const { ctx, res } = suggestionFor(d, occ), cur = res.fav;
      const curItem = slotItem(cur, slot); if (!curItem) return;
      const ch = choiceFor(d, occ, cur);
      if (!ch.tried || ch.tried.slot !== slot) ch.tried = { slot, ids: [curItem.id] };
      const opts = distinctOptions(E.swapOptions(S, ctx, cur, slot), curItem, ch.tried.ids);
      if (!opts.length) {
        const many = ch.tried.ids.length > 1;
        rerollDay(d, occ); save(); render();
        toast(many ? 'Keine weiteren passenden Teile. Hier ist ein neuer Gesamtvorschlag.' : 'Dazu passt kein anderes Teil. Hier ist ein neuer Gesamtvorschlag.');
        return;
      }
      const prev = JSON.parse(JSON.stringify(ch));
      applySwap(ch, cur, slot, opts[0]);
      ch.tried.ids.push(opts[0].item.id);
      save(); render();
      toast(capF(curItem.label) + ' getauscht gegen ' + capF(opts[0].item.label), () => { S.wardrobe.choice[d + ':' + occ] = prev; });
    },
    'o.choose': el => chooseDialog(el.dataset.d, el.dataset.k),
    'o.chooseSet': el => {
      const C = ui.chooseCtx; if (!C) return;
      const opt = C.opts[+el.dataset.v]; if (!opt) return;
      const { res } = suggestionFor(C.d, C.occ), cur = res.fav, curItem = slotItem(cur, C.slot);
      const ch = choiceFor(C.d, C.occ, cur), prev = JSON.parse(JSON.stringify(ch));
      applySwap(ch, cur, C.slot, opt);
      ch.tried = { slot: C.slot, ids: [curItem.id, opt.item.id] };
      closeDialog(); save(); render();
      toast(capF(curItem.label) + ' getauscht gegen ' + capF(opt.item.label), () => { S.wardrobe.choice[C.d + ':' + C.occ] = prev; });
    },
    'idea.wish': el => {
      const x = IDEAS.find(i => i.id === el.dataset.id); if (!x) return;
      const it = WP.derive({ id: 'w-' + x.id, status: 'wunsch', label: x.label, cat: x.cat, colorKey: x.colorKey, material: x.material || [], pattern: x.pattern || 'uni', texture: x.texture || '', fit: x.fit || '', brand: '', nos: [], qty: 1, details: '', notes: 'Aus der Stil-Inspiration. ' + x.look });
      it.label = x.label;
      S.wardrobe.items.push(it); save(); render();
      toast('Auf der Wunschliste: ' + x.label, () => { S.wardrobe.items = S.wardrobe.items.filter(i => i.id !== it.id); });
    },
    'idea.have': el => {
      const x = IDEAS.find(i => i.id === el.dataset.id); if (!x) return;
      itemDialog(null, { cat: x.cat, colorKey: x.colorKey, label: '', material: x.material || [] });
    },
    'idea.hide': el => { S.wardrobe.ideaHide = S.wardrobe.ideaHide || {}; S.wardrobe.ideaHide[el.dataset.id] = E.today(); save(); render(); toast('Ausgeblendet', () => { delete S.wardrobe.ideaHide[el.dataset.id]; }); },
    'idea.unhide': () => { S.wardrobe.ideaHide = {}; save(); render(); }
  };
  Object.assign(A, SA);
  // ---------- end Outfit extras ----------
