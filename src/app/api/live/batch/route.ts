import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { liveRooms } from "@/db/schema";
import { checkAlive, roomInfo, userRoom } from "@/server/discovery";
import { enqueueVerifiedRoom, listenerRuntime } from "@/server/listener-worker";
import { listLiveRooms, upsertLiveRoom } from "@/server/rooms";

/**
 * Arena toplu canlı sorgu API'si — ücretsiz, anahtarsız.
 *
 * Tek istekte yüzlerce yayıncıyı sorgular:
 *   1) Bilinen odalar veritabanından okunur (istek harcanmaz).
 *   2) Oda kimliği olmayan adlar `api-live/user/room` ile çözülür (8 paralel).
 *   3) Tüm oda kimlikleri `check_alive` ile 50'lik gruplar hâlinde sorulur.
 * Yayında bulunanlar kalıcı dinleme sırasına eklenir; çevrimdışılar veride kalır.
 *
 * Örnek:
 *   GET /api/live/batch?users=user1,user2,user3
 *   GET /api/live/batch?feed=1                 (hiç TikTok isteği yapmaz)
 *   POST /api/live/batch  { "usernames": ["user1"], "roomIds": ["7123..."] }
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HANDLE = /^[\w.]{2,24}$/;
const ROOM = /^\d{10,20}$/;
const MAX_ITEMS = 200;

type BatchItem = {
  username: string;
  roomId: string;
  live: boolean;
  viewers: number;
  nickname: string;
  title: string;
  region: string;
  source: string;
};

function tokenOk(request: Request) {
  const expected = (process.env.ARENA_API_TOKEN ?? "").trim();
  if (!expected) return true;
  const url = new URL(request.url);
  const given = request.headers.get("x-arena-token") ?? url.searchParams.get("token") ?? "";
  return given === expected;
}

function splitList(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim().replace(/^@+/, ""))
    .filter(Boolean);
}

async function runBatch(input: { usernames: string[]; roomIds: string[]; details: boolean }) {
  const usernames = [...new Set(input.usernames.map((name) => name.toLowerCase()).filter((name) => HANDLE.test(name)))]
    .slice(0, MAX_ITEMS);
  const extraRooms = [...new Set(input.roomIds.filter((id) => ROOM.test(id)))].slice(0, MAX_ITEMS);

  const known = usernames.length
    ? await db.select().from(liveRooms).where(inArray(liveRooms.username, usernames)).catch(() => [])
    : [];
  const byUser = new Map(known.map((row) => [row.username, row]));
  const roomToUser = new Map<string, string>();
  for (const row of known) if (row.roomId && usernames.includes(row.username)) roomToUser.set(row.roomId, row.username);
  for (const id of extraRooms) if (!roomToUser.has(id)) roomToUser.set(id, "");

  // Oda kimliği bilinmeyen adlar tek tek çözülür (yalnızca ilk turda gerekir).
  const missing = usernames.filter((name) => !byUser.get(name)?.roomId);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, missing.length) }, async () => {
      while (cursor < missing.length) {
        const handle = missing[cursor++];
        if (!handle) continue;
        try {
          const info = await userRoom(handle, 1);
          if (info.roomId) roomToUser.set(info.roomId, handle);
        } catch {
          /* tek hesap hatası diğerlerini etkilemez */
        }
      }
    }),
  );

  // 45 saniye içinde doğrulanmış odalar için yeniden istek harcanmaz.
  const now = Date.now();
  const pending: string[] = [];
  const cachedAlive = new Map<string, boolean>();
  for (const [roomId, username] of roomToUser) {
    const row = username ? byUser.get(username) : undefined;
    if (row?.lastCheckedAt && now - new Date(row.lastCheckedAt).getTime() < 45_000) cachedAlive.set(roomId, row.liveNow);
    else pending.push(roomId);
  }
  const alive = pending.length ? await checkAlive(pending) : {};
  const isLive = (roomId: string) => alive[roomId] ?? cachedAlive.get(roomId) ?? false;

  const items: BatchItem[] = [];
  for (const [roomId, username] of roomToUser) {
    const row = username ? byUser.get(username) : undefined;
    const live = isLive(roomId);
    items.push({
      username: username || row?.username || "",
      roomId,
      live,
      viewers: live ? Number(row?.viewers ?? 0) : 0,
      nickname: row?.nickname || username,
      title: row?.title || "",
      region: row?.region || "",
      source: "batch",
    });
  }
  for (const name of usernames) {
    if (items.some((item) => item.username === name)) continue;
    const row = byUser.get(name);
    items.push({
      username: name,
      roomId: row?.roomId || "",
      live: false,
      viewers: 0,
      nickname: row?.nickname || name,
      title: row?.title || "",
      region: row?.region || "",
      source: "batch",
    });
  }

  // Ayrıntı istenirse yalnızca yayındaki ilk 10 oda için ek istek yapılır.
  const detailed = input.details ? items.filter((item) => item.live && item.roomId).slice(0, 10) : [];
  await Promise.all(
    detailed.map(async (item) => {
      const info = await roomInfo(item.roomId);
      item.title = info.title || item.title;
      item.viewers = info.viewers || item.viewers;
      item.nickname = info.nickname || item.nickname;
    }),
  );

  for (const item of items) {
    if (!item.username || !item.roomId) continue;
    await upsertLiveRoom({
      username: item.username,
      roomId: item.roomId,
      nickname: item.nickname,
      title: item.title,
      region: item.region || "TR",
      viewers: item.viewers,
      liveNow: item.live,
      source: "batch",
      lastError: item.live ? "" : "yayında değil",
    }).catch(() => null);
    if (item.live) {
      await enqueueVerifiedRoom({
        username: item.username,
        roomId: item.roomId,
        nickname: item.nickname,
        title: item.title,
        viewers: item.viewers,
      }).catch(() => null);
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    count: items.length,
    liveCount: items.filter((item) => item.live).length,
    requests: {
      userRoom: missing.length,
      checkAlive: Math.ceil(pending.length / 50),
      details: detailed.length,
    },
    listening: listenerRuntime().active,
    items,
  };
}

