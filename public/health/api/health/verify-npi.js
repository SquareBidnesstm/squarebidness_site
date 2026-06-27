// api/health/verify-npi.js
// Proxies the public NPPES NPI Registry API and normalizes the response.
// GET /api/health/verify-npi?npi=1234567890

const TAXONOMY_MAP = {
  "313M00000X": "Nursing Home / Long-Term Care",
  "314000000X": "Nursing Home / Long-Term Care",
  "315D00000X": "Nursing Home / Long-Term Care",
  "315P00000X": "Nursing Home / Long-Term Care",
  "251G00000X": "Home Health Agency",
  "251E00000X": "Home Health Agency",
  "282N00000X": "Hospital",
  "282NC0060X": "Hospital",
  "2865X1600X": "Hospital",
  "261QR1300X": "Rural Health Clinic",
  "261QR0200X": "Rural Health Clinic",
  "311500000X": "Assisted Living",
  "310400000X": "Assisted Living",
  "174400000X": "Home Health Agency",
};

export default async function handler(req, res) {
  const allowed = ["https://www.squarebidness.com", "https://health.squarebidness.com"];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const npi = (req.query.npi || "").replace(/\D/g, "");
  if (!npi || npi.length !== 10) {
    return res.status(400).json({ error: "NPI must be 10 digits." });
  }

  let data;
  try {
    const r = await fetch(
      `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`,
      { headers: { Accept: "application/json" } }
    );
    data = await r.json();
  } catch (err) {
    console.error("[verify-npi] NPPES fetch error:", err);
    return res.status(502).json({ error: "Could not reach NPI registry." });
  }

  if (!data.result_count || data.result_count === 0) {
    return res.status(404).json({ found: false, error: "NPI not found." });
  }

  const result = data.results[0];
  const basic  = result.basic || {};

  // Prefer LOCATION address, fall back to MAILING
  const addresses = result.addresses || [];
  const addr =
    addresses.find((a) => a.address_purpose === "LOCATION") ||
    addresses[0] ||
    {};

  // Map primary taxonomy to a facility type label
  const taxonomies = result.taxonomies || [];
  const primaryTax = taxonomies.find((t) => t.primary) || taxonomies[0] || {};
  const facilityType = TAXONOMY_MAP[primaryTax.code] || null;

  const name =
    basic.organization_name ||
    [basic.first_name, basic.last_name].filter(Boolean).join(" ") ||
    null;

  const parish = addr.city
    ? addr.state === "LA"
      ? addr.city
      : `${addr.city}, ${addr.state}`
    : null;

  return res.status(200).json({
    found: true,
    npi,
    facility_name:  name,
    address:        addr.address_1 || null,
    city:           addr.city     || null,
    state:          addr.state    || null,
    zip:            addr.postal_code ? addr.postal_code.substring(0, 5) : null,
    parish,
    facility_type:  facilityType,
    taxonomy_desc:  primaryTax.desc || null,
    enumeration_type: result.enumeration_type || null,
  });
}
