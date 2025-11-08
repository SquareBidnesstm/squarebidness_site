<script>
// Minimal UX + GA ping for Mailchimp footer form
(function () {
  const form = document.getElementById('mc-embedded-subscribe-form');
  if (!form) return;

  const email = document.getElementById('mce-EMAIL');
  const btn   = document.getElementById('mc-embedded-subscribe');

  form.addEventListener('submit', function () {
    // Soft disable while Mailchimp opens in a new tab
    if (btn) {
      btn.disabled = true;
      const old = btn.textContent;
      btn.dataset.old = old;
      btn.textContent = 'Sending…';
      setTimeout(() => { // re-enable after a few seconds
        btn.disabled = false;
        btn.textContent = btn.dataset.old || 'Subscribe';
      }, 5000);
    }

    // GA event (best-effort, no PII)
    try {
      if (typeof gtag === 'function') {
        gtag('event', 'sign_up', {
          method: 'mailchimp_footer',
          // send the email domain only (no full email)
          email_domain: (email?.value || '').split('@')[1] || '(unknown)'
        });
      }
    } catch (_) {}
  });
})();
</script>
