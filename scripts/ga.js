<!-- /scripts/ga.js -->
(function initGA(measurementId){
  if (!measurementId || !/^G-[A-Z0-9]+$/.test(measurementId)) {
    console.warn('GA4: missing/invalid Measurement ID');
    return;
  }

  // Preconnect for perf (safe even if duplicated elsewhere)
  try {
    const pc1 = document.createElement('link');
    pc1.rel = 'preconnect'; pc1.href = 'https://www.googletagmanager.com';
    const pc2 = document.createElement('link');
    pc2.rel = 'preconnect'; pc2.href = 'https://www.google-analytics.com';
    document.head.append(pc1, pc2);
  } catch {}

  // GA loader
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('js', new Date());
  gtag('config', measurementId, {
    // optional niceties
    transport_type: 'beacon'
    // ,debug_mode: true
    // ,'send_page_view': false
  });
})('G-5GB7FQ316G'); // <— replace with YOUR real GA4 Measurement ID

