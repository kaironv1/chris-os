  // ---------- Ernährung (UI) – inserted into app.js at build time ----------
  const FD = window.Food;
  Object.assign(IC, {
    food: '<path d="M7 3.5v7.5M4.5 3.5v4.5a2.5 2.5 0 0 0 5 0V3.5M7 11v9.5M16.5 20.5V3.5c-2.2 1-3.5 3.6-3.5 7v3h3.5"/>'
  });
  const nlog = d => (S.nutrition.log[d] || []);
  const nctx = () => ({ foods: S.nutrition.foods, portions: S.nutrition.portions, meals: S.nutrition.meals });
  // Protein of a day: what the log knows plus older quick entries and corrections (training.protein)
  const protTotal = d => Math.round((S.training.protein[d] || 0) + nlog(d).reduce((s, e) => s + (e.p || 0), 0));
  const nowHM = () => { const t = new Date(); return pad2(t.getHours()) + ':' + pad2(t.getMinutes()); };
  const unitOf = e => ((e.fl || '').includes('d') ? ' ml' : ' g');
  const kcalText = t => (t.inc ? 'mindestens ' : '') + n0(t.kcal, 0) + ' kcal';
  const gText = v => n0(v, v < 10 ? 1 : 0) + ' g';

  // ---------- Input with live recognition ----------
  function previewHtml(text, full) {
    const q = String(text || '').trim();
    if (!q) return full ? '<p class="small muted">Mehrere Sachen mit Komma oder „und“ trennen. Mengen gehen auch: „250 g Skyr“, „2 Scheiben Brot“, „großer Salat mit Hähnchen“.</p>' : '';
    const r = FD.parse(q, nctx());
    if (!r.items.length && !r.unknown.length) return '<p class="small muted">Nichts zum Eintragen erkannt.</p>';
    const sum = FD.totals(r.items);
    const rows = r.items.map(i => `<li><span class="nf-n">${esc(i.name)}${i.side ? ' <span class="muted">dazu</span>' : ''}${i.fuzzy ? ' <span class="tag">erkannt</span>' : ''}</span><span class="nf-a">${esc(i.amt)}</span><span class="nf-v num">${gText(i.p)} Eiweiß${i.kcal == null ? '' : ', ' + n0(i.kcal, 0) + ' kcal'}</span></li>`).join('');
    const unk = r.unknown.map(u => `<li class="nf-unk"><span>„${esc(u)}“ nicht erkannt</span><button class="btn sm ghost" data-a="nf.newFood" data-v="${esc(u)}">Als Lebensmittel anlegen</button></li>`).join('');
    const tot = r.items.length > 1 ? `<p class="nf-sum">Zusammen <b>${gText(sum.p)} Eiweiß</b>, ${kcalText(sum)}</p>` : '';
    return `<ul class="nf-list">${rows}${unk}</ul>${tot}`;
  }
  // Frequent foods and saved meals as one-tap chips; without history, the old protein list of the user
  function quickList(d) {
    const out = S.nutrition.meals.slice(0, 3).map(m => ({ label: m.name, meal: m.id }));
    // What you typed often, in your own words ("Skyr mit Beeren"), counted once per day
    const since = E.addDays(E.today(), -60), cnt = {};
    Object.entries(S.nutrition.log).forEach(([day, list]) => {
      if (day < since) return;
      const seen = new Set();
      list.forEach(e => { if (!e.seg || e.src === 'schnell' || e.src === 'mahlzeit') return; const k = e.seg.toLowerCase(); if (seen.has(k)) return; seen.add(k); const c = cnt[k] || (cnt[k] = { n: 0, label: e.seg, t: -1 }); c.n++; if ((e.t || 0) >= c.t) { c.t = e.t || 0; c.label = e.seg; } });
    });
    Object.values(cnt).filter(c => c.n >= 2).sort((a, b) => b.n - a.n || b.t - a.t).slice(0, 5 - out.length).forEach(c => out.push({ label: c.label, text: c.label }));
    if (out.length < 2) {
      (S.training.foods || []).forEach(f => {
        if (out.length >= 4) return;
        const r = FD.parse(f.name, nctx());
        if (r.items.length && !r.unknown.length) out.push({ label: f.name, text: f.name });
      });
    }
    ui.quick = out;
    return out;
  }
  function foodBox(d, where) {
    const full = where === 'page';
    const q = quickList(d);
    return `<div class="nf" data-d="${d}" data-w="${full ? 'page' : 'heute'}">
      <div class="nf-row"><input class="nf-in" type="text" enterkeyhint="done" autocomplete="off" spellcheck="false" placeholder="${full ? 'z. B. 2 Eier, Brot mit Käse, Kaffee' : 'Was hast du gegessen?'}" value="${esc(ui.nText || '')}" data-i="nf.text" data-enter="nf.add" data-d="${d}" aria-label="Was hast du gegessen?"><button class="btn" data-a="nf.add" data-d="${d}">Eintragen</button></div>
      <div class="nf-prev" aria-live="polite">${previewHtml(ui.nText, full)}</div>
      ${q.length ? `<div class="nf-quick" role="group" aria-label="Schnell eintragen">${q.map((x, i) => `<button class="chip" data-a="nf.quick" data-v="${i}" data-d="${d}">${ic('plus')}${esc(x.label)}</button>`).join('')}</div>` : ''}
    </div>`;
  }
  // Inside the Training tile on Heute (Chris asked for Eiweiß there)
  function proteinBlock(d) {
    const g = protTotal(d), goal = S.settings.proteinGoal || 0, t = FD.totals(nlog(d));
    const pct = goal ? Math.min(100, Math.round(g / goal * 100)) : 0;
    return `<div class="pblock"><h3 class="mini-h">${ic('food')}Eiweiß heute</h3>
      <div class="prot-head"><span class="prot-val">${g} g</span><span class="small ink2">${goal ? (g >= goal ? 'Ziel von ' + goal + ' g erreicht' : 'noch ' + (goal - g) + ' g bis ' + goal + ' g') : ''}${t.n && t.kcal ? ', ' + kcalText(t) : ''}</span></div>
      <div class="meter" style="margin:6px 0 12px" role="meter" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${g}" aria-label="Eiweiß heute"><i style="width:${pct}%"></i></div>
      ${foodBox(d, 'heute')}
      <a class="link-btn small" href="#/training/ernaehrung" style="display:inline-block;margin-top:8px">Ernährungsprotokoll mit Kalorien und Nährstoffen</a></div>`;
  }
  const proteinSum = d => {
    const g = protTotal(d), goal = S.settings.proteinGoal || 0, pct = goal ? Math.min(100, Math.round(g / goal * 100)) : 0;
    return `Eiweiß ${g} von ${goal} g <i class="fs-meter" aria-hidden="true"><b style="width:${pct}%"></b></i>`;
  };

  // ---------- Adding ----------
  function addEntries(d, items, slot, msg) {
    const L = S.nutrition.log[d] || (S.nutrition.log[d] = []);
    const today = d === E.today(), auto = FD.slotAt(nowHM());
    const sl = slot || (today ? auto : 'abend');
    const time = today && sl === auto ? nowHM() : FD.SLOT_TIME[sl];
    const ids = [];
    items.forEach(it => {
      const e = Object.assign({}, it, { id: uid('n'), t: Date.now(), slot: sl, time });
      delete e.side; delete e.fuzzy; delete e.skip;
      L.push(e); ids.push(e.id);
    });
    L.sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
    save(); render();
    const p = items.reduce((s, i) => s + (i.p || 0), 0);
    toast((msg ? msg + ': ' : 'Eingetragen: ') + gText(p) + ' Eiweiß' + (items.some(i => i.kcal == null) ? '' : ', ' + n0(items.reduce((s, i) => s + (i.kcal || 0), 0), 0) + ' kcal'), () => {
      S.nutrition.log[d] = (S.nutrition.log[d] || []).filter(e => !ids.includes(e.id));
    });
  }
  function addFromText(d, text, page) {
    const r = FD.parse(text, nctx());
    if (!r.items.length) { toast(r.unknown.length ? 'Nicht erkannt: ' + r.unknown.join(', ') + '. Leg es als eigenes Lebensmittel an.' : 'Bitte eintragen, was du gegessen hast.'); return; }
    ui.nText = r.unknown.join(', ');
    addEntries(d, r.items, r.slot || (page ? ui.nSlot : null));
    if (r.unknown.length) setTimeout(() => toast('Eingetragen. Nicht erkannt: ' + r.unknown.join(', ') + '. Anlegen oder anders schreiben?'), 50);
  }

  // ---------- Ernährung page (Training) ----------
  function ring(g, goal) {
    const r = 46, c = 2 * Math.PI * r, p = goal ? Math.min(1, g / goal) : 0;
    return `<svg class="ring" viewBox="0 0 120 120" role="img" aria-label="Eiweiß ${g} von ${goal} g"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--denim-wash)" stroke-width="11"/>
      ${p > 0 ? `<circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--c1)" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/>` : ''}
      <text x="60" y="58" text-anchor="middle" class="ring-v">${g} g</text><text x="60" y="78" text-anchor="middle" class="ring-l">von ${goal} g</text></svg>`;
  }
  function macroRow(label, v, ref, note) {
    const p = ref ? Math.min(100, Math.round(v / ref * 100)) : 0;
    return `<div class="goal-row mac"><span>${esc(label)}</span><div class="meter" aria-hidden="true"><i style="width:${p}%"></i></div><span class="num small ink2">${esc(note)}</span></div>`;
  }
  function dayBalance(d) {
    const L = nlog(d), t = FD.totals(L), g = protTotal(d), goal = S.settings.proteinGoal || 0, kg = S.settings.kcalGoal || 0;
    const extra = Math.round(S.training.protein[d] || 0);
    const eK = t.kcal || 1, share = v => Math.round(v / eK * 100);
    const slots = FD.SLOTS.map(([k, l]) => ({ k, l, p: Math.round(t.slot[k]) })), maxS = Math.max(40, ...slots.map(s => s.p));
    return `<div class="panel"><div class="sec-head"><h2 class="sec-title">Tagesbilanz</h2><span class="sec-meta">${d === E.today() ? 'heute' : E.fmtLong(d)}</span></div>
      <div class="bal"><div>${ring(g, goal)}</div><div class="bal-k">
        <div class="bal-big">${t.n ? kcalText(t) : '0 kcal'}</div><p class="small ink2">${kg ? (t.kcal >= kg ? 'Kalorien-Ziel erreicht' : 'noch ' + n0(kg - t.kcal, 0) + ' kcal bis ' + n0(kg, 0)) : 'Kalorien-Ziel optional in den Einstellungen'}</p>
        ${extra ? `<p class="small muted">Davon ${extra > 0 ? extra + ' g Eiweiß' : extra + ' g Korrektur'} ohne Lebensmittel eingetragen.</p>` : ''}</div></div>
      ${t.n ? `<div style="margin-top:14px">
        ${macroRow('Kohlenhydrate', t.c, 300, gText(t.c) + (t.kcal ? ', ' + share(t.c * 4) + ' %' : ''))}
        ${macroRow('Fett', t.f, 90, gText(t.f) + (t.kcal ? ', ' + share(t.f * 9) + ' %' : ''))}
        ${macroRow('Ballaststoffe', t.fib, 30, n0(t.fib) + ' von 30 g')}
        ${macroRow('Obst und Gemüse', t.fvPortions, 5, n0(t.fvPortions) + ' von 5')}
        ${t.water ? macroRow('Wasser und Tee', t.water / 1000, 2, n0(t.water / 1000) + ' l') : ''}</div>
        <p class="small muted" style="margin-top:4px">Prozent: Anteil an den Kalorien. Obst und Gemüse in Portionen, etwa eine Handvoll.</p>
        <h3 class="mini-h">Eiweiß über den Tag</h3><div class="slotbars">${slots.map(s => `<div class="sb"><span class="sb-l">${s.l}</span><span class="sb-t"><i class="sl-${s.k}" style="width:${Math.round(s.p / maxS * 100)}%"></i></span><span class="num small">${s.p} g</span></div>`).join('')}</div>
        <p class="small muted" style="margin-top:8px">Für den Muskelaufbau hilft es, Eiweiß auf drei bis vier Mahlzeiten zu verteilen, je etwa 20 bis 40 g. Orientierung bei Ballaststoffen und Obst und Gemüse: Empfehlung der Deutschen Gesellschaft für Ernährung.</p>`
        : '<p class="small ink2" style="margin-top:12px">Noch nichts eingetragen. Schreib einfach, was du gegessen hast; die App erkennt Lebensmittel, Mengen und Nährwerte.</p>'}</div>`;
  }
  function mealList(d) {
    const L = nlog(d);
    if (!L.length) return '';
    return `<div class="panel" style="margin-top:16px"><h2 class="sec-title" style="margin-bottom:6px">${d === E.today() ? 'Heute gegessen' : 'Gegessen am ' + E.fmtShort(d)}</h2>
      ${FD.SLOTS.map(([k, l]) => {
        const es = L.filter(e => e.slot === k); if (!es.length) return '';
        const t = FD.totals(es);
        return `<div class="meal"><div class="meal-h"><span class="sw sl-${k}" aria-hidden="true"></span><h3>${l}</h3><span class="small ink2 num">${gText(t.p)} Eiweiß, ${kcalText(t)}</span><span class="grow"></span><button class="btn sm ghost" data-a="nf.mealSave" data-d="${d}" data-k="${k}">Merken</button></div>
          <ul class="checklist">${es.map(e => `<li><button class="nf-entry" data-a="nf.edit" data-d="${d}" data-id="${e.id}" aria-label="${esc(e.name)} bearbeiten"><span class="nf-n">${esc(e.name)}</span><span class="nf-a">${esc(e.amt || '')}${e.time ? ', ' + e.time : ''}</span><span class="nf-v num"><b>${gText(e.p || 0)}</b>${e.kcal == null ? '' : ' ' + n0(e.kcal, 0) + ' kcal'}</span></button></li>`).join('')}</ul></div>`;
      }).join('')}</div>`;
  }
  function weekCharts() {
    const t = E.today(), bars = [], kc = [];
    for (let i = 13; i >= 0; i--) {
      const d = E.addDays(t, -i), L = nlog(d), tt = FD.totals(L), lbl = E.fmtShort(d), short = i % 2 ? '' : lbl;
      bars.push({ label: lbl, short, frueh: tt.slot.frueh, mittag: tt.slot.mittag, snack: tt.slot.snack, abend: tt.slot.abend, extra: Math.max(0, (S.training.protein[d] || 0)) });
      if (L.length) kc.push({ label: lbl, short, v: tt.kcal });
    }
    const series = FD.SLOTS.map(([k, l]) => ({ key: k, color: `var(--sl-${k})`, name: l })).concat(bars.some(b => b.extra) ? [{ key: 'extra', color: 'var(--sl-extra)', name: 'ohne Lebensmittel' }] : []);
    return `<div class="panel"><h2 class="sec-title" style="margin-bottom:10px">Eiweiß, letzte 14 Tage</h2>${barChart('nprot', bars, { label: 'Eiweiß pro Tag nach Mahlzeit', goal: S.settings.proteinGoal, unit: ' g', series, xcol: 'Tag' })}</div>
      ${kc.length >= 2 ? `<div class="panel" style="margin-top:16px"><h2 class="sec-title" style="margin-bottom:10px">Kalorien an Tagen mit Einträgen</h2>${barChart('nkcal', kc, { label: 'Kalorien pro Tag', goal: S.settings.kcalGoal || 0, unit: ' kcal', name: 'Kalorien', xcol: 'Tag' })}</div>` : ''}`;
  }
  function avgTiles() {
    const t = E.today(), days = [];
    for (let i = 0; i < 7; i++) { const d = E.addDays(t, -i); if (nlog(d).length) days.push(d); }
    if (days.length < 2) return '';
    const T0 = days.map(d => FD.totals(nlog(d))), avg = k => T0.reduce((s, x) => s + x[k], 0) / days.length;
    const goal = S.settings.proteinGoal || 0, hit = days.filter(d => goal && protTotal(d) >= goal).length;
    return `<div class="stats stats2" style="margin-top:16px">
      <div class="stat"><div class="stat-val">${Math.round(days.reduce((s, d) => s + protTotal(d), 0) / days.length)} g</div><div class="stat-label">Eiweiß im Schnitt, Ziel an ${hit} von ${days.length} Tagen erreicht</div></div>
      <div class="stat"><div class="stat-val">${n0(avg('kcal'), 0)}</div><div class="stat-label">kcal im Schnitt${T0.some(x => x.inc) ? ', manche Tage unvollständig' : ''}</div></div>
      <div class="stat"><div class="stat-val">${n0(avg('fib'), 0)} g</div><div class="stat-label">Ballaststoffe im Schnitt, Orientierung 30 g</div></div>
      <div class="stat"><div class="stat-val">${n0(Math.round(avg('fvPortions') * 2) / 2)}</div><div class="stat-label">Portionen Obst und Gemüse, Orientierung 5</div></div></div>
      <p class="small muted" style="margin-top:6px">Letzte 7 Tage, gezählt werden nur Tage mit Einträgen (${days.length}).</p>`;
  }
  function ownLists() {
    const F0 = S.nutrition.foods, M0 = S.nutrition.meals;
    return `<div class="two-col" style="margin-top:22px">
      <div class="panel"><div class="sec-head"><h2 class="sec-title">Meine Lebensmittel</h2><button class="btn sm quiet" data-a="nf.newFood">${ic('plus')}Anlegen</button></div>
        ${F0.length ? `<ul class="checklist">${F0.map(f => `<li><div class="check-body"><div class="check-name">${esc(f.name)}</div><div class="check-meta">${n0(f.dp, 0)} g je Portion: ${n0(f.p * f.dp / 100)} g Eiweiß, ${n0(f.kcal * f.dp / 100, 0)} kcal${f.alias ? '. Auch: ' + esc(f.alias) : ''}</div></div><button class="btn sm ghost" data-a="nf.editFood" data-id="${f.id}">Bearbeiten</button></li>`).join('')}</ul>`
          : '<p class="small ink2">Für alles, was die App nicht kennt oder genauer sein soll, etwa dein Proteinpulver oder ein Lieblingsgericht. Die Werte stehen auf der Packung; danach erkennt die App es beim Eintippen.</p>'}</div>
      <div class="panel"><h2 class="sec-title" style="margin-bottom:6px">Meine Mahlzeiten</h2>
        ${M0.length ? `<ul class="checklist">${M0.map(m => `<li><div class="check-body"><div class="check-name">${esc(m.name)}</div><div class="check-meta">${esc(m.items.map(i => i.name).join(', '))}: ${gText(m.items.reduce((s, i) => s + (i.p || 0), 0))} Eiweiß</div></div><button class="icon-btn" data-a="nf.mealDel" data-id="${m.id}" aria-label="${esc(m.name)} löschen">${ic('trash')}</button></li>`).join('')}</ul>`
          : '<p class="small ink2">Isst du etwas öfter gleich, etwa dein Frühstück? Tippe in der Liste bei der Mahlzeit auf „Merken“. Dann trägst du alles mit einem Tipp ein oder schreibst einfach den Namen.</p>'}</div></div>`;
  }
  function viewNutrition() {
    const t = E.today(), d = ui.nDate || t;
    const auto = FD.slotAt(nowHM()), sl = ui.nSlot || (d === t ? auto : 'abend');
    const days = [[E.addDays(t, -2), E.WD_LONG[E.weekday(E.addDays(t, -2))]], [E.addDays(t, -1), 'Gestern'], [t, 'Heute']];
    return `<div class="row wrap" style="gap:10px;margin-bottom:16px">${seg('Tag', days, d, { a: 'nf.date' })}<span class="grow"></span><button class="btn sm ghost" data-a="nf.csv">${ic('download')}Als Tabelle speichern</button></div>
      <div class="two-col"><div>
        <div class="panel"><h2 class="sec-title" style="margin-bottom:10px">Was hast du gegessen?</h2>
          ${foodBox(d, 'page')}
          <div class="hrow" style="margin-top:8px"><span class="hlbl">Mahlzeit</span>${seg('Mahlzeit', FD.SLOTS.map(s => [s[0], s[1]]), sl, { a: 'nf.slot' })}</div>
          <details class="how"><summary>Nur Eiweiß schätzen</summary><p class="how-text">Wenn du nicht weißt, was drin war, etwa im Restaurant.</p>
            <div class="row wrap" style="margin-top:8px">${[10, 20, 30].map(x => `<button class="btn sm quiet" data-a="protein.add" data-v="${x}" data-d="${d}">+${x} g</button>`).join('')}<button class="btn sm ghost" data-a="protein.edit" data-d="${d}">Tagessumme korrigieren</button></div></details></div>
        ${mealList(d)}
      </div><div>${dayBalance(d)}${avgTiles()}<div style="margin-top:16px">${weekCharts()}</div></div></div>
      ${ownLists()}
      <p class="small muted" style="margin-top:16px">Die Nährwerte sind Durchschnittswerte aus Nährwerttabellen (${FD.count} Lebensmittel und Gerichte, offline in der App). Für Verpacktes stehen die genauen Werte auf der Packung; leg es dann als eigenes Lebensmittel an. Was du isst, bleibt auf diesem Gerät.</p>`;
  }

  // ---------- Dialogs ----------
  function entryDialog(d, id) {
    const e = nlog(d).find(x => x.id === id); if (!e) return;
    ui.nEdit = { d, id };
    const quick = !e.g;
    openDialog(`${dlgHead(e.name)}<p class="small muted" style="margin:-6px 0 12px">${esc(e.amt || '')}: ${gText(e.p || 0)} Eiweiß${e.kcal == null ? '' : ', ' + n0(e.kcal, 0) + ' kcal, ' + gText(e.c || 0) + ' Kohlenhydrate, ' + gText(e.f || 0) + ' Fett'}</p>
      <form class="form-grid" id="nf-form" onsubmit="return false">
        ${quick ? `<label class="field"><span>Eiweiß in g</span><input name="p" type="number" inputmode="decimal" min="0" step="1" value="${e.p || 0}"></label>`
          : `<label class="field"><span>Menge in ${unitOf(e).trim()}</span><input name="g" type="number" inputmode="decimal" min="1" step="1" value="${e.g}"></label>`}
        <label class="field"><span>Mahlzeit</span><select name="slot">${FD.SLOTS.map(s => `<option value="${s[0]}"${s[0] === e.slot ? ' selected' : ''}>${s[1]}</option>`).join('')}</select></label>
        <label class="field"><span>Uhrzeit</span><input name="time" type="time" value="${e.time || ''}"></label>
        ${e.def && !quick ? `<p class="hint full">Änderst du die Menge, merkt sich die App das als deine Portion für ${esc(e.name)}.</p>` : ''}</form>
      <div class="sheet-foot"><button class="btn danger left" data-a="nf.del">${ic('trash')}Löschen</button><button class="btn quiet" data-a="nf.again">Nochmal</button><button class="btn" data-a="nf.save">Speichern</button></div>`);
  }
  function foodDialog(id, name) {
    const f = id ? S.nutrition.foods.find(x => x.id === id) : { name: name ? capF(name) : '', alias: '', dp: 100, kcal: '', p: '', c: '', f: '', fib: '' };
    ui.nFood = { id: id || null, per: id ? 'portion' : 'portion' };
    // Number fields need a point as decimal mark: n0 wrote „17,5“ (or „1.155“ for 1155 kcal), the field stayed empty or
    // showed 1,155, and saving turned the value into 0 (2.15)
    const k = id ? f.dp / 100 : 1, v = x => (x === '' || x == null ? '' : String(Math.round(x * k * 10) / 10));
    openDialog(`${dlgHead(id ? f.name : 'Lebensmittel anlegen')}<form class="form-grid" id="fd-form" onsubmit="return false">
      <label class="field full"><span>Name</span><input name="name" value="${esc(f.name)}" ${id ? '' : 'autofocus'}></label>
      <label class="field full"><span>Weitere Namen (optional, mit Komma)</span><input name="alias" value="${esc(f.alias || '')}" placeholder="z. B. Shake, Proteinshake"></label>
      <label class="field"><span>Portion in g oder ml</span><input name="dp" type="number" inputmode="decimal" min="1" value="${f.dp}"></label>
      <div class="field"><span>Die Werte gelten für</span>${seg('Werte für', [['portion', 'eine Portion'], ['100', '100 g']], 'portion', { a: 'nf.per' })}</div>
      <label class="field"><span>Kalorien (kcal)</span><input name="kcal" type="number" inputmode="decimal" min="0" value="${v(f.kcal)}"></label>
      <label class="field"><span>Eiweiß (g)</span><input name="p" type="number" inputmode="decimal" min="0" step="0.1" value="${v(f.p)}"></label>
      <label class="field"><span>Kohlenhydrate (g)</span><input name="c" type="number" inputmode="decimal" min="0" step="0.1" value="${v(f.c)}"></label>
      <label class="field"><span>Fett (g)</span><input name="f" type="number" inputmode="decimal" min="0" step="0.1" value="${v(f.f)}"></label>
      <label class="field"><span>Ballaststoffe (g)</span><input name="fib" type="number" inputmode="decimal" min="0" step="0.1" value="${v(f.fib)}"></label></form>
      <div class="sheet-foot">${id ? `<button class="btn danger left" data-a="nf.delFood" data-id="${id}">${ic('trash')}Löschen</button>` : ''}<button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="nf.saveFood">Speichern</button></div>`);
  }
  function csvFood() {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const head = ['Datum', 'Uhrzeit', 'Mahlzeit', 'Lebensmittel', 'Menge', 'Gramm', 'kcal', 'Eiweiß (g)', 'Kohlenhydrate (g)', 'Fett (g)', 'Ballaststoffe (g)'];
    const lines = [head.map(q).join(';')];
    Object.keys(S.nutrition.log).sort().forEach(d => nlog(d).forEach(e => lines.push([d, e.time || '', FD.SLOT_NAME[e.slot] || '', e.name, e.amt || '', e.g || '', e.kcal == null ? '' : e.kcal, n0(e.p || 0), e.c == null ? '' : n0(e.c), e.f == null ? '' : n0(e.f), e.fib == null ? '' : n0(e.fib)].map(q).join(';'))));
    return '﻿' + lines.join('\r\n');
  }
  // Nutrition-derived factors for the check-in (shown under Einflüsse; they count for the patterns automatically)
  function nutriHint(d) {
    const f = FD.factors(nlog(d)), parts = [];
    if (f.kaffee) parts.push(f.kaffee + (f.kaffee === 1 ? ' Kaffee' : ' Kaffee'));
    if (f.alkohol) parts.push('Alkohol');
    if (f.knoblauch) parts.push('Knoblauch oder Zwiebeln');
    if (f.spaet) parts.push('spät gegessen');
    if (f.nuechtern) parts.push('lange nichts gegessen');
    if (f.wasser) parts.push(n0(f.wasser) + ' l getrunken');
    return parts.length ? `<p class="small ink2 nutri-hint">${ic('food')}<span>Aus deinem Ernährungsprotokoll: ${esc(parts.join(', '))}. Zählt für die Muster mit, solange du hier nichts anderes einträgst.</span></p>` : '';
  }

  // ---------- Actions ----------
  const NA = {
    'nf.add': el => { const box = el.closest('.nf'), inp = box && box.querySelector('.nf-in'); const d = el.dataset.d || E.today(); addFromText(d, inp ? inp.value : ui.nText, !!box && box.dataset.w === 'page'); },
    'nf.quick': el => {
      const x = (ui.quick || [])[+el.dataset.v], d = el.dataset.d; if (!x) return;
      if (x.meal) { const m = S.nutrition.meals.find(y => y.id === x.meal); if (m) addEntries(d, m.items.map(i => Object.assign({}, i, { src: 'mahlzeit', def: false })), null, m.name); return; }
      if (x.text) { const r = FD.parse(x.text, nctx()); if (r.items.length) addEntries(d, r.items, r.slot, x.label); }
    },
    'nf.date': el => { ui.nDate = el.dataset.v; ui.nSlot = null; render(); },
    'nf.slot': el => { ui.nSlot = el.dataset.v; render(); },
    'nf.edit': el => entryDialog(el.dataset.d, el.dataset.id),
    'nf.save': () => {
      const { d, id } = ui.nEdit, L = nlog(d), i = L.findIndex(x => x.id === id); if (i < 0) return;
      const f = new FormData($('#nf-form')), e = L[i];
      let ne = Object.assign({}, e, { slot: f.get('slot') || e.slot, time: f.get('time') || e.time });
      let learned = '';
      if (!e.g) { const p = +String(f.get('p')).replace(',', '.'); if (isFinite(p) && p >= 0) ne.p = Math.round(p * 10) / 10; }
      else {
        const g = +String(f.get('g')).replace(',', '.');
        if (!(g > 0)) { toast('Bitte eine Menge über 0 eintragen.'); return; }
        if (Math.round(g) !== e.g) {
          ne = Object.assign(FD.scale(ne, g), { amt: Math.round(g) + unitOf(e) });
          if (e.def && e.key && !/^eiweiss$/.test(e.key)) { S.nutrition.portions[e.key] = Math.round(g); learned = 'Gemerkt: ' + e.name + ' künftig ' + Math.round(g) + unitOf(e) + '.'; }
          ne.def = false;
        }
      }
      L[i] = ne; L.sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
      save(); closeDialog(); render(); toast(learned || 'Gespeichert');
    },
    'nf.del': () => { const { d, id } = ui.nEdit, L = nlog(d), e = L.find(x => x.id === id); S.nutrition.log[d] = L.filter(x => x.id !== id); save(); closeDialog(); render(); if (e) toast(e.name + ' gelöscht', () => { (S.nutrition.log[d] = S.nutrition.log[d] || []).push(e); }); },
    'nf.again': () => { const { d, id } = ui.nEdit, e = nlog(d).find(x => x.id === id); closeDialog(); if (e) addEntries(E.today(), [Object.assign({}, e)], null, e.name); },
    'nf.mealSave': el => {
      const d = el.dataset.d, k = el.dataset.k, es = nlog(d).filter(e => e.slot === k && e.key !== 'eiweiss');
      if (!es.length) return;
      ui.nMeal = { d, k };
      openDialog(`${dlgHead('Als Mahlzeit merken')}<p class="small ink2" style="margin-bottom:10px">${esc(es.map(e => e.name).join(', '))}</p><label class="field"><span>Name</span><input id="meal-in" autofocus value="Mein ${esc(FD.SLOT_NAME[k])}"></label><p class="hint" style="margin-top:6px">Später reicht ein Tipp oder du schreibst den Namen ins Feld.</p><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="nf.mealOk">Merken</button></div>`);
    },
    'nf.mealOk': () => {
      const name = ($('#meal-in').value || '').trim(); if (!name) return;
      const { d, k } = ui.nMeal;
      const items = nlog(d).filter(e => e.slot === k && e.key !== 'eiweiss').map(e => ({ key: e.key, name: e.name, g: e.g, amt: e.amt, kcal: e.kcal, p: e.p, c: e.c, f: e.f, fib: e.fib, cat: e.cat, fl: e.fl, cups: e.cups || 0 }));
      S.nutrition.meals = S.nutrition.meals.filter(m => FD.norm(m.name) !== FD.norm(name)).concat([{ id: uid('m'), name, items }]);
      save(); closeDialog(); render(); toast('„' + name + '“ gemerkt');
    },
    'nf.mealDel': el => { const m = S.nutrition.meals.find(x => x.id === el.dataset.id); S.nutrition.meals = S.nutrition.meals.filter(x => x.id !== el.dataset.id); save(); render(); if (m) toast('Mahlzeit gelöscht', () => { S.nutrition.meals.push(m); }); },
    'nf.newFood': el => foodDialog(null, el && el.dataset ? el.dataset.v : ''),
    'nf.editFood': el => foodDialog(el.dataset.id),
    'nf.per': el => { ui.nFood.per = el.dataset.v; el.closest('.seg').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === el)); },
    'nf.saveFood': () => {
      const f = new FormData($('#fd-form')), num = k => { const v = +String(f.get(k) || '').replace(',', '.'); return isFinite(v) && v >= 0 ? v : 0; };
      const name = String(f.get('name') || '').trim(); if (!name) { toast('Bitte einen Namen eintragen.'); return; }
      const dp = Math.max(1, num('dp') || 100), k = ui.nFood.per === '100' ? 1 : 100 / dp;
      const data = { name, alias: String(f.get('alias') || '').trim(), dp, kcal: Math.round(num('kcal') * k), p: Math.round(num('p') * k * 10) / 10, c: Math.round(num('c') * k * 10) / 10, f: Math.round(num('f') * k * 10) / 10, fib: Math.round(num('fib') * k * 10) / 10 };
      if (ui.nFood.id) Object.assign(S.nutrition.foods.find(x => x.id === ui.nFood.id), data); else S.nutrition.foods.push(Object.assign({ id: uid('f') }, data));
      save(); closeDialog(); render(); toast('„' + name + '“ gespeichert. Die App erkennt es ab jetzt beim Eintippen.');
    },
    'nf.delFood': el => { S.nutrition.foods = S.nutrition.foods.filter(x => x.id !== el.dataset.id); save(); closeDialog(); render(); },
    'nf.csv': () => download('ernaehrung-' + E.today() + '.csv', csvFood(), 'text/csv')
  };
  const NI = {
    'nf.text': el => { ui.nText = el.value; const box = el.closest('.nf'), pv = box && box.querySelector('.nf-prev'); if (pv) pv.innerHTML = previewHtml(el.value, box.dataset.w === 'page'); }
  };
  Object.assign(A, NA); Object.assign(I, NI);
  // ---------- end Ernährung ----------
