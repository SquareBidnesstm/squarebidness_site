// /public/scripts/sw-register.js
(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function (reg) {
        console.log('[SW] registered with scope:', reg.scope);

        // If there's already a waiting SW, refresh prompt can happen immediately
        if (reg.waiting) {
          console.log('[SW] update waiting (existing).');
        }

        reg.addEventListener('updatefound', function () {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed') {
              // If there's a controller, an update is ready
              if (navigator.serviceWorker.controller) {
                console.log('[SW] update ready — refresh to load latest.');
              }
            }
          });
        });
      })
      .catch(function (err) {
        console.warn('[SW] registration failed:', err);
      });
  });
})();
