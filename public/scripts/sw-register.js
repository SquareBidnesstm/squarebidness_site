// /scripts/sw-register.js
(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(function (reg) {
        console.log('[SW] registered with scope:', reg.scope);
      })
      .catch(function (err) {
        console.warn('[SW] registration failed:', err);
      });
  });
})();
