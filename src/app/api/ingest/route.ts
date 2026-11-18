import { NextResponse } from "next/server";
import { activityLog } from "@/db/schema";
import { db } from "@/db";
import { recordChest, upsertFlow, deriveChest } from "@/server/chest";
import { bumpRoomChest, upsertLiveRoom } from "@/server/rooms";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

type IngestBody = {
  type?: "chest" | "flow" | "room";
  source?: string;
  room?: {
    username?: string;
    roomId?: string;
    nickname?: string;
    title?: string;
    viewers?: number;
    liveNow?: boolean;
  };
  chest?: {
    envelopeId?: string;
    roomId?: string;
    diamondCount?: number;
    peopleCount?: number;
    unpackAt?: number;
    skinId?: number;
    businessType?: number;
  };
  flow?: {
    username?: string;
    diamonds?: number;
    events?: number;
    senders?: number;
    topSenders?: Array<[string, number]>;
    diamondsPerMin?: number;
    watchedSeconds?: number;
    viewers?: number;
    hasEnvelope?: boolean;
    envelopeId?: string;
    roomId?: string;
    nickname?: string;
    title?: string;
  };
};

async function authorized(request: Request): Promise<boolean> {
  let expected = "";
  try {
    const settings = await getSettings();
    expected = process.env.ARENA_INGEST_TOKEN || (settings as unknown as { ingestToken?: string }).ingestToken || "";
  } catch {
    expected = process.env.ARENA_INGEST_TOKEN || "";
  }
  if (!expected) return true;
  const provided =
    request.headers.get("x-arena-token") ??
    new URL(request.url).searchParams.get("token") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  return provided === expected;
}

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    ok: true,
    usage: "POST /api/ingest { type: 'chest' | 'flow' | 'room', ... }",
    authRequired: Boolean(process.env.ARENA_INGEST_TOKEN || (settings as unknown as { ingestToken?: string }).ingestToken),
    examples: {
      chest: {
        type: "chest",
        source: "local-agent",
        room: { username: "elif_live", viewers: 1200, roomId: "7412345678901234567" },
        chest: { envelopeId: "env-1", diamondCount: 500, peopleCount: 20, unpackAt: 1760000000, skinId: 1 },
      },
      flow: {
        type: "flow",
        flow: { username: "elif_live", diamonds: 12000, events: 40, senders: 12, diamondsPerMin: 2400, watchedSeconds: 300, viewers: 1500 },
      },
      room: { type: "room", room: { username: "elif_live", viewers: 1500, liveNow: true } },
    },
  });
}

export async function POST(request: Request) {
  try {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Yetkisiz: x-arena-token geçersiz" }, { status: 401 });
  }
  let body: IngestBody = {};
  try {
    body = (await request.json()) as IngestBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }

  const room = body.room ?? {};
  const username = (room.username ?? body.flow?.username ?? "").replace(/^@+/, "");
  if (!username && body.type !== "chest") {
    return NextResponse.json({ error: "username gerekli" }, { status: 400 });
  }

  if (body.type === "chest" && body.chest && username) {
    const chest = await recordChest(
      {
        envelopeId: body.chest.envelopeId,
        roomId: body.chest.roomId ?? room.roomId,
        diamondCount: body.chest.diamondCount,
        peopleCount: body.chest.peopleCount,
        unpackAt: body.chest.unpackAt,
        skinId: body.chest.skinId,
        businessType: body.chest.businessType,
      },
      { username, nickname: room.nickname, title: room.title, viewers: room.viewers, roomId: room.roomId },
      "connector",
    );
    if (!chest) return NextResponse.json({ error: "Zarf alanları geçersiz (jeton/kontenjan 0)" }, { status: 400 });
    const derived = deriveChest(chest);
    await bumpRoomChest(chest.username, chest.coins, chest.slots, derived.ratio);
    await db.insert(activityLog).values({
      kind: "chest",
      message: `Yerel agent sandık bildirdi: @${chest.username} · ${chest.coins} jeton / ${chest.slots} kişi`,
      meta: { source: body.source ?? "local-agent", chestId: chest.id },
    });
    return NextResponse.json({ ok: true, data: derived }, { status: 201 });
  }

  if (body.type === "flow" && body.flow) {
    await upsertFlow({
      username,
      roomId: body.flow.roomId ?? room.roomId,
      nickname: body.flow.nickname ?? room.nickname,
      title: body.flow.title ?? room.title,
      diamonds: Number(body.flow.diamonds ?? 0),
      events: Number(body.flow.events ?? 0),
      senders: Number(body.flow.senders ?? 0),
      topSenders: body.flow.topSenders ?? [],
      diamondsPerMin: Number(body.flow.diamondsPerMin ?? 0),
      watchedSeconds: Number(body.flow.watchedSeconds ?? 0),
      hasEnvelope: body.flow.hasEnvelope ?? false,
      envelopeId: body.flow.envelopeId ?? "",
      viewers: Number(body.flow.viewers ?? room.viewers ?? 0),
      liveNow: true,
    });
    await upsertLiveRoom({
      username,
      roomId: body.flow.roomId ?? room.roomId,
      nickname: body.flow.nickname ?? room.nickname,
      title: body.flow.title ?? room.title,
      viewers: Number(body.flow.viewers ?? room.viewers ?? 0),
      diamonds: Number(body.flow.diamonds ?? 0),
      diamondsPerMin: Number(body.flow.diamondsPerMin ?? 0),
      liveNow: true,
      monitoring: true,
      source: body.source ?? "local-agent",
    });
    return NextResponse.json({ ok: true, type: "flow" }, { status: 201 });
  }

  if (body.type === "room" && username) {
    const row = await upsertLiveRoom({
      username,
      roomId: room.roomId,
      nickname: room.nickname,
      title: room.title,
      viewers: Number(room.viewers ?? 0),
      liveNow: room.liveNow ?? true,
      monitoring: true,
      source: body.source ?? "local-agent",
    });
    return NextResponse.json({ ok: true, data: row }, { status: 201 });
  }

  return NextResponse.json({ error: "Bilinmeyen tip veya eksik alanlar" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: `Ingest başarısız: ${(error as Error).message}` }, { status: 500 });
  }
}
