import { NextResponse } from "next/server";
import { db } from "@/db";
import { liveRooms } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { listLiveRooms, radarOverview, upsertLiveRoom } from "@/server/rooms";
import { checkLiveWeb } from "@/server/discovery";
import { enqueueVerifiedRoom } from "@/server/listener-worker";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const [rows, overview] = await Promise.all([
      listLiveRooms({
        onlyLive: params.get("live") === "1",
        onlyPinned: params.get("pinned") === "1",
        q: params.get("q") ?? "",
        sort: params.get("sort") ?? "pinned",
        desc: params.get("desc") !== "0",
        limit: Number(params.get("limit") ?? 200),
      }),
      radarOverview().catch(() => null),
    ]);
    return NextResponse.json(
      {
        data: rows,
        overview: overview ?? { rooms: rows.length, live: 0, pinned: 0, roomChests: 0, chests: 0, upcoming: 0, coins: 0, flowRooms: 0, flowDiamonds: 0, tasks: 0, listening: 0 },
        generatedAt: Date.now(),
      },
      { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
    );
  } catch (error) {
    return NextResponse.json(
      { data: [], overview: null, error: (error as Error).message, generatedAt: Date.now() },
      { status: 200, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    let body: { username?: string; pin?: boolean; check?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }
    const username = (body.username ?? "").trim().replace(/^@+/, "");
    if (!username) return NextResponse.json({ error: "Kullanıcı adı gerekli" }, { status: 400 });

    let live = false;
    let viewers = 0;
    let roomId = "";
    let title = "";
    let checkNote = "";
    if (body.check !== false) {
      try {
        const result = await checkLiveWeb(username);
        live = result.live;
        viewers = result.viewers;
        roomId = result.roomId;
        title = result.title;
        checkNote = result.detail;
      } catch (checkError) {
        checkNote = `gerçek kontrol başarısız: ${(checkError as Error).message}`;
      }
    }

    const row = await upsertLiveRoom({
      username,
      roomId,
      title,
      viewers,
      liveNow: live,
      monitoring: true,
      lastError: checkNote,
      source: "manual",
    });
    if (!row) return NextResponse.json({ error: "Oda kaydedilemedi" }, { status: 500 });
    if (live && roomId) await enqueueVerifiedRoom({ roomId, username, nickname: row.nickname, title, viewers });
    if (body.pin) {
      await db.update(liveRooms).set({ pinned: true }).where(eq(liveRooms.id, row.id)).catch(() => null);
    }
    const [fresh] = await db.select().from(liveRooms).where(eq(liveRooms.id, row.id)).limit(1);
    return NextResponse.json({ data: fresh ?? row, live, viewers, note: checkNote }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: `Oda eklenemedi: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const rows = await db.select({ id: liveRooms.id }).from(liveRooms).orderBy(desc(liveRooms.id));
    return NextResponse.json({ usage: "DELETE /api/rooms/[id] ile tek oda silinir.", total: rows.length });
  } catch (error) {
    return NextResponse.json({ usage: "DELETE /api/rooms/[id] ile tek oda silinir.", error: (error as Error).message });
  }
}
