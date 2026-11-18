import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityLog } from "@/db/schema";
import { getSettings, publicSettings, saveSettings, type ArenaSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const current = await getSettings();
    return NextResponse.json({ data: publicSettings(current), defaults: false });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message, data: null }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let body: Partial<ArenaSettings> = {};
  try {
    body = (await request.json()) as Partial<ArenaSettings>;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }
  const current = await getSettings();
  const patch: Partial<ArenaSettings> = { ...body };
  if (patch.telegramBotToken === "••••••••") delete patch.telegramBotToken;
  if (patch.tiktokSessionId === "••••••••") delete patch.tiktokSessionId;
  if (patch.defaultCommission !== undefined) {
    patch.defaultCommission = Math.max(0, Math.min(80, Number(patch.defaultCommission) || 0));
  }
  if (patch.weeklyTargetTry !== undefined) {
    patch.weeklyTargetTry = Math.max(0, Number(patch.weeklyTargetTry) || 0);
  }
  const next = await saveSettings(patch);
  await db.insert(activityLog).values({
    kind: "settings",
    message: `Ayarlar güncellendi (${Object.keys(patch).length} alan).`,
    meta: { keys: Object.keys(patch) },
  });
  return NextResponse.json({ data: publicSettings(next), previous: Boolean(current) });
}
