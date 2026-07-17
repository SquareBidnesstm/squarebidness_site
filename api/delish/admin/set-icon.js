import Stripe from "stripe";

const DELISH_ACCOUNT = "acct_1TspkpAcqVPZn6LU";
const ADMIN_TOKEN = process.env.COURAGEAUX_ADMIN_TOKEN;
const LOGO_URL = "https://www.squarebidness.com/delish/assets/delish-logo-mark-192.png";

export default async function handler(req, res) {
  if (req.query.token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_ONBOARDING_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });

    // Fetch the logo from the public URL
    const imgRes = await fetch(LOGO_URL);
    if (!imgRes.ok) {
      return res.status(500).json({ error: "Failed to fetch logo", status: imgRes.status });
    }
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Upload to platform account (no stripeAccount header — required for branding)
    const file = await stripe.files.create({
      purpose: "dispute_evidence",
      file: {
        data: imgBuffer,
        name: "delish-icon.png",
        type: "image/png",
      },
    });

    // Set as branding icon on the connected account
    const account = await stripe.accounts.update(DELISH_ACCOUNT, {
      settings: {
        branding: {
          icon: file.id,
        },
      },
    });

    return res.status(200).json({
      ok: true,
      fileId: file.id,
      icon: account.settings.branding.icon,
    });
  } catch (err) {
    console.error("SET ICON ERROR:", err);
    return res.status(500).json({ error: err.message, type: err.type || "unknown" });
  }
}
