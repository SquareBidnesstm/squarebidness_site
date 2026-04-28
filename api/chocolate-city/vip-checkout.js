const KEY = "chocolate-city:vip:bookings";

const PACKAGES = {
  section_one: {
    name: "Section One",
    fullPrice: 300,
    deposit: 100,
    description: "6 bands, 10 Vegas Bomb shots, 4 waters, VIP parking, no wait in line."
  },
  section_two: {
    name: "Section Two",
    fullPrice: 400,
    deposit: 150,
    description: "6 bands, 10 Vegas Bomb shots, 4 waters, VIP parking, no wait in line, 1 premium bottle of choice."
  },
  city_section: {
    name: "The City Section",
    fullPrice: 650,
    deposit: 200,
    description: "10 bands, 10 Vegas Bomb shots, 4 waters, 2 premium bottles, 5-beer bucket, hurricane bottle, VIP parking, no wait in line."
  }
};

async function redis(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) throw new Error("Missing Upstash env vars");

  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const stripeKey = process.env.CHOCOLATE_CITY_STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return res.status(500).json({ ok: false, error: "Stripe key missing" });
    }

    const Stripe = (await import("stripe")).default;
    const stripe = Stripe(stripeKey);

    const body = req.body || {};
    const selectedPackage = PACKAGES[body.packageId];

    if (!selectedPackage) {
      return res.status(400).json({ ok: false, error: "Invalid VIP package" });
    }

    const data = await redis("GET", KEY);
    const bookings = data?.result ? JSON.parse(data.result) : [];

    if (bookings.length >= 2) {
      return res.status(409).json({
        ok: false,
        error: "VIP sections are sold out for this night."
      });
    }

    const successUrl =
      process.env.CHOCOLATE_CITY_VIP_SUCCESS_URL ||
      "https://www.squarebidness.com/chocolate-city/vip-success/";

    const cancelUrl =
      process.env.CHOCOLATE_CITY_VIP_CANCEL_URL ||
      "https://www.squarebidness.com/chocolate-city/";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      phone_number_collection: { enabled: true },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: selectedPackage.deposit * 100,
            product_data: {
              name: `Chocolate City VIP Deposit — ${selectedPackage.name}`,
              description: selectedPackage.description
            }
          }
        }
      ],
      metadata: {
        business: "Chocolate City Lounge LLC",
        packageId: body.packageId,
        packageName: selectedPackage.name,
        fullPrice: String(selectedPackage.fullPrice),
        deposit: String(selectedPackage.deposit),
        remainingBalance: String(selectedPackage.fullPrice - selectedPackage.deposit),
        type: "vip_deposit"
      }
    });

    return res.status(200).json({ ok: true, url: session.url });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
