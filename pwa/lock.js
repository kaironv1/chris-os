/* Chris OS, Sperre per Passkey: Fingerabdruck, Gesicht oder Geräte-PIN über den Plattform-Authentifikator.
   Läuft nur in der gehosteten Version (HTTPS). Die Sperre schützt die Oberfläche vor fremden Blicken.
   Die Daten selbst sind damit noch nicht verschlüsselt; das kommt später über die PRF-Erweiterung.
   Nutzung: Lock.init({ appName, grace, onUnlock, onReset }), Lock.enable(), Lock.disable(), Lock.status(). */
(function (root) {
  'use strict';
  const KEY = 'chrisos.lock';
  const cfg = { appName: 'Chris OS', grace: 60, onUnlock: null, onReset: null };
  let mode = 'open', hiddenAt = 0, busy = false, el = null;

  const b64u = buf => btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(buf)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  const rand = n => crypto.getRandomValues(new Uint8Array(n));
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const write = v => { try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch (e) { /* Speicher voll oder gesperrt */ } };

  async function supported() {
    if (!root.isSecureContext || !root.PublicKeyCredential) return false;
    try { return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(); } catch (e) { return false; }
  }
  // Flags-Byte der Authenticator-Daten: UP 0x01, UV 0x04
  const verified = ad => (new Uint8Array(ad)[32] & 0x04) !== 0;
  function clientOk(json, type, challenge) {
    try { const c = JSON.parse(new TextDecoder().decode(json)); return c.type === type && c.challenge === b64u(challenge) && c.origin === location.origin; } catch (e) { return false; }
  }

  async function register() {
    const challenge = rand(32);
    const cred = await navigator.credentials.create({ publicKey: {
      challenge, rp: { name: cfg.appName }, user: { id: rand(16), name: 'chris', displayName: 'Chris' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      timeout: 60000, attestation: 'none'
    } });
    if (!cred || !clientOk(cred.response.clientDataJSON, 'webauthn.create', challenge)) throw new Error('setup');
    const ad = cred.response.getAuthenticatorData ? cred.response.getAuthenticatorData() : null;
    if (ad && !verified(ad)) throw new Error('uv');
    write({ id: b64u(cred.rawId), at: new Date().toISOString() });
  }
  async function verify() {
    const st = read();
    if (!st) return true;
    const challenge = rand(32);
    const a = await navigator.credentials.get({ publicKey: { challenge, allowCredentials: [{ type: 'public-key', id: unb64u(st.id), transports: ['internal', 'hybrid'] }], userVerification: 'required', timeout: 60000 } });
    return !!a && b64u(a.rawId) === st.id && clientOk(a.response.clientDataJSON, 'webauthn.get', challenge) && verified(a.response.authenticatorData);
  }

  // ---------- Sperrbildschirm ----------
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a7.5 7.5 0 0 0-7.5 7.5v1.5M19.5 12.5V11a7.5 7.5 0 0 0-3.2-6.1M8.5 20.2A12 12 0 0 0 9 11a3 3 0 0 1 6 0c0 3.4-.4 6.4-1.3 9M12 11c0 3.6-.5 6.8-1.7 9.6M16.8 18.6c.4-2 .7-4.4.7-7.6M5 16c.6-1.6.9-3.2.9-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  function css() {
    if (document.getElementById('lock-style')) return;
    const s = document.createElement('style');
    s.id = 'lock-style';
    s.textContent = `#lock{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--paper,#F1F2EE);color:var(--ink,#1B2331);font-family:Archivo,"Segoe UI",Roboto,system-ui,-apple-system,sans-serif}
#lock[hidden]{display:none}
#lock .lock-in{width:100%;max-width:340px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px}
#lock .lock-mark{width:76px;height:76px;border-radius:24px;display:grid;place-items:center;background:var(--denim-wash,#E4EAF4);color:var(--denim,#2F4E85)}
#lock .lock-mark svg{width:44px;height:44px}
#lock h1{margin:6px 0 0;font-size:24px}
#lock p{margin:0;color:var(--ink-2,#485163);font-size:15px;line-height:1.45}
#lock button{font:inherit;font-size:16px;border-radius:14px;padding:13px 18px;width:100%;cursor:pointer;border:1px solid var(--line,#DCDFD8);background:var(--surface,#fff);color:inherit}
#lock button.go{background:var(--denim,#2F4E85);border-color:transparent;color:var(--denim-ink,#fff);font-weight:600}
#lock button.danger{background:#A3302F;border-color:transparent;color:#fff;font-weight:600}
#lock button.quiet{border:0;background:none;color:var(--muted,#646C7B);font-size:14px;padding:8px;width:auto}
#lock.covered .lock-in{visibility:hidden}
html.is-locked body>*:not(#lock){visibility:hidden}`;
    document.head.appendChild(s);
  }
  function msg(t) { const m = el && el.querySelector('.lock-msg'); if (m) m.textContent = t; }
  function frame() {
    css();
    if (!el) { el = document.createElement('div'); el.id = 'lock'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Gesperrt'); document.body.appendChild(el); }
    el.hidden = false;
    document.documentElement.classList.add('is-locked');
  }
  function home() {
    el.innerHTML = `<div class="lock-in"><div class="lock-mark">${ICON}</div><h1></h1><p class="lock-msg">Entsperre mit deinem Fingerabdruck.</p><button type="button" class="go" data-l="go">Entsperren</button><button type="button" class="quiet" data-l="help">Kein Zugriff mehr?</button></div>`;
    el.querySelector('h1').textContent = cfg.appName;
    el.querySelector('[data-l="go"]').addEventListener('click', unlock);
    el.querySelector('[data-l="help"]').addEventListener('click', help);
  }
  function help() {
    el.innerHTML = `<div class="lock-in"><h1>Neu einrichten?</h1><p class="lock-msg">Ohne Fingerabdruck kommst du nicht mehr an die Daten auf diesem Gerät. Du kannst sie hier löschen und danach dein Backup einspielen.</p><button type="button" class="danger" data-l="wipe">Daten auf diesem Gerät löschen</button><button type="button" data-l="back">Zurück</button></div>`;
    el.querySelector('[data-l="wipe"]').addEventListener('click', wipe);
    el.querySelector('[data-l="back"]').addEventListener('click', home);
  }
  async function wipe() {
    try { if (cfg.onReset) await cfg.onReset(); else { localStorage.clear(); if (root.indexedDB) indexedDB.deleteDatabase('haltung-fotos'); } } catch (e) { /* weiter mit Neustart */ }
    write(null);
    location.reload();
  }
  function lock(prompt) {
    mode = 'locked';
    frame();
    el.classList.remove('covered');
    home();
    if (prompt !== false && document.visibilityState === 'visible') setTimeout(unlock, 120);
  }
  function cover() { mode = 'covered'; frame(); el.classList.add('covered'); if (!el.firstChild) home(); }
  function open() {
    mode = 'open';
    if (el) { el.hidden = true; el.classList.remove('covered'); }
    document.documentElement.classList.remove('is-locked');
  }
  async function unlock() {
    if (busy || mode !== 'locked') return;
    busy = true;
    msg('Bitte bestätigen …');
    try {
      if (await verify()) { open(); if (cfg.onUnlock) cfg.onUnlock(); }
      else msg('Nicht erkannt. Versuch es noch einmal.');
    } catch (e) {
      msg(e && e.name === 'NotAllowedError' ? 'Abgebrochen. Tippe auf Entsperren.' : 'Entsperren hat nicht geklappt. Versuch es noch einmal.');
    } finally { busy = false; }
  }
  document.addEventListener('visibilitychange', () => {
    if (!read()) return;
    if (document.visibilityState === 'hidden') { if (mode === 'open') { hiddenAt = Date.now(); cover(); } }
    else if (mode === 'covered') { if (Date.now() - hiddenAt >= cfg.grace * 1000) lock(); else open(); }
    else if (mode === 'locked' && !busy) setTimeout(unlock, 120);
  });

  // ---------- Schnittstelle ----------
  async function init(o) {
    Object.assign(cfg, o || {});
    const ok = await supported();
    if (read()) lock(); else open();
    return { enabled: !!read(), supported: ok };
  }
  async function enable() {
    if (!(await supported())) throw new Error('unsupported');
    await register();
    return true;
  }
  async function disable() {
    if (!read()) return true;
    if (!(await verify())) return false;
    write(null);
    return true;
  }
  const status = () => ({ enabled: !!read(), mode, grace: cfg.grace });
  const setGrace = s => { cfg.grace = Math.max(0, +s || 0); };

  root.Lock = { init, enable, disable, status, supported, setGrace, lockNow: () => { if (read()) lock(); } };
})(typeof window !== 'undefined' ? window : this);
