  // ---------- Wochenrückblick (2.8) – inserted into app.js at build time ----------
  // On Heute from Monday to Wednesday unless closed: last week against the week before, one sentence per area.
  function weekData(ws) {
    const days = Array.from({ length: 7 }, (_, i) => E.addDays(ws, i)), we = days[6];
    const D = S.health.days || {};
    const on = x => Object.keys((x && x.sym) || {}).filter(k => x.sym[k]);
    const logged = days.filter(d => H.hasData(D[d]));
    const sleep = logged.map(d => D[d].sleepH).filter(v => v != null);
    const cnt = {};
    logged.forEach(d => on(D[d]).forEach(k => { cnt[k] = (cnt[k] || 0) + 1; }));
    const top = Object.entries(cnt).sort((a, b) => b[1] - a[1] || (H.symLabel(a[0]) < H.symLabel(b[0]) ? -1 : 1))[0];
    const pg = S.settings.proteinGoal || 0, prot = days.map(d => protTotal(d)).filter(g => g > 0);
    return {
      ws, we, logged: logged.length,
      sleep: sleep.length ? sleep.reduce((s, v) => s + v, 0) / sleep.length : null, sleepN: sleep.length,
      symDays: logged.filter(d => on(D[d]).length).length, infDays: logged.filter(d => H.infScore(D[d]) > 0).length,
      top: top ? { key: top[0], label: H.symLabel(top[0]), n: top[1] } : null,
      wc: E.weekCounts(S, ws),
      pDays: prot.length, pHit: pg ? prot.filter(g => g >= pg).length : 0,
      pAvg: prot.length ? Math.round(prot.reduce((s, g) => s + g, 0) / prot.length) : null,
      worn: new Set(S.wardrobe.wear.filter(w => w.date >= ws && w.date <= we).map(w => w.date)).size
    };
  }
  const hasWeek = w => !!(w.logged || w.wc.gym || w.wc.run || w.wc.routine || w.pDays || w.worn);
  const durText = h => { const m = Math.round(h * 60 / 5) * 5; return m >= 60 ? n0(h) + ' Stunden' : m + ' Minuten'; };
  function reviewLines(A, B) {
    const goal = (S.health.profile || {}).sleepGoal || 7.5, g = S.settings.goals, pg = S.settings.proteinGoal || 0;
    const L = [];
    let t;
    // Sleep
    if (A.sleepN) {
      t = 'Im Schnitt ' + n0(A.sleep) + ' h' + (A.sleepN < 7 ? ' in ' + pl2(A.sleepN, 'Nacht', 'Nächten') : '');
      if (B.sleep != null) { const dl = A.sleep - B.sleep; t += Math.abs(dl) < 0.25 ? ', etwa wie in der Vorwoche' : ', ' + durText(Math.abs(dl)) + (dl > 0 ? ' mehr' : ' weniger') + ' als in der Vorwoche'; }
      t += A.sleep >= goal ? '; dein Ziel von ' + n0(goal) + ' h erreicht.' : A.sleep < goal - 0.25 ? '; dein Ziel sind ' + n0(goal) + ' h.' : '.';
    } else t = 'Keine Angaben in dieser Woche.';
    L.push({ k: 'Schlaf', t });
    // Complaints
    if (A.logged) {
      const prev = B.logged ? ', in der Vorwoche an ' + B.symDays + ' von ' + B.logged : '';
      t = A.symDays ? 'An ' + A.symDays + ' von ' + pl2(A.logged, 'eingetragenen Tag', 'eingetragenen Tagen') + prev + (A.top ? '; am häufigsten ' + A.top.label + (A.top.n > 1 ? ' (' + pl2(A.top.n, 'Tag', 'Tage') + ')' : '') : '') + '.'
        : 'Keine an ' + pl2(A.logged, 'eingetragenen Tag', 'eingetragenen Tagen') + prev + '.';
      if (A.infDays) t += ' Infekt-Anzeichen an ' + pl2(A.infDays, 'Tag', 'Tagen') + '.';
    } else t = 'Kein Check-in in dieser Woche.';
    L.push({ k: 'Beschwerden', t });
    // Training against the weekly goals
    const part = (w, goals) => [['Kraft', w.wc.gym, g.gym], ['Laufen', w.wc.run, g.run], ['Dehnen', w.wc.routine, g.routine]].filter(x => x[2] || x[1]).map(x => x[0] + ' ' + x[1] + (goals && x[2] ? ' von ' + x[2] : '')).join(', ');
    const any = w => w.wc.gym + w.wc.run + w.wc.routine;
    t = any(A) || any(B) ? part(A, true) + (any(B) ? '; in der Vorwoche ' + part(B, false) : '') + '.' : 'Kein Training eingetragen.';
    L.push({ k: 'Training', t });
    // Protein
    if (A.pDays) {
      t = (pg ? 'Ziel von ' + pg + ' g an ' + A.pHit + ' von ' + pl2(A.pDays, 'Tag', 'Tagen') + ' mit Einträgen erreicht, im Schnitt ' + A.pAvg + ' g' : 'Im Schnitt ' + A.pAvg + ' g an ' + pl2(A.pDays, 'Tag', 'Tagen') + ' mit Einträgen') + (B.pAvg != null ? '; in der Vorwoche ' + B.pAvg + ' g' : '') + '.';
    } else t = 'Nichts eingetragen.' + (B.pAvg != null ? ' In der Vorwoche im Schnitt ' + B.pAvg + ' g.' : '');
    L.push({ k: 'Eiweiß', t });
    // Outfit days
    t = (A.worn ? 'An ' + pl2(A.worn, 'Tag', 'Tagen') + ' ein Outfit als getragen markiert' : 'Kein Outfit als getragen markiert') + (B.worn ? ', in der Vorwoche an ' + pl2(B.worn, 'Tag', 'Tagen') : '') + '.';
    L.push({ k: 'Outfit', t });
    return L;
  }
  // One hint from the Verläufe for the most frequent complaint of the week, never as a cause
  function reviewHint(A) {
    if (!A.top) return '';
    const t = E.today(), f = H.symDetail(S, A.top.key, E.addDays(t, -89), t).factors[0];
    return f ? 'Aus deinen Verläufen: Tage mit ' + A.top.label + ' hatten oft auch „' + f.label + '“ (an ' + f.pn + ' von ' + f.pk + '). Ein Hinweis, kein Beweis.' : '';
  }
  function reviewToday(d) {
    const wd = E.weekday(d);
    if (wd < 1 || wd > 3) return '';
    const ws = E.addDays(E.weekStart(d), -7);
    if (S.meta.dismissed['review:' + ws]) return '';
    const A = weekData(ws);
    if (!hasWeek(A)) return '';
    const B = weekData(E.addDays(ws, -7)), g = S.settings.goals, pg = S.settings.proteinGoal || 0;
    const sum = [A.sleepN ? 'Schlaf ' + n0(A.sleep) + ' h' : '', A.logged ? (A.symDays ? 'Beschwerden an ' + pl2(A.symDays, 'Tag', 'Tagen') : 'keine Beschwerden') : '',
      'Kraft ' + A.wc.gym + ' von ' + g.gym, A.pDays && pg ? 'Eiweiß-Ziel an ' + pl2(A.pHit, 'Tag', 'Tagen') : '', A.worn ? 'Outfit an ' + pl2(A.worn, 'Tag', 'Tagen') : ''].filter(Boolean).join(', ');
    const meta = `<span class="fold-badge" title="${esc(E.fmtShort(ws) + ' bis ' + E.fmtShort(A.we))}">KW ${E.isoWeek(ws)}</span>`;
    return `<section class="review" aria-label="Wochenrückblick">${fold('review', 'Wochenrückblick', esc(capF(sum)), meta, () => {
      const hint = reviewHint(A);
      return `<p class="small muted" style="margin:0 0 10px">${esc(E.fmtShort(ws) + ' bis ' + E.fmtShort(A.we))}, verglichen mit der Woche davor</p>
        <ul class="rv-list">${reviewLines(A, B).map(l => `<li><span class="rv-k">${esc(l.k)}</span><span class="rv-t">${esc(l.t)}</span></li>`).join('')}</ul>
        ${hint ? `<p class="small ink2 rv-hint">${ic('info')}<span>${esc(hint)}</span></p>` : ''}
        <div class="row wrap" style="margin-top:12px;gap:8px"><a class="btn sm quiet" href="#/gesundheit/verlauf">Verläufe ansehen</a><span class="grow"></span><button class="btn sm ghost" data-a="dismiss" data-k="review:${ws}">Ausblenden</button></div>
        <p class="small muted" style="margin-top:8px">Der Rückblick kommt jeden Montag und bleibt bis Mittwoch, außer du blendest ihn aus.</p>`;
    })}</section>`;
  }
  // ---------- end Wochenrückblick ----------
