/* /scripts/reviews.js */
(() => {
  const BEST = 5;

  // --- utils ---
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const stars = (n) => {
    const r = Math.round(Number(n) || 0);
    return "★".repeat(Math.max(0, Math.min(r, 5))) + "☆".repeat(Math.max(0, 5 - r));
  };

  const fmtDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso || "";
    }
  };

  const loadJSON = async (url) => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Fetch failed ${r.status}`);
    return r.json();
  };

  // --- schema.org injection (de-duped per SKU) ---
  const injectSchema = (product) => {
    const sku = product.sku || "unknown";
    const attr = "data-reviews-schema";
    // remove any previous schema for this sku
    document.querySelectorAll(`script[type="application/ld+json"][${attr}="${sku}"]`).forEach((el) => el.remove());

    const data = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "sku": sku,
      "brand": { "@type": "Brand", "name": product.brand || "Square Bidness Apparel" },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": String(product.aggregate?.ratingValue || 0),
        "reviewCount": String(product.aggregate?.reviewCount || 0),
        "bestRating": String(product.aggregate?.bestRating || BEST)
      },
      "review": (product.reviews || []).map((r) => ({
        "@type": "Review",
        "datePublished": r.date || undefined,
        "reviewBody": r.body || "",
        "reviewRating": {
          "@type": "Rating",
          "ratingValue": String(r.rating),
          "bestRating": String(product.aggregate?.bestRating || BEST)
        },
        "author": { "@type": "Person", "name": r.author || "Verified Buyer" }
      }))
    };

    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.setAttribute(attr, sku);
    tag.textContent = JSON.stringify(data);
    document.head.appendChild(tag);
  };

  // --- render ---
  const renderInto = (el, product) => {
    const agg = {
      ratingValue: Number(product.aggregate?.ratingValue || 0),
      reviewCount: Number(product.aggregate?.reviewCount || 0),
      bestRating: Number(product.aggregate?.bestRating || BEST),
    };

    const header = document.createElement("div");
    header.className = "reviews-summary";
    header.innerHTML = `
      <span aria-hidden="true" class="reviews-stars" style="font-size:1.05rem">${stars(agg.ratingValue)}</span>
      <span class="reviews-score" aria-label="Average rating ${agg.ratingValue.toFixed(1)} out of ${agg.bestRating}">
        <strong>${agg.ratingValue.toFixed(1)}</strong> / ${agg.bestRating}
      </span>
      <span class="muted">(${agg.reviewCount} review${agg.reviewCount === 1 ? "" : "s"})</span>
    `;

    const ul = document.createElement("ul");
    ul.className = "reviews-list";

    if (!Array.isArray(product.reviews) || !product.reviews.length) {
      ul.innerHTML = `<li class="review muted">No reviews yet — be the first to cop and leave feedback.</li>`;
    } else {
      ul.innerHTML = product.reviews
        .map((r) => {
          const body = esc(r.body || "");
          const author = esc(r.author || "Verified Buyer");
          const date = fmtDate(r.date);
          return `
            <li class="review">
              <div class="review__header">
                <span class="review__stars" aria-hidden="true">${stars(r.rating)}</span>
                <small class="review__meta">by ${author}${date ? ` • ${date}` : ""}</small>
              </div>
              <blockquote class="review__body">${body}</blockquote>
            </li>
          `;
        })
        .join("");
    }

    el.innerHTML = `<h3>Customer Reviews</h3>`;
    el.appendChild(header);
    el.appendChild(ul);
  };

  // --- boot ---
  const boot = async () => {
    const blocks = document.querySelectorAll(".product-reviews[data-sku]");
    if (!blocks.length) return;

    let index;
    try {
      index = await loadJSON("/data/reviews.json");
    } catch (e) {
      console.warn("Reviews: could not load /data/reviews.json", e);
      blocks.forEach((el) => {
        el.innerHTML = `<h3>Customer Reviews</h3><p class="muted">Reviews are unavailable right now.</p>`;
      });
      return;
    }

    blocks.forEach((el) => {
      const sku = el.getAttribute("data-sku");
      const p = { ...(index?.[sku] || {}) };

      // fallbacks
      p.name = p.name || el.getAttribute("data-product-name") || sku;
      p.sku = p.sku || sku;
      p.brand = p.brand || "Square Bidness Apparel";
      p.aggregate = p.aggregate || { ratingValue: 0, reviewCount: 0, bestRating: BEST };
      p.reviews = Array.isArray(p.reviews) ? p.reviews : [];

      renderInto(el, p);
      injectSchema(p);
    });
  };

  document.addEventListener("DOMContentLoaded", boot);
})();
