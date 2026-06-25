const CLIENTS = {
  delish: {
    name: "Delish",
    accountEnv: "STRIPE_CONNECT_DELISH_ACCOUNT",
    feeEnv: "STRIPE_CONNECT_DELISH_FEE_CENTS"
  },

  puffs: {
    name: "Puff's Smokehouse",
    accountEnv: "STRIPE_CONNECT_PUFFS_ACCOUNT",
    feeEnv: "STRIPE_CONNECT_PUFFS_FEE_CENTS"
  },

  philson: {
    name: "Philson Le Fleuriste",
    accountEnv: "STRIPE_CONNECT_PHILSON_ACCOUNT",
    feeEnv: "STRIPE_CONNECT_PHILSON_FEE_CENTS"
  },

  chocolatecity: {
    name: "Chocolate City Lounge",
    accountEnv: "STRIPE_CONNECT_CHOCOLATECITY_ACCOUNT",
    feeEnv: "STRIPE_CONNECT_CHOCOLATECITY_FEE_CENTS"
  },

  richardson: {
    name: "Richardson Fashion",
    accountEnv: "STRIPE_CONNECT_RICHARDSON_ACCOUNT",
    feeEnv: "STRIPE_CONNECT_RICHARDSON_FEE_CENTS"
  }
};

export function getStripeConnectClient(clientKey = "") {
  const key = String(clientKey || "").trim().toLowerCase();
  const client = CLIENTS[key];

  if (!client) {
    return null;
  }

  const connectedAccountId = process.env[client.accountEnv] || "";
  const feeCents = Number(process.env[client.feeEnv] || 0);

  return {
    key,
    name: client.name,
    connectedAccountId,
    feeCents: Number.isFinite(feeCents) ? feeCents : 0,
    ready:
      connectedAccountId.startsWith("acct_") &&
      Number.isFinite(feeCents)
  };
}

export function getPublicStripeConnectClients() {
  return Object.entries(CLIENTS).map(([key, client]) => {
    const connectedAccountId = process.env[client.accountEnv] || "";
    const feeCents = Number(process.env[client.feeEnv] || 0);

    return {
      key,
      name: client.name,
      connected: connectedAccountId.startsWith("acct_"),
      feeConfigured: Number.isFinite(feeCents) && feeCents > 0
    };
  });
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(200).json({
    ok: true,
    mode: process.env.STRIPE_ONBOARDING_SECRET_KEY?.startsWith("sk_live_")
      ? "live"
      : "test",
    clients: getPublicStripeConnectClients()
  });
}
