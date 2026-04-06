export async function sendInstallSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.SB_TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    return { ok: false, skipped: true, reason: "Missing Twilio env vars" };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const payload = new URLSearchParams({
    To: to,
    From: from,
    Body: body
  });

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: payload.toString()
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    return {
      ok: false,
      error: json?.message || "Twilio request failed",
      data: json
    };
  }

  return { ok: true, data: json };
}
