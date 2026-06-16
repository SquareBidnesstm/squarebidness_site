// /public/scripts/ga.js
(function initGA(id){
  if(!id || !/^G-[A-Z0-9]+$/.test(id)){
    console.warn("GA4: missing/invalid ID");
    return;
  }

  // ✅ Define gtag immediately (so sb-analytics can fire right away)
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

  function loadGA(){
    if (window.__ga_loaded) return;
    window.__ga_loaded = true;

    // preconnect (only when we actually load GA)
    try{
      const a=document.createElement("link");
      a.rel="preconnect"; a.href="https://www.googletagmanager.com"; a.crossOrigin="anonymous";
      const b=document.createElement("link");
      b.rel="preconnect"; b.href="https://www.google-analytics.com"; b.crossOrigin="anonymous";
      document.head.append(a,b);
    } catch {}

    // gtag init
    window.gtag("js", new Date());

    // IMPORTANT: sb-analytics will send page_view (so we prevent auto page_view)
    window.gtag("config", id, {
      transport_type: "beacon",
      anonymize_ip: true,
      send_page_view: false
    });

    // load GA library
    const s=document.createElement("script");
    s.async=true;
    s.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
  }

  // Load fast enough to catch landings
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadGA, { once:true });
  } else {
    loadGA();
  }

  // Backups
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadGA();
  }, { passive:true });

  ["click","touchstart","keydown","scroll"].forEach(evt => {
    document.addEventListener(evt, loadGA, { once:true, passive:true });
  });

})("G-5GB7FQ316G");
