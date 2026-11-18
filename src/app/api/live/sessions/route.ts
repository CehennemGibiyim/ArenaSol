import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityLog, liveSessions } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { checkLive, endSession, getConnectorStatus, startRealConnection } from "@/server/live";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(liveSessions).orderBy(desc(liveSessions.id)).limit(25);
  return NextResponse.json({ data: rows, connector: await getConnectorStatus() });
}

export async function POST(request: Request) {
  let body: { username?: string; title?: string; mode?: string; restart?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }
  const username = (body.username ?? "").trim().replace(/^@+/, "");
  if (!username) return NextResponse.json({ error: "TikTok kullanıcı adı gerekli" }, { status: 400 });

  const connector = await getConnectorStatus();
  const check = await checkLive(username);

  if (!check.live) {
    return NextResponse.json(
      {
        error:
          check.source === "unavailable"
            ? `TikTok'a ulaşılamadı, gerçek yayın durumu doğrulanamadı. ${check.note}`
            : `@${username} şu an yayında değil. Gerçek bağlantı yalnızca aktif yayınlarda açılır.`,
        check,
        connector,
      },
      { status: 409 },
    );
  }

  if (!connector.available) {
    return NextResponse.json(
      {
        error: "tiktok-live-connector yüklenemedi; gerçek Webcast bağlantısı kurulamaz. npm ci ile paketi kurun.",
        check,
        connector,
      },
      { status: 503 },
    );
  }

  if (!body.restart) {
    const [existing] = await db
      .select()
      .from(liveSessions)
      .where(and(eq(liveSessions.username, username), eq(liveSessions.status, "active")))
      .orderBy(desc(liveSessions.id))
      .limit(1);
    if (existing) return NextResponse.json({ session: existing, connector, check, reused: true });
  }

  const [created] = await db
    .insert(liveSessions)
    .values({
      username,
      title: body.title?.trim() || check.title || `@${username} LIVE`,
      roomId: check.roomId,
      mode: "live",
      status: "connecting",
      viewers: check.viewers,
      peakViewers: check.viewers,
      connectorError: "",
    })
    .returning();
  if (!created) return NextResponse.json({ error: "Oturum açılamadı" }, { status: 500 });

  const okay = await startRealConnection(created.id, username);
  if (!okay) {
    const [failed] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.id, created.id))
      .limit(1);
    await db.update(liveSessions).set({ status: "failed" }).where(eq(liveSessions.id, created.id));
    return NextResponse.json(
      {
        error: `Gerçek Webcast bağlantısı kurulamadı: ${failed?.connectorError ?? "bilinmeyen hata"}`,
        session: failed ?? created,
        check,
        connector,
      },
      { status: 502 },
    );
  }

  await db.update(liveSessions).set({ status: "active" }).where(eq(liveSessions.id, created.id));
  await db.insert(activityLog).values({
    kind: "live",
    message: `@${username} için GERÇEK TikTok LIVE bağlantısı kuruldu (${check.roomId || "roomId bekleniyor"}).`,
    meta: { sessionId: created.id, roomId: check.roomId, viewers: check.viewers },
  });

  const [fresh] = await db.select().from(liveSessions).where(eq(liveSessions.id, created.id)).limit(1);
  return NextResponse.json({ session: fresh ?? created, connector, check, reused: false }, { status: 201 });
}

export async function PATCH(request: Request) {
  let body: { id?: number; action?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "Oturum kimliği gerekli" }, { status: 400 });
  if (body.action === "end") {
    await endSession(Number(body.id));
    return NextResponse.json({ ok: true });
  }
  const [row] = await db
    .update(liveSessions)
    .set({ status: body.action === "pause" ? "paused" : "active" })
    .where(eq(liveSessions.id, Number(body.id)))
    .returning();
  return NextResponse.json({ data: row });
}

export async function DELETE(request: Request) {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "Kimlik gerekli" }, { status: 400 });
  await db.delete(liveSessions).where(eq(liveSessions.id, id));
  await db.execute(sql`delete from live_events where session_id = ${id}`);
  return NextResponse.json({ ok: true });
}
