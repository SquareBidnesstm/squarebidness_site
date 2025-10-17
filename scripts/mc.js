// /scripts/mc.js
document.addEventListener('submit', (e) => {
  const form = e.target.closest('#mc-embedded-subscribe-form');
  if (!form) return;
  try {
    // Fire a GA4 event when the form is submitted
    window.gtag?.('event', 'generate_lead', {
      method: 'mailchimp',
      form_location: location.pathname
    });
  } catch {}
});
