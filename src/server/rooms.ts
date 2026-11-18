import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chests, listenerJobs, liveRooms, roomFlows, scanTasks, type LiveRoom } from "@/db/schema";

/* -------------------------------------------------------------------------- */
/*  Canlı oda kayıtları — keşfedilen yayıncılar panelde sabit tutulabilir      */
/* -------------------------------------------------------------------------- */

export type RoomUpsert = {
  username: string;
  roomId?: string;
  nickname?: string;
  title?: string;
  avatar?: string;
  region?: string;
  source?: string;
  viewers?: number;
  liveNow?: boolean;
  monitoring?: boolean;
  diamonds?: number;
  diamondsPerMin?: number;
  lastError?: string;
};

export async function upsertLiveRoom(input: RoomUpsert): Promise<LiveRoom | null> {
  const username = input.username.replace(/^@+/, "").trim().toLowerCase();
  if (!username) return null;
  const viewers = Math.max(0, Number(input.viewers ?? 0));
  const values = {
    username,
    roomId: input.roomId ?? "",
    nickname: input.nickname ?? username,
    title: input.title ?? "",
    avatar: input.avatar ?? "",
    region: input.region ?? "TR",
    source: input.source ?? "watchlist",
    viewers,
    peakViewers: viewers,
    diamonds: Math.max(0, Number(input.diamonds ?? 0)),
    diamondsPerMin: Math.max(0, Number(input.diamondsPerMin ?? 0)),
    liveNow: input.liveNow ?? true,
    monitoring: input.monitoring ?? false,
    lastError: input.lastError ?? "",
    lastSeenAt: new Date(),
  };

  const [row] = await db
    .insert(liveRooms)
    .values(values)
    .onConflictDoUpdate({
      target: liveRooms.username,
      set: {
        roomId: values.roomId || sql`${liveRooms.roomId}`,
        nickname: values.nickname,
        title: values.title || sql`${liveRooms.title}`,
        avatar: values.avatar || sql`${liveRooms.avatar}`,
        region: values.region,
        viewers: values.viewers,
        peakViewers: sql`greatest(${liveRooms.peakViewers}, ${values.viewers})`,
        diamonds: sql`greatest(${liveRooms.diamonds}, ${values.diamonds})`,
        diamondsPerMin: sql`greatest(${liveRooms.diamondsPerMin}, ${values.diamondsPerMin})`,
        liveNow: values.liveNow,
        monitoring: values.monitoring,
        lastError: values.lastError,
        lastSeenAt: new Date(),
      },
    })
    .returning();
  return row ?? null;
}

/** Sandık tespit edilince odanın sandık istatistiklerini güncelle */
export async function bumpRoomChest(username: string, coins: number, slots: number, ratio: number) {
  const handle = username.replace(/^@+/, "").toLowerCase();
  await db
    .update(liveRooms)
    .set({
      chestCount: sql`${liveRooms.chestCount} + 1`,
      lastChestAt: new Date(),
    })
    .where(eq(liveRooms.username, handle));

  await db
    .update(liveRooms)
    .set({
      bestChestCoins: sql`greatest(${liveRooms.bestChestCoins}, ${Math.round(coins)})`,
      bestChestSlots: sql`greatest(${liveRooms.bestChestSlots}, ${Math.round(slots)})`,
      bestChestRatio: sql`greatest(${liveRooms.bestChestRatio}, ${Math.round(ratio * 100)})`,
    })
    .where(and(eq(liveRooms.username, handle), sql`${liveRooms.chestCount} <= 1`));
}

export type RoomRow = LiveRoom & {
  ratio: number;
  secondsSinceSeen: number;
  live: boolean;
};

/** Panelde gösterilecek odalar: sabitlenenler her zaman en üstte */
export async function listLiveRooms(opts: {
  onlyLive?: boolean;
  onlyPinned?: boolean;
  q?: string;
  limit?: number;
  sort?: string;
  desc?: boolean;
} = {}): Promise<RoomRow[]> {
  const conditions = [];
  if (opts.onlyLive) conditions.push(eq(liveRooms.liveNow, true));
  if (opts.onlyPinned) conditions.push(eq(liveRooms.pinned, true));
  const rows = await db
    .select()
    .from(liveRooms)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(liveRooms.pinned), desc(liveRooms.lastSeenAt))
    .limit(Math.min(opts.limit ?? 200, 500));

  const q = (opts.q ?? "").trim().toLowerCase();
  const enriched: RoomRow[] = rows
    .filter((row) => (q ? `${row.username} ${row.nickname} ${row.title}`.toLowerCase().includes(q) : true))
    .map((row) => ({
      ...row,
      ratio: row.bestChestSlots > 0 ? Math.round((row.bestChestCoins / row.bestChestSlots) * 100) / 100 : 0,
      secondsSinceSeen: Math.round((Date.now() - new Date(row.lastSeenAt).getTime()) / 1000),
      live: row.liveNow,
    }));

  const sortKey = opts.sort ?? "pinned";
  const descending = opts.desc ?? true;
  const keyOf = (row: RoomRow): number => {
    switch (sortKey) {
      case "viewers":
        return row.viewers;
      case "chests":
        return row.chestCount;
      case "ratio":
        return row.ratio;
      case "coins":
        return row.bestChestCoins;
      case "diamonds":
        return row.diamonds;
      case "per_min":
        return row.diamondsPerMin;
      default:
        return row.pinned ? 1 : 0;
    }
  };
  if (sortKey === "pinned") return enriched;
  return enriched.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return descending ? keyOf(b) - keyOf(a) : keyOf(a) - keyOf(b);
  });
}

