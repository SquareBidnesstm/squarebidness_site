<!-- /scripts/reviews.js -->
<script>
(function () {
  const MONEY_BEST = 5;

  function stars(n) {
    const full = '★'.repeat(Math.round(n));
    const empty = '☆'.repeat(5 - Math.round(n));
    return full + empty;
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
    } catch { return iso || ''; }
  }

  async function loadJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('reviews.json not found');
    return r.json();
  }

  function injectSchema(product) {
    const data = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "sku": product.sku,
      "brand": { "@type": "Brand", "name": product.brand || "Square Bidness Apparel" },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": String(product.aggregate?.ratingValue || 0),
        "reviewCount": String(product.aggregate?.reviewCount || 0),
        "bestRating": String(product.aggregate?.bestRating || MONEY_BEST)
      },
      "review": (product.reviews || []).map(r => ({
        "@type": "Review",
        "datePublished": r.date || undefined,
        "reviewBody": r.body,
        "reviewRating": { "@type": "Rating", "ratingValue": String(r.rating), "bestRating": String(product.aggregate?.bestRating || MONEY_BEST) },
        "author": { "@type": "Person", "name": r.author || "Verified Buyer" }
      }))
    };

    const tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.textContent = JSON.stringify(data);
    document.head.appendChild(tag);
  }

  function renderInto(el, product) {
    const agg = product.aggregate || { ratingValue: 0, reviewCount: 0, bestRating: MONEY_BEST };

    // Summary
    const header = document.createElement('div');
    header.className = 'reviews-summary';
    header.innerHTML = `
      <span aria-hidden="true" class="reviews-stars" style="font-size:1.05rem">${stars(agg.ratingValue)}</span>
      <span><strong>${Number(agg.ratingValue).toFixed(1)}</strong> / ${agg.bestRating || MONEY_BEST}</span>
      <span class="muted">(${agg.reviewCount} review${agg.reviewCount === 1 ? '' : 's'})</span>
    `;

    // List
    const ul = document.createElement('ul');
    ul.className = 'reviews-list';
    if (!product.reviews || !product.reviews.length) {
      ul.innerHTML = `<li class="review muted">No reviews yet — be the first to cop and leave feedback.</li>`;
    } else {
      ul.innerHTML = product.reviews.map(r => `
        <li class="review">
          <div class="review__header">
            <span class="review__stars" aria-hidden="true">${stars(r.rating)}</span>
            <small class="review__meta">by ${r.author || 'Verified Buyer'} • ${fmtDate(r.date)}</small>
          </div>
          <blockquote class="review__body">${(r.body || '').replace(/</g,'&lt;')}</blockquote>
        </li>
      `).join('');
    }

    // Mount
    el.innerHTML = `
      <h3>Customer Reviews</h3>
    `;
    el.appendChild(header);
    el.appendChild(ul);
  }

  async function boot() {
    const blocks = document.querySelectorAll('.product-reviews[data-sku]');
    if (!blocks.length) return;

    let index = null;
    try {
      index = await loadJSON('/data/reviews.json');
    } catch (e) {
      console.warn('Reviews: could not load /data/reviews.json', e);
      blocks.forEach(el => { el.innerHTML = '<h3>Customer Reviews</h3><p class="muted">Reviews are loading…</p>'; });
      return;
    }

    blocks.forEach(el => {
      const sku = el.getAttribute('data-sku');
      const p = index[sku];
      if (!p) {
        el.innerHTML = '<h3>Customer Reviews</h3><p class="muted">No reviews yet.</p>';
        return;
      }
      // Ensure fallback fields
      p.name  = p.name  || el.getAttribute('data-product-name') || sku;
      p.sku   = p.sku   || sku;
      p.brand = p.brand || 'Square Bidness Apparel';

      renderInto(el, p);
      injectSchema(p);
    });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
</script>
