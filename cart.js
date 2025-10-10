const CART_KEY = 'sb_cart_v1';
function getCart(){ try { return JSON.parse(localStorage.getItem(CART_KEY))||[] } catch(e){ return [] } }
function setCart(c){ localStorage.setItem(CART_KEY, JSON.stringify(c)); }
document.addEventListener('click', (e)=>{
  if(e.target.matches('.add-to-cart')){
    const sku = e.target.dataset.sku;
    const name = document.querySelector('h1').textContent;
    const price = Number(document.querySelector('.price').textContent.replace('$',''));
    const image = document.querySelector('.product-img').getAttribute('src');
    const cart = getCart();
    const existing = cart.find(i=>i.sku===sku);
    if(existing){ existing.qty += 1; } else { cart.push({sku, name, price, image, qty:1}); }
    setCart(cart);
    alert('Added to cart');
  }
});
