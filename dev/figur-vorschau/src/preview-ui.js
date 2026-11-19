/* Vorschau der Ankleide-Figur: Beispiel-Outfits, Teile tauschen, Hell und Dunkel. */
(function () {
  'use strict';
  const F = window.Figure, D = window.Demo;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const capF = s => { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); };
  const ICON = {
    swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h13l-3.5-3.5M20 15H7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };
  const SLOT_NAME = { outer: 'Jacke oder Mantel', bottom: 'Hose', shoes: 'Schuhe', acc: 'Accessoire' };
  const state = { oi: 0, o: null, pick: null };

  function load(i) { state.oi = i; state.o = D.resolve(D.OUTFITS[i]); state.pick = null; render(); }
  const sameGroup = (a, b) => { const ra = F.roleOf(a), rb = F.roleOf(b); if (ra === rb) return true; const outer = ['coat', 'winter']; return outer.includes(ra) && outer.includes(rb); };
  function current(slot, idx) {
    const o = state.o;
    if (slot === 'bottom') return o.bottom;
    if (slot === 'shoes') return o.shoes;
    if (slot === 'outer') return o.outer;
    if (slot === 'acc') return o.acc[idx];
    return o.tops[+slot.slice(1)];
  }
  function options(slot, idx) {
    const cur = current(slot, idx);
    if (slot === 'outer' && !cur) return D.W.filter(i => ['coat', 'winter'].includes(F.roleOf(i)));
    if (!cur) return [];
    return D.W.filter(i => sameGroup(i, cur));
  }
  function setItem(slot, idx, it) {
    const o = state.o;
    if (slot === 'bottom') o.bottom = it;
    else if (slot === 'shoes') o.shoes = it;
    else if (slot === 'outer') { o.outer = it; o.outerHint = null; }
    else if (slot === 'acc') o.acc[idx] = it;
    else o.tops[+slot.slice(1)] = it;
  }
  function next(slot, idx) {
    const list = options(slot, idx), cur = current(slot, idx);
    if (!list.length) return;
    const i = cur ? list.indexOf(cur) : -1;
    setItem(slot, idx, list[(i + 1) % list.length]);
    render(slot + ':' + idx);
  }

  function swatch(it, hint) {
    if (hint) return '<span class="sw hint"></span>';
    const st = it.pattern === 'kariert' ? `background:repeating-linear-gradient(0deg,transparent 0 3px,${it.hex2 || '#0003'} 3px 5px),repeating-linear-gradient(90deg,${it.hex} 0 3px,${it.hex2 || '#0003'} 3px 5px)`
      : it.pattern === 'gestreift' ? `background:repeating-linear-gradient(0deg,${it.hex} 0 3px,${it.hex2 || '#0004'} 3px 5px)` : `background:${it.hex}`;
    return `<span class="sw" style="${st}"></span>`;
  }
  function note(p) {
    const o = state.o;
    if (p.hint) return 'Noch nicht erfasst, als Umriss gezeigt';
    const it = p.it;
    if (p.slot === 't' + (o.tops.length - 1) && o.open && o.tops.length > 1 && ['shirt', 'overshirt'].includes(F.roleOf(it))) return it.cat + ', offen getragen';
    if (p.slot === 't0' && it.cat === 'Business-Hemd' && o.tops.length >= 1) return it.cat + ', in die Hose gesteckt';
    return it.cat;
  }
  function render(flash) {
    const o = state.o, def = D.OUTFITS[state.oi];
    $('#occ').innerHTML = D.OUTFITS.map((x, i) => `<button class="chip${i === state.oi ? ' on' : ''}" data-occ="${i}" aria-pressed="${i === state.oi}">${esc(x.name)}</button>`).join('');
    const accIdx = it => o.acc.indexOf(it);
    $('#fig').innerHTML = F.svg(o, { attr: (slot, it) => `tabindex="0" role="button" data-pick="${slot}:${slot === 'acc' ? accIdx(it) : 0}" aria-label="${esc(it ? capF(it.label) + ' tauschen' : 'Mantel wählen')}"` });
    $('#occ-note').textContent = def.note;
    const parts = F.parts(o);
    $('#parts').innerHTML = parts.map(p => {
      const idx = p.slot === 'acc' ? accIdx(p.it) : 0, key = p.slot + ':' + idx;
      const label = p.it ? capF(p.it.label) : capF(p.label);
      const n = options(p.slot, idx).length;
      return `<li class="part${flash === key ? ' flash' : ''}" data-key="${key}">${swatch(p.it, p.hint)}<div class="pt"><b>${esc(label)}</b><span>${esc(note(p))}</span></div>${n > 1 || p.hint ? `<button class="ib" data-swap="${key}" aria-label="${esc(label)} tauschen" title="Tauschen">${ICON.swap}</button>` : ''}</li>`;
    }).join('');
    if (state.pick) sheet(); else $('#sheet').hidden = true;
  }
  function sheet() {
    const [slot, idx] = state.pick.split(':'), i = +idx, cur = current(slot, i), list = options(slot, i);
    const title = cur ? capF(cur.label) + ' tauschen' : 'Mantel wählen';
    $('#sheet').hidden = false;
    $('#sheet').innerHTML = `<div class="sh-in" role="dialog" aria-label="${esc(title)}"><div class="sh-head"><b>${esc(title)}</b><button class="ib" data-close aria-label="Schließen">${ICON.close}</button></div>
      <ul class="opts">${list.map(it => `<li><button class="opt${it === cur ? ' on' : ''}" data-set="${esc(it.id)}">${swatch(it)}<span>${esc(capF(it.label))}</span></button></li>`).join('')}</ul></div>`;
  }
  document.addEventListener('click', ev => {
    const t = ev.target.closest('[data-occ],[data-swap],[data-pick],[data-set],[data-close],[data-th]');
    if (!t) { if (state.pick && !ev.target.closest('.sh-in')) { state.pick = null; render(); } return; }
    if (t.dataset.occ) load(+t.dataset.occ);
    else if (t.dataset.swap) { const [s, i] = t.dataset.swap.split(':'); if (s === 'outer' && !current('outer')) { state.pick = t.dataset.swap; render(); } else next(s, +i); }
    else if (t.dataset.pick) { state.pick = t.dataset.pick; render(); }
    else if (t.dataset.set) { const [s, i] = state.pick.split(':'); setItem(s, +i, D.byId(t.dataset.set)); state.pick = null; render(s + ':' + i); }
    else if ('close' in t.dataset) { state.pick = null; render(); }
    else if (t.dataset.th) { const v = t.dataset.th; if (v === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', v); document.querySelectorAll('[data-th]').forEach(b => b.setAttribute('aria-pressed', String(b === t))); }
  });
  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && state.pick) { state.pick = null; render(); return; }
    const t = ev.target.closest && ev.target.closest('[data-pick]');
    if (t && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); state.pick = t.dataset.pick; render(); }
  });
  load(0);
})();
