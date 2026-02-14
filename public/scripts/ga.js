// /public/scripts/ga.js
(function initGA(id){
  if(!id || !/^G-[A-Z0-9]+$/.test(id)){
    console.warn("GA4: missing/invalid ID");
    return;
  }

  function loadGA(){
    if (window.__ga_loaded) return;
    window.__ga_loaded = true;

    // preconnect (only when we actually intend to load)
    try{
      const a=document.createElement("link");
      a.rel="preconnect"; a.href="https://www.googletagmanager.com"; a.crossOrigin="anonymous";
      const b=document.createElement("link");
      b.rel="preconnect"; b.href="https://www.google-analytics.com"; b.crossOrigin="anonymous";
      document.head.append(a,b);
    } catch {}

    // gtag bootstrap (queue-safe even before network script loads)
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

    window.gtag("js", new Date());

    // IMPORTANT:
    // - send_page_view:false because sb-analytics.js will send page_view reliably
    // - transport_type:"beacon" keeps it lightweight
    window.gtag("config", id, {
      transport_type: "beacon",
      anonymize_ip: true,
      send_page_view: false
    });

    const s=document.createElement("script");
    s.async=true;
    s.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);
  }

  // Load early enough to catch “quiet” landings, but still not blocking render
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadGA, { once:true });
  } else {
    loadGA();
  }

  // Backup: if page is opened in background, idle callbacks can delay forever
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadGA();
  }, { passive:true });

  // Backup: user interaction should always load GA
  ["click","touchstart","keydown","scroll"].forEach(evt => {
    document.addEventListener(evt, loadGA, { once:true, passive:true });
  });

})("G-5GB7FQ316G");
