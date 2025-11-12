// tools/assets-check.mjs
// Usage: node tools/assets-check.mjs
// Crawls seed pages, collects assets, checks status + MIME. Exits 1 on errors.
import { writeFileSync } from 'node:fs';

const ORIGIN = process.env.CHECK_ORIGIN || 'https://www.squarebidness.com';

const SEEDS = [
  '/',                   // home
  '/courageaux/',        // November Spotlight (served from /public)
  '/community-spotlight/',
  '/blog/',
];

const EXT_EXPECTED = {
  '.js':'application/javascript',
  '.mjs':'application/javascript',
  '.css':'text/css',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.png':'image/png',
  '.svg':'image/svg+xml',
  '.webp':'image/webp',
  '.ico':'image/x-icon',
  '.pdf':'application/pdf',
  '.json':'application/json',
  '.html':'text/html'
};

const sleep = ms => new Promise(r=>setTimeout(r, ms));

function norm(u){
  try { return new URL(u, ORIGIN).href; } catch { return u; }
}
function extOf(u){
  try{
    const p = new URL(u).pathname.toLowerCase();
    const i = p.lastIndexOf('.');
    return i>-1 ? p.slice(i) : '';
  }catch{ return '' }
}
function expectedMime(u){ return EXT_EXPECTED[extOf(u)] || null; }

function collectAssetsFromHTML(html, base){
  /** very light DOM scrape without external deps */
  const urls = new Set();
  const add = (u)=>{ if(u) urls.add(norm(new URL(u, base).href)); };

  // crude attribute pulls
  const pull = (re) => Array.from(html.matchAll(re)).map(m=>m[1]).filter(Boolean);

  pull(/<img[^>]+src=["']([^"']+)["']/gi).forEach(add);
  pull(/<script[^>]+src=["']([^"']+)["']/gi).forEach(add);
  pull(/<link[^>]+href=["']([^"']+)["']/gi).forEach(add);
  pull(/<source[^>]+src=["']([^"']+)["']/gi).forEach(add);
  // srcset
  pull(/\s(?:srcset)=["']([^"']+)["']/gi).forEach(ss=>{
    ss.split(',').map(s=>s.trim().split(' ')[0]).forEach(add);
  });
  // OG / twitter image
  pull(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi).forEach(add);
  pull(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/gi).forEach(add);
  // internal html anchors
  pull(/<a[^>]+href=["']([^"']+)["']/gi).forEach(h=>{
    try{
      const u = new URL(h, base);
      if(u.origin===new URL(base).origin && (u.pathname.endsWith('/') || u.pathname.endsWith('.html')))
        urls.add(norm(u.href));
    }catch{}
  });

  return Array.from(urls);
}

async function fetchText(u){
  const res = await fetch(u, { cache:'no-store', redirect:'follow' });
  const text = await res.text();
  return { res, text };
}

async function throttle(items, limit, worker){
  const out = [];
  let i=0, active=0;
  return new Promise(resolve=>{
    const next=()=>{
      if(i>=items.length && active===0){ resolve(out); return; }
      while(active<limit && i<items.length){
        const idx = i++; active++;
        worker(items[idx]).then(r=>{ out[idx]=r; active--; next(); });
      }
    };
    next();
  });
}

(async ()=>{
  console.log(`Origin: ${ORIGIN}`);
  const seedUrls = SEEDS.map(s=>norm(s));
  console.log('Seeds:', seedUrls.join(', '));

  const pages = await throttle(seedUrls, 6, async (u)=>{
    try{
      const { res, text } = await fetchText(u);
      return { url:u, ok:res.ok, status:res.status, html:text };
    }catch(e){
      return { url:u, ok:false, status:0, html:'' , err: e?.message || String(e) };
    }
  });

  const aset = new Set();
  for(const p of pages){
    if(p.ok){
      collectAssetsFromHTML(p.html, p.url).forEach(u=>aset.add(u));
    }else{
      aset.add(p.url); // include failing page
    }
  }
  const urls = Array.from(aset);

  console.log(`Checking ${urls.length} assets...`);

  const results = await throttle(urls, 10, async (u)=>{
    const out = { url:u, status:0, ok:false, type:'', expected:expectedMime(u), notes:[] };
    try{
      const res = await fetch(u, { cache:'no-store', redirect:'follow' });
      out.status = res.status;
      out.ok = res.ok;
      out.type = (res.headers.get('content-type')||'').split(';')[0];
      if(!res.ok) out.notes.push('HTTP '+res.status);
      if(out.expected && out.type && out.expected!==out.type) out.notes.push(`MIME mismatch (got ${out.type})`);
      if(u.includes('/public/')) out.notes.push('Contains /public/ in path');
    }catch(e){
      out.notes.push('Fetch error: '+(e?.message||String(e)));
    }
    await sleep(10);
    return out;
  });

  let bad=0, warn=0, ok=0;
  const lines = [['URL','Status','Type','Expected','Notes']];
  for(const r of results){
    const good = r.ok && (!r.expected || r.expected===r.type);
    if(good) ok++;
    else if(r.status===0 || r.status>=400) bad++;
    else warn++;
    lines.push([r.url, r.status||'', r.type||'', r.expected||'', r.notes.join('; ')]);
  }

  const csv = lines.map(row=>row.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  writeFileSync('./assets-check-report.csv', csv);

  console.log(`Done → ✅ ${ok}  ⚠️ ${warn}  ❌ ${bad}`);
  console.log('Report: assets-check-report.csv');
  process.exit(bad>0 ? 1 : 0);
})();
