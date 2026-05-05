export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed." });
  }

  try {
    const { to, body } = req.body || {};

    if (!to || !body) {
      return res.status(400).json({
        ok: false,
        error: "Missing 'to' or 'body'.",
      });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return res.status(500).json({
        ok: false,
        error: "Missing Twilio environment variables.",
      });
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append("To", to);
    params.append("Body", body);

    // Force Delish messages to use the Delish number
    params.append("From", "+13186129715");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: data.message || "Twilio send failed.",
        details: data,
      });
    }

    return res.status(200).json({
      ok: true,
      sid: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to send SMS.",
    });
  }
}
