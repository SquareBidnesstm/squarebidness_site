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

    const s=document.createElement("script");
    s.async=true;
    s.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

    window.gtag("js", new Date());
    window.gtag("config", id, { transport_type:"beacon", anonymize_ip:true });
  }

  // load after first paint / idle
  if ("requestIdleCallback" in window) {
    requestIdleCallback(loadGA, { timeout: 2500 });
  } else {
    setTimeout(loadGA, 1800);
  }
})("G-5GB7FQ316G");
