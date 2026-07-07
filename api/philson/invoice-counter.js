const key = () => `philson:invoice_counter:${new Date().getFullYear()}`;

async function upstash(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing Upstash env vars");
  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

function format(n) {
  return `${new Date().getFullYear()}-${String(n).padStart(3, "0")}`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.squarebidness.com");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      // Preview only — returns what the next number WILL be, does not reserve it
      const data = await upstash("GET", key());
      const current = parseInt(data.result) || 0;
      return res.status(200).json({ ok: true, invoiceNumber: format(current + 1) });
    }

    if (req.method === "POST") {
      // Atomically increment and reserve the number
      const data = await upstash("INCR", key());
      return res.status(200).json({ ok: true, invoiceNumber: format(data.result) });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
