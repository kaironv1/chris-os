/* Chris OS, installierbare Version: Service Worker anmelden, Update-Hinweis zeigen.
   Nutzung: PWA.init({ onUpdate: apply => … }) – apply() lädt die neue Version.
   Neu geladen wird nur, wenn eine neue Version übernommen wird, nicht beim ersten Einrichten.
   Scheitert die Anmeldung (zum Beispiel offline), hängt sich die App an die vorhandene Registrierung. */
(function (root) {
  'use strict';
  function init(o) {
    o = o || {};
    const sw = navigator.serviceWorker;
    if (!sw || location.protocol !== 'https:' && location.hostname !== 'localhost') return Promise.resolve(null);
    const hadController = !!sw.controller;
    let reloading = false, wanted = false;
    sw.addEventListener('controllerchange', () => {
      if (reloading || !(hadController || wanted)) return;
      reloading = true;
      location.reload();
    });
    const offer = w => { if (o.onUpdate) o.onUpdate(() => { wanted = true; w.postMessage('skipWaiting'); }); };
    const watch = reg => {
      if (!reg) return null;
      if (reg.waiting && sw.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && sw.controller) offer(w); });
      });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
      return reg;
    };
    return sw.register('./sw.js')
      .catch(() => sw.getRegistration('./'))
      .then(watch)
      .catch(() => null);
  }
  root.PWA = { init };
})(typeof window !== 'undefined' ? window : this);
