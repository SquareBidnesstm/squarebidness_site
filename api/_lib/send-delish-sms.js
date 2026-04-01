export async function sendDelishSms({ to, message }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    console.warn("Twilio env vars missing. SMS skipped.");
    return { ok: false, skipped: true, reason: "missing_env" };
  }

  if (!to || !message) {
    return { ok: false, skipped: true, reason: "missing_to_or_message" };
  }

  const body = new URLSearchParams({
    To: to,
    From: from,
    Body: message
  });

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Twilio SMS error:", data);
    return { ok: false, error: data };
  }

  return { ok: true, sid: data.sid };
}
