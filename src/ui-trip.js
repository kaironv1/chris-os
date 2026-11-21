  // ---------- Reisen mit Packliste (2.11, K52) ----------
  // Shares the scope of app.js. Trips live in S.trips; the weather at the destination is fetched from Open-Meteo
  // (already allowed) and saved quietly, the outfits and the packing list are computed on display.
  const TR = window.Trip;
  const trips = () => (S.trips = S.trips || []);
  const tripById = id => trips().find(t => t.id === id);
  ui.tripSel = null; ui.tripDraft = null; ui.tripMemo = {}; ui.tripBusy = {}; ui.tripFail = {}; ui.tripRes = [];
  const TRIP_STALE = 3 * 3600e3;
  const tripWxKey = t => (t.loc ? t.loc.lat + ',' + t.loc.lon : '') + '|' + t.from + '|' + t.to;
  function tripPlan(t) {
    const k = t.id + '|' + ver + '|' + (t.wx ? t.wx.at : 0);
    if (!ui.tripMemo[k]) { ui.tripMemo = {}; const p = TR.plan(S, t); ui.tripMemo[k] = { p, G: TR.list(S, t, p) }; }
    return ui.tripMemo[k];
  }
  async function tripWx(t, force) {
    if (!t || !t.loc) return;
    const q = TR.wxUrl(t, E.today()), now = Date.now();
    if (!q) return;
    if (!force && t.wx && t.wx.key === tripWxKey(t) && t.wx.kind === q.kind && now - (t.wx.at || 0) < TRIP_STALE) return;
    if (!force && ui.tripFail[t.id] && now - ui.tripFail[t.id] < 10 * 60e3) return;
    if (ui.tripBusy[t.id]) return;
    ui.tripBusy[t.id] = true;
    try {
      const w = TR.wxDaily(await getJSON(q.url), q.kind, t);
      if (!w) throw new Error('keine Werte');
      t.wx = { kind: w.kind, days: w.days, n: w.n, at: Date.now(), key: tripWxKey(t) };
      delete ui.tripFail[t.id];
      save(true);
    } catch (e) { ui.tripFail[t.id] = Date.now(); }
    finally { ui.tripBusy[t.id] = false; if (route().top === 'outfit' || route().top === 'heute') render(); }
  }
  const tripOcc = o => (E.OCC[o] ? E.OCC[o].label : o);
  function tripBar(t, G) {
    const p = TR.progress(t, G);
    return `<div class="trip-prog"><span class="num">${p.done} von ${p.total} gepackt</span><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.done}"><i style="width:${p.total ? Math.round(100 * p.done / p.total) : 0}%"></i></div></div>`;
  }
  function tripWxLine(t, d) {
    const w = t.wx && t.wx.days && t.wx.days[d];
    if (!w) return ui.tripBusy[t.id] ? 'Wetter wird geladen' : 'ohne Wetter, Jahreszeit';
    const k = t.wx.kind === 'vorjahr' ? ' (Vorjahr)' : '';
    return `${w.code != null ? wxIcon(w.code) : ''}${Math.round(w.tn)}° bis ${Math.round(w.tx)}°${w.r >= 50 ? ', Regen ' + w.r + ' %' : ''}${k}`;
  }
  function tripFit(o) {
    if (!o) return '<span class="small muted">Kein passendes Outfit im Schrank.</span>';
    const its = [...(o.outer ? [o.outer] : []), ...o.tops.slice().reverse(), o.bottom, o.shoes].filter(Boolean);
    return `<div class="trip-fit">${its.map(i => `<span class="trip-tile" title="${esc(capF(i.label))}">${art(i)}</span>`).join('')}</div><div class="small ink2">${its.map(i => esc(capF(i.label))).join(', ')}${o.outerHint ? ', dazu fehlt: ' + o.outerHint : ''}</div>`;
  }
  function tripCard(t, today) {
    const { G } = tripPlan(t), st = TR.status(t, today);
    const when = st === 'unterwegs' ? 'unterwegs, bis ' + E.fmtShort(t.to) : st === 'vorbei' ? 'vorbei' : 'in ' + pl2(E.diffDays(today, t.from), 'Tag', 'Tagen');
    return `<button class="panel trip-card" data-a="trip.open" data-id="${t.id}"><div class="row" style="align-items:baseline"><strong class="grow">${esc(TR.title(t))}</strong><span class="tag">${esc(when)}</span></div>
      <div class="small ink2">${esc(TR.range(t))}, ${pl2(TR.nights(t), 'Nacht', 'Nächte')}${t.loc ? ', ' + esc(t.loc.name) : ''}${t.kind === 'arbeit' ? ', Arbeit' : ''}</div>${st === 'vorbei' ? '' : tripBar(t, G)}</button>`;
  }
  function viewTrips() {
    const today = E.today();
    const sel = ui.tripSel && tripById(ui.tripSel);
    if (sel) return tripDetail(sel, today);
    const T = trips().slice().sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));
    const cur = T.filter(t => t.to >= today), past = T.filter(t => t.to < today).reverse();
    return `<div class="row wrap" style="margin-bottom:14px"><button class="btn sm" data-a="trip.new">${ic('plus')}Reise planen</button><span class="small ink2">Ziel und Tage eingeben, die App plant Outfits aus deinem Schrank fürs Wetter dort und macht daraus eine Packliste.</span></div>
      ${cur.length ? `<div class="trip-list">${cur.map(t => tripCard(t, today)).join('')}</div>` : `<div class="empty">Noch keine Reise geplant.</div>`}
      ${past.length ? `<details class="exp-old" style="margin-top:14px"><summary>Frühere Reisen (${past.length})</summary><div class="trip-list">${past.map(t => tripCard(t, today)).join('')}</div></details>` : ''}`;
  }
  function tripDetail(t, today) {
    const { p, G } = tripPlan(t), st = TR.status(t, today);
    const wxNote = ui.tripBusy[t.id] ? 'Wetter wird geladen …' : !t.loc ? 'Ohne Ziel rechnet die App mit der Jahreszeit zu Hause.' : ui.tripFail[t.id] && !t.wx ? 'Das Wetter für das Ziel ließ sich nicht laden; gerechnet mit der Jahreszeit. Die App versucht es später wieder.' : TR.wxText(t.wx);
    const days = p.days.map(x => `<li class="trip-day"><div class="trip-when"><strong>${E.WD[E.weekday(x.date)]} ${E.fmtShort(x.date)}</strong><span class="small ink2 trip-wx">${tripWxLine(t, x.date)}</span><span class="small ink2">${esc(TR.tempLine(x.ctx))}</span></div>
        <div class="grow">${tripFit(x.o)}</div>
        <label class="trip-occ small"><span class="sr-only">Anlass am ${E.fmtShort(x.date)}</span><select data-c="trip.occ" data-id="${t.id}" data-d="${x.date}">${Object.entries(E.OCC).map(([k, v]) => `<option value="${k}"${k === x.ctx.occasion ? ' selected' : ''}>${v.label}</option>`).join('')}</select></label></li>`).join('');
    const groups = G.map(g => `<section class="trip-group"><h3 class="sec-title" style="margin:14px 0 6px">${g.l} <span class="muted num">${g.items.filter(x => t.packed[x.key]).length} von ${g.items.length}</span></h3>
      <ul class="checklist">${g.items.map(x => `<li class="${t.packed[x.key] ? 'done' : ''}"><button class="check" data-a="trip.pack" data-id="${t.id}" data-key="${esc(x.key)}" aria-pressed="${!!t.packed[x.key]}" aria-label="${esc(x.name)}: ${t.packed[x.key] ? 'gepackt' : 'noch packen'}">${ic('check')}</button><div class="check-body"><div class="check-name">${x.n > 1 ? x.n + '× ' : ''}${esc(capF(x.name))}</div>${x.sub ? `<div class="check-meta">${esc(capF(x.sub))}</div>` : ''}</div>${x.own ? `<button class="icon-btn" data-a="trip.extra.del" data-id="${t.id}" data-i="${x.key.slice(2)}" aria-label="${esc(x.name)} von der Liste nehmen">${ic('x')}</button>` : ''}</li>`).join('')}</ul></section>`).join('');
    return `<div class="row wrap" style="margin-bottom:12px"><button class="btn sm quiet" data-a="trip.back">${ic('back')}Alle Reisen</button><span class="grow"></span><button class="btn sm quiet" data-a="trip.edit" data-id="${t.id}">${ic('edit')}Bearbeiten</button></div>
      <header class="page-head trip-head" style="margin-bottom:10px"><div><h2 class="page-title" style="font-size:1.4rem">${esc(TR.title(t))}</h2><p class="page-sub">${esc(TR.range(t))}, ${pl2(TR.nights(t), 'Nacht', 'Nächte')}${t.loc ? ', ' + esc(t.loc.name) : ''}${t.kind === 'arbeit' ? ', Arbeitsreise' : ''}${st === 'unterwegs' ? ', du bist unterwegs' : st === 'vorbei' ? ', vorbei' : ''}.</p></div></header>
      <div class="panel trip-days"><div class="row" style="align-items:baseline;margin-bottom:6px"><h2 class="sec-title grow">Outfits für die Tage</h2><button class="btn sm ghost" data-a="trip.wx" data-id="${t.id}">${ic('refresh')}Wetter neu laden</button></div>
        <p class="small ink2 trip-src" style="margin:0 0 10px">${esc(wxNote)} Den Anlass je Tag kannst du ändern; die App wählt Teile so, dass du wenig einpacken musst.</p>
        <ul class="trip-daylist">${days}</ul>
        ${p.outerHint ? `<p class="small" style="margin:10px 0 0">Für die kühlen Tage fehlt im Schrank: ${esc(p.outerHint)}.</p>` : ''}</div>
      <div class="panel trip-pack" style="margin-top:14px"><div class="row" style="align-items:baseline"><h2 class="sec-title grow">Packliste</h2>${tripBar(t, G)}</div>
        ${groups}
        <div class="row" style="margin-top:12px;gap:8px"><input class="search grow" placeholder="Eigenes hinzufügen, z. B. Buch" data-enter="trip.add" data-id="${t.id}" aria-label="Eigenes zur Packliste hinzufügen" id="trip-add"><button class="btn sm quiet" data-a="trip.add" data-id="${t.id}">${ic('plus')}Hinzufügen</button></div>
        <details style="margin-top:12px"><summary class="small" style="cursor:pointer">So entsteht die Liste</summary><ul class="how-text small" style="margin:8px 0 0;padding-left:18px"><li>Die Outfits bewertet die App wie zu Hause (Anlass, gefühlte Temperatur, Farben, Lagen), zieht aber Punkte ab für jedes Teil, das neu in den Koffer müsste. Hemden und T-Shirts einmal, Strick und Hosen etwa drei Tage, höchstens zwei Paar Schuhe, eine Jacke für die ganze Reise. Ab acht Tagen rechnet sie mit Waschen unterwegs. Teile in der Wäsche zählen mit.</li><li>Kulturbeutel: deine Produkte aus der Pflege und das Werkzeug für Rhythmen, die in die Reise fallen. Medikamente: alles, was im Zeitraum läuft, mit der Zahl der Einnahmen.</li><li>Vorhersage bis 16 Tage voraus; für spätere Reisen die Werte derselben Wochen im Vorjahr. Übertragen werden nur die Koordinaten des Ziels (Open-Meteo).</li></ul></details>
        <div class="row wrap" style="margin-top:14px;gap:8px"><button class="btn sm ghost" data-a="trip.reset" data-id="${t.id}">Häkchen zurücksetzen</button><span class="grow"></span><button class="btn sm ghost danger" data-a="trip.del" data-id="${t.id}">${ic('trash')}Reise löschen</button></div></div>`;
  }
  function tripSync() {
    const f = $('#trip-form'); if (!f || !ui.tripDraft) return;
    const d = new FormData(f);
    ui.tripDraft.name = String(d.get('name') || '').trim();
    ui.tripDraft.from = String(d.get('from') || ''); ui.tripDraft.to = String(d.get('to') || '');
    ui.tripDraft.kind = String(d.get('kind') || 'privat');
  }
  function tripDialog(id) {
    const t = id ? tripById(id) : null;
    if (!ui.tripDraft || ui.tripDraft.id !== (id || null)) ui.tripDraft = t ? { id, name: t.name, loc: t.loc, from: t.from, to: t.to, kind: t.kind } : { id: null, name: '', loc: null, from: E.addDays(E.today(), 7), to: E.addDays(E.today(), 9), kind: 'privat' };
    const D = ui.tripDraft;
    openDialog(`${dlgHead(id ? 'Reise bearbeiten' : 'Reise planen')}<form class="form-grid" id="trip-form" onsubmit="return false">
      <div class="field full"><span>Ziel</span><div class="row" style="gap:8px"><input class="search grow" id="trip-q" placeholder="Ort suchen, z. B. Lissabon" value="${D.loc ? esc(D.loc.name) : ''}" data-enter="trip.search" aria-label="Zielort suchen" ${id ? '' : 'autofocus'}><button class="btn sm" data-a="trip.search">Suchen</button></div><div id="trip-res" class="small" style="margin-top:6px">${D.loc ? 'Gewählt: ' + esc(D.loc.name) : 'Noch kein Ziel gewählt; ohne Ziel rechnet die App mit der Jahreszeit zu Hause.'}</div></div>
      <label class="field"><span>Von</span><input type="date" name="from" value="${D.from}"></label>
      <label class="field"><span>Bis</span><input type="date" name="to" value="${D.to}"></label>
      <label class="field full"><span>Name (optional)</span><input name="name" value="${esc(D.name)}" placeholder="z. B. Städtetrip"></label>
      <div class="field full"><span>Art</span><div class="schips">${TR.KINDS.map(([v, l]) => `<label class="chip"><input type="radio" name="kind" value="${v}"${D.kind === v ? ' checked' : ''} style="accent-color:var(--denim)"> ${l}</label>`).join('')}</div><span class="small muted">Bei einer Arbeitsreise plant die App an Werktagen Smart Casual.</span></div></form>
      <div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="trip.save">${id ? 'Speichern' : 'Reise anlegen'}</button></div>`);
  }
  // Weather for the trips ahead, at the start and when the app comes back to the front
  function refreshTrips() { const t = E.today(); trips().filter(x => x.to >= t && x.loc).forEach(x => tripWx(x)); }
  // The line on Heute: a trip within a week or under way
  function tripToday(d) {
    const x = TR.todayLine(S, d);
    if (!x) return '';
    const { t, st } = x, { p, G } = tripPlan(t), pr = TR.progress(t, G);
    let text;
    if (st === 'unterwegs') { const day = p.days.find(y => y.date === d); text = `Unterwegs: ${esc(TR.title(t))} bis ${E.fmtShort(t.to)}.` + (day && day.o ? ' Heute: ' + [...day.o.tops.slice().reverse(), day.o.bottom, day.o.shoes].filter(Boolean).map(i => esc(capF(i.label))).join(', ') + '.' : ''); }
    else text = `${esc(TR.title(t))} ${x.inDays === 0 ? 'heute' : x.inDays === 1 ? 'morgen' : 'in ' + x.inDays + ' Tagen'}: ${pr.done} von ${pr.total} gepackt.`;
    return `<div class="note info trip-note">${ic('ext')}<p class="grow">${text}</p><button class="btn sm quiet" data-a="trip.open" data-id="${t.id}">${st === 'unterwegs' ? 'Reise' : 'Packliste'}</button></div>`;
  }
  Object.assign(A, {
    'trip.new': () => { ui.tripDraft = null; tripDialog(null); },
    'trip.edit': el => { ui.tripDraft = null; tripDialog(el.dataset.id); },
    'trip.open': el => { ui.tripSel = el.dataset.id; if (route().top !== 'outfit' || route().sub !== 'reisen') location.hash = '#/outfit/reisen'; else render(); },
    'trip.back': () => { ui.tripSel = null; render(); },
    'trip.search': async () => {
      tripSync();
      const q = $('#trip-q').value.trim(); if (!q) return;
      const box = $('#trip-res'); box.innerHTML = 'Suche …';
      try {
        const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=de&format=json&name=' + encodeURIComponent(q)).then(x => x.json());
        const res = r.results || [];
        ui.tripRes = res;
        box.innerHTML = res.length ? `<ul class="checklist">${res.map((x, i) => `<li><div class="check-body"><div class="check-name">${esc(x.name)}</div><div class="check-meta">${esc([x.admin1, x.country].filter(Boolean).join(', '))}</div></div><button class="btn sm quiet" data-a="trip.loc" data-i="${i}">Übernehmen</button></li>`).join('')}</ul>` : 'Kein Ort gefunden.';
      } catch (e) { box.innerHTML = 'Die Ortssuche braucht eine Internetverbindung.'; }
    },
    'trip.loc': el => { tripSync(); const x = ui.tripRes[+el.dataset.i]; ui.tripDraft.loc = { name: x.name + (x.admin1 ? ' (' + x.admin1 + ')' : '') + (x.country && x.country !== 'Deutschland' ? ', ' + x.country : ''), lat: +x.latitude.toFixed(4), lon: +x.longitude.toFixed(4) }; tripDialog(ui.tripDraft.id); },
    'trip.save': () => {
      tripSync();
      const D = ui.tripDraft;
      if (!D.from || !/^\d{4}-\d{2}-\d{2}$/.test(D.from)) { toast('Bitte ein Datum für den Beginn wählen.'); return; }
      if (D.to && D.to < D.from) { toast('Das Ende liegt vor dem Beginn.'); return; }
      if (D.to && E.diffDays(D.from, D.to) >= TR.MAX_DAYS) { toast('Die App plant höchstens ' + TR.MAX_DAYS + ' Tage am Stück.'); return; }
      let t = D.id ? tripById(D.id) : null;
      if (t) { const moved = t.from !== D.from || t.to !== D.to; Object.assign(t, { name: D.name, loc: D.loc, from: D.from, to: D.to || D.from, kind: D.kind }); if (moved) t.occ = {}; }
      else { t = TR.create(D, E.today()); trips().push(t); }
      ui.tripDraft = null; ui.tripSel = t.id;
      save(); closeDialog(); render(); toast(D.id ? 'Reise gespeichert' : 'Reise angelegt');
      tripWx(t, true);
    },
    'trip.wx': el => { const t = tripById(el.dataset.id); if (t) { if (!t.loc) { toast('Zuerst ein Ziel wählen (Bearbeiten).'); return; } tripWx(t, true); render(); } },
    'trip.pack': el => { const t = tripById(el.dataset.id); if (!t) return; const k = el.dataset.key; if (t.packed[k]) delete t.packed[k]; else t.packed[k] = true; save(); render(); },
    'trip.add': el => { const t = tripById(el.dataset.id), inp = $('#trip-add'); if (!t || !inp) return; const v = inp.value.trim(); if (!v) return; t.extra = t.extra || []; t.extra.push(v); save(); render(); const n = $('#trip-add'); if (n) n.focus(); },
    'trip.extra.del': el => { const t = tripById(el.dataset.id); if (!t) return; const i = +el.dataset.i; t.extra.splice(i, 1); const pk = {}; Object.keys(t.packed).forEach(k => { if (!k.startsWith('e:')) pk[k] = true; else { const j = +k.slice(2); if (j < i) pk[k] = true; else if (j > i) pk['e:' + (j - 1)] = true; } }); t.packed = pk; save(); render(); },
    'trip.reset': el => { const t = tripById(el.dataset.id); if (!t) return; t.packed = {}; save(); render(); },
    'trip.del': el => confirmDlg('Reise löschen?', 'Die Reise mit ihrer Packliste wird entfernt. Dein Kleiderschrank bleibt.', 'Löschen', () => { S.trips = trips().filter(x => x.id !== el.dataset.id); ui.tripSel = null; save(); render(); toast('Reise gelöscht'); }, true)
  });
  Object.assign(C, {
    'trip.occ': el => { const t = tripById(el.dataset.id); if (!t) return; t.occ = t.occ || {}; t.occ[el.dataset.d] = el.value; save(); render(); }
  });
  // ---------- end Reisen ----------
