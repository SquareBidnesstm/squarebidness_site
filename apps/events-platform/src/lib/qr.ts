import QRCode from "qrcode";
import { PLATFORM_URL } from "./constants";

// Generate QR code as a data URL (for ticket PDFs / wallet passes)
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
