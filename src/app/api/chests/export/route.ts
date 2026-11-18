import { NextResponse } from "next/server";
import { listChests, listFlows } from "@/server/chest";

export const dynamic = "force-dynamic";

export async function GET() {
  const [chestResult, flowResult] = await Promise.allSettled([listChests({}, 500), listFlows(200)]);
  const chests = chestResult.status === "fulfilled" ? chestResult.value : [];
  const flows = flowResult.status === "fulfilled" ? flowResult.value : [];
  const header = [
    "tip",
    "yayinci",
    "baslik",
    "jeton",
    "kontenjan",
    "katilan",
    "oran",
    "izleyici",
    "kalan_sn",
    "durum",
    "kaynak",
    "envelope_id",
    "room_id",
    "tespit",
  ];
  const rows = [
    ...chests.map((chest) => [
      chest.kind === "bag" ? "canta" : chest.variant,
      chest.username,
      chest.title,
      chest.coins,
      chest.slots,
      chest.joined,
      chest.ratio,
      chest.viewers,
      chest.secondsLeft,
      chest.derivedStatus,
      chest.source,
      chest.envelopeId,
      chest.roomId,
      new Date(chest.detectedAt).toISOString(),
    ]),
    ...flows.map((flow) => [
      "jeton-akisi",
      flow.username,
      flow.title,
      flow.diamonds,
      flow.senders,
      0,
      flow.ratio,
      flow.viewers,
      0,
      "open",
      "hediye",
      flow.envelopeId,
      flow.roomId,
      new Date(flow.updatedAt).toISOString(),
    ]),
  ];
  const csv = [header.join(";"), ...rows.map((row) => row.map((cell) => String(cell ?? "").replace(/;/g, ",")).join(";"))].join("\n");
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="arena-sandik-radari-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
