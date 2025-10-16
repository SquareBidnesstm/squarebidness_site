<!-- /scripts/ga.js -->
<script>
(function MIDLoader(MID){
  if (window.gtag) return; // already loaded
  var s=document.createElement('script');
  s.async=true;
  s.src='https://www.googletagmanager.com/gtag/js?id='+MID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;

  // Optional: basic consent + environment-aware debug
  var isProd = location.hostname === 'www.squarebidness.com';
  gtag('consent', 'default', { analytics_storage: 'granted' });
  gtag('js', new Date());
  gtag('config', MID, {
    send_page_view: true,
    debug_mode: !isProd
  });
})('G-5GB7FQ316G');
</script>
