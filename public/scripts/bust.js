<!-- /scripts/bust.js -->
<script>
/*
  Square Bidness — cache buster
  Adds ?v=timestamp to selected assets so mobile/CDN doesn't serve old files.
  Use data-bust="1" on <img>, <link>, <script> you want to stay fresh.
*/
(function () {
  const STAMP = Date.now();

  // anything with data-bust="1" gets a version query added
  document.querySelectorAll('[data-bust="1"]').forEach((el) => {
    // handle <img src="...">
    if (el.tagName === 'IMG' && el.src) {
      const url = new URL(el.src, location.origin);
      url.searchParams.set('v', STAMP);
      el.src = url.toString();
    }

    // handle <link rel="stylesheet" ...>
    if (el.tagName === 'LINK' && el.href) {
      const url = new URL(el.href, location.origin);
      url.searchParams.set('v', STAMP);
      el.href = url.toString();
    }

    // handle <script src="...">
    if (el.tagName === 'SCRIPT' && el.src) {
      const url = new URL(el.src, location.origin);
      url.searchParams.set('v', STAMP);
      el.src = url.toString();
    }
  });
})();
</script>
