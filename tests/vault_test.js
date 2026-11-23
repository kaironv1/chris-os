// Verschlüsselter Raum (2.12): Schlüssel aus Passphrase und PRF, Verpacken des Datenschlüssels, Lesen und Schreiben,
// Passphrase ändern, Inhalt, Import und Export im Format von Resonanzraum, Matrix, Motive, Klang-Check. Erfundene Daten.
'use strict';
const assert = require('assert');
const V = require('../src/vault.js');
let n = 0;
const eq = (a, b, m) => { assert.deepStrictEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };
const PASS = 'sieben rote fahrräder am fluss';

(async () => {
  // 1. Anlegen, Öffnen, falsche Passphrase, zu kurze Passphrase
  ok(!V.passOk('kurz') && !V.passOk(null) && V.passOk('zwölf zeichen!') && V.passOk('x'.repeat(12)));
  await assert.rejects(V.create('kurz'), /pass/); n++;
  const { hdr, session } = await V.create(PASS);
  eq(Object.keys(hdr), ['v', 'id', 'at', 'kdf', 'pass', 'prfEval', 'prf', 'data']);
  eq([hdr.v, hdr.kdf.iters, V.unb64u(hdr.kdf.salt).length, V.unb64u(hdr.prfEval).length, V.unb64u(hdr.data.iv).length, hdr.prf], [1, 600000, 16, 32, 12, {}]);
  const s2 = await V.openPass(hdr, PASS);
  ok(s2 && V.b64u(s2.raw) === V.b64u(session.raw), 'derselbe Datenschlüssel');
  eq([await V.openPass(hdr, PASS + ' '), await V.openPass(hdr, ''), await V.openPass(hdr, 'Sieben rote fahrräder am fluss')], [null, null, null]);
  // Unicode-Normalisierung: zusammengesetztes und zerlegtes ä sind gleich
  ok(await V.openPass(hdr, PASS.normalize('NFD')), 'NFD-Form öffnet');
  // 2. Inhalt lesen und schreiben, Chiffrat wechselt bei jedem Schreiben
  let c = await V.read(hdr, s2);
  eq([c.v, c.names, c.entries, c.nextId], [1, { me: '', partner: '', child: '' }, [], 1]);
  c.names.partner = 'Mia';
  const ct1 = hdr.data.ct;
  await V.write(hdr, s2, c);
  ok(hdr.data.ct !== ct1 && !JSON.stringify(hdr).includes('Mia'), 'nichts im Klartext');
  eq((await V.read(hdr, s2)).names.partner, 'Mia');
  // Manipuliertes Chiffrat wird abgewiesen
  const bad = JSON.parse(JSON.stringify(hdr)); bad.data.ct = bad.data.ct.slice(0, -4) + (bad.data.ct.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  await assert.rejects(V.read(bad, s2)); n++;
  // 3. PRF-Verpackung je Gerät
  const prf = V.rand(32), prf2 = V.rand(32);
  await V.addPrf(hdr, s2, 'cred-a', prf);
  eq(Object.keys(hdr.prf), ['cred-a']);
  ok((await V.openPrf(hdr, 'cred-a', prf)) && V.b64u((await V.openPrf(hdr, 'cred-a', prf)).raw) === V.b64u(session.raw));
  eq([await V.openPrf(hdr, 'cred-a', prf2), await V.openPrf(hdr, 'cred-b', prf)], [null, null]);
  await V.addPrf(hdr, s2, 'cred-b', prf2);
  ok(await V.openPrf(hdr, 'cred-b', prf2));
  V.removePrf(hdr, 'cred-a');
  eq([Object.keys(hdr.prf), await V.openPrf(hdr, 'cred-a', prf)], [['cred-b'], null]);
  // 4. Passphrase ändern: alte geht nicht mehr, PRF bleibt
  await V.changePass(hdr, s2, 'neue lange passphrase 42');
  eq(await V.openPass(hdr, PASS), null);
  ok(await V.openPass(hdr, 'neue lange passphrase 42') && await V.openPrf(hdr, 'cred-b', prf2));
  await assert.rejects(V.changePass(hdr, s2, 'kurz'), /pass/); n++;
  // 5. Inhalt: Einträge, Muster, Vorbereitungen, Resets, Sortierung, Matrix
  c = V.empty();
  const p1 = V.addPattern(c, { name: 'Kreislauf A', kind: 'kern', summary: 'S', description: 'D' });
  const p2 = V.addPattern(c, { name: 'Ironie als Ventil', summary: 'S2', description: 'D2' });
  eq([p1.slug, p2.slug, p2.kind, p1.id, p2.id], ['kreislauf-a', 'ironie-als-ventil', 'eigen', 1, 2]);
  const e1 = V.addEntry(c, { title: 'Erster Vorfall', kind: 'vorfall', date: null, seq: 2, patterns: [{ id: 1, note: 'Logistik' }] });
  const e2 = V.addEntry(c, { title: 'Später', kind: 'gespraech', date: '2026-11-10' });
  const e3 = V.addEntry(c, { title: 'Ganz am Anfang', kind: 'vorfall', date: null, seq: 1, patterns: [{ id: 1, note: '' }, { id: 2, note: 'x' }] });
  eq(V.sortedEntries(c).map(e => e.title), ['Ganz am Anfang', 'Erster Vorfall', 'Später']);
  const M = V.matrix(c);
  eq([M.rows.map(r => [r.p.name, r.n]), M.rows[0].cells.map(x => !!x)], [[['Kreislauf A', 2], ['Ironie als Ventil', 1]], [true, true, false]]);
  eq([V.kindLabel('vorfall'), V.kindLabel('gespraech'), V.kindLabel('x'), V.KINDS.length, V.PATTERN_KINDS.kern], ['Vorfall', 'Gespräch', 'x', 4, 'Kernmuster']);
  const pr = V.addPrep(c, { title: 'T', entryId: e2.id });
  eq([pr.status, pr.validation, V.prepStatus.bereit], ['entwurf', '', 'Bereit']);
  const r = V.addReset(c, { variant: 'kurz', before: 7, after: 3, intention: 'ruhig', parked: ['Mail'] });
  eq([r.variant, r.parked, typeof r.at], ['kurz', ['Mail'], 'string']);
  eq(V.stats(c), { entries: 3, patterns: 2, preps: 1, checkins: 0, resets: 1 });
  eq([V.leitsatz('2026-01-01'), V.LEITSAETZE.length, V.leitsatz('2026-01-09') === V.leitsatz('2026-01-01')], [V.LEITSAETZE[1], 8, true]);
  eq(V.slugOf('Rückzug & Schweigen!'), 'rueckzug-schweigen');
  // 6. Motive
  eq([V.classifyMotives([]), V.classifyMotives(['freude']), V.classifyMotives(['streit-vermeiden']), V.classifyMotives(['freude', 'beweisen']), V.classifyMotives(['unbekannt'])], [null, 'eigen', 'angst', 'gemischt', null]);
  eq([V.motiveLabel('friedensangebot', 'Mia'), V.motiveLabel('friedensangebot', ''), V.isFear('kritik-zuvorkommen'), V.isFear('lust')], ['Damit Mia zufrieden ist', 'Damit deine Partnerin zufrieden ist', true, false]);
  eq([V.SLEEP_QUALITY.length, V.ME_TIME, V.SPORT], [5, [0, 15, 30, 60, 90], [0, 15, 30, 45, 60]]);
  // 7. Klang-Check
  let F = V.check('Ja, aber ich nehme schon wahr, dass du immer so planst — das validiere ich.');
  eq(F.map(f => [f.id, f.kind, f.text]), [['ja-aber', 'falle', 'Ja, aber'], ['wahrnehmen', 'klang', 'ich nehme schon wahr'], ['verallgemeinerung', 'falle', 'immer'], ['gedankenstrich', 'klang', '—'], ['validieren', 'klang', 'validiere']]);
  ok(F.every((f, i) => i === 0 || f.start >= F[i - 1].end), 'keine Überlappungen');
  eq(V.check('Danke, dass du das gesagt hast. Mich trifft das.'), []);
  eq(V.check('Na toll. Schwamm drüber, ich wollte doch nur helfen.').map(f => f.id), ['ironie', 'abhaken', 'rechtfertigung']);
  eq([V.words(''), V.words('  ein  Wort '), V.words('a b\nc')], [0, 2, 3]);
  eq(V.RULES.length, 16);
  // 8. Import im Export-Format und Export zurück
  const J = { app: 'Resonanzraum', ausgangslage: [{ id: 5, slug: 'personen', title: 'Personen', content: 'Zwei und ein Hund.', sortOrder: 10 }],
    muster: [{ id: 7, slug: 'kreislauf-a', name: 'Kreislauf A neu', kind: 'kern', summary: 'S neu', description: 'D neu', guideline: 'G', sortOrder: 5 }, { id: 8, slug: 'neu', name: 'Neues', kind: 'ergaenzend', summary: 'x', description: 'y', guideline: null, sortOrder: 30 }],
    eintraege: [{ id: 40, kind: 'konflikt', title: 'Import A', occurredOn: '2026-11-01', sequence: 0, trigger: 'T', narrative: 'N', insight: null, dynamics: 'Dy', needsSelf: '["Ruhe","Nähe"]', needsPartner: ['Zeit'], ownPart: 'O', nextStep: 'S', analysisStatus: 'fertig', source: 'manuell', createdAt: '2026-11-01T10:00:00.000Z', updatedAt: '2026-11-02T10:00:00.000Z' }],
    eintragMuster: [{ entryId: 40, patternId: 7, note: 'Notiz' }, { entryId: 40, patternId: 99, note: 'weg' }],
    vorbereitungen: [{ id: 3, title: 'V', situation: 'Si', goal: 'G', validation: 'Va', woundedPoint: 'W', eyeLevel: 'E', stopSignal: 'St', feedback: 'F', debrief: 'De', status: 'bereit', entryId: 40 }],
    checkins: [{ date: '2026-11-20', sleepHours: 6.5, sleepQuality: 3, energy: 4, stress: 2, meTimeMinutes: 30, socialContact: 1, sportMinutes: 45, sportType: 'Rad', selfCare: '', motivations: ['freude'], motivationType: 'eigen', ownReason: null, note: 'n' }, { sleepHours: 1 }],
    resets: [{ variant: 'ausfuehrlich', tensionBefore: 8, tensionAfter: 5, intention: 'klar', parked: '["A","B"]', completedAt: '2026-11-12T17:40:00.000Z' }],
    gespraeche: [{ id: 2, title: 'Chat', entryId: 40, createdAt: '2026-11-03T10:00:00.000Z' }], nachrichten: [{ id: 1, conversationId: 2, role: 'user', content: 'Hallo', createdAt: '2026-11-03T10:00:00.000Z' }, { id: 2, conversationId: 3, role: 'user', content: 'fremd' }] };
  ok(V.isResonanz(J) && V.isResonanz({ muster: [], eintraege: [] }) && !V.isResonanz({ app: 'x' }) && !V.isResonanz(null));
  const cnt = V.importResonanz(c, J);
  eq(cnt, { sections: 1, patterns: 2, entries: 1, preps: 1, checkins: 1, resets: 1, chats: 1 });
  eq([c.patterns.length, c.patterns[0].name, c.patterns[0].summary, c.patterns[0].order, c.patterns[2].slug], [3, 'Kreislauf A neu', 'S neu', 5, 'neu'], 'Muster mit gleichem Slug aktualisiert, neues dazu');
  const ia = c.entries.find(e => e.title === 'Import A');
  eq([ia.kind, ia.date, ia.needsSelf, ia.needsPartner, ia.patterns, ia.analysis, ia.created], ['konflikt', '2026-11-01', ['Ruhe', 'Nähe'], ['Zeit'], [{ id: 1, note: 'Notiz' }], 'fertig', '2026-11-01T10:00:00.000Z'], 'unbekanntes Muster übergangen');
  eq([c.preps.length, c.preps[1].entryId === ia.id, c.preps[1].status, c.preps[1].debrief], [2, true, 'bereit', 'De']);
  eq(c.checkins['2026-11-20'].social, true);
  eq([Object.keys(c.checkins), c.checkins['2026-11-20'].meTime, c.checkins['2026-11-20'].sport, c.checkins['2026-11-20'].motivations], [['2026-11-20'], 30, 45, ['freude']]);
  eq([c.resets.length, c.resets[1].parked, c.resets[1].before], [2, ['A', 'B'], 8]);
  eq([c.chats.length, c.chats[0].messages.length, c.chats[0].entryId === ia.id], [1, 1, true]);
  assert.throws(() => V.importResonanz(c, { app: 'x' }), /format/); n++;
  const X = V.exportResonanz(c);
  eq(Object.keys(X), ['exportiertAm', 'app', 'von', 'ausgangslage', 'muster', 'eintraege', 'eintragMuster', 'gespraeche', 'nachrichten', 'vorbereitungen', 'checkins', 'resets']);
  eq([X.eintraege.length, X.eintragMuster.length, X.checkins[0].date, X.checkins[0].socialContact, X.resets.length, X.muster[0].sortOrder], [4, 4, '2026-11-20', true, 2, 5]);
  // Export und Import sind ein Kreis
  const c2 = V.importResonanz(V.empty(), X) && null;
  const c3 = V.empty(); V.importResonanz(c3, X);
  eq([c3.entries.length, c3.patterns.length, c3.preps.length, Object.keys(c3.checkins).length, c3.resets.length, c3.chats.length], [4, 3, 2, 1, 2, 1]);
  eq(c3.entries.find(e => e.title === 'Import A').patterns, [{ id: c3.patterns.find(p => p.slug === 'kreislauf-a').id, note: 'Notiz' }]);
  // Namen aus dem Startpaket füllen nur Leeres
  const c4 = V.empty(); c4.names.me = 'C';
  V.importResonanz(c4, { muster: [], eintraege: [], namen: { me: 'X', partner: 'P', child: 'K' } });
  eq(c4.names, { me: 'C', partner: 'P', child: 'K' });
  // 9. Migration ergänzt fehlende Felder
  eq(V.migrate({ entries: [] }).resets, []);
  eq(V.migrate({ names: { me: 'C' } }).names, { me: 'C', partner: '', child: '' });
  console.log('vault_test: ' + n + ' Prüfungen bestanden');
})().catch(e => { console.error(e); process.exit(1); });
