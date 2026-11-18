/**
 * QR kodu üretimi (fırsatlar listesindeki "telefondan aç" düğmesi için).
 */

import QRCode from "qrcode";

export async function qrSvgDataUrl(text: string): Promise<string> {
  try {
    const svg = await QRCode.toString(text, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
      width: 220,
    });
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  } catch {
    return "";
  }
}
