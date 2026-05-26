import { supabaseServer } from "./supabase/server";

/**
 * Returns true if the given E.164 phone number has opted out of SMS.
 * Returns false if not found or opted back in.
 */
export async function isSmsOptedOut(phone: string): Promise<boolean> {
  if (!phone) return false;
  const { data } = await supabaseServer
    .from("sms_opt_outs")
    .select("opted_out")
    .eq("phone", phone)
    .maybeSingle();
  return data?.opted_out === true;
}

/**
 * Mark a phone as opted out (STOP).
 */
export async function smsOptOut(phone: string): Promise<void> {
  await supabaseServer
    .from("sms_opt_outs")
    .upsert({ phone, opted_out: true, updated_at: new Date().toISOString() }, { onConflict: "phone" });
}

/**
 * Mark a phone as opted back in (UNSTOP / START).
 */
export async function smsOptIn(phone: string): Promise<void> {
  await supabaseServer
    .from("sms_opt_outs")
    .upsert({ phone, opted_out: false, updated_at: new Date().toISOString() }, { onConflict: "phone" });
}

/** STOP keywords per CTIA guidelines */
export const STOP_KEYWORDS = new Set([
  "stop", "stopall", "unsubscribe", "cancel", "end", "quit",
]);

/** OPT-IN keywords */
export const START_KEYWORDS = new Set([
  "start", "unstop", "yes",
]);
