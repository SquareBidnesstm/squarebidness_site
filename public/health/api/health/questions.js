// api/health/questions.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_HEALTH_URL,
  process.env.SUPABASE_HEALTH_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const allowed = ["https://www.squarebidness.com", "https://health.squarebidness.com"];
  const origin = req.headers.origin;
  if (allowed.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { full_name, email, question } = req.body || {};

  if (!full_name || !email || !question) {
    return res.status(400).json({ error: "Name, email, and question are required." });
  }

  const { error } = await supabase.from("health_questions").insert([{
    full_name: String(full_name).trim(),
    email:     String(email).trim().toLowerCase(),
    question:  String(question).trim(),
  }]);

  if (error) {
    console.error("[health/questions] Supabase error:", error);
    return res.status(500).json({ error: "Could not save question. Please try again." });
  }

  // Email notify Marcus
  try {
    const key = process.env.RESEND_API_KEY;
    const from_addr = process.env.RESEND_FROM || "Square Bidness Health <noreply@squarebidness.com>";
    if (key) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: from_addr,
          to: ["squarebidnessapparel@gmail.com"],
          subject: `[SBHealth] Question from ${String(full_name).trim()}`,
          text: `New question submitted via health.squarebidness.com/questions/\n\nName: ${String(full_name).trim()}\nEmail: ${String(email).trim()}\n\nQuestion:\n${String(question).trim()}`,
        }),
      });
    }
  } catch (emailErr) {
    console.error("[health/questions] Email notify error:", emailErr);
  }

  return res.status(200).json({ ok: true });
}
