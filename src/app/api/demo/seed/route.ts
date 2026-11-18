import { NextResponse } from "next/server";
import { seedDemoData } from "@/server/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  try {
    const result = await seedDemoData(force);
    return NextResponse.json(result, { status: result.seeded ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    usage: "POST /api/demo/seed?force=1 ile gerçek kurulum verisini yükleyin (izleme listesi + ayarlar + gerçek canlı kontrol).",
  });
}
