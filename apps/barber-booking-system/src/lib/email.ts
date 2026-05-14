export async function sendConfirmationEmail({
  to,
  customerName,
  shopName,
  barberName,
  serviceName,
  appointmentDate,
  startsAt,
  bookingCode,
  timezone,
  cancelToken,
}: {
  to: string;
  customerName: string;
  shopName: string;
  barberName: string;
  serviceName: string;
  appointmentDate: string;
  startsAt: string;
  bookingCode: string;
  timezone: string;
  cancelToken?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // no-op if not configured

  const dateStr = new Date(`${appointmentDate}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const timeStr = new Date(startsAt).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: timezone,
  });

  const cancelUrl = cancelToken
    ? `https://booking.squarebidness.com/cancel/${cancelToken}`
    : null;
  const rescheduleUrl = cancelToken
    ? `https://booking.squarebidness.com/reschedule/${cancelToken}`
    : null;

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#050505;color:#ffffff;font-family:system-ui,sans-serif;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#d4af37;height:4px;"></td></tr>
        <tr><td style="padding:32px 36px;">
          <div style="font-size:36px;margin-bottom:16px;">✂️</div>
          <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0 0 6px;">You're Confirmed!</h1>
          <p style="color:#888;font-size:14px;margin:0 0 28px;">${shopName}</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 4px;font-weight:800;font-size:16px;">${customerName}</p>
              <p style="margin:0 0 4px;color:#aaa;font-size:14px;">${serviceName} with ${barberName}</p>
              <p style="margin:0 0 4px;color:#d4af37;font-weight:700;font-size:16px;">${dateStr} at ${timeStr}</p>
              <p style="margin:0;color:#555;font-size:13px;">Booking Code: <strong style="color:#fff;font-family:monospace;">${bookingCode}</strong></p>
            </td></tr>
          </table>

          ${rescheduleUrl ? `<p style="margin:0 0 10px;"><a href="${rescheduleUrl}" style="color:#d4af37;text-decoration:none;font-weight:700;">📅 Reschedule Appointment</a></p>` : ""}
          ${cancelUrl ? `<p style="margin:0 0 24px;"><a href="${cancelUrl}" style="color:#888;text-decoration:none;font-size:13px;">Cancel Appointment</a></p>` : ""}

          <p style="color:#444;font-size:12px;margin:0;">Powered by <a href="https://squarebidness.com" style="color:#d4af37;text-decoration:none;">SquareBidness</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "SquareBidness Booking <bookings@squarebidness.com>",
      to: [to],
      subject: `Confirmed: ${serviceName} with ${barberName} — ${dateStr}`,
      html,
    }),
  });
}
