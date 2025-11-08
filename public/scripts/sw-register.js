// /public/scripts/sw-register.js
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => console.log("[SW] registered"))
      .catch(err => console.warn("[SW] failed", err));
  });
}
