import { NextResponse } from "next/server";
import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getConnectorStatus, getSnapshot } from "@/server/live";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
  const url = new URL(request.url);
  const sessionParam = Number(url.searchParams.get("session") ?? 0);
  const username = (url.searchParams.get("username") ?? "").trim().replace(/^@+/, "");

  let sessionId = sessionParam;
  if (!sessionId) {
    const conditions = [eq(liveSessions.status, "active")];
    if (username) conditions.push(eq(liveSessions.username, username));
    const [active] = await db
      .select()
      .from(liveSessions)
      .where(and(...conditions))
      .orderBy(desc(liveSessions.id))
      .limit(1);
    sessionId = active?.id ?? 0;
  }

  if (!sessionId) {
    return NextResponse.json(
      {
        error: "Aktif gerçek yayın oturumu yok. Canlı Stüdyo'da yayında olan bir yayıncıya bağlanın.",
        connector: await getConnectorStatus(),
      },
      { status: 404 },
    );
  }

  const snapshot = await getSnapshot(sessionId);
  if (!snapshot) return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 404 });

  return NextResponse.json(
    {
      ...snapshot,
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
  } catch (error) {
    return NextResponse.json(
      {
        error: `Feed okunamadı: ${(error as Error).message}`,
        session: null,
        events: [],
        leaderboard: [],
        overview: { diamonds: 0, gifts: 0, comments: 0, likes: 0, followers: 0, viewers: 0, peakViewers: 0, estimatedTry: 0, durationMin: 0, uniqueUsers: 0, engagement: 0 },
        goals: [],
        generatedAt: new Date().toISOString(),
      },
      { status: 200, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
