  // ---------- Outfit: Ankleide-Figur (wird beim Build nach ui-style.js eingefügt) ----------
  // Am Outfit-Vorschlag schaltet „Ansicht“ zwischen Figur und Teile-Kacheln um. Figur zuerst (K35), die Wahl bleibt gespeichert.
  // Die Figur zeichnet figure.js (window.Figure). Teil an der Figur antippen öffnet die Auswahl, der Pfeil in der Liste tauscht direkt.
  const FIG = window.Figure;
  const figSwappable = slot => slot === 'bottom' || slot === 'shoes' || slot === 'outer' || /^t\d$/.test(slot || '');
  const outfitMode = () => (!FIG || S.settings.outfitView === 'teile') ? 'teile' : 'figur';
  const figHex = (h, f) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h || '') ? h : f;
  // Hinweis wie an der Figur: letztes Hemd oder Overshirt offen, Business-Hemd als innerste Lage in der Hose
  function figNote(o, slot, it) {
    const last = o.tops.length - 1, r = FIG.roleOf(it);
    if (slot === 't' + last && o.open && last > 0 && (r === 'shirt' || r === 'overshirt')) return 'offen getragen';
    if (slot === 't0' && r === 'shirt' && it.cat === 'Business-Hemd' && o.bottom) return 'in die Hose gesteckt';
    return '';
  }
  function figSwatch(it) {
    if (!it) return '<span class="fig-sw hint" aria-hidden="true"></span>';
    const a = figHex(it.hex, '#8C877F'), b = figHex(it.hex2, 'rgba(0, 0, 0, .3)');
    const bg = it.pattern === 'kariert' ? `repeating-linear-gradient(0deg, transparent 0 3px, ${b} 3px 5px), repeating-linear-gradient(90deg, ${a} 0 3px, ${b} 3px 5px)`
      : it.pattern === 'gestreift' ? `repeating-linear-gradient(90deg, ${a} 0 3px, ${b} 3px 5px)`
      : it.pattern === 'gepunktet' ? `radial-gradient(${b} 24%, transparent 26%) 0 0 / 6px 6px, ${a}`
      : a;
    return `<span class="fig-sw${it.unknownColor ? ' unknown' : ''}" style="background: ${bg}" aria-hidden="true"></span>`;
  }
  function figRow(o, d, p) {
    if (!p.it) return `<li class="fig-row hint">${figSwatch(null)}<div class="fig-text"><span class="fig-name">${esc(capF(p.label))}</span><span class="fig-meta">Noch nicht erfasst, als Umriss gezeigt</span></div></li>`;
    const it = p.it, name = capF(it.label), can = figSwappable(p.slot);
    const brand = brandOf(it) || (it.status === 'wunsch' ? 'Wunschliste' : 'Marke offen');
    const meta = [brand, figNote(o, p.slot, it), it.unknownColor ? 'Farbe offen' : ''].filter(Boolean).join(', ');
    const nameHtml = can
      ? `<button class="fig-name" data-a="o.choose" data-d="${d}" data-k="${p.slot}" data-v="liste" aria-label="Andere Teile statt ${esc(name)} ansehen" title="Auswählen">${esc(name)}</button>`
      : `<span class="fig-name">${esc(name)}</span>`;
    const swap = can ? `<button class="fig-swap" data-a="o.swap" data-d="${d}" data-k="${p.slot}" aria-label="${esc(name)} tauschen" title="Nur dieses Teil tauschen">${ic('refresh')}</button>` : '';
    return `<li class="fig-row" data-slot="${p.slot}">${figSwatch(it)}<div class="fig-text">${nameHtml}<span class="fig-meta">${esc(meta)}</span></div>${swap}</li>`;
  }
  // Outfit-Vorschlag mit Umschalter; ohne Figur-Baustein bleiben die Kacheln
  function outfitView(o, d, opts) {
    opts = opts || {};
    const mode = outfitMode();
    const toggle = FIG ? `<div class="view-switch">${seg('Ansicht', [['figur', 'Figur'], ['teile', 'Teile']], mode, { a: 'o.view' })}</div>` : '';
    if (mode === 'teile') return toggle + layout(o, { big: opts.big, swapD: d });
    // Teile an der Figur sind für Maus und Finger; per Tastatur und Vorlesefunktion bedient man die Liste daneben
    const attr = (slot, it) => it && figSwappable(slot) ? `data-a="o.choose" data-d="${d}" data-k="${slot}"` : '';
    return `${toggle}<div class="fig-wrap${opts.big ? ' big' : ''}"><div class="fig-stage">${FIG.svg(o, { attr })}</div><ul class="fig-list" aria-label="Teile des Outfits">${FIG.parts(o).map(p => figRow(o, d, p)).join('')}</ul></div>`;
  }
  Object.assign(A, {
    'o.view': el => { S.settings.outfitView = el.dataset.v === 'teile' ? 'teile' : 'figur'; save(); render(); }
  });
  // ---------- Ende Ankleide-Figur ----------
