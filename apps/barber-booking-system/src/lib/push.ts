import webpush from "web-push";
import { supabaseServer } from "./supabase/server";

webpush.setVapidDetails(
  "mailto:support@squarebidness.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushToBarber(
  barberId: string,
  payload: { title: string; body: string; url?: string }
) {
  const { data: subs } = await supabaseServer
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("barber_id", barberId);

  if (!subs || subs.length === 0) return;

  const json = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json
        );
      } catch (err: any) {
        // 410 Gone = subscription expired, remove it
        if (err?.statusCode === 410) stale.push(sub.id);
      }
    })
  );

  if (stale.length > 0) {
    await supabaseServer.from("push_subscriptions").delete().in("id", stale);
  }
}

export async function sendPushToShopAdmins(
  shopId: string,
  payload: { title: string; body: string; url?: string }
) {
  const { data: subs } = await supabaseServer
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("shop_id", shopId)
    .is("barber_id", null);

  if (!subs || subs.length === 0) return;

  const json = JSON.stringify(payload);
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          json
        );
      } catch (err: any) {
        if (err?.statusCode === 410) stale.push(sub.id);
      }
    })
  );

  if (stale.length > 0) {
    await supabaseServer.from("push_subscriptions").delete().in("id", stale);
  }
}
