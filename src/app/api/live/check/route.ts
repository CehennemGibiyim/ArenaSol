import { NextResponse } from "next/server";
import { db } from "@/db";
import { liveSessions, targets } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { checkLive, getConnectorStatus } from "@/server/live";
import { enqueueVerifiedRoom } from "@/server/listener-worker";
import { upsertLiveRoom } from "@/server/rooms";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const username = (url.searchParams.get("username") ?? "").trim().replace(/^@+/, "");
    if (!username) return NextResponse.json({ error: "Kullanıcı adı gerekli" }, { status: 400 });
    const result = await checkLive(username);
    if (result.live && result.roomId) {
      await upsertLiveRoom({ username, roomId: result.roomId, nickname: result.nickname,
        title: result.title, viewers: result.viewers, liveNow: true, source: "check" });
      await enqueueVerifiedRoom({ username, roomId: result.roomId, nickname: result.nickname,
        title: result.title, viewers: result.viewers });
    }
    return NextResponse.json({ ...result, connector: await getConnectorStatus() });
  } catch (error) {
    return NextResponse.json(
      { error: `Canlı kontrol başarısız: ${(error as Error).message}`, live: false, source: "unavailable" },
      { status: 200 },
    );
  }
}

export async function POST(request: Request) {
  try {
  let body: { usernames?: string[] } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }
  const usernames = Array.from(
    new Set(
      (body.usernames ?? [])
        .map((item) => String(item).trim().replace(/^@+/, ""))
        .filter(Boolean),
    ),
  ).slice(0, 15);
  if (usernames.length === 0) return NextResponse.json({ error: "En az bir kullanıcı adı gerekli" }, { status: 400 });

  const results = await Promise.all(
    usernames.map((username) => checkLive(username).catch((err: Error) => ({
      username,
      live: false,
      viewers: 0,
      roomId: "",
      nickname: "",
      title: "",
      source: "unavailable" as const,
      note: err.message,
    }))),
  );

  for (const result of results) {
    if (result.live && result.roomId) {
      await upsertLiveRoom({ username: result.username, roomId: result.roomId, nickname: result.nickname,
        title: result.title, viewers: result.viewers, liveNow: true, source: "check" });
      await enqueueVerifiedRoom({ username: result.username, roomId: result.roomId, nickname: result.nickname,
        title: result.title, viewers: result.viewers });
    }
    await db
      .update(targets)
      .set({
        liveNow: result.live,
        viewers: result.viewers,
        lastCheckedAt: new Date(),
      })
      .where(eq(targets.username, result.username))
      .catch(() => null);
  }

  const sessionUsernames = await db
    .select()
    .from(liveSessions)
    .where(inArray(liveSessions.username, usernames))
    .catch(() => []);

  return NextResponse.json({
    data: results,
    sessions: sessionUsernames,
    activeSessions: await db
      .select()
      .from(liveSessions)
      .where(and(eq(liveSessions.status, "active"), inArray(liveSessions.username, usernames)))
      .orderBy(desc(liveSessions.id))
      .catch(() => []),
    connector: await getConnectorStatus(),
    checkedAt: new Date().toISOString(),
  });
  } catch (error) {
    return NextResponse.json(
      { error: `Toplu kontrol başarısız: ${(error as Error).message}`, data: [], sessions: [], activeSessions: [] },
      { status: 200 },
    );
  }
}
