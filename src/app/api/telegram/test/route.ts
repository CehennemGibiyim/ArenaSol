import { NextResponse } from "next/server";
import { notificationStatus, sendNotification } from "@/server/notify";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ data: await notificationStatus() });
  } catch (error) {
    return NextResponse.json({ data: null, error: (error as Error).message });
  }
}

export async function POST(request: Request) {
  let body: { text?: string } = {};
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    body = {};
  }
  try {
    const status = await notificationStatus();
    const result = await sendNotification(
      body.text?.trim() ||
        "Test bildirimi: Arena Live OS alarm motoru çalışıyor. Hediye eşikleri bu kanala düşecek.",
      "test-bildirimi",
    );
    return NextResponse.json({ ...result, status }, { status: result.sent ? 200 : 202 });
  } catch (error) {
    return NextResponse.json(
      { sent: false, channel: "none", detail: `Bildirim gönderilemedi: ${(error as Error).message}`, status: null },
      { status: 200 },
    );
  }
}
