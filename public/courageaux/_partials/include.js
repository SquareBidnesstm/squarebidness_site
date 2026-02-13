<script>
(async function () {
  async function inject(id, url) {
    const host = document.getElementById(id);
    if (!host) return;
    const res = await fetch(url, { cache: "no-cache" });
    host.innerHTML = await res.text();
  }
  await inject("cx-nav", "/courageaux/_partials/nav.html");
  await inject("cx-footer", "/courageaux/_partials/footer.html");
})();
</script>
