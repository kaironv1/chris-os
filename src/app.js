/* Chris OS – UI (früher „Haltung“) */
(function () {
  'use strict';
  const E = window.Engine, G = window.Garments, WP = window.WardrobeParser;
  const KEY = 'haltung.v1', WXKEY = 'haltung.wetter';
  const VERSION = '2.16';
  // Web version (PWA): lock.js and pwa.js are embedded only there. window.Lock alone is not enough: Chrome has a native Lock (Web Locks API).
  const WEB = !!(window.Lock && window.Lock.init && window.PWA && window.PWA.init);
  // Two devices (K39, K40): phone and PC both run the web version with separate data; the main device is the
  // phone by default, the other one gets the data per backup. HELLO: on Windows the lock asks for Windows Hello.
  const UA = navigator.userAgent || '';
  const DEVICE = /Android|iPhone|iPad|iPod|Mobile/i.test(UA) || (navigator.userAgentData && navigator.userAgentData.mobile) ? 'handy' : 'pc';
  const DEV_NAME = { handy: 'Handy', pc: 'PC' };
  const devOf = v => (v === 'handy' || v === 'pc') ? v : null;
  const HELLO = /Windows/i.test(UA);
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const capF = s => { s = String(s || ''); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const n0 = (n, d) => E.fmtNum(n, d == null ? 1 : d);
  const minText = m => m < 1 ? 'unter 1 Minute' : m === 1 ? '1 Minute' : m + ' Minuten';
  let S, WX = null, ver = 0;
  const ui = { occ: {}, pick: {}, oday: 'heute', wf: 'alle', ws: '', lf: 'alle', prog: null, slot: null, memo: {}, open: null };

  // ---------- Icons ----------
  const IC = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/>',
    today: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><circle cx="12" cy="14.5" r="2"/>',
    training: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    care: '<path d="M12 3.5c3 3.6 5.5 6.7 5.5 10a5.5 5.5 0 0 1-11 0c0-3.3 2.5-6.4 5.5-10z"/><path d="M9.5 14a2.5 2.5 0 0 0 2.5 2.5"/>',
    outfit: '<path d="M12 7.6a2 2 0 1 1 2-2c0 1-.8 1.5-2 2.2V9l8.2 5.6c.9.6.5 2-.6 2H4.4c-1.1 0-1.5-1.4-.6-2L12 9"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    check: '<path d="M5 12.5l4.2 4.2L19 7"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
    up: '<path d="M7 10.5v9H4.5v-9H7zm0 0l4-6.5c1.2 0 2.2 1 2 2.3l-.6 3.7h5.3c1.3 0 2.2 1.2 1.9 2.4l-1.5 6.2c-.2.9-1 1.4-1.9 1.4H7"/>',
    down: '<path d="M17 13.5v-9h2.5v9H17zm0 0l-4 6.5c-1.2 0-2.2-1-2-2.3l.6-3.7H6.3c-1.3 0-2.2-1.2-1.9-2.4l1.5-6.2c.2-.9 1-1.4 1.9-1.4H17"/>',
    wash: '<path d="M4 9h16l-1.6 9.2a2 2 0 0 1-2 1.8H7.6a2 2 0 0 1-2-1.8L4 9zM8.5 9l2-4.5M15.5 9l-2-4.5"/>',
    camera: '<path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10.5H4z"/><circle cx="12" cy="13.5" r="3.3"/>',
    upload: '<path d="M12 15V4.5M7.5 9L12 4.5 16.5 9M5 15v4.5h14V15"/>', download: '<path d="M12 4.5V15M7.5 10.5L12 15l4.5-4.5M5 15v4.5h14V15"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>', alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    edit: '<path d="M4.5 19.5l1-4.5L15.5 5l3.5 3.5-10 10z"/>', trash: '<path d="M5 7h14M9.5 7V4.5h5V7M7 7l1 12.5h8L17 7"/>',
    ext: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13M17 14v5.5H4.5V7H10"/>', swap: '<path d="M7 7h12l-3.5-3.5M17 17H5l3.5 3.5"/>',
    run: '<path d="M3.5 16.5c0-3 1-6.5 2.5-9l3 1.5 1.5-1.5 2 2.5c2.5 1.8 5.5 2.6 8 3.6v2.9z"/><path d="M3.5 18.5h17"/>',
    play: '<path d="M8 5.5v13l10-6.5z"/>', timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 10v4l2.5 1.5M9.5 3h5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    cloud: '<path d="M7.5 18.5h9.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 10.6 4 4 0 0 0 7.5 18.5z"/>',
    suncloud: '<path d="M8.6 6.2a4 4 0 0 1 6 1.6M5.2 9.6a4 4 0 0 1 1.4-1.9M8.6 3.5v1"/><path d="M8.5 19h8.5a3.6 3.6 0 0 0 .5-7.2 5 5 0 0 0-9.5.8A3.3 3.3 0 0 0 8.5 19z"/>',
    rain: '<path d="M7.5 15h9.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 7.1 4 4 0 0 0 7.5 15z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/>',
    snow: '<path d="M7.5 15h9.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 7.1 4 4 0 0 0 7.5 15z"/><path d="M9 18.5v.1M13 19.8v.1M17 18.5v.1"/>',
    fog: '<path d="M4 9h16M6 13h12M4 17h16"/>',
    storm: '<path d="M7.5 14h9.5a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7 6.1 4 4 0 0 0 7.5 14z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/>',
    office: '<rect x="3.5" y="7.5" width="17" height="12" rx="2"/><path d="M9 7.5V5.5h6v2M3.5 12.5h17"/>',
    home: '<path d="M4 11l8-6.5 8 6.5M6 9.5v10h12v-10"/>', free: '<path d="M5 19C5 11 10 6 19 6c0 9-5 13-13 13M5 19l7-7"/>',
    chev: '<path d="M9 5l7 7-7 7"/>', minus: '<path d="M5 12h14"/>'
  };
  const ic = (k, cls) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${IC[k] || ''}</svg>`;

  // ---------- State ----------
  // Start data: only the test build embeds a seed (loaded on the first start). The PC and web versions come
  // without start data since 2.4: on a device without saved data the app opens the welcome screen with the backup import.
  const seedEl = () => document.getElementById('seed');
  const seedState = () => { const el = seedEl(); return el ? JSON.parse(el.textContent) : null; };
  // Without a seed, older states are migrated against empty lists: structure only, nothing personal
  const baseState = () => ({ profile: {}, grooming: { tasks: [], products: [], routine: { morgens: [], abends: [] } }, training: { exercises: {}, equipment: { dumbbells: null, mat: true, bench: false, bands: false, bar: false } }, health: { measures: [], doctors: [], vorsorge: [], record: {}, appts: [], followups: [], profile: {} } });
  function freshState() {
    const st = seedState();
    if (!st) return null;
    const d = E.today();
    st.meta = st.meta || {}; st.meta.setup = d;
    E.initGrooming(st, d);
    return st;
  }
  function load() {
    let st = null;
    try { st = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { st = null; }
    if (!st) {
      st = freshState();
      if (!st) return null;
      localStorage.setItem(KEY, JSON.stringify(st));
    }
    if (migrate(st)) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* saved on next change */ } }
    return st;
  }
  // Brings older saved states (v1.x) up to the current structure. Returns true if the version changed.
  function migrate(st) {
    st.wardrobe.tempOverride = st.wardrobe.tempOverride || {};
    st.wardrobe.reroll = st.wardrobe.reroll || {};
    st.meta = st.meta || {}; st.meta.dismissed = st.meta.dismissed || {};
    let changed = false;
    if (!st.version || st.version < 2) {
      const seed = seedState() || baseState();
      const L = st.grooming.last || (st.grooming.last = {});
      st.health = Object.assign(seed.health, st.health || {});
      [['zahnarzt', 'zahn'], ['hautcheck', 'haut'], ['checkup', 'checkup']].forEach(([from, to]) => {
        const v = st.health.vorsorge.find(x => x.id === to);
        if (L[from] && v && !v.last) v.last = L[from];
        delete L[from];
      });
      st.grooming.tasks = (st.grooming.tasks || []).filter(t => t.slot === 'rhythmus');
      seed.grooming.tasks.forEach(t => { if (!st.grooming.tasks.some(x => x.id === t.id)) st.grooming.tasks.push(t); });
      st.grooming.routine = st.grooming.routine || seed.grooming.routine;
      seed.grooming.products.forEach(pr => { if (!st.grooming.products.some(x => x.id === pr.id)) st.grooming.products.push(pr); });
      delete st.grooming.daily;
      Object.entries(seed.training.exercises).forEach(([id, ex]) => { if (!st.training.exercises[id]) st.training.exercises[id] = ex; });
      st.profile = Object.assign(seed.profile, st.profile || {});
      E.initGrooming(st, E.today());
      st.version = 2; changed = true;
    }
    if (st.version < 3) {
      // Answers from the clarification list (K9-K22) and the home dumbbells; only fills what is still empty.
      const seed = seedState() || baseState(), sh = seed.health, h = st.health;
      Object.entries(seed.training.exercises).forEach(([id, ex]) => {
        if (!st.training.exercises[id]) { st.training.exercises[id] = ex; return; }
        if (ex.max) ['start', 'inc', 'max', 'repMin', 'repMax'].forEach(k => { if (ex[k] != null) st.training.exercises[id][k] = ex[k]; });
      });
      st.training.equipment = st.training.equipment || seed.training.equipment;
      h.profile = Object.assign({}, sh.profile, h.profile || {});
      h.measures = h.measures || [];
      sh.measures.forEach(m => { const x = h.measures.find(y => y.id === m.id); if (!x) h.measures.push(m); else if (m.id === 'gurgeln' && x.l === 'Gegurgelt') x.l = m.l; });
      h.doctors = h.doctors || [];
      sh.doctors.forEach(dd => { const x = h.doctors.find(y => y.id === dd.id); if (!x) h.doctors.push(dd); else { if (!x.name) x.name = dd.name; if (!x.note) x.note = dd.note; if (x.id === 'd-haut' && x.title === 'Hautarzt') x.title = dd.title; } });
      h.vorsorge = h.vorsorge || [];
      sh.vorsorge.forEach(v => {
        const x = h.vorsorge.find(y => y.id === v.id); if (!x) { h.vorsorge.push(v); return; }
        if (!x.last && v.last) { x.last = v.last; x.est = v.est; }
        if (v.checked && !x.checked) x.checked = v.checked;
        if (v.season) { x.season = v.season; x.optional = v.optional; x.note = v.note; }
        if (v.id === 'pzr') x.note = v.note;
      });
      h.record = h.record || {};
      ['allergies', 'conditions', 'supplements', 'notes'].forEach(k => { if (!h.record[k] && sh.record[k]) h.record[k] = sh.record[k]; });
      h.appts = h.appts || []; h.followups = h.followups || [];
      sh.appts.forEach(a => { if (!h.appts.some(y => y.id === a.id || (y.vs === a.vs && y.date === a.date))) h.appts.push(a); });
      sh.followups.forEach(f => { if (!h.followups.some(y => y.id === f.id)) h.followups.push(f); });
      st.version = 3; changed = true;
    }
    if (st.version < 4) {
      // Answers K23, K25, K31 (only fills what is still empty)
      const seed = seedState() || baseState(), sh = seed.health, h = st.health;
      h.doctors = h.doctors || []; h.vorsorge = h.vorsorge || []; h.record = h.record || {};
      const nd = sh.doctors.find(d => d.id === 'd-neuro'), xd = h.doctors.find(d => d.id === 'd-neuro');
      if (nd) { if (!xd) h.doctors.push(nd); else { if (!xd.name) xd.name = nd.name; if (!xd.note) xd.note = nd.note; } }
      const hv = h.vorsorge.find(v => v.id === 'haut'), sv = sh.vorsorge.find(v => v.id === 'haut');
      if (hv && sv && !hv.last) { hv.last = sv.last; hv.est = sv.est; }
      if (!h.record.conditions && sh.record.conditions) h.record.conditions = sh.record.conditions;
      st.training.equipment = Object.assign({}, seed.training.equipment, st.training.equipment || {}, { mat: true });
      st.version = 4; changed = true;
    }
    st.wardrobe.choice = st.wardrobe.choice || {};
    const cut = E.addDays(E.today(), -7);
    Object.keys(st.wardrobe.choice).forEach(k => { if (k.slice(0, 10) < cut) delete st.wardrobe.choice[k]; });
    // Closed weekly reviews (2.8) are only needed for the current week
    Object.keys(st.meta.dismissed).forEach(k => { if (k.startsWith('review:') && k.slice(7) < E.addDays(E.today(), -21)) delete st.meta.dismissed[k]; });
    const h = st.health;
    ['days', 'epOut', 'intake'].forEach(k => { h[k] = h[k] || {}; });
    ['obs', 'appts', 'questions', 'meds', 'followups', 'measures', 'doctors', 'vorsorge', 'exps'].forEach(k => { h[k] = h[k] || []; });
    h.record = h.record || {};
    // Nutrition log (2.7): structure only
    const nu = st.nutrition = st.nutrition || {};
    ['log', 'portions'].forEach(k => { nu[k] = nu[k] || {}; });
    ['foods', 'meals'].forEach(k => { nu[k] = nu[k] || []; });
    st.training.protein = st.training.protein || {};
    // Weather, pollen and air quality per day (2.8): structure only, the app fetches the values itself
    st.env = st.env || {};
    st.env.days = st.env.days || {};
    // Trips with a packing list (2.11): structure only
    st.trips = st.trips || [];
    return changed;
  }
  // quiet: no change of the data itself (backup, hint closed, view switched), so changedAt stays
  function save(quiet) {
    ver++; ui.memo = {};
    if (!quiet && S.meta) S.meta.changedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
      if (ui.saveFail) { ui.saveFail = false; if (ui.toastAct === exportBackup) { ui.toastAct = null; $('#toast').classList.add('hidden'); } }
    } catch (e) {
      // The entries are still in memory: the notice stays until the backup is saved (2.14)
      ui.saveFail = true;
      notice('Speichern fehlgeschlagen. Sichere deine Einträge jetzt als Backup, sonst fehlen sie nach dem Schließen.', 'Backup speichern', exportBackup);
    }
  }

  // ---------- Storage on this device (2.14) ----------
  // localStorage holds about 5 million characters per address (Chrome: 5 × 1024 × 1024, keys included); photos live
  // in IndexedDB, which has far more room.
  const LS_MAX = 5 * 1024 * 1024;
  function lsUsed() {
    if (ui.memo.ls != null) return ui.memo.ls;
    let n = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } } catch (e) { /* blocked */ }
    return (ui.memo.ls = n);
  }
  const fmtSize = n => n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : n0(n / 1048576, 1) + ' MB';
  // Asks the browser to keep the data when the device runs low on space. Chrome decides without asking (installed
  // apps usually get it); ui.persist: true, false or null (unknown).
  async function persistStorage() {
    const st = navigator.storage;
    if (!st || !st.persisted) { ui.persist = null; return; }
    try { ui.persist = await st.persisted(); if (!ui.persist && st.persist) ui.persist = await st.persist(); } catch (e) { ui.persist = null; }
    if (S && $('#view') && route().top === 'einstellungen' && !ui.vault.on) render();
  }
  async function photoSize() {
    let n = 0, b = 0;
    try { for (const [, blob] of await Photos.all()) { n++; b += blob.size || 0; } } catch (e) { /* no photos */ }
    ui.photos = { n, b };
    if ($('#view') && route().top === 'einstellungen' && !ui.vault.on) render();
  }
  function storageRow() {
    const used = lsUsed(), pct = Math.round(used / LS_MAX * 100), ph = ui.photos;
    if (!ph) photoSize();
    const fill = 'Einträge ' + fmtSize(used) + ' von etwa 5 MB (' + pct + ' %)' + (ph && ph.n ? ', Fotos ' + fmtSize(ph.b) : '') + '.';
    const keep = ui.persist === true ? ' Der Browser hält die Daten fest, auch wenn das Gerät knapp an Speicher ist.'
      : ui.persist === false ? ' Bei knappem Gerätespeicher darf der Browser die Daten löschen; als installierte App passiert das seltener. Dein Backup schützt dich in jedem Fall.' : '';
    const warn = pct >= 85 ? ' Fast voll: Speichere ein Backup.' : '';
    return `<div data-row="storage"><div><span class="lbl">Speicher auf diesem Gerät</span><p class="hint">${fill}${warn}${keep}</p></div></div>`;
  }

  // ---------- Data state across devices ----------
  // meta.changedAt: last change; meta.savedAt: last backup saved; meta.restored: { at, exported, from } of the
  // last backup loaded on this device. Timestamps are ISO strings (UTC) and compare as text.
  const pad2 = n => String(n).padStart(2, '0');
  const dayOf = t => E.iso(new Date(t));
  const latest = (...ts) => ts.filter(Boolean).sort().pop() || null;
  function stamp(t) {
    const d = new Date(t);
    if (!t || isNaN(d)) return '';
    const n = E.diffDays(E.iso(d), E.today());
    return (n === 0 ? 'heute' : n === 1 ? 'gestern' : E.fmtShort(E.iso(d))) + ', ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  const backupLabel = (from, at) => 'Backup' + (devOf(from) ? ' vom ' + DEV_NAME[from] : '') + (at ? ' (' + stamp(at) + ')' : '');
  const mainDevice = () => devOf(S && S.settings.mainDevice) || 'handy';
  const isMain = () => DEVICE === mainDevice();
  // Changes on this device that are in no backup yet
  function unsaved() {
    const m = S.meta, r = m.restored || {};
    return !!m.changedAt && m.changedAt > (latest(m.savedAt, r.at, r.exported) || '');
  }
  const item = id => S.wardrobe.items.find(i => i.id === id);
  const exById = id => S.training.exercises[id];
  function applyTheme() {
    const t = S ? S.settings.theme : 'auto';
    const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', dark ? '#121822' : '#F1F2EE'));
  }

  // ---------- Photos (IndexedDB) ----------
  const Photos = {
    db: null, urls: new Map(),
    open() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((res, rej) => {
        const r = indexedDB.open('haltung-fotos', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('p');
        r.onsuccess = () => { this.db = r.result; res(this.db); };
        r.onerror = () => rej(r.error);
      });
    },
    async run(mode, fn) {
      const db = await this.open();
      return new Promise((res, rej) => { const t = db.transaction('p', mode); const out = fn(t.objectStore('p')); t.oncomplete = () => res(out && 'result' in out ? out.result : undefined); t.onerror = () => rej(t.error); });
    },
    async loadAll() {
      try {
        const db = await this.open();
        await new Promise(res => { const req = db.transaction('p').objectStore('p').openCursor(); req.onsuccess = () => { const c = req.result; if (c) { this.urls.set(c.key, URL.createObjectURL(c.value)); c.continue(); } else res(); }; req.onerror = () => res(); });
      } catch (e) { /* storage unavailable */ }
    },
    async put(id, blob) { await this.run('readwrite', s => s.put(blob, id)); ui.photos = null; const o = this.urls.get(id); if (o) URL.revokeObjectURL(o); this.urls.set(id, URL.createObjectURL(blob)); },
    async del(id) { await this.run('readwrite', s => s.delete(id)); ui.photos = null; const o = this.urls.get(id); if (o) URL.revokeObjectURL(o); this.urls.delete(id); },
    async all() { const db = await this.open(); return new Promise(res => { const out = []; const req = db.transaction('p').objectStore('p').openCursor(); req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else res(out); }; req.onerror = () => res(out); }); },
    async get(id) { return this.run('readonly', s => s.get(id)); },
    async clear() { await this.run('readwrite', s => s.clear()); ui.photos = null; for (const u of this.urls.values()) URL.revokeObjectURL(u); this.urls.clear(); },
    url(id) { return this.urls.get(id) || null; }
  };
  async function shrink(file) {
    const bmp = await createImageBitmap(file);
    const max = 900, sc = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Bild nicht lesbar')), 'image/jpeg', 0.84));
  }

  // ---------- Weather ----------
  function loadWx() { try { WX = JSON.parse(localStorage.getItem(WXKEY) || 'null'); } catch (e) { WX = null; } }
  async function fetchW(loc) {
    const u = 'https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
      '&hourly=temperature_2m,apparent_temperature,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max&timezone=Europe%2FBerlin&forecast_days=3';
    const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json();
  }
  async function refreshWeather(force) {
    const h = S.settings.home, o = S.settings.office;
    if (!h) return;
    const hk = h.lat + ',' + h.lon, ok = o ? o.lat + ',' + o.lon : '';
    if (!force && WX && WX.hk === hk && WX.ok === ok && Date.now() - WX.at < 45 * 60e3) return;
    try {
      const [home, office] = await Promise.all([fetchW(h), o ? fetchW(o) : Promise.resolve(null)]);
      WX = { at: Date.now(), hk, ok, home, office };
      try { localStorage.setItem(WXKEY, JSON.stringify(WX)); } catch (e) { /* ignore */ }
      ui.wxError = false; ui.memo = {};
      if (!ui.vault.on) render();
    } catch (e) { ui.wxError = true; if (!WX && !ui.vault.on) render(); }
  }

  // ---------- Weather, pollen and air quality per day (2.8) ----------
  // For the home location, so the Verläufe can compare complaints with them. Past days come along once
  // (up to 92 days per past_days, older days with check-ins from the archives). Saved quietly: the values can
  // be fetched again at any time and are no entry of Chris, so the data state for the backup stays untouched.
  const EV = window.Env;
  let envBusy = false;
  const envKey = h => (+h.lat).toFixed(2) + ',' + (+h.lon).toFixed(2);
  function envFirst() {
    const ds = Object.keys(S.health.days || {}).filter(d => H.hasData(S.health.days[d])).sort();
    return ds.length ? E.addDays(ds[0], -1) : null;
  }
  async function getJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  async function refreshEnv() {
    const h = S && S.settings.home;
    if (!h || !EV || envBusy) return;
    const env = S.env, t = E.today(), now = Date.now(), lk = envKey(h);
    // Another home: the old values belong to another place, so they are fetched anew
    if (env.loc && env.loc !== lk) { env.days = {}; env.at = 0; env.gapTry = null; }
    const N = EV.need(env, envFirst(), t, now);
    // An older gap the archives could not fill is tried again after a week at the earliest
    const gap = N.gap && !(env.gapTry && env.gapTry.k === N.gap.join('/') && now - env.gapTry.at < 7 * 864e5) ? N.gap : null;
    if (!N.past && !gap) return;
    // After a failed try, wait ten minutes before the next one
    if (ui.envFail && now - ui.envFail < 10 * 60e3) return;
    envBusy = true;
    try {
      const loc = { lat: h.lat, lon: h.lon }, jobs = [];
      if (N.past) jobs.push(['wx', { past: N.past }], ['aq', { past: N.past }]);
      if (gap) jobs.push(['wx', { start: gap[0], end: gap[1] }], ['aq', { start: gap[0], end: gap[1] }]);
      const res = await Promise.allSettled(jobs.map(([k, q]) => getJSON(EV.url(k, loc, q)).then(j => EV.daily(j, k, t))));
      let got = 0;
      res.forEach(r => { if (r.status === 'fulfilled') got += EV.merge(env, r.value); });
      ui.envFail = res.every(r => r.status === 'fulfilled') ? 0 : now;
      if (gap) env.gapTry = { k: gap.join('/'), at: now };
      if (got) {
        env.loc = lk;
        if (N.past && res.slice(0, 2).every(r => r.status === 'fulfilled')) env.at = now;
      }
      if (!got && !gap) return;
      save(true);
      const r = route();
      if (got && (r.top === 'heute' || (r.top === 'gesundheit' && r.sub === 'verlauf'))) render();
    } finally { envBusy = false; }
  }
  // Pollen from moderate on and poor air for the header on Heute; only the own pollen types, if chosen (2.9, K48)
  function envLine(d) {
    const x = S.env && S.env.days[d];
    if (!x || !EV) return '';
    const sel = EV.sel(S), parts = [], P = EV.pollen(x, sel), b = EV.aqiBand(x.aq);
    if (P && P.max >= 2) parts.push('Pollen: ' + EV.polText(x, 2, sel));
    if (b && b.i >= 3) parts.push('Luft ' + b.l);
    return parts.length ? `<span class="wx env-line">${ic('free')}<span class="small ink2">${esc(parts.join(', '))}</span></span>` : '';
  }

  // ---------- Outfit helpers ----------
  const occFor = d => ui.occ[d] || E.defaultOccasion(S, d);
  function ctxFor(d, occ) { return E.context(S, d, occ || occFor(d), WX); }
  function suggestionFor(d, occ) {
    const o = occ || occFor(d);
    const ch = (S.wardrobe.choice || {})[d + ':' + o] || null;
    const pick = (ch && ch.key) || ui.pick[d + '|' + o];
    const k = d + '|' + o + '|' + (pick || '') + '|' + (ch ? (ch.shoes || '') + '/' + (ch.outer || '') : '') + '|' + ver + '|' + (WX ? WX.at : 0);
    if (!ui.memo[k]) {
      const ctx = ctxFor(d, o), res = E.suggest(S, ctx, { pick });
      if (res.fav && ch) E.applyChoice(S, res.fav, ch);
      ui.memo[k] = { ctx, res };
    }
    return ui.memo[k];
  }
  const wornOn = d => S.wardrobe.wear.filter(w => w.date === d).slice(-1)[0] || null;

  // ---------- Small render helpers ----------
  function art(it, opts) {
    const u = Photos.url(it.id);
    return u ? `<img src="${u}" alt="${esc(capF(it.label))}" loading="lazy">` : G.svg(it, opts);
  }
  // Brand as written by Chris, but all-lowercase words get a capital (e.g. "nordwerk studio" -> "Nordwerk Studio")
  // Brand as written; only an all-lowercase brand gets capitals, small words like „und“ stay small (same rule in figure.js)
  const SMALL_WORD = /^(und|and|of|de|la|le|les|du|van|von|der|die|das|y|e|et|&)$/;
  const brandOf = it => {
    const b = String((it && it.brand) || '').trim().replace(/\s+/g, ' ');
    if (!b || b !== b.toLowerCase()) return b;
    return b.split(' ').map((w, i) => (i && SMALL_WORD.test(w)) || !/^[a-zäöü]/.test(w) ? w : w[0].toUpperCase() + w.slice(1)).join(' ');
  };
  function subLines(it) {
    if (it.status === 'wunsch') return [brandOf(it) || 'Wunschliste', 'noch nicht gekauft'];
    const lines = [brandOf(it) || 'Marke offen'];
    if (it.nos && it.nos.length) lines.push('Nr. ' + it.nos.join(', ') + (it.qty > 1 && it.nos.length === 1 ? ' (' + it.qty + '×)' : ''));
    else if (it.unknownColor) lines.push('Farbe offen');
    return lines;
  }
  const sub = it => subLines(it).join(', ');
  // One line naming every piece of an outfit with its brand, for compact views
  function itemsLine(o) {
    const list = [o.outer, ...o.tops.slice().reverse(), o.bottom, o.shoes].filter(Boolean);
    return list.map(i => { const b = brandOf(i); return esc(capF(i.label)) + (b ? ' <span class="muted">(' + esc(b) + ')</span>' : ''); }).join(', ');
  }
  function gTile(it, opts) {
    opts = opts || {};
    if (!it) return '';
    const wash = opts.wash && it.role !== 'shoes' && !['cap', 'belt', 'watch'].includes(it.role)
      ? `<button class="g-wash" data-a="laundry" data-id="${it.id}" aria-pressed="${!!it.laundry}" aria-label="${it.laundry ? 'Ist in der Wäsche' : 'In die Wäsche'}: ${esc(it.label)}" title="${it.laundry ? 'In der Wäsche' : 'In die Wäsche'}">${ic('wash')}</button>` : '';
    const lines = subLines(it).concat(opts.note ? [opts.note] : []);
    const canSwap = opts.swapD && opts.slot;
    const artHtml = canSwap ? `<button class="g-art g-pick" data-a="o.choose" data-d="${opts.swapD}" data-k="${opts.slot}" aria-label="Andere Teile statt ${esc(capF(it.label))} ansehen" title="Auswählen">${art(it)}</button>` : `<div class="g-art">${art(it)}</div>`;
    const swap = canSwap ? `<button class="g-swap" data-a="o.swap" data-d="${opts.swapD}" data-k="${opts.slot}" aria-label="${esc(capF(it.label))} tauschen" title="Nur dieses Teil tauschen">${ic('refresh')}</button>` : '';
    return `<div class="g${it.unknownColor ? ' unknown' : ''}">${artHtml}<div class="g-cap">${esc(capF(it.label))}</div>${lines.map((l, i) => `<div class="g-sub${i === 0 ? ' g-brand' : ''}">${esc(l)}</div>`).join('')}${wash}${swap}</div>`;
  }
  function hintTile(label) {
    const fake = { cat: label === 'Winterjacke' ? 'Winterjacke' : 'Mantel', hex: '#8C877F', unknownColor: true, label };
    return `<div class="g unknown"><div class="g-art">${G.svg(fake)}</div><div class="g-cap">${esc(label)}</div><div class="g-sub">noch nicht erfasst</div></div>`;
  }
  function layout(o, opts) {
    opts = opts || {};
    if (!o) return '';
    const tops = o.tops.slice().reverse();
    const topsHtml = (o.outer ? gTile(o.outer, Object.assign({}, opts, { slot: 'outer' })) : (o.outerHint ? hintTile(o.outerHint) : '')) + tops.map((t, j) => gTile(t, Object.assign({}, opts, { slot: 't' + (o.tops.length - 1 - j), note: (o.open && t === o.tops[o.tops.length - 1] && t.role === 'shirt') ? 'offen getragen' : null }))).join('');
    const nTop = tops.length + (o.outer || o.outerHint ? 1 : 0);
    const bottoms = [o.bottom, o.shoes, ...(o.acc || [])].filter(Boolean);
    if (opts.small) {
      const all = [...(o.outer ? [o.outer] : []), ...tops, ...bottoms.slice(0, 2)];
      return `<div class="lay small" style="--cols:${all.length}">${all.map(i => `<div class="g"><div class="g-art">${art(i)}</div></div>`).join('')}</div>`;
    }
    return `<div class="lay-split"><div class="lay tops${opts.big ? ' big' : ''}" style="--cols:${Math.max(2, nTop)}">${topsHtml}</div><div class="lay bottoms${opts.big ? ' big' : ''}" style="--cols:${Math.max(2, Math.min(3, bottoms.length))}">${bottoms.map(b => gTile(b, Object.assign({}, opts, { slot: b === o.bottom ? 'bottom' : b === o.shoes ? 'shoes' : null }))).join('')}</div></div>`;
  }
  function seg(name, opts, val, extra) {
    return `<div class="seg" role="group" aria-label="${esc(name)}">${opts.map(([v, l]) => `<button data-a="${extra.a}" data-v="${v}"${extra.d ? ` data-d="${extra.d}"` : ''} aria-pressed="${v === val}">${esc(l)}</button>`).join('')}</div>`;
  }
  function wxIcon(code) { return ic(E.WMO(code).k); }
  function round(t) { return Math.round(t) + '°'; }

  // ---------- Heute: tiles that fold (closed by default, remembered for the session) ----------
  const FOLD_KEY = 'chrisos.open';
  function foldOpen(k) {
    if (!ui.open) { try { ui.open = JSON.parse(sessionStorage.getItem(FOLD_KEY) || '{}') || {}; } catch (e) { ui.open = {}; } }
    return !!ui.open[k];
  }
  // sum and meta are HTML (already escaped); body is only built when the tile is open
  function fold(k, title, sum, meta, body) {
    const open = foldOpen(k);
    return `<div class="fold${open ? ' open' : ''}" data-fold="${k}"><h2 class="fold-h"><button class="fold-head" data-a="fold" data-k="${k}" aria-expanded="${open}" aria-controls="fold-${k}"><span class="fold-main"><span class="fold-title">${esc(title)}</span><span class="fold-sum">${sum}</span></span>${meta ? `<span class="fold-meta">${meta}</span>` : ''}<span class="fold-chev" aria-hidden="true">${ic('chev')}</span></button></h2><div class="fold-body" id="fold-${k}"${open ? '' : ' hidden'}>${open ? body() : ''}</div></div>`;
  }

  // ---------- Outfit board ----------
  function board(d, opts) {
    opts = opts || {};
    const occ = occFor(d);
    const { ctx, res } = suggestionFor(d, occ);
    const worn = wornOn(d);
    const isToday = d === E.today();
    const title = opts.title || (isToday ? 'Outfit für heute' : 'Outfit für ' + (E.diffDays(E.today(), d) === 1 ? 'morgen' : E.fmtLong(d)));
    const occs = Object.entries(E.OCC).map(([k, v]) => [k, v.label]);
    if (opts.fold) {
      const o = worn ? E.fromIds(S, worn.items, ctx) : res.fav;
      const pieces = o ? [o.outer, ...o.tops.slice().reverse(), o.bottom, o.shoes].filter(Boolean) : [];
      const sum = !o ? 'Gerade keine passende Kombination' : (worn ? 'Getragen: ' : esc(E.OCC[occ].label) + ': ') + esc(pieces.map(i => capF(i.label)).join(', '));
      const meta = pieces.length ? `<span class="fold-sw" aria-hidden="true">${pieces.map(i => `<i${i.unknownColor ? ' class="open"' : ''} style="background:${esc(i.hex || '#8C877F')}"></i>`).join('')}</span>` : '';
      return `<section class="board board-fold" aria-label="${esc(title)}">${fold('outfit', title, sum, meta, () => `${worn ? '' : `<div class="board-head board-occ">${seg('Anlass', occs, occ, { a: 'occ', d })}</div>`}${boardBody(d, opts, occ, ctx, res, worn, isToday)}`)}</section>`;
    }
    return `<section class="board" aria-label="${esc(title)}">
      <div class="board-head"><h2 class="board-title">${esc(title)}</h2>${worn ? '' : seg('Anlass', occs, occ, { a: 'occ', d })}</div>
      ${boardBody(d, opts, occ, ctx, res, worn, isToday)}
    </section>`;
  }
  function boardBody(d, opts, occ, ctx, res, worn, isToday) {
    let body = '';
    if (worn) {
      const o = E.fromIds(S, worn.items, ctx);
      body = `${layout(o, { big: opts.big, wash: true })}
        <p class="small ink2" style="margin-top:12px">Was davon kommt in die Wäsche? Tippe auf den Korb am Teil. Wäsche-Teile schlägt die App erst wieder vor, wenn du sie zurücksetzt.</p>
        <div class="board-actions"><span class="worn-note">${ic('check')}Heute getragen</span><span class="grow"></span><button class="btn ghost sm" data-a="wear.undo" data-d="${d}">Rückgängig</button></div>`;
    } else if (!res.fav) {
      body = `<div class="empty">Für diesen Anlass findet die App gerade keine Kombination. Prüfe im Kleiderschrank, ob zu viele Teile in der Wäsche sind.</div>`;
    } else {
      const o = res.fav;
      const rated = S.wardrobe.ratings[o.key];
      const swapped = !!(S.wardrobe.choice || {})[d + ':' + occ];
      body = `${outfitView(o, d, opts)}
        <ul class="why">${o.reasons.concat(healthOutfitHint(d, ctx, o)).map(r => `<li>${esc(r)}</li>`).join('')}</ul>
        ${swapped ? '' : `<p class="swap-hint">${ic('refresh')}<span>Gefällt dir ein Teil nicht? Tausche nur dieses mit dem Pfeil, oder tippe es an und wähle selbst.</span></p>`}
        <div class="board-actions">
          ${isToday ? `<button class="btn olive" data-a="wear" data-d="${d}" data-k="${esc(o.key)}">${ic('check')}Heute getragen</button>` : ''}
          <button class="btn quiet" data-a="reroll" data-d="${d}">${ic('refresh')}Anderer Vorschlag</button>
          <span class="grow"></span>
          <button class="icon-btn" data-a="rate" data-d="${d}" data-k="${esc(o.key)}" data-v="1" aria-pressed="${rated === 1}" aria-label="Gefällt mir" title="Gefällt mir">${ic('up')}</button>
          <button class="icon-btn" data-a="rate" data-d="${d}" data-k="${esc(o.key)}" data-v="-1" aria-pressed="${rated === -1}" aria-label="Passt nicht, nicht mehr vorschlagen" title="Passt nicht">${ic('down')}</button>
        </div>
        ${res.alts.length ? `<div class="alts">${res.alts.map((a, i) => `<button class="alt" data-a="pick" data-d="${d}" data-k="${esc(a.key)}" aria-label="Alternative ${i + 1} übernehmen"><div class="alt-label"><span>Alternative ${i + 1}</span><span>übernehmen</span></div>${layout(a, { small: true })}<p class="alt-items">${itemsLine(a)}</p></button>`).join('')}</div>` : ''}`;
    }
    return body;
  }

  function healthOutfitHint(d, ctx, o) {
    if (d !== E.today() || !S.health) return [];
    const x = S.health.days[d] || S.health.days[E.addDays(d, -1)];
    if (!x || !x.sym) return [];
    const throat = x.sym.hals_kratzen || x.sym.hals_schmerz, nose = x.sym.nase_lauf || x.sym.nase_zu;
    if (!(throat || nose) || ctx.tOut >= 14) return [];
    const hasScarf = E.outfitIds(o).some(id => { const it = item(id); return it && /schal/i.test(it.label || ''); });
    if (hasScarf) return [throat ? 'Halskratzen gemeldet: Schal gut schließen.' : 'Erkältungsanzeichen gemeldet: Hals warm halten.'];
    return [throat ? 'Halskratzen gemeldet: Schal einpacken und den Hals warm halten.' : 'Erkältungsanzeichen gemeldet: Schal einpacken.'];
  }

  // ---------- Header bits ----------
  function dayPill(d) {
    const t = S.settings.week[E.weekday(d)] || 'frei';
    const m = { buero: ['office', 'Bürotag'], ho: ['home', 'Homeoffice'], frei: ['free', 'Frei'] }[t];
    return `<span class="day-pill">${ic(m[0])}${m[1]}</span>`;
  }
  function wxLine(d) {
    const ctx = ctxFor(d);
    if (ctx.src === 'wetter' && ctx.home) {
      const w = ctx.home;
      const r = ctx.rain >= 40 ? `<span class="small">Regen bis ${Math.round(ctx.rain / 10) * 10} %</span>` : '';
      return `<span class="wx">${wxIcon(w.code)}<span class="wx-temp num">${round(w.tMin)} bis ${round(w.tMax)}</span><span class="small ink2">gefühlt ${round(ctx.tOut)} am Morgen${ctx.office ? ', ' + round(ctx.office.aDay) + ' am Büro' : ''}</span>${r}</span>`;
    }
    if (ctx.src === 'manuell') return `<span class="wx">${ic('timer')}<span class="small">Temperatur manuell: ${round(ctx.tOut)}</span></span>`;
    return `<span class="wx small ink2">${ic('cloud')}${ui.wxError ? 'Wetter gerade nicht erreichbar' : 'Wetter wird geladen'}, gerechnet mit ${round(ctx.tOut)}</span>`;
  }
  function weekStrip(d) {
    const ws = E.weekStart(d);
    const cells = [];
    for (let i = 0; i < 7; i++) {
      const x = E.addDays(ws, i);
      const gym = S.training.sessions.some(s => !s.imported && s.date === x);
      const run = S.training.runs.some(r => r.date === x);
      const rt = S.training.routineLog.some(r => r.date === x && (r.id === 'haltung' || r.id === 'dehnen'));
      const lbl = [gym && 'Krafttraining', run && 'Laufen', rt && 'Dehnen'].filter(Boolean).join(', ');
      cells.push(`<div class="wd${x === d ? ' today' : ''}${x < d ? ' past' : ''}" title="${E.fmtLong(x)}${lbl ? ': ' + lbl : ''}" aria-label="${E.fmtLong(x)}${lbl ? ': ' + lbl : ''}"><span>${E.WD[E.weekday(x)]}</span><b class="num">${E.parse(x).getDate()}</b><span class="marks">${gym ? ic('training', 'mk-gym') : ''}${run ? ic('run', 'mk-run') : ''}${rt ? ic('check', 'mk-routine') : ''}</span></div>`);
    }
    return `<div class="week" aria-label="Diese Woche">${cells.join('')}</div>`;
  }
  function backupNote() {
    const m = S.meta, lb = m.lastBackup, r = m.restored;
    // Storage nearly full (2.14): goes before every other note
    const full = Math.round(lsUsed() / LS_MAX * 100);
    if (full >= 85) return `<div class="note" style="margin-bottom:20px" data-note="storage">${ic('alert')}<div class="grow">Der Speicher für deine Einträge auf diesem Gerät ist zu ${full} % voll. Speichere ein Backup, damit nichts verloren geht.</div><button class="btn sm quiet" data-a="backup.export">Backup speichern</button></div>`;
    const age = lb ? E.diffDays(lb, E.today()) : E.diffDays(m.setup || E.today(), E.today());
    if (!lb && m.dismissed.welcome !== true) {
      return `<div class="note info" style="margin-bottom:20px">${ic('info')}<div class="grow"><b>Deine Daten bleiben ${WEB ? 'auf diesem Gerät' : 'in diesem Browser auf deinem PC'}.</b> Speichere ab und zu ein Backup (Einstellungen), dann ist nichts verloren, falls Browserdaten gelöscht werden.</div><button class="btn sm quiet" data-a="backup.export">Backup speichern</button><button class="icon-btn" data-a="dismiss" data-k="welcome" aria-label="Hinweis schließen">${ic('x')}</button></div>`;
    }
    // Second device (K39): its data came per backup from the main device
    if (r && !isMain()) {
      const main = DEV_NAME[mainDevice()];
      if (unsaved()) return `<div class="note" style="margin-bottom:20px" data-note="device">${ic('alert')}<div class="grow">Du hast hier etwas geändert, das am ${main} noch fehlt (zuletzt ${stamp(m.changedAt)}). Speichere ein Backup und spiel es am ${main} ein.</div><button class="btn sm quiet" data-a="backup.export">Backup speichern</button></div>`;
      if (r.exported && E.diffDays(dayOf(r.exported), E.today()) >= 1) {
        const src = devOf(r.from) && r.from !== DEVICE ? 'Daten vom ' + DEV_NAME[r.from] + ', Stand: ' : 'Datenstand: ';
        return `<div class="note info" style="margin-bottom:20px" data-note="device">${ic('info')}<div class="grow">${src}${stamp(r.exported)}. Spiel vor neuen Einträgen ein frisches Backup vom ${main} ein.</div><label class="btn sm quiet">${ic('upload')}Backup einspielen<input type="file" accept=".json,application/json" data-c="backup.import" class="sr"></label></div>`;
      }
      return '';
    }
    if (m.changedAt && !unsaved()) return '';
    if (age >= 14) return `<div class="note" style="margin-bottom:20px">${ic('alert')}<div class="grow">${lb ? 'Dein letztes Backup ist ' + age + ' Tage alt.' : 'Du hast noch kein Backup gespeichert.'} Ein Klick genügt.</div><button class="btn sm quiet" data-a="backup.export">Backup speichern</button></div>`;
    return '';
  }

  // ---------- Heute ----------
  function viewHeute() {
    const d = E.today();
    return `<div class="page">
      <header class="page-head">
        <div><h1 class="page-title">${E.fmtLong(d)}</h1><div class="page-sub">${dayPill(d)}${warnPill(d)}${wxLine(d)}${envLine(d)}</div></div>
        ${weekStrip(d)}
      </header>
      ${backupNote()}
      ${reviewToday(d)}
      ${tripToday(d)}
      <div class="today-grid">
        <div>${board(d, { fold: true })}</div>
        <div class="ledger">
          <section class="fsec">${checkinToday(d)}</section>
          <section class="fsec">${remindersToday(d)}</section>
          <section class="fsec">${trainingToday(d)}</section>
        </div>
      </div>
    </div>`;
  }
  function goalRow(label, n, goal, cls) {
    const p = Math.min(100, Math.round(n / Math.max(1, goal) * 100));
    return `<div class="goal-row"><span>${label}</span><div class="meter ${cls || ''}" role="meter" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${n}" aria-label="${label}"><i style="width:${p}%"></i></div><span class="num small ink2">${n} von ${goal}</span></div>`;
  }
  function trainingToday(d) {
    const wc = E.weekCounts(S, d), g = S.settings.goals;
    const act = S.training.active;
    const np = S.training.plans.find(p => p.id === E.nextPlan(S));
    const last = E.sessionsSorted(S).find(s => !s.imported);
    const t = S.settings.week[E.weekday(d)];
    const breaks = S.training.routineLog.filter(r => r.date === d && r.id === 'buero').length;
    const stretched = S.training.routineLog.some(r => r.date === d && (r.id === 'haltung' || r.id === 'dehnen'));
    const w = H.warning(S, d);
    const when = new Date().getHours() < 14 ? 'morgen' : 'abend';
    let main, hint = '', sum;
    if (act) {
      const min = Math.round((Date.now() - act.start) / 60000);
      sum = esc(act.name) + ' läuft seit ' + minText(min);
      main = `<a class="btn block" href="#/training/session">${ic('play')}Training fortsetzen</a><p class="small muted" style="margin-top:6px">${esc(act.name)} läuft seit ${minText(min)}.</p>`;
    } else if (w.level === 'schonen' || w.level === 'arzt') {
      sum = 'Heute kein Krafttraining, sanftes Dehnen geht';
      hint = `<div class="warn-mini wp-stop" style="margin-bottom:10px">${ic('alert')}<div><b>Heute kein Krafttraining.</b> Dein Körper braucht die Energie gerade für die Abwehr. Sanftes Dehnen geht, wenn du dich danach fühlst.</div></div>`;
      main = `<button class="btn quiet block" data-a="pl.quick" data-k="${when}">${ic('stretch')}Sanft dehnen, 10 Minuten</button>`;
    } else if (w.level === 'achtung') {
      sum = 'Heute lieber locker: Dehnen oder kurzes Heimtraining';
      hint = `<div class="warn-mini wp-warn" style="margin-bottom:10px">${ic('alert')}<div><b>Erste Anzeichen:</b> Heute lieber locker. Dehnen oder ein kurzes Heimtraining statt schwerer Gewichte.</div></div>`;
      main = `<button class="btn block" data-a="pl.quick" data-k="${when}">${ic('stretch')}Dehnen, 10 Minuten</button><button class="btn quiet block" style="margin-top:8px" data-a="session.start" data-plan="${np.id}">${ic('play')}Trotzdem ${esc(np.name)}</button>`;
    } else {
      sum = 'Als Nächstes: ' + esc(np.name);
      main = `<button class="btn block" data-a="session.start" data-plan="${np.id}">${ic('play')}${esc(np.name)} starten</button><p class="small muted" style="margin-top:6px">Ca. ${np.minutes} Minuten. ${last ? 'Letztes Training: ' + esc(last.name) + ' ' + E.fmtRel(last.date) + '.' : 'Dein erstes Training mit dem neuen Plan.'}</p>`;
    }
    const meta = `<span class="fold-badge" title="Krafttraining diese Woche">Kraft ${wc.gym} von ${g.gym}</span>`;
    const sum2 = `<span class="fs-line">${sum}</span><span class="fs-line">${proteinSum(d)}</span>`;
    return fold('training', 'Training', sum2, meta, () => `<h3 class="mini-h" style="margin-top:0">Diese Woche, KW ${E.isoWeek(d)}</h3>
      <div style="margin-bottom:14px">${goalRow('Kraft', wc.gym, g.gym)}${goalRow('Laufen', wc.run, g.run, 'olive')}${goalRow('Dehnen', wc.routine, g.routine)}</div>
      ${hint}${main}
      <div class="row wrap" style="margin-top:10px">
        ${w.level === 'ruhig' && !act ? `<a class="btn sm quiet" href="#/training/zuhause">${ic('home')}Heimtraining</a>` : ''}
        ${w.level === 'ruhig' || act ? `<button class="btn sm quiet" data-a="pl.quick" data-k="${when}">${stretched ? ic('check') : ic('stretch')}${stretched ? 'Gedehnt' : 'Dehnen, 10 Min.'}</button>` : ''}
        <button class="btn sm quiet" data-a="run.open">${ic('run')}Lauf eintragen</button>
        ${t === 'buero' ? `<button class="btn sm quiet" data-a="pl.preset" data-k="buero">Büro-Pause${breaks ? ' (' + breaks + '× heute)' : ''}</button>` : ''}
      </div>
      ${proteinBlock(d)}`);
  }
  function dueText(du) {
    if (du.state === 'unknown') return 'Datum fehlt';
    if (du.diff < 0) return 'seit ' + (-du.diff) + (du.diff === -1 ? ' Tag' : ' Tagen') + ' fällig';
    if (du.diff === 0) return 'heute fällig';
    return 'fällig ' + E.fmtRel(du.date);
  }
  function checkRow(t, done, kind, d, meta, compact) {
    const metaCls = /seit/.test(meta) ? 'over' : /heute/.test(meta) ? 'due' : '';
    return `<li class="${done ? 'done' : ''}"><button class="check" data-a="care.done" data-id="${t.id}" data-d="${d}" aria-pressed="${done}" aria-label="${esc(t.name)} ${done ? 'erledigt' : 'abhaken'}">${ic('check')}</button>
      <div class="check-body"><div class="check-name">${esc(t.name)}</div>${meta ? `<div class="check-meta ${metaCls}">${esc(meta)}</div>` : ''}
      ${t.how && !compact ? `<details class="how"><summary>Wie und womit</summary><p class="how-text">${esc(t.how)}</p>${t.with ? `<p class="how-with">Womit: ${esc(t.with)}</p>` : ''}</details>` : ''}</div></li>`;
  }
  // ---------- Training ----------
  const trTabs = sub => `<nav class="tabs" aria-label="Training">${[['', 'Gym-Plan'], ['zuhause', 'Zuhause und Dehnen'], ['ernaehrung', 'Ernährung'], ['verlauf', 'Verlauf'], ['fortschritt', 'Fortschritt']].map(([k, l]) => `<a href="#/training${k ? '/' + k : ''}" aria-current="${(sub || '') === k ? 'page' : 'false'}">${l}</a>`).join('')}</nav>`;
  function viewTraining(sub) {
    if (sub === 'session') return viewSession();
    if (sub === 'dehnen') return viewPlayer();
    const head = `<header class="page-head"><div><h1 class="page-title">Training</h1><p class="page-sub">${S.settings.goals.gym}× Ganzkörper pro Woche, 60 % Haltung und 40 % Aufbau.${S.settings.goals.run ? ' Dazu ' + S.settings.goals.run + '× Laufen und regelmäßig dehnen.' : ' Dazu regelmäßig dehnen.'} Ohne Gym geht es mit Kurzhanteln zu Hause.</p></div></header>`;
    let body;
    if (sub === 'zuhause') body = viewHome();
    else if (sub === 'verlauf') body = viewHistory();
    else if (sub === 'fortschritt') body = viewProgress();
    else if (sub === 'ernaehrung') body = viewNutrition();
    else body = viewPlans();
    return `<div class="page">${head}${trTabs(sub)}${body}</div>`;
  }
  function doseText(ex) { return ex.sets + ' × ' + ex.repMin + '–' + ex.repMax + (ex.type === 'time' ? ' s' : '') + (ex.perSide ? ' je Seite' : ''); }
  function kgText(kg, ex) { if (ex.type === 'time') return ''; if (!kg) return 'Körpergewicht'; return n0(kg) + ' ' + (ex.unit === 'kg je Hand' ? 'kg je Hand' : 'kg'); }
  function viewPlans() {
    const act = S.training.active;
    const next = E.nextPlan(S);
    const plans = S.training.plans.map(p => {
      let prevSs = null;
      const lis = p.items.map(it => {
        const ex = exById(it.ex); const sg = E.suggestion(S, ex);
        const ssStart = it.ss && it.ss !== prevSs; prevSs = it.ss;
        const guess = sg.state === 'start' && ex.estimate && ex.type !== 'time';
        return `<li class="has-edit${it.ss ? ' ss-bar' : ''}"><div><div class="ex-name"><span class="focus-dot focus-${ex.focus}" aria-hidden="true"></span>${esc(ex.name)}${it.optional ? ' <span class="tag">optional</span>' : ''}${ssStart ? ' <span class="tag denim">Supersatz</span>' : ''}</div><div class="ex-where">${esc(ex.where)}</div></div>
          <div><div class="ex-dose">${doseText(ex)}</div><div class="ex-next${sg.state === 'up' ? ' up' : ''}">${ex.type === 'time' ? 'nächstes Mal ' + sg.reps + ' s' : (sg.state === 'up' ? 'nächstes Mal ' : '') + kgText(sg.kg, ex)}</div>${guess ? '<div class="ex-next guess">geschätzt</div>' : ''}</div>
          <button class="icon-btn ex-edit" data-a="ex.edit" data-id="${ex.id}" aria-label="${esc(ex.name)} anpassen" title="Gerät und Startgewicht">${ic('edit')}</button></li>`;
      }).join('');
      return `<article class="plan-card"><div class="row" style="align-items:flex-start"><div class="grow"><h2 class="plan-name">${esc(p.name)}</h2><p class="plan-focus">${esc(p.focus)}, ca. ${p.minutes} Minuten</p></div>${p.id === next && !act ? '<span class="tag olive">als Nächstes</span>' : ''}</div>
        <ul class="ex-list">${lis}</ul>
        ${act ? (act.plan === p.id ? `<a class="btn block" href="#/training/session">Training fortsetzen</a>` : '') : `<button class="btn${p.id === next ? '' : ' quiet'} block" data-a="session.start" data-plan="${p.id}">${ic('play')}${esc(p.name)} starten</button>`}</article>`;
    }).join('');
    const legend = `<div class="legend" style="margin:-8px 0 18px"><span><span class="sw" style="background:var(--c2)"></span>Haltung</span><span><span class="sw" style="background:var(--c1)"></span>Aufbau</span><span class="muted">Supersatz: die Übungen abwechselnd, Pause erst nach beiden.</span></div>`;
    const r = S.training.routines;
    const lastRun = S.training.runs.slice().sort((a, b) => a.date < b.date ? 1 : -1)[0];
    return `${act ? `<div class="note info" style="margin-bottom:18px">${ic('timer')}<div class="grow">${esc(act.name)} läuft.</div><a class="btn sm" href="#/training/session">Fortsetzen</a></div>` : ''}
      ${legend}<div class="two-col">${plans}</div>
      <h2 class="block-title">Aufwärmen vor jedem Training, ca. 5 Minuten</h2>
      <div class="panel"><ul class="checklist warm">${S.training.warmup.map(w => `<li><div class="check-body"><div class="check-name">${esc(w.name)} <span class="muted num">${esc(w.dose)}</span></div><div class="check-meta">${esc(w.cue)}</div></div></li>`).join('')}</ul></div>
      <h2 class="block-title">Zwischendurch</h2>
      <div class="three-col">
        ${['haltung', 'buero'].map(k => `<div class="panel"><h3 style="font-size:18px;font-stretch:82%">${esc(r[k].name)}</h3><p class="small muted">${r[k].minutes} Minuten, ${esc(r[k].where)}</p><ul class="checklist" style="margin:10px 0 14px">${r[k].items.map(x => `<li><div class="check-body"><div class="check-name">${esc(x.name)} <span class="muted num">${esc(x.dose)}</span></div></div></li>`).join('')}</ul><div class="row wrap"><button class="btn sm quiet" data-a="pl.preset" data-k="${k}">${ic('play')}Mit Timer starten</button><button class="btn sm ghost" data-a="routine.open" data-id="${k}">Abhaken</button></div></div>`).join('')}
        <div class="panel"><h3 style="font-size:18px;font-stretch:82%">Laufen</h3><p class="small muted">1× pro Woche, locker</p>
          <p class="small ink2" style="margin:10px 0">Locker laufen, so dass du dich noch unterhalten kannst; 25 bis 40 Minuten reichen. Bei Knick-, Senk- und Spreizfüßen lohnt ein Laufschuh mit leichter Stütze. Lass dich im Fachhandel oder beim Orthopäden beraten, ob Einlagen sinnvoll sind.</p>
          <p class="small muted" style="margin-bottom:12px">${lastRun ? 'Letzter Lauf: ' + E.fmtRel(lastRun.date) + ', ' + lastRun.min + ' Min.' + (lastRun.km ? ', ' + n0(lastRun.km) + ' km' : '') : 'Noch kein Lauf eingetragen.'}</p>
          <button class="btn sm quiet" data-a="run.open">${ic('run')}Lauf eintragen</button></div>
      </div>`;
  }

  function viewSession() {
    const a = S.training.active;
    if (!a) return `<div class="page"><div class="empty">Gerade läuft kein Training. <a href="#/training">Zum Plan</a></div></div>`;
    const done = a.entries.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
    const total = a.entries.reduce((n, e) => n + e.sets.length, 0);
    const warmDone = Object.keys(a.warm || {}).length;
    const WU = warmupFor(a);
    let prevSs = null;
    const blocks = a.entries.map((e, ei) => {
      const ex = exById(e.ex);
      const sg = e.sugg || E.suggestion(S, ex);
      const last = E.lastEntry(S, ex.id);
      const ssStart = e.ss && e.ss !== prevSs; prevSs = e.ss;
      const alts = [ex.id, ...(exById(e.orig || e.ex).alts || [])].filter((v, i, arr) => arr.indexOf(v) === i);
      const origAlts = (exById(e.orig || e.ex).alts || []);
      const swapOpts = [e.orig || e.ex, ...origAlts].filter((v, i, arr) => arr.indexOf(v) === i);
      const time = ex.type === 'time';
      const rows = e.sets.map((st, si) => `
        <span class="set-no${st.done ? ' set-done' : ''}"><span class="sl">Satz </span>${si + 1}</span>
        <span class="${st.done ? 'set-done' : ''}">${time ? '<span class="muted small">—</span>' : `<input class="num-in" type="number" inputmode="decimal" step="0.5" min="0" value="${st.kg === '' || st.kg == null ? '' : st.kg}" placeholder="${sg.kg || 0}" data-i="set.kg" data-e="${ei}" data-s="${si}" aria-label="${esc(ex.name)} Satz ${si + 1} Gewicht in kg">`}</span>
        <span class="${st.done ? 'set-done' : ''}"><input class="num-in" type="number" inputmode="numeric" min="0" value="${st.reps == null ? '' : st.reps}" placeholder="${sg.reps}" data-i="set.reps" data-e="${ei}" data-s="${si}" aria-label="${esc(ex.name)} Satz ${si + 1} ${time ? 'Sekunden' : 'Wiederholungen'}"></span>
        <button class="check" data-a="set.done" data-e="${ei}" data-s="${si}" aria-pressed="${!!st.done}" aria-label="Satz ${si + 1} ${st.done ? 'erledigt' : 'abhaken'}">${ic('check')}</button>
        <span class="set-last">${last && last.sets[si] ? 'zuletzt ' + (time ? last.sets[si].reps + ' s' : n0(last.sets[si].kg) + ' × ' + last.sets[si].reps) : ''}</span>`).join('');
      return `<article class="exb${e.ss ? ' ss' : ''}" id="ex-${ei}">
        <div class="exb-head"><div class="grow"><h2 class="exb-name">${esc(ex.name)}</h2><p class="small muted">${esc(ex.where)}, ${doseText(ex)}${e.optional ? ', optional' : ''}${ssStart ? ', Supersatz mit der nächsten Übung' : ''}</p></div>
          <a class="icon-btn" href="https://www.youtube.com/results?search_query=${encodeURIComponent(ex.name + ' Ausführung')}" target="_blank" rel="noopener" aria-label="Video zur Ausführung suchen" title="Video zur Ausführung">${ic('ext')}</a></div>
        <p class="exb-cue">${esc(ex.cue || '')}</p>
        <div class="sugg${sg.state === 'up' ? ' up' : ''}">${sg.state === 'up' ? ic('up') : ic('info')}<span>Vorschlag: <b>${time ? sg.reps + ' s' : kgText(sg.kg, ex) + ' × ' + sg.reps}</b>. ${esc(sg.why)}</span></div>
        <div class="sets"><span class="h">Satz</span><span class="h">${time ? '' : 'kg'}</span><span class="h">${time ? 'Sek.' : 'Wdh.'}</span><span class="h"></span><span class="h last">Letztes Mal</span>${rows}</div>
        <div class="exb-foot">
          <button class="btn sm ghost" data-a="set.add" data-e="${ei}">${ic('plus')}Satz</button>
          ${e.sets.length > 1 ? `<button class="btn sm ghost" data-a="set.remove" data-e="${ei}">${ic('minus')}Satz</button>` : ''}
          ${swapOpts.length > 1 ? `<label class="btn sm ghost" style="gap:6px">${ic('swap')}<span class="sr">Übung tauschen</span><select data-c="ex.swap" data-e="${ei}" style="border:0;background:transparent;font-weight:560" aria-label="Übung tauschen">${swapOpts.map(id => `<option value="${id}"${id === e.ex ? ' selected' : ''}>${id === e.ex ? 'Übung tauschen' : esc(exById(id).name)}</option>`).join('')}</select></label>` : ''}
        </div>
      </article>`;
    }).join('');
    return `<div class="page">
      <div class="session-head"><div class="grow"><h1 class="session-title">${esc(a.name)}</h1><p class="small muted"><span data-clock class="num">${minText(+clockText())}</span>, ${done} von ${total} Sätzen</p></div>
        <button class="btn ghost sm" data-a="session.discard">Verwerfen</button><button class="btn" data-a="session.finish">Training beenden</button></div>
      <details class="panel" style="margin-bottom:14px"${warmDone < WU.length ? ' open' : ''}><summary style="cursor:pointer;font-weight:620">Aufwärmen <span class="muted small num">${warmDone} von ${WU.length}</span></summary>
        <ul class="checklist" style="margin-top:8px">${WU.map((w, i) => `<li class="${a.warm && a.warm[i] ? 'done' : ''}"><button class="check" data-a="warm" data-i="${i}" aria-pressed="${!!(a.warm && a.warm[i])}" aria-label="${esc(w.name)}">${ic('check')}</button><div class="check-body"><div class="check-name">${esc(w.name)} <span class="muted num">${esc(w.dose)}</span></div><div class="check-meta">${esc(w.cue)}</div></div></li>`).join('')}</ul></details>
      ${blocks}
      <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn" data-a="session.finish">Training beenden</button></div>
    </div>`;
  }
  function warmupFor(a) {
    if (a.plan !== 'home') return S.training.warmup;
    return S.training.warmup.map(w => /face pull/i.test(w.name) ? { name: 'Reverse Fly ohne Gewicht', dose: '15×', cue: 'Leicht vorgebeugt, Arme seitlich öffnen, Schulterblätter zusammenziehen.' } : w);
  }
  function clockText() { const a = S.training.active; if (!a) return '0'; return String(Math.floor((Date.now() - a.start) / 60000)); }

  function viewHistory() {
    const items = [];
    for (const s of S.training.sessions) items.push({ date: s.date, kind: 'gym', s });
    for (const r of S.training.runs) items.push({ date: r.date, kind: 'run', r });
    const rl = {};
    for (const r of S.training.routineLog) { const k = r.date + r.id; rl[k] = rl[k] || { date: r.date, kind: 'routine', id: r.id, n: 0, min: 0 }; rl[k].n++; rl[k].min += +r.min || 0; }
    items.push(...Object.values(rl));
    items.sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : 0);
    if (!items.length) return `<div class="empty">Noch nichts eingetragen.</div>`;
    return `<div class="panel" style="padding:4px 20px"><ul class="checklist">${items.map(x => {
      if (x.kind === 'gym') {
        const st = E.sessionStats(x.s, S.training.exercises);
        return `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--c1)">${ic('training')}</span><div class="check-body"><div class="check-name">${esc(x.s.name)}</div><div class="check-meta">${E.fmtDate(x.date)}, ${st.sets} Sätze, Volumen ${n0(st.vol, 0)} kg${x.s.minutes ? ', ' + x.s.minutes + ' Min.' : ''}</div>
          <details class="how"><summary>Details</summary><table class="tbl"><tbody>${x.s.entries.filter(e => e.sets.some(s => s.done)).map(e => `<tr><td>${esc((exById(e.ex) || { name: e.ex }).name)}</td><td class="r">${e.sets.filter(s => s.done).map(s => (exById(e.ex) || {}).type === 'time' ? s.reps + ' s' : n0(s.kg) + ' × ' + s.reps).join(', ')}</td></tr>`).join('')}</tbody></table></details></div>
          ${x.s.imported ? '' : `<button class="icon-btn" data-a="session.delete" data-id="${x.s.id}" aria-label="Training löschen">${ic('trash')}</button>`}</li>`;
      }
      if (x.kind === 'run') return `<li><span class="check" aria-hidden="true" style="box-shadow:none;color:var(--c2)">${ic('run')}</span><div class="check-body"><div class="check-name">Laufen</div><div class="check-meta">${E.fmtDate(x.date)}, ${x.r.min} Min.${x.r.km ? ', ' + n0(x.r.km) + ' km' : ''}${x.r.feel ? ', ' + esc(x.r.feel) : ''}</div></div><button class="icon-btn" data-a="run.delete" data-id="${x.r.id}" aria-label="Lauf löschen">${ic('trash')}</button></li>`;
      // The stretching player logs 'dehnen' for the morning and evening programmes, which have no routine of their own
      const rn = (S.training.routines[x.id] || {}).name || (x.id === 'dehnen' ? 'Dehnen' : x.id);
      return `<li><span class="check" aria-hidden="true" style="box-shadow:none">${ic('check')}</span><div class="check-body"><div class="check-name">${esc(rn)}${x.n > 1 ? ' ' + x.n + '×' : ''}</div><div class="check-meta">${E.fmtDate(x.date)}${x.min ? ', ' + x.min + ' Min.' : ''}</div></div></li>`;
    }).join('')}</ul></div>`;
  }

  // ---------- Charts ----------
  function niceTicks(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= step0) || 10 * mag;
    const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step, t = [];
    for (let v = lo; v <= hi + 1e-9; v += step) t.push(+v.toFixed(6));
    return t;
  }
  const CHARTS = {};
  const tickFmt = (t, step) => n0(t, step < 1 ? (step < 0.1 ? 2 : 1) : 0);
  function tableHtml(head, rows) { return `<details class="table-view"><summary>Werte als Tabelle</summary><table class="tbl"><thead><tr>${head.map((h, i) => `<th${i ? ' class="r"' : ''}>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="r"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></details>`; }
  function lineChart(id, pts, opt) {
    if (!pts.length) return `<div class="empty small">Noch keine Daten.</div>`;
    CHARTS[id] = { type: 'line', pts, opt };
    return `<div class="chart" data-chart="line" data-id="${id}" tabindex="0" role="img" aria-label="${esc(opt.label)}. Mit den Pfeiltasten durch die Werte gehen."><div class="tip" style="display:none"></div></div>` + tableHtml(['Datum', opt.col || 'Wert'], pts.map(p => [p.x, p.tip]));
  }
  function barChart(id, bars, opt) {
    CHARTS[id] = { type: 'bar', bars, opt };
    const series = opt.series || [{ key: 'v', color: 'var(--c1)', name: opt.name || '' }];
    const legend = series.length > 1 ? `<div class="legend">${series.map(se => `<span><span class="sw" style="background:${se.color}"></span>${esc(se.name)}</span>`).join('')}</div>` : '';
    return `<div class="chart" data-chart="bar" data-id="${id}" role="img" aria-label="${esc(opt.label)}"><div class="tip" style="display:none"></div></div>${legend}` +
      tableHtml([opt.xcol || 'Zeitraum', ...series.map(se => se.name || opt.label)], bars.map(b => [b.label, ...series.map(se => n0(b[se.key] || 0, 0) + (opt.unit || ''))]));
  }
  function lineSVG(c, W) {
    const { pts, opt } = c, H = opt.h || 220, L = 44, R = 64, T = 14, B = 28;
    const ys = pts.map(p => p.y), lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = Math.max((hi - lo) * 0.15, opt.pad || 1);
    const ticks = niceTicks(lo - pad, hi + pad, 4), step = ticks[1] - ticks[0];
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const X = i => pts.length === 1 ? L + (W - L - R) / 2 : L + i * (W - L - R) / (pts.length - 1);
    const Y = v => T + (H - T - B) * (1 - (v - y0) / (y1 - y0 || 1));
    let g = ticks.map(t => `<line class="gridline" x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis" x="${L - 8}" y="${Y(t) + 4}" text-anchor="end">${tickFmt(t, step)}</text>`).join('');
    const every = Math.max(1, Math.ceil(pts.length / Math.max(2, Math.floor((W - L - R) / 70))));
    g += pts.map((p, i) => (i % every === 0 || i === pts.length - 1) ? `<text class="axis" x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(p.x)}</text>` : '').join('');
    const d = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
    const area = d + ` L${X(pts.length - 1).toFixed(1)} ${Y(y0)} L${X(0).toFixed(1)} ${Y(y0)} Z`;
    const last = pts[pts.length - 1];
    c.pos = pts.map((p, i) => ({ x: X(i), y: Y(p.y), t: p.tip }));
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${g}
      ${pts.length > 1 ? `<path d="${area}" fill="var(--c1)" opacity=".1"/><path d="${d}" fill="none" stroke="var(--c1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
      ${pts.map((p, i) => `<circle cx="${X(i)}" cy="${Y(p.y)}" r="4" fill="var(--c1)" stroke="var(--surface)" stroke-width="2"/>`).join('')}
      <text class="endlabel" x="${X(pts.length - 1) + 10}" y="${Y(last.y) + 4}">${n0(last.y)} ${esc(opt.unit || '')}</text>
      <line class="xhair" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/></svg>`;
  }
  function barSVG(c, W) {
    const { bars, opt } = c, H = opt.h || 200, L = 36, R = 12, T = 18, B = 28;
    const series = opt.series || [{ key: 'v', color: 'var(--c1)', name: opt.name || '' }];
    const totals = bars.map(b => series.reduce((s2, se) => s2 + (b[se.key] || 0), 0));
    const maxV = Math.max(opt.goal || 0, ...totals, 1);
    const ticks = niceTicks(0, maxV, 3), y1 = ticks[ticks.length - 1], step = ticks[1] - ticks[0];
    const Y = v => T + (H - T - B) * (1 - v / y1);
    const slot = (W - L - R) / bars.length, bw = Math.min(24, slot * 0.6);
    const X = i => L + (i + 0.5) * slot;
    let g = ticks.map(t => `<line class="gridline" x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}"/><text class="axis" x="${L - 8}" y="${Y(t) + 4}" text-anchor="end">${tickFmt(t, step)}</text>`).join('');
    g += `<line class="baseline" x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}"/>`;
    const every = Math.max(1, Math.ceil(bars.length / Math.max(2, Math.floor((W - L - R) / 46))));
    const marks = bars.map((b, i) => {
      let acc = 0, out = '';
      const segs = series.filter(se => b[se.key] > 0);
      segs.forEach((se, si) => {
        const v = b[se.key], y = Y(acc + v), hh = Math.max(0, Y(acc) - Y(acc + v) - (si > 0 ? 2 : 0));
        const x = X(i) - bw / 2, top = si === segs.length - 1, r = Math.min(4, hh);
        out += top && hh > 0 ? `<path d="M${x} ${y + hh} V${y + r} Q${x} ${y} ${x + r} ${y} H${x + bw - r} Q${x + bw} ${y} ${x + bw} ${y + r} V${y + hh} Z" fill="${se.color}"/>` : `<rect x="${x}" y="${y}" width="${bw}" height="${hh}" fill="${se.color}"/>`;
        acc += v;
      });
      const tip = series.map(se => (se.name ? se.name + ' ' : '') + n0(b[se.key] || 0, 0) + (opt.unit || '')).join(', ');
      return `<g class="bar" data-tip="${esc(b.label + ': ' + tip)}" tabindex="0" aria-label="${esc(b.label + ': ' + tip)}">${out}<rect x="${X(i) - slot / 2}" y="${T}" width="${slot}" height="${H - T - B}" fill="transparent"/></g>` +
        (i % every === 0 ? `<text class="axis" x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(b.short || b.label)}</text>` : '');
    }).join('');
    const goal = opt.goal ? `<line class="goal" x1="${L}" x2="${W - R}" y1="${Y(opt.goal)}" y2="${Y(opt.goal)}"/><text class="goal-label" x="${W - R}" y="${Y(opt.goal) - 6}" text-anchor="end">Ziel ${opt.goal}${opt.unit || ''}</text>` : '';
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">${g}${goal}${marks}</svg>`;
  }
  // Chart renderers by type; modules add their own (matrix, stack)
  const SVGR = { line: (c, W) => lineSVG(c, W), bar: (c, W) => barSVG(c, W) }, HOVER = {};
  // Tooltip next to a point, kept inside the chart box
  function placeTip(el, tip, x, y, lines) {
    tip.textContent = '';
    (Array.isArray(lines) ? lines : [lines]).forEach((l, i) => { const n = document.createElement(i ? 'div' : 'b'); n.textContent = l; tip.appendChild(n); });
    tip.style.display = '';
    const w = tip.offsetWidth, W = el.clientWidth;
    tip.style.left = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, x)) + 'px'; tip.style.top = y + 'px';
  }
  function wireCharts() {
    document.querySelectorAll('.chart[data-id]').forEach(el => {
      const c = CHARTS[el.dataset.id]; if (!c || !SVGR[c.type]) return;
      const W = Math.max(260, Math.floor(el.clientWidth));
      const old = el.querySelector('svg'); if (old) old.remove();
      el.insertAdjacentHTML('afterbegin', SVGR[c.type](c, W));
      const tip = el.querySelector('.tip');
      if (el.dataset.wired) return;
      el.dataset.wired = '1';
      if (HOVER[c.type]) HOVER[c.type](el, tip);
      else if (c.type === 'line' || c.type === 'stack') {
        let idx = c.pos ? c.pos.length - 1 : 0;
        const show = i => {
          const C0 = CHARTS[el.dataset.id], pos = C0 && C0.pos; if (!pos || !pos.length) return; idx = Math.max(0, Math.min(pos.length - 1, i));
          const p = pos[idx], xh = el.querySelector('.xhair');
          xh.setAttribute('x1', p.x); xh.setAttribute('x2', p.x); xh.style.display = '';
          placeTip(el, tip, p.x, p.y, p.t);
        };
        const hide = () => { tip.style.display = 'none'; const xh = el.querySelector('.xhair'); if (xh) xh.style.display = 'none'; };
        el.addEventListener('pointermove', ev => { const C0 = CHARTS[el.dataset.id]; if (!C0 || !C0.pos) return; const r = el.getBoundingClientRect(); const x = ev.clientX - r.left; let best = 0, bd = 1e9; C0.pos.forEach((p, i) => { const dd = Math.abs(p.x - x); if (dd < bd) { bd = dd; best = i; } }); show(best); });
        el.addEventListener('pointerleave', hide); el.addEventListener('blur', hide); el.addEventListener('focus', () => show(idx));
        el.addEventListener('keydown', ev => { if (ev.key === 'ArrowLeft') { show(idx - 1); ev.preventDefault(); } if (ev.key === 'ArrowRight') { show(idx + 1); ev.preventDefault(); } });
      } else {
        const show = g => { const r = el.getBoundingClientRect(), br = g.getBoundingClientRect(); placeTip(el, tip, br.left - r.left + br.width / 2, br.top - r.top + Math.min(12, br.height / 2), g.dataset.tip); };
        el.addEventListener('pointerover', ev => { const g = ev.target.closest('[data-tip]'); if (g) show(g); });
        el.addEventListener('focusin', ev => { const g = ev.target.closest('[data-tip]'); if (g) show(g); });
        el.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
        el.addEventListener('focusout', () => { tip.style.display = 'none'; });
      }
    });
  }
  function viewProgress() {
    const planEx = [...new Set(S.training.plans.flatMap(p => p.items.map(i => i.ex)))];
    const withData = Object.keys(S.training.exercises).filter(id => E.series(S, id).length);
    const ids = [...new Set([...planEx.filter(id => E.series(S, id).length), ...withData])];
    if (!ui.prog || !ids.includes(ui.prog)) ui.prog = ids.includes('latpull') ? 'latpull' : ids[0];
    const ex = exById(ui.prog);
    const pts = ex ? E.series(S, ex.id).map(p => ({ x: E.fmtShort(p.date), y: ex.type === 'time' ? p.reps : p.kg, tip: ex.type === 'time' ? p.reps + ' s' : n0(p.kg) + ' kg × ' + p.reps + (p.imported ? ' (importiert)' : '') })) : [];
    // weekly bars
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const ws = E.addDays(E.weekStart(E.today()), -7 * i), we = E.addDays(ws, 6);
      weeks.push({ label: 'KW ' + E.isoWeek(ws), short: 'KW ' + E.isoWeek(ws), gym: S.training.sessions.filter(s => !s.imported && s.date >= ws && s.date <= we).length, run: S.training.runs.filter(r => r.date >= ws && r.date <= we).length });
    }
    const bw = S.training.bodyweight.slice().sort((a, b) => a.date < b.date ? -1 : 1).map(b => ({ x: E.fmtShort(b.date), y: b.kg, tip: n0(b.kg) + ' kg am ' + E.fmtShort(b.date) }));
    const prot = [];
    for (let i = 13; i >= 0; i--) { const d = E.addDays(E.today(), -i); prot.push({ label: E.fmtShort(d), short: i % 2 ? '' : E.fmtShort(d), v: protTotal(d) }); }
    return `<div class="filters">${ids.map(id => `<button class="chip" data-a="prog" data-id="${id}" aria-pressed="${id === ui.prog}">${esc(exById(id).name)}</button>`).join('')}</div>
      <div class="panel"><h2 class="sec-title" style="margin-bottom:2px">${ex ? esc(ex.name) : ''}</h2><p class="small muted" style="margin-bottom:10px">${ex && ex.type === 'time' ? 'Längste Haltezeit je Training' : 'Schwerster Satz je Training, in kg'}</p>${lineChart('ex', pts, { label: ex ? ex.name + ', Verlauf' : '', unit: ex && ex.type === 'time' ? 's' : 'kg', col: 'Bester Satz' })}</div>
      <div class="two-col" style="margin-top:22px">
        <div class="panel"><h2 class="sec-title" style="margin-bottom:10px">Trainings pro Woche</h2>${barChart('weeks', weeks, { label: 'Trainings pro Woche', goal: S.settings.goals.gym + S.settings.goals.run, series: [{ key: 'gym', color: 'var(--c1)', name: 'Gym' }, { key: 'run', color: 'var(--c2)', name: 'Laufen' }], xcol: 'Woche' })}</div>
        <div class="panel"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h2 class="sec-title">Körpergewicht</h2><button class="btn sm quiet" data-a="weight.open">${ic('plus')}Eintragen</button></div>${lineChart('bw', bw, { label: 'Körpergewicht', unit: 'kg', col: 'Gewicht', pad: 0.5 })}</div>
      </div>
      <div class="panel" style="margin-top:22px"><div class="row" style="justify-content:space-between;margin-bottom:10px"><h2 class="sec-title">Eiweiß, letzte 14 Tage</h2><a class="btn sm quiet" href="#/training/ernaehrung">${ic('food')}Ernährung</a></div>${barChart('prot', prot, { label: 'Eiweiß pro Tag', goal: S.settings.proteinGoal, unit: ' g', xcol: 'Tag' })}</div>`;
  }

  // ---------- Pflege ----------
  function viewPflege(sub) {
    const tabs = `<nav class="tabs" aria-label="Pflege">${[['', 'Erinnerungen'], ['einkauf', 'Einkaufsliste']].map(([k, l]) => `<a href="#/pflege${k ? '/' + k : ''}" aria-current="${(sub || '') === k ? 'page' : 'false'}">${l}</a>`).join('')}</nav>`;
    const head = `<header class="page-head"><div><h1 class="page-title">Pflege</h1><p class="page-sub">Deine tägliche Routine läuft von allein. Hier erinnert dich die App an alles, was nur alle paar Tage oder Wochen dran ist.</p></div></header>`;
    return `<div class="page">${head}${tabs}${sub === 'einkauf' ? viewShop() : viewCare()}</div>`;
  }
  function viewShop() {
    const P = S.grooming.products;
    const need = P.filter(p => !p.have && !p.optional).length;
    return `<p class="lead" style="margin-bottom:16px">Naturkosmetik bekommst du in jeder Drogerie. Hake ab, was du schon hast. ${need ? 'Noch zu besorgen: ' + need + '.' : 'Du hast alles Nötige.'}</p>
      <div class="panel" style="padding:6px 20px"><ul class="checklist">${P.map(p => `<li class="${p.have ? 'done' : ''}"><button class="check" data-a="shop" data-id="${p.id}" aria-pressed="${!!p.have}" aria-label="${esc(p.name)}: ${p.have ? 'habe ich' : 'noch besorgen'}">${ic('check')}</button><div class="check-body"><div class="check-name">${esc(p.name)}${p.optional ? ' <span class="tag">optional</span>' : ''}</div>${p.note ? `<div class="check-meta">${esc(p.note)}</div>` : ''}</div></li>`).join('')}</ul></div>`;
  }

  // ---------- Outfit ----------
  function viewOutfit(sub) {
    const tabs = `<nav class="tabs" aria-label="Outfit">${[['', 'Vorschläge'], ['schrank', 'Kleiderschrank'], ['listen', 'Meine Outfits'], ['reisen', 'Reisen'], ['inspiration', 'Inspiration'], ['analyse', 'Analyse']].map(([k, l]) => `<a href="#/outfit${k ? '/' + k : ''}" aria-current="${(sub || '') === k ? 'page' : 'false'}">${l}</a>`).join('')}</nav>`;
    const head = `<header class="page-head"><div><h1 class="page-title">Outfit</h1><p class="page-sub">Smart Casual in Blau und Erdtönen, mit Lagen und Struktur für mehr Volumen.</p></div></header>`;
    let body;
    if (sub === 'schrank') body = viewWardrobe();
    else if (sub === 'listen') body = viewLists();
    else if (sub === 'analyse') body = viewAnalysis();
    else if (sub === 'inspiration') body = viewInspiration();
    else if (sub === 'reisen') body = viewTrips();
    else body = viewSuggest();
    return `<div class="page">${head}${tabs}${body}</div>`;
  }
  function viewSuggest() {
    const d = ui.oday === 'morgen' ? E.addDays(E.today(), 1) : E.today();
    const ctx = ctxFor(d);
    const ov = S.wardrobe.tempOverride[d];
    const outer = ctx.needWinter ? 'Winterjacke' : ctx.needCoat ? 'Mantel' : 'keine Jacke nötig';
    return `<div class="row wrap" style="margin-bottom:16px;gap:14px">${seg('Tag', [['heute', 'Heute'], ['morgen', 'Morgen']], ui.oday, { a: 'oday' })}
        <span class="small ink2">${ctx.src === 'wetter' ? 'Gerechnet mit ' + round(ctx.tOut) + ' gefühlt unterwegs und ' + round(ctx.tDay) + ' tagsüber' : ctx.src === 'manuell' ? 'Manuell: ' + round(ctx.tOut) : 'Ohne Wetterdaten: Durchschnitt für die Jahreszeit, ' + round(ctx.tOut)}. ${esc(outer)}.</span>
        <label class="small ink2 row" style="gap:6px">Temperatur selbst setzen <input type="number" class="inline-num" value="${ov == null ? '' : ov}" placeholder="°C" data-c="temp.set" data-d="${d}" aria-label="Temperatur in Grad selbst setzen"></label>
        ${ov != null ? `<button class="link-btn small" data-a="temp.clear" data-d="${d}">Wetter verwenden</button>` : ''}</div>
      ${board(d, { big: true })}
      <details class="panel" style="margin-top:18px"><summary style="cursor:pointer;font-weight:620">So entstehen die Vorschläge</summary>
        <ul class="how-text" style="margin:10px 0 0;padding-left:18px">
          <li>Alle sinnvollen Kombinationen aus deinem Schrank werden bewertet: Anlass, gefühlte Temperatur, Farben (Blau und Erdtöne bevorzugt, höchstens ein Akzent), Muster und Material.</li>
          <li>Pluspunkte gibt es für Lagen, strukturierte Stoffe und Hosen, die die Beine voller wirken lassen. Slim-Fit-Hosen bekommen Abzug.</li>
          <li>Kombinationen aus deiner Outfit-Liste und alles mit 👍 werden bevorzugt, 👎 wird nicht mehr vorgeschlagen.</li>
          <li>Was du in den letzten Tagen getragen hast oder in der Wäsche ist, rückt nach hinten.</li>
          <li>Jacke: unter ${S.settings.winterBelow}° gefühlt Winterjacke, unter ${S.settings.coatBelow}° Mantel${S.settings.coldSensitive ? ', und weil du schnell frierst, rechnet die App für die Lagen 2° kälter' : ''}. Ändern kannst du das in den Einstellungen.</li>
        </ul></details>`;
  }
  const GROUPS = [['alle', 'Alle'], ['Oberteile', 'Oberteile'], ['Strick', 'Strick'], ['Hosen', 'Hosen'], ['Schuhe', 'Schuhe'], ['Jacken', 'Jacken'], ['Accessoires', 'Accessoires'], ['wunsch', 'Wunschliste'], ['waesche', 'In der Wäsche'], ['offen', 'Angaben fehlen'], ['aus', 'Aussortiert']];
  // Brands written in several ways (case, spaces, trailing s): offer to write them the same (K5)
  const brandKey = b => String(b || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '').replace(/s$/, '');
  function brandVariants() {
    const g = {};
    for (const i of S.wardrobe.items) {
      const b = String(i.brand || '').trim().replace(/\s+/g, ' ');
      if (!b) continue;
      const k = brandKey(b);
      g[k] = g[k] || {}; g[k][b] = (g[k][b] || 0) + 1;
    }
    return Object.entries(g).filter(([k, v]) => Object.keys(v).length > 1 && !S.meta.dismissed['brand:' + k]);
  }
  function brandNote() {
    const vs = brandVariants();
    if (!vs.length) return '';
    const pl = n => n + (n === 1 ? ' Teil' : ' Teile');
    return `<div class="note info brand-note" style="margin-bottom:14px">${ic('info')}<div class="grow">${vs.map(([k, v]) => {
      const names = Object.entries(v).sort((a, b) => b[1] - a[1]);
      return `<div class="brand-row"><p>Ähnliche Marken: ${names.map(([b, n]) => '„' + esc(b) + '“ (' + pl(n) + ')').join(' und ')}. Ist das dieselbe Marke?</p><div class="row wrap">${names.map(([b]) => `<button class="btn sm quiet" data-a="brand.unify" data-k="${esc(k)}" data-v="${esc(b)}">Alle als „${esc(b)}“</button>`).join('')}<button class="btn sm ghost" data-a="dismiss" data-k="brand:${esc(k)}">Sind verschiedene</button></div></div>`;
    }).join('')}</div></div>`;
  }
  function viewWardrobe() {
    const f = ui.wf, q = ui.ws.trim().toLowerCase();
    let items = S.wardrobe.items.slice();
    if (f === 'wunsch') items = items.filter(i => i.status === 'wunsch');
    else if (f === 'waesche') items = items.filter(i => i.laundry);
    else if (f === 'offen') items = items.filter(i => i.incomplete);
    else if (f === 'aus') items = items.filter(i => i.status === 'aussortiert');
    else { items = items.filter(i => i.status === 'aktiv'); if (f !== 'alle') items = items.filter(i => i.group === f); }
    if (q) items = items.filter(i => [i.label, i.brand, i.cat, i.colorName, (i.nos || []).join(' '), i.notes].join(' ').toLowerCase().includes(q));
    const order = WP.CAT_ORDER;
    items.sort((a, b) => (order.indexOf(a.cat) - order.indexOf(b.cat)) || ((a.nos[0] || 999) - (b.nos[0] || 999)));
    const laundry = S.wardrobe.items.filter(i => i.laundry).length;
    const count = (k) => k === 'wunsch' ? S.wardrobe.items.filter(i => i.status === 'wunsch').length : k === 'waesche' ? laundry : k === 'offen' ? S.wardrobe.items.filter(i => i.incomplete).length : k === 'aus' ? S.wardrobe.items.filter(i => i.status === 'aussortiert').length : k === 'alle' ? S.wardrobe.items.filter(i => i.status === 'aktiv').length : S.wardrobe.items.filter(i => i.status === 'aktiv' && i.group === k).length;
    return `<div class="row wrap" style="margin-bottom:14px">
        <button class="btn sm" data-a="item.new">${ic('plus')}Teil hinzufügen</button>
        <button class="btn sm quiet" data-a="photos.bulk">${ic('camera')}Fotos zuordnen</button>
        <button class="btn sm quiet" data-a="import.open">${ic('upload')}Liste importieren</button>
        ${laundry ? `<button class="btn sm quiet" data-a="laundry.reset">${ic('wash')}Wäsche erledigt (${laundry})</button>` : ''}
        <span class="grow"></span><input class="search" type="search" placeholder="Suchen: Farbe, Marke, Nr." value="${esc(ui.ws)}" data-i="ws" aria-label="Kleiderschrank durchsuchen"></div>
      ${brandNote()}
      <div class="filters">${GROUPS.map(([k, l]) => { const n = count(k); return (n || k === 'alle' || k === f) ? `<button class="chip" data-a="wf" data-v="${k}" aria-pressed="${k === f}">${l} <span class="num" style="opacity:.7">${n}</span></button>` : ''; }).join('')}</div>
      ${items.length ? `<div class="wgrid">${items.map(i => `<button class="wcard${i.laundry ? ' laundry' : ''}${i.status === 'wunsch' ? ' wish' : ''}" data-a="item.edit" data-id="${i.id}"><div class="g-art">${art(i)}</div><div class="wcard-name">${esc(capF(i.label))}</div><div class="wcard-sub">${esc(sub(i))}</div><div class="wcard-tags">${i.laundry ? '<span class="tag cognac">Wäsche</span>' : ''}${i.incomplete ? '<span class="tag">Angaben fehlen</span>' : ''}${Photos.url(i.id) ? '' : ''}</div></button>`).join('')}</div>` : `<div class="empty">Keine Teile in dieser Auswahl.</div>`}`;
  }
  function listOutfit(o) {
    const ids = [...o.base, ...o.layer, o.bottom, o.shoes].filter(Boolean);
    const built = E.fromIds(S, ids);
    const missing = ids.map(item).filter(x => !x || x.status !== 'aktiv');
    return { built, missing };
  }
  function viewLists() {
    const f = ui.lf, d = E.today();
    const worn = wornOn(d);
    const rows = S.wardrobe.outfits.map(o => {
      const { built, missing } = listOutfit(o);
      const key = built.bottom ? E.keyOf(built.tops, built.bottom) : '';
      return { o, built, missing, key, rating: S.wardrobe.ratings[key], wearable: !missing.length && !!built.bottom };
    });
    const liked = Object.entries(S.wardrobe.ratings).filter(([k, v]) => v === 1 && !rows.some(r => r.key === k)).map(([k]) => {
      const [t, b] = k.split('|'); const ids = [...t.split('+'), b];
      const built = E.fromIds(S, ids);
      return { o: { name: 'Eigene Kombination', place: '', no: '' }, built, missing: ids.map(item).filter(x => !x || x.status !== 'aktiv'), key: k, rating: 1, wearable: true, own: true };
    });
    let all = rows.concat(liked);
    if (f === 'tragbar') all = all.filter(r => r.wearable);
    if (f === 'neu') all = all.filter(r => !r.wearable);
    if (f === 'mag') all = all.filter(r => r.rating === 1);
    const cnt = { alle: rows.length + liked.length, tragbar: rows.filter(r => r.wearable).length + liked.length, neu: rows.filter(r => !r.wearable).length, mag: rows.filter(r => r.rating === 1).length + liked.length };
    return `<div class="filters">${[['alle', 'Alle'], ['tragbar', 'Sofort tragbar'], ['neu', 'Braucht Neues'], ['mag', 'Gefällt mir']].map(([k, l]) => `<button class="chip" data-a="lf" data-v="${k}" aria-pressed="${k === f}">${l} <span class="num" style="opacity:.7">${cnt[k]}</span></button>`).join('')}</div>
      ${all.length ? `<div class="olist">${all.map(r => {
        const need = r.missing.map(m => m ? capF(m.label) : 'fehlendes Teil');
        return `<article class="orow${r.wearable ? '' : ' needs'}"><div class="orow-art">${layout(r.built, { small: true })}</div><div class="orow-name">${esc(r.o.name)}</div><p class="alt-items">${itemsLine(r.built)}</p><div class="orow-meta">${[r.o.no ? 'Nr. ' + r.o.no : '', r.o.place].filter(Boolean).join(', ')}${r.wearable ? '' : (r.o.place || r.o.no ? '. ' : '') + 'Braucht: ' + esc(need.join(', '))}</div>
          <div class="orow-actions">${r.wearable && !worn ? `<button class="btn sm quiet" data-a="wear.list" data-k="${esc(r.key)}">Heute tragen</button>` : ''}<span class="grow"></span>
          ${r.key ? `<button class="icon-btn" data-a="rate" data-k="${esc(r.key)}" data-v="1" aria-pressed="${r.rating === 1}" aria-label="Gefällt mir: ${esc(r.o.name)}">${ic('up')}</button><button class="icon-btn" data-a="rate" data-k="${esc(r.key)}" data-v="-1" aria-pressed="${r.rating === -1}" aria-label="Passt nicht: ${esc(r.o.name)}">${ic('down')}</button>` : ''}</div></article>`;
      }).join('')}</div>` : `<div class="empty">Keine Outfits in dieser Auswahl.</div>`}`;
  }
  function analysis(lazy) {
    const k = 'an|' + ver;
    if (ui.memo[k]) return ui.memo[k];
    if (lazy) { if (!ui.anPending) { ui.anPending = true; setTimeout(() => { analysis(); ui.anPending = false; if (route().sub === 'analyse') render(); }, 30); } return null; }
    const base = E.goodCombos(S);
    const wish = S.wardrobe.items.filter(i => i.status === 'wunsch').map(w => {
      const unlock = S.wardrobe.outfits.filter(o => o.needs.length === 1 && o.needs[0] === w.id).length;
      const plus = E.goodCombos(S, Object.assign({}, w, { status: 'aktiv', laundry: false }));
      return { w, unlock, plus, pct: Math.round(plus / Math.max(1, base) * 100) };
    }).sort((a, b) => (b.unlock - a.unlock) || (b.plus - a.plus));
    const ideas = [
      { label: 'Overshirt dunkelblau', cat: 'Overshirt', colorKey: 'navy', texture: 'dick' },
      { label: 'Overshirt olivgrün', cat: 'Overshirt', colorKey: 'olivgrün', texture: 'dick' },
      { label: 'Strickpullover navy, grob', cat: 'Pullover', colorKey: 'navy', texture: 'grob' },
      { label: 'Chino dunkelbraun', cat: 'Stoffhose', colorKey: 'dunkelbraun', material: ['Baumwolle'] },
      { label: 'Chino navy, gerade geschnitten', cat: 'Stoffhose', colorKey: 'navy', material: ['Baumwolle'], fit: 'Regular' },
      { label: 'Chelsea Boots braun', cat: 'Stiefel', colorKey: 'braun', material: ['Wildleder'] }
    ].map(x => { const it = WP.derive(Object.assign({ id: 'idea-' + x.label, nos: [], material: [], pattern: 'uni', fit: '', details: '', texture: '', qty: 1, status: 'aktiv', brand: '' }, x)); it.label = x.label; return it; })
      .filter(it => it.role !== 'shoes')
      .map(it => ({ it, plus: E.goodCombos(S, it) })).sort((a, b) => b.plus - a.plus).slice(0, 3)
      .map(x => Object.assign(x, { pct: Math.round(x.plus / Math.max(1, base) * 100) }));
    return (ui.memo[k] = { base, wish, ideas });
  }
  function viewAnalysis() {
    const owned = S.wardrobe.items.filter(i => i.status === 'aktiv');
    const clothes = owned.filter(i => !['shoes', 'cap', 'belt', 'watch', 'scarf', 'beanie'].includes(i.role));
    const wearable = S.wardrobe.outfits.filter(o => { const { missing, built } = listOutfit(o); return !missing.length && built.bottom; }).length;
    const inc = S.wardrobe.items.filter(i => i.incomplete);
    const colors = {};
    clothes.forEach(i => { if (i.unknownColor) return; const k = i.colorName; colors[k] = colors[k] || { hex: i.hex, n: 0 }; colors[k].n += 1; });
    const cl = Object.entries(colors).sort((a, b) => b[1].n - a[1].n);
    const total = cl.reduce((s, [, v]) => s + v.n, 0);
    const A = analysis(true) || { wish: [], ideas: [], pending: true };
    const maxPct = Math.max(1, ...A.wish.map(x => x.pct), ...A.ideas.map(x => x.pct));
    const days = E.diffDays(S.meta.setup || E.today(), E.today());
    const since = E.addDays(E.today(), -60);
    const rare = clothes.filter(i => !S.wardrobe.wear.some(w => w.date >= since && w.items.includes(i.id)));
    const wishRow = (it, line, pct) => `<li><div class="g" style="width:64px;flex:none"><div class="g-art">${art(it)}</div></div><div class="check-body"><div class="check-name">${esc(capF(it.label))}${it.unknownColor ? ' <span class="muted small">(Farbe offen, als neutral gerechnet)</span>' : ''}</div><div class="check-meta">${line}</div><div class="meter olive" style="margin-top:6px;max-width:320px" aria-hidden="true"><i style="width:${Math.round(pct / maxPct * 100)}%"></i></div></div></li>`;
    return `<div class="stats">
        <div class="stat"><div class="stat-val">${clothes.reduce((s, i) => s + (i.qty || 1), 0)}</div><div class="stat-label">Kleidungsstücke${clothes.some(i => i.qty > 1) ? ' (Mehrfache mitgezählt)' : ''}, dazu ${owned.length - clothes.length} Schuhe und Accessoires</div></div>
        <div class="stat"><div class="stat-val">${wearable} von ${S.wardrobe.outfits.length}</div><div class="stat-label">Outfits aus deiner Liste sofort tragbar</div></div>
        <div class="stat"><div class="stat-val">${S.wardrobe.items.filter(i => i.status === 'wunsch').length}</div><div class="stat-label">Teile auf der Wunschliste</div></div>
        <div class="stat"><div class="stat-val">${inc.length}</div><div class="stat-label">Teile mit fehlenden Angaben</div></div>
      </div>
      <div class="panel" style="margin-top:22px"><h2 class="sec-title" style="margin-bottom:12px">Farben im Schrank</h2>
        <div class="segbar" role="img" aria-label="Farbverteilung: ${cl.map(([k, v]) => k + ' ' + v.n).join(', ')}">${cl.map(([k, v]) => `<i style="flex:${v.n};background:${v.hex}" title="${esc(k)}: ${v.n}"></i>`).join('')}</div>
        <div class="swatch-legend">${cl.map(([k, v]) => `<span style="--sw:${v.hex}">${esc(k)} ${v.n}</span>`).join('')}</div>
        <p class="small muted" style="margin-top:10px">${Math.round(cl.filter(([k]) => /blau|navy|beige|braun|oliv|khaki|grün/i.test(k) && !/hellgrün/i.test(k)).reduce((s, [, v]) => s + v.n, 0) / Math.max(1, total) * 100)} % deiner Teile sind Blau- oder Erdtöne. Gleiche Teile zählen hier einmal.</p></div>
      <div class="two-col" style="margin-top:22px">
        <div class="panel"><h2 class="sec-title">Was sich von der Wunschliste lohnt</h2><p class="small muted" style="margin:2px 0 8px">Sortiert danach, wie viele Outfits aus deiner Liste das Teil allein möglich macht. Der Balken zeigt, wie viele gute Kombinationen dazukommen.</p>
          ${A.pending ? '<p class="small muted">Rechne Kombinationen durch …</p>' : ''}<ul class="checklist">${A.wish.map(x => wishRow(x.w, (x.unlock ? 'Macht ' + x.unlock + (x.unlock === 1 ? ' Outfit' : ' Outfits') + ' aus deiner Liste möglich. ' : '') + '+' + x.pct + ' % gute Kombinationen', x.pct)).join('')}</ul></div>
        <div class="panel"><h2 class="sec-title">Ideen für Lücken</h2><p class="small muted" style="margin:2px 0 8px">Teile, die es noch nicht in deinem Schrank gibt und die mit deinen Sachen besonders viel ergeben.</p>
          ${A.pending ? '<p class="small muted">Rechne Kombinationen durch …</p>' : ''}<ul class="checklist">${A.ideas.map(x => wishRow(x.it, '+' + x.pct + ' % gute Kombinationen', x.pct)).join('')}</ul></div>
      </div>
      <div class="two-col" style="margin-top:22px">
        <div class="panel"><h2 class="sec-title" style="margin-bottom:8px">Selten getragen</h2>${days < 21 ? `<p class="small ink2">Nach drei Wochen mit „Heute getragen“ siehst du hier, was du kaum anziehst und aussortieren könntest.</p>` : (rare.length ? `<p class="small muted" style="margin-bottom:8px">In den letzten 60 Tagen nicht getragen:</p><div class="wgrid">${rare.slice(0, 12).map(i => `<button class="wcard" data-a="item.edit" data-id="${i.id}"><div class="g-art">${art(i)}</div><div class="wcard-name">${esc(capF(i.label))}</div><div class="wcard-sub">${esc(sub(i))}</div></button>`).join('')}</div>` : '<p class="small ink2">Du trägst alles regelmäßig.</p>')}</div>
        <div class="panel"><h2 class="sec-title" style="margin-bottom:8px">Fehlende Angaben</h2>${inc.length ? `<ul class="checklist">${inc.map(i => `<li><div class="g" style="width:48px;flex:none"><div class="g-art">${art(i)}</div></div><div class="check-body"><div class="check-name">${esc(capF(i.label))}</div><div class="check-meta">${esc(i.notes || '')}</div></div><button class="btn sm quiet" data-a="item.edit" data-id="${i.id}">Ergänzen</button></li>`).join('')}</ul>` : '<p class="small ink2">Alles vollständig.</p>'}</div>
      </div>`;
  }

  // ---------- Settings ----------
  function viewSettings() {
    const s = S.settings;
    const dayOpts = [['ho', 'Homeoffice'], ['buero', 'Büro'], ['frei', 'Frei']];
    const lb = S.meta.lastBackup, rs = S.meta.restored;
    const lbText = S.meta.savedAt ? 'Letztes Backup: ' + stamp(S.meta.savedAt) + '.' : lb ? 'Letztes Backup: ' + E.fmtDate(lb) + '.' : 'Noch kein Backup gespeichert.';
    return `<div class="page"><header class="page-head"><div><h1 class="page-title">Einstellungen</h1></div></header>
      <div class="two-col">
        <div class="panel"><h2 class="sec-title" style="margin-bottom:6px">Darstellung und Woche</h2><div class="settings-list">
          <div><span class="lbl">Erscheinungsbild</span>${seg('Erscheinungsbild', [['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']], s.theme, { a: 'theme' })}</div>
          <div style="display:block"><span class="lbl">Deine Woche</span><p class="hint" style="margin-bottom:10px">Bestimmt den Anlass für Outfits und die Büro-Pausen.</p><div class="weekdays">${[1, 2, 3, 4, 5, 6, 0].map(i => `<label>${E.WD_LONG[i]}<select data-c="week" data-i="${i}">${dayOpts.map(([v, l]) => `<option value="${v}"${s.week[i] === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`).join('')}</div></div>
          <div><div><span class="lbl">Wohnort für das Wetter</span><p class="hint">${esc(s.home ? s.home.name : 'nicht gesetzt')}</p></div><button class="btn sm quiet" data-a="loc.open" data-k="home">Ändern</button></div>
          <div><div><span class="lbl">Büro-Ort</span><p class="hint">${esc(s.office ? s.office.name : 'nicht gesetzt')}. An Bürotagen zählt die kältere Temperatur.</p></div><div class="row"><button class="btn sm quiet" data-a="loc.open" data-k="office">Ändern</button>${s.office ? `<button class="btn sm ghost" data-a="loc.clear">Entfernen</button>` : ''}</div></div>
        </div></div>
        <div class="panel"><h2 class="sec-title" style="margin-bottom:6px">Outfit und Training</h2><div class="settings-list">
          <div><label class="toggle"><input type="checkbox" data-c="cold"${s.coldSensitive ? ' checked' : ''}><span><span class="lbl">Ich friere schnell</span><span class="hint" style="display:block">Für die Lagen rechnet die App 2° kälter.</span></span></label></div>
          <div><span class="lbl">Winterjacke unter</span><span><input type="number" class="inline-num" value="${s.winterBelow}" data-c="set.num" data-k="winterBelow" aria-label="Winterjacke unter Grad"> ° gefühlt</span></div>
          <div><span class="lbl">Mantel unter</span><span><input type="number" class="inline-num" value="${s.coatBelow}" data-c="set.num" data-k="coatBelow" aria-label="Mantel unter Grad"> ° gefühlt</span></div>
          <div><span class="lbl">Eiweiß-Ziel pro Tag</span><span><input type="number" class="inline-num" value="${s.proteinGoal}" data-c="set.num" data-k="proteinGoal" aria-label="Eiweiß-Ziel in Gramm"> g</span></div>
          <div><div><span class="lbl">Kalorien-Ziel pro Tag</span><p class="hint">Optional, für die Ernährung. Leer heißt ohne Ziel.</p></div><span><input type="number" class="inline-num" value="${s.kcalGoal || ''}" placeholder="–" data-c="set.num" data-k="kcalGoal" aria-label="Kalorien-Ziel pro Tag" style="width:84px"> kcal</span></div>
          <div><span class="lbl">Wochenziele</span><span class="row small wrap">Kraft <input type="number" class="inline-num" min="0" value="${s.goals.gym}" data-c="goal" data-k="gym" aria-label="Krafttraining pro Woche"> Laufen <input type="number" class="inline-num" min="0" value="${s.goals.run}" data-c="goal" data-k="run" aria-label="Laufen pro Woche"> Dehnen <input type="number" class="inline-num" min="0" value="${s.goals.routine}" data-c="goal" data-k="routine" aria-label="Dehnen pro Woche"></span></div>
          <div><label class="toggle"><input type="checkbox" data-c="sound"${s.sound ? ' checked' : ''}><span class="lbl">Ton und Vibration am Pausenende</span></label></div>
        </div></div>
      </div>
      <div class="panel" style="margin-top:22px"><h2 class="sec-title" style="margin-bottom:6px">Gesundheit</h2><div class="settings-list">
        <div style="display:block"><label class="field"><span>Allergien und Unverträglichkeiten</span><input value="${esc(S.health.record.allergies || '')}" data-c="rec.set" data-k="allergies" placeholder="keine bekannt"></label></div>
        <div style="display:block"><label class="field"><span>Vorerkrankungen</span><input value="${esc(S.health.record.conditions || '')}" data-c="rec.set" data-k="conditions" placeholder="optional"></label></div>
        <div style="display:block"><label class="field"><span>Nahrungsergänzung</span><input value="${esc(S.health.record.supplements || '')}" data-c="rec.set" data-k="supplements" placeholder="optional"></label><p class="hint" style="margin-top:6px">Steht nur im Bericht für den Arzt und bleibt in diesem Browser.</p></div>
        <div style="display:block"><span class="lbl">Pollen, auf die du reagierst</span><p class="hint" style="margin-bottom:8px">Oben auf Heute erscheint ein Hinweis, sobald eine dieser Arten mäßig oder stärker fliegt; die Verläufe vergleichen deine Beschwerden nur mit ihnen. Hasel und Esche liefert der Wetterdienst nicht.</p>${polChips('in-settings')}</div>
        <div><div><span class="lbl">Gesundheitsdaten als Tabelle</span><p class="hint">Alle Check-ins als CSV, z. B. für Excel.</p></div><button class="btn sm quiet" data-a="rep.csv">${ic('download')}CSV speichern</button></div>
        <div><div><span class="lbl">Erinnerungen auf dem Handy</span><p class="hint">Termine, Vorsorge, Medikamente und Pflege lassen sich als Kalender-Datei speichern. Öffne sie mit Outlook oder importiere sie in den Google Kalender, dann erinnert dich dein Handy auch ohne diese App.</p></div></div>
      </div></div>
      <div class="panel" style="margin-top:22px"><h2 class="sec-title" style="margin-bottom:6px">Daten</h2><div class="settings-list">
        <div><div><span class="lbl">Hauptgerät</span><p class="hint">Hier ist dein ${DEV_NAME[DEVICE]}. Eingetragen wird am Hauptgerät; das andere Gerät bekommt die Daten per Backup, direkt per Kabel oder Quick Share.</p></div>${seg('Hauptgerät', [['handy', 'Handy'], ['pc', 'PC']], mainDevice(), { a: 'main.dev' })}</div>
        <div><div><span class="lbl">Backup speichern</span><p class="hint">Eine Datei mit allem, inklusive Fotos. ${lbText}</p></div><button class="btn sm" data-a="backup.export">${ic('download')}Backup speichern</button></div>
        <div><div><span class="lbl">Backup laden</span><p class="hint">Ersetzt alle Daten auf diesem Gerät durch das Backup.${rs ? ' Zuletzt eingespielt: ' + esc(backupLabel(rs.from, rs.exported)) + '.' : ''}</p></div><label class="btn sm quiet">${ic('upload')}Datei wählen<input type="file" accept=".json,application/json" data-c="backup.import" class="sr"></label></div>
        <div><div><span class="lbl">Kleiderliste importieren</span><p class="hint">Excel (.xlsx), CSV oder Text in deinem bisherigen Format. Neue Teile kommen dazu, bekannte Nummern werden aktualisiert.</p></div><div class="row"><button class="btn sm quiet" data-a="import.open">${ic('upload')}Importieren</button><button class="btn sm ghost" data-a="csv.template">CSV-Vorlage</button></div></div>
        ${storageRow()}
        <div><div><span class="lbl">Alles zurücksetzen</span><p class="hint">${seedEl() ? 'Löscht deine Einträge und Fotos und lädt die Startdaten neu.' : 'Löscht alle Daten und Fotos auf diesem Gerät. Danach kannst du ein Backup einspielen.'}</p></div><button class="btn sm danger" data-a="reset">Zurücksetzen</button></div>
      </div></div>
      ${lockPanel()}
      <div class="panel" style="margin-top:22px"><h2 class="sec-title" style="margin-bottom:8px">Über diese App</h2>
        <p class="how-text">${WEB ? 'Die App selbst kommt aus dem Netz und läuft danach auch offline. Deine Daten und Fotos liegen nur auf diesem Gerät, ohne Konto und ohne Cloud; der Server sieht sie nie.' : 'Alles läuft lokal in deinem Browser, ohne Konto und ohne Server. Daten und Fotos liegen im Speicher dieses Browsers; ein anderer Browser oder ein anderes Gerät sieht sie nicht.'} Nur für Wetter, Pollen und Luftqualität fragt die App den freien Dienst Open-Meteo mit den Koordinaten deiner Orte; deine Einträge verlassen das Gerät dabei nicht. Erinnerungen siehst du, sobald die App offen ist. Für Termine, Vorsorge, Medikamente und Pflege speicherst du Kalender-Dateien, dann meldet sich dein Kalender auch ohne die App.</p>
        <p class="small muted" style="margin-top:8px" data-a="about.tap">Version ${VERSION}, November 2026. Zuletzt neu: Beschwerden im Tagesverlauf. Im Check-in trägst du sie je Tageszeit ein, etwa morgens Kopfschmerzen und abends nichts mehr, und für jeden früheren Tag nachträglich. Davor: Reisen mit Packliste unter Outfit, das Experiment im Wochenrückblick, Selbstexperimente und die Wahl deiner Pollenarten.</p></div>
    </div>`;
  }
  // Lock and updates: only in the web version, which embeds lock.js and pwa.js
  function lockPanel() {
    if (!WEB) return '';
    const on = !!(window.Lock && Lock.status().enabled), ok = ui.lockOk;
    const hint = on ? 'An. Beim Öffnen und nach einer Minute im Hintergrund fragt die App nach ' + (HELLO ? 'Windows Hello (Gesicht, Fingerabdruck oder PIN).' : 'Fingerabdruck, Gesicht oder Geräte-PIN.')
      : ok === false ? (HELLO ? 'Dieser PC bietet hier kein Windows Hello an. Richte in Windows unter Einstellungen, Konten, Anmeldeoptionen eine PIN ein, dann klappt es.' : 'Dieses Gerät bietet hier keine Bestätigung per Fingerabdruck, Gesicht oder PIN an. Am Handy klappt es in Chrome, sobald eine Displaysperre eingerichtet ist.')
      : (HELLO ? 'Aus. Schützt die App vor fremden Blicken, wenn jemand an deinen entsperrten PC kommt.' : 'Aus. Schützt die App vor fremden Blicken, auch wenn dein Handy entsperrt in anderen Händen ist.');
    return `<div class="panel" style="margin-top:22px"><h2 class="sec-title" style="margin-bottom:6px">Sperre und Updates</h2><div class="settings-list">
        <div><div><span class="lbl">${lockName()}</span><p class="hint">${hint}</p></div>${on ? '<div class="row"><button class="btn sm quiet" data-a="lock.now">Jetzt sperren</button><button class="btn sm ghost" data-a="lock.off">Ausschalten</button></div>' : `<button class="btn sm" data-a="lock.on"${ok === false ? ' disabled' : ''}>Einrichten</button>`}</div>
        ${on ? '<div><div><span class="lbl">Kein Zugriff mehr?</span><p class="hint">Auf dem Sperrbildschirm „Kein Zugriff mehr?“ wählen. Dann löschst du die Daten auf diesem Gerät und spielst dein Backup neu ein.</p></div></div>' : ''}
        <div><div><span class="lbl">App-Version</span><p class="hint">${ui.update ? 'Eine neue Version ist bereit.' : 'Version ' + VERSION + '. Neue Versionen kündigt die App an, du lädst sie auf Knopfdruck.'}</p></div>${ui.update ? '<button class="btn sm" data-a="app.update">Jetzt laden</button>' : ''}</div>
      </div></div>`;
  }

  // ---------- Router ----------
  const VIEWS = { heute: viewHeute, training: viewTraining, gesundheit: viewHealth, pflege: viewPflege, outfit: viewOutfit, einstellungen: viewSettings };
  function route() { const h = (location.hash || '#/heute').replace(/^#\/?/, '').split('/'); const top = VIEWS[h[0]] ? h[0] : 'heute'; return { top, sub: h[1] || '' }; }
  let lastRoute = '';
  function render() {
    const r = route();
    const rk = r.top + '/' + r.sub;
    // A day chosen in the check-in holds within Gesundheit; elsewhere and on coming back it is today again (2.16)
    if (r.top !== 'gesundheit') ui.hDate = null;
    if (vaultRender(rk)) { lastRoute = rk; return; }
    const scroll = rk === lastRoute ? window.scrollY : 0;
    document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', a.dataset.nav === r.top ? 'page' : 'false'));
    const active = document.activeElement;
    const focusKey = active && active.dataset && (active.dataset.a || active.dataset.c || active.dataset.i) ? [active.dataset.a || active.dataset.c || active.dataset.i, active.dataset.id || '', active.dataset.e || '', active.dataset.s || '', active.dataset.v || '', active.dataset.k || ''].join('|') : null;
    $('#view').innerHTML = VIEWS[r.top](r.sub);
    if (rk !== lastRoute) window.scrollTo(0, 0); else window.scrollTo(0, scroll);
    lastRoute = rk;
    badges();
    wireCharts();
    document.querySelectorAll('.tabs').forEach(t => { const a = t.querySelector('[aria-current="page"]'); if (a && t.scrollWidth > t.clientWidth) t.scrollLeft = Math.max(0, a.offsetLeft - 24); });
    if (focusKey) {
      const el = [...document.querySelectorAll('[data-a],[data-c],[data-i]')].find(x => [x.dataset.a || x.dataset.c || x.dataset.i, x.dataset.id || '', x.dataset.e || '', x.dataset.s || '', x.dataset.v || '', x.dataset.k || ''].join('|') === focusKey);
      if (el) el.focus({ preventScroll: true });
    }
  }
  function badges() {
    const n = E.dueList(S, E.today()).length;
    document.querySelectorAll('[data-badge="pflege"]').forEach(b => { b.textContent = n; b.classList.toggle('hidden', !n); });
    const t = E.today(), now = new Date(), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const hn = medsDue(t).filter(x => !x.done && x.t <= hm).length + S.health.vorsorge.filter(v => !v.optional && H.vorsorgeDue(S, v, t).state === 'faellig').length;
    document.querySelectorAll('[data-badge="gesundheit"]').forEach(b => { b.textContent = hn; b.classList.toggle('hidden', !hn); });
    document.title = (n + hn ? '(' + (n + hn) + ') ' : '') + 'Chris OS';
  }

  // ---------- Toast, dialogs ----------
  let toastTimer = null;
  function toast(msg, undo) {
    const t = $('#toast');
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-a="toast.undo">Rückgängig</button>' : ''}`;
    t.classList.remove('hidden');
    ui.undo = undo || null;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), undo ? 6000 : 3500);
  }
  function openDialog(html) { const d = $('#dlg'); d.innerHTML = `<div class="sheet-inner">${html}</div>`; if (!d.open) d.showModal(); const f = d.querySelector('[autofocus]'); if (f) f.focus(); return d; }
  function closeDialog() { const d = $('#dlg'); if (d.open) d.close(); }
  // Gym-Plan: device or place and start weight per exercise (K8: Chris enters them himself)
  function exDialog(id) {
    const ex = exById(id); if (!ex) return;
    const sg = E.suggestion(S, ex), time = ex.type === 'time';
    const unit = ex.unit === 'kg je Hand' ? 'kg je Hand' : 'kg';
    const info = sg.state !== 'start' ? 'Du hast die Übung schon eingetragen; die App rechnet mit deinen letzten Werten weiter.'
      : ex.estimate ? 'Noch geschätzt. Trag das Gewicht ein, mit dem ' + ex.repMax + ' saubere Wiederholungen gerade noch gehen.'
      : 'Gilt, bis du die Übung zum ersten Mal einträgst.';
    openDialog(`${dlgHead(ex.name)}<form class="form-grid" id="ex-form" onsubmit="return false">
      <label class="field full"><span>Gerät oder Ort</span><input name="where" value="${esc(ex.where || '')}" placeholder="z. B. 711 #12 oder Kabelzug, Brusthöhe"></label>
      ${time ? '' : `<label class="field"><span>Startgewicht in ${unit}</span><input name="start" type="number" inputmode="decimal" min="0" step="${ex.inc && ex.inc < 1 ? 0.25 : 0.5}" value="${ex.start != null ? ex.start : ''}"></label><p class="hint full">${esc(info)}</p>`}</form>
      <div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="ex.save" data-id="${esc(id)}">Speichern</button></div>`);
  }
  const dlgHead = t => `<div class="sheet-head"><h2 class="sheet-title">${esc(t)}</h2><button class="icon-btn" data-a="dlg.close" aria-label="Schließen">${ic('x')}</button></div>`;
  function confirmDlg(title, text, okLabel, fn, danger) {
    ui.confirm = fn;
    openDialog(`${dlgHead(title)}<p class="how-text">${esc(text)}</p><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn${danger ? ' danger' : ''}" data-a="confirm.ok">${esc(okLabel)}</button></div>`);
  }

  // ---------- Rest timer ----------
  const rest = { end: 0, timer: null, name: '' };
  function startRest(sec, name) {
    rest.end = Date.now() + sec * 1000; rest.name = name; rest.over = false;
    const el = $('#rest'); el.classList.remove('hidden', 'over');
    clearInterval(rest.timer); rest.timer = setInterval(tickRest, 250); tickRest();
  }
  function tickRest() {
    const el = $('#rest'); const left = Math.ceil((rest.end - Date.now()) / 1000);
    if (left <= 0 && !rest.over) { rest.over = true; el.classList.add('over'); beep(); setTimeout(() => { if (rest.over) stopRest(); }, 9000); }
    const v = Math.max(0, left);
    el.querySelector('.rest-time').textContent = Math.floor(v / 60) + ':' + String(v % 60).padStart(2, '0');
    el.querySelector('.rest-label').textContent = rest.over ? 'Pause vorbei, weiter geht’s' : 'Pause nach ' + rest.name;
  }
  function stopRest() { clearInterval(rest.timer); rest.over = false; $('#rest').classList.add('hidden'); }
  function beep() {
    if (!S.settings.sound) return;
    try { const AC = window.AudioContext || window.webkitAudioContext; const ac = new AC(); [0, 0.22].forEach(t0 => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ac.currentTime + t0); g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + 0.18); o.connect(g).connect(ac.destination); o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + 0.2); }); setTimeout(() => ac.close(), 800); } catch (e) { /* no audio */ }
    if (navigator.vibrate) navigator.vibrate([180, 80, 180]);
  }

  // ---------- Item editor ----------
  const TEX = ['', 'fein', 'grob', 'dick', 'sehr dick', 'Cord', 'wollig', 'gerippt', 'Denim-Optik'];
  const FITS = ['', 'Slim', 'Regular', 'Relaxed', 'Oversized', 'leicht oversized', 'Tapered'];
  function itemDialog(id, preset) {
    const it = id ? item(id) : Object.assign({ id: null, nos: [], cat: 'T-Shirt', label: '', brand: '', colorKey: 'weiß', pattern: 'uni', material: [], texture: '', fit: 'Regular', f: 2, w: 1, qty: 1, status: 'aktiv', notes: '' }, preset || {});
    ui.editId = id; ui.pendingPhoto = null;
    const colorOpts = Object.entries(WP.COLORS).map(([k, c]) => `<option value="${esc(k)}"${k === it.colorKey ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
    const has = id && Photos.url(id);
    openDialog(`${dlgHead(id ? capF(it.label) : 'Neues Teil')}
      <div class="photo-box"><div class="g-art" id="ed-art">${id ? art(it) : G.svg(WP.derive(Object.assign({}, it)))}</div>
        <div class="stack"><p class="small ink2">Am besten flach auf hellem Untergrund fotografieren, von oben.</p>
          <div class="row wrap"><label class="btn sm quiet">${ic('camera')}${has ? 'Foto ersetzen' : 'Foto hinzufügen'}<input type="file" accept="image/*" capture="environment" class="sr" data-c="item.photo"></label>${has ? `<button class="btn sm ghost" data-a="item.photo.del" data-id="${id}">Foto entfernen</button>` : ''}</div></div></div>
      <form class="form-grid" id="item-form" onsubmit="return false">
        <label class="field full"><span>Bezeichnung</span><input name="label" value="${esc(it.label)}" placeholder="z. B. T-Shirt weiß" ${id ? '' : 'autofocus'}></label>
        <label class="field"><span>Kategorie</span><select name="cat">${WP.CAT_ORDER.map(c => `<option${c === it.cat ? ' selected' : ''}>${c}</option>`).join('')}</select></label>
        <label class="field"><span>Marke</span><input name="brand" value="${esc(it.brand || '')}"></label>
        <label class="field"><span>Farbe</span><select name="colorKey">${colorOpts}</select></label>
        <label class="field"><span>Muster</span><select name="pattern">${['uni', 'kariert', 'gepunktet', 'gestreift'].map(p => `<option${p === it.pattern ? ' selected' : ''}>${p}</option>`).join('')}</select></label>
        <label class="field"><span>Material</span><input name="material" value="${esc((it.material || []).join(', '))}" placeholder="Baumwolle, Leinen …"></label>
        <label class="field"><span>Struktur</span><select name="texture">${TEX.map(t => `<option value="${t}"${t === (it.texture || '') ? ' selected' : ''}>${t || '–'}</option>`).join('')}</select></label>
        <label class="field"><span>Passform</span><select name="fit">${FITS.map(t => `<option value="${t}"${t === (it.fit || '') ? ' selected' : ''}>${t || '–'}</option>`).join('')}</select></label>
        <label class="field"><span>Nummer(n)</span><input name="nos" value="${esc((it.nos || []).join(', '))}" placeholder="z. B. 12"></label>
        <label class="field"><span>Formalität <output class="num">${n0(it.f)}</output> von 5</span><input type="range" name="f" min="1" max="5" step="0.1" value="${it.f}" oninput="this.previousElementSibling.firstElementChild.value=Number(this.value).toLocaleString('de-DE')"></label>
        <label class="field"><span>Wärme <output class="num">${n0(it.w)}</output></span><input type="range" name="w" min="0" max="6" step="0.1" value="${it.w}" oninput="this.previousElementSibling.firstElementChild.value=Number(this.value).toLocaleString('de-DE')"></label>
        <label class="field"><span>Anzahl</span><input type="number" name="qty" min="1" value="${it.qty || 1}"></label>
        <label class="field"><span>Status</span><select name="status">${[['aktiv', 'Im Schrank'], ['wunsch', 'Wunschliste'], ['aussortiert', 'Aussortiert']].map(([v, l]) => `<option value="${v}"${v === it.status ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="field full"><span>Notiz</span><textarea name="notes">${esc(it.notes || '')}</textarea></label>
      </form>
      <div class="sheet-foot">${id ? `<button class="btn danger left" data-a="item.delete" data-id="${id}">${ic('trash')}Löschen</button>` : ''}<button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="item.save">Speichern</button></div>`);
  }
  async function saveItem() {
    const f = new FormData($('#item-form'));
    const v = k => String(f.get(k) || '').trim();
    let it = ui.editId ? item(ui.editId) : null;
    const isNew = !it;
    if (isNew) { it = { id: uid('i'), wear: [] }; S.wardrobe.items.push(it); }
    const colorChanged = it.colorKey !== v('colorKey');
    Object.assign(it, {
      cat: v('cat'), brand: v('brand'), colorKey: v('colorKey'), pattern: v('pattern'), texture: v('texture'), fit: v('fit'),
      material: v('material').split(/[,;]/).map(x => x.trim()).filter(Boolean), nos: v('nos').split(/[,;\s]+/).map(Number).filter(n => n > 0),
      f: +v('f'), w: +v('w'), qty: Math.max(1, +v('qty') || 1), status: v('status'), notes: v('notes')
    });
    if (colorChanged || isNew) { delete it.hex; delete it.hex2; delete it.colorName; }
    delete it.role; delete it.group; delete it.seasons;
    const lbl = v('label');
    delete it.label;
    WP.derive(it);
    if (lbl) it.label = lbl;
    if (it.incomplete && !it.unknownColor && (it.brand || colorChanged)) it.incomplete = false;
    if (ui.pendingPhoto) { await Photos.put(it.id, ui.pendingPhoto); ui.pendingPhoto = null; }
    save(); closeDialog(); render(); toast(isNew ? 'Teil hinzugefügt' : 'Gespeichert');
  }

  // ---------- Import ----------
  function importDialog() {
    openDialog(`${dlgHead('Kleiderliste importieren')}
      <p class="how-text">Wähle deine Excel-Datei (.xlsx), eine CSV-Datei oder eine Textdatei im bisherigen Format („1. T-Shirt von Marke“ und darunter „- weiß“). Outfit-Listen mit den Spalten Basis, Hose, Layer und Schuhe werden ebenfalls erkannt.</p>
      <label class="btn quiet" style="margin-top:14px">${ic('upload')}Datei wählen<input type="file" accept=".xlsx,.csv,.txt,text/plain,text/csv" data-c="import.file" class="sr"></label>
      <div id="imp-res" style="margin-top:16px"></div>`);
  }
  async function readImport(file) {
    const name = file.name.toLowerCase();
    let items = [], outfits = [];
    if (name.endsWith('.xlsx')) { const r = WP.analyzeSheets(await WP.readXlsx(await file.arrayBuffer())); items = r.items; outfits = r.outfits; }
    else if (name.endsWith('.csv')) { const rows = WP.parseCsv(await file.text()); items = WP.rowsToItems(rows); outfits = WP.parseOutfitRows(rows) || []; }
    else { items = WP.parseWardrobeText(await file.text()); }
    items = WP.mergeDuplicates(items);
    return { items, outfits };
  }
  function mergeImport(res, mode) {
    const W = S.wardrobe;
    let added = 0, updated = 0;
    if (mode === 'replace') { W.items = W.items.filter(i => i.source !== 'liste'); }
    for (const it of res.items) {
      const ex = it.nos.length ? W.items.find(i => (i.nos || []).some(n => it.nos.includes(n)) && i.status !== 'wunsch') : null;
      if (ex) {
        const auto = ex.colorName ? WP.noun(ex) + ' ' + ex.colorName.toLowerCase() : null;
        const custom = ex.label && ex.label !== auto ? ex.label : null;
        const keep = { id: ex.id, status: ex.status, laundry: ex.laundry };
        Object.assign(ex, it, keep); ex.incomplete = false; delete ex.label; WP.derive(ex); if (custom) ex.label = custom; updated++;
      } else {
        let id = 'k' + (it.nos[0] || uid(''));
        if (W.items.some(i => i.id === id)) id = uid('i');
        W.items.push(Object.assign(it, { id, status: 'aktiv', source: 'liste' })); added++;
      }
    }
    let oCount = 0;
    if (res.outfits.length) {
      const byNo = new Map(); W.items.forEach(i => (i.nos || []).forEach(n => byNo.set(n, i.id)));
      const wishId = w => { let it = W.items.find(i => i.id === 'w-' + w.key); if (!it) { it = WP.derive(Object.assign({ id: 'w-' + w.key, nos: [], status: 'wunsch', source: 'outfitliste', material: w.material || [], texture: w.texture || '', pattern: 'uni', fit: '', details: '', qty: 1, brand: '', notes: 'Aus deiner Outfit-Liste („Neu“).' }, w)); delete it.key; W.items.push(it); } return it.id; };
      W.outfits = res.outfits.map(o => {
        const ref = { base: [], layer: [], bottom: null, needs: [], missing: [] };
        for (const slot of ['base', 'bottom', 'layer']) {
          const r = WP.resolveCell(o.cells[slot]);
          for (const n of r.nos) { const id = byNo.get(n); if (id) { if (slot === 'bottom') ref.bottom = id; else ref[slot].push(id); } else ref.missing.push(n); }
          for (const w of r.wish) { const id = wishId(w); if (slot === 'bottom') ref.bottom = id; else ref[slot].push(id); ref.needs.push(id); }
          if (slot === 'layer') ref.open = r.open;
        }
        const shoeKey = WP.resolveShoe(o.cells.shoes);
        return { id: 'L' + o.no, no: o.no, name: o.name, place: o.place, base: ref.base, layer: ref.layer, bottom: ref.bottom, shoes: W.items.some(i => i.id === shoeKey) ? shoeKey : null, open: ref.open, needs: [...new Set(ref.needs)], missing: ref.missing, raw: o.cells };
      });
      oCount = W.outfits.length;
    }
    save();
    return { added, updated, oCount };
  }

  // ---------- Backup ----------
  const blobToDataURL = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
  // Decoded by hand: the web version's CSP does not allow fetch() on data: URLs
  function dataURLToBlob(u) {
    const i = u.indexOf(','), head = u.slice(0, i), body = u.slice(i + 1);
    const type = (head.match(/^data:([^;,]+)/) || [])[1] || 'application/octet-stream';
    if (!/;base64$/.test(head)) return new Blob([decodeURIComponent(body)], { type });
    const bin = atob(body), out = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) out[k] = bin.charCodeAt(k);
    return new Blob([out], { type });
  }
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  async function exportBackup() {
    const photos = {};
    try { for (const [id, blob] of await Photos.all()) photos[id] = await blobToDataURL(blob); } catch (e) { /* no photos */ }
    const now = new Date(), at = now.toISOString();
    S.meta.lastBackup = E.today(); S.meta.savedAt = at; save(true);
    // Time and device in the name: on the other device the newest file is easy to find in Downloads
    const name = 'chris-os-backup-' + E.today() + '-' + pad2(now.getHours()) + pad2(now.getMinutes()) + '-' + DEVICE + '.json';
    download(name, JSON.stringify({ app: 'haltung', version: S.version || 2, exported: at, device: DEVICE, state: S, photos }));
    render(); toast('Backup gespeichert. Leg die Datei an einen sicheren Ort.');
  }
  async function readBackup(file) {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { return { err: 'Die Datei ist kein gültiges Backup.' }; }
    if (!data || data.app !== 'haltung' || !data.state || !data.state.wardrobe) return { err: 'Die Datei ist kein Backup dieser App.' };
    return { data };
  }
  async function applyBackup(data) {
    vaultLock(false);
    S = data.state; migrate(S);
    S.meta.restored = { at: new Date().toISOString(), exported: data.exported || null, from: devOf(data.device) };
    await Photos.clear();
    for (const [id, u] of Object.entries(data.photos || {})) { try { await Photos.put(id, dataURLToBlob(u)); } catch (e) { /* skip */ } }
    save(true); applyTheme();
  }
  // Before replacing: warn if the backup is older than the data here, or if changes made here are missing in it.
  // Changes made here count from the last import on. The backup holds them only if its device loaded a backup
  // saved after them (its meta.restored); for older backups without that, only changes since the last backup count.
  function backupRisk(data) {
    const m = S.meta, r = m.restored || {}, inR = (data.state.meta && data.state.meta.restored) || {};
    const here = latest(m.savedAt, r.exported);
    if (data.exported && here && data.exported < here) return 'Achtung: Es ist älter als der Stand auf diesem Gerät (' + stamp(here) + ').';
    const local = m.changedAt && m.changedAt > (latest(r.at, r.exported) || '') ? m.changedAt : null;
    const lost = local && (inR.exported ? inR.exported < local : unsaved());
    return lost ? 'Achtung: Änderungen von hier fehlen darin und gehen verloren (zuletzt geändert ' + stamp(local) + ').' : '';
  }
  async function importBackup(file) {
    const r = await readBackup(file);
    if (r.err) { toast(r.err); return; }
    const data = r.data, warn = backupRisk(data);
    const text = 'Das ' + backupLabel(data.device, data.exported) + ' ersetzt alle Daten auf diesem Gerät.' + (warn ? ' ' + warn : '');
    confirmDlg(warn ? 'Trotzdem laden?' : 'Backup laden?', text, warn ? 'Trotzdem laden' : 'Backup laden', async () => {
      await applyBackup(data); render(); refreshEnv(); refreshTrips(); toast('Backup geladen');
    }, !!warn);
  }

  // ---------- Session helpers ----------
  function startSession(planId) {
    const p = S.training.plans.find(x => x.id === planId);
    startSessionWith({ plan: p.id, name: p.name, items: p.items });
  }
  function startSessionWith(p) {
    S.training.active = {
      id: uid('s'), plan: p.plan, name: p.name, date: E.today(), start: Date.now(), warm: {},
      entries: p.items.map(it => { const ex = exById(it.ex); const sg = E.suggestion(S, ex); return { ex: it.ex, orig: it.ex, ss: it.ss || null, optional: !!it.optional, sugg: sg, sets: Array.from({ length: ex.sets }, () => ({ kg: ex.type === 'time' ? 0 : sg.kg, reps: null, done: false })) }; })
    };
    save(); location.hash = '#/training/session'; render();
  }
  function finishSession() {
    const a = S.training.active; if (!a) return;
    const entries = a.entries.map(e => ({ ex: e.ex, sets: e.sets.filter(s => s.done).map(s => ({ kg: +s.kg || 0, reps: +s.reps || 0, done: true })) })).filter(e => e.sets.length);
    if (!entries.length) { confirmDlg('Training verwerfen?', 'Du hast noch keinen Satz abgehakt. Soll das Training ohne Speichern beendet werden?', 'Verwerfen', () => { S.training.active = null; save(); stopRest(); location.hash = '#/training'; render(); }, true); return; }
    const prs = entries.filter(e => { const ex = exById(e.ex); if (!ex || ex.type === 'time') return false; const prev = E.series(S, e.ex); const best = Math.max(0, ...prev.map(p => E.e1rm(p.kg, p.reps))); return prev.length && Math.max(...e.sets.map(s => E.e1rm(s.kg, s.reps))) > best + 0.01; }).length;
    const sess = { id: a.id, date: a.date, plan: a.plan, name: a.name, minutes: Math.max(1, Math.round((Date.now() - a.start) / 60000)), entries };
    S.training.sessions.push(sess); S.training.active = null; save(); stopRest();
    const st = E.sessionStats(sess, S.training.exercises);
    location.hash = '#/training'; render();
    toast('Gespeichert: ' + st.sets + ' Sätze in ' + minText(sess.minutes) + (prs ? ', ' + prs + (prs === 1 ? ' neuer Bestwert' : ' neue Bestwerte') : '') + '.');
  }

  // ---------- Dialog content ----------
  function runDialog() {
    openDialog(`${dlgHead('Lauf eintragen')}<form class="form-grid" id="run-form" onsubmit="return false">
      <label class="field"><span>Datum</span><input type="date" name="date" value="${E.today()}"></label>
      <label class="field"><span>Dauer in Minuten</span><input type="number" name="min" min="1" value="30" autofocus></label>
      <label class="field"><span>Strecke in km (optional)</span><input type="number" name="km" min="0" step="0.1"></label>
      <label class="field"><span>Gefühl</span><select name="feel"><option>locker</option><option>gut</option><option>anstrengend</option></select></label></form>
      <div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="run.save">Speichern</button></div>`);
  }
  function routineDialog(id) {
    const r = S.training.routines[id];
    ui.routine = { id, done: {} };
    openDialog(`${dlgHead(r.name + ', ' + r.minutes + ' Minuten')}<p class="small muted" style="margin:-8px 0 10px">${esc(r.where)}. Hake ab, was du gemacht hast.</p>
      <ul class="checklist" id="routine-list">${r.items.map((x, i) => `<li><button class="check" data-a="routine.tick" data-i="${i}" aria-pressed="false" aria-label="${esc(x.name)}">${ic('check')}</button><div class="check-body"><div class="check-name">${esc(x.name)} <span class="muted num">${esc(x.dose)}</span></div><div class="check-meta">${esc(x.cue)}</div></div></li>`).join('')}</ul>
      <div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn olive" data-a="routine.save">${ic('check')}Erledigt</button></div>`);
  }
  function locDialog(which) {
    ui.locWhich = which;
    openDialog(`${dlgHead(which === 'home' ? 'Wohnort für das Wetter' : 'Büro-Ort')}<div class="row"><input class="search grow" id="loc-q" placeholder="Ort suchen, z. B. Frankfurt am Main" autofocus><button class="btn" data-a="loc.search">Suchen</button></div><div id="loc-res" style="margin-top:14px"></div>`);
    $('#loc-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); A['loc.search'](); } });
  }

  // ---------- Actions ----------
  const A = {
    'dlg.close': () => closeDialog(),
    'confirm.ok': async () => { const fn = ui.confirm; ui.confirm = null; closeDialog(); if (fn) await fn(); },
    'toast.undo': () => { const u = ui.undo; ui.undo = null; $('#toast').classList.add('hidden'); if (u) { u(); save(); render(); } },
    'dismiss': el => { S.meta.dismissed[el.dataset.k] = true; save(true); render(); },
    'brand.unify': el => {
      const k = el.dataset.k, b = el.dataset.v;
      const its = S.wardrobe.items.filter(i => i.brand && brandKey(i.brand) === k);
      its.forEach(i => { i.brand = b; });
      save(); render(); toast('Marke angeglichen: ' + its.length + (its.length === 1 ? ' Teil' : ' Teile') + ' heißen jetzt „' + b + '“.');
    },
    'ex.edit': el => exDialog(el.dataset.id),
    'ex.save': el => {
      const ex = exById(el.dataset.id), f = new FormData($('#ex-form'));
      const where = String(f.get('where') || '').trim(); if (where) ex.where = where;
      const raw = String(f.get('start') == null ? '' : f.get('start')).replace(',', '.').trim();
      if (raw !== '') { const v = parseFloat(raw); if (!isFinite(v) || v < 0) { toast('Bitte ein Gewicht ab 0 eintragen.'); return; } ex.start = v; ex.estimate = false; }
      save(); closeDialog(); render(); toast('Übung gespeichert');
    },
    'fold': el => { const k = el.dataset.k; ui.open[k] = !foldOpen(k); try { sessionStorage.setItem(FOLD_KEY, JSON.stringify(ui.open)); } catch (e) { /* storage blocked */ } render(); },
    // outfit
    'occ': el => { ui.occ[el.dataset.d] = el.dataset.v; render(); },
    'oday': el => { ui.oday = el.dataset.v; render(); },
    'pick': el => { const d = el.dataset.d, occ = occFor(d); delete ui.pick[d + '|' + occ]; S.wardrobe.choice = S.wardrobe.choice || {}; S.wardrobe.choice[d + ':' + occ] = { key: el.dataset.k }; save(); render(); },
    'reroll': el => { const d = el.dataset.d; rerollDay(d, occFor(d)); closeDialog(); save(); render(); },
    'wear': el => {
      const d = el.dataset.d, { res } = suggestionFor(d), o = res.fav;
      if (!o) return;
      S.wardrobe.wear.push({ date: d, items: E.outfitIds(o), key: o.key, occasion: occFor(d) });
      save(); render(); toast('Als getragen gespeichert');
    },
    'wear.list': el => {
      const [t, b] = el.dataset.k.split('|'); const d = E.today();
      const lo = S.wardrobe.outfits.find(o => o.bottom === b && [...o.base, ...o.layer].join('+') === t);
      const ids = [...t.split('+'), b, lo && lo.shoes].filter(Boolean);
      S.wardrobe.wear.push({ date: d, items: ids, key: el.dataset.k, occasion: occFor(d) });
      save(); location.hash = '#/heute'; render(); toast('Als heutiges Outfit gespeichert');
    },
    'wear.undo': el => { const d = el.dataset.d; const i = S.wardrobe.wear.map(w => w.date).lastIndexOf(d); if (i >= 0) S.wardrobe.wear.splice(i, 1); save(); render(); },
    'rate': el => {
      const k = el.dataset.k, v = +el.dataset.v, R = S.wardrobe.ratings;
      const prev = R[k];
      if (prev === v) delete R[k]; else R[k] = v;
      const ids = k.split('|').join('+').split('+');
      const delta = (R[k] || 0) - (prev || 0);
      for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) { const pk = ids[a] < ids[b] ? ids[a] + '~' + ids[b] : ids[b] + '~' + ids[a]; S.wardrobe.pairs[pk] = Math.max(-3, Math.min(3, (S.wardrobe.pairs[pk] || 0) + delta)); if (!S.wardrobe.pairs[pk]) delete S.wardrobe.pairs[pk]; }
      if (el.dataset.d) { delete ui.pick[el.dataset.d + '|' + occFor(el.dataset.d)]; if (v === -1 && S.wardrobe.choice) delete S.wardrobe.choice[el.dataset.d + ':' + occFor(el.dataset.d)]; }
      save(); render();
      toast(R[k] === 1 ? 'Gemerkt: kommt öfter' : R[k] === -1 ? 'Wird nicht mehr vorgeschlagen' : 'Bewertung entfernt');
    },
    'laundry': el => { const it = item(el.dataset.id); it.laundry = !it.laundry; save(); render(); },
    'laundry.reset': () => { const was = S.wardrobe.items.filter(i => i.laundry).map(i => i.id); was.forEach(id => { item(id).laundry = false; }); save(); render(); toast('Wäsche zurück im Schrank', () => was.forEach(id => { item(id).laundry = true; })); },
    'temp.clear': el => { delete S.wardrobe.tempOverride[el.dataset.d]; save(); render(); },
    'wf': el => { ui.wf = el.dataset.v; render(); },
    'lf': el => { ui.lf = el.dataset.v; render(); },
    'item.new': () => itemDialog(null),
    'item.edit': el => itemDialog(el.dataset.id),
    'item.save': () => saveItem(),
    'item.delete': el => { const id = el.dataset.id; const it = item(id); confirmDlg('Teil löschen?', capF(it.label) + ' wird aus dem Kleiderschrank entfernt. Zum Aufbewahren kannst du es stattdessen auf „Aussortiert“ setzen.', 'Löschen', async () => { S.wardrobe.items = S.wardrobe.items.filter(i => i.id !== id); try { await Photos.del(id); } catch (e) { /* none */ } save(); render(); toast('Gelöscht'); }, true); },
    'item.photo.del': async el => { await Photos.del(el.dataset.id); const art0 = $('#ed-art'); if (art0) art0.innerHTML = G.svg(item(el.dataset.id)); el.remove(); render(); },
    'photos.bulk': () => openDialog(`${dlgHead('Fotos zuordnen')}<p class="how-text">Benenne die Fotos mit der Nummer des Teils, z. B. „5.jpg“ für das Teil Nr. 5, und wähle dann alle auf einmal aus. Schuhe und Teile ohne Nummer ordnest du einzeln über das Teil zu.</p><label class="btn quiet" style="margin-top:14px">${ic('camera')}Fotos wählen<input type="file" accept="image/*" multiple class="sr" data-c="photos.files"></label><div id="bulk-res" style="margin-top:14px"></div>`),
    'import.open': () => importDialog(),
    'import.apply': async el => { const r = mergeImport(ui.importRes, el.dataset.mode); closeDialog(); render(); toast(r.added + ' neu, ' + r.updated + ' aktualisiert' + (r.oCount ? ', ' + r.oCount + ' Outfits' : '')); },
    'csv.template': () => download('kleiderliste-vorlage.csv', '﻿Nr;Kategorie;Bezeichnung;Marke;Farbe;Muster;Material;Struktur;Passform;Formalität;Anzahl;Notiz\n54;Hemd;Oxford-Hemd;Marke;hellblau;uni;Baumwolle;fein;Regular;3;1;\n58;Schuhe;Chelsea Boots;Marke;braun;uni;Wildleder;;;3;1;\n', 'text/csv'),
    // training
    'session.start': el => { if (S.training.active) { location.hash = '#/training/session'; return; } startSession(el.dataset.plan); },
    'session.finish': () => finishSession(),
    'session.discard': () => confirmDlg('Training verwerfen?', 'Alle Einträge dieses Trainings gehen verloren.', 'Verwerfen', () => { S.training.active = null; save(); stopRest(); location.hash = '#/training'; render(); }, true),
    'session.delete': el => confirmDlg('Training löschen?', 'Der Eintrag wird aus dem Verlauf entfernt.', 'Löschen', () => { S.training.sessions = S.training.sessions.filter(s => s.id !== el.dataset.id); save(); render(); }, true),
    'warm': el => { const a = S.training.active; a.warm = a.warm || {}; if (a.warm[el.dataset.i]) delete a.warm[el.dataset.i]; else a.warm[el.dataset.i] = 1; save(); render(); },
    'set.done': el => {
      const a = S.training.active, e = a.entries[+el.dataset.e], st = e.sets[+el.dataset.s], ex = exById(e.ex);
      st.done = !st.done;
      if (st.done) {
        if (st.reps == null || st.reps === '') st.reps = (e.sugg || E.suggestion(S, ex)).reps;
        if ((st.kg === '' || st.kg == null) && ex.type !== 'time') st.kg = (e.sugg || E.suggestion(S, ex)).kg;
        const nextIdx = +el.dataset.e + 1, partner = a.entries[nextIdx];
        const inSs = e.ss && partner && partner.ss === e.ss;
        startRest(inSs ? 20 : ex.rest || 90, ex.name);
      }
      save(); render();
    },
    'set.add': el => { const e = S.training.active.entries[+el.dataset.e]; const lastS = e.sets[e.sets.length - 1]; e.sets.push({ kg: lastS ? lastS.kg : 0, reps: null, done: false }); save(); render(); },
    'set.remove': el => { const e = S.training.active.entries[+el.dataset.e]; if (e.sets.length > 1) e.sets.pop(); save(); render(); },
    'rest.add': () => { rest.end += 15000; rest.over = false; $('#rest').classList.remove('over'); clearInterval(rest.timer); rest.timer = setInterval(tickRest, 250); tickRest(); },
    'rest.stop': () => stopRest(),
    'prog': el => { ui.prog = el.dataset.id; render(); },
    'run.open': () => runDialog(),
    'run.save': () => { const f = new FormData($('#run-form')); const min = +f.get('min'); if (!min) { toast('Bitte die Dauer eintragen.'); return; } S.training.runs.push({ id: uid('r'), date: f.get('date') || E.today(), min, km: +f.get('km') || null, feel: f.get('feel') }); save(); closeDialog(); render(); toast('Lauf gespeichert'); },
    'run.delete': el => confirmDlg('Lauf löschen?', 'Der Eintrag wird entfernt.', 'Löschen', () => { S.training.runs = S.training.runs.filter(r => r.id !== el.dataset.id); save(); render(); }, true),
    'routine.open': el => routineDialog(el.dataset.id),
    'routine.tick': el => { const on = el.getAttribute('aria-pressed') !== 'true'; el.setAttribute('aria-pressed', on); el.closest('li').classList.toggle('done', on); },
    'routine.save': () => { S.training.routineLog.push({ date: E.today(), id: ui.routine.id }); save(); closeDialog(); render(); toast(S.training.routines[ui.routine.id].name + ' erledigt'); },
    'weight.open': () => openDialog(`${dlgHead('Körpergewicht eintragen')}<form class="form-grid" id="w-form" onsubmit="return false"><label class="field"><span>Datum</span><input type="date" name="date" value="${E.today()}"></label><label class="field"><span>Gewicht in kg</span><input type="number" step="0.1" name="kg" autofocus></label></form><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="weight.save">Speichern</button></div>`),
    'weight.save': () => { const f = new FormData($('#w-form')); const kg = +String(f.get('kg')).replace(',', '.'); if (!kg) { toast('Bitte ein Gewicht eintragen.'); return; } const d = f.get('date') || E.today(); S.training.bodyweight = S.training.bodyweight.filter(b => b.date !== d); S.training.bodyweight.push({ date: d, kg }); save(); closeDialog(); render(); },
    'protein.add': el => { const d = el.dataset.d; S.training.protein[d] = (S.training.protein[d] || 0) + (+el.dataset.v); save(); render(); toast('+' + el.dataset.v + ' g Eiweiß', () => { S.training.protein[d] = Math.max(0, (S.training.protein[d] || 0) - (+el.dataset.v)); }); },
    'protein.edit': el => { const d = el.dataset.d; ui.protDate = d; openDialog(`${dlgHead('Eiweiß am Tag korrigieren')}<label class="field"><span>Gramm insgesamt</span><input type="number" id="prot-in" min="0" value="${protTotal(d)}" autofocus></label><p class="hint" style="margin-top:6px">Die eingetragenen Lebensmittel bleiben; die App gleicht nur die Summe an.</p><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Abbrechen</button><button class="btn" data-a="protein.set">Speichern</button></div>`); },
    'protein.set': () => { const d = ui.protDate, want = Math.max(0, +$('#prot-in').value || 0), logP = nlog(d).reduce((s2, e) => s2 + (e.p || 0), 0); S.training.protein[d] = Math.round((want - logP) * 10) / 10; if (!S.training.protein[d]) delete S.training.protein[d]; save(); closeDialog(); render(); },
    // care
    'care.done': el => { const id = el.dataset.id, prev = S.grooming.last[id]; S.grooming.last[id] = el.dataset.d; save(); render(); const t = S.grooming.tasks.find(x => x.id === id); toast(t.name + ' erledigt', () => { if (prev) S.grooming.last[id] = prev; else delete S.grooming.last[id]; }); },
    'shop': el => { const p = S.grooming.products.find(x => x.id === el.dataset.id); p.have = !p.have; save(); render(); },
    // settings
    'theme': el => { S.settings.theme = el.dataset.v; save(true); applyTheme(); render(); },
    'main.dev': el => { S.settings.mainDevice = devOf(el.dataset.v) || 'handy'; save(); render(); },
    'backup.export': () => exportBackup(),
    'reset': () => seedEl()
      ? confirmDlg('Alles zurücksetzen?', 'Trainings, Pflege-Einträge, Bewertungen und Fotos werden gelöscht. Speichere vorher ein Backup, wenn du etwas behalten willst.', 'Alles löschen', async () => { localStorage.removeItem(KEY); await Photos.clear(); S = load(); save(); applyTheme(); location.hash = '#/heute'; render(); toast('Zurückgesetzt'); }, true)
      : confirmDlg('Alles zurücksetzen?', 'Alle Daten und Fotos auf diesem Gerät werden gelöscht. Danach kannst du ein Backup einspielen. Speichere vorher ein Backup, wenn du etwas behalten willst.', 'Alles löschen', async () => { await wipeDevice(); location.hash = '#/heute'; location.reload(); }, true),
    // lock and updates (web version)
    'lock.on': () => lockSetup(),
    'lock.off': async () => { try { const ok = await Lock.disable(); render(); toast(ok ? 'Sperre ausgeschaltet' : 'Nicht bestätigt, die Sperre bleibt an.'); } catch (e) { toast(lockErr(e)); } },
    'lock.now': () => Lock.lockNow(),
    'lock.setup': () => { closeDialog(); lockSetup(); },
    'app.update': () => { if (ui.update) ui.update(); },
    'toast.act': () => { const f = ui.toastAct; ui.toastAct = null; $('#toast').classList.add('hidden'); if (f) f(); },
    'loc.open': el => locDialog(el.dataset.k),
    'loc.clear': () => { S.settings.office = null; save(); refreshWeather(true); render(); },
    'loc.search': async () => {
      const q = $('#loc-q').value.trim(); if (!q) return;
      const box = $('#loc-res'); box.innerHTML = '<p class="small muted">Suche …</p>';
      try {
        const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=de&format=json&name=' + encodeURIComponent(q)).then(x => x.json());
        const res = r.results || [];
        ui.locRes = res;
        box.innerHTML = res.length ? `<ul class="checklist">${res.map((x, i) => `<li><div class="check-body"><div class="check-name">${esc(x.name)}</div><div class="check-meta">${esc([x.admin1, x.country].filter(Boolean).join(', '))}</div></div><button class="btn sm quiet" data-a="loc.pick" data-i="${i}">Übernehmen</button></li>`).join('')}</ul>` : '<p class="small">Kein Ort gefunden.</p>';
      } catch (e) { box.innerHTML = '<p class="small">Die Ortssuche braucht eine Internetverbindung.</p>'; }
    },
    'loc.pick': el => { const x = ui.locRes[+el.dataset.i]; S.settings[ui.locWhich] = { name: x.name + (x.admin1 ? ' (' + x.admin1 + ')' : ''), lat: +x.latitude.toFixed(4), lon: +x.longitude.toFixed(4) }; save(); closeDialog(); refreshWeather(true); refreshEnv(); render(); toast('Ort gespeichert'); }
  };
  const C = {
    'temp.set': el => { const v = el.value.trim(); if (v === '') delete S.wardrobe.tempOverride[el.dataset.d]; else S.wardrobe.tempOverride[el.dataset.d] = +v.replace(',', '.'); save(); render(); },
    'ex.swap': el => { const e = S.training.active.entries[+el.dataset.e]; const id = el.value; if (id === e.ex) return; const ex = exById(id); const sg = E.suggestion(S, ex); e.ex = id; e.sugg = sg; e.sets = Array.from({ length: ex.sets }, () => ({ kg: ex.type === 'time' ? 0 : sg.kg, reps: null, done: false })); save(); render(); },
    'care.last': el => { if (el.value) S.grooming.last[el.dataset.id] = el.value; else delete S.grooming.last[el.dataset.id]; save(); render(); },
    'care.every': el => { const t = S.grooming.tasks.find(x => x.id === el.dataset.id); t.every = Math.max(1, +el.value || t.every); save(); render(); },
    'week': el => { S.settings.week[el.dataset.i] = el.value; save(); render(); },
    'cold': el => { S.settings.coldSensitive = el.checked; save(); render(); },
    'sound': el => { S.settings.sound = el.checked; save(); },
    'set.num': el => { const v = +String(el.value).replace(',', '.'); if (!isNaN(v)) { S.settings[el.dataset.k] = v; save(); render(); } },
    'goal': el => { S.settings.goals[el.dataset.k] = Math.max(0, +el.value || 0); save(); render(); },
    'backup.import': el => { const f = el.files[0]; if (f) importBackup(f); el.value = ''; },
    'item.photo': async el => {
      const f = el.files[0]; if (!f) return;
      try { const blob = await shrink(f); ui.pendingPhoto = blob; const u = URL.createObjectURL(blob); $('#ed-art').innerHTML = `<img src="${u}" alt="Neues Foto">`; toast('Foto übernommen, zum Behalten speichern'); }
      catch (e) { toast('Das Bild konnte nicht gelesen werden. Bitte JPG oder PNG verwenden.'); }
    },
    'photos.files': async el => {
      const files = [...el.files]; const box = $('#bulk-res'); const ok = [], miss = [];
      box.innerHTML = '<p class="small muted">Verarbeite ' + files.length + ' Fotos …</p>';
      for (const f of files) {
        const m = f.name.match(/(\d{1,3})/); const no = m ? +m[1] : null;
        const it = no ? S.wardrobe.items.find(i => (i.nos || []).includes(no)) : null;
        if (!it) { miss.push(f.name); continue; }
        try { await Photos.put(it.id, await shrink(f)); ok.push(capF(it.label) + ' (Nr. ' + no + ')'); } catch (e) { miss.push(f.name); }
      }
      box.innerHTML = `<p class="small"><b>${ok.length} zugeordnet.</b>${miss.length ? ' Nicht zugeordnet: ' + esc(miss.join(', ')) + '.' : ''}</p>`;
      render();
    },
    'import.file': async el => {
      const f = el.files[0]; if (!f) return;
      const box = $('#imp-res'); box.innerHTML = '<p class="small muted">Lese Datei …</p>';
      try {
        const res = await readImport(f); ui.importRes = res;
        const known = res.items.filter(it => it.nos.length && S.wardrobe.items.some(i => (i.nos || []).some(n => it.nos.includes(n)))).length;
        box.innerHTML = res.items.length || res.outfits.length ? `<div class="panel-quiet"><p><b>${res.items.length} Teile</b> erkannt, davon ${known} schon im Schrank (werden aktualisiert, Fotos bleiben).${res.outfits.length ? ' Dazu <b>' + res.outfits.length + ' Outfits</b>; die Outfit-Liste wird ersetzt, Bewertungen bleiben.' : ''}</p></div>
          <div class="sheet-foot"><button class="btn quiet" data-a="import.apply" data-mode="replace">Kleiderliste ersetzen</button><button class="btn" data-a="import.apply" data-mode="merge">Ergänzen</button></div>` : '<p class="small">In der Datei wurde nichts Passendes gefunden. Nutze dein bisheriges Listenformat oder die CSV-Vorlage.</p>';
      } catch (e) { box.innerHTML = '<p class="small">Die Datei konnte nicht gelesen werden: ' + esc(e.message) + '</p>'; }
    }
  };
  const I = {
    'ws': el => { ui.ws = el.value; clearTimeout(ui.wsT); ui.wsT = setTimeout(render, 180); },
    'set.kg': el => { const st = S.training.active.entries[+el.dataset.e].sets[+el.dataset.s]; st.kg = el.value === '' ? '' : +el.value; save(); },
    'set.reps': el => { const st = S.training.active.entries[+el.dataset.e].sets[+el.dataset.s]; st.reps = el.value === '' ? null : +el.value; save(); }
  };

  /*@@UI_HEALTH@@*/

  // ---------- Boot ----------
  function shell() {
    const nav = [['heute', 'today', 'Heute'], ['training', 'training', 'Training'], ['gesundheit', 'health', 'Gesundheit'], ['pflege', 'care', 'Pflege'], ['outfit', 'outfit', 'Outfit'], ['einstellungen', 'settings', 'Einstellungen']];
    const badge = k => (k === 'pflege' || k === 'gesundheit') ? `<span class="badge hidden" data-badge="${k}"></span>` : '';
    document.body.insertAdjacentHTML('afterbegin', G.defs() + `
      <div class="shell">
        <nav class="rail" aria-label="Hauptnavigation"><div class="brand"><div class="brand-name">Chris OS</div><div class="brand-sub">Training, Gesundheit, Pflege, Outfit</div></div>
          ${nav.slice(0, 5).map(([k, i, l]) => `<a class="nav-item" href="#/${k}" data-nav="${k}">${ic(i)}<span>${l}</span>${badge(k)}</a>`).join('')}
          <span class="spacer"></span>
          <a class="nav-item" href="#/einstellungen" data-nav="einstellungen">${ic('settings')}<span>Einstellungen</span></a>
          <p class="rail-foot">Deine Daten bleiben ${WEB ? 'auf diesem Gerät' : 'in diesem Browser'}.</p></nav>
        <main id="view" tabindex="-1"></main>
        <nav class="tabbar" aria-label="Hauptnavigation">${nav.map(([k, i, l]) => `<a href="#/${k}" data-nav="${k}">${ic(i)}<span>${k === 'einstellungen' ? 'Mehr' : l}</span>${badge(k)}</a>`).join('')}</nav>
      </div>
      <div class="rest hidden" id="rest" role="timer" aria-live="polite"><div><div class="rest-time">0:00</div><div class="rest-label"></div></div><button class="btn sm" data-a="rest.add">+15 s</button><button class="btn sm" data-a="rest.stop">Weiter</button></div>
      <div class="toast hidden" id="toast" role="status" aria-live="polite"></div>
      <dialog class="sheet" id="dlg"></dialog>`);
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-a]');
      if (!el) return;
      const fn = A[el.dataset.a];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('change', e => { const el = e.target.closest('[data-c]'); if (el && C[el.dataset.c]) C[el.dataset.c](el, e); });
    document.addEventListener('input', e => { const el = e.target.closest('[data-i]'); if (el && I[el.dataset.i]) I[el.dataset.i](el, e); });
    document.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-a][role="button"]:not(button)')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
      if (e.key === 'Enter' && !e.isComposing && e.target.dataset && e.target.dataset.enter && A[e.target.dataset.enter]) { e.preventDefault(); A[e.target.dataset.enter](e.target, e); }
    });
    $('#dlg').addEventListener('click', e => { if (e.target.id === 'dlg') closeDialog(); });
    window.addEventListener('hashchange', render);
    let rz = null; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(wireCharts, 150); });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); });
    setInterval(() => { const c = document.querySelector('[data-clock]'); if (c) c.textContent = minText(+clockText()); badges(); }, 15000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { vaultOnHidden(); return; } vaultOnVisible(); refreshWeather(); refreshEnv(); refreshTrips(); if (!ui.vault.on) render(); });
  }
  // ---------- Welcome: no data on this device yet ----------
  const LOGO = '<svg viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="116" fill="#3E5C8A"/><path d="M341 171A120 120 0 1 0 341 341" fill="none" stroke="#F4F1EB" stroke-width="58" stroke-linecap="round"/><circle cx="364" cy="256" r="31" fill="#D39A6A"/></svg>';
  function welcome(msg) {
    let w = $('#welcome');
    if (!w) { w = document.createElement('main'); w.id = 'welcome'; w.className = 'welcome'; document.body.prepend(w); }
    w.innerHTML = `<div class="welcome-in">
        <div class="welcome-mark">${LOGO}</div>
        <h1 class="welcome-title">Chris OS</h1>
        <p class="welcome-lead">Auf diesem Gerät sind noch keine Daten. Spiel dein Backup ein, dann geht es weiter, wo du aufgehört hast.</p>
        <label class="btn welcome-btn">${ic('upload')}Backup einspielen<input type="file" accept=".json,application/json" class="sr" id="welcome-file"></label>
        <p class="welcome-msg${msg ? ' err' : ''}" role="status" aria-live="polite">${esc(msg || '')}</p>
        <ol class="welcome-steps">
          <li>${DEVICE === 'pc' ? 'Am Handy in Chris OS: Mehr, Daten, „Backup speichern“.' : 'Am PC in Chris OS: Einstellungen, Daten, „Backup speichern“.'}</li>
          <li>Die Datei per Kabel oder Quick Share auf dieses Gerät holen, nicht über die Cloud.</li>
          <li>Hier auf „Backup einspielen“ ${DEVICE === 'pc' ? 'klicken' : 'tippen'} und die Datei wählen.</li>
        </ol>
        ${installHint()}
        <p class="welcome-foot">Ein Konto oder eine Anmeldung gibt es nicht. Deine Daten bleiben auf diesem Gerät, ohne Cloud.</p>
      </div>`;
    $('#welcome-file').addEventListener('change', async e => {
      const f = e.target.files[0];
      if (!f) return;
      $('.welcome-msg').textContent = 'Lese das Backup …';
      const r = await readBackup(f);
      if (r.err) { welcome(r.err); return; }
      try { await applyBackup(r.data); }
      catch (err) { S = null; welcome('Das Backup ließ sich nicht einspielen. Versuch es noch einmal.'); return; }
      w.remove();
      location.hash = '#/heute';
      start();
      toast('Backup geladen. Schön, dass du da bist.');
      offerLock();
    });
  }

  // ---------- Lock and updates (web version) ----------
  async function wipeDevice() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(WXKEY); } catch (e) { /* storage blocked */ }
    try { if (Photos.db) { Photos.db.close(); Photos.db = null; } } catch (e) { /* already closed */ }
    await new Promise(res => { try { const r = indexedDB.deleteDatabase('haltung-fotos'); r.onsuccess = r.onerror = r.onblocked = () => res(); } catch (e) { res(); } });
  }
  // Web version in a browser tab: how to install it as an app (K40: also on the PC)
  function installHint() {
    let app = false;
    try { app = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { /* old browser */ }
    if (!WEB || app) return '';
    return `<p class="welcome-tip">${DEVICE === 'pc' ? 'Als App installieren: in Chrome oder Edge über das Symbol rechts in der Adressleiste.' : 'Als App installieren: in Chrome Menü ⋮, „Zum Startbildschirm hinzufügen“.'}</p>`;
  }
  const lockName = () => HELLO ? 'Sperre mit Windows Hello' : 'Fingerabdruck-Sperre';
  function lockErr(e) {
    if (e && e.message === 'unsupported') return 'Dieses Gerät unterstützt die Sperre hier nicht.';
    if (e && e.name === 'NotAllowedError') return 'Abgebrochen. Versuch es noch einmal, wenn du so weit bist.';
    return 'Das hat nicht geklappt. Versuch es noch einmal.';
  }
  async function lockSetup() {
    try { await Lock.enable(); render(); toast('Sperre eingerichtet. Ab jetzt fragt die App nach ' + (HELLO ? 'Windows Hello.' : 'deinem Fingerabdruck.')); }
    catch (e) { toast(lockErr(e)); }
  }
  async function offerLock() {
    if (!WEB || Lock.status().enabled) return;
    if (ui.lockOk == null) ui.lockOk = await Lock.supported();
    if (!ui.lockOk) return;
    openDialog(`${dlgHead(lockName() + ' einrichten?')}<p class="how-text">Dann fragt die App beim Öffnen und nach einer Minute im Hintergrund nach ${HELLO ? 'Windows Hello, also Gesicht, Fingerabdruck oder PIN' : 'deinem Fingerabdruck, Gesicht oder der Geräte-PIN'}. Die Daten bleiben dabei auf diesem Gerät.</p><div class="sheet-foot"><button class="btn quiet" data-a="dlg.close">Später</button><button class="btn" data-a="lock.setup">Einrichten</button></div>`);
  }
  function notice(msg, label, fn) {
    const t = $('#toast');
    if (!t) return;
    clearTimeout(toastTimer);
    t.innerHTML = `<span>${esc(msg)}</span><button data-a="toast.act">${esc(label)}</button>`;
    t.classList.remove('hidden');
    ui.toastAct = fn;
  }
  function offerUpdate(apply) {
    ui.update = apply;
    notice('Neue Version bereit', 'Jetzt laden', apply);
    // Not while the vault is open on this page: a rebuild would drop what is being typed there
    if (S && $('#view') && route().top === 'einstellungen' && !ui.vault.on) render();
  }

  function start() {
    shell();
    render();
    persistStorage();
    refreshWeather();
    refreshEnv();
    refreshTrips();
    if (ui.update) notice('Neue Version bereit', 'Jetzt laden', ui.update);
  }
  async function boot() {
    S = load(); applyTheme(); loadWx();
    if (WEB) {
      Lock.init({ appName: 'Chris OS', grace: 60, method: HELLO ? 'Windows Hello' : 'Fingerabdruck', onReset: wipeDevice }).then(r => { ui.lockOk = r.supported; if (S && $('#view') && route().top === 'einstellungen' && !ui.vault.on) render(); });
      PWA.init({ onUpdate: offerUpdate });
    }
    if (!S) { welcome(); return; }
    await Photos.loadAll();
    start();
  }
  window.HaltungDebug = { get state() { return S; }, render, E, H: window.Health, migrate };
  boot();
})();
