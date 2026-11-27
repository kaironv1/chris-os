  // ---------- Selbstexperimente (2.9) – inserted into app.js at build time ----------
  // One rule for some days (14 by default), ticked off in the check-in. The app compares the check-in values on days
  // with the rule against the same number of days before the start. A hint, never a proof.
  const XP = window.Exp;
  const exps = () => S.health.exps || (S.health.exps = []);
  const expById = id => exps().find(e => e.id === id);
  const expP = () => S.health.profile || {};
  // Only one experiment at a time, so the effects do not mix
  const expActive = () => exps().find(e => ['laeuft', 'geplant'].includes(XP.status(e, E.today()))) || null;
  // A week or more back the weekday alone is ambiguous (check-in after the fact, 2.16): "Am 17.11."
  const xDay = d => { const t = E.today(); return d === t ? 'Heute' : d === E.addDays(t, -1) ? 'Gestern' : E.diffDays(d, t) >= 7 ? 'Am ' + E.fmtShort(d) : E.WD_LONG[E.weekday(d)]; };
  const listDe = a => (a.length > 1 ? a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1] : a.join(''));
  const FAZIT = { besser: 'hat geholfen', gleich: 'kein Unterschied', schlechter: 'eher schlechter' };

  // ---------- Heute and the check-in ----------
  // Which experiment the check-in on Heute shows: an open question first (also the last day after the end), then the
  // running or planned one, then one that ended in the last three days without a conclusion
  function expForCheckin() {
    const t = E.today(), h = new Date().getHours(), L = exps().slice().sort((a, b) => (a.start < b.start ? 1 : -1));
    for (const e of L) { const d = XP.askDay(S, e, t, h); if (d) return { e, ask: d }; }
    const a = expActive();
    if (a) return { e: a, ask: null };
    const f = L.find(e => XP.status(e, t) === 'fertig' && !e.verdict && E.diffDays(XP.lastDay(e), t) <= 3);
    return f ? { e: f, ask: null, done: true } : null;
  }
  function expSum() { const c = expForCheckin(); return c && c.ask ? 'Experiment: ' + xDay(c.ask).toLowerCase() + ' offen' : ''; }
  function expYesNo(e, d, cur, label) {
    return `<div class="seg exp-yn" role="group" aria-label="${esc(label)}"><button data-a="exp.set" data-id="${e.id}" data-d="${d}" data-v="1" aria-pressed="${cur === true}">Ja</button><button data-a="exp.set" data-id="${e.id}" data-d="${d}" data-v="0" aria-pressed="${cur === false}">Nein</button></div>`;
  }
  // Row in „Wie geht’s dir?“ on Heute
  function expRow() {
    const c = expForCheckin();
    if (!c) return '';
    const { e } = c, t = E.today(), st = XP.status(e, t), more = '<a class="link-btn small" href="#/gesundheit/experimente">';
    let body;
    if (c.ask) {
      const q = XP.ask(e, xDay(c.ask));
      body = `<div class="exp-meta small ink2">${esc(e.rule)}, Tag ${XP.dayNo(e, c.ask)} von ${e.days}</div><div class="exp-q-row"><span class="exp-q">${esc(q)}</span>${expYesNo(e, c.ask, null, q)}</div>`;
    } else if (c.done) {
      body = `<div class="exp-meta small ink2">„${esc(e.rule)}“ ist abgeschlossen. ${more}Ergebnis ansehen</a></div>`;
    } else if (st === 'geplant') {
      body = `<div class="exp-meta small ink2">${esc(e.rule)}, startet ${E.fmtRel(e.start)}.</div>`;
    } else {
      const last = [t, E.addDays(t, -1)].find(x => XP.inRange(e, x) && XP.kept(S, e, x)), k = last ? XP.kept(S, e, last) : null;
      body = `<div class="exp-meta small ink2">${esc(e.rule)}, Tag ${XP.dayNo(e, t)} von ${e.days}.${k ? ' ' + esc(xDay(last) + (k.v ? ' eingehalten' : ' nicht eingehalten') + (k.auto ? ': ' + k.why : '')) + '.' : ''} ${more}Ändern</a></div>`;
    }
    return `<div class="hrow exp-row"><span class="hlbl">Experiment</span><div class="exp-cell">${body}</div></div>`;
  }
  // Row in the full check-in under Gesundheit, for the chosen day
  function expDayRow(d) {
    const t = E.today(), e = exps().slice().sort((a, b) => (a.start < b.start ? 1 : -1)).find(x => XP.inRange(x, d) && d <= t);
    if (!e) return '';
    const k = XP.kept(S, e, d), q = XP.ask(e, xDay(d));
    return `<div class="hrow exp-row"><span class="hlbl">Experiment</span><div class="exp-cell"><div class="exp-meta small ink2">${esc(e.rule)}, Tag ${XP.dayNo(e, d)} von ${e.days}</div><div class="exp-q-row"><span class="exp-q">${esc(q)}</span>${expYesNo(e, d, k ? k.v : null, q)}</div>${k && k.auto ? `<p class="small muted exp-auto">${esc(k.why)}. Tippe an, um es zu ändern.</p>` : ''}</div></div>`;
  }

  // ---------- Gesundheit, Experimente ----------
  function viewExperiments() {
    const t = E.today(), act = expActive();
    const done = exps().filter(e => e !== act && ['fertig', 'abgebrochen'].includes(XP.status(e, t))).sort((a, b) => (XP.lastDay(a) < XP.lastDay(b) ? 1 : -1));
    const recent = !act && done[0] && E.diffDays(XP.lastDay(done[0]), t) <= 7 ? done[0] : null;
    const older = done.filter(e => e !== recent);
    return `${act ? expCard(act) : (recent ? expFinished(recent, true) : '') + expStart()}
      ${older.length ? `<h2 class="block-title">Frühere Experimente</h2>${older.map(e => expFinished(e, false)).join('')}` : ''}
      <details class="how" style="margin-top:22px"><summary>So vergleicht die App</summary><p class="how-text">Verglichen werden die Tage, an denen du die Regel eingehalten hast, mit genauso vielen Tagen vor dem Start. Schlaf zählt immer für die Nacht nach dem Tag, weil du ihn am Morgen danach einträgst. Bei Regeln für den Abend zählen auch Befinden, Energie und Beschwerden vom Tag danach. Als Unterschied gilt erst, was größer ist als eine Viertelstunde Schlaf, 0,3 Punkte auf einer Skala oder 15 Prozentpunkte bei Tagen mit Beschwerden und sich zugleich deutlich von den üblichen Schwankungen abhebt. Dafür braucht es mindestens vier Tage auf jeder Seite. Ein Experiment nach dem anderen, damit sich die Wirkungen nicht vermischen.</p></details>`;
  }
  // Templates, those with a reason from the own data first
  function expStart() {
    const t = E.today(), hs = XP.hints(S, t), P = expP();
    const list = XP.TPL.filter(T => T.id !== 'eigen').map((T, i) => ({ T, i, fit: hs[T.id] })).sort((a, b) => (!!b.fit - !!a.fit) || a.i - b.i);
    const cards = list.map(({ T, fit }) => `<li class="exp-tpl"><div class="check-body"><div class="check-name">${esc(T.rule(P))}</div><div class="check-meta">Vergleicht ${esc(listDe(T.m.map(k => XP.measure(k).l)))}${T.when === 'abend' ? ', jeweils am Morgen danach' : ''}.</div>${fit ? `<div class="exp-fit small">${ic('info')}<span>${esc(fit)}</span></div>` : ''}</div><button class="btn sm quiet" data-a="exp.new" data-k="${T.id}">Starten</button></li>`).join('');
    return `<div class="panel exp-start"><div class="sec-head"><h2 class="sec-title">Ein Experiment starten</h2><button class="btn sm" data-a="exp.new" data-k="eigen">${ic('plus')}Eigene Regel</button></div>
      <p class="small ink2 exp-intro">Prüf eine Vermutung an dir selbst: Halte dich ein paar Tage an eine Regel. Danach vergleicht die App Schlaf, Befinden und Beschwerden aus deinem Check-in mit den Tagen davor. Du hakst nur ab, ob du die Regel eingehalten hast; manches erkennt die App selbst, etwa Kaffee nach 14 Uhr im Ernährungsprotokoll.</p>
      <ul class="checklist exp-tpls">${cards}</ul></div>`;
  }
  // Day by day: ticked, not kept, open; tap to change
  function expStrip(e) {
    const t = E.today(), cells = [];
    for (let d = e.start; d <= XP.lastDay(e); d = E.addDays(d, 1)) {
      const fut = d > t, k = fut ? null : XP.kept(S, e, d), st = fut ? 'fut' : !k ? 'open' : k.v ? 'yes' : 'no';
      const word = fut ? 'noch nicht dran' : !k ? 'offen' : (k.v ? 'eingehalten' : 'nicht eingehalten') + (k.auto ? ', ' + k.why : '');
      cells.push(`<button class="xd ${st}${k && k.auto ? ' auto' : ''}${d === t ? ' today' : ''}" data-a="exp.day" data-id="${e.id}" data-d="${d}"${fut ? ' disabled' : ''} aria-label="${esc(E.fmtLong(d) + ': ' + word)}" title="${esc(E.fmtShort(d) + ': ' + word)}"><span>${E.WD[E.weekday(d)]}</span><b class="num">${E.parse(d).getDate()}</b><i aria-hidden="true">${st === 'yes' ? ic('check') : st === 'no' ? ic('x') : ''}</i></button>`);
    }
    return `<div class="xd-strip" role="group" aria-label="Tage des Experiments">${cells.join('')}</div><p class="small muted xd-note">Häkchen: eingehalten, Kreuz: nicht eingehalten, gestrichelt: aus deinen Einträgen erkannt. Tippe auf einen Tag, um ihn einzutragen oder zu ändern.</p>`;
  }
  function expCard(e) {
    const t = E.today(), st = XP.status(e, t), R = XP.evaluate(S, e, t), n = st === 'geplant' ? 0 : Math.min(e.days, XP.dayNo(e, t));
    const line = st === 'geplant' ? 'Startet ' + E.fmtRel(e.start) + ' und läuft bis ' + E.fmtLong(e.end) + '.'
      : 'Läuft vom ' + E.fmtShort(e.start) + ' bis ' + E.fmtShort(e.end) + ' ' + (R.yes + R.no ? 'Eingehalten an ' + R.yes + ' von ' + pl2(R.days, 'Tag', 'Tagen') + (R.no ? ', nicht eingehalten an ' + R.no : '') + (R.open ? ', ' + R.open + ' offen' : '') + '.' : 'Abhaken kannst du jeden Tag beim Check-in oder hier unten.');
    return `<div class="panel exp-card"><div class="sec-head"><h2 class="sec-title">${esc(e.rule)}</h2><span class="tag denim">${st === 'geplant' ? 'startet ' + esc(E.fmtRel(e.start)) : 'Tag ' + n + ' von ' + e.days}</span></div>
      <div class="meter" aria-hidden="true" style="margin:4px 0 10px"><i style="width:${Math.round(n / e.days * 100)}%"></i></div>
      <p class="small ink2">${esc(line)}</p>
      ${e.expect ? `<p class="small ink2 exp-expect">Deine Erwartung: ${esc(e.expect)}</p>` : ''}
      ${expStrip(e)}
      <div class="row wrap" style="margin-top:12px;gap:8px"><button class="btn sm quiet" data-a="exp.ics" data-id="${e.id}">${ic('cal')}Tägliche Erinnerung in den Kalender</button><span class="grow"></span><button class="btn sm ghost" data-a="exp.stop" data-id="${e.id}">Beenden</button></div></div>
      ${st === 'geplant' ? '' : `<div class="panel exp-result" style="margin-top:16px">${expBody(e, R, false)}</div>`}`;
  }
  // Result: one row per value with a dumbbell (before and with the rule), the chart day by day, the hint
  function expBody(e, R, fin) {
    const head = `<div class="sec-head"><h2 class="sec-title">${fin ? 'Ergebnis' : 'Zwischenstand'}</h2><span class="sec-meta">${fin ? 'eingehalten an ' + R.yes + ' von ' + R.days : 'nach ' + pl2(R.days, 'Tag', 'Tagen')}</span></div>`;
    if (!R.ready) return `${head}<p class="small ink2">${fin ? 'Für einen Vergleich braucht es mindestens vier Tage mit eingehaltener Regel; es waren ' + R.yes + '.' : 'Ab vier Tagen mit eingehaltener Regel vergleicht die App hier deine Werte mit den Tagen davor.' + (R.yes ? ' Bisher ' + pl2(R.yes, 'Tag', 'Tage') + '.' : '')}</p>`;
    const line = XP.verdictLine(R);
    return `${head}${line ? `<p class="ink2 exp-line">${esc(line)}</p>` : ''}${expRows(e, R)}
      <h3 class="mini-h" style="margin-top:18px">Tag für Tag</h3>${expChart(e, R)}
      <p class="small muted" style="margin-top:10px">Ein Hinweis, kein Beweis: Auch Wetter, Stress, Infekte oder der Zufall spielen mit. ${fin ? 'Wenn du sicherer sein willst, wiederhole das Experiment später.' : 'Das Ergebnis steht fest, wenn das Experiment vorbei ist.'}</p>`;
  }
  function dumbbell(m, a, b, names, lab) {
    const pos = v => Math.max(0, Math.min(100, (v - m.lo) / ((m.hi - m.lo) || 1) * 100)), x0 = pos(a.mean), x1 = pos(b.mean);
    const ends = m.kind === 'h' ? [m.lo + ' h', m.hi + ' h'] : m.kind === 'scale' ? ['1', '5'] : m.kind === 'breath' ? ['frisch', 'schlecht'] : ['an keinem Tag', 'an jedem Tag'];
    return `<div class="db" role="img" aria-label="${esc(lab + ': ' + names[0] + ' ' + XP.fmt(m, a) + ', mit Regel ' + XP.fmt(m, b))}"><div class="db-track"><i class="db-line" style="left:${Math.min(x0, x1).toFixed(1)}%;width:${Math.abs(x1 - x0).toFixed(1)}%"></i><i class="db-dot pre" style="left:${x0.toFixed(1)}%"></i><i class="db-dot on" style="left:${x1.toFixed(1)}%"></i></div><div class="db-ax" aria-hidden="true"><span>${esc(ends[0])}</span><span>${esc(ends[1])}</span></div></div>`;
  }
  function expRows(e, R) {
    const span = R.beforeFull ? 'in den ' + e.days + ' Tagen davor' : 'in den Tagen davor';
    const rows = R.res.map(r => {
      const m = r.m, lab = XP.label(e, m), k = r.g.kept, ref = r.g[r.ref || 'before'], viaNot = r.ref === 'not';
      const tag = `<span class="tag${r.verdict === 'besser' ? ' olive' : r.verdict === 'schlechter' ? ' rust' : ''}">${XP.VERDICT[r.verdict]}</span>`;
      // Days with a complaint already read „an 3 von 14 Tagen“, so they get the short words
      const share = m.kind === 'share', without = share ? 'ohne Regel' : 'an Tagen ohne Regel';
      const txt = r.verdict === 'wenig' ? 'Noch zu wenige Einträge: ' + k.n + ' mit Regel, ' + r.g.before.n + ' davor.'
        : XP.fmt(m, k) + ' mit Regel, ' + XP.fmt(m, ref) + ' ' + (viaNot ? without : share ? 'davor' : span) + (!viaNot && r.g.not.n >= 3 ? ', ' + XP.fmt(m, r.g.not) + ' ' + without : '') + '.';
      return `<li class="exp-res"><div class="exp-res-h"><span class="check-name">${esc(lab)}</span>${tag}</div>${r.verdict === 'wenig' ? '' : dumbbell(m, ref, k, [viaNot ? 'ohne Regel' : 'vorher', 'mit Regel'], lab)}<div class="check-meta">${esc(txt)}</div></li>`;
    }).join('');
    const viaNot = R.res.some(r => r.ref === 'not' && r.verdict !== 'wenig');
    return `<ul class="exp-res-list">${rows}</ul><div class="legend"><span><span class="sw" style="background:var(--x-pre)"></span>${viaNot ? 'vorher oder ohne Regel' : 'vorher'}</span><span><span class="sw" style="background:var(--x-on)"></span>mit Regel</span></div>`;
  }
  // Small multiples on one time axis: before in the light blue, the experiment in the dark blue, a ring where the rule
  // was not kept, a line for the mean of each part
  function expChart(e, R) {
    const t = E.today(), to = XP.lastDay(e) < t ? XP.lastDay(e) : t, base = trCols(E.addDays(e.start, -e.days), to);
    const yes = new Set(R.yesDays), no = new Set(R.noDays), i0 = base.findIndex(c => c.days[0] === e.start), iEnd = base.length - 1;
    const cols = base.map(c => { const d = c.days[0]; return Object.assign({}, c, { tip: c.tip + (d < e.start ? ', vor dem Experiment' : yes.has(d) ? ', Regel eingehalten' : no.has(d) ? ', Regel nicht eingehalten' : ', Regel offen') }); });
    const colors = base.map(c => (c.days[0] < e.start ? 'var(--x-pre)' : 'var(--x-on)')), hollow = base.map(c => no.has(c.days[0]));
    const panels = R.res.map(r => {
      const m = r.m, vals = base.map(c => { const o = E.addDays(c.days[0], r.lag); return o > t ? null : XP.value(S, m.key, o); });
      const levels = [{ i0: 0, i1: i0 - 1, v: r.g.before.mean, color: 'var(--x-pre)' }, { i0, i1: iEnd, v: r.g.kept.mean, color: 'var(--x-on)' }];
      const tips = vals.map(v => XP.fmtDay(m, v)), label = XP.label(e, m);
      if (m.kind === 'share') return { label, kind: 'bar', vals, tips, colors, color: 'var(--x-on)', min: 0, max: 1, h: 30, levels, fmt: (v, ax) => (ax ? '' : v ? 'ja' : 'nein'), note: 'Balken: Tag mit ' + m.s };
      return { label, kind: 'dots', r: 4, vals, tips, colors, hollow, color: 'var(--x-on)', mean: [], min: m.lo, max: m.hi, h: 52, levels,
        fmt: (v, ax) => (ax ? (m.kind === 'h' ? n0(v, 0) + ' h' : n0(v, 0)) : XP.fmtDay(m, v)), note: m.kind === 'breath' ? '0 frisch bis 2 schlecht' : m.kind === 'scale' ? '1 bis 5' : '' };
    });
    return stackChart('exp-' + e.id, cols, panels, { label: 'Deine Werte Tag für Tag, vor und während des Experiments', bands: i0 >= 0 ? [{ i0, i1: iEnd, cls: 'exp' }] : [] })
      + `<div class="legend" style="flex-wrap:wrap"><span><span class="sw st-band-sw exp"></span>Experiment</span><span><span class="sw ring"></span>Regel nicht eingehalten</span><span><span class="ln"></span>Schnitt vorher und mit Regel</span></div>`;
  }
  function expFinished(e, full) {
    const t = E.today(), R = XP.evaluate(S, e, t), st = XP.status(e, t);
    const period = E.fmtShort(e.start) + ' bis ' + E.fmtShort(XP.lastDay(e)) + (st === 'abgebrochen' ? ', abgebrochen' : '');
    const fazit = `<div class="hrow exp-fazit"><span class="hlbl">Dein Fazit</span><div class="schips" role="group" aria-label="Dein Fazit">${[['besser', 'Hat geholfen'], ['gleich', 'Kein Unterschied'], ['schlechter', 'Eher schlechter']].map(([v, l]) => `<button class="chip" data-a="exp.verdict" data-id="${e.id}" data-v="${v}" aria-pressed="${e.verdict === v}">${l}</button>`).join('')}</div></div>`;
    const acts = `<div class="row wrap" style="gap:8px;margin-top:10px">${expActive() ? '' : `<button class="btn sm quiet" data-a="exp.again" data-id="${e.id}">${ic('refresh')}Noch einmal</button>`}<span class="grow"></span><button class="btn sm ghost" data-a="exp.del" data-id="${e.id}">${ic('trash')}Löschen</button></div>`;
    const intro = `${e.expect ? `<p class="small ink2 exp-expect">Deine Erwartung: ${esc(e.expect)}</p>` : ''}<p class="small ink2">Eingehalten an ${R.yes} von ${pl2(R.days, 'Tag', 'Tagen')}${R.no ? ', nicht eingehalten an ' + R.no : ''}.</p>`;
    if (full) return `<div class="panel exp-card exp-done"><div class="sec-head"><h2 class="sec-title">${esc(e.rule)}</h2><span class="tag">${esc(period)}</span></div>${intro}<div class="exp-done-body">${expBody(e, R, true)}</div>${fazit}${acts}</div>`;
    const line = XP.verdictLine(R);
    return `<details class="panel exp-old"><summary><span class="check-name">${esc(e.rule)}</span> <span class="small muted">${esc(period)}${e.verdict ? ', ' + FAZIT[e.verdict] : ''}</span></summary>${intro}${R.ready ? (line ? `<p class="small ink2 exp-line">${esc(line)}</p>` : '') + expRows(e, R) : '<p class="small ink2">Zu wenige Tage mit Regel für einen Vergleich.</p>'}${fazit}${acts}</details>`;
  }

  // ---------- New experiment ----------
  function expDraft(T, e) {
    if (e) return { tpl: e.free ? 'eigen' : e.tpl, rule: e.rule, when: e.when, measures: e.measures.slice(), expect: e.expect || '', days: e.days, start: 'heute' };
    return { tpl: T.id, rule: T.rule(expP()), when: T.when, measures: T.m.slice(), expect: T.expect, days: 14, start: T.when === 'tag' && new Date().getHours() >= 11 ? 'morgen' : 'heute' };
  }
  function expSync() {
    const f = $('#exp-form'), D = ui.expDraft;
    if (!f || !D) return;
    D.rule = f.querySelector('[name="rule"]').value; D.expect = f.querySelector('[name="expect"]').value;
  }
  function expDialog(focus) {
    const D = ui.expDraft, P = expP(), t = E.today();
    // Values from the check-in, plus the most frequent complaints of the last three months
    const top = H.trend(S, E.addDays(t, -89), t).top.filter(c => !/^(bm|c):/.test(c.key)).slice(0, 4).map(c => 'sym:' + c.key);
    const keys = [...XP.BASE, ...top, ...D.measures].filter((k, i, a) => a.indexOf(k) === i && XP.measure(k));
    openDialog(`${dlgHead('Neues Experiment')}<form class="form-grid" id="exp-form" onsubmit="return false">
      <div class="field full"><span>Vorlage</span><div class="schips" role="group" aria-label="Vorlage">${XP.TPL.map(T => `<button class="chip" data-a="exp.tpl" data-k="${T.id}" aria-pressed="${D.tpl === T.id}">${esc(T.id === 'eigen' ? 'Eigene Regel' : T.rule(P))}</button>`).join('')}</div></div>
      <label class="field full"><span>Regel</span><input name="rule" value="${esc(D.rule)}" placeholder="z. B. Kein Handy im Bett"${focus ? ' autofocus' : ''}></label>
      <div class="field full"><span>Wann gilt die Regel?</span>${seg('Wann gilt die Regel?', [['tag', 'Tagsüber'], ['abend', 'Abends']], D.when, { a: 'exp.when' })}<span class="hint">${D.when === 'abend' ? 'Verglichen werden der Morgen und der Tag danach.' : 'Verglichen wird derselbe Tag; Schlaf zählt für die Nacht danach.'}</span></div>
      <div class="field full"><span>Was soll sich zeigen?</span><div class="schips" role="group" aria-label="Was soll sich zeigen?">${keys.map(k => `<button class="chip" data-a="exp.m" data-k="${esc(k)}" aria-pressed="${D.measures.includes(k)}">${esc(XP.measure(k).l)}</button>`).join('')}</div><span class="hint">Werte aus deinem Check-in, bis zu fünf.</span></div>
      <label class="field full"><span>Deine Erwartung, optional</span><input name="expect" value="${esc(D.expect)}" placeholder="z. B. Ich schlafe besser"></label>
      <div class="field full"><span>Dauer</span>${seg('Dauer', XP.DAYS.map(n => [String(n), n + ' Tage']), String(D.days), { a: 'exp.days' })}</div>
      <div class="field full"><span>Start</span>${seg('Start', [['heute', 'Heute'], ['morgen', 'Morgen']], D.start, { a: 'exp.start' })}</div></form>
      <p class="small muted" style="margin-top:12px">Danach vergleicht die App die Tage mit Regel mit den ${D.days} Tagen davor. Abhaken kannst du jeden Tag beim Check-in.</p>
      <div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="exp.save">Starten</button></div>`);
  }
  // Calendar file name from the rule
  const expSlug = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'regel';

  // ---------- Report for the doctor ----------
  function expReport(D) {
    if (!['alle', 'allg', 'neuro'].includes(D.fach)) return '';
    const t = E.today(), L = exps().filter(e => XP.status(e, t) !== 'geplant' && XP.lastDay(e) >= D.from).sort((a, b) => (a.start < b.start ? -1 : 1));
    if (!L.length) return '';
    const day = d => E.fmtShort(d) + d.slice(0, 4);
    return '<ul>' + L.map(e => {
      const R = XP.evaluate(S, e, t), st = XP.status(e, t);
      const res = R.res.filter(r => r.verdict !== 'wenig').map(r => r.m.l + ' ' + XP.fmt(r.m, r.g.kept) + ' mit Regel, ' + XP.fmt(r.m, r.g[r.ref]) + (r.ref === 'not' ? ' ohne' : ' davor')).join('; ');
      return `<li><b>${esc(e.rule)}</b>, ${day(e.start)} bis ${day(st === 'laeuft' ? t : XP.lastDay(e))}${st === 'laeuft' ? ' (läuft noch)' : st === 'abgebrochen' ? ' (abgebrochen)' : ''}: eingehalten an ${R.yes} von ${R.days} Tagen.${res ? ' ' + esc(res) + '.' : ''}</li>`;
    }).join('') + '</ul><p>Selbstexperimente sind Hinweise, keine Studien.</p>';
  }

  Object.assign(A, {
    'exp.set': el => { const e = expById(el.dataset.id); if (!e) return; const d = el.dataset.d, v = el.dataset.v === '1'; e.log = e.log || {}; if (e.log[d] === v) delete e.log[d]; else e.log[d] = v; save(); render(); },
    'exp.day': el => {
      const e = expById(el.dataset.id), d = el.dataset.d;
      if (!e) return;
      const k = XP.kept(S, e, d), a = XP.auto(S, e, d), cur = e.log && e.log[d];
      openDialog(`${dlgHead(E.fmtLong(d))}<p class="how-text">${esc(e.rule)}, Tag ${XP.dayNo(e, d)} von ${e.days}</p><p class="exp-q" style="margin:12px 0 6px">${esc(XP.ask(e, xDay(d)))}</p>
        <p class="small muted">${k ? (k.auto ? esc(k.why) + '.' : 'Eingetragen: ' + (k.v ? 'ja' : 'nein') + '.') : 'Noch offen.'}${a && cur != null ? ' Erkannt hätte die App: ' + (a.v ? 'ja' : 'nein') + ' (' + esc(a.why) + ').' : ''}</p>
        <div class="sheet-foot"><button class="btn quiet left" data-a="exp.mark" data-id="${e.id}" data-d="${d}" data-v="">${a ? 'Wie erkannt' : 'Offen lassen'}</button><button class="btn quiet" data-a="exp.mark" data-id="${e.id}" data-d="${d}" data-v="0">Nein</button><button class="btn" data-a="exp.mark" data-id="${e.id}" data-d="${d}" data-v="1">Ja</button></div>`);
    },
    'exp.mark': el => { const e = expById(el.dataset.id); if (!e) return; const d = el.dataset.d, v = el.dataset.v; e.log = e.log || {}; if (v === '') delete e.log[d]; else e.log[d] = v === '1'; save(); closeDialog(); render(); },
    'exp.new': el => {
      if (expActive()) { location.hash = '#/gesundheit/experimente'; toast('Es läuft schon ein Experiment. Eins nach dem anderen, damit sich die Wirkungen nicht vermischen.'); return; }
      ui.expDraft = expDraft(XP.tplById(el.dataset.k || 'eigen')); expDialog(ui.expDraft.tpl === 'eigen');
    },
    'exp.again': el => { const e = expById(el.dataset.id); if (!e || expActive()) return; ui.expDraft = expDraft(null, e); expDialog(false); },
    'exp.tpl': el => { expSync(); const T = XP.tplById(el.dataset.k), keep = ui.expDraft || {}; ui.expDraft = Object.assign(expDraft(T), { days: keep.days || 14 }); expDialog(T.id === 'eigen'); },
    'exp.when': el => { expSync(); ui.expDraft.when = el.dataset.v; expDialog(false); },
    'exp.days': el => { expSync(); ui.expDraft.days = +el.dataset.v; expDialog(false); },
    'exp.start': el => { expSync(); ui.expDraft.start = el.dataset.v; expDialog(false); },
    'exp.m': el => {
      expSync();
      const D = ui.expDraft, k = el.dataset.k;
      if (D.measures.includes(k)) { if (D.measures.length === 1) { toast('Wähl mindestens einen Wert.'); return; } D.measures = D.measures.filter(x => x !== k); }
      else { if (D.measures.length >= 5) { toast('Höchstens fünf Werte, dann bleibt der Vergleich übersichtlich.'); return; } D.measures.push(k); }
      expDialog(false);
    },
    'exp.save': () => {
      expSync();
      const D = ui.expDraft;
      if (!D) return;
      if (!String(D.rule || '').trim()) { toast('Bitte die Regel eintragen.'); return; }
      if (expActive()) { toast('Es läuft schon ein Experiment.'); return; }
      const e = XP.create(D, expP(), E.today(), uid('x'));
      exps().push(e); ui.expDraft = null; save(); closeDialog();
      if (location.hash !== '#/gesundheit/experimente') location.hash = '#/gesundheit/experimente'; else render();
      toast(e.start === E.today() ? 'Experiment gestartet. Abhaken kannst du jeden Tag beim Check-in.' : 'Experiment startet morgen.');
    },
    'exp.stop': el => {
      const e = expById(el.dataset.id);
      if (!e) return;
      confirmDlg('Experiment beenden?', 'Die bisherigen Tage bleiben gespeichert, und die App wertet sie aus. Danach kannst du ein neues Experiment starten.', 'Experiment beenden', () => {
        const t = E.today(), answered = e.log && e.log[t] != null;
        if (e.start > t || (e.start === t && !answered)) { S.health.exps = exps().filter(x => x !== e); save(); render(); toast('Experiment verworfen'); return; }
        e.stopped = answered ? t : E.addDays(t, -1);
        save(); render(); toast('Experiment beendet');
      }, true);
    },
    'exp.del': el => confirmDlg('Experiment löschen?', 'Das Experiment und deine Häkchen dazu werden entfernt. Deine Check-ins bleiben.', 'Löschen', () => { S.health.exps = exps().filter(x => x.id !== el.dataset.id); save(); render(); }, true),
    'exp.verdict': el => { const e = expById(el.dataset.id); if (!e) return; e.verdict = e.verdict === el.dataset.v ? null : el.dataset.v; save(); render(); },
    'exp.ics': el => {
      const e = expById(el.dataset.id);
      if (!e) return;
      const t = E.today(), from = e.start > t ? e.start : t, n = E.diffDays(from, e.end) + 1;
      if (n < 1) { toast('Das Experiment ist schon vorbei.'); return; }
      const r = XP.remind(e, expP());
      download('experiment-' + expSlug(e.rule) + '.ics', H.ics([{ uid: 'exp-' + e.id, date: from, time: r.time, minutes: 5, title: r.title, desc: 'Regel: ' + e.rule + '. Abhaken in Chris OS beim Check-in oder unter Gesundheit, Experimente.', rrule: 'FREQ=DAILY;COUNT=' + n, alarms: ['PT0M'] }]), 'text/calendar');
      toast('Kalender-Datei gespeichert: täglich um ' + r.time + ' Uhr, ' + pl2(n, 'Tag', 'Tage') + ' lang.');
    }
  });
  // ---------- end Selbstexperimente ----------
