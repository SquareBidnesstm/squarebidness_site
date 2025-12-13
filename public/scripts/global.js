/* Square Bidness — Global JS */
(function () {
  window.SB = window.SB || {};
  window.SB.ga = window.SB.ga || {};

  window.SB.ga.evt = function (name, params = {}) {
    try {
      window.gtag && gtag('event', name, params);
    } catch {}
  };

  window.SB.ga.view_item = (d) => SB.ga.evt('view_item', d);
  window.SB.ga.add_to_cart = (d) => SB.ga.evt('add_to_cart', d);
  window.SB.ga.begin_checkout = (d) => SB.ga.evt('begin_checkout', d);
  window.SB.ga.purchase = (d) => SB.ga.evt('purchase', d);
})();