function respond(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" },
  });
}

export async function GET(request: Request) {
  if (!tokenOk(request)) return respond({ error: "Yetkisiz: x-arena-token gerekli." }, 401);
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("feed") === "1") {
      return respond({
        source: "db",
        checkedAt: new Date().toISOString(),
        rooms: await listLiveRooms({ onlyLive: true, limit: 200 }),
        listening: listenerRuntime().active,
      });
    }
    const usernames = splitList(url.searchParams.get("users") ?? url.searchParams.get("usernames") ?? "");
    const roomIds = splitList(url.searchParams.get("rooms") ?? url.searchParams.get("roomIds") ?? "");
    if (!usernames.length && !roomIds.length) {
      return respond(
        {
          error: "Sorgu boş.",
          usage: {
            users: "/api/live/batch?users=user1,user2 (en fazla 200)",
            feed: "/api/live/batch?feed=1 (kayıtlı canlı odalar, TikTok isteği yok)",
            post: "POST /api/live/batch { usernames: [...], roomIds: [...] }",
            auth: process.env.ARENA_API_TOKEN ? "x-arena-token başlığı gerekli" : "anahtar kapalı (panel varsayılanı)",
          },
        },
        400,
      );
    }
    const details = url.searchParams.get("details") === "1";
    return respond(await runBatch({ usernames, roomIds, details }));
  } catch (error) {
    return respond({ error: `Toplu sorgu başarısız: ${(error as Error).message}`, items: [] }, 200);
  }
}

export async function POST(request: Request) {
  if (!tokenOk(request)) return respond({ error: "Yetkisiz: x-arena-token gerekli." }, 401);
  let body: { usernames?: string[]; roomIds?: string[]; details?: boolean } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return respond({ error: "Geçersiz JSON gövdesi" }, 400);
  }
  const usernames = (body.usernames ?? []).map((item) => String(item)).slice(0, MAX_ITEMS);
  const roomIds = (body.roomIds ?? []).map((item) => String(item)).slice(0, MAX_ITEMS);
  if (!usernames.length && !roomIds.length) return respond({ error: "En az bir kullanıcı adı veya oda kimliği gerekli" }, 400);
  try {
    return respond(await runBatch({ usernames, roomIds, details: body.details === true }));
  } catch (error) {
    return respond({ error: `Toplu sorgu başarısız: ${(error as Error).message}`, items: [] }, 200);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,x-arena-token",
    },
  });
}
