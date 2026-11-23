/* Vault (2.12): an encrypted room inside the app. Everything in it is stored only as ciphertext, on the device
   and in the backup. The data key is random; it is wrapped once with a key from a passphrase (PBKDF2) and, per
   device, with a key from the passkey's PRF output (HKDF). Pure logic, runs in the browser and in Node. */
(function (root) {
  'use strict';
  const cryptoObj = root.crypto && root.crypto.subtle ? root.crypto : (typeof require !== 'undefined' ? require('crypto').webcrypto : null);
  const subtle = cryptoObj.subtle;
  const te = new TextEncoder(), td = new TextDecoder();
  const V = 1, ITERS = 600000, MIN_PASS = 12;
  const AAD = te.encode('chrisos-vault-' + V);

  const b64u = buf => { const a = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const rand = n => cryptoObj.getRandomValues(new Uint8Array(n));
  const now = () => new Date().toISOString();

  // ---------- Keys ----------
  async function kekFromPass(pass, salt, iters) {
    const base = await subtle.importKey('raw', te.encode(String(pass).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iters }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function kekFromPrf(bytes, salt) {
    const base = await subtle.importKey('raw', bytes, 'HKDF', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('chrisos-vault-prf') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const dataKey = raw => subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function enc(key, bytes) {
    const iv = rand(12);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, bytes);
    return { iv: b64u(iv), ct: b64u(ct) };
  }
  async function dec(key, box) {
    return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: unb64u(box.iv), additionalData: AAD }, key, unb64u(box.ct)));
  }

  // ---------- Header (what is stored) ----------
  // { v, id, at, kdf: { salt, iters }, pass: box(dataKey), prfEval: salt for the authenticator, prf: { credId: { salt, iv, ct } }, data: box(content) }
  function passOk(p) { return typeof p === 'string' && p.normalize('NFKC').length >= MIN_PASS; }
  async function create(pass, content) {
    if (!passOk(pass)) throw new Error('pass');
    const raw = rand(32), salt = rand(16);
    const kek = await kekFromPass(pass, salt, ITERS);
    const hdr = { v: V, id: b64u(rand(8)), at: now(), kdf: { salt: b64u(salt), iters: ITERS }, pass: await enc(kek, raw), prfEval: b64u(rand(32)), prf: {}, data: null };
    const session = { raw, key: await dataKey(raw) };
    await write(hdr, session, content || empty());
    return { hdr, session };
  }
  async function openPass(hdr, pass) {
    try {
      const kek = await kekFromPass(pass, unb64u(hdr.kdf.salt), hdr.kdf.iters);
      const raw = await dec(kek, hdr.pass);
      return { raw, key: await dataKey(raw) };
    } catch (e) { return null; }
  }
  async function openPrf(hdr, credId, bytes) {
    const w = hdr.prf && hdr.prf[credId];
    if (!w) return null;
    try {
      const kek = await kekFromPrf(bytes, unb64u(w.salt));
      const raw = await dec(kek, { iv: w.iv, ct: w.ct });
      return { raw, key: await dataKey(raw) };
    } catch (e) { return null; }
  }
  async function addPrf(hdr, session, credId, bytes) {
    const salt = rand(16);
    const kek = await kekFromPrf(bytes, salt);
    hdr.prf = hdr.prf || {};
    hdr.prf[credId] = Object.assign({ salt: b64u(salt), at: now() }, await enc(kek, session.raw));
    return hdr;
  }
  function removePrf(hdr, credId) { if (hdr.prf) delete hdr.prf[credId]; return hdr; }
  async function changePass(hdr, session, pass) {
    if (!passOk(pass)) throw new Error('pass');
    const salt = rand(16);
    const kek = await kekFromPass(pass, salt, ITERS);
    hdr.kdf = { salt: b64u(salt), iters: ITERS };
    hdr.pass = await enc(kek, session.raw);
    return hdr;
  }
  async function read(hdr, session) {
    const bytes = await dec(session.key, hdr.data);
    return migrate(JSON.parse(td.decode(bytes)));
  }
  async function write(hdr, session, content) {
    content.updated = now();
    hdr.data = await enc(session.key, te.encode(JSON.stringify(content)));
    hdr.at = now();
    return hdr;
  }

  // ---------- Content ----------
  function empty() {
    return { v: 1, names: { me: '', partner: '', child: '' }, sections: [], patterns: [], entries: [], preps: [], checkins: {}, resets: [], chats: [], nextId: 1, updated: now() };
  }
  function migrate(c) {
    const e = empty();
    for (const k of Object.keys(e)) if (c[k] === undefined) c[k] = e[k];
    c.names = Object.assign({ me: '', partner: '', child: '' }, c.names || {});
    return c;
  }
  const nextId = c => c.nextId++;
  const KINDS = [['konflikt', 'Konflikt', 'Ein Streit oder eine angespannte Situation'], ['gespraech', 'Gespräch', 'Ein Gespräch, das ihr geführt habt'], ['reflexion', 'Reflexion', 'Gedanken und Einsichten ohne konkreten Anlass'], ['vorfall', 'Vorfall', 'Ein einschneidendes Ereignis']];
  const kindLabel = k => { const x = KINDS.find(y => y[0] === k); return x ? x[1] : k; };
  const PATTERN_KINDS = { kern: 'Kernmuster', ergaenzend: 'Ergänzend', eigen: 'Eigenes Muster' };
  const LEITSAETZE = [
    'Veränderung ja, aber für dich. Nicht als Friedensangebot.',
    'Erst das Berechtigte anerkennen, dann der eigene Punkt.',
    'Den wunden Punkt zeigen statt zurückzuschießen.',
    'Augenhöhe statt Benotung.',
    'Stopp sagen und trotzdem im Kontakt bleiben.',
    'Ruhige Präsenz trägt weiter als der schnelle Cut.',
    'Ironie ist ein Brandbeschleuniger.',
    'Deine eigenen Worte dürfen holpern. Hauptsache, sie sind deine.'
  ];
  function leitsatz(date) {
    const d = new Date(date + 'T12:00:00'), s = new Date(d.getFullYear(), 0, 0);
    const doy = Math.floor((d - s) / 864e5);
    return LEITSAETZE[doy % LEITSAETZE.length];
  }
  const slugOf = s => String(s).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'muster';
  // Entries in the order of the chronology: dated ones by date, undated ones first by sequence
  function sortedEntries(c) {
    return c.entries.slice().sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : (a.date || '') > (b.date || '') ? 1 : (a.seq || 0) - (b.seq || 0) || a.id - b.id));
  }
  function addEntry(c, draft) {
    const e = Object.assign({ id: nextId(c), kind: 'reflexion', title: '', date: null, seq: 0, trigger: '', narrative: '', insight: '', dynamics: '', needsSelf: [], needsPartner: [], ownPart: '', nextStep: '', patterns: [], source: 'manuell', analysis: 'keine', created: now(), updated: now() }, draft);
    c.entries.push(e); return e;
  }
  function addPattern(c, draft) {
    const p = Object.assign({ id: nextId(c), slug: '', name: '', kind: 'eigen', summary: '', description: '', guideline: '', order: 100 + c.patterns.length, created: now() }, draft);
    if (!p.slug) p.slug = slugOf(p.name);
    c.patterns.push(p); return p;
  }
  function addPrep(c, draft) {
    const p = Object.assign({ id: nextId(c), title: '', situation: '', goal: '', validation: '', woundedPoint: '', eyeLevel: '', stopSignal: '', feedback: '', debrief: '', status: 'entwurf', entryId: null, created: now(), updated: now() }, draft);
    c.preps.push(p); return p;
  }
  function addReset(c, draft) {
    const r = Object.assign({ id: nextId(c), variant: 'kurz', before: null, after: null, intention: '', parked: [], at: now() }, draft);
    c.resets.push(r); return r;
  }
  // Where a pattern showed up: rows = patterns, columns = entries
  function matrix(c) {
    const E = sortedEntries(c);
    return { entries: E, rows: c.patterns.slice().sort((a, b) => a.order - b.order).map(p => ({ p, cells: E.map(e => (e.patterns || []).find(x => x.id === p.id) || null), n: E.filter(e => (e.patterns || []).some(x => x.id === p.id)).length })) };
  }
  const prepStatus = { entwurf: 'Entwurf', bereit: 'Bereit', nachbereitet: 'Nachbereitet' };

  // ---------- Check-in: motives ----------
  const MOTIVES = [
    ['freude', 'Weil es mir guttut', 'eigen'], ['streit-vermeiden', 'Um Streit zu vermeiden', 'angst'], ['energie', 'Für meine Energie und Gesundheit', 'eigen'],
    ['friedensangebot', 'Damit {partner} zufrieden ist', 'angst'], ['kopf-frei', 'Um den Kopf freizukriegen', 'eigen'], ['schlechtes-gewissen', 'Aus schlechtem Gewissen', 'angst'],
    ['lust', 'Weil ich Lust darauf hatte', 'eigen'], ['beweisen', 'Um zu beweisen, dass ich mich ändere', 'angst'], ['stolz-auf-mich', 'Weil ich auf mich stolz sein will', 'eigen'],
    ['kritik-zuvorkommen', 'Um Kritik zuvorzukommen', 'angst']
  ];
  const motiveLabel = (code, partner) => { const m = MOTIVES.find(x => x[0] === code); return m ? m[1].replace('{partner}', partner || 'deine Partnerin') : code; };
  const isFear = code => { const m = MOTIVES.find(x => x[0] === code); return !!m && m[2] === 'angst'; };
  function classifyMotives(codes) {
    const known = (codes || []).filter(c => MOTIVES.some(m => m[0] === c));
    if (!known.length) return null;
    const fear = known.filter(isFear).length;
    return fear === 0 ? 'eigen' : fear === known.length ? 'angst' : 'gemischt';
  }
  const SLEEP_QUALITY = ['sehr schlecht', 'schlecht', 'okay', 'gut', 'erholsam'];
  const ME_TIME = [0, 15, 30, 60, 90], SPORT = [0, 15, 30, 45, 60];

  // ---------- Draft check: textbook or AI tone, and the own conversation traps ----------
  const RULES = [
    ['gedankenstrich', 'klang', 'Langer Gedankenstrich', 'Den langen Strich (—) tippt im Alltag fast niemand. Er gilt als typisches KI-Merkmal.', /—/g],
    ['wahrnehmen', 'klang', 'Therapeutensprache', '„Ich nehme wahr“ klingt nach Seminar, nicht nach dir.', /\bich nehme\b[^.!?\n]{0,40}\bwahr\b/gi],
    ['anerkennen', 'klang', 'Therapeutensprache', 'Sag lieber direkt, was du verstehst, statt es „anzuerkennen“.', /\b(?:möchte|will|wollte)\b[^.!?\n]{0,30}\b(?:anerkennen|würdigen|validieren)\b/gi],
    ['anliegen', 'klang', 'Formelhaft', '„Es ist mir ein Anliegen“ klingt nach Brief vom Amt.', /\bes ist mir (?:ein |ein großes |ein wichtiges )?anliegen\b/gi],
    ['raum', 'klang', 'Therapeutensprache', '„Raum halten/geben“ ist Fachjargon.', /\braum (?:zu )?(?:halten|geben|schaffen|lassen)\b/gi],
    ['beduerfnisse', 'klang', 'Therapeutensprache', 'Statt „Bedürfnisse kommunizieren“: sag einfach, was du dir wünschst.', /\bbedürfnisse?\b[^.!?\n]{0,25}\b(?:kommunizieren|äußern|ausdrücken|artikulieren)\b/gi],
    ['validieren', 'klang', 'Fachwort', '„Validieren“ benutzt im Alltag kaum jemand.', /\bvalidier\w*\b/gi],
    ['gesehen-gehoert', 'klang', 'Formelhaft', '„Gesehen und gehört“ ist eine Floskel aus Ratgebern.', /\b(?:gesehen und gehört|gehört und gesehen)\b/gi],
    ['perspektive', 'klang', 'Formelhaft', '„Deine Perspektive“ klingt distanziert. Wie würdest du es mündlich sagen?', /\bdeine (?:perspektive|sichtweise)\b/gi],
    ['reflektiert', 'klang', 'Formelhaft', '„Ich habe reflektiert“ klingt nach Bericht. Was hast du konkret gemerkt?', /\bich habe\b[^.!?\n]{0,20}\breflektiert\b/gi],
    ['ja-aber', 'falle', 'Ja, aber', 'Das „aber“ entwertet den ersten Teil. Lass das Berechtigte erst mal stehen.', /\b(?:ja|stimmt|verstehe ich|klar|okay|ok)\b[,.]?\s+aber\b/gi],
    ['verallgemeinerung', 'falle', 'Verallgemeinerung', '„Immer“ und „nie“ laden zum Gegenbeweis ein.', /\b(?:immer|nie|niemals|ständig|jedes mal)\b/gi],
    ['stolz', 'falle', 'Unterordnung', 'Du brauchst keine Benotung, sondern Augenhöhe.', /\bstolz auf mich\b/gi],
    ['abhaken', 'falle', 'Abhaken-Impuls', 'Erst ankommen lassen, dann abschließen.', /\b(?:abhaken|abgehakt|schwamm drüber|lass uns das vergessen|thema erledigt)\b/gi],
    ['rechtfertigung', 'falle', 'Rechtfertigung', 'Klingt nach Verteidigung. Was ist das Gefühl dahinter?', /\b(?:ich wollte doch nur|das habe ich doch schon|ich hab doch schon|du hast doch auch|du doch auch)\b/gi],
    ['ironie', 'falle', 'Möglicher Ironie-Ton', 'Kann schnell ironisch ankommen.', /\b(?:na toll|herzlichen glückwunsch|schön für dich|wie du meinst|wenn du meinst)\b/gi]
  ].map(([id, kind, label, hint, re]) => ({ id, kind, label, hint, re }));
  function check(text) {
    const F = [];
    for (const r of RULES) {
      r.re.lastIndex = 0;
      let m;
      while ((m = r.re.exec(text)) !== null) { F.push({ id: r.id, kind: r.kind, label: r.label, hint: r.hint, start: m.index, end: m.index + m[0].length, text: m[0] }); if (!m[0].length) r.re.lastIndex++; }
    }
    F.sort((a, b) => a.start - b.start || b.end - a.end);
    const out = []; let last = -1;
    for (const f of F) if (f.start >= last) { out.push(f); last = f.end; }
    return out;
  }
  const words = t => (String(t).trim() ? String(t).trim().split(/\s+/).length : 0);

  // ---------- Import and export in the shape of the Resonanzraum export ----------
  function isResonanz(j) { return !!j && typeof j === 'object' && (j.app === 'Resonanzraum' || (Array.isArray(j.muster) && Array.isArray(j.eintraege))); }
  function importResonanz(c, j) {
    if (!isResonanz(j)) throw new Error('format');
    const n = { sections: 0, patterns: 0, entries: 0, preps: 0, checkins: 0, resets: 0, chats: 0 };
    // Names travel only in the start package; they fill empty fields
    if (j.namen && typeof j.namen === 'object') for (const k of ['me', 'partner', 'child']) if (!c.names[k] && j.namen[k]) c.names[k] = String(j.namen[k]).trim();
    const pid = new Map(), eid = new Map();
    const s = v => (v == null ? '' : String(v));
    const arr = v => (Array.isArray(v) ? v.map(String) : typeof v === 'string' ? (() => { try { const a = JSON.parse(v); return Array.isArray(a) ? a.map(String) : []; } catch (e) { return []; } })() : []);
    for (const x of j.ausgangslage || []) {
      const old = c.sections.find(y => y.slug === x.slug);
      if (old) { old.title = s(x.title); old.content = s(x.content); old.order = x.sortOrder ?? old.order; }
      else c.sections.push({ id: nextId(c), slug: s(x.slug), title: s(x.title), content: s(x.content), order: x.sortOrder ?? 100 });
      n.sections++;
    }
    for (const x of j.muster || []) {
      let p = c.patterns.find(y => y.slug === x.slug);
      if (p) Object.assign(p, { name: s(x.name), kind: x.kind || p.kind, summary: s(x.summary), description: s(x.description), guideline: s(x.guideline), order: x.sortOrder ?? p.order });
      else p = addPattern(c, { slug: s(x.slug), name: s(x.name), kind: x.kind || 'eigen', summary: s(x.summary), description: s(x.description), guideline: s(x.guideline), order: x.sortOrder ?? 100 });
      pid.set(x.id, p.id); n.patterns++;
    }
    const links = j.eintragMuster || [];
    for (const x of j.eintraege || []) {
      const e = addEntry(c, { kind: x.kind || 'reflexion', title: s(x.title), date: x.occurredOn || null, seq: x.sequence || 0, trigger: s(x.trigger), narrative: s(x.narrative), insight: s(x.insight), dynamics: s(x.dynamics), needsSelf: arr(x.needsSelf), needsPartner: arr(x.needsPartner), ownPart: s(x.ownPart), nextStep: s(x.nextStep), source: x.source || 'manuell', analysis: x.analysisStatus || (x.dynamics ? 'fertig' : 'keine'), created: x.createdAt || now(), updated: x.updatedAt || now() });
      e.patterns = links.filter(l => l.entryId === x.id && pid.has(l.patternId)).map(l => ({ id: pid.get(l.patternId), note: s(l.note) }));
      eid.set(x.id, e.id); n.entries++;
    }
    for (const x of j.vorbereitungen || []) {
      addPrep(c, { title: s(x.title), situation: s(x.situation), goal: s(x.goal), validation: s(x.validation), woundedPoint: s(x.woundedPoint), eyeLevel: s(x.eyeLevel), stopSignal: s(x.stopSignal), feedback: s(x.feedback), debrief: s(x.debrief), status: x.status || 'entwurf', entryId: eid.get(x.entryId) || null, created: x.createdAt || now(), updated: x.updatedAt || now() });
      n.preps++;
    }
    for (const x of j.checkins || []) {
      if (!x.date) continue;
      c.checkins[x.date] = { sleepHours: x.sleepHours ?? null, sleepQuality: x.sleepQuality ?? null, energy: x.energy ?? null, stress: x.stress ?? null, meTime: x.meTimeMinutes ?? null, social: x.socialContact == null ? null : !!x.socialContact, sport: x.sportMinutes ?? null, sportType: s(x.sportType), selfCare: s(x.selfCare), motivations: arr(x.motivations), motivationType: x.motivationType || null, ownReason: s(x.ownReason), note: s(x.note), t: x.updatedAt || now() };
      n.checkins++;
    }
    for (const x of j.resets || []) { addReset(c, { variant: x.variant || 'kurz', before: x.tensionBefore ?? null, after: x.tensionAfter ?? null, intention: s(x.intention), parked: arr(x.parked), at: x.completedAt || now() }); n.resets++; }
    const msgs = j.nachrichten || [];
    for (const g of j.gespraeche || []) { c.chats.push({ id: nextId(c), title: s(g.title), entryId: eid.get(g.entryId) || null, created: g.createdAt || now(), messages: msgs.filter(m => m.conversationId === g.id).map(m => ({ role: m.role, content: s(m.content), at: m.createdAt })) }); n.chats++; }
    return n;
  }
  function exportResonanz(c) {
    const links = [];
    c.entries.forEach(e => (e.patterns || []).forEach(l => links.push({ entryId: e.id, patternId: l.id, note: l.note || null, source: 'manuell' })));
    const msgs = [];
    c.chats.forEach(g => (g.messages || []).forEach((m, i) => msgs.push({ id: g.id * 1000 + i, conversationId: g.id, role: m.role, content: m.content, createdAt: m.at })));
    return {
      exportiertAm: now(), app: 'Resonanzraum', von: 'Chris OS',
      ausgangslage: c.sections.map(x => ({ id: x.id, slug: x.slug, title: x.title, content: x.content, sortOrder: x.order })),
      muster: c.patterns.map(p => ({ id: p.id, slug: p.slug, name: p.name, kind: p.kind, summary: p.summary, description: p.description, guideline: p.guideline || null, sortOrder: p.order })),
      eintraege: c.entries.map(e => ({ id: e.id, kind: e.kind, title: e.title, occurredOn: e.date, sequence: e.seq, trigger: e.trigger || null, narrative: e.narrative, insight: e.insight || null, dynamics: e.dynamics || null, needsSelf: e.needsSelf, needsPartner: e.needsPartner, ownPart: e.ownPart || null, nextStep: e.nextStep || null, analysisStatus: e.analysis || 'keine', source: e.source, createdAt: e.created, updatedAt: e.updated })),
      eintragMuster: links,
      gespraeche: c.chats.map(g => ({ id: g.id, title: g.title, entryId: g.entryId, createdAt: g.created })),
      nachrichten: msgs,
      vorbereitungen: c.preps.map(p => ({ id: p.id, title: p.title, situation: p.situation, goal: p.goal, validation: p.validation, woundedPoint: p.woundedPoint, eyeLevel: p.eyeLevel, stopSignal: p.stopSignal, feedback: p.feedback || null, debrief: p.debrief || null, status: p.status, entryId: p.entryId, createdAt: p.created, updatedAt: p.updated })),
      checkins: Object.entries(c.checkins).map(([date, x], i) => ({ id: i + 1, date, sleepHours: x.sleepHours, sleepQuality: x.sleepQuality, energy: x.energy, stress: x.stress, meTimeMinutes: x.meTime, socialContact: x.social, sportMinutes: x.sport, sportType: x.sportType || null, selfCare: x.selfCare || null, motivations: x.motivations, motivationType: x.motivationType, ownReason: x.ownReason || null, note: x.note || null })),
      resets: c.resets.map(r => ({ id: r.id, variant: r.variant, tensionBefore: r.before, tensionAfter: r.after, intention: r.intention || null, parked: r.parked, completedAt: r.at }))
    };
  }
  // Short lines for the overview
  function stats(c) {
    return { entries: c.entries.length, patterns: c.patterns.length, preps: c.preps.length, checkins: Object.keys(c.checkins).length, resets: c.resets.length };
  }

  const api = { V, ITERS, MIN_PASS, b64u, unb64u, rand, passOk, create, openPass, openPrf, addPrf, removePrf, changePass, read, write, empty, migrate, nextId, KINDS, kindLabel, PATTERN_KINDS, LEITSAETZE, leitsatz, slugOf, sortedEntries, addEntry, addPattern, addPrep, addReset, matrix, prepStatus, MOTIVES, motiveLabel, isFear, classifyMotives, SLEEP_QUALITY, ME_TIME, SPORT, RULES, check, words, isResonanz, importResonanz, exportResonanz, stats };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Vault = api;
})(typeof window !== 'undefined' ? window : globalThis);
