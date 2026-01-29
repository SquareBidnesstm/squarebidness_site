/* Steakhouse schema (shared) */
(function () {
  const pageUrl = (document.querySelector('link[rel="canonical"]')?.href) || location.href;

  const schema = {
    "@context": "https://schema.org",
    "@type": ["Restaurant","LocalBusiness"],
    "@id": "https://squarebidness.com/steakhouse/#business",
    "name": "The SteaKhouse",
    "url": "https://squarebidness.com/steakhouse/",
    "image": [
      "https://squarebidness.com/steakhouse/assets/og/the-steakhouse_1200x630.jpg"
    ],
    "telephone": "+1-985-662-5090",
    "priceRange": "$$$",
    "servesCuisine": ["Steakhouse","Seafood","American"],
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "200 SW Railroad Ave",
      "addressLocality": "Hammond",
      "addressRegion": "LA",
      "postalCode": "70401",
      "addressCountry": "US"
    },
    "sameAs": [
      "https://www.facebook.com/SteaKhouse985/",
      "https://www.instagram.com/thesteakhouse/"
    ],
    "acceptsReservations": "https://www.opentable.com/r/the-steakhouse-hammond",
    "menu": "https://squarebidness.com/steakhouse/menu/",
    "openingHoursSpecification": [
      {"@type":"OpeningHoursSpecification","dayOfWeek":"Tuesday","opens":"17:00","closes":"20:00"},
      {"@type":"OpeningHoursSpecification","dayOfWeek":["Wednesday","Thursday"],"opens":"17:00","closes":"21:00"},
      {"@type":"OpeningHoursSpecification","dayOfWeek":"Friday","opens":"17:00","closes":"22:00"},
      {"@type":"OpeningHoursSpecification","dayOfWeek":"Saturday","opens":"15:00","closes":"22:00"}
    ]
  };

  // Inject as JSON-LD on every page that loads this script
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.textContent = JSON.stringify({ ...schema, "mainEntityOfPage": pageUrl });
  document.head.appendChild(s);
})();
