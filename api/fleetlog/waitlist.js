// api/fleetlog/waitlist.js
export const config = { runtime: "nodejs" };

const clean = (s, n = 300) =>
  String(s ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, n);

async function kv(cmd, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Missing UPSTASH env vars");

  const r = await fetch(`${url}/${cmd}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "KV error");
  return j?.result;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const body = req.body && typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    if (body.company_website) return res.status(200).json({ ok: true }); // honeypot

    const name = clean(body.name, 120);
    const email = clean(body.email, 160).toLowerCase();
    if (!name) return res.status(400).json({ ok: false, error: "Name required" });
    if (!email || !email.includes("@")) return res.status(400).json({ ok: false, error: "Valid email required" });

    const payload = {
      brand: "sb-fleetlog",
      name,
      email,
      phone: clean(body.phone, 40),
      type: clean(body.type, 40) || "owner_operator",
      trucks: clean(body.trucks, 10),
      notes: clean(body.notes, 1200),
      created_at: new Date().toISOString(),
      ip: clean(req.headers["x-forwarded-for"] || "", 120),
      ua: clean(req.headers["user-agent"] || "", 180),
    };

    const id = `flw_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    await kv("set", `fleetlog:waitlist:${id}`, JSON.stringify(payload));
    await kv("lpush", "fleetlog:waitlist:index", id);

    return res.status(200).json({ ok: true, id });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "Server error" });
  }
}