export async function setRoomPinned(id: number, pinned: boolean) {
  const [row] = await db.update(liveRooms).set({ pinned }).where(eq(liveRooms.id, id)).returning();
  return row ?? null;
}

export async function setRoomMonitoring(id: number, monitoring: boolean) {
  const [row] = await db.update(liveRooms).set({ monitoring }).where(eq(liveRooms.id, id)).returning();
  return row ?? null;
}

export async function deleteRoom(id: number) {
  const [row] = await db.delete(liveRooms).where(eq(liveRooms.id, id)).returning();
  return row ?? null;
}

export async function pinnedUsernames(limit = 60): Promise<string[]> {
  const rows = await db
    .select({ username: liveRooms.username })
    .from(liveRooms)
    .where(and(eq(liveRooms.pinned, true), eq(liveRooms.liveNow, true)))
    .orderBy(desc(liveRooms.lastSeenAt))
    .limit(limit);
  return rows.map((row) => row.username);
}

/* -------------------------------------------------------------------------- */
/*  Tarama görevleri                                                           */
/* -------------------------------------------------------------------------- */

export async function createScanTask(scanId: number, username: string, roomId = "") {
  const [row] = await db
    .insert(scanTasks)
    .values({ scanId, username: username.replace(/^@+/, ""), roomId, status: "queued" })
    .returning();
  return row ?? null;
}

export async function updateScanTask(
  id: number,
  patch: Partial<{
    status: string;
    viewerCount: number;
    diamonds: number;
    giftEvents: number;
    chestsFound: number;
    listenSeconds: number;
    error: string;
    startedAt: Date;
    finishedAt: Date;
    roomId: string;
  }>,
) {
  const [row] = await db.update(scanTasks).set(patch).where(eq(scanTasks.id, id)).returning();
  return row ?? null;
}

export async function listScanTasks(scanId?: number, limit = 60) {
  const rows = await db
    .select()
    .from(scanTasks)
    .where(scanId ? eq(scanTasks.scanId, scanId) : undefined)
    .orderBy(desc(scanTasks.id))
    .limit(limit);
  return rows;
}

/* -------------------------------------------------------------------------- */
/*  Radar ozet istatistikleri                                                  */
/* -------------------------------------------------------------------------- */

export async function radarOverview() {
  const [roomAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      live: sql<number>`(count(*) filter (where ${liveRooms.liveNow} = true))::int`,
      pinned: sql<number>`(count(*) filter (where ${liveRooms.pinned} = true))::int`,
      chests: sql<number>`coalesce(sum(${liveRooms.chestCount}), 0)::int`,
    })
    .from(liveRooms);

  const [chestAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      upcoming: sql<number>`(count(*) filter (where ${chests.status} = 'upcoming'))::int`,
      coins: sql<number>`coalesce(sum(${chests.coins}), 0)::int`,
    })
    .from(chests);

  const [flowAgg] = await db
    .select({
      rooms: sql<number>`count(*)::int`,
      diamonds: sql<number>`coalesce(sum(${roomFlows.diamonds}), 0)::int`,
    })
    .from(roomFlows);

  const [taskAgg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      monitoring: sql<number>`(count(*) filter (where ${listenerJobs.status} = 'listening' and ${listenerJobs.leaseUntil} > now()))::int`,
    })
    .from(listenerJobs);

  return {
    rooms: roomAgg?.total ?? 0,
    live: roomAgg?.live ?? 0,
    pinned: roomAgg?.pinned ?? 0,
    roomChests: roomAgg?.chests ?? 0,
    chests: chestAgg?.total ?? 0,
    upcoming: chestAgg?.upcoming ?? 0,
    coins: chestAgg?.coins ?? 0,
    flowRooms: flowAgg?.rooms ?? 0,
    flowDiamonds: flowAgg?.diamonds ?? 0,
    tasks: taskAgg?.total ?? 0,
    listening: taskAgg?.monitoring ?? 0,
  };
}
