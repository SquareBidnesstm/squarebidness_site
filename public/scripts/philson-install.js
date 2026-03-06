let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  const installWrap = document.getElementById("installWrap");
  if (installWrap) installWrap.hidden = false;
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  const installWrap = document.getElementById("installWrap");
  if (installWrap) installWrap.hidden = true;
});

document.addEventListener("DOMContentLoaded", () => {
  const installBtn = document.getElementById("installBtn");
  if (!installBtn) return;

  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      const installWrap = document.getElementById("installWrap");
      if (installWrap) installWrap.hidden = true;
    }

    deferredPrompt = null;
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/philson-le-fleuriste/sw.js").catch((err) => {
      console.error("Philson service worker registration failed:", err);
    });
  });
}
