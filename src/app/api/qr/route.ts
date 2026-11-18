import { NextResponse } from "next/server";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const text = url.searchParams.get("text") ?? "https://www.tiktok.com/@arena";
  const dark = url.searchParams.get("dark") ?? "#050509";
  try {
    const svg = await QRCode.toString(text, {
      type: "svg",
      margin: 1,
      width: 280,
      color: { dark, light: "#ffffff00" },
      errorCorrectionLevel: "M",
    });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    // QR üretilemese bile boş SVG döner — sayfa kırılmaz
    const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#fff"/><text x="60" y="64" font-size="11" text-anchor="middle" fill="#666">QR yok</text></svg>`;
    return new NextResponse(fallback, {
      status: 200,
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=60" },
    });
  }
}
