import QRCode from "qrcode";
import { SupabaseClient } from "@supabase/supabase-js";
import { PLATFORM_URL } from "./constants";

// Storage bucket for QR images (must be public, created via migration)
const QR_BUCKET = "qr-codes";

// Generate QR code as a data URL (kept for email templates / PDF wallets)
export async function generateQRDataURL(ticketCode: string): Promise<string> {
  const url = `${PLATFORM_URL}/tickets/${ticketCode}`;
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 2,
    width: 400,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * Renders the QR code as a PNG buffer and uploads it to Supabase Storage.
 * Returns the public URL of the uploaded image.
 * Falls back to a data URL if the upload fails so ticket creation never aborts.
 *
 * @param ticketCode — e.g. "TKT-ABC123-XYZ"
 * @param supabase   — service-role client (required for storage writes)
 */
export async function uploadQRToStorage(
  ticketCode: string,
  supabase: SupabaseClient
): Promise<string> {
  const verifyUrl = `${PLATFORM_URL}/tickets/${ticketCode}`;

  try {
    // toBuffer is only available in Node.js environments (not Edge)
    const buffer: Buffer = await QRCode.toBuffer(verifyUrl, {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 400,
      color: { dark: "#000000", light: "#ffffff" },
    });

    const path = `${ticketCode}.png`;
    const { error: uploadErr } = await supabase.storage
      .from(QR_BUCKET)
      .upload(path, buffer, {
        contentType: "image/png",
        upsert: true, // safe for retries and ticket-code regeneration
      });

    if (uploadErr) {
      console.error("[uploadQRToStorage] upload failed:", uploadErr.message);
      // Fall through to data-URL fallback
    } else {
      const { data } = supabase.storage.from(QR_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    }
  } catch (err) {
    console.error("[uploadQRToStorage] error:", err);
  }

  // Fallback: generate a data URL so the ticket is still valid
  return generateQRDataURL(ticketCode);
}

// Generate QR code as SVG string
export async function generateQRSVG(ticketCode: string): Promise<string> {
  const url = `${PLATFORM_URL}/tickets/${ticketCode}`;
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
  });
}

// The URL a QR code resolves to
export function ticketVerifyURL(ticketCode: string): string {
  return `${PLATFORM_URL}/tickets/${ticketCode}`;
}
