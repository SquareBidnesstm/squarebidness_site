import twilio from "twilio";

function getClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export async function sendBuyerSMS(params: {
  phone: string;
  buyerName: string;
  eventTitle: string;
  eventDate: string;
  orderCode: string;
  orderId: string;
  ticketCount: number;
}) {
  const client = getClient();
  if (!client) {
    console.warn("Twilio not configured — skipping SMS");
    return;
  }

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return;

  const message =
    `SB Events: You're in! ✅\n` +
    `${params.ticketCount} ticket${params.ticketCount !== 1 ? "s" : ""} for ${params.eventTitle} on ${params.eventDate}.\n` +
    `Order: ${params.orderCode}\n` +
    `View tickets: https://events.squarebidness.com/orders/${params.orderId}`;

  try {
    await client.messages.create({
      body: message,
      from,
      to: formatPhone(params.phone),
    });
  } catch (err) {
    console.error("SMS send error:", err);
  }
}

export async function sendOrganizerSaleSMS(params: {
  phone: string;
  eventTitle: string;
  buyerName: string;
  ticketCount: number;
  total: number;
}) {
  const client = getClient();
  if (!client) return;

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) return;

  const message =
    `SB Events 🎟️ New sale!\n` +
    `${params.ticketCount} ticket${params.ticketCount !== 1 ? "s" : ""} sold for ${params.eventTitle}.\n` +
    `Buyer: ${params.buyerName} · $${params.total.toFixed(2)}\n` +
    `events.squarebidness.com/organizer/dashboard`;

  try {
    await client.messages.create({
      body: message,
      from,
      to: formatPhone(params.phone),
    });
  } catch (err) {
    console.error("Organizer SMS error:", err);
  }
}
