/* ============================
   Square Bidness Banner Script
   ============================ */

// CONFIG — edit these lines for each event
const CONFIG = {
  switchAt: new Date(2025, 8, 19, 0, 0, 0), // Year, month-1, day → Sept 19, 2025 @ midnight
  live: {
    text: `🚀 Square Bidness is LIVE at 
      <a href="https://events.fastcompany.com/innovationfestival" target="_blank" rel="noopener">
      Innovation Fest 2025</a> — tap in with us in NYC!`,
    class: "sb-banner sb-banner--live",
  },
  thanks: {
    text: `🙏 Thank you, NYC! Square Bidness showed out at 
      <a href="https://events.fastcompany.com/innovationfestival" target="_blank" rel="noopener">
      Innovation Fest 2025</a>. See you again soon.`,
    class: "sb-banner sb-banner--thanks",
  }
};

// RENDER
(function(){
  const now = new Date();
  const showLive = now < CONFIG.switchAt;

  const el = document.createElement("div");
  el.className = showLive ? CONFIG.live.class : CONFIG.thanks.class;
  el.innerHTML = showLive ? CONFIG.live.text : CONFIG.thanks.text;

  // Mount under nav
  const nav = document.querySelector("#nav-placeholder");
  if (nav) nav.insertAdjacentElement("afterend", el);
})();
