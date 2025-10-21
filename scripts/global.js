<!-- /scripts/global.js -->
<script>
/* ===== GA4 Ecommerce Helpers =====
   Requires your existing GA bootstrap (ga.js / gtag init) already on the page.
   Currency: USD (change if needed)
------------------------------------ */
window.SBGA = {
  viewItem({id,name,price,currency="USD"}) {
    if (!window.gtag) return;
    gtag('event','view_item',{
      currency, value: Number(price)||0,
      items:[{item_id:id,item_name:name,price:Number(price)||0}]
    });
  },
  addToCart({id,name,price,quantity=1,currency="USD"}) {
    if (!window.gtag) return;
    gtag('event','add_to_cart',{
      currency, value:(Number(price)||0)*quantity,
      items:[{item_id:id,item_name:name,price:Number(price)||0,quantity}]
    });
  },
  beginCheckout({cart=[],currency="USD"}) {
    if (!window.gtag) return;
    const value = cart.reduce((s,i)=>s+(Number(i.price)||0)*(Number(i.quantity)||1),0);
    gtag('event','begin_checkout',{currency,value,items:cart});
  },
  purchase({order_id,value,currency="USD",cart=[]}) {
    if (!window.gtag) return;
    gtag('event','purchase',{
      transaction_id: order_id || ('SB-' + Date.now()),
      currency, value: Number(value)||0,
      items: cart
    });
  }
};

/* ===== Auto-wire common pages ===== */
document.addEventListener('DOMContentLoaded', () => {
  // PDP: fire view_item if we can detect a product block
  const pdp = document.querySelector('.product-detail__info,[data-sku][data-product-name]');
  if (pdp) {
    const id    = pdp.getAttribute('data-sku') || pdp.getAttribute('data-id-base');
    const name  = pdp.getAttribute('data-product-name') || pdp.getAttribute('data-name-base') || id;
    const price = (document.querySelector('.product-detail__price')?.textContent || '').replace(/[^0-9.]/g,'');
    if (id && name) SBGA.viewItem({ id, name, price });
  }

  // Add-to-cart: mark your buttons with data-add-to-cart (recommended)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add-to-cart]');
    if (!btn) return;
    const wrap  = btn.closest('[data-sku],[data-id-base]');
    const id    = wrap?.getAttribute('data-sku') || wrap?.getAttribute('data-id-base');
    const name  = wrap?.getAttribute('data-product-name') || wrap?.getAttribute('data-name-base') || id || 'Product';
    const price = (document.querySelector('.product-detail__price')?.textContent || '').replace(/[^0-9.]/g,'') || 0;
    const qty   = Number(btn.getAttribute('data-qty') || 1);
    if (id) SBGA.addToCart({ id, name, price, quantity: qty });
  });

  // Begin checkout: mark your button with data-begin-checkout
  document.addEventListener('click', (e) => {
    const ck = e.target.closest('[data-begin-checkout]');
    if (!ck) return;
    SBGA.beginCheckout({ cart: SB_readCartForAnalytics() });
  });

  // Success page: if URL looks like /success/ or has ?success=1, try to fire purchase
  const href = location.pathname + location.search;
  if (/\/success\/?$/i.test(location.pathname) || /[?&](success|paid|status)=?1/i.test(location.search)) {
    const cart = SB_readCartForAnalytics();
    const value = cart.reduce((s,i)=>s+(Number(i.price)||0)*(Number(i.quantity)||1),0);
    const orderId = new URLSearchParams(location.search).get('order_id') || new URLSearchParams(location.search).get('session_id');
    SBGA.purchase({ order_id: orderId, value, cart });
    // Optional: clear cart AFTER firing purchase if your flow requires
    // try { localStorage.removeItem('sb_cart_v1'); } catch {}
  }
});

/* ===== Cart reader (works with your sb_cart_v1 if present) ===== */
function SB_readCartForAnalytics(){
  try {
    const raw = localStorage.getItem('sb_cart_v1');
    if (!raw) return [];
    const data = JSON.parse(raw);
    // Normalize into GA item objects
    // Expecting items like { id/sku, name, price, quantity }
    return (data.items || data || []).map(i => ({
      item_id:  i.id || i.sku || i.item_id,
      item_name:i.name || i.item_name || i.sku,
      price:    Number(i.price)||0,
      quantity: Number(i.quantity)||1
    })).filter(x => x.item_id);
  } catch { return []; }
}
</script>
