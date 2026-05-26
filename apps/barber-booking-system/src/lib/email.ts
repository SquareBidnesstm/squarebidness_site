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

  // List-Unsubscribe headers let email clients (Gmail, Apple Mail, etc.) surface
  // a one-click unsubscribe button, improving deliverability and CTIA compliance.
  const unsubscribeEmail = `mailto:unsubscribe@squarebidness.com?subject=Unsubscribe&body=${encodeURIComponent(to)}`;

  const resendResponse = await fetch("https://api.resend.com/emails", {
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
      headers: {
        "List-Unsubscribe": `<${unsubscribeEmail}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!resendResponse.ok) {
    throw new Error(`Resend API error: ${resendResponse.status}`);
  }
}

// ─── Shop Signup Notification ────────────────────────────────────────────────
// Fired from /api/onboard after a new shop is created.
// Sends: (1) internal alert to platform admin, (2) optional welcome to owner.
export async function sendShopSignupNotification({
  shopName,
  shopSlug,
  ownerName,
  ownerEmail,
  city,
  state,
  shopType,
}: {
  shopName: string;
  shopSlug: string;
  ownerName: string;
  ownerEmail?: string | null;
  city: string;
  state: string;
  shopType: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // no-op if not configured

  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL ?? "admin@squarebidness.com";
  const bookingUrl = `https://booking.squarebidness.com/${shopSlug}`;
  const adminUrl = `https://booking.squarebidness.com/${shopSlug}/admin`;

  // 1. Internal notification to platform admin
  const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#050505;color:#ffffff;font-family:system-ui,sans-serif;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#d4af37;height:4px;"></td></tr>
        <tr><td style="padding:32px 36px;">
          <h1 style="color:#ffffff;font-size:22px;font-weight:900;margin:0 0 6px;">🆕 New Shop Signed Up</h1>
          <p style="color:#888;font-size:14px;margin:0 0 24px;">SquareBidness Booking Platform</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;"><strong style="color:#d4af37;">Shop:</strong> <span style="color:#fff;">${shopName}</span></p>
              <p style="margin:0 0 8px;"><strong style="color:#d4af37;">Owner:</strong> <span style="color:#fff;">${ownerName}</span></p>
              ${ownerEmail ? `<p style="margin:0 0 8px;"><strong style="color:#d4af37;">Email:</strong> <span style="color:#fff;">${ownerEmail}</span></p>` : ""}
              <p style="margin:0 0 8px;"><strong style="color:#d4af37;">Type:</strong> <span style="color:#fff;">${shopType}</span></p>
              <p style="margin:0 0 8px;"><strong style="color:#d4af37;">Location:</strong> <span style="color:#fff;">${city}, ${state}</span></p>
              <p style="margin:0;"><strong style="color:#d4af37;">Slug:</strong> <span style="color:#aaa;font-family:monospace;">/${shopSlug}</span></p>
            </td></tr>
          </table>
          <p style="margin:0 0 10px;"><a href="${bookingUrl}" style="color:#d4af37;text-decoration:none;font-weight:700;">View Booking Page →</a></p>
          <p style="margin:0;"><a href="${adminUrl}" style="color:#888;text-decoration:none;font-size:13px;">Admin Dashboard</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "SquareBidness Platform <bookings@squarebidness.com>",
      to: [adminEmail],
      subject: `New shop signup: ${shopName} (${shopSlug})`,
      html: internalHtml,
    }),
  }).catch((err) => console.error("Signup admin notification error:", err));

  // 2. Welcome email to shop owner (only if email provided)
  if (ownerEmail) {
    const welcomeHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#050505;color:#ffffff;font-family:system-ui,sans-serif;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#d4af37;height:4px;"></td></tr>
        <tr><td style="padding:32px 36px;">
          <h1 style="color:#ffffff;font-size:24px;font-weight:900;margin:0 0 6px;">Welcome to SquareBidness!</h1>
          <p style="color:#888;font-size:14px;margin:0 0 24px;">Your booking page is live and ready.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border:1px solid #222;border-radius:12px;margin-bottom:24px;">
            <tr><td style="padding:20px 24px;">
              <p style="margin:0 0 8px;font-weight:800;font-size:16px;">${shopName}</p>
              <p style="margin:0 0 4px;color:#aaa;font-size:14px;">${city}, ${state}</p>
              <p style="margin:0;color:#d4af37;font-family:monospace;font-size:14px;">${bookingUrl}</p>
            </td></tr>
          </table>
          <p style="margin:0 0 10px;"><a href="${bookingUrl}" style="display:inline-block;padding:14px 28px;background:#d4af37;color:#000;font-weight:800;border-radius:10px;text-decoration:none;font-size:15px;">View Your Booking Page</a></p>
          <p style="margin:16px 0 0;"><a href="${adminUrl}" style="color:#888;text-decoration:none;font-size:13px;">Admin Dashboard →</a></p>
          <p style="color:#444;font-size:12px;margin:24px 0 0;">Powered by <a href="https://squarebidness.com" style="color:#d4af37;text-decoration:none;">SquareBidness</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "SquareBidness <bookings@squarebidness.com>",
        to: [ownerEmail],
        subject: `Your booking page is live — ${shopName}`,
        html: welcomeHtml,
      }),
    }).catch((err) => console.error("Signup welcome email error:", err));
  }
}
