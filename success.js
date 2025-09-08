// scripts/success.js
(function () {
  const money = (cents, currency='usd') =>
    (typeof cents === 'number')
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)
      : '$0.00';

  document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    // Reveal raw id if you still want to show it (optional)
    const rawEl = document.getElementById('stripe-session-id');
    if (rawEl && sessionId) {
      rawEl.textContent = sessionId;
      rawEl.parentElement.style.display = 'block';
    }

    if (!sessionId) return;

    try {
      const res = await fetch(`http://localhost:4242/order-details?session_id=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error(`Server ${res.status}`);
      const data = await res.json();

      // Fill header summary
      document.getElementById('ord-email').textContent  = data.customer_email || '—';
      document.getElementById('ord-status').textContent = (data.payment_status || '').replace(/_/g,' ');
      document.getElementById('ord-total').textContent  = money(data.amount_total, data.currency);

      // Line items
      const tbody = document.getElementById('ord-lines');
      tbody.innerHTML = (data.line_items || []).map(li => `
        <tr>
          <td style="padding:.35rem 0">${li.description}</td>
          <td style="text-align:right; padding:.35rem 0">${li.quantity}</td>
          <td style="text-align:right; padding:.35rem 0">${money(li.unit_amount, li.currency)}</td>
        </tr>
      `).join('');

      // Show the block
      document.getElementById('order-summary').style.display = '';
      // Clear cart now that checkout finished (optional but common)
      try { localStorage.removeItem('sb_cart_v1'); } catch {}
    } catch (err) {
      console.error('Failed to load order details:', err);
      // Still show page, just without details.
    }
  });
})();
