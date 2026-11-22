import { db } from "@/db";
import { sql } from "drizzle-orm";
import { getScannerStatus } from "@/server/scanner";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

/**
 * Panel her zaman ayakta kalır: veritabanı düşse bile bu uç 200 döner,
 * böylece Windows panel gözcüsü paneli gereksiz yere yeniden başlatmaz.
 */
export async function GET() {
  let dbOk = true;
  try {
    await db.execute(sql`select 1`);
  } catch {
    dbOk = false;
  }
  const status = await getScannerStatus().catch(() => null);
  const settings = await getSettings().catch(() => null);
  return Response.json(
    {
      ok: true,
      panel: "online",
      db: dbOk,
      scanner: {
        running: status?.running ?? false,
        lastRunAt: status?.lastRunAt ?? null,
        intervalSeconds: status?.intervalSeconds ?? 120,
        listening: status?.listening ?? 0,
        maxRooms: status?.maxRooms ?? 12,
      },
      capacity: settings?.listenerCapacity ?? 40,
      time: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
