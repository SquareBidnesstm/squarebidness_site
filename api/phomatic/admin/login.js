// /api/phomatic/admin/login.js
// POST /api/phomatic/admin/login
// Body: { password }
// Returns a signed 12-hour admin token on success.

import { computeAdminToken } from "../_config.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { password } = req.body || {};
  const adminPassword = process.env.PHOMATIC_ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("PHOMATIC ADMIN: PHOMATIC_ADMIN_PASSWORD not set");
    return res.status(500).json({ ok: false, error: "Admin not configured" });
  }

  if (!password || typeof password !== "string") {
    return res.status(400).json({ ok: false, error: "Password required" });
  }

  // Constant-time compare to prevent timing attacks
  const enc = new TextEncoder();
  const a = enc.encode(password.trim());
  const b = enc.encode(adminPassword);
  let diff = a.length !== b.length ? 1 : 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= a[i] ^ b[i];

  if (diff !== 0) {
    return res.status(401).json({ ok: false, error: "Incorrect password" });
  }

  try {
    const token = await computeAdminToken();
    return res.status(200).json({ ok: true, token });
  } catch (err) {
    console.error("PHOMATIC ADMIN LOGIN ERROR:", err);
    return res.status(500).json({ ok: false, error: "Could not generate token" });
  }
}
