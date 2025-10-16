<!-- /scripts/ga.js -->
(function initGA(id){
  if(!id||!/^G-[A-Z0-9]+$/.test(id)){console.warn('GA4: missing/invalid ID');return;}
  try{
    const a=document.createElement('link');a.rel='preconnect';a.href='https://www.googletagmanager.com';
    const b=document.createElement('link');b.rel='preconnect';b.href='https://www.google-analytics.com';
    document.head.append(a,b);
  }catch{}
  const s=document.createElement('script');
  s.async=true; s.src=`https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);

  window.dataLayer=window.dataLayer||[];
  window.gtag=window.gtag||function(){dataLayer.push(arguments);};
  gtag('js', new Date());
  gtag('config', id, { transport_type:'beacon' });
})('G-5GB7FQ316G');
