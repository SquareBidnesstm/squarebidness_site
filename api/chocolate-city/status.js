const KEY = "chocolate-city:status";

async function redis(command, ...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Missing Upstash env vars");
  }

  const res = await fetch(`${url}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Redis error ${res.status}`);
  return res.json();
}

const DEFAULT_STATE = {
  fridayOpen: false,
  fridayText: "Friday — select nights only.",
  weekendStatus: "Open this weekend",
  eventTitle: "All Roads Lead to Chocolate City",
  eventNote: "Saturdays move the city. Sundays belong to it.",
  vipStatus: "VIP booth reservations coming soon.",
  announcement: "Stay tuned for updates, event nights, and VIP sections.",
  updatedAt: new Date().toISOString()
};

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      let state = DEFAULT_STATE;

      try {
        const data = await redis("GET", KEY);
        if (data?.result) state = { ...DEFAULT_STATE, ...JSON.parse(data.result) };
      } catch {}

      return res.status(200).json({ ok: true, state });
    }

    if (req.method === "POST") {
      const token = req.headers["x-admin-token"];

      if (!process.env.CHOCOLATE_CITY_ADMIN_TOKEN || token !== process.env.CHOCOLATE_CITY_ADMIN_TOKEN) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const body = req.body || {};
      const state = {
        fridayOpen: !!body.fridayOpen,
        fridayText: String(body.fridayText || DEFAULT_STATE.fridayText),
        weekendStatus: String(body.weekendStatus || DEFAULT_STATE.weekendStatus),
        eventTitle: String(body.eventTitle || DEFAULT_STATE.eventTitle),
        eventNote: String(body.eventNote || DEFAULT_STATE.eventNote),
        vipStatus: String(body.vipStatus || DEFAULT_STATE.vipStatus),
        announcement: String(body.announcement || DEFAULT_STATE.announcement),
        updatedAt: new Date().toISOString()
      };

      await redis("SET", KEY, JSON.stringify(state));

      return res.status(200).json({ ok: true, state });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
