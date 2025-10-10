(function () {
  const KEY = 'sb_cart_v1';
  function getCart(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ return []; } }
  function setCart(cart){ localStorage.setItem(KEY, JSON.stringify(cart)); updateBadge(cart); dispatchEvent(new CustomEvent('sb:cart:update',{detail:{cart}})); }
  function updateBadge(cart=getCart()){ const b=document.getElementById('cart-count'); if(!b) return; const c=cart.reduce((n,it)=>n+(Number(it.qty)||0),0); b.textContent=String(c); b.style.display=c>0?'':'none'; }
  const SB = {
    getCart, setCart,
    clear(){ setCart([]); },
    addToCart(item){ const cart=getCart(); const i=cart.findIndex(x=>x.id===item.id); if(i>=0) cart[i].qty+=Number(item.qty||1); else cart.push({...item, qty:Number(item.qty||1)}); setCart(cart); },
    updateQty(id, qty){ const cart=getCart().map(i=>i.id===id?{...i, qty:Math.max(0,Number(qty||0))}:i).filter(i=>i.qty>0); setCart(cart); },
    remove(id){ setCart(getCart().filter(i=>i.id!==id)); },
    total(){ return getCart().reduce((s,i)=>s+Number(i.price||0)*Number(i.qty||0),0); }
  };
  window.SB = Object.freeze(SB);
  document.addEventListener('DOMContentLoaded', updateBadge);
})();
