// FILE: /public/scripts/meta-pixel.js  (PASTE READY — guarded)
(function () {
  // Prevent double-init if included twice
  if (window.__SB_META_PIXEL_INIT__) return;
  window.__SB_META_PIXEL_INIT__ = true;

  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');

  // Init + base PageView
  fbq('init', '914123084877133');
  fbq('track', 'PageView');
})();
