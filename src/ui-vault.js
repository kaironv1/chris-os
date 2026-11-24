  // ---------- Vault (2.12): an encrypted room, reached by a hidden gesture ----------
  // Shares the scope of app.js. Content lives only in memory while the room is open (vsess, vc); on the device and
  // in the backup there is only the ciphertext in S.vault. No menu entry, no route: seven quick taps on the version
  // line in the settings open the gate. The room closes on any navigation, after a minute in the background and
  // on "Schließen".
  const VT = window.Vault;
  const VKEY = 'chrisos.vk';  // this device's passkey for the room: { id, vault }
  let vsess = null, vc = null, vHiddenAt = 0, vHideTimer = null, vSaving = Promise.resolve();
  const rtTimers = [];
  ui.vault = { on: false, route: '', tab: 'start', sel: null, edit: null, q: '', msg: '', busy: false, reset: null, prep: null, draft: '', draftCtx: '', day: 0, replace: false, hint: '' };
  ui.about = { n: 0, t: 0 };
  const vOpen = () => !!(ui.vault.on && vsess && vc);
  const vdev = () => { try { return JSON.parse(localStorage.getItem(VKEY) || 'null'); } catch (e) { return null; } };
  const vdevSet = v => { try { if (v) localStorage.setItem(VKEY, JSON.stringify(v)); else localStorage.removeItem(VKEY); } catch (e) { /* voll oder gesperrt */ } };
  const vNames = () => (vc ? vc.names : { me: '', partner: '', child: '' });
  const partner = () => vNames().partner || 'deine Partnerin';
  const vfmt = d => (d ? E.fmtShort(d) + (d.length > 7 ? d.slice(0, 4) : '') : 'ohne Datum');
  const lines = t => esc(t || '').replace(/\n/g, '<br>');

  function vaultEnter() {
    ui.vault = Object.assign(ui.vault, { on: true, route: route().top + '/' + route().sub, tab: 'start', sel: null, edit: null, q: '', msg: '', busy: false, reset: null, prep: null, draft: '', draftCtx: '', day: 0, hint: '' });
    render();
  }
  function vaultLock(rerender) {
    // A preparation saves itself on leaving (back, status, tab): closing the room counts as leaving too (2.15)
    if (vOpen()) vtPrepKeep();
    rtTimers.splice(0).forEach(clearTimeout);
    clearTimeout(vHideTimer); vHideTimer = null;
    vsess = null; vc = null;
    ui.vault.on = false; ui.vault.setup = null; ui.vault.reset = null; ui.vault.draft = ''; ui.vault.msg = '';
    if (rerender) render();
  }
  // Hooks from app.js
  function vaultOnHidden() { if (!ui.vault.on) return; vHiddenAt = Date.now(); clearTimeout(vHideTimer); vHideTimer = setTimeout(() => vaultLock(true), 60000); }
  function vaultOnVisible() { if (!ui.vault.on) return; if (vHiddenAt && Date.now() - vHiddenAt > 60000) vaultLock(false); clearTimeout(vHideTimer); vHideTimer = null; vHiddenAt = 0; }
  // Called by render(): true when the room took over the view
  function vaultRender(rk) {
    if (!ui.vault.on) return false;
    if (rk !== ui.vault.route) { vaultLock(false); return false; }
    vtKeep();
    $('#view').innerHTML = vaultView();
    const f = $('#view [data-vfocus]'); if (f) { f.focus({ preventScroll: true }); }
    return true;
  }
  function vaultSave() {
    if (!vOpen()) return;
    const hdr = S.vault, sess = vsess, c = vc;
    vSaving = vSaving.then(() => VT.write(hdr, sess, c)).then(() => { if (S.vault === hdr) save(); }).catch(() => { ui.vault.msg = 'Speichern hat nicht geklappt.'; });
  }
  function vaultMsg(m) { ui.vault.msg = m; render(); }

  // ---------- Passkey with PRF ----------
  const vcreds = () => navigator.credentials;
  async function prfGet(id) {
    const a = await vcreds().get({ publicKey: { challenge: VT.rand(32), allowCredentials: [{ type: 'public-key', id: VT.unb64u(id), transports: ['internal', 'hybrid'] }], userVerification: 'required', timeout: 60000, extensions: { prf: { eval: { first: VT.unb64u(S.vault.prfEval) } } } } });
    const ext = a && a.getClientExtensionResults ? a.getClientExtensionResults() : {};
    if (!ext.prf || !ext.prf.results || !ext.prf.results.first) throw new Error('noprf');
    return new Uint8Array(ext.prf.results.first);
  }
  async function prfRegister() {
    const cred = await vcreds().create({ publicKey: {
      challenge: VT.rand(32), rp: { name: 'Chris OS' }, user: { id: VT.rand(16), name: 'raum', displayName: 'Raum' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000, attestation: 'none', extensions: { prf: { eval: { first: VT.unb64u(S.vault.prfEval) } } }
    } });
    const ext = cred.getClientExtensionResults ? cred.getClientExtensionResults() : {};
    if (!ext.prf || (!ext.prf.enabled && !(ext.prf.results && ext.prf.results.first))) throw new Error('noprf');
    const id = VT.b64u(cred.rawId);
    const bytes = ext.prf.results && ext.prf.results.first ? new Uint8Array(ext.prf.results.first) : await prfGet(id);
    return { id, bytes };
  }
  const prfReady = () => { const d = vdev(); return !!(window.isSecureContext && window.PublicKeyCredential && S.vault && d && d.vault === S.vault.id && S.vault.prf && S.vault.prf[d.id]); };
  async function vaultWithPrf() {
    const d = vdev();
    ui.vault.busy = true; render();
    try {
      const bytes = await prfGet(d.id);
      const sess = await VT.openPrf(S.vault, d.id, bytes);
      if (!sess) throw new Error('key');
      await vaultOpened(sess);
    } catch (e) { ui.vault.busy = false; vaultMsg(e && e.message === 'key' ? 'Der Fingerabdruck passt nicht mehr zu diesem Raum. Nimm die Passphrase und richte ihn danach neu ein.' : 'Das hat nicht geklappt. Du kannst die Passphrase nehmen.'); }
  }
  async function vaultOpened(sess) {
    await vSaving;
    vsess = sess; vc = await VT.read(S.vault, sess);
    ui.vault.busy = false; ui.vault.msg = ''; ui.vault.tab = 'start';
    ui.vault.hint = !prfReady() && window.isSecureContext && window.PublicKeyCredential ? 'prf' : '';
    if (ciSync()) vaultSave();
    render();
  }
  // Values taken over from the normal check-in follow its later corrections; those happen while the room is closed
  function ciSync() {
    let n = 0;
    for (const [d, c] of Object.entries(vc.checkins || {})) {
      const h = (S.health && S.health.days && S.health.days[d]) || null, src = (c && c.src) || {};
      if (h) CI_FROM.forEach(([k, hk]) => { if (src[k] === 'hc' && h[hk] != null && h[hk] !== c[k]) { c[k] = h[hk]; n++; } });
    }
    return n > 0;
  }

  // ---------- Views ----------
  function vaultView() {
    if (!vOpen()) return vaultGate();
    const T = [['start', 'Start'], ['chronik', 'Chronik'], ['muster', 'Muster'], ['vorbereitung', 'Gespräch'], ['tuer', 'Türschwelle'], ['checkin', 'Check-in'], ['mehr', 'Mehr']];
    const body = { start: vtStart, chronik: vtChronik, muster: vtMuster, vorbereitung: vtPrep, tuer: vtDoor, checkin: vtCheckin, mehr: vtMore }[ui.vault.tab]();
    return `<div class="vt">
      <header class="page-head" style="margin-bottom:14px"><div><h1 class="page-title">Resonanzraum</h1><p class="page-sub">Nur hier, nur jetzt. Schließt von selbst nach einer Minute im Hintergrund.</p></div><button class="btn sm" data-a="vt.lock">${ic('lock')}Schließen</button></header>
      ${ui.vault.msg ? `<div class="note" style="margin-bottom:12px">${ic('info')}<p class="grow" style="margin:0">${esc(ui.vault.msg)}</p><button class="btn sm ghost" data-a="vt.msg">Ok</button></div>` : ''}
      ${ui.vault.hint === 'prf' ? `<div class="note info" style="margin-bottom:12px">${ic('info')}<p class="grow" style="margin:0">Auf diesem Gerät öffnest du den Raum bisher nur mit der Passphrase. Unter „Mehr“ kannst du den Fingerabdruck dafür einrichten.</p><button class="btn sm ghost" data-a="vt.hint">Später</button></div>` : ''}
      <nav class="tabs vt-tabs" aria-label="Bereiche">${T.map(([k, l]) => `<a href="#" data-a="vt.tab" data-k="${k}" aria-current="${ui.vault.tab === k ? 'page' : 'false'}">${l}</a>`).join('')}</nav>
      ${body}
      ${ui.vault.reset ? vtRitual() : ''}
    </div>`;
  }
  function vaultGate() {
    const hdr = S.vault;
    if (!hdr) {
      const su = ui.vault.setup || { p1: '', p2: '', me: '', partner: '', child: '' };
      return `<div class="vt vt-gate"><div class="panel" style="max-width:560px">
        <h1 class="page-title" style="font-size:1.5rem">Einen verschlüsselten Raum einrichten</h1>
        <p class="how-text" style="margin-top:8px">Was du hier ablegst, liegt auf dem Gerät und im Backup nur verschlüsselt (AES-256). Den Schlüssel gibt es nur aus deiner Passphrase oder, je Gerät, aus deinem Fingerabdruck. Ohne beides sind die Daten weg, auch für mich. Es gibt keinen Menüpunkt und keine Adresse; der Weg hierher ist der, den du gerade gegangen bist.</p>
        ${ui.vault.msg ? `<p class="small" style="color:var(--cognac);margin-top:10px">${esc(ui.vault.msg)}</p>` : ''}
        <form class="form-grid" style="margin-top:16px" id="vt-setup" onsubmit="return false">
          <label class="field full"><span>Passphrase (mindestens ${VT.MIN_PASS} Zeichen, am besten mehrere Wörter)</span><input type="password" name="p1" autocomplete="new-password" value="${esc(su.p1)}" data-vfocus></label>
          <label class="field full"><span>Noch einmal</span><input type="password" name="p2" autocomplete="new-password" value="${esc(su.p2)}" data-enter="vt.setup"></label>
          <label class="field"><span>Dein Vorname (optional)</span><input name="me" value="${esc(su.me)}"></label>
          <label class="field"><span>Name deiner Partnerin (optional)</span><input name="partner" value="${esc(su.partner)}"></label>
          <label class="field full"><span>Name eures Kindes (optional)</span><input name="child" value="${esc(su.child)}"></label>
        </form>
        <p class="small muted" style="margin-top:10px">Schreib dir die Passphrase an einen sicheren Ort. Den Fingerabdruck richtest du gleich danach ein; er ist bequemer, die Passphrase bleibt dein Ersatzschlüssel für ein neues Gerät.</p>
        <div class="sheet-foot"><button class="btn quiet" data-a="vt.lock">Abbrechen</button><button class="btn" data-a="vt.setup"${ui.vault.busy ? ' disabled' : ''}>${ui.vault.busy ? 'Wird eingerichtet …' : 'Raum einrichten'}</button></div></div></div>`;
    }
    return `<div class="vt vt-gate"><div class="panel" style="max-width:480px">
      <h1 class="page-title" style="font-size:1.5rem">Resonanzraum</h1>
      <p class="how-text" style="margin-top:8px">Verschlüsselt. ${prfReady() ? 'Öffne mit deinem Fingerabdruck oder mit der Passphrase.' : 'Öffne mit deiner Passphrase.'}</p>
      ${ui.vault.msg ? `<p class="small" style="color:var(--cognac);margin-top:10px">${esc(ui.vault.msg)}</p>` : ''}
      ${prfReady() ? `<button class="btn" style="margin-top:14px;width:100%" data-a="vt.prf"${ui.vault.busy ? ' disabled' : ''}>${ic('lock')}${ui.vault.busy ? 'Einen Moment …' : 'Mit Fingerabdruck öffnen'}</button>` : ''}
      <form class="form-grid" style="margin-top:14px" id="vt-unlock" onsubmit="return false"><label class="field full"><span>Passphrase</span><input type="password" name="p" autocomplete="current-password" data-enter="vt.unlock"${prfReady() ? '' : ' data-vfocus'}></label></form>
      <div class="sheet-foot"><button class="btn quiet" data-a="vt.lock">Abbrechen</button><button class="btn${prfReady() ? ' quiet' : ''}" data-a="vt.unlock"${ui.vault.busy ? ' disabled' : ''}>Öffnen</button></div></div></div>`;
  }
  function vtStart() {
    const d = E.today(), st = VT.stats(vc), ci = vc.checkins[d], E0 = VT.sortedEntries(vc), last = E0[E0.length - 1];
    const lastReset = vc.resets.slice().sort((a, b) => (a.at < b.at ? 1 : -1))[0];
    return `<div class="panel vt-lead"><p class="vt-leitsatz">„${esc(VT.leitsatz(d))}“</p><p class="small muted" style="margin:6px 0 0">Leitsatz des Tages</p></div>
      <div class="today-grid" style="margin-top:14px">
        <div class="panel"><h2 class="sec-title">Heute</h2><ul class="kv-list" style="margin-top:8px">
          <li><span>Check-in</span><strong>${ci ? 'eingetragen' : 'offen'}</strong> <button class="btn sm quiet" data-a="vt.tab" data-k="checkin">${ci ? 'Ansehen' : 'Jetzt'}</button></li>
          <li><span>Türschwelle</span><strong>${lastReset ? 'zuletzt ' + E.fmtShort(lastReset.at.slice(0, 10)) : 'noch nie'}</strong> <button class="btn sm quiet" data-a="vt.tab" data-k="tuer">Reset starten</button></li>
          <li><span>Gespräch</span><strong>${vc.preps.filter(p => p.status !== 'nachbereitet').length} in Vorbereitung</strong> <button class="btn sm quiet" data-a="vt.tab" data-k="vorbereitung">Öffnen</button></li></ul></div>
        <div class="panel"><h2 class="sec-title">Chronik</h2><p class="small ink2" style="margin:8px 0 0">${st.entries} Einträge, ${st.patterns} Muster, ${st.checkins} Check-ins, ${st.resets} Resets.</p>
          ${last ? `<p style="margin:10px 0 0"><span class="tag">${esc(VT.kindLabel(last.kind))}</span> <button class="linkish" data-a="vt.entry" data-id="${last.id}">${esc(last.title)}</button><br><span class="small muted">${vfmt(last.date)}</span></p>` : '<p class="small muted" style="margin:8px 0 0">Noch leer. Unter „Mehr“ kannst du den Export aus Resonanzraum einlesen.</p>'}
          <div class="row wrap" style="margin-top:10px;gap:8px"><button class="btn sm" data-a="vt.entry.new">${ic('plus')}Eintrag</button><button class="btn sm quiet" data-a="vt.tab" data-k="chronik">Alles ansehen</button></div></div>
      </div>`;
  }
  // ----- Chronik -----
  const patternChips = (e, act) => `<div class="schips">${vc.patterns.slice().sort((a, b) => a.order - b.order).map(p => { const on = (e.patterns || []).some(x => x.id === p.id); return `<button class="chip" data-a="${act}" data-id="${e.id}" data-k="${p.id}" aria-pressed="${on}">${esc(p.name)}</button>`; }).join('')}</div>`;
  function vtChronik() {
    if (ui.vault.edit && ui.vault.edit.type === 'entry') return vtEntryForm(ui.vault.edit);
    if (ui.vault.sel && ui.vault.sel.type === 'entry') { const e = vc.entries.find(x => x.id === ui.vault.sel.id); if (e) return vtEntry(e); }
    const q = ui.vault.q.trim().toLowerCase();
    const L = VT.sortedEntries(vc).reverse().filter(e => !q || [e.title, e.narrative, e.insight, e.trigger, e.dynamics].join(' ').toLowerCase().includes(q));
    return `<div class="row wrap" style="gap:8px;margin-bottom:12px"><input class="search grow" placeholder="Suchen" value="${esc(ui.vault.q)}" data-i="vt.q" aria-label="Chronik durchsuchen"><button class="btn sm" data-a="vt.entry.new">${ic('plus')}Eintrag</button></div>
      <details class="vt-sections" ${vc.sections.length ? '' : 'open'}><summary>Ausgangslage (${vc.sections.length})</summary>
        ${vc.sections.slice().sort((a, b) => a.order - b.order).map(s => `<div class="panel" style="margin-top:10px"><label class="field"><span>${esc(s.title)}</span><textarea data-c="vt.section" data-id="${s.id}" rows="5">${esc(s.content)}</textarea></label></div>`).join('')}
        <div class="row" style="gap:8px;margin-top:10px"><input class="search grow" placeholder="Neuer Abschnitt, z. B. Grundzustand" id="vt-sec" data-enter="vt.section.new" aria-label="Neuer Abschnitt"><button class="btn sm quiet" data-a="vt.section.new">Anlegen</button></div></details>
      ${L.length ? `<ol class="vt-list">${L.map(e => `<li><button class="vt-row" data-a="vt.entry" data-id="${e.id}"><span class="tag">${esc(VT.kindLabel(e.kind))}</span><span class="grow"><strong>${esc(e.title)}</strong><br><span class="small muted">${vfmt(e.date)}${e.patterns && e.patterns.length ? ', ' + e.patterns.length + ' Muster' : ''}</span></span>${ic('chev')}</button></li>`).join('')}</ol>` : `<div class="empty" style="margin-top:14px">${q ? 'Nichts gefunden.' : 'Noch keine Einträge.'}</div>`}`;
  }
  function vtEntry(e) {
    const P = (e.patterns || []).map(l => ({ l, p: vc.patterns.find(p => p.id === l.id) })).filter(x => x.p);
    const block = (t, v) => (v ? `<div class="vt-block"><h3>${t}</h3><p>${lines(v)}</p></div>` : '');
    const list = (t, a) => (a && a.length ? `<div class="vt-block"><h3>${t}</h3><ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '');
    return `<div class="row wrap" style="gap:8px;margin-bottom:12px"><button class="btn sm quiet" data-a="vt.back">${ic('back')}Chronik</button><span class="grow"></span><button class="btn sm quiet" data-a="vt.entry.edit" data-id="${e.id}">${ic('edit')}Bearbeiten</button><button class="btn sm quiet" data-a="vt.prep.from" data-id="${e.id}">Gespräch vorbereiten</button></div>
      <article class="panel vt-entry"><p class="small muted" style="margin:0">${esc(VT.kindLabel(e.kind))}, ${vfmt(e.date)}</p><h2 class="sec-title" style="font-size:1.3rem;margin-top:4px">${esc(e.title)}</h2>
        ${block('Auslöser', e.trigger)}${block('Was passiert ist', e.narrative)}${block('Meine Erkenntnis', e.insight)}
        <h3 class="sec-title" style="margin-top:18px">Systemische Einordnung <span class="small muted">(Arbeitshypothese${e.source === 'seed' || e.analysis === 'fertig' ? '' : ', noch offen'})</span></h3>
        ${block('Dynamik', e.dynamics)}${list('Meine Bedürfnisse', e.needsSelf)}${list('Bedürfnisse von ' + esc(partner()), e.needsPartner)}${block('Mein Anteil', e.ownPart)}${block('Nächster kleiner Schritt', e.nextStep)}
        <div class="vt-block"><h3>Muster</h3>${P.length ? `<ul class="vt-pats">${P.map(x => `<li><button class="linkish" data-a="vt.pattern" data-id="${x.p.id}">${esc(x.p.name)}</button>${x.l.note ? `<span class="small ink2">: ${esc(x.l.note)}</span>` : ''}</li>`).join('')}</ul>` : '<p class="small muted">Noch keins verknüpft.</p>'}</div>
        <p class="small muted" style="margin-top:14px">Einordnungen sind Hinweise aus deiner Sicht, keine Diagnosen.</p></article>`;
  }
  function vtEntryForm(d) {
    const v = d.v;
    return `<form class="panel form-grid" id="vt-entry" onsubmit="return false"><h2 class="sec-title full">${d.id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}</h2>
      <div class="field full"><span>Art</span>${seg('Art', VT.KINDS.map(k => [k[0], k[1]]), v.kind, { a: 'vt.entry.kind' })}<span class="small muted">${esc((VT.KINDS.find(k => k[0] === v.kind) || [])[2] || '')}</span></div>
      <label class="field full"><span>Titel</span><input name="title" value="${esc(v.title)}" data-vfocus></label>
      <label class="field"><span>Datum</span><input type="date" name="date" value="${esc(v.date || '')}"></label>
      <label class="field full"><span>Auslöser</span><input name="trigger" value="${esc(v.trigger)}" placeholder="Womit hat es angefangen?"></label>
      <label class="field full"><span>Was ist passiert?</span><textarea name="narrative" rows="7" placeholder="In deinen Worten, chronologisch.">${esc(v.narrative)}</textarea></label>
      <label class="field full"><span>Meine Erkenntnis</span><textarea name="insight" rows="3">${esc(v.insight)}</textarea></label>
      <h3 class="sec-title full" style="margin-top:6px">Systemische Einordnung <span class="small muted">(optional, Arbeitshypothese)</span></h3>
      <label class="field full"><span>Dynamik</span><textarea name="dynamics" rows="4" placeholder="Was hat sich gegenseitig verstärkt?">${esc(v.dynamics)}</textarea></label>
      <label class="field"><span>Meine Bedürfnisse (je Zeile eins)</span><textarea name="needsSelf" rows="4">${esc((v.needsSelf || []).join('\n'))}</textarea></label>
      <label class="field"><span>Bedürfnisse von ${esc(partner())} (je Zeile eins)</span><textarea name="needsPartner" rows="4">${esc((v.needsPartner || []).join('\n'))}</textarea></label>
      <label class="field full"><span>Mein Anteil</span><textarea name="ownPart" rows="3">${esc(v.ownPart)}</textarea></label>
      <label class="field full"><span>Nächster kleiner Schritt</span><input name="nextStep" value="${esc(v.nextStep)}"></label>
      <div class="field full"><span>Muster</span>${vc.patterns.length ? patternChips(v, 'vt.entry.pat') : '<span class="small muted">Noch keine Muster angelegt.</span>'}</div>
      <div class="sheet-foot full"><button class="btn quiet" data-a="vt.back">Abbrechen</button>${d.id ? `<button class="btn ghost danger" data-a="vt.entry.del" data-id="${d.id}">Löschen</button>` : ''}<button class="btn" data-a="vt.entry.save">Speichern</button></div></form>`;
  }
  // What is being typed in an entry or a pattern survives any rebuild of the view (2.14). Before, a short switch to
  // another app re-rendered the room and emptied an entry that was being written. Since 2.15 also a preparation; it
  // is written into the preparation itself and saved, as when leaving it.
  function vtKeep() {
    vtPrepKeep();
    if ($('#vt-entry')) vtEntrySync();
    const pf = $('#vt-pattern'), ed = ui.vault.edit;
    if (pf && ed && ed.type === 'pattern') { const d = new FormData(pf); ['name', 'summary', 'description', 'guideline'].forEach(k => { ed.v[k] = String(d.get(k) || ''); }); }
  }
  function vtEntrySync() {
    const f = $('#vt-entry'); if (!f || !ui.vault.edit) return;
    const d = new FormData(f), v = ui.vault.edit.v, g = k => String(d.get(k) || '').trim();
    Object.assign(v, { title: g('title'), date: g('date') || null, trigger: g('trigger'), narrative: g('narrative'), insight: g('insight'), dynamics: g('dynamics'), ownPart: g('ownPart'), nextStep: g('nextStep'), needsSelf: g('needsSelf').split('\n').map(s => s.trim()).filter(Boolean), needsPartner: g('needsPartner').split('\n').map(s => s.trim()).filter(Boolean) });
  }
  // ----- Muster -----
  function vtMuster() {
    if (ui.vault.edit && ui.vault.edit.type === 'pattern') return vtPatternForm(ui.vault.edit);
    if (ui.vault.sel && ui.vault.sel.type === 'pattern') { const p = vc.patterns.find(x => x.id === ui.vault.sel.id); if (p) return vtPattern(p); }
    const M = VT.matrix(vc);
    const P = vc.patterns.slice().sort((a, b) => a.order - b.order);
    return `<div class="row wrap" style="gap:8px;margin-bottom:12px"><p class="how-text grow" style="margin:0">Wiederkehrende Dynamiken als Arbeitshypothesen. Die Matrix zeigt, wo welches Muster auftauchte.</p><button class="btn sm" data-a="vt.pattern.new">${ic('plus')}Muster</button></div>
      ${P.length ? `<ul class="vt-list">${P.map(p => `<li><button class="vt-row" data-a="vt.pattern" data-id="${p.id}"><span class="tag">${esc(VT.PATTERN_KINDS[p.kind] || p.kind)}</span><span class="grow"><strong>${esc(p.name)}</strong><br><span class="small ink2">${esc(p.summary)}</span></span><span class="num small muted">${M.rows.find(r => r.p.id === p.id).n}×</span></button></li>`).join('')}</ul>` : '<div class="empty">Noch keine Muster.</div>'}
      ${M.entries.length && P.length ? `<div class="panel" style="margin-top:16px;overflow-x:auto"><h2 class="sec-title">Matrix</h2><table class="vt-matrix"><thead><tr><th>Muster</th>${M.entries.map((e, i) => `<th title="${esc(e.title)}"><span class="num">${i + 1}</span></th>`).join('')}</tr></thead><tbody>${M.rows.map(r => `<tr><th>${esc(r.p.name)}</th>${r.cells.map((c, i) => `<td>${c ? `<button class="vt-dot" data-a="vt.entry" data-id="${M.entries[i].id}" title="${esc(c.note || M.entries[i].title)}" aria-label="${esc(r.p.name)} in Eintrag ${i + 1}"></button>` : ''}</td>`).join('')}</tr>`).join('')}</tbody></table><ol class="small ink2" style="margin:10px 0 0;padding-left:18px">${M.entries.map(e => `<li>${esc(e.title)}</li>`).join('')}</ol></div>` : ''}`;
  }
  function vtPattern(p) {
    const where = VT.sortedEntries(vc).filter(e => (e.patterns || []).some(x => x.id === p.id));
    return `<div class="row wrap" style="gap:8px;margin-bottom:12px"><button class="btn sm quiet" data-a="vt.back">${ic('back')}Muster</button><span class="grow"></span><button class="btn sm quiet" data-a="vt.pattern.edit" data-id="${p.id}">${ic('edit')}Bearbeiten</button></div>
      <article class="panel vt-entry"><p class="small muted" style="margin:0">${esc(VT.PATTERN_KINDS[p.kind] || p.kind)}</p><h2 class="sec-title" style="font-size:1.3rem;margin-top:4px">${esc(p.name)}</h2><p class="ink2">${esc(p.summary)}</p>
        <div class="vt-block"><h3>Beschreibung</h3><p>${lines(p.description)}</p></div>${p.guideline ? `<div class="vt-block"><h3>Leitlinie</h3><p>${lines(p.guideline)}</p></div>` : ''}
        <div class="vt-block"><h3>Aufgetaucht in</h3>${where.length ? `<ul class="vt-pats">${where.map(e => { const l = e.patterns.find(x => x.id === p.id); return `<li><button class="linkish" data-a="vt.entry" data-id="${e.id}">${esc(e.title)}</button>${l.note ? `<span class="small ink2">: ${esc(l.note)}</span>` : ''}</li>`; }).join('')}</ul>` : '<p class="small muted">Noch nirgends verknüpft.</p>'}</div></article>`;
  }
  function vtPatternForm(d) {
    const v = d.v;
    return `<form class="panel form-grid" id="vt-pattern" onsubmit="return false"><h2 class="sec-title full">${d.id ? 'Muster bearbeiten' : 'Neues Muster'}</h2>
      <label class="field full"><span>Name</span><input name="name" value="${esc(v.name)}" data-vfocus></label>
      <label class="field full"><span>Kurz gesagt</span><input name="summary" value="${esc(v.summary)}" placeholder="Ein Satz"></label>
      <label class="field full"><span>Beschreibung</span><textarea name="description" rows="6">${esc(v.description)}</textarea></label>
      <label class="field full"><span>Leitlinie (optional)</span><textarea name="guideline" rows="3" placeholder="Was hilft dir, wenn du es bemerkst?">${esc(v.guideline)}</textarea></label>
      <div class="sheet-foot full"><button class="btn quiet" data-a="vt.back">Abbrechen</button>${d.id ? `<button class="btn ghost danger" data-a="vt.pattern.del" data-id="${d.id}">Löschen</button>` : ''}<button class="btn" data-a="vt.pattern.save">Speichern</button></div></form>`;
  }
  // ----- Gespräch vorbereiten -----
  function vtPrep() {
    const p = ui.vault.prep != null ? vc.preps.find(x => x.id === ui.vault.prep) : null;
    if (p) return vtPrepEditor(p);
    const L = vc.preps.slice().sort((a, b) => (a.updated < b.updated ? 1 : -1));
    return `<div class="row wrap" style="gap:8px;margin-bottom:12px"><p class="how-text grow" style="margin:0">Entlang deiner vier Prinzipien: Einstieg ohne Widerstand, wunder Punkt, Augenhöhe, Stopp-Signal mit Verbindungsangebot.</p><button class="btn sm" data-a="vt.prep.new">${ic('plus')}Vorbereitung</button></div>
      ${L.length ? `<ul class="vt-list">${L.map(x => `<li><button class="vt-row" data-a="vt.prep.open" data-id="${x.id}"><span class="tag">${VT.prepStatus[x.status] || x.status}</span><span class="grow"><strong>${esc(x.title || 'Ohne Titel')}</strong><br><span class="small muted">${E.fmtShort(x.updated.slice(0, 10))}${x.situation ? ', ' + esc(x.situation.slice(0, 60)) : ''}</span></span>${ic('chev')}</button></li>`).join('')}</ul>` : '<div class="empty">Noch keine Vorbereitung.</div>'}
      ${vtDraftCheck()}`;
  }
  function vtPrepEditor(p) {
    const step = (k, t, hint) => `<li class="vt-step"><label class="field"><span class="vt-step-title">${t}</span><span class="small muted">${hint}</span><textarea name="${k}" rows="4" placeholder="In deinen Worten, so wie du redest">${esc(p[k])}</textarea></label></li>`;
    const pn = esc(partner());
    return `<div class="row wrap" style="gap:8px;margin-bottom:12px"><button class="btn sm quiet" data-a="vt.prep.list">${ic('back')}Vorbereitungen</button><span class="grow"></span>${seg('Stand', Object.entries(VT.prepStatus), p.status, { a: 'vt.prep.status', d: String(p.id) })}</div>
      <form class="panel form-grid" id="vt-prep" data-id="${p.id}" onsubmit="return false">
        <label class="field full"><span>Titel</span><input name="title" value="${esc(p.title)}" placeholder="Worum geht es in einem Satz?"></label>
        <label class="field full"><span>Worum geht es?</span><span class="small muted">Was ist passiert oder steht an? Ein paar Stichworte reichen.</span><textarea name="situation" rows="3">${esc(p.situation)}</textarea></label>
        <label class="field full"><span>Was willst du in diesem Gespräch erreichen?</span><span class="small muted">Ein realistisches Ziel für dieses eine Gespräch, nicht für die ganze Beziehung.</span><textarea name="goal" rows="2">${esc(p.goal)}</textarea></label>
        <ol class="vt-steps full">
          ${step('validation', '1. Einstieg ohne Widerstand', `Was ist an ${pn}s Punkt berechtigt? Was kannst du ehrlich anerkennen, ohne „aber“ hinterher?`)}
          ${step('woundedPoint', '2. Deinen wunden Punkt zeigen', 'Was trifft dich daran, und was fühlst du darunter? Gefühl statt Rechtfertigung oder Gegenangriff.')}
          ${step('eyeLevel', '3. Präsenz und Augenhöhe', `Was schätzt du an ${pn}? Was wünschst du dir von ihr, auf Augenhöhe und nicht als Bitte um Benotung?`)}
          ${step('stopSignal', '4. Stopp-Signal mit Verbindungsangebot', 'Was sagst du, wenn es verletzend wird? Klar stoppen und zeigen, dass du im Kontakt bleiben willst, nur nicht so.')}
        </ol>
        <label class="field full"><span>Nach dem Gespräch</span><span class="small muted">Wie ist es gelaufen? Was hat funktioniert, wo ist es gekippt?</span><textarea name="debrief" rows="4">${esc(p.debrief)}</textarea></label>
        <div class="sheet-foot full"><button class="btn ghost danger" data-a="vt.prep.del" data-id="${p.id}">Löschen</button><span class="grow"></span>${p.entryId ? `<button class="btn quiet" data-a="vt.entry" data-id="${p.entryId}">Zum Eintrag</button>` : ''}<button class="btn" data-a="vt.prep.save" data-id="${p.id}">Speichern</button></div></form>
      <p class="small muted" style="margin-top:10px">Keine fertigen Texte. Die Worte im Gespräch bleiben deine.</p>`;
  }
  function vtDraftCheck() {
    const t = ui.vault.draft, F = VT.check(t), w = VT.words(t);
    const marked = (() => { if (!t) return ''; let out = '', i = 0; for (const f of F) { out += esc(t.slice(i, f.start)) + `<mark class="vt-${f.kind}">${esc(t.slice(f.start, f.end))}</mark>`; i = f.end; } return (out + esc(t.slice(i))).replace(/\n/g, '<br>'); })();
    return `<div class="panel" style="margin-top:16px"><h2 class="sec-title">Entwurf-Check</h2><p class="how-text" style="margin-top:6px">Für eine Nachricht, die du schreiben willst. Markiert Therapeutensprache, KI-Merkmale und deine Gesprächsfallen. Läuft nur hier, wird nicht gespeichert.</p>
      <label class="field" style="margin-top:10px"><span>Dein Entwurf</span><textarea rows="6" data-i="vt.draft" placeholder="Schreib erst mal drauflos, so wie du es sagen würdest.">${esc(t)}</textarea></label>
      <p class="small muted" style="margin:6px 0 0">${w} ${w === 1 ? 'Wort' : 'Wörter'}${w > 120 ? ', ziemlich lang für eine Nachricht. Vielleicht lieber persönlich?' : ''}</p>
      ${t ? `<div class="vt-marked">${marked}</div>` : ''}
      ${F.length ? `<ul class="vt-findings">${F.map(f => `<li class="vt-${f.kind}"><strong>${esc(f.label)}</strong> („${esc(f.text)}“): ${esc(f.hint)}</li>`).join('')}</ul>` : t ? '<p class="small" style="margin-top:8px;color:var(--olive)">Klingt nach dir. Nichts gefunden.</p>' : ''}</div>`;
  }
  // Takes the editor's fields into the preparation; true when something changed (only then it counts as updated)
  function vtPrepSync(p) {
    const f = $('#vt-prep'); if (!f || +f.dataset.id !== p.id) return false;
    const d = new FormData(f); let ch = false;
    ['title', 'situation', 'goal', 'validation', 'woundedPoint', 'eyeLevel', 'stopSignal', 'debrief'].forEach(k => { const v = String(d.get(k) || '').trim(); if ((p[k] || '') !== v) { p[k] = v; ch = true; } });
    if (ch) p.updated = new Date().toISOString();
    return ch;
  }
  function vtPrepKeep() {
    const f = $('#vt-prep'); if (!f || !vc) return;
    const p = vc.preps.find(x => x.id === +f.dataset.id);
    if (p && vtPrepSync(p)) vaultSave();
  }
  // ----- Türschwelle -----
  const INTENTIONS = ['ruhig', 'neugierig', 'präsent', 'freundlich', 'verspielt', 'klar'];
  const RT_STEPS = { kurz: ['ankommen', 'ablegen', 'koerper', 'intention', 'tuer', 'danach'], ausfuehrlich: ['ankommen', 'ablegen', 'koerper', 'alarm', 'intention', 'tuer', 'danach'] };
  const tens = (name, val, act) => `<div class="vt-tension" role="group" aria-label="${name}">${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<button data-a="${act}" data-v="${n}" aria-pressed="${val === n}">${n}</button>`).join('')}</div><div class="scale-ends"><span>ganz ruhig</span><span>am Limit</span></div>`;
  function vtDoor() {
    const r = ui.vault.reset || { variant: 'kurz', before: null };
    const H = vc.resets.slice().sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 10);
    return `<div class="panel"><h2 class="sec-title">Türschwellen-Reset</h2><p class="how-text" style="margin-top:6px">Für den Übergang von der Bahn zur Wohnungstür: ankommen, ablegen, Körper, ein Wort für den Abend, dann die Tür. Anderthalb oder drei Minuten.</p>
      <div class="field" style="margin-top:12px"><span>Wie angespannt bist du gerade?</span>${tens('Anspannung vorher', ui.vault.before || null, 'vt.rt.before')}</div>
      <div class="row wrap" style="gap:10px;margin-top:12px;align-items:center">${seg('Dauer', [['kurz', 'Kurz, 1½ Minuten'], ['ausfuehrlich', 'Ausführlich, 3 Minuten']], ui.vault.variant || 'kurz', { a: 'vt.rt.variant' })}<button class="btn" data-a="vt.rt.start">${ic('play')}Reset starten</button></div></div>
      ${H.length ? `<div class="panel" style="margin-top:14px"><h2 class="sec-title">Zuletzt</h2><table class="tbl"><thead><tr><th>Wann</th><th>Vorher</th><th>Nachher</th><th>Wort</th></tr></thead><tbody>${H.map(x => `<tr><td>${E.fmtShort(x.at.slice(0, 10))} ${x.at.slice(11, 16)}</td><td class="num">${x.before ?? ''}</td><td class="num">${x.after ?? ''}</td><td>${esc(x.intention || '')}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  }
  function vtRitual() {
    const r = ui.vault.reset, s = r.step;
    const breath = (title, text, extra) => `<h2 class="vt-rt-title">${title}</h2><p class="vt-rt-text">${text}</p><div class="vt-breath-wrap"><div class="vt-breath" style="transform:scale(${r.breath === 'ein' ? 1 : r.breath === 'aus' ? 0.6 : 0.8});transition-duration:${r.breath === 'ein' ? 4 : r.breath === 'aus' ? 6 : 1}s"></div></div><p class="vt-rt-cue">${r.done ? 'Gut.' : r.breath === 'ein' ? 'Einatmen …' : r.breath === 'aus' ? 'Langsam ausatmen …' : 'Gleich geht es los.'}</p>${r.cycles > 1 && !r.done && r.cycle > 0 ? `<p class="small">Atemzug ${r.cycle} von ${r.cycles}</p>` : ''}${extra || ''}<button class="btn ${r.done ? '' : 'quiet'}" data-a="vt.rt.next">${r.done ? 'Weiter' : 'Überspringen'}</button>`;
    let body = '';
    if (s === 'ankommen') body = breath('Ankommen', 'Du bist noch nicht zu Hause. Das hier ist dein Zwischenraum.');
    else if (s === 'ablegen') body = `<h2 class="vt-rt-title">Ablegen</h2><p class="vt-rt-text">Was trägst du noch aus dem Tag mit dir herum? Nenn es innerlich oder tipp ein Stichwort. Es wartet bis morgen auf dich.</p><div class="row" style="gap:8px;max-width:420px;margin:16px auto 0"><input class="search grow" id="vt-park" placeholder="z. B. ein Angebot, eine Mail" data-enter="vt.rt.park" autocomplete="off"><button class="btn sm quiet" data-a="vt.rt.park">Ablegen</button></div>${r.parked.length ? `<ul class="vt-parked">${r.parked.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}<button class="btn" style="margin-top:18px" data-a="vt.rt.next">${r.parked.length ? 'Liegt bis morgen. Weiter' : 'Weiter'}</button>`;
    else if (s === 'koerper') body = `<h2 class="vt-rt-title">Körper</h2><p class="vt-rt-text">Schultern hochziehen, kurz halten, fallen lassen. Dreimal.<br>Kiefer locker. Hände ausschütteln.</p><p class="small" style="opacity:.8">Nicht für die Haltung. Für dein Nervensystem.</p><p class="vt-rt-cue num">${r.left > 0 ? 'noch ' + r.left + ' Sekunden' : 'Fertig'}</p><button class="btn ${r.left > 0 ? 'quiet' : ''}" data-a="vt.rt.next">${r.left > 0 ? 'Überspringen' : 'Weiter'}</button>`;
    else if (s === 'alarm') body = `<h2 class="vt-rt-title">Das alte Alarmsignal</h2><p class="vt-rt-text">Vielleicht meldet sich gleich das bekannte Gefühl: Hab ich was falsch gemacht? Gibt es gleich Ärger?</p><p class="vt-rt-text">Das ist ein altes Alarmsignal, kein Beweis. Du musst dir nichts verdienen, um nach Hause zu kommen.</p><button class="btn" data-a="vt.rt.next">Weiter</button>`;
    else if (s === 'intention') body = `<h2 class="vt-rt-title">Ein Wort für den Abend</h2><p class="vt-rt-text">Ein Wort reicht. Für dich${vNames().child ? ', für ' + esc(vNames().child) : ''}, für ${esc(partner())}.</p><div class="schips" style="justify-content:center;margin-top:14px">${INTENTIONS.map(w => `<button class="chip" data-a="vt.rt.word" data-v="${w}" aria-pressed="${r.intention === w}">${w}</button>`).join('')}</div><input class="search" style="max-width:300px;margin:12px auto 0" placeholder="oder ein eigenes Wort" value="${INTENTIONS.includes(r.intention) ? '' : esc(r.intention)}" data-i="vt.rt.own" aria-label="Eigenes Wort"><br><button class="btn" style="margin-top:18px" data-a="vt.rt.next">Weiter</button>`;
    else if (s === 'tuer') body = breath('Die Tür', 'Ein letzter Atemzug. Hand an die Tür.', r.intention ? `<p class="small">Und denk an dein Wort: <strong>${esc(r.intention)}</strong>.</p>` : '');
    else body = `<h2 class="vt-rt-title">Und jetzt?</h2><div class="field" style="margin-top:8px;text-align:left"><span style="color:inherit">Wie angespannt bist du jetzt?</span>${tens('Anspannung nachher', r.after, 'vt.rt.after')}</div><button class="btn" style="margin-top:18px" data-a="vt.rt.finish">Speichern und reingehen</button>`;
    return `<div class="vt-ritual" role="dialog" aria-modal="true" aria-label="Türschwellen-Reset"><button class="btn sm ghost vt-rt-x" data-a="vt.rt.cancel">Abbrechen</button><div class="vt-rt-body">${body}</div></div>`;
  }
  function rtGo(step) {
    rtTimers.splice(0).forEach(clearTimeout);
    const r = ui.vault.reset; r.step = step; r.breath = 'ruhe'; r.done = false; r.cycle = 0; r.left = 0;
    if (step === 'ankommen' || step === 'tuer') { r.cycles = step === 'tuer' ? 1 : r.variant === 'kurz' ? 3 : 5; rtBreath(); }
    if (step === 'koerper') { r.left = r.variant === 'kurz' ? 20 : 30; const tick = () => { if (ui.vault.reset !== r || r.step !== 'koerper') return; r.left--; render(); if (r.left > 0) rtTimers.push(setTimeout(tick, 1000)); }; rtTimers.push(setTimeout(tick, 1000)); }
    render();
  }
  function rtBreath() {
    const r = ui.vault.reset;
    const cycle = () => {
      if (!ui.vault.reset || ui.vault.reset !== r) return;
      if (r.cycle >= r.cycles) { r.breath = 'ruhe'; r.done = true; render(); return; }
      r.cycle++; r.breath = 'ein'; render();
      rtTimers.push(setTimeout(() => { if (ui.vault.reset !== r) return; r.breath = 'aus'; render(); rtTimers.push(setTimeout(cycle, 6000)); }, 4000));
    };
    rtTimers.push(setTimeout(cycle, 900));
  }
  function rtNext() {
    const r = ui.vault.reset, L = RT_STEPS[r.variant], i = L.indexOf(r.step);
    if (i < L.length - 1) rtGo(L[i + 1]);
  }
  // ----- Check-in -----
  // K59 (2.13): sleep, sleep quality and energy from the normal check-in fill empty fields here. Nothing flows back.
  // c.src[k]: 'hc' = taken over (keeps following the normal check-in until changed here), 'du' = set or cleared here.
  const CI_FROM = [['sleepHours', 'sleepH'], ['sleepQuality', 'sleepQ'], ['energy', 'energy']];
  function ciFrom(d) {
    const h = (S.health && S.health.days && S.health.days[d]) || null, c = vc.checkins[d] || {}, src = c.src || {}, o = {};
    if (h) CI_FROM.forEach(([k, hk]) => { if (h[hk] != null && src[k] !== 'du' && (src[k] === 'hc' || c[k] == null)) o[k] = h[hk]; });
    return o;
  }
  // What the check-in shows for a day: own values, otherwise those from the normal check-in (listed in pre)
  function ciView(d) {
    const o = ciFrom(d);
    return { c: Object.assign({}, vc.checkins[d] || {}, o), pre: Object.keys(o) };
  }
  function vtCheckin() {
    const d = E.addDays(E.today(), -ui.vault.day), V = ciView(d), c = V.c;
    const pre = k => (V.pre.includes(k) ? ' <em class="vt-pre">übernommen</em>' : '');
    const chips = (k, opts, val, fmt) => `<div class="schips">${opts.map(o => `<button class="chip" data-a="vt.ci.set" data-k="${k}" data-v="${o}" aria-pressed="${val === o}">${fmt ? fmt(o) : o}</button>`).join('')}<input class="search" style="width:90px" type="number" min="0" max="600" placeholder="andere" value="${val != null && !opts.includes(val) ? val : ''}" data-c="vt.ci.num" data-k="${k}" aria-label="${k}, eigener Wert"></div>`;
    const sc = (k, lo, hi) => `<div class="scale-wrap"><div class="scale" role="group" aria-label="${k}">${[1, 2, 3, 4, 5].map(n => `<button data-a="vt.ci.set" data-k="${k}" data-v="${n}" aria-pressed="${c[k] === n}">${n}</button>`).join('')}</div><div class="scale-ends"><span>${lo}</span><span>${hi}</span></div></div>`;
    const active = (c.sport && c.sport > 0) || (c.selfCare && c.selfCare.trim());
    const fear = (c.motivations || []).filter(VT.isFear);
    const days = Array.from({ length: 14 }, (_, i) => E.addDays(E.today(), -13 + i)).map(x => [x, ciView(x)]);
    const anyPre = days.some(([, w]) => w.pre.includes('sleepHours') || w.pre.includes('energy'));
    const fmtN = v => (v == null ? '' : String(v).replace('.', ','));
    const cell = (w, k, txt) => `<td class="num${w.pre.includes(k) ? ' vt-pre' : ''}">${txt}</td>`;
    return `<div class="row wrap" style="gap:10px;align-items:center;margin-bottom:12px">${seg('Tag', [['0', 'Heute'], ['1', 'Gestern'], ['2', 'Vorgestern']], String(ui.vault.day), { a: 'vt.ci.day' })}<span class="small muted">${E.WD[E.weekday(d)]}, ${E.fmtShort(d)} Jede Angabe speichert sofort.${V.pre.length ? ' Mit „übernommen“ markierte Werte stammen aus „Wie geht’s dir?“; änderst du sie hier, gelten sie nur im Raum.' : ''}</span></div>
      <div class="panel form-grid">
        <div class="field"><span>Schlaf letzte Nacht (Stunden)${pre('sleepHours')}</span><input type="number" inputmode="decimal" min="0" max="16" step="0.5" value="${c.sleepHours ?? ''}" data-c="vt.ci.num" data-k="sleepHours"></div>
        <div class="field"><span>Schlafqualität${pre('sleepQuality')}</span><div class="schips">${VT.SLEEP_QUALITY.map((l, i) => `<button class="chip" data-a="vt.ci.set" data-k="sleepQuality" data-v="${i + 1}" aria-pressed="${c.sleepQuality === i + 1}">${l}</button>`).join('')}</div></div>
        <div class="field"><span>Energie gerade${pre('energy')}</span>${sc('energy', 'leer', 'voller Akku')}</div>
        <div class="field"><span>Anspannung</span>${sc('stress', 'ruhig', 'am Limit')}</div>
        <div class="field full"><span>Zeit nur für dich heute (Minuten)</span>${chips('meTime', VT.ME_TIME, c.meTime)}</div>
        <div class="field"><span>Kontakt zu Freunden heute</span>${seg('Kontakt zu Freunden', [['1', 'Ja'], ['0', 'Nein']], c.social == null ? '' : c.social ? '1' : '0', { a: 'vt.ci.social' })}</div>
        <div class="field"><span>Bewegung (Minuten)</span>${chips('sport', VT.SPORT, c.sport)}<input class="search" placeholder="Was? z. B. Laufen, Rad, Spaziergang" value="${esc(c.sportType || '')}" data-c="vt.ci.text" data-k="sportType" aria-label="Art der Bewegung"></div>
        <label class="field full"><span>Selbstfürsorge</span><input value="${esc(c.selfCare || '')}" placeholder="Pflege, Kleidung, Hobby, ein gutes Buch …" data-c="vt.ci.text" data-k="selfCare"></label>
        ${active ? `<div class="field full vt-motiv"><span>Motivations-Check</span><span class="small muted">Warum hast du das gemacht? Ehrlich ist hier wichtiger als schön. Mehrere Antworten gehen.</span><div class="schips">${VT.MOTIVES.map(m => `<button class="chip" data-a="vt.ci.motive" data-v="${m[0]}" aria-pressed="${(c.motivations || []).includes(m[0])}">${esc(VT.motiveLabel(m[0], vNames().partner))}</button>`).join('')}</div>
          ${fear.length ? `<div class="note" style="margin-top:10px;display:block"><p style="margin:0"><strong>Kurz innehalten: Selbstoptimierung auf Bewährung?</strong></p><p style="margin:6px 0 0">Du hast es (auch) gemacht, um Streit zu vermeiden oder Frieden zu verdienen. Das ist menschlich. Aber Veränderung als Friedensangebot kippt auf Dauer in Groll: Du lieferst, und der Frieden bleibt trotzdem an Bedingungen geknüpft.</p><ul style="margin:8px 0 0;padding-left:18px"><li>Würdest du es auch machen, wenn ${esc(partner())} es nie erfährt?</li><li>Was hast du selbst davon, ganz unabhängig von ihr?</li><li>Was passiert in dir, wenn sie es nicht bemerkt oder trotzdem kritisiert?</li></ul><label class="field" style="margin-top:10px"><span>Dein eigener Grund</span><input value="${esc(c.ownReason || '')}" placeholder="Was hättest du davon, nur für dich?" data-c="vt.ci.text" data-k="ownReason"></label><p class="small" style="margin:8px 0 0">Findest du keinen eigenen Grund, ist es völlig okay, es morgen zu lassen. Der Frieden zu Hause ist eure gemeinsame Aufgabe.</p></div>` : ''}</div>` : ''}
        <label class="field full"><span>Notiz</span><textarea rows="2" data-c="vt.ci.text" data-k="note">${esc(c.note || '')}</textarea></label>
      </div>
      <div class="panel" style="margin-top:14px;overflow-x:auto"><h2 class="sec-title">Letzte 14 Tage</h2><table class="tbl vt-trend" style="margin-top:8px"><thead><tr><th>Tag</th><th>Schlaf</th><th>Energie</th><th>Anspannung</th><th>Me-Time</th><th>Bewegung</th><th>Freunde</th><th>Motiv</th></tr></thead><tbody>${days.map(([x, w]) => { const v = w.c; return `<tr${x === d ? ' class="is-sel"' : ''}><td>${E.WD[E.weekday(x)].slice(0, 2)} ${E.fmtShort(x)}</td>${cell(w, 'sleepHours', fmtN(v.sleepHours))}${cell(w, 'energy', v.energy ? v.energy : '')}<td class="num">${v.stress ? v.stress : ''}</td><td class="num">${v.meTime != null ? v.meTime : ''}</td><td class="num">${v.sport != null ? v.sport : ''}</td><td>${v.social != null ? (v.social ? 'ja' : 'nein') : ''}</td><td>${v.motivationType ? { eigen: 'eigen', gemischt: 'gemischt', angst: 'aus Angst' }[v.motivationType] : ''}</td></tr>`; }).join('')}</tbody></table>${anyPre ? '<p class="small muted" style="margin:8px 0 0">Kursiv: aus „Wie geht’s dir?“ übernommen.</p>' : ''}</div>`;
  }
  function ciDay() { return E.addDays(E.today(), -ui.vault.day); }
  function ciSet(k, v) {
    const d = ciDay(), from = ciFrom(d); const c = (vc.checkins[d] = vc.checkins[d] || { motivations: [] });
    const src = (c.src = c.src || {});
    Object.keys(from).forEach(x => { if (x !== k) { c[x] = from[x]; src[x] = 'hc'; } });
    if (CI_FROM.some(f => f[0] === k)) src[k] = 'du';
    c[k] = v; c.t = new Date().toISOString();
    if (!((c.sport && c.sport > 0) || (c.selfCare && c.selfCare.trim()))) { c.motivations = []; c.motivationType = null; c.ownReason = ''; }
    else c.motivationType = VT.classifyMotives(c.motivations);
    vaultSave();
  }
  // ----- Mehr -----
  function vtMore() {
    const n = vNames(), d = vdev(), ok = prfReady(), can = !!(window.isSecureContext && window.PublicKeyCredential);
    return `<div class="panel"><h2 class="sec-title">Namen</h2><p class="small muted" style="margin:6px 0 10px">Nur hier gespeichert, verschlüsselt wie alles im Raum.</p><div class="form-grid">
        <label class="field"><span>Dein Vorname</span><input value="${esc(n.me)}" data-c="vt.name" data-k="me"></label><label class="field"><span>Partnerin</span><input value="${esc(n.partner)}" data-c="vt.name" data-k="partner"></label><label class="field"><span>Kind</span><input value="${esc(n.child)}" data-c="vt.name" data-k="child"></label></div></div>
      <div class="panel" style="margin-top:14px"><h2 class="sec-title">Schlüssel</h2>
        <p class="how-text" style="margin-top:6px">${ok ? 'Auf diesem Gerät öffnet dein Fingerabdruck den Raum; die Passphrase bleibt als Ersatzschlüssel.' : can ? 'Auf diesem Gerät öffnest du bisher mit der Passphrase. Mit dem Fingerabdruck geht es schneller; dafür legt die App einen eigenen Passkey an, aus dem sie den Schlüssel ableitet (PRF). Nicht jedes Gerät kann das; dann bleibt es bei der Passphrase.' : 'Dieses Gerät kann keinen Passkey; es bleibt bei der Passphrase.'}</p>
        <div class="row wrap" style="gap:8px;margin-top:10px">${can ? (ok ? `<button class="btn sm quiet" data-a="vt.prf.off">Fingerabdruck auf diesem Gerät entfernen</button>` : `<button class="btn sm" data-a="vt.prf.on"${ui.vault.busy ? ' disabled' : ''}>${ic('lock')}${ui.vault.busy ? 'Einen Moment …' : 'Fingerabdruck einrichten'}</button>`) : ''}<button class="btn sm quiet" data-a="vt.pass">Passphrase ändern</button></div>
        ${Object.keys(S.vault.prf || {}).length ? `<p class="small muted" style="margin-top:8px">Geräte mit Fingerabdruck: ${Object.keys(S.vault.prf).length}${d && S.vault.prf[d.id] ? ' (dieses dabei)' : ''}.</p>` : ''}</div>
      <div class="panel" style="margin-top:14px"><h2 class="sec-title">Daten</h2>
        <p class="how-text" style="margin-top:6px">Einlesen: die Export-Datei aus Resonanzraum (JSON) oder das Startpaket. Vorhandene Abschnitte und Muster mit gleichem Namen werden aktualisiert, Einträge kommen dazu.</p>
        <div class="row wrap" style="gap:8px;margin-top:10px;align-items:center"><label class="btn sm quiet">${ic('upload')}Datei einlesen<input type="file" accept="application/json,.json" data-c="vt.import" hidden></label><label class="chip"><input type="checkbox" data-c="vt.replace"${ui.vault.replace ? ' checked' : ''}> vorher alles im Raum leeren</label></div>
        <p class="how-text" style="margin-top:14px">Export: alles entschlüsselt als JSON, im Format von Resonanzraum. Nur für dich; die Datei danach sicher löschen.</p>
        <div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn sm quiet" data-a="vt.export">${ic('download')}Entschlüsselt exportieren</button><span class="grow"></span><button class="btn sm ghost danger" data-a="vt.wipe">${ic('trash')}Raum löschen</button></div></div>
      <div class="panel" style="margin-top:14px"><h2 class="sec-title">So ist der Raum geschützt</h2><ul class="how-text" style="margin:8px 0 0;padding-left:18px"><li>Inhalt nur als Chiffrat (AES-256-GCM) in den App-Daten; das Backup enthält dasselbe Chiffrat.</li><li>Zufälliger Datenschlüssel, verpackt mit einem Schlüssel aus der Passphrase (PBKDF2, ${VT.ITERS.toLocaleString('de-DE')} Runden) und je Gerät mit einem Schlüssel aus dem Passkey (WebAuthn PRF, HKDF).</li><li>Kein Menüpunkt, keine Adresse. Schließt nach einer Minute im Hintergrund, beim Wechsel der Seite und mit „Schließen“.</li><li>Verlierst du Passphrase und alle Geräte mit Fingerabdruck, sind die Daten weg. Das ist der Preis.</li></ul></div>`;
  }

  // ---------- Actions ----------
  function vtForm(id) { const f = $(id); return f ? new FormData(f) : null; }
  Object.assign(A, {
    'about.tap': () => { const t = Date.now(); if (t - ui.about.t > 4000) ui.about.n = 0; ui.about.t = t; ui.about.n++; if (ui.about.n >= 7) { ui.about.n = 0; vaultEnter(); } },
    'vt.lock': () => vaultLock(true),
    'vt.msg': () => { ui.vault.msg = ''; render(); },
    'vt.hint': () => { ui.vault.hint = ''; render(); },
    'vt.tab': (el, e) => { if (e && e.preventDefault) e.preventDefault(); ui.vault.tab = el.dataset.k; ui.vault.sel = null; ui.vault.edit = null; ui.vault.prep = null; render(); },
    'vt.back': () => { ui.vault.sel = null; ui.vault.edit = null; render(); },
    'vt.setup': async () => {
      const d = vtForm('#vt-setup'); if (!d) return;
      const p1 = String(d.get('p1') || ''), p2 = String(d.get('p2') || '');
      ui.vault.setup = { p1, p2, me: String(d.get('me') || ''), partner: String(d.get('partner') || ''), child: String(d.get('child') || '') };
      if (!VT.passOk(p1)) { vaultMsg('Die Passphrase braucht mindestens ' + VT.MIN_PASS + ' Zeichen.'); return; }
      if (p1 !== p2) { vaultMsg('Die beiden Eingaben sind verschieden.'); return; }
      ui.vault.busy = true; render();
      try {
        const c = VT.empty(); c.names = { me: String(d.get('me') || '').trim(), partner: String(d.get('partner') || '').trim(), child: String(d.get('child') || '').trim() };
        const r = await VT.create(p1, c);
        S.vault = r.hdr; save(); ui.vault.setup = null;
        await vaultOpened(r.session);
        toast('Raum eingerichtet');
      } catch (e) { ui.vault.busy = false; vaultMsg('Das Einrichten hat nicht geklappt.'); }
    },
    'vt.unlock': async () => {
      const d = vtForm('#vt-unlock'); if (!d || !S.vault) return;
      const p = String(d.get('p') || ''); if (!p) return;
      ui.vault.busy = true; render();
      const sess = await VT.openPass(S.vault, p);
      if (!sess) { ui.vault.busy = false; vaultMsg('Die Passphrase passt nicht.'); return; }
      await vaultOpened(sess);
    },
    'vt.prf': () => vaultWithPrf(),
    'vt.prf.on': async () => {
      if (!vOpen()) return;
      ui.vault.busy = true; render();
      try {
        const { id, bytes } = await prfRegister();
        await VT.addPrf(S.vault, vsess, id, bytes);
        vdevSet({ id, vault: S.vault.id }); save();
        ui.vault.busy = false; ui.vault.hint = ''; toast('Fingerabdruck eingerichtet'); render();
      } catch (e) { ui.vault.busy = false; vaultMsg(e && e.message === 'noprf' ? 'Dieses Gerät gibt beim Fingerabdruck keinen Schlüssel heraus (keine PRF-Unterstützung). Es bleibt bei der Passphrase.' : 'Abgebrochen oder nicht geklappt. Es bleibt bei der Passphrase.'); }
    },
    'vt.prf.off': () => { const d = vdev(); if (d) VT.removePrf(S.vault, d.id); vdevSet(null); save(); toast('Fingerabdruck entfernt'); render(); },
    'vt.pass': () => openDialog(`${dlgHead('Passphrase ändern')}<form class="form-grid" id="vt-pw" onsubmit="return false"><label class="field full"><span>Neue Passphrase (mindestens ${VT.MIN_PASS} Zeichen)</span><input type="password" name="p1" autocomplete="new-password" autofocus></label><label class="field full"><span>Noch einmal</span><input type="password" name="p2" autocomplete="new-password" data-enter="vt.pass.save"></label></form><p class="small muted" style="margin-top:8px">Der Fingerabdruck auf den Geräten bleibt gültig.</p><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="vt.pass.save">Ändern</button></div>`),
    'vt.pass.save': async () => {
      const d = vtForm('#vt-pw'); if (!d || !vOpen()) return;
      const p1 = String(d.get('p1') || ''), p2 = String(d.get('p2') || '');
      if (!VT.passOk(p1)) { toast('Mindestens ' + VT.MIN_PASS + ' Zeichen.'); return; }
      if (p1 !== p2) { toast('Die beiden Eingaben sind verschieden.'); return; }
      await VT.changePass(S.vault, vsess, p1); save(); closeDialog(); toast('Passphrase geändert');
    },
    'vt.export': () => { if (!vOpen()) return; download('raum-export-' + E.today() + '.json', JSON.stringify(VT.exportResonanz(vc), null, 2)); toast('Exportiert, entschlüsselt. Datei danach löschen.'); },
    'vt.wipe': () => confirmDlg('Raum löschen?', 'Alles im Raum wird unwiederbringlich gelöscht, auch aus künftigen Backups. Ältere Backups behalten ihr Chiffrat.', 'Löschen', () => { delete S.vault; vdevSet(null); save(); vaultLock(true); toast('Raum gelöscht'); }, true),
    // Chronik
    'vt.entry': el => { ui.vault.tab = 'chronik'; ui.vault.edit = null; ui.vault.sel = { type: 'entry', id: +el.dataset.id }; render(); },
    'vt.entry.new': () => { ui.vault.tab = 'chronik'; ui.vault.sel = null; ui.vault.edit = { type: 'entry', id: null, v: { kind: 'konflikt', title: '', date: E.today(), trigger: '', narrative: '', insight: '', dynamics: '', needsSelf: [], needsPartner: [], ownPart: '', nextStep: '', patterns: [] } }; render(); },
    'vt.entry.edit': el => { const e = vc.entries.find(x => x.id === +el.dataset.id); if (!e) return; ui.vault.edit = { type: 'entry', id: e.id, v: JSON.parse(JSON.stringify(e)) }; render(); },
    'vt.entry.kind': el => { vtEntrySync(); ui.vault.edit.v.kind = el.dataset.v; render(); },
    'vt.entry.pat': el => { vtEntrySync(); const v = ui.vault.edit.v, id = +el.dataset.k; const i = v.patterns.findIndex(x => x.id === id); if (i >= 0) v.patterns.splice(i, 1); else v.patterns.push({ id, note: '' }); render(); },
    'vt.entry.save': () => {
      vtEntrySync(); const d = ui.vault.edit, v = d.v;
      if (!v.title.trim()) { toast('Bitte einen Titel eingeben.'); return; }
      let e;
      if (d.id) { e = vc.entries.find(x => x.id === d.id); Object.assign(e, v, { updated: new Date().toISOString() }); }
      else e = VT.addEntry(vc, v);
      ui.vault.edit = null; ui.vault.sel = { type: 'entry', id: e.id }; vaultSave(); render(); toast('Gespeichert');
    },
    'vt.entry.del': el => confirmDlg('Eintrag löschen?', 'Der Eintrag wird aus der Chronik entfernt.', 'Löschen', () => { vc.entries = vc.entries.filter(x => x.id !== +el.dataset.id); vc.preps.forEach(p => { if (p.entryId === +el.dataset.id) p.entryId = null; }); ui.vault.edit = null; ui.vault.sel = null; vaultSave(); render(); }, true),
    'vt.section.new': () => { const i = $('#vt-sec'); if (!i || !i.value.trim()) return; vc.sections.push({ id: VT.nextId(vc), slug: VT.slugOf(i.value), title: i.value.trim(), content: '', order: 100 + vc.sections.length }); vaultSave(); render(); },
    // Muster
    'vt.pattern': el => { ui.vault.tab = 'muster'; ui.vault.edit = null; ui.vault.sel = { type: 'pattern', id: +el.dataset.id }; render(); },
    'vt.pattern.new': () => { ui.vault.sel = null; ui.vault.edit = { type: 'pattern', id: null, v: { name: '', summary: '', description: '', guideline: '', kind: 'eigen' } }; render(); },
    'vt.pattern.edit': el => { const p = vc.patterns.find(x => x.id === +el.dataset.id); if (!p) return; ui.vault.edit = { type: 'pattern', id: p.id, v: JSON.parse(JSON.stringify(p)) }; render(); },
    'vt.pattern.save': () => {
      const d = vtForm('#vt-pattern'), ed = ui.vault.edit; if (!d) return;
      const v = { name: String(d.get('name') || '').trim(), summary: String(d.get('summary') || '').trim(), description: String(d.get('description') || '').trim(), guideline: String(d.get('guideline') || '').trim() };
      if (!v.name) { toast('Bitte einen Namen eingeben.'); return; }
      let p;
      if (ed.id) { p = vc.patterns.find(x => x.id === ed.id); Object.assign(p, v); }
      else p = VT.addPattern(vc, v);
      ui.vault.edit = null; ui.vault.sel = { type: 'pattern', id: p.id }; vaultSave(); render(); toast('Gespeichert');
    },
    'vt.pattern.del': el => confirmDlg('Muster löschen?', 'Das Muster und seine Verknüpfungen in der Chronik werden entfernt.', 'Löschen', () => { const id = +el.dataset.id; vc.patterns = vc.patterns.filter(x => x.id !== id); vc.entries.forEach(e => { e.patterns = (e.patterns || []).filter(x => x.id !== id); }); ui.vault.edit = null; ui.vault.sel = null; vaultSave(); render(); }, true),
    // Vorbereitung
    'vt.prep.new': () => { const p = VT.addPrep(vc, { title: '' }); ui.vault.tab = 'vorbereitung'; ui.vault.prep = p.id; vaultSave(); render(); },
    'vt.prep.from': el => { const e = vc.entries.find(x => x.id === +el.dataset.id); const p = VT.addPrep(vc, { title: e ? 'Zu: ' + e.title : '', situation: e && e.trigger ? e.trigger : '', entryId: e ? e.id : null }); ui.vault.tab = 'vorbereitung'; ui.vault.sel = null; ui.vault.prep = p.id; vaultSave(); render(); },
    'vt.prep.open': el => { ui.vault.prep = +el.dataset.id; render(); },
    'vt.prep.list': () => { const p = vc.preps.find(x => x.id === ui.vault.prep); if (p) { vtPrepSync(p); vaultSave(); } ui.vault.prep = null; render(); },
    'vt.prep.status': el => { const p = vc.preps.find(x => x.id === +el.dataset.d); if (!p) return; vtPrepSync(p); if (p.status !== el.dataset.v) { p.status = el.dataset.v; p.updated = new Date().toISOString(); } vaultSave(); render(); },
    'vt.prep.save': el => { const p = vc.preps.find(x => x.id === +el.dataset.id); if (!p) return; vtPrepSync(p); vaultSave(); toast('Gespeichert'); },
    'vt.prep.del': el => confirmDlg('Vorbereitung löschen?', 'Die Vorbereitung wird entfernt.', 'Löschen', () => { vc.preps = vc.preps.filter(x => x.id !== +el.dataset.id); ui.vault.prep = null; vaultSave(); render(); }, true),
    // Türschwelle
    'vt.rt.before': el => { ui.vault.before = +el.dataset.v; render(); },
    'vt.rt.variant': el => { ui.vault.variant = el.dataset.v; render(); },
    'vt.rt.start': () => { ui.vault.reset = { variant: ui.vault.variant || 'kurz', before: ui.vault.before || null, after: null, parked: [], intention: '', step: '', breath: 'ruhe', cycle: 0, cycles: 0, done: false, left: 0 }; rtGo('ankommen'); },
    'vt.rt.next': () => rtNext(),
    'vt.rt.park': () => { const i = $('#vt-park'); if (!i || !i.value.trim()) return; ui.vault.reset.parked.push(i.value.trim()); render(); const n = $('#vt-park'); if (n) n.focus(); },
    'vt.rt.word': el => { const r = ui.vault.reset; r.intention = r.intention === el.dataset.v ? '' : el.dataset.v; render(); },
    'vt.rt.after': el => { ui.vault.reset.after = +el.dataset.v; render(); },
    'vt.rt.cancel': () => { rtTimers.splice(0).forEach(clearTimeout); ui.vault.reset = null; render(); },
    'vt.rt.finish': () => { const r = ui.vault.reset; VT.addReset(vc, { variant: r.variant, before: r.before, after: r.after, intention: r.intention, parked: r.parked, at: new Date().toISOString() }); rtTimers.splice(0).forEach(clearTimeout); ui.vault.reset = null; ui.vault.before = null; vaultSave(); render(); toast('Gespeichert. Willkommen zu Hause.'); },
    // Check-in
    'vt.ci.day': el => { ui.vault.day = +el.dataset.v; render(); },
    'vt.ci.set': el => { const k = el.dataset.k, v = +el.dataset.v, c = ciView(ciDay()).c; ciSet(k, c[k] === v ? null : v); render(); },
    'vt.ci.social': el => { const c = vc.checkins[ciDay()] || {}, v = el.dataset.v === '1'; ciSet('social', c.social === v ? null : v); render(); },
    'vt.ci.motive': el => { const c = vc.checkins[ciDay()] || { motivations: [] }, m = (c.motivations || []).slice(), i = m.indexOf(el.dataset.v); if (i >= 0) m.splice(i, 1); else m.push(el.dataset.v); ciSet('motivations', m); render(); }
  });
  Object.assign(C, {
    'vt.section': el => { const s = vc.sections.find(x => x.id === +el.dataset.id); if (s) { s.content = el.value; vaultSave(); } },
    'vt.ci.num': el => { const v = el.value === '' ? null : +el.value; if (v != null && !isFinite(v)) return; ciSet(el.dataset.k, v); render(); },
    'vt.ci.text': el => { ciSet(el.dataset.k, el.value); if (el.dataset.k === 'selfCare') render(); },
    'vt.name': el => { vc.names[el.dataset.k] = el.value.trim(); vaultSave(); },
    'vt.replace': el => { ui.vault.replace = el.checked; },
    'vt.import': async el => {
      const f = el.files && el.files[0]; if (!f || !vOpen()) return;
      try {
        const j = JSON.parse(await f.text());
        if (!VT.isResonanz(j)) { vaultMsg('Das ist keine Export-Datei aus Resonanzraum.'); return; }
        if (ui.vault.replace) { const names = vc.names; vc = VT.empty(); vc.names = names; }
        const n = VT.importResonanz(vc, j);
        ui.vault.replace = false; vaultSave();
        vaultMsg(`Eingelesen: ${n.sections} Abschnitte, ${n.patterns} Muster, ${n.entries} Einträge, ${n.preps} Vorbereitungen, ${n.checkins} Check-ins, ${n.resets} Resets${n.chats ? ', ' + n.chats + ' Gespräche' : ''}.`);
      } catch (e) { vaultMsg('Die Datei ließ sich nicht lesen.'); }
    }
  });
  Object.assign(I, {
    'vt.q': el => { ui.vault.q = el.value; const L = $('#view'); if (L) { const pos = el.selectionStart; render(); const n = $('#view [data-i="vt.q"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } } },
    'vt.draft': el => { ui.vault.draft = el.value; const pos = el.selectionStart, top = el.scrollTop; render(); const n = $('#view [data-i="vt.draft"]'); if (n) { n.focus(); n.setSelectionRange(pos, pos); n.scrollTop = top; } },
    'vt.rt.own': el => { ui.vault.reset.intention = el.value.trim(); }
  });
  // ---------- end vault ----------
