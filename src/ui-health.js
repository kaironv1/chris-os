  // ---------- Gesundheit (UI) – inserted into app.js at build time ----------
  const H = window.Health;
  Object.assign(IC, {
    health: '<path d="M12 20s-7.5-4.6-7.5-10A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7.5 3c0 5.4-7.5 10-7.5 10z"/><path d="M7.5 12.5h2.5l1.5-2.5 2 4 1.5-1.5h1.5"/>',
    pill: '<g transform="rotate(-45 12 12)"><rect x="3.5" y="8.25" width="17" height="7.5" rx="3.75"/><path d="M12 8.25v7.5"/></g>',
    doc: '<path d="M6 4v5a4 4 0 0 0 8 0V4M10 13v2a4.5 4.5 0 0 0 9 0v-2"/><circle cx="19" cy="11" r="2"/>',
    cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5"/>',
    note: '<path d="M5 4.5h10l4 4v11H5z"/><path d="M15 4.5v4h4M8 12h8M8 15.5h6"/>',
    phone: '<path d="M6 4h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
    print: '<path d="M7 9V4h10v5M7 17H5v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6h-2M8 14h8v6H8z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>', back: '<path d="M15 5l-7 7 7 7"/>', skip: '<path d="M6 5l8 7-8 7M18 5v14"/>',
    stretch: '<circle cx="12" cy="4.5" r="2"/><path d="M4 9.5l8 1 8-1M12 10.5v4l-4 6M12 14.5l4 6"/>'
  });
  const hday = d => (S.health.days || {})[d] || null;
  function hEdit(d) {
    const D = S.health.days; if (!D[d]) D[d] = { sym: {}, meas: [], f: {} };
    const x = D[d]; x.sym = x.sym || {}; x.meas = x.meas || []; x.f = x.f || {}; x.t = Date.now(); ui.savedPulse = true;
    if (d === E.today() && WX && WX.home && !x.wx) { const w = E.dayWeather(WX.home, d); if (w) x.wx = { tMin: Math.round(w.tMin), tMax: Math.round(w.tMax) }; }
    return x;
  }
  const docById = id => S.health.doctors.find(x => x.id === id);
  const docName = id => { const x = docById(id); return x ? (x.title + (x.name ? ', ' + x.name : '')) : 'Arzt'; };
  const WARN_CLS = { ruhig: 'ok', achtung: 'warn', schonen: 'stop', arzt: 'stop' };
  const warnReasons = w => w.red.concat(w.reasons);
  function warnPill(d, always) {
    const w = H.warning(S, d);
    if (!always && w.level === 'ruhig' && !w.hasToday && !w.basedOnYesterday) return '';
    return `<a class="day-pill wp wp-${WARN_CLS[w.level]}" href="#/gesundheit/muster" title="Frühwarnung: ${esc(H.LEVEL[w.level])}">${ic(w.level === 'ruhig' ? 'health' : 'alert')}${esc(H.LEVEL[w.level])}</a>`;
  }
  const fmtTime = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

  // ---------- Inputs ----------
  const SCALE_NAME = { mood: 'Befinden', energy: 'Energie', stress: 'Stress', sleepQ: 'Schlafqualität' };
  function scaleCtl(d, key, val, lo, hi) {
    return `<div class="scale-wrap"><div class="scale" role="group" aria-label="${esc(SCALE_NAME[key] || key)}: 1 ${esc(lo)} bis 5 ${esc(hi)}">${[1, 2, 3, 4, 5].map(n => `<button data-a="hc.set" data-d="${d}" data-k="${key}" data-v="${n}" aria-pressed="${val === n}">${n}</button>`).join('')}</div><div class="scale-ends"><span>${esc(lo)}</span><span>${esc(hi)}</span></div></div>`;
  }
  function sleepCtl(d, v) {
    return `<div class="row wrap" style="gap:6px">${[5, 6, 7, 8, 9].map(n => `<button class="chip" data-a="hc.set" data-d="${d}" data-k="sleepH" data-v="${n}" aria-pressed="${v === n}">${n} h</button>`).join('')}
      ${v != null ? `<span class="stepper"><button class="icon-btn" data-a="hc.step" data-d="${d}" data-k="sleepH" data-v="-0.5" aria-label="Eine halbe Stunde weniger">${ic('minus')}</button><span class="num" aria-live="polite">${n0(v)} h</span><button class="icon-btn" data-a="hc.step" data-d="${d}" data-k="sleepH" data-v="0.5" aria-label="Eine halbe Stunde mehr">${ic('plus')}</button></span>` : ''}</div>`;
  }
  const breathCtl = (d, v) => seg('Atem', [['0', 'Frisch'], ['1', 'Geht so'], ['2', 'Schlecht']], v == null ? '' : String(v), { a: 'hc.breath', d });
  function symChip(d, key, v) {
    v = v || 0;
    return `<button class="schip${v ? ' on lvl' + v : ''}" data-a="hc.sym" data-d="${d}" data-k="${esc(key)}" aria-label="${esc(H.symLabel(key))}: ${v ? H.INT[v] : 'nein'}"><span>${esc(H.symLabel(key))}</span><span class="dots" aria-hidden="true">${[1, 2, 3].map(i => `<i${i <= v ? ' class="on"' : ''}></i>`).join('')}</span></button>`;
  }
  function toggleChip(action, d, key, on, label) { return `<button class="chip" data-a="${action}" data-d="${d}" data-k="${esc(key)}" aria-pressed="${!!on}">${esc(label)}</button>`; }

  // ---------- Body map ----------
  const BM = {
    v: { base: '', parts: {
      kopf: '<circle cx="60" cy="20" r="14"/>', hals: '<rect x="53" y="34" width="14" height="10" rx="3"/>',
      schulter_r: '<ellipse cx="38" cy="52" rx="10" ry="7"/>', schulter_l: '<ellipse cx="82" cy="52" rx="10" ry="7"/>',
      brust: '<rect x="45" y="46" width="30" height="28" rx="6"/>', bauch: '<rect x="46" y="76" width="28" height="26" rx="6"/>',
      arm_r: '<rect x="25" y="60" width="11" height="54" rx="5" transform="rotate(8 30 87)"/>', arm_l: '<rect x="84" y="60" width="11" height="54" rx="5" transform="rotate(-8 90 87)"/>',
      hand_r: '<circle cx="25" cy="123" r="6"/>', hand_l: '<circle cx="95" cy="123" r="6"/>',
      huefte_r: '<rect x="45" y="104" width="14" height="40" rx="6"/>', huefte_l: '<rect x="61" y="104" width="14" height="40" rx="6"/>',
      knie_r: '<circle cx="52" cy="152" r="7"/>', knie_l: '<circle cx="68" cy="152" r="7"/>',
      schienbein_r: '<rect x="47" y="161" width="10" height="44" rx="5"/>', schienbein_l: '<rect x="63" y="161" width="10" height="44" rx="5"/>',
      fuss_r: '<ellipse cx="50" cy="213" rx="8" ry="5"/>', fuss_l: '<ellipse cx="70" cy="213" rx="8" ry="5"/>' } },
    h: { base: '<circle cx="60" cy="20" r="14"/><rect x="25" y="60" width="11" height="54" rx="5" transform="rotate(8 30 87)"/><rect x="84" y="60" width="11" height="54" rx="5" transform="rotate(-8 90 87)"/><circle cx="25" cy="123" r="6"/><circle cx="95" cy="123" r="6"/>', parts: {
      nacken: '<rect x="52" y="34" width="16" height="12" rx="4"/>', oberer_ruecken: '<rect x="42" y="46" width="36" height="30" rx="7"/>',
      unterer_ruecken: '<rect x="45" y="78" width="30" height="24" rx="6"/>', gesaess: '<rect x="44" y="104" width="32" height="20" rx="8"/>',
      oberschenkel_hl: '<rect x="45" y="126" width="14" height="28" rx="6"/>', oberschenkel_hr: '<rect x="61" y="126" width="14" height="28" rx="6"/>',
      wade_l: '<rect x="46" y="158" width="12" height="44" rx="6"/>', wade_r: '<rect x="62" y="158" width="12" height="44" rx="6"/>',
      ferse_l: '<ellipse cx="52" cy="211" rx="7" ry="5"/>', ferse_r: '<ellipse cx="68" cy="211" rx="7" ry="5"/>' } }
  };
  function bodyMap(d, x) {
    const fig = side => {
      const parts = Object.entries(BM[side].parts).map(([id, shape]) => {
        const r = H.regById(id), v = (x.sym || {})['bm:' + id] || 0;
        return `<g class="bm-r lv${v}" data-a="hc.bm" data-d="${d}" data-k="${id}" role="button" tabindex="0" aria-label="${esc(r.l)}: ${v ? H.INT[v] : 'keine Beschwerden'}"><title>${esc(r.l)}${v ? ', ' + H.INT[v] : ''}</title>${shape}</g>`;
      }).join('');
      return `<figure class="bm-fig"><svg viewBox="0 0 120 222" role="group" aria-label="Körper ${side === 'v' ? 'vorne' : 'hinten'}"><g class="bm-base">${BM[side].base}</g>${parts}</svg><figcaption>${side === 'v' ? 'Vorne' : 'Hinten'}</figcaption></figure>`;
    };
    const sel = Object.entries(x.sym || {}).filter(([k, v]) => k.startsWith('bm:') && v).map(([k, v]) => H.symLabel(k).replace('Schmerz ', '') + ' (' + H.INT[v] + ')');
    return `<div class="bm">${fig('v')}${fig('h')}</div><p class="small muted" style="margin-top:6px">${sel.length ? 'Schmerzen: ' + esc(sel.join(', ')) : 'Tippe auf eine Stelle: leicht, mittel, stark, wieder aus.'}</p>`;
  }

  // ---------- Heute: compact check-in ----------
  const hungerChip = (d, x) => x.breath >= 1 ? `<div class="hunger">${toggleChip('hc.f', d, 'nuechtern', (x.f || {}).nuechtern, 'Bei Hunger aufgefallen')}</div>` : '';
  function preventNote(w) {
    if (!w.prevent || !w.prevent.length) return '';
    return `<div class="warn-mini wp-calm">${ic('moon')}<div><b>Vorbeugen:</b> ${w.prevent.map(p => esc(p.text) + '. ' + esc(p.tip)).join(' ')}</div></div>`;
  }
  // Visible autosave: every tap saves at once; the badge shows when, and pulses right after a change
  function savedBadge(ts) {
    const just = ui.savedPulse; ui.savedPulse = false;
    const day = E.iso(new Date(ts));
    return `<span class="saved${just ? ' just' : ''}">${ic('check')}Gespeichert ${day === E.today() ? fmtTime(ts) : 'am ' + E.fmtShort(day)}</span>`;
  }
  // Last check-in change made today: today's entry, or yesterday's mood entered this morning
  const savedToday = (d, x, yx) => Math.max(x.t || 0, yx && yx.t && E.iso(new Date(yx.t)) === d ? yx.t : 0);
  const BREATH = ['frisch', 'geht so', 'schlecht'];
  function checkinSum(d, x, yx, early) {
    if (!H.hasData(x)) {
      if (savedToday(d, x, yx)) return 'Gestern eingetragen, heute noch offen';
      return early ? 'Schlaf und Anzeichen, dauert 10 Sekunden' : 'Noch nicht eingetragen, dauert 10 Sekunden';
    }
    const sym = Object.keys(x.sym || {}).filter(k => x.sym[k] && !k.startsWith('bm:')).map(k => H.symLabel(k) + ' ' + H.INT[x.sym[k]]);
    const bm = Object.keys(x.sym || {}).filter(k => x.sym[k] && k.startsWith('bm:')).length;
    const parts = [];
    if (x.sleepH != null) parts.push('Schlaf ' + n0(x.sleepH) + ' h');
    if (sym.length) parts.push(sym.join(', ')); else if (x.none && !bm) parts.push('nichts gespürt');
    if (bm) parts.push(bm === 1 ? '1 Schmerzstelle' : bm + ' Schmerzstellen');
    if (x.breath != null) parts.push('Atem ' + BREATH[x.breath]);
    if (x.mood != null) parts.push('Befinden ' + x.mood + ' von 5');
    return esc(parts.join(', '));
  }
  function checkinToday(d) {
    const x = hday(d) || { sym: {}, meas: [], f: {} };
    const w = H.warning(S, d);
    const early = new Date().getHours() < 11 && d === E.today();
    const yd = E.addDays(d, -1), yx = hday(yd);
    const ts = savedToday(d, x, yx);
    const moodRow = early
      ? ((!yx || yx.mood == null || E.iso(new Date(yx.t || 0)) === d) ? `<div class="hrow"><span class="hlbl">Gestern insgesamt</span>${scaleCtl(yd, 'mood', yx ? yx.mood : null, 'schlecht', 'sehr gut')}</div>` : '')
      : `<div class="hrow"><span class="hlbl">Befinden heute</span>${scaleCtl(d, 'mood', x.mood, 'schlecht', 'sehr gut')}</div>`;
    const meta = ts ? savedBadge(ts) : `<span class="fold-badge due">offen</span>`;
    const xs = expSum();
    return fold('checkin', 'Wie geht’s dir?', checkinSum(d, x, yx, early) + (xs ? esc(', ' + xs) : ''), meta, () => `
      <div class="hrow stack"><span class="hlbl">Schlaf letzte Nacht</span>${sleepCtl(d, x.sleepH)}</div>
      <div class="hrow stack"><span class="hlbl">Spürst du was?</span><div class="schips">${H.QUICK.map(k => symChip(d, k, x.sym[k])).join('')}<button class="chip" data-a="hc.none" data-d="${d}" aria-pressed="${!!x.none}">Nichts</button></div></div>
      <div class="hrow"><span class="hlbl">Atem</span><div>${breathCtl(d, x.breath)}${hungerChip(d, x)}</div></div>
      ${moodRow}
      ${expRow()}
      ${early ? '<p class="small muted" style="margin-top:6px">Wie der Tag insgesamt war, trägst du ab Mittag oder abends ein.</p>' : ''}
      ${w.level !== 'ruhig' ? `<div class="warn-mini wp-${WARN_CLS[w.level]}">${ic('alert')}<div><b>${esc(H.LEVEL[w.level])}:</b> ${esc(warnReasons(w).slice(0, 2).join(', '))}. <a href="#/gesundheit/muster">Was jetzt hilft</a></div></div>` : preventNote(w)}
      <p class="autosave">${ic('check')}Jede Angabe speichert sich sofort, ohne Knopf.</p>
      <a class="link-btn small" href="#/gesundheit" style="display:inline-block;margin-top:6px">Mehr eintragen: Stress, Maßnahmen, Körperkarte, Notiz</a>`);
  }

  // ---------- Heute: reminders (care, check-ups, appointments, meds) ----------
  function medsDue(d) {
    const out = [];
    for (const m of S.health.meds) {
      if (!medActive(m, d)) continue;
      for (const t of m.times) out.push({ m, t, done: !!(((S.health.intake[d] || {})[m.id] || {})[t]) });
    }
    return out.sort((a, b) => a.t < b.t ? -1 : 1);
  }
  function medActive(m, d) { return !m.stopped && m.start <= d && (!m.end || m.end >= d); }
  function remindersToday(d) {
    const meds = medsDue(d);
    const care = E.dueList(S, d);
    const vs = S.health.vorsorge.map(v => ({ v, du: H.vorsorgeDue(S, v, d) })).filter(x => x.du.state === 'faellig');
    const appts = S.health.appts.filter(a => !a.done && a.date >= d && E.diffDays(d, a.date) <= 7).sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1);
    const fu = (S.health.followups || []).filter(f => !f.done && f.by <= E.addDays(d, 7));
    const n = meds.filter(x => !x.done).length + care.length + vs.length + appts.length + fu.length;
    const wx = WX && WX.home ? E.dayWeather(WX.home, d) : null;
    const uv = wx && wx.uv != null ? Math.round(wx.uv) : null;
    const open = [...meds.filter(x => !x.done).map(x => x.m.name + ' ' + x.t), ...appts.map(a => docName(a.doc) + ' ' + E.fmtRel(a.date)), ...care.map(x => x.t.name), ...vs.map(x => x.v.name), ...fu.map(f => f.text)];
    const sum = (uv != null && uv >= 3 ? 'UV-Index ' + uv + ', Sonnenschutz. ' : '') + (open.length ? open.slice(0, 3).join(', ') + (open.length > 3 ? ' und ' + (open.length - 3) + ' mehr' : '') : 'Heute steht nichts an');
    const meta = n ? `<span class="fold-badge due">${n} offen</span>` : `<span class="fold-badge">nichts offen</span>`;
    return fold('reminders', 'Erinnerungen', esc(sum), meta, () => remindersBody(d, meds, care, vs, appts, fu, n, uv));
  }
  function remindersBody(d, meds, care, vs, appts, fu, n, uv) {
    let html = '';
    if (uv != null && uv >= 3) html += `<div class="warn-mini wp-warn" style="margin:2px 0 6px">${ic('sun')}<div><b>UV-Index ${uv}:</b> Sonnenschutz auf Gesicht, Ohren und Kopf.</div></div>`;
    if (meds.length) html += `<h3 class="mini-h">Medikamente</h3><ul class="checklist">${meds.map(x => `<li class="${x.done ? 'done' : ''}"><button class="check" data-a="med.take" data-id="${x.m.id}" data-t="${x.t}" data-d="${d}" aria-pressed="${x.done}" aria-label="${esc(x.m.name)} um ${x.t}">${ic('check')}</button><div class="check-body"><div class="check-name">${esc(x.m.name)} <span class="muted num">${x.t}</span></div><div class="check-meta">${esc([x.m.dose, x.m.note].filter(Boolean).join(', '))}</div></div></li>`).join('')}</ul>`;
    if (appts.length) html += `<h3 class="mini-h">Termine</h3><ul class="checklist">${appts.map(a => `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--denim)">${ic('doc')}</span><div class="check-body"><div class="check-name">${esc(docName(a.doc))}</div><div class="check-meta">${E.fmtRel(a.date)}${a.time ? ', ' + a.time + ' Uhr' : ''}${a.reason ? ', ' + esc(a.reason) : ''}</div></div></li>`).join('')}</ul>`;
    if (care.length) html += `<h3 class="mini-h">Pflege</h3><ul class="checklist">${care.map(x => checkRow(x.t, false, 'rhythm', d, dueText(x.d))).join('')}</ul>`;
    if (vs.length || fu.length) html += `<h3 class="mini-h">Beim Arzt zu erledigen</h3><ul class="checklist">${vs.map(x => `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--cognac)">${ic('cal')}</span><div class="check-body"><div class="check-name">${esc(x.v.name)}</div><div class="check-meta over">fällig seit ${E.fmtDate(x.du.date)}</div></div><a class="btn sm quiet" href="#/gesundheit/aerzte">Planen</a></li>`).join('')}${fu.map(f => `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--cognac)">${ic('cal')}</span><div class="check-body"><div class="check-name">${esc(f.text)}</div><div class="check-meta">bis ${E.fmtDate(f.by)}</div></div><button class="btn sm quiet" data-a="fu.done" data-id="${f.id}">Erledigt</button></li>`).join('')}</ul>`;
    if (!n && !meds.length) {
      const next = S.grooming.tasks.map(t => ({ t, du: E.due(S, t, d) })).filter(x => x.du.diff > 0).sort((a, b) => a.du.diff - b.du.diff)[0];
      html += `<p class="small ink2">Heute steht nichts an.${next ? ' Als Nächstes: ' + esc(next.t.name) + ' ' + E.fmtRel(next.du.date) + '.' : ''}</p>`;
    }
    return html;
  }

  // ---------- Gesundheit: view ----------
  function viewHealth(sub) {
    const tabs = `<nav class="tabs" aria-label="Gesundheit">${[['', 'Check-in'], ['verlauf', 'Verläufe'], ['muster', 'Muster'], ['experimente', 'Experimente'], ['aerzte', 'Ärzte und Vorsorge'], ['medikamente', 'Medikamente'], ['bericht', 'Bericht für den Arzt']].map(([k, l]) => `<a href="#/gesundheit${k ? '/' + k : ''}" aria-current="${(sub || '') === k ? 'page' : 'false'}">${l}</a>`).join('')}</nav>`;
    const head = `<header class="page-head"><div><h1 class="page-title">Gesundheit</h1><p class="page-sub">Kurz eintragen, wie es dir geht. Die App erkennt deine Muster und bereitet Arzttermine vor.</p></div>${warnPill(E.today())}</header>`;
    let body;
    if (sub === 'muster') body = viewPatterns();
    else if (sub === 'verlauf') body = viewTrends();
    else if (sub === 'experimente') body = viewExperiments();
    else if (sub === 'aerzte') body = viewDoctors();
    else if (sub === 'medikamente') body = viewMeds();
    else if (sub === 'bericht') body = viewReport();
    else body = viewCheckin();
    return `<div class="page">${head}${tabs}${body}<p class="small muted" style="margin-top:28px">Die Hinweise ersetzen keine ärztliche Beratung. Bei Atemnot, Brustschmerz oder sehr hohem Fieber: Praxis oder ärztlicher Bereitschaftsdienst 116 117, im Notfall 112.</p></div>`;
  }

  function viewCheckin() {
    const t = E.today();
    const d = ui.hDate || t;
    const x = hday(d) || { sym: {}, meas: [], f: {} };
    const groups = [...new Set(H.SYMPTOMS.map(s => s.g))];
    const custom = Object.keys(x.sym || {}).filter(k => k.startsWith('c:'));
    const daySel = `<div class="row wrap" style="gap:10px;margin-bottom:16px">${seg('Tag', [[E.addDays(t, -2), E.WD_LONG[E.weekday(E.addDays(t, -2))]], [E.addDays(t, -1), 'Gestern'], [t, 'Heute']], d, { a: 'hc.date' })}<span class="small muted grow">${x.t ? savedBadge(x.t) + ' ' : ''}Jede Angabe speichert sich sofort, ohne Knopf.</span><button class="btn sm ghost" data-a="ics.checkin">${ic('cal')}Tägliche Erinnerung</button></div>`;
    const left = `<div class="panel"><h2 class="sec-title" style="margin-bottom:10px">Allgemein</h2>
        <div class="hrow"><span class="hlbl">Befinden</span>${scaleCtl(d, 'mood', x.mood, 'schlecht', 'sehr gut')}</div>
        <div class="hrow"><span class="hlbl">Energie</span>${scaleCtl(d, 'energy', x.energy, 'leer', 'voll da')}</div>
        <div class="hrow"><span class="hlbl">Stress</span>${scaleCtl(d, 'stress', x.stress, 'entspannt', 'sehr hoch')}</div>
        <div class="hrow"><span class="hlbl">Schlaf</span>${sleepCtl(d, x.sleepH)}</div>
        <div class="hrow"><span class="hlbl">Schlafqualität</span>${scaleCtl(d, 'sleepQ', x.sleepQ, 'unruhig', 'erholsam')}</div>
        <div class="hrow"><span class="hlbl">Atem</span><div>${breathCtl(d, x.breath)}${hungerChip(d, x)}</div></div>
        <div class="hrow"><span class="hlbl">Temperatur</span><span class="row" style="gap:8px"><input type="text" inputmode="decimal" class="inline-num" value="${x.temp == null ? '' : n0(x.temp)}" placeholder="°C" data-c="hc.temp" data-d="${d}" aria-label="Körpertemperatur in Grad Celsius"><span class="small muted">nur wenn gemessen</span></span></div>
        ${expDayRow(d)}
      </div>
      <div class="panel" style="margin-top:16px"><div class="sec-head"><h2 class="sec-title">Beschwerden</h2><button class="chip" data-a="hc.none" data-d="${d}" aria-pressed="${!!x.none}">Keine Beschwerden</button></div>
        <p class="small muted" style="margin:-4px 0 10px">Tippen: leicht, mittel, stark, wieder aus.</p>
        ${groups.map(g => `<h3 class="mini-h">${g === 'Warnzeichen' ? 'Warnzeichen, bitte ärztlich abklären' : g}</h3><div class="schips">${H.SYMPTOMS.filter(s => s.g === g).map(s => symChip(d, s.id, x.sym[s.id])).join('')}${g === 'Körper' ? custom.map(k => symChip(d, k, x.sym[k])).join('') + `<button class="chip" data-a="hc.custom" data-d="${d}">${ic('plus')}Eigene</button>` : ''}</div>`).join('')}
      </div>`;
    const measures = S.health.measures.map(m => toggleChip('hc.meas', d, m.id, (x.meas || []).includes(m.id), m.l)).join('');
    const kaffee = [0, 1, 2, 3, 4, 5].map(n => `<button class="chip" data-a="hc.fnum" data-d="${d}" data-k="kaffee" data-v="${n}" aria-pressed="${(x.f || {}).kaffee === n}">${n === 5 ? '5+' : n}</button>`).join('');
    const wasser = [1, 1.5, 2, 2.5, 3].map(n => `<button class="chip" data-a="hc.fnum" data-d="${d}" data-k="wasser" data-v="${n}" aria-pressed="${(x.f || {}).wasser === n}">${n0(n)}${n === 3 ? '+' : ''} l</button>`).join('');
    const right = `<div class="panel"><h2 class="sec-title" style="margin-bottom:6px">Körperkarte</h2><p class="small muted" style="margin-bottom:10px">Wo tut es weh oder ist verspannt?</p>${bodyMap(d, x)}</div>
      <div class="panel" style="margin-top:16px"><div class="sec-head"><h2 class="sec-title">Maßnahmen</h2><span class="sec-meta">was du heute dagegen tust</span></div><div class="schips">${measures}<button class="chip" data-a="hc.measadd">${ic('plus')}Eigene</button></div></div>
      <div class="panel" style="margin-top:16px"><div class="sec-head"><h2 class="sec-title">Einflüsse</h2><span class="sec-meta">für Muster und Mundgeruch</span></div>
        <div class="hrow"><span class="hlbl">Kaffee</span><div class="schips">${kaffee}</div></div>
        <div class="hrow"><span class="hlbl">Getrunken</span><div class="schips">${wasser}</div></div>
        <div class="schips" style="margin-top:8px">${H.FACTORS.map(f => toggleChip('hc.f', d, f.id, (x.f || {})[f.id], f.l)).join('')}</div>
        <p class="small muted" style="margin-top:8px">Deine Routine (Zungenschaber, Zahnseide, Nasenspülung) gilt als erledigt, außer du markierst sie hier als ausgelassen.</p>${nutriHint(d)}</div>
      <div class="panel" style="margin-top:16px"><h2 class="sec-title" style="margin-bottom:8px">Notiz</h2><textarea class="area" rows="3" data-c="hc.note" data-i="hc.noteI" data-d="${d}" placeholder="Was dir sonst auffällt" aria-label="Notiz zum Tag">${esc(x.note || '')}</textarea>
        <div class="row wrap" style="margin-top:10px"><button class="btn sm quiet" data-a="obs.new">${ic('camera')}Beobachtung mit Foto festhalten</button><span class="small muted">z. B. Hautveränderung, Muttermal, Schwellung</span></div></div>`;
    const obs = S.health.obs.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 6);
    const obsHtml = obs.length ? `<h2 class="block-title">Beobachtungen</h2><div class="obs-list">${obs.map(o => `<article class="obs"><div class="obs-art">${Photos.url('obs:' + o.id) ? `<img src="${Photos.url('obs:' + o.id)}" alt="Foto: ${esc(o.text)}">` : ic('note')}</div><div><div class="check-name">${esc(o.text)}</div><div class="check-meta">${E.fmtDate(o.date)}${o.region ? ', ' + esc(H.regById(o.region) ? H.regById(o.region).l : o.region) : ''}${o.fach ? ', ' + esc(H.FACH[o.fach] || '') : ''}</div><button class="link-btn small" data-a="obs.del" data-id="${o.id}">Löschen</button></div></article>`).join('')}</div>` : '';
    return `${daySel}<div class="two-col">${'<div>' + left + '</div>'}${'<div>' + right + '</div>'}</div>${obsHtml}`;
  }

  // ---------- Muster ----------
  function heatCalendar() {
    const t = E.today(), start = E.addDays(E.weekStart(t), -7 * 11);
    const cells = [];
    for (let w = 0; w < 12; w++) for (let k = 0; k < 7; k++) {
      const d = E.addDays(start, w * 7 + k);
      if (d > t) { cells.push(`<i class="hc-cell future" style="grid-column:${w + 2};grid-row:${k + 1}"></i>`); continue; }
      const x = hday(d), has = H.hasData(x), sc = has ? H.infScore(x) : 0;
      const lvl = !has ? 'none' : sc === 0 ? 'zero' : sc < 2 ? 'l1' : sc < 4 ? 'l2' : 'l3';
      const tip = E.fmtLong(d) + ': ' + (!has ? 'kein Eintrag' : sc === 0 ? 'keine Infekt-Anzeichen' : H.describe(x, H.infSyms(x)));
      cells.push(`<i class="hc-cell ${lvl}${x && x.breath === 2 ? ' br' : ''}" style="grid-column:${w + 2};grid-row:${k + 1}" title="${esc(tip)}"></i>`);
    }
    const rows = ['Mo', '', 'Mi', '', 'Fr', '', 'So'].map((l, k) => `<span class="hc-lbl" style="grid-column:1;grid-row:${k + 1}">${l}</span>`).join('');
    return `<div class="hc" role="img" aria-label="Infekt-Anzeichen der letzten 12 Wochen">${rows}${cells.join('')}</div>
      <div class="legend" style="flex-wrap:wrap"><span><span class="sw" style="background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--line)"></span>ohne Anzeichen</span><span><span class="sw" style="background:var(--h1)"></span>leicht</span><span><span class="sw" style="background:var(--h2)"></span>deutlich</span><span><span class="sw" style="background:var(--h3)"></span>stark</span><span><span class="sw hc-br-sw"></span>Punkt: Atem schlecht</span><span class="muted">leer: kein Eintrag</span></div>`;
  }
  function viewPatterns() {
    const t = E.today();
    const w = H.warning(S, t);
    const epsAll = H.episodes(S, t);
    const eps = epsAll.slice().reverse();
    const ms = H.measureStats(S, epsAll);
    const of = H.onsetFactors(S, epsAll);
    const br = H.breathFactors(S);
    const logged = Object.keys(S.health.days).filter(d => H.hasData(S.health.days[d])).length;
    const rs = warnReasons(w);
    const warnCard = `<div class="panel warn-card wp-${WARN_CLS[w.level]}"><div class="row" style="align-items:flex-start;gap:14px"><span class="warn-ico">${ic(w.level === 'ruhig' ? 'health' : 'alert')}</span><div class="grow">
        <h2 class="sec-title">${esc(H.LEVEL[w.level])}</h2>
        <p class="ink2" style="margin-top:2px">${rs.length ? esc(capF(rs.join(', '))) + '.' : (w.hasToday ? 'Keine Anzeichen. Weiter so.' : 'Noch kein Check-in für heute.')}</p>
        ${w.personal && w.personal.n >= 3 ? `<p class="small muted" style="margin-top:4px">Deine Bilanz bei ähnlichen ersten Anzeichen: ${w.personal.n - w.personal.conv} von ${w.personal.n} Mal abgewendet.</p>` : ''}
        ${w.tips.length ? `<ul class="tips">${w.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${w.prevent && w.prevent.length ? `<ul class="tips">${w.prevent.map(p => `<li>${esc(p.text)}. ${esc(p.tip)}</li>`).join('')}</ul>` : ''}
        ${(S.health.profile || {}).triggers && S.health.profile.triggers.includes('schlaf') ? `<div class="row wrap" style="margin-top:12px;gap:8px"><span class="small ink2">Dein häufigster Auslöser ist Schlafmangel. Schlafkonto der letzten Nächte: ${w.sleep && w.sleep.nights ? (w.sleep.debt > 0 ? '−' + n0(w.sleep.debt) + ' h' : 'ausgeglichen') : 'noch keine Einträge'}.</span><button class="btn sm quiet" data-a="ics.bed">${ic('moon')}Bettzeit-Erinnerung in den Kalender</button>${expActive() ? '' : `<button class="btn sm quiet" data-a="exp.new" data-k="bett">Als Experiment testen</button>`}</div>` : ''}
        ${w.level === 'achtung' ? '<p class="small muted" style="margin-top:8px">Faustregel: Beschwerden nur oberhalb des Halses, also Nase oder leichtes Halskratzen, vertragen oft lockere Bewegung. Fieber, Gliederschmerzen oder Husten heißen Pause.</p>' : ''}
      </div></div></div>`;
    const epHtml = eps.length ? `<ul class="checklist">${eps.slice(0, 12).map(e => `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--cognac)">${ic('health')}</span><div class="check-body"><div class="check-name">${E.fmtShort(e.start)}${e.end !== e.start ? ' bis ' + E.fmtShort(e.end) : ''}, ${e.length} ${e.length === 1 ? 'Tag' : 'Tage'}</div>
        <div class="check-meta">Zuerst: ${esc(e.first.map(H.symLabel).join(', ') || 'unklar')}${e.early.length ? '. Früh getan: ' + esc(e.early.map(id => (S.health.measures.find(m => m.id === id) || { l: id }).l).join(', ')) : '. Keine Maßnahmen eingetragen'}.</div>
        <label class="small ink2 ep-out">Verlauf <select data-c="ep.out" data-k="${e.start}" class="inline-sel" aria-label="Verlauf der Episode ab ${E.fmtShort(e.start)}">${['abgewendet', 'leicht', 'krank', 'laeuft'].map(o => `<option value="${o}"${o === e.outcome ? ' selected' : ''}>${H.OUTCOME[o]}</option>`).join('')}</select>${e.manual ? '' : ' <span class="muted">geschätzt</span>'}</label></div></li>`).join('')}</ul>`
      : `<p class="small ink2">Noch keine Infekt-Episode erfasst. Sobald du Anzeichen wie Halskratzen einträgst, fasst die App zusammenhängende Tage zu einer Episode zusammen und schätzt den Verlauf. Du kannst ihn korrigieren.</p>`;
    const msHtml = ms.length ? `<ul class="checklist">${ms.map(x => `<li><div class="check-body"><div class="row" style="align-items:baseline"><div class="check-name grow">${esc(x.m.l)}</div><span class="num small">${x.ok} von ${x.n} abgewendet</span></div>
        <div class="meter olive" style="margin-top:6px" aria-hidden="true"><i style="width:${Math.round((x.rate || 0) * 100)}%"></i></div>
        <div class="check-meta">${x.nNot ? 'Ohne diese Maßnahme: ' + Math.round((x.rateNot || 0) * 100) + ' % abgewendet (' + x.nNot + ' Episoden). ' : ''}${x.n < 3 ? 'Noch wenig Daten.' : ''}</div></div></li>`).join('')}</ul>`
      : `<p class="small ink2">Trag bei ersten Anzeichen ein, was du dagegen tust. Nach ein paar Episoden siehst du hier, was bei dir wirklich hilft.</p>`;
    const ofHtml = of.length ? `<ul class="checklist">${of.slice(0, 5).map(x => `<li><div class="check-body"><div class="row" style="align-items:baseline"><div class="check-name grow">${esc(x.label)}</div>${x.lift >= 1.5 ? '<span class="tag cognac">auffällig</span>' : ''}</div><div class="check-meta">vor einem Infekt an ${Math.round(x.p * 100)} % der Tage, sonst an ${Math.round(x.b * 100)} %</div></div></li>`).join('')}</ul>`
      : (epsAll.length >= 2 && logged >= 21 ? `<p class="small ink2">Bisher fällt vor deinen Infekten nichts Besonderes auf. Je mehr Check-ins, desto genauer wird der Vergleich.</p>`
        : `<p class="small ink2">Braucht mindestens zwei Episoden und ein paar Wochen Check-ins. Dann vergleicht die App die Tage vor einem Infekt mit normalen Tagen: Schlaf, Stress, Ansteckung, Kälte, Training.</p>`);
    const brTotal = br.rated || 0;
    const brF = br.factors.filter(f => f.diff >= 0.25).slice(0, 5).concat(br.factors.filter(f => f.diff <= -0.3).slice(-2));
    const brHtml = `<div class="panel"><div class="sec-head"><h2 class="sec-title">Mundgeruch</h2><span class="sec-meta">${brTotal} Tage bewertet</span></div>
      ${brTotal ? `<div class="segbar" role="img" aria-label="Atem: frisch ${br.dist[0]}, geht so ${br.dist[1]}, schlecht ${br.dist[2]}" style="height:16px">${[0, 1, 2].map(k => br.dist[k] ? `<i style="flex:${br.dist[k]};background:var(--br${k})" title="${['frisch', 'geht so', 'schlecht'][k]}: ${br.dist[k]}"></i>` : '').join('')}</div><div class="legend"><span><span class="sw" style="background:var(--br0)"></span>frisch ${br.dist[0]}</span><span><span class="sw" style="background:var(--br1)"></span>geht so ${br.dist[1]}</span><span><span class="sw" style="background:var(--br2)"></span>schlecht ${br.dist[2]}</span></div>` : ''}
      ${brF.length ? `<h3 class="mini-h">Was mit deinem Atem zusammenhängt</h3><ul class="checklist">${brF.map(f => `<li><div class="check-body"><div class="row" style="align-items:baseline"><div class="check-name grow">${esc(f.label)}</div>${f.diff >= 0.4 ? '<span class="tag cognac">auffällig</span>' : f.diff <= -0.3 ? '<span class="tag olive">eher besser</span>' : ''}</div><div class="check-meta">Atem im Schnitt ${breathWord(f.avgWith)} an ${f.nWith} Tagen damit, ${breathWord(f.avgWithout)} an ${f.nWithout} Tagen ohne</div></div></li>`).join('')}</ul>`
        : `<p class="small ink2" style="margin-top:8px">${brTotal >= 14 ? 'Bisher hängt nichts deutlich mit deinem Atem zusammen. Bleib beim kurzen Eintrag, das Bild wird mit jeder Woche genauer.' : 'Bewerte beim Check-in kurz deinen Atem und trag Kaffee, Trinkmenge und Ausnahmen ein. Ab etwa zwei Wochen zeigt die App, welche Einflüsse bei dir mit Mundgeruch zusammenfallen.'}</p>`}
      ${breathHunch(br)}
      <details class="how" style="margin-top:10px"><summary>Was Mundgeruch häufig auslöst</summary><p class="how-text">Meist entsteht er im Mund selbst: Belag auf dem hinteren Zungenrücken, Zahnfleischtaschen oder ein trockener Mund, etwa durch Mundatmung bei verstopfter Nase, viel Kaffee oder wenig Trinken. Seltener stecken Mandeln, Nebenhöhlen oder Sodbrennen dahinter. Bleibt er trotz guter Pflege häufig, lohnt ein Termin beim Zahnarzt (Zahnfleisch, professionelle Reinigung) und danach bei Bedarf beim HNO-Arzt.</p></details></div>`;
    const days30 = [];
    for (let i = 29; i >= 0; i--) { const d = E.addDays(t, -i), x = hday(d); if (x && x.sleepH != null) days30.push({ x: E.fmtShort(d), y: x.sleepH, tip: n0(x.sleepH) + ' h am ' + E.fmtShort(d) }); }
    const mood30 = [];
    for (let i = 29; i >= 0; i--) { const d = E.addDays(t, -i), x = hday(d); if (x && x.mood != null) mood30.push({ x: E.fmtShort(d), y: x.mood, tip: 'Befinden ' + x.mood + ' von 5 am ' + E.fmtShort(d) }); }
    return `${warnCard}
      <div class="two-col" style="margin-top:22px">
        <div class="panel"><div class="sec-head"><h2 class="sec-title">Infekt-Verlauf</h2><span class="sec-meta">${logged} Tage erfasst</span></div>${heatCalendar()}<a class="link-btn small" href="#/gesundheit/verlauf">Alle Verläufe: Beschwerden, Schlaf, Wochentage</a></div>
        <div class="panel"><h2 class="sec-title" style="margin-bottom:8px">Episoden</h2>${epHtml}</div>
      </div>
      <div class="two-col" style="margin-top:22px">
        <div class="panel"><h2 class="sec-title" style="margin-bottom:2px">Was bei dir wirkt</h2><p class="small muted" style="margin-bottom:8px">Maßnahmen in den ersten zwei Tagen einer Episode und wie es ausging</p>${msHtml}</div>
        <div class="panel"><h2 class="sec-title" style="margin-bottom:2px">Was vor einem Infekt auffällt</h2><p class="small muted" style="margin-bottom:8px">Die zwei Tage vor den ersten Anzeichen im Vergleich zu normalen Tagen</p>${ofHtml}</div>
      </div>
      <div class="two-col" style="margin-top:22px">${brHtml}
        <div class="panel"><h2 class="sec-title" style="margin-bottom:8px">Schlaf, letzte 30 Tage</h2>${lineChart('sleep30', days30, { label: 'Schlaf in Stunden', unit: 'h', col: 'Schlaf', pad: 0.5, h: 180 })}
          <h2 class="sec-title" style="margin:18px 0 8px">Befinden, letzte 30 Tage</h2>${lineChart('mood30', mood30, { label: 'Befinden von 1 bis 5', unit: '', col: 'Befinden', pad: 0.5, h: 160 })}</div>
      </div>`;
  }
  // Next dental check from the user's own Vorsorge data, e.g. " (fällig ab März 2027)"
  function zahnNext() {
    const v = S.health.vorsorge.find(x => x.id === 'zahn'); if (!v) return '';
    const r = H.vorsorgeDue(S, v, E.today());
    if (!r.date) return '';
    const M = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    return r.state === 'faellig' ? ' (schon fällig)' : ' (fällig ab ' + M[+r.date.slice(5, 7) - 1] + ' ' + r.date.slice(0, 4) + ')';
  }
  // Suspected trigger from the user's own data (breathHint). Show how the data looks for that, plus what usually helps.
  function breathHunch(br) {
    if ((S.health.profile || {}).breathHint !== 'hunger') return '';
    const f = br.factors.find(x => x.label === 'Lange nichts gegessen');
    let status = 'Markiere „Bei Hunger aufgefallen“, wenn du ihn bemerkst. Dann prüft die App deinen Verdacht.';
    if (f && f.nWith >= 3) status = f.diff >= 0.25 ? 'Bestätigt sich bisher: an Hunger-Tagen ist dein Atem im Schnitt ' + breathWord(f.avgWith) + ', sonst ' + breathWord(f.avgWithout) + '.' : 'Bisher kein klarer Zusammenhang mit Hunger. Bleib beim Markieren.';
    return `<div class="hunch"><h3 class="mini-h">Dein Verdacht: Mundgeruch bei Hunger</h3><p class="small ink2">${esc(status)}</p>
      <ul class="tips small"><li>Nicht zu lange ohne Essen: kleine Snacks wie Apfel oder Nüsse, dazu Wasser.</li><li>Zuckerfreier Kaugummi regt den Speichel an, wenn der Magen knurrt.</li><li>Bei Zungenbelag: Zungenschaber nutzen und beim Zahnarzt ansprechen. Die professionelle Zahnreinigung lässt sich gut mit der nächsten Kontrolle verbinden${zahnNext()}.</li></ul>${expActive() ? '' : '<button class="link-btn small" data-a="exp.new" data-k="fruehstueck">Als Experiment testen: zwei Wochen morgens etwas essen</button>'}</div>`;
  }
  const breathWord = v => v < 0.5 ? 'frisch' : v < 1.3 ? 'mittel' : 'schlecht';

  // ---------- Ärzte und Vorsorge ----------
  function vorsorgeStatus(du) {
    if (du.state === 'spaeter') return 'ab ' + du.year;
    if (du.checked) return 'laut Impfpass aktuell, beim Check-up geprüft';
    if (du.state === 'unknown') return 'Noch kein Datum. Wann warst du zuletzt?';
    if (du.state === 'faellig') return 'fällig seit ' + E.fmtDate(du.date);
    if (du.state === 'bald') return 'fällig am ' + E.fmtDate(du.date);
    return 'nächster Termin ab ' + E.fmtDate(du.date);
  }
  const vsRow = ({ v, du }) => `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:${du.state === 'faellig' ? 'var(--rust)' : du.state === 'bald' ? 'var(--cognac)' : 'var(--muted)'}">${ic('cal')}</span><div class="check-body"><div class="row" style="align-items:baseline"><div class="check-name grow">${esc(v.name)}</div><span class="small muted">${esc((docById(v.doc) || { title: '' }).title)}, ${E.everyText(v.every)}</span></div>
            <div class="check-meta ${du.state === 'faellig' ? 'over' : du.state === 'bald' ? 'due' : ''}">${vorsorgeStatus(du)}${v.est && v.last ? ', Datum geschätzt' : ''}</div>
            ${du.state === 'unknown' ? `<label class="small ink2 vs-date">Zuletzt am <input type="date" class="inline-num" value="" data-c="vs.last" data-id="${v.id}"></label>` : ''}
            <details class="how"><summary>${du.state === 'unknown' ? 'Mehr dazu' : 'Mehr dazu, Datum ändern'}</summary><p class="how-text">${esc(v.note)}</p>
              <div class="row wrap" style="margin-top:8px">${du.state !== 'unknown' ? `<label class="small ink2 vs-date">Zuletzt am <input type="date" class="inline-num" value="${v.last || ''}" data-c="vs.last" data-id="${v.id}"></label>` : ''}<button class="btn sm quiet" data-a="ics.vs" data-id="${v.id}">${ic('cal')}Erinnerung in den Kalender</button></div></details></div></li>`;
  function viewDoctors() {
    const t = E.today();
    const up = S.health.appts.filter(a => !a.done && a.date >= t).sort((a, b) => (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1);
    const past = S.health.appts.filter(a => a.done || a.date < t).sort((a, b) => a.date < b.date ? 1 : -1);
    const vs = S.health.vorsorge.map(v => ({ v, du: H.vorsorgeDue(S, v, t) }));
    const now = vs.filter(x => x.du.state !== 'spaeter'), later = vs.filter(x => x.du.state === 'spaeter');
    const ny = (+t.slice(0, 4)) + (t.slice(5) > '01-15' ? 1 : 0);
    const janDate = H.firstMondayJan(ny);
    const janDue = now.filter(x => !x.v.optional && (x.du.state === 'unknown' || x.du.state === 'faellig' || (x.du.date && x.du.date <= ny + '-12-31')));
    const fu = (S.health.followups || []).filter(f => !f.done).sort((a, b) => a.by < b.by ? -1 : 1);
    const qs = S.health.questions.filter(q => !q.done);
    const apptRow = a => `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--denim)">${ic('doc')}</span><div class="check-body"><div class="check-name">${esc(docName(a.doc))}</div><div class="check-meta">${E.fmtLong(a.date)}${a.time ? ', ' + a.time + ' Uhr' : ''}${a.reason ? '. ' + esc(a.reason) : ''}</div>
        <div class="row wrap" style="margin-top:6px;gap:4px"><button class="btn sm quiet" data-a="ics.appt" data-id="${a.id}">${ic('cal')}In den Kalender</button><button class="btn sm ghost" data-a="appt.edit" data-id="${a.id}">Bearbeiten</button><button class="btn sm ghost" data-a="appt.note" data-id="${a.id}">${ic('note')}Gespräch notieren</button></div></div></li>`;
    const left = `<div class="panel"><div class="sec-head"><h2 class="sec-title">Nächste Termine</h2><button class="btn sm" data-a="appt.new">${ic('plus')}Termin</button></div>
        ${up.length ? `<ul class="checklist">${up.map(apptRow).join('')}</ul>` : '<p class="small ink2">Kein Termin geplant.</p>'}
        ${fu.length ? `<h3 class="mini-h">Beim Arzt zu erledigen</h3><ul class="checklist">${fu.map(f => `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--cognac)">${ic('cal')}</span><div class="check-body"><div class="check-name">${esc(f.text)}</div><div class="check-meta">bis ${E.fmtDate(f.by)}</div></div><button class="btn sm ghost" data-a="ics.fu" data-id="${f.id}" aria-label="Erinnerung in den Kalender">${ic('cal')}</button><button class="btn sm quiet" data-a="fu.done" data-id="${f.id}">Erledigt</button></li>`).join('')}</ul>` : ''}</div>
      <div class="panel" style="margin-top:16px"><div class="sec-head"><h2 class="sec-title">Vorsorge</h2><span class="sec-meta">gesetzliche Intervalle für dich</span></div>
        <ul class="checklist">${now.filter(x => !x.v.optional).map(vsRow).join('')}</ul>
        <h3 class="mini-h" style="margin-top:18px">Optional</h3>
        <ul class="checklist">${now.filter(x => x.v.optional).map(vsRow).join('')}</ul>
        ${later.length ? `<p class="small muted" style="margin-top:10px">Später dazu: ${later.map(x => esc(x.v.name) + ' ab ' + x.du.year).join(', ')}.</p>` : ''}</div>
      <div class="panel" style="margin-top:16px"><h2 class="sec-title">Jahres-Check im Januar</h2><p class="small ink2" style="margin:4px 0 10px">Eine Erinnerung jedes Jahr am ersten Montag im Januar, damit du alle Vorsorge-Termine auf einmal vereinbarst. Fürs nächste Mal am ${E.fmtDate(janDate)}${janDue.length ? ', dann voraussichtlich dran: ' + esc(janDue.map(x => x.v.name).join(', ')) : ''}.</p>
        <button class="btn sm" data-a="ics.jan">${ic('cal')}Jährliche Erinnerung in den Kalender</button></div>`;
    const right = `<div class="panel"><div class="sec-head"><h2 class="sec-title">Deine Ärzte</h2><button class="btn sm quiet" data-a="doc.new">${ic('plus')}Arzt</button></div>
        <ul class="checklist">${S.health.doctors.map(x => { const nq = qs.filter(q => q.doc === x.id).length; return `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--denim)">${ic('doc')}</span><div class="check-body"><div class="check-name">${esc(x.title)}</div><div class="check-meta">${x.name ? esc(x.name) : '<span class="muted">Name ergänzen</span>'}${x.phone ? `, <a href="tel:${esc(x.phone.replace(/\s/g, ''))}">${esc(x.phone)}</a>` : ''}${nq ? ', ' + nq + (nq === 1 ? ' offene Frage' : ' offene Fragen') : ''}</div>
          <div class="row wrap" style="margin-top:6px;gap:4px"><button class="btn sm ghost" data-a="doc.edit" data-id="${x.id}">Bearbeiten</button><button class="btn sm ghost" data-a="q.new" data-id="${x.id}">Frage notieren</button><button class="btn sm ghost" data-a="appt.quick" data-id="${x.id}">${ic('note')}Gespräch notieren</button></div></div></li>`; }).join('')}</ul></div>
      <div class="panel" style="margin-top:16px"><h2 class="sec-title" style="margin-bottom:8px">Fragen für den nächsten Termin</h2>${qs.length ? `<ul class="checklist">${qs.map(q => `<li><button class="check" data-a="q.done" data-id="${q.id}" aria-pressed="false" aria-label="Frage erledigt">${ic('check')}</button><div class="check-body"><div class="check-name">${esc(q.text)}</div><div class="check-meta">${esc(docName(q.doc))}, notiert ${E.fmtRel(q.date)}</div></div></li>`).join('')}</ul>` : '<p class="small ink2">Fällt dir zwischen zwei Terminen etwas ein, notiere es hier. Die Fragen landen im Bericht für diesen Arzt.</p>'}</div>
      <div class="panel" style="margin-top:16px"><h2 class="sec-title" style="margin-bottom:8px">Gesprächsnotizen</h2>${past.length ? `<ul class="checklist">${past.slice(0, 15).map(a => `<li><span class="check" aria-hidden="true" style="box-shadow:none">${ic('note')}</span><div class="check-body"><div class="check-name">${esc(docName(a.doc))}, ${E.fmtDate(a.date)}</div><div class="check-meta">${esc(a.reason || '')}</div>
          ${a.talk || a.next ? `<details class="how"><summary>Notiz</summary>${a.talk ? `<p class="how-text"><b>Besprochen:</b> ${esc(a.talk)}</p>` : ''}${a.next ? `<p class="how-text"><b>Empfehlung:</b> ${esc(a.next)}</p>` : ''}</details>` : `<button class="link-btn small" data-a="appt.note" data-id="${a.id}">Notiz ergänzen</button>`}</div></li>`).join('')}</ul>` : '<p class="small ink2">Nach einem Termin hältst du hier in einer Minute fest, was besprochen wurde und was als Nächstes kommt.</p>'}</div>`;
    return `<div class="two-col"><div>${left}</div><div>${right}</div></div>
      <p class="small muted" style="margin-top:16px">Kalender-Erinnerungen: Die Datei öffnest du mit Outlook oder importierst sie in den Google Kalender, dann meldet sich dein Handy auch ohne diese App.</p>`;
  }

  // ---------- Medikamente ----------
  function medRange(m, print) {
    if (m.stopped) return E.fmtDate(m.start) + ' bis ' + E.fmtDate(m.stopped) + (print ? '' : ', beendet');
    if (!m.end) return 'seit ' + E.fmtDate(m.start) + ', dauerhaft';
    const left = E.diffDays(E.today(), m.end);
    return E.fmtDate(m.start) + ' bis ' + E.fmtDate(m.end) + (!print && left >= 0 ? ', noch ' + (left + 1) + (left === 0 ? ' Tag' : ' Tage') : '');
  }
  const pl = (n, one, many) => n + ' ' + (n === 1 ? one : many);
  function viewMeds() {
    const t = E.today();
    const act = S.health.meds.filter(m => medActive(m, t) || (!m.stopped && m.start > t));
    const old = S.health.meds.filter(m => !act.includes(m));
    const due = medsDue(t);
    return `<div class="note info" style="margin-bottom:18px">${ic('info')}<div class="grow">Dosierung immer so, wie sie dir verordnet wurde. Fragen zur Einnahme oder zu Wechselwirkungen beantwortet die Arztpraxis oder die Apotheke.</div></div>
      <div class="two-col"><div>
        <div class="panel"><div class="sec-head"><h2 class="sec-title">Heute</h2><button class="btn sm" data-a="med.new">${ic('plus')}Medikament</button></div>
          ${due.length ? `<ul class="checklist">${due.map(x => `<li class="${x.done ? 'done' : ''}"><button class="check" data-a="med.take" data-id="${x.m.id}" data-t="${x.t}" data-d="${t}" aria-pressed="${x.done}" aria-label="${esc(x.m.name)} um ${x.t}">${ic('check')}</button><div class="check-body"><div class="check-name">${esc(x.m.name)} <span class="muted num">${x.t}</span></div><div class="check-meta">${esc([x.m.dose, x.m.note].filter(Boolean).join(', '))}</div></div></li>`).join('')}</ul>` : '<p class="small ink2">Heute ist nichts einzunehmen.</p>'}</div>
      </div><div>
        <div class="panel"><h2 class="sec-title" style="margin-bottom:8px">Aktuell</h2>${act.length ? `<ul class="checklist">${act.map(m => `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--denim)">${ic('pill')}</span><div class="check-body"><div class="check-name">${esc(m.name)}${m.dose ? ' <span class="muted">' + esc(m.dose) + '</span>' : ''}</div><div class="check-meta">${m.times.join(', ')} Uhr. ${medRange(m)}${m.by ? '. Verordnet von ' + esc(docName(m.by)) : ''}${m.note ? '. ' + esc(capF(m.note)) : ''}</div>
            <div class="row wrap" style="margin-top:6px;gap:4px"><button class="btn sm quiet" data-a="ics.med" data-id="${m.id}">${ic('cal')}Erinnerungen in den Kalender</button><button class="btn sm ghost" data-a="med.edit" data-id="${m.id}">Bearbeiten</button><button class="btn sm ghost" data-a="med.stop" data-id="${m.id}">Beenden</button></div></div></li>`).join('')}</ul>` : '<p class="small ink2">Keine Medikamente eingetragen. Leg eins an, wenn du etwas über einen Zeitraum nehmen oder auftragen musst, etwa eine Creme: mit Zeiten, Laufzeit und Kalender-Erinnerungen.</p>'}</div>
        ${old.length ? `<details class="panel" style="margin-top:16px"><summary style="cursor:pointer;font-weight:620">Frühere Medikamente (${old.length})</summary><ul class="checklist" style="margin-top:8px">${old.map(m => `<li><div class="check-body"><div class="check-name">${esc(m.name)}</div><div class="check-meta">${medRange(m)}</div></div><button class="icon-btn" data-a="med.del" data-id="${m.id}" aria-label="Eintrag löschen">${ic('trash')}</button></li>`).join('')}</ul></details>` : ''}
      </div></div>`;
  }

  // ---------- Bericht ----------
  const REP_RANGES = [['30', '30 Tage'], ['90', '3 Monate'], ['365', '12 Monate'], ['alle', 'Alles']];
  function viewReport() {
    ui.rep = ui.rep || { range: '90', fach: 'alle', photos: true };
    const R = ui.rep;
    preloadObsPhotos();
    const data = reportData();
    return `<div class="two-col"><div class="panel"><h2 class="sec-title" style="margin-bottom:10px">Was soll in den Bericht?</h2>
        <div class="hrow"><span class="hlbl">Zeitraum</span>${seg('Zeitraum', REP_RANGES, R.range, { a: 'rep.range' })}</div>
        <div class="hrow top"><span class="hlbl">Für</span><div class="schips">${[['alle', 'Alle Bereiche'], ...Object.entries(H.FACH)].map(([k, l]) => `<button class="chip" data-a="rep.fach" data-v="${k}" aria-pressed="${R.fach === k}">${esc(k === 'allg' ? 'Hausarzt' : l)}</button>`).join('')}</div></div>
        <div class="hrow"><span class="hlbl">Fotos</span><label class="toggle"><input type="checkbox" data-c="rep.photos"${R.photos ? ' checked' : ''}><span class="small">Fotos von Beobachtungen mitdrucken</span></label></div>
        <div class="row wrap" style="margin-top:16px"><button class="btn" data-a="rep.open">${ic('print')}Bericht öffnen</button><button class="btn quiet" data-a="rep.csv">${ic('download')}Alle Daten als CSV</button></div>
        <p class="small muted" style="margin-top:10px">Der Bericht öffnet sich in einem neuen Tab. Dort druckst du ihn oder speicherst ihn als PDF.</p></div>
      <div class="panel"><h2 class="sec-title" style="margin-bottom:10px">Inhalt</h2>
        <ul class="checklist">
          <li><div class="check-body"><div class="check-name">${pl(data.days, 'Tag', 'Tage')} mit Einträgen, ${pl(data.rows.length, 'Tag', 'Tage')} mit Beschwerden</div><div class="check-meta">${data.top.length ? 'Häufig: ' + esc(data.top.slice(0, 4).map(x => x.label + ' (' + x.n + '×)').join(', ')) : 'Keine Beschwerden in diesem Zeitraum'}</div></div></li>
          <li><div class="check-body"><div class="check-name">${pl(data.eps.length, 'Infekt-Episode', 'Infekt-Episoden')}</div></div></li>
          <li><div class="check-body"><div class="check-name">${pl(data.obs.length, 'Beobachtung', 'Beobachtungen')}</div></div></li>
          <li><div class="check-body"><div class="check-name">${pl(data.meds.length, 'Medikament', 'Medikamente')}</div></div></li>
          <li><div class="check-body"><div class="check-name">${pl(data.qs.length, 'offene Frage', 'offene Fragen')}, ${pl(data.talks.length, 'Gesprächsnotiz', 'Gesprächsnotizen')}</div></div></li>
        </ul>
        <h3 class="mini-h" style="margin-top:14px">Feste Angaben im Bericht</h3>
        <label class="field" style="margin-top:6px"><span>Name</span><input value="${esc(S.health.record.name || S.profile.name || '')}" data-c="rec.set" data-k="name"></label>
        <label class="field" style="margin-top:10px"><span>Allergien und Unverträglichkeiten</span><input value="${esc(S.health.record.allergies || '')}" data-c="rec.set" data-k="allergies" placeholder="keine bekannt"></label>
        <label class="field" style="margin-top:10px"><span>Vorerkrankungen</span><input value="${esc(S.health.record.conditions || '')}" data-c="rec.set" data-k="conditions" placeholder="optional"></label>
        <label class="field" style="margin-top:10px"><span>Nahrungsergänzung</span><input value="${esc(S.health.record.supplements || '')}" data-c="rec.set" data-k="supplements" placeholder="optional"></label>
        <label class="field" style="margin-top:10px"><span>Weitere Hinweise</span><textarea class="area" rows="2" data-c="rec.set" data-k="notes" placeholder="optional">${esc(S.health.record.notes || '')}</textarea></label>
        <p class="small muted" style="margin-top:8px">Bleibt nur hier im Browser gespeichert.</p></div></div>`;
  }
  function reportData() {
    const R = ui.rep || { range: '90', fach: 'alle', photos: true };
    const t = E.today(), from = R.range === 'alle' ? '0000-00-00' : E.addDays(t, -(+R.range));
    const fach = R.fach, all = fach === 'alle', gen = all || fach === 'allg';
    const rows = [], counts = {};
    let days = 0;
    for (const d of Object.keys(S.health.days).sort()) {
      if (d < from) continue;
      const x = S.health.days[d]; if (!H.hasData(x)) continue;
      days++;
      const syms = Object.entries(x.sym || {}).filter(([k, v]) => v && H.inFach(k, fach));
      syms.forEach(([k, v]) => { counts[k] = counts[k] || { label: H.symLabel(k), n: 0, sum: 0 }; counts[k].n++; counts[k].sum += v; });
      const extra = [];
      if (x.temp != null && gen) extra.push(n0(x.temp) + ' °C');
      if (x.breath != null && (all || ['allg', 'zahn', 'hno'].includes(fach))) extra.push('Atem ' + ['frisch', 'geht so', 'schlecht'][x.breath]);
      if (gen) { if (x.mood != null) extra.push('Befinden ' + x.mood + '/5'); if (x.sleepH != null) extra.push('Schlaf ' + n0(x.sleepH) + ' h'); if (x.stress != null) extra.push('Stress ' + x.stress + '/5'); }
      else if (fach === 'neuro') { if (x.sleepH != null) extra.push('Schlaf ' + n0(x.sleepH) + ' h'); if (x.sleepQ != null) extra.push('Schlafqualität ' + x.sleepQ + '/5'); }
      const meas = (all || ['allg', 'hno'].includes(fach)) ? (x.meas || []).map(id => (S.health.measures.find(m => m.id === id) || { l: id }).l) : [];
      if (!syms.length && !(gen && (x.note || (x.temp != null && x.temp >= 37.5)))) continue;
      rows.push({ d, syms: syms.map(([k, v]) => H.symLabel(k) + ' (' + H.INT[v] + ')'), extra, meas, note: gen ? (x.note || '') : '' });
    }
    const top = Object.values(counts).sort((a, b) => b.n - a.n);
    const eps = (all || ['allg', 'hno'].includes(fach)) ? H.episodes(S, t).filter(e => e.end >= from) : [];
    const obs = S.health.obs.filter(o => o.date >= from && (all || o.fach === fach || (o.region && (H.regById(o.region) || { fach: [] }).fach.includes(fach))));
    const meds = S.health.meds.filter(m => (!m.end || m.end >= from) && (!m.stopped || m.stopped >= from));
    const docs = S.health.doctors.filter(x => all || x.fach === fach).map(x => x.id);
    const qs = S.health.questions.filter(q => !q.done && docs.includes(q.doc));
    const talks = S.health.appts.filter(a => (a.done || a.date < t) && a.date >= from && docs.includes(a.doc) && (a.talk || a.next));
    let neuro = null;
    if (fach === 'neuro' || all) {
      const ds = Object.keys(S.health.days).filter(d => d >= from && H.hasData(S.health.days[d]));
      const rl = ds.filter(d => (S.health.days[d].sym || {}).beine_unruhig);
      const avg = list => { const v = list.map(d => S.health.days[d].sleepH).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      if (rl.length) neuro = { n: rl.length, of: ds.length, sleepWith: avg(rl), sleepWithout: avg(ds.filter(d => !rl.includes(d))) };
    }
    return { rows, top, eps, obs, meds, qs, talks, from, fach, days, neuro };
  }
  async function preloadObsPhotos() {
    ui.repPhotos = ui.repPhotos || {};
    for (const o of S.health.obs) {
      const k = 'obs:' + o.id; if (ui.repPhotos[k] || !Photos.url(k)) continue;
      try { const b = await Photos.get(k); if (b) ui.repPhotos[k] = await blobToDataURL(b); } catch (e) { /* skip */ }
    }
  }
  function reportHTML() {
    const D = reportData(), R = ui.rep, rec = S.health.record || {};
    const fachLabel = D.fach === 'alle' ? 'alle Bereiche' : (D.fach === 'allg' ? 'Hausarzt' : H.FACH[D.fach]);
    const birth = S.profile.birth ? E.fmtDate(S.profile.birth) : '';
    const sec = (title, body) => body ? `<section><h2>${esc(title)}</h2>${body}</section>` : '';
    const br = H.breathFactors(S);
    return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Gesundheitsübersicht ${esc(rec.name || S.profile.name || '')}</title>
      <style>body{font:11pt/1.45 'Segoe UI',Roboto,Arial,sans-serif;color:#1b2331;max-width:780px;margin:24px auto;padding:0 18px}h1{font-size:20pt;margin:0}h2{font-size:13pt;margin:22px 0 8px;border-bottom:1px solid #ccc;padding-bottom:4px}
      .meta{color:#555;margin:4px 0 0}table{width:100%;border-collapse:collapse;font-size:10pt}th,td{text-align:left;vertical-align:top;padding:5px 6px;border-bottom:1px solid #e2e2e2}th{background:#f3f3f1}
      .obs{display:flex;gap:12px;margin:8px 0;page-break-inside:avoid}.obs img{width:160px;height:160px;object-fit:cover;border-radius:6px;border:1px solid #ddd}.note{font-size:9pt;color:#666;margin-top:26px}
      .bar{position:sticky;top:0;background:#fff;padding:8px 0;margin-bottom:8px}.bar button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #999;background:#f6f6f4;cursor:pointer}
      @media print{.bar{display:none}body{margin:0 auto}section{page-break-inside:auto}tr{page-break-inside:avoid}}</style></head><body>
      <div class="bar"><button onclick="window.print()">Drucken oder als PDF speichern</button></div>
      <h1>Gesundheitsübersicht</h1>
      <p class="meta">${esc(rec.name || S.profile.name || '')}${birth ? ', geboren am ' + birth : ''}. Zeitraum: ${D.from === '0000-00-00' ? 'alle Einträge' : E.fmtDate(D.from) + ' bis ' + E.fmtDate(E.today())}. Für: ${esc(fachLabel)}. Erstellt am ${E.fmtDate(E.today())}.</p>
      ${sec('Feste Angaben', (rec.allergies || rec.conditions || rec.supplements || rec.notes) ? `<p>${rec.allergies ? '<b>Allergien und Unverträglichkeiten:</b> ' + esc(rec.allergies) + '<br>' : ''}${rec.conditions ? '<b>Vorerkrankungen:</b> ' + esc(rec.conditions) + '<br>' : ''}${rec.supplements ? '<b>Nahrungsergänzung:</b> ' + esc(rec.supplements) + '<br>' : ''}${rec.notes ? '<b>Hinweise:</b> ' + esc(rec.notes) : ''}</p>` : '')}
      ${sec('Unruhige Beine', D.neuro ? `<p>An ${D.neuro.n} von ${D.neuro.of} erfassten Tagen eingetragen.${D.neuro.sleepWith != null ? ' Schlaf an diesen Tagen im Schnitt ' + n0(Math.round(D.neuro.sleepWith * 10) / 10) + ' h' + (D.neuro.sleepWithout != null ? ', sonst ' + n0(Math.round(D.neuro.sleepWithout * 10) / 10) + ' h' : '') + '.' : ''}</p>` : '')}
      ${sec('Medikamente', D.meds.length ? `<table><tr><th>Medikament</th><th>Dosis</th><th>Zeiten</th><th>Zeitraum</th></tr>${D.meds.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.dose || '')}</td><td>${esc(m.times.join(', '))}</td><td>${esc(medRange(m, true))}</td></tr>`).join('')}</table>` : '')}
      ${sec('Zusammenfassung', `<p>${pl(D.days, 'Tag', 'Tage')} erfasst, an ${pl(D.rows.length, 'Tag', 'Tagen')} mit Beschwerden.${D.top.length ? ' Häufigste Beschwerden: ' + esc(D.top.slice(0, 6).map(x => x.label + ' (' + x.n + '×, meist ' + H.INT[Math.round(x.sum / x.n)] + ')').join(', ')) + '.' : ''}${D.eps.length ? ' ' + pl(D.eps.length, 'Infekt-Episode', 'Infekt-Episoden') + '.' : ''}</p>`)}
      ${sec('Infekt-Episoden', D.eps.length ? `<table><tr><th>Zeitraum</th><th>Erste Anzeichen</th><th>Maßnahmen früh</th><th>Verlauf</th></tr>${D.eps.map(e => `<tr><td>${E.fmtShort(e.start)}${e.end !== e.start ? ' bis ' + E.fmtShort(e.end) : ''} (${e.length} T.)</td><td>${esc(e.first.map(H.symLabel).join(', '))}</td><td>${esc(e.early.map(id => (S.health.measures.find(m => m.id === id) || { l: id }).l).join(', '))}</td><td>${esc(H.OUTCOME[e.outcome])}${e.fever ? ', Fieber' : ''}</td></tr>`).join('')}</table>` : '')}
      ${sec('Tage mit Beschwerden', D.rows.length ? `<table><tr><th>Datum</th><th>Beschwerden</th><th>Weitere Angaben</th><th>Maßnahmen</th><th>Notiz</th></tr>${D.rows.map(r => `<tr><td>${E.fmtShort(r.d)}${r.d.slice(0, 4)}</td><td>${esc(r.syms.join(', ') || 'keine')}</td><td>${esc(r.extra.join(', '))}</td><td>${esc(r.meas.join(', '))}</td><td>${esc(r.note)}</td></tr>`).join('')}</table>` : '<p>Keine Beschwerden im Zeitraum.</p>')}
      ${sec('Selbstexperimente', expReport(D))}
      ${sec('Mundgeruch', (['alle', 'allg', 'zahn', 'hno'].includes(D.fach) && br.rated) ? `<p>${br.rated} Tage bewertet: frisch ${br.dist[0]}, geht so ${br.dist[1]}, schlecht ${br.dist[2]}.${br.factors.filter(f => f.diff >= 0.4).length ? ' Fällt zusammen mit: ' + esc(br.factors.filter(f => f.diff >= 0.4).map(f => f.label).join(', ')) + '.' : ''}</p>` : '')}
      ${sec('Beobachtungen', D.obs.length ? D.obs.map(o => `<div class="obs">${R.photos && ui.repPhotos && ui.repPhotos['obs:' + o.id] ? `<img src="${ui.repPhotos['obs:' + o.id]}" alt="">` : ''}<div><b>${E.fmtDate(o.date)}</b>${o.region && H.regById(o.region) ? ', ' + esc(H.regById(o.region).l) : ''}<br>${esc(o.text)}</div></div>`).join('') : '')}
      ${sec('Frühere Arztgespräche', D.talks.length ? D.talks.map(a => `<p><b>${E.fmtDate(a.date)}, ${esc(docName(a.doc))}</b>${a.reason ? ': ' + esc(a.reason) : ''}<br>${a.talk ? 'Besprochen: ' + esc(a.talk) + '<br>' : ''}${a.next ? 'Empfehlung: ' + esc(a.next) : ''}</p>`).join('') : '')}
      ${sec('Fragen an Sie', D.qs.length ? `<ul>${D.qs.map(q => `<li>${esc(q.text)}</li>`).join('')}</ul>` : '')}
      <p class="note">Selbst erfasste Angaben aus der App „Chris OS“. Keine ärztliche Dokumentation.</p></body></html>`;
  }
  function csvAll() {
    const head = ['Datum', 'Befinden', 'Energie', 'Stress', 'Schlaf (h)', 'Schlafqualität', 'Atem', 'Temperatur', 'Beschwerden', 'Maßnahmen', 'Einflüsse', 'Notiz'];
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [head.map(q).join(';')];
    for (const d of Object.keys(S.health.days).sort()) {
      const x = S.health.days[d]; if (!H.hasData(x)) continue;
      const f = x.f || {};
      lines.push([d, x.mood, x.energy, x.stress, x.sleepH != null ? n0(x.sleepH) : '', x.sleepQ, x.breath != null ? ['frisch', 'geht so', 'schlecht'][x.breath] : '', x.temp != null ? n0(x.temp) : '',
        Object.entries(x.sym || {}).filter(([, v]) => v).map(([k, v]) => H.symLabel(k) + ' ' + H.INT[v]).join(', '),
        (x.meas || []).map(id => (S.health.measures.find(m => m.id === id) || { l: id }).l).join(', '),
        [f.kaffee != null ? 'Kaffee ' + f.kaffee : '', f.wasser != null ? 'Getrunken ' + n0(f.wasser) + ' l' : '', ...H.FACTORS.filter(k => f[k.id]).map(k => k.l)].filter(Boolean).join(', '),
        x.note || ''].map(q).join(';'));
    }
    return '﻿' + lines.join('\r\n');
  }

  // ---------- Dialogs ----------
  const docOpts = sel => S.health.doctors.map(x => `<option value="${x.id}"${x.id === sel ? ' selected' : ''}>${esc(x.title + (x.name ? ', ' + x.name : ''))}</option>`).join('');
  function apptDialog(id, preset) {
    const a = id ? S.health.appts.find(x => x.id === id) : Object.assign({ doc: S.health.doctors[0].id, date: E.addDays(E.today(), 7), time: '09:00', reason: '' }, preset || {});
    ui.apptId = id || null;
    openDialog(`${dlgHead(id ? 'Termin bearbeiten' : 'Termin eintragen')}<form class="form-grid" id="appt-form" onsubmit="return false">
      <label class="field full"><span>Arzt</span><select name="doc">${docOpts(a.doc)}</select></label>
      <label class="field"><span>Datum</span><input type="date" name="date" value="${a.date}"></label>
      <label class="field"><span>Uhrzeit</span><input type="time" name="time" value="${a.time || ''}"></label>
      <label class="field full"><span>Anlass</span><input name="reason" value="${esc(a.reason || '')}" placeholder="z. B. Check-up, Kontrolle, Beschwerden"></label>
      <label class="field full"><span>Gehört zur Vorsorge (optional)</span><select name="vs"><option value="">–</option>${S.health.vorsorge.map(v => `<option value="${v.id}"${a.vs === v.id ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label></form>
      <div class="sheet-foot">${id ? `<button class="btn danger left" data-a="appt.del" data-id="${id}">${ic('trash')}Löschen</button>` : ''}<button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="appt.save">Speichern</button></div>`);
  }
  function noteDialog(id, docId) {
    const a = id ? S.health.appts.find(x => x.id === id) : { doc: docId || S.health.doctors[0].id, date: E.today(), reason: '' };
    ui.noteId = id || null;
    openDialog(`${dlgHead('Gespräch notieren')}<form class="form-grid" id="note-form" onsubmit="return false">
      <label class="field"><span>Arzt</span><select name="doc">${docOpts(a.doc)}</select></label>
      <label class="field"><span>Datum</span><input type="date" name="date" value="${a.date}"></label>
      <label class="field full"><span>Anlass</span><input name="reason" value="${esc(a.reason || '')}" placeholder="Worum ging es?"></label>
      <label class="field full"><span>Besprochen und Befund</span><textarea name="talk" rows="3" placeholder="Stichpunkte reichen">${esc(a.talk || '')}</textarea></label>
      <label class="field full"><span>Empfehlung und nächste Schritte</span><textarea name="next" rows="2">${esc(a.next || '')}</textarea></label>
      <label class="field"><span>Wiederkommen in</span><select name="follow"><option value="">–</option><option value="28">4 Wochen</option><option value="91">3 Monaten</option><option value="182">6 Monaten</option><option value="365">1 Jahr</option></select></label>
      <label class="field"><span>Vorsorge erledigt (optional)</span><select name="vs"><option value="">–</option>${S.health.vorsorge.map(v => `<option value="${v.id}"${a.vs === v.id ? ' selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label></form>
      <div class="sheet-foot"><button class="btn quiet left" data-a="note.med">${ic('pill')}Medikament verordnet</button><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="note.save">Speichern</button></div>`);
  }
  function docDialog(id) {
    const x = id ? docById(id) : { title: '', name: '', phone: '', note: '', fach: 'allg' };
    ui.docId = id || null;
    openDialog(`${dlgHead(id ? x.title : 'Arzt hinzufügen')}<form class="form-grid" id="doc-form" onsubmit="return false">
      <label class="field"><span>Fachrichtung</span><input name="title" value="${esc(x.title)}" placeholder="z. B. Urologe"></label>
      <label class="field"><span>Bereich im Bericht</span><select name="fach">${Object.entries(H.FACH).map(([k, l]) => `<option value="${k}"${k === x.fach ? ' selected' : ''}>${k === 'allg' ? 'Hausarzt' : l}</option>`).join('')}</select></label>
      <label class="field"><span>Name und Praxis</span><input name="name" value="${esc(x.name)}" ${id ? 'autofocus' : ''}></label>
      <label class="field"><span>Telefon</span><input name="phone" type="tel" value="${esc(x.phone)}"></label>
      <label class="field full"><span>Notiz</span><input name="note" value="${esc(x.note)}" placeholder="z. B. Online-Terminbuchung, Adresse"></label></form>
      <div class="sheet-foot">${id && !/^d-/.test(id) ? `<button class="btn danger left" data-a="doc.del" data-id="${id}">${ic('trash')}Löschen</button>` : ''}<button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="doc.save">Speichern</button></div>`);
  }
  function medDialog(id, preset) {
    const m = id ? S.health.meds.find(x => x.id === id) : Object.assign({ name: '', dose: '', times: ['08:00'], start: E.today(), end: E.addDays(E.today(), 6), note: '', by: '' }, preset || {});
    ui.medId = id || null;
    const days = m.end ? E.diffDays(m.start, m.end) + 1 : '';
    const T = [['07:00', 'morgens'], ['08:00', 'morgens'], ['12:00', 'mittags'], ['18:00', 'abends'], ['20:00', 'abends'], ['22:00', 'zur Nacht']];
    openDialog(`${dlgHead(id ? m.name : 'Medikament eintragen')}<form class="form-grid" id="med-form" onsubmit="return false">
      <label class="field"><span>Name</span><input name="name" value="${esc(m.name)}" ${id ? '' : 'autofocus'}></label>
      <label class="field"><span>Dosis wie verordnet</span><input name="dose" value="${esc(m.dose)}" placeholder="z. B. 1 Tablette oder dünn auftragen"></label>
      <div class="field full"><span>Zeiten</span><div class="schips">${T.map(([v, l]) => `<label class="chip"><input type="checkbox" name="time" value="${v}"${m.times.includes(v) ? ' checked' : ''} style="accent-color:var(--denim)"> ${v} ${l}</label>`).join('')}<input type="time" name="time2" class="inline-num" style="width:auto;padding:0 8px" value="${m.times.find(x => !T.some(([v]) => v === x)) || ''}" aria-label="Andere Uhrzeit"></div></div>
      <label class="field"><span>Ab</span><input type="date" name="start" value="${m.start}"></label>
      <label class="field"><span>Dauer in Tagen</span><input type="number" min="1" name="days" value="${days}" placeholder="leer = dauerhaft"></label>
      <label class="field full"><span>Hinweis</span><input name="note" value="${esc(m.note)}" placeholder="z. B. nach dem Essen"></label>
      <label class="field full"><span>Verordnet von</span><select name="by"><option value="">–</option>${docOpts(m.by)}</select></label></form>
      <div class="sheet-foot">${id ? `<button class="btn danger left" data-a="med.del" data-id="${id}">${ic('trash')}Löschen</button>` : ''}<button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="med.save">Speichern</button></div>`);
  }
  function obsDialog() {
    ui.obsPhoto = null;
    openDialog(`${dlgHead('Beobachtung festhalten')}<form class="form-grid" id="obs-form" onsubmit="return false">
      <label class="field full"><span>Was fällt dir auf?</span><textarea name="text" rows="3" autofocus placeholder="z. B. Muttermal am linken Unterarm wirkt größer"></textarea></label>
      <label class="field"><span>Datum</span><input type="date" name="date" value="${E.today()}"></label>
      <label class="field"><span>Körperstelle</span><select name="region"><option value="">–</option>${H.REGIONS.map(r => `<option value="${r.id}">${esc(r.l)}</option>`).join('')}</select></label>
      <label class="field"><span>Für den Bereich</span><select name="fach">${Object.entries(H.FACH).map(([k, l]) => `<option value="${k}"${k === 'haut' ? ' selected' : ''}>${k === 'allg' ? 'Hausarzt' : l}</option>`).join('')}</select></label>
      <div class="field"><span>Foto</span><label class="btn sm quiet">${ic('camera')}Foto wählen<input type="file" accept="image/*" capture="environment" class="sr" data-c="obs.photo"></label><span id="obs-ph" class="small muted"></span></div></form>
      <p class="small muted">Tipp: Für Hautveränderungen immer mit gleichem Abstand und Licht fotografieren und eine Münze oder ein Lineal daneben legen.</p>
      <div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="obs.save">Speichern</button></div>`);
  }

  // ---------- Stretching player ----------
  function stretchItems(kind, minutes, focus) {
    if (kind === 'haltung' || kind === 'buero') return H.presetFromRoutine(S.training.routines[kind]);
    return H.stretchPlan(kind, minutes, focus);
  }
  function startPlayer(kind, minutes, focus) {
    const items = stretchItems(kind, minutes, focus);
    const title = kind === 'haltung' ? 'Haltungsroutine' : kind === 'buero' ? 'Büro-Pause' : (kind === 'morgen' ? 'Morgens' : 'Abends') + ', ' + minutes + ' Minuten, ' + H.STRETCH_FOCUS[focus];
    ui.player = { kind, title, items, idx: 0, half: 0, left: items[0].sec, running: false, done: false, endAt: 0 };
    location.hash = '#/training/dehnen';
  }
  function viewPlayer() {
    const P = ui.player;
    if (!P) return `<div class="page"><div class="empty">Wähle zuerst eine Einheit. <a href="#/training">Zum Training</a></div></div>`;
    const cur = P.items[P.idx];
    const total = P.items.reduce((s, x) => s + H.itemSec(x), 0);
    const doneSec = P.items.slice(0, P.idx).reduce((s, x) => s + H.itemSec(x), 0);
    const next = P.items[P.idx + 1];
    if (P.done) return `<div class="page"><div class="player done-card"><span class="warn-ico" style="color:var(--olive)">${ic('check')}</span><h1 class="session-title">Geschafft</h1><p class="ink2">${esc(P.title)}. Gut gemacht.</p><div class="row" style="justify-content:center;margin-top:16px"><a class="btn" href="#/heute">Zu Heute</a><a class="btn quiet" href="#/training">Zum Training</a></div></div></div>`;
    return `<div class="page"><div class="player">
      <div class="row" style="justify-content:space-between"><span class="small muted">${esc(P.title)}</span><button class="btn sm ghost" data-a="pl.stop">Beenden</button></div>
      <div class="meter" style="margin:12px 0 22px" aria-hidden="true"><i data-pl-prog style="width:${Math.round(doneSec / total * 100)}%"></i></div>
      <p class="small muted num">Übung ${P.idx + 1} von ${P.items.length}${cur.side ? ', <b data-pl-side>' + (P.half ? 'rechte Seite' : 'linke Seite') + '</b>' : ''}</p>
      <h1 class="pl-name">${esc(cur.n)}</h1>
      <div class="pl-time num" data-pl-time role="timer" aria-live="off">${fmtSec(P.left)}</div>
      <p class="pl-cue">${esc(cur.cue)}</p>
      <div class="row" style="justify-content:center;gap:10px;margin-top:18px">
        <button class="icon-btn lg" data-a="pl.prev" aria-label="Vorherige Übung">${ic('back')}</button>
        <button class="btn pl-main" data-a="pl.toggle">${P.running ? ic('pause') + 'Pause' : ic('play') + (P.idx === 0 && P.left === cur.sec && P.half === 0 ? 'Los geht’s' : 'Weiter')}</button>
        <button class="icon-btn lg" data-a="pl.next" aria-label="Nächste Übung">${ic('skip')}</button></div>
      ${next ? `<p class="small muted" style="margin-top:18px;text-align:center">Danach: ${esc(next.n)}</p>` : ''}
      <p style="text-align:center;margin-top:10px"><button class="link-btn small" data-a="pl.log">Schon erledigt, nur eintragen</button></p>
      <ol class="pl-list">${P.items.map((x, i) => `<li class="${i < P.idx ? 'past' : i === P.idx ? 'cur' : ''}"><span>${esc(x.n)}</span><span class="num muted">${x.side ? x.sec + ' s je Seite' : x.sec + ' s'}</span></li>`).join('')}</ol>
    </div></div>`;
  }
  const fmtSec = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  let plTimer = null;
  function plTick() {
    const P = ui.player; if (!P || !P.running) return;
    P.left = (P.endAt - Date.now()) / 1000;
    if (P.left <= 0) {
      const cur = P.items[P.idx];
      if (cur.side && !P.half) { P.half = 1; P.left = cur.sec; P.endAt = Date.now() + cur.sec * 1000; beepShort(); render(); return; }
      if (P.idx + 1 >= P.items.length) { plFinish(); beep(); return; }
      P.idx++; P.half = 0; P.left = P.items[P.idx].sec; P.endAt = Date.now() + P.left * 1000; beepShort(); render(); return;
    }
    const el = document.querySelector('[data-pl-time]'); if (el) el.textContent = fmtSec(P.left);
  }
  function plFinish() {
    const P = ui.player; if (!P) return;
    P.running = false; P.done = true; clearInterval(plTimer);
    const id = P.kind === 'buero' ? 'buero' : P.kind === 'haltung' ? 'haltung' : 'dehnen';
    S.training.routineLog.push({ date: E.today(), id, kind: P.kind, min: Math.max(1, Math.round(P.items.reduce((s, x) => s + H.itemSec(x), 0) / 60)) });
    save(); render();
  }
  const planMin = items => Math.max(1, Math.round(items.reduce((s, x) => s + H.itemSec(x), 0) / 60));
  function beepShort() {
    if (!S.settings.sound) return;
    try { const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC(); const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 660; g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.15); o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.18); setTimeout(() => ac.close(), 500); } catch (e) { /* no audio */ }
    if (navigator.vibrate) navigator.vibrate(120);
  }

  // ---------- Training builders (home + stretching) ----------
  const chipGroup = (name, opts, val, a) => `<div class="schips" role="group" aria-label="${esc(name)}">${opts.map(([v, l]) => `<button class="chip" data-a="${a}" data-v="${v}" aria-pressed="${v === val}">${esc(l)}</button>`).join('')}</div>`;
  function homeBuilder() {
    ui.home = ui.home || { focus: 'ganz', min: 30, picks: {} };
    const plan = H.homePlan(ui.home.focus, ui.home.min, ui.home.picks);
    return `<div class="panel"><div class="sec-head"><h3 style="font-size:20px;font-stretch:80%">Heimtraining mit Kurzhanteln</h3><span class="sec-meta">wenn du nicht ins Gym kommst</span></div>
      <div class="hrow"><span class="hlbl">Dauer</span>${seg('Dauer', [['20', '20 Min.'], ['30', '30 Min.'], ['45', '45 Min.']], String(ui.home.min), { a: 'home.min' })}</div>
      <div class="hrow top"><span class="hlbl">Fokus</span>${chipGroup('Fokus', Object.entries(H.HOME_FOCUS), ui.home.focus, 'home.focus')}</div>
      <ul class="ex-list" style="margin:10px 0 14px">${plan.map(p => { const ex = exById(p.ex); return `<li class="ss-bar${p.slot % 2 === 0 && p.slot ? ' pair-start' : ''}"><div><div class="ex-name"><span class="focus-dot focus-${ex.focus}" aria-hidden="true"></span>${esc(ex.name)}${p.slot % 2 === 0 ? ' <span class="tag denim">Supersatz</span>' : ''}</div><div class="ex-where">${esc(ex.where)}</div></div>
        <div style="text-align:right"><div class="ex-dose">${doseText(ex)}</div>${p.opts.length > 1 ? `<select class="inline-sel" data-c="home.pick" data-slot="${p.slot}" aria-label="Übung tauschen: ${esc(ex.name)}">${p.opts.map(o => `<option value="${o}"${o === p.ex ? ' selected' : ''}>${o === p.ex ? 'Tauschen' : esc(exById(o).name)}</option>`).join('')}</select>` : ''}</div></li>`; }).join('')}</ul>
      <p class="small muted" style="margin:-6px 0 12px">Immer zwei Übungen abwechselnd als Supersatz. Es zählt für dein Wochenziel Kraft. ${S.training.equipment && S.training.equipment.dumbbells ? 'Deine Hanteln gehen bis je ' + S.training.equipment.dumbbells.max + ' kg, also in 2-kg-Schritten (je Seite eine 1-kg-Scheibe). Sind sie ausgereizt, steigert die App die Wiederholungen.' : ''}</p>
      <button class="btn block" data-a="home.start">${ic('play')}Heimtraining starten</button></div>`;
  }
  function stretchBuilder() {
    ui.st = ui.st || { when: new Date().getHours() < 14 ? 'morgen' : 'abend', min: 10, focus: 'ganz' };
    const items = H.stretchPlan(ui.st.when, ui.st.min, ui.st.focus);
    return `<div class="panel"><div class="sec-head"><h3 style="font-size:20px;font-stretch:80%">Dehnen und Mobilität</h3><span class="sec-meta">mit Timer, Schritt für Schritt</span></div>
      <div class="hrow"><span class="hlbl">Wann</span>${seg('Wann', [['morgen', 'Morgens'], ['abend', 'Abends']], ui.st.when, { a: 'st.when' })}</div>
      <div class="hrow"><span class="hlbl">Dauer</span>${seg('Dauer', [['5', '5 Min.'], ['10', '10 Min.'], ['15', '15 Min.']], String(ui.st.min), { a: 'st.min' })}</div>
      <div class="hrow top"><span class="hlbl">Fokus</span>${chipGroup('Fokus', Object.entries(H.STRETCH_FOCUS), ui.st.focus, 'st.focus')}</div>
      <p class="small ink2" style="margin:10px 0 12px">${items.length} Übungen, ca. ${planMin(items)} Minuten: ${esc(items.map(x => x.n).join(', '))}</p>
      <button class="btn block" data-a="st.start">${ic('play')}Dehnen starten</button>
      <h3 class="mini-h" style="margin-top:16px">Feste Abläufe</h3>
      <div class="row wrap">${['haltung', 'buero'].map(k => { const r = S.training.routines[k]; return `<button class="btn sm quiet" data-a="pl.preset" data-k="${k}">${ic('play')}${esc(r.name)}, ${planMin(stretchItems(k))} Min.</button>`; }).join('')}</div></div>`;
  }
  function viewHome() {
    return `<p class="lead" style="margin-bottom:16px">Für Tage ohne Gym: ein Kurzhantel-Training, das du an Zeit und Fokus anpasst, und Dehnen mit Timer, der dich durch jede Übung führt.</p>
      <div class="two-col">${homeBuilder()}${stretchBuilder()}</div>`;
  }

  // ---------- Pflege: reminders + routine ----------
  function viewCare() {
    const d = E.today();
    const rh = S.grooming.tasks.map(t => ({ t, du: E.due(S, t, d) })).sort((a, b) => (a.du.diff == null ? -999 : a.du.diff) - (b.du.diff == null ? -999 : b.du.diff));
    const showHint = !S.meta.dismissed.careStart && E.diffDays(S.meta.setup || d, d) < 21;
    const row = ({ t, du }) => `<li><button class="check" data-a="care.done" data-id="${t.id}" data-d="${d}" aria-pressed="false" aria-label="${esc(t.name)} heute erledigt">${ic('check')}</button>
      <div class="check-body"><div class="row" style="align-items:baseline"><div class="check-name grow">${esc(t.name)}</div><span class="small muted">${E.everyText(t.every)}${t.weekend ? ', am Wochenende' : ''}</span></div>
      <div class="check-meta ${du.state === 'overdue' ? 'over' : du.state === 'today' ? 'due' : ''}">${dueText(du)}${S.grooming.last[t.id] ? ', zuletzt ' + E.fmtRel(S.grooming.last[t.id]) : ''}</div>
      <details class="how"><summary>Wie und womit, Datum ändern</summary><p class="how-text">${esc(t.how)}</p>${t.with ? `<p class="how-with">Womit: ${esc(t.with)}</p>` : ''}
        <div class="row wrap" style="margin-top:10px"><label class="small ink2">Zuletzt erledigt <input type="date" class="inline-num" style="width:auto;padding:0 8px" value="${S.grooming.last[t.id] || ''}" data-c="care.last" data-id="${t.id}"></label>
        <label class="small ink2">Rhythmus in Tagen <input type="number" class="inline-num" min="1" value="${t.every}" data-c="care.every" data-id="${t.id}"></label>
        ${t.custom ? `<button class="btn sm ghost" data-a="care.del" data-id="${t.id}">${ic('trash')}Entfernen</button>` : ''}</div></details></div></li>`;
    const R = S.grooming.routine;
    const due = rh.filter(x => x.du.state === 'overdue' || x.du.state === 'today');
    return `${showHint ? `<div class="note info" style="margin-bottom:18px">${ic('info')}<div class="grow">Die Startdaten sind geschätzt, damit nicht alles am ersten Tag fällig ist. Hake ab, was du zuletzt gemacht hast, oder trag das Datum in den Details ein.</div><button class="icon-btn" data-a="dismiss" data-k="careStart" aria-label="Hinweis schließen">${ic('x')}</button></div>` : ''}
      <div class="two-col care-cols">
        <div class="panel" style="padding-bottom:8px"><div class="sec-head"><h2 class="sec-title">Erinnerungen im Rhythmus</h2><span class="sec-meta">${due.length ? due.length + ' fällig' : 'nichts fällig'}</span></div>
          <p class="small muted" style="margin:-4px 0 4px">Abhaken, wenn erledigt. Dann startet der Rhythmus neu.</p>
          <ul class="checklist">${rh.map(row).join('')}</ul>
          <div class="row wrap" style="margin:10px 0 8px"><button class="btn sm quiet" data-a="care.new">${ic('plus')}Eigene Erinnerung</button><button class="btn sm ghost" data-a="care.icsOpen">${ic('cal')}In den Kalender</button></div></div>
        <div>
          <div class="panel"><div class="sec-head"><h2 class="sec-title">Deine Routine</h2><button class="btn sm ghost" data-a="routine.editOpen">${ic('edit')}Ändern</button></div>
            <p class="small muted" style="margin:-4px 0 10px">Läuft von allein, hier gibt es nichts abzuhaken.</p>
            <div class="routine-grid"><div><h3 class="mini-h">${ic('sun')}Morgens</h3><ul class="plain-list">${R.morgens.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
              <div><h3 class="mini-h">${ic('timer')}Abends</h3><ul class="plain-list">${R.abends.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
            <div class="note info" style="margin-top:14px">${ic('sun')}<div class="grow">An sonnigen Tagen gehört Sonnenschutz LSF 30 auf Gesicht, Ohren und Kopf, auch im Winter. Die App erinnert dich auf der Startseite, sobald der UV-Index bei 3 oder höher liegt.</div></div></div>
          <div class="panel" style="margin-top:16px"><h2 class="sec-title" style="margin-bottom:6px">Gut zu wissen</h2>
            <p class="small ink2">Ob deine Abendroutine mit Nasenspülung und Zahnseide wirkt, zeigt sich unter Gesundheit, Muster: Trag beim Check-in ein, wenn du etwas ausgelassen hast. Die App vergleicht das mit deinem Atem am nächsten Morgen und mit Infekt-Anzeichen.</p></div>
        </div>
      </div>`;
  }
  function careIcsDialog() {
    openDialog(`${dlgHead('Pflege-Erinnerungen in den Kalender')}<p class="how-text" style="margin-bottom:12px">Für jede gewählte Aufgabe entsteht eine Terminserie im festen Rhythmus, ab dem nächsten Fälligkeitstag. Der Kalender auf PC und Handy erinnert dich dann um 9 Uhr, auch wenn diese App zu ist. Er weiß allerdings nicht, wann du etwas früher erledigt hast.</p>
      <ul class="checklist" id="care-ics">${S.grooming.tasks.map(t => `<li><label class="toggle grow"><input type="checkbox" value="${t.id}"${t.every >= 14 ? ' checked' : ''}><span><span class="check-name">${esc(t.name)}</span> <span class="small muted">${E.everyText(t.every)}${t.weekend ? ', samstags' : ''}</span></span></label></li>`).join('')}</ul>
      <div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="care.icsSave">${ic('download')}Kalender-Datei speichern</button></div>`);
  }
  function careNewDialog() {
    openDialog(`${dlgHead('Eigene Erinnerung')}<form class="form-grid" id="care-form" onsubmit="return false">
      <label class="field full"><span>Was?</span><input name="name" autofocus placeholder="z. B. Zungenschaber erneuern"></label>
      <label class="field"><span>Alle wie viele Tage?</span><input type="number" name="every" min="1" value="30"></label>
      <label class="field"><span>Zuletzt erledigt</span><input type="date" name="last" value="${E.today()}"></label>
      <label class="field full"><span>Hinweis (optional)</span><input name="how"></label></form>
      <div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="care.save">Speichern</button></div>`);
  }

  // ---------- Actions ----------
  const HA = {
    'hc.date': el => { ui.hDate = el.dataset.v; render(); },
    'hc.set': el => { const x = hEdit(el.dataset.d), k = el.dataset.k, v = +el.dataset.v; x[k] = x[k] === v ? null : v; save(); render(); },
    'hc.step': el => { const x = hEdit(el.dataset.d), k = el.dataset.k; x[k] = Math.max(0, Math.min(14, (x[k] == null ? 7 : x[k]) + (+el.dataset.v))); save(); render(); },
    'hc.breath': el => { const x = hEdit(el.dataset.d), v = +el.dataset.v; x.breath = x.breath === v ? null : v; save(); render(); },
    'hc.sym': el => { const x = hEdit(el.dataset.d), k = el.dataset.k; const v = ((x.sym[k] || 0) + 1) % 4; if (v) { x.sym[k] = v; x.none = false; } else delete x.sym[k]; save(); render(); },
    'hc.bm': el => { const x = hEdit(el.dataset.d), k = 'bm:' + el.dataset.k; const v = ((x.sym[k] || 0) + 1) % 4; if (v) { x.sym[k] = v; x.none = false; } else delete x.sym[k]; save(); render(); },
    'hc.none': el => {
      const x = hEdit(el.dataset.d);
      if (x.none) { x.none = false; save(); render(); return; }
      const prev = Object.assign({}, x.sym);
      x.sym = {}; x.none = true; save(); render();
      if (Object.keys(prev).length) toast('Beschwerden entfernt', () => { const y = hEdit(el.dataset.d); y.sym = prev; y.none = false; });
    },
    'hc.meas': el => { const x = hEdit(el.dataset.d), k = el.dataset.k; x.meas = x.meas.includes(k) ? x.meas.filter(m => m !== k) : x.meas.concat([k]); save(); render(); },
    'hc.f': el => { const x = hEdit(el.dataset.d), k = el.dataset.k; if (x.f[k]) delete x.f[k]; else x.f[k] = true; save(); render(); },
    'hc.fnum': el => { const x = hEdit(el.dataset.d), k = el.dataset.k, v = +el.dataset.v; if (x.f[k] === v) delete x.f[k]; else x.f[k] = v; save(); render(); },
    'hc.custom': el => { ui.customDay = el.dataset.d; openDialog(`${dlgHead('Eigene Beschwerde')}<label class="field"><span>Bezeichnung</span><input id="cust-in" autofocus placeholder="z. B. Ohrendruck"></label><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="hc.customSave">Hinzufügen</button></div>`); },
    'hc.customSave': () => { const v = ($('#cust-in').value || '').trim(); if (!v) return; const x = hEdit(ui.customDay); x.sym['c:' + v] = 1; x.none = false; save(); closeDialog(); render(); },
    'hc.measadd': () => openDialog(`${dlgHead('Eigene Maßnahme')}<label class="field"><span>Bezeichnung</span><input id="meas-in" autofocus placeholder="z. B. Ingwertee, Zink, Inhalieren"></label><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="hc.measSave">Hinzufügen</button></div>`),
    'hc.measSave': () => { const v = ($('#meas-in').value || '').trim(); if (!v) return; S.health.measures.push({ id: uid('m'), l: v }); save(); closeDialog(); render(); },
    'obs.new': () => obsDialog(),
    'obs.save': async () => {
      const f = new FormData($('#obs-form')); const text = String(f.get('text') || '').trim();
      if (!text) { toast('Bitte kurz beschreiben, was dir auffällt.'); return; }
      const o = { id: uid('o'), date: f.get('date') || E.today(), text, region: f.get('region') || '', fach: f.get('fach') || 'allg' };
      S.health.obs.push(o);
      if (ui.obsPhoto) { await Photos.put('obs:' + o.id, ui.obsPhoto); ui.obsPhoto = null; }
      save(); closeDialog(); render(); toast('Beobachtung gespeichert');
    },
    'obs.del': el => confirmDlg('Beobachtung löschen?', 'Der Eintrag und sein Foto werden entfernt.', 'Löschen', async () => { S.health.obs = S.health.obs.filter(o => o.id !== el.dataset.id); try { await Photos.del('obs:' + el.dataset.id); } catch (e) { /* none */ } save(); render(); }, true),
    // doctors and appointments
    'appt.new': () => apptDialog(null),
    'appt.edit': el => apptDialog(el.dataset.id),
    'appt.save': () => {
      const f = new FormData($('#appt-form'));
      const data = { doc: f.get('doc'), date: f.get('date'), time: f.get('time') || '', reason: String(f.get('reason') || '').trim(), vs: f.get('vs') || '' };
      if (!data.date) { toast('Bitte ein Datum wählen.'); return; }
      if (ui.apptId) Object.assign(S.health.appts.find(a => a.id === ui.apptId), data); else S.health.appts.push(Object.assign({ id: uid('a'), done: false }, data));
      save(); closeDialog(); render(); toast('Termin gespeichert');
    },
    'appt.del': el => { S.health.appts = S.health.appts.filter(a => a.id !== el.dataset.id); save(); closeDialog(); render(); },
    'appt.note': el => noteDialog(el.dataset.id),
    'appt.quick': el => noteDialog(null, el.dataset.id),
    'note.med': () => { closeDialog(); medDialog(null); },
    'note.save': () => {
      const f = new FormData($('#note-form'));
      const data = { doc: f.get('doc'), date: f.get('date') || E.today(), reason: String(f.get('reason') || '').trim(), talk: String(f.get('talk') || '').trim(), next: String(f.get('next') || '').trim(), done: true };
      const vs = f.get('vs');
      let a;
      if (ui.noteId) { a = S.health.appts.find(x => x.id === ui.noteId); Object.assign(a, data); } else { a = Object.assign({ id: uid('a') }, data); S.health.appts.push(a); }
      if (vs) { const v = S.health.vorsorge.find(x => x.id === vs); if (v) v.last = a.date; a.vs = vs; }
      else if (a.vs) { const v = S.health.vorsorge.find(x => x.id === a.vs); if (v && (!v.last || v.last < a.date)) v.last = a.date; }
      const fol = +f.get('follow');
      if (fol) { S.health.followups = S.health.followups || []; S.health.followups.push({ id: uid('f'), doc: a.doc, by: E.addDays(a.date, fol), text: 'Termin bei ' + docName(a.doc) + ' vereinbaren' }); }
      save(); closeDialog(); render(); toast('Notiz gespeichert');
    },
    'fu.done': el => { const x = (S.health.followups || []).find(f => f.id === el.dataset.id); if (x) x.done = true; save(); render(); },
    'doc.new': () => docDialog(null),
    'doc.edit': el => docDialog(el.dataset.id),
    'doc.save': () => {
      const f = new FormData($('#doc-form')); const data = { title: String(f.get('title') || '').trim() || 'Arzt', fach: f.get('fach'), name: String(f.get('name') || '').trim(), phone: String(f.get('phone') || '').trim(), note: String(f.get('note') || '').trim() };
      if (ui.docId) Object.assign(docById(ui.docId), data); else S.health.doctors.push(Object.assign({ id: uid('doc') }, data));
      save(); closeDialog(); render();
    },
    'doc.del': el => { S.health.doctors = S.health.doctors.filter(x => x.id !== el.dataset.id); save(); closeDialog(); render(); },
    'q.new': el => { ui.qDoc = el.dataset.id; openDialog(`${dlgHead('Frage für ' + docName(el.dataset.id))}<label class="field"><span>Frage</span><textarea id="q-in" rows="3" autofocus></textarea></label><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="q.save">Speichern</button></div>`); },
    'q.save': () => { const v = ($('#q-in').value || '').trim(); if (!v) return; S.health.questions.push({ id: uid('q'), doc: ui.qDoc, text: v, date: E.today(), done: false }); save(); closeDialog(); render(); toast('Frage notiert'); },
    'q.done': el => { const q = S.health.questions.find(x => x.id === el.dataset.id); q.done = true; save(); render(); toast('Frage abgehakt', () => { q.done = false; }); },
    // meds
    'med.new': () => medDialog(null),
    'med.edit': el => medDialog(el.dataset.id),
    'med.save': () => {
      const f = new FormData($('#med-form'));
      const name = String(f.get('name') || '').trim(); if (!name) { toast('Bitte einen Namen eintragen.'); return; }
      const times = [...f.getAll('time'), f.get('time2')].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).sort();
      if (!times.length) { toast('Bitte mindestens eine Zeit wählen.'); return; }
      const start = f.get('start') || E.today(), days = +f.get('days');
      const data = { name, dose: String(f.get('dose') || '').trim(), times, start, end: days ? E.addDays(start, days - 1) : null, note: String(f.get('note') || '').trim(), by: f.get('by') || '' };
      if (ui.medId) Object.assign(S.health.meds.find(m => m.id === ui.medId), data); else S.health.meds.push(Object.assign({ id: uid('med'), stopped: null }, data));
      save(); closeDialog(); render(); toast('Medikament gespeichert. Tipp: Erinnerungen in den Kalender übernehmen.');
    },
    'med.stop': el => { const m = S.health.meds.find(x => x.id === el.dataset.id); m.stopped = E.today(); save(); render(); toast('Beendet', () => { m.stopped = null; }); },
    'med.del': el => { S.health.meds = S.health.meds.filter(m => m.id !== el.dataset.id); save(); closeDialog(); render(); },
    'med.take': el => { const d = el.dataset.d, id = el.dataset.id, t = el.dataset.t; const I0 = S.health.intake; I0[d] = I0[d] || {}; I0[d][id] = I0[d][id] || {}; if (I0[d][id][t]) delete I0[d][id][t]; else I0[d][id][t] = Date.now(); save(); render(); },
    // calendar files
    'ics.appt': el => { const a = S.health.appts.find(x => x.id === el.dataset.id); download('termin-' + a.date + '.ics', H.ics([{ uid: a.id, date: a.date, time: a.time || '09:00', minutes: 45, title: 'Arzttermin: ' + docName(a.doc), desc: a.reason || '', alarms: ['-P1D', '-PT2H'] }]), 'text/calendar'); },
    'ics.vs': el => {
      const v = S.health.vorsorge.find(x => x.id === el.dataset.id), du = H.vorsorgeDue(S, v, E.today());
      let date = du.date ? E.addDays(du.date, -28) : E.addDays(E.today(), 7); if (date < E.today()) date = E.addDays(E.today(), 1);
      download('vorsorge-' + v.id + '.ics', H.ics([{ uid: 'vs-' + v.id + '-' + date, date, allDay: true, title: 'Termin vereinbaren: ' + v.name, desc: (du.date ? 'Fällig ab ' + E.fmtDate(du.date) + '. ' : 'Bitte prüfen, wann zuletzt. ') + docName(v.doc) + '. ' + v.note, alarms: ['PT9H'] }]), 'text/calendar');
    },
    'ics.jan': () => {
      const t = E.today(), ny = (+t.slice(0, 4)) + (t.slice(5) > '01-15' ? 1 : 0), date = H.firstMondayJan(ny);
      download('jahres-vorsorge-januar.ics', H.ics([{ uid: 'jan-vorsorge', date, time: '09:00', minutes: 15, title: 'Vorsorge-Termine für das Jahr vereinbaren', desc: 'Check-up, Hautkrebs-Screening, Zahnarzt und Impfpass prüfen. Was fällig ist, zeigt Chris OS unter Gesundheit, Ärzte und Vorsorge.', rrule: 'FREQ=YEARLY', alarms: ['PT0M'] }]), 'text/calendar');
    },
    'ics.bed': () => {
      const P = S.health.profile || {}, bed = P.bed || '22:30';
      const [h, m] = bed.split(':').map(Number), rem = String(h * 60 + m - 15 < 0 ? 0 : Math.floor((h * 60 + m - 15) / 60)).padStart(2, '0') + ':' + String((h * 60 + m - 15) % 60).padStart(2, '0');
      let date = E.today(); while (![0, 1, 2, 3, 4].includes(E.weekday(date))) date = E.addDays(date, 1);
      download('bettzeit-erinnerung.ics', H.ics([{ uid: 'bettzeit', date, time: rem, minutes: 15, title: 'Schlafenszeit: in 15 Minuten ins Bett', desc: 'Damit du um ' + bed + ' Uhr im Bett bist und auf ' + n0(P.sleepGoal || 7.5) + ' Stunden kommst.' + ((P.triggers || []).includes('schlaf') ? ' Schlafmangel ist dein häufigster Erkältungs-Auslöser.' : ''), rrule: 'FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH', alarms: ['PT0M'] }]), 'text/calendar');
      toast('Kalender-Datei gespeichert: Sonntag bis Donnerstag um ' + rem + ' Uhr.');
    },
    'ics.checkin': () => {
      download('check-in-erinnerung.ics', H.ics([{ uid: 'check-in', date: E.today(), time: '21:00', minutes: 5, title: 'Check-in: Wie war dein Tag?', desc: 'Kurz in Chris OS unter Gesundheit eintragen: Befinden, Schlaf, Beschwerden.', rrule: 'FREQ=DAILY', alarms: ['PT0M'] }]), 'text/calendar');
      toast('Kalender-Datei gespeichert: jeden Abend um 21 Uhr.');
    },
    'ics.fu': el => { const f = S.health.followups.find(x => x.id === el.dataset.id); let date = E.addDays(f.by, -14); if (date < E.today()) date = E.today(); download('termin-vereinbaren.ics', H.ics([{ uid: f.id, date, allDay: true, title: f.text, desc: 'Bis ' + E.fmtDate(f.by), alarms: ['PT9H'] }]), 'text/calendar'); },
    'ics.med': el => {
      const m = S.health.meds.find(x => x.id === el.dataset.id);
      const until = m.end ? m.end.replace(/-/g, '') + 'T235959' : null;
      download('medikament-' + m.name.toLowerCase().replace(/[^a-z0-9äöü]+/g, '-') + '.ics', H.ics(m.times.map(t => ({ uid: m.id + '-' + t.replace(':', ''), date: m.start, time: t, minutes: 5, title: m.name + (m.dose ? ', ' + m.dose : ''), desc: m.note || '', rrule: 'FREQ=DAILY' + (until ? ';UNTIL=' + until : ''), alarms: ['PT0M'] }))), 'text/calendar');
    },
    'care.icsOpen': () => careIcsDialog(),
    'care.icsSave': () => {
      const t = E.today();
      const ids = [...document.querySelectorAll('#care-ics input:checked')].map(x => x.value);
      if (!ids.length) { toast('Bitte mindestens eine Aufgabe wählen.'); return; }
      const evs = S.grooming.tasks.filter(task => ids.includes(task.id)).map(task => {
        const du = E.due(S, task, t); let date = du.date && du.date >= t ? du.date : t;
        if (task.weekend) while (E.weekday(date) !== 6) date = E.addDays(date, 1);
        return { uid: 'care-' + task.id, date, allDay: true, title: 'Pflege: ' + task.name, desc: [task.how, task.with ? 'Womit: ' + task.with : ''].filter(Boolean).join(' '), rrule: task.weekend ? 'FREQ=WEEKLY;BYDAY=SA' : 'FREQ=DAILY;INTERVAL=' + task.every, alarms: ['PT9H'] };
      });
      download('pflege-erinnerungen.ics', H.ics(evs), 'text/calendar'); closeDialog(); toast(evs.length + (evs.length === 1 ? ' Terminserie' : ' Terminserien') + ' gespeichert. Datei öffnen, um sie in den Kalender zu übernehmen.');
    },
    'care.new': () => careNewDialog(),
    'care.save': () => {
      const f = new FormData($('#care-form')); const name = String(f.get('name') || '').trim();
      if (!name) { toast('Bitte eintragen, woran die App dich erinnern soll.'); return; }
      const t = { id: uid('c'), slot: 'rhythmus', name, every: Math.max(1, +f.get('every') || 30), how: String(f.get('how') || '').trim(), with: '', custom: true };
      S.grooming.tasks.push(t); S.grooming.last[t.id] = f.get('last') || E.today();
      save(); closeDialog(); render(); toast('Erinnerung angelegt');
    },
    'care.del': el => confirmDlg('Erinnerung entfernen?', 'Die Aufgabe verschwindet aus der Liste.', 'Entfernen', () => { S.grooming.tasks = S.grooming.tasks.filter(t => t.id !== el.dataset.id); delete S.grooming.last[el.dataset.id]; save(); render(); }, true),
    'pl.log': () => plFinish(),
    // report
    'rep.range': el => { ui.rep.range = el.dataset.v; render(); },
    'rep.fach': el => { ui.rep.fach = el.dataset.v; render(); },
    'rep.open': () => {
      const html = reportHTML();
      const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      const w = window.open(url, '_blank');
      if (!w) { download('gesundheitsbericht-' + E.today() + '.html', html, 'text/html'); toast('Der Bericht wurde als Datei gespeichert. Öffne sie und drucke von dort.'); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },
    'rep.csv': () => download('gesundheit-' + E.today() + '.csv', csvAll(), 'text/csv'),
    // training: home + stretching
    'home.min': el => { ui.home.min = +el.dataset.v; render(); },
    'home.focus': el => { ui.home.focus = el.dataset.v; ui.home.picks = {}; render(); },
    'home.start': () => {
      if (S.training.active) { location.hash = '#/training/session'; return; }
      const plan = H.homePlan(ui.home.focus, ui.home.min, ui.home.picks);
      startSessionWith({ plan: 'home', name: 'Heimtraining, ' + H.HOME_FOCUS[ui.home.focus] + ' ' + ui.home.min + ' Min.', items: plan.map(p => ({ ex: p.ex, ss: p.ss })) });
    },
    'st.when': el => { ui.st.when = el.dataset.v; render(); },
    'st.min': el => { ui.st.min = +el.dataset.v; render(); },
    'st.focus': el => { ui.st.focus = el.dataset.v; render(); },
    'st.start': () => startPlayer(ui.st.when, ui.st.min, ui.st.focus),
    'pl.preset': el => startPlayer(el.dataset.k, 0, 'ganz'),
    'pl.quick': el => { const when = el.dataset.k; startPlayer(when, 10, 'ganz'); },
    'pl.toggle': () => { const P = ui.player; if (!P) return; if (P.running) { P.running = false; P.left = Math.max(0, (P.endAt - Date.now()) / 1000); clearInterval(plTimer); } else { P.running = true; P.endAt = Date.now() + P.left * 1000; clearInterval(plTimer); plTimer = setInterval(plTick, 250); } render(); },
    'pl.next': () => { const P = ui.player; if (!P) return; if (P.idx + 1 >= P.items.length) { P.left = 0; P.endAt = Date.now(); P.half = 1; plTick(); return; } P.idx++; P.half = 0; P.left = P.items[P.idx].sec; P.endAt = Date.now() + P.left * 1000; render(); },
    'pl.prev': () => { const P = ui.player; if (!P) return; P.idx = Math.max(0, P.idx - 1); P.half = 0; P.left = P.items[P.idx].sec; P.endAt = Date.now() + P.left * 1000; render(); },
    'pl.stop': () => { clearInterval(plTimer); ui.player = null; location.hash = '#/training'; },
    'routine.editOpen': () => openDialog(`${dlgHead('Deine Routine')}<p class="small muted" style="margin-bottom:10px">Eine Zeile pro Schritt.</p><label class="field"><span>Morgens</span><textarea id="rt-m" rows="5">${esc(S.grooming.routine.morgens.join('\n'))}</textarea></label><label class="field" style="margin-top:12px"><span>Abends</span><textarea id="rt-a" rows="5">${esc(S.grooming.routine.abends.join('\n'))}</textarea></label><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="routine.editSave">Speichern</button></div>`),
    'routine.editSave': () => { const sp = v => v.split('\n').map(x => x.trim()).filter(Boolean); S.grooming.routine = { morgens: sp($('#rt-m').value), abends: sp($('#rt-a').value) }; save(); closeDialog(); render(); }
  };
  const HC = {
    'hc.temp': el => {
      const x = hEdit(el.dataset.d); const v = el.value.trim().replace(',', '.');
      if (v !== '' && (isNaN(+v) || +v < 34 || +v > 43)) { toast('Bitte die Temperatur in Grad eintragen, z. B. 37,2.'); return; }
      x.temp = v === '' ? null : Math.round(+v * 10) / 10;
      if (x.temp != null && x.temp >= 38) { x.sym.fieber = Math.max(x.sym.fieber || 0, x.temp >= 39 ? 3 : 2); x.none = false; }
      save(); render();
    },
    'hc.note': el => { const x = hEdit(el.dataset.d); x.note = el.value; clearTimeout(ui.noteT); save(); },
    'ep.out': el => { S.health.epOut = S.health.epOut || {}; S.health.epOut[el.dataset.k] = el.value; save(); render(); },
    'vs.last': el => { const v = S.health.vorsorge.find(x => x.id === el.dataset.id); v.last = el.value || null; save(); render(); },
    'rec.set': el => { S.health.record[el.dataset.k] = el.value; save(); },
    'rep.photos': el => { ui.rep.photos = el.checked; },
    'home.pick': el => { ui.home.picks[el.dataset.slot] = el.value; render(); },
    'obs.photo': async el => { const f = el.files[0]; if (!f) return; try { ui.obsPhoto = await shrink(f); $('#obs-ph').textContent = 'Foto übernommen'; } catch (e) { toast('Das Bild konnte nicht gelesen werden.'); } }
  };
  const HI = {
    'hc.noteI': el => { const x = hEdit(el.dataset.d); x.note = el.value; clearTimeout(ui.noteT); ui.noteT = setTimeout(save, 600); }
  };
  Object.assign(A, HA); Object.assign(C, HC); Object.assign(I, HI);
  // ---------- end Gesundheit ----------
