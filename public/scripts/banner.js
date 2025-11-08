
(() => {
  // ---- Config ----
  const CONFIG = {
    switchAt: new Date(2025, 8, 19, 0, 0, 0), // Sep 19, 2025
    order: ["live", "thanks", "holiday", "drop", "sale", "off"],
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
    },
    holiday: {
      text: `🎄 Holiday Heat: Square Bidness exclusive drop — shop limited pieces now.`,
      class: "sb-banner sb-banner--holiday",
    },
    drop: {
      text: `⚡ Limited Edition Drop: VSOP Collection live now. Don’t miss it.`,
      class: "sb-banner sb-banner--drop",
    },
    sale: {
      text: `💸 Special Offer: Save up to 20% today only. Shop the sale ➡`,
      class: "sb-banner sb-banner--sale",
    }
  };

  // ---- Keys / Storage ----
  const qs = new URLSearchParams(location.search);
  const valid = new Set(["live","thanks","holiday","drop","sale","off"]);
  const LS_KEY = "sb_banner_override";

  function setOverride(val) {
    if (val === "off") {
      localStorage.setItem(LS_KEY, "off");
      return "off";
    }
    if (!val) {
      localStorage.removeItem(LS_KEY);
      return "";
    }
    if (valid.has(val)) {
      localStorage.setItem(LS_KEY, val);
      return val;
    }
    return "";
  }

  function getOverride() {
    const fromQS = (qs.get("banner") || "").toLowerCase();
    if (valid.has(fromQS) || fromQS === "off") {
      return setOverride(fromQS);
    }
    const saved = (localStorage.getItem(LS_KEY) || "").toLowerCase();
    return (valid.has(saved) || saved === "off") ? saved : "";
  }

  function getDefaultKey() {
    return (new Date() < CONFIG.switchAt) ? "live" : "thanks";
  }

  // ---- Mount banner ----
  function unmountBanner() {
    document.getElementById("sb-banner-host")?.remove();
  }

  function mountBanner(key) {
    if (key === "off") { unmountBanner(); return; }
    const conf = CONFIG[key] || CONFIG[getDefaultKey()];
    if (!conf) return;

    let host = document.getElementById("sb-banner-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "sb-banner-host";
      document.body.prepend(host);
    }

    const el = document.createElement("div");
    el.className = conf.class;
    el.innerHTML = `
      <div class="sb-banner__inner container">
        <div class="sb-banner__text">${conf.text}</div>
        <button class="sb-banner__close" aria-label="Close banner">✕</button>
      </div>
    `;
    host.innerHTML = "";
    host.appendChild(el);

    el.querySelector(".sb-banner__close")?.addEventListener("click", () => {
      setOverride("off");
      unmountBanner();
      toast("Banner: off");
    });
  }

  // ---- Tiny toast ----
  let toastTimer;
  function toast(msg) {
    let t = document.querySelector(".sb-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "sb-toast";
      Object.assign(t.style, {
        position:"fixed", bottom:"1rem", right:"1rem", zIndex:99999,
        background:"#111", color:"#fff", border:"1px solid #333",
        padding:"0.6rem 0.8rem", borderRadius:"10px",
        boxShadow:"0 6px 20px rgba(0,0,0,.35)", opacity:"0",
        transform:"translateY(8px)", transition:"all .25s ease"
      });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    t.style.transform = "translateY(0)";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "translateY(8px)";
    }, 1500);
  }

  // ---- Init ----
  const startKey = getOverride() || getDefaultKey();
  mountBanner(startKey);

  // ---- Admin shortcuts ----
  function cycle(current) {
    const arr = CONFIG.order;
    const idx = Math.max(0, arr.indexOf(current));
    const next = arr[(idx + 1) % arr.length];
    return next;
  }

  document.addEventListener("keydown", (e) => {
    if (!e.shiftKey) return; // require Shift for safety
    const key = e.key.toLowerCase();

    // Shift+B = cycle
    if (key === "b") {
      e.preventDefault();
      const cur = (localStorage.getItem(LS_KEY) || startKey || getDefaultKey());
      const next = cycle(cur);
      setOverride(next);
      if (next === "off") {
        unmountBanner();
        toast("Banner: off");
      } else {
        mountBanner(next);
        toast(`Banner: ${next}`);
      }
    }

    // Shift+R = reset to default (clear override)
    if (key === "r") {
      e.preventDefault();
      setOverride("");           // clear
      const def = getDefaultKey();
      mountBanner(def);
      toast(`Banner: default → ${def}`);
    }

    // Shift+O = off
    if (key === "o") {
      e.preventDefault();
      setOverride("off");
      unmountBanner();
      toast("Banner: off");
    }
  });
})();

