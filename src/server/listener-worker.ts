import { randomUUID } from "node:crypto";
import { and, asc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { listenerJobs, liveRooms, type ListenerJob } from "@/db/schema";
import { deriveChest, GiftFlow, recordChest, upsertFlow, type EnvelopeFields } from "@/server/chest";
import { bumpRoomChest, upsertLiveRoom } from "@/server/rooms";
import { envelopeReward, bagReward, roomRewards } from "@/server/rewards";
import { getSettings } from "@/server/settings";

type Connection = {
  connect: (roomId?: string) => Promise<unknown>;
  disconnect: () => Promise<void>;
  fetchRoomInfo: (roomId?: string) => Promise<unknown>;
  roomInfo?: unknown;
  on: (event: string, fn: (...args: unknown[]) => void) => void;
};
const owner = randomUUID();
const running = new Map<number, Connection>();
const globalStore = globalThis as typeof globalThis & { __arenaListenerTimer?: ReturnType<typeof setInterval>; __arenaListenerCooldown?: number };

export async function enqueueVerifiedRoom(input: { roomId: string; username: string; nickname: string; title: string; viewers: number }) {
  const roomId = input.roomId.trim();
  const username = input.username.replace(/^@/, "").toLowerCase();
  if (!/^\d{10,20}$/.test(roomId) || !/^[\w.]{2,24}$/.test(username)) return;
  // A new session supersedes an old room for the same broadcaster.
  await db.update(listenerJobs).set({ status: "offline", owner: "", leaseUntil: null, updatedAt: new Date() })
    .where(and(eq(listenerJobs.username, username), sql`${listenerJobs.roomId} <> ${roomId}`));
  await db.insert(listenerJobs).values({ ...input, roomId, username, status: "queued" })
    .onConflictDoUpdate({ target: listenerJobs.roomId, set: {
      username, nickname: input.nickname, title: input.title, viewers: input.viewers,
      updatedAt: new Date(),
      // Keep currently leased jobs leased; re-queue offline / expired sessions.
      status: sql`case when ${listenerJobs.status} = 'listening' and ${listenerJobs.leaseUntil} > now() then 'listening' else 'queued' end`,
      nextAttemptAt: sql`case when ${listenerJobs.status} = 'listening' and ${listenerJobs.leaseUntil} > now() then ${listenerJobs.nextAttemptAt} else now() end`,
    } });
  void tick().catch(() => null);
}

async function claim(capacity: number): Promise<ListenerJob | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(61720401)`);
    const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(listenerJobs)
      .where(and(eq(listenerJobs.status, "listening"), gt(listenerJobs.leaseUntil, new Date())));
    if ((count?.n ?? 0) >= capacity) return null;
    const [candidate] = await tx.select().from(listenerJobs)
      .where(and(inArray(listenerJobs.status, ["queued", "retry", "listening"]),
        sql`${listenerJobs.nextAttemptAt} <= now()`,
        sql`(${listenerJobs.status} <> 'listening' or ${listenerJobs.leaseUntil} < now())`))
      .orderBy(asc(listenerJobs.nextAttemptAt), asc(listenerJobs.id)).limit(1);
    if (!candidate) return null;
    const [leased] = await tx.update(listenerJobs).set({ owner, status: "listening", leaseUntil: new Date(Date.now() + 45_000), updatedAt: new Date() })
      .where(eq(listenerJobs.id, candidate.id)).returning();
    return leased ?? null;
  });
}

async function listen(job: ListenerJob) {
  let connection: Connection | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let refresh: ReturnType<typeof setInterval> | null = null;
  let completed = false;
  let ended = false;
  let lastError = "bağlantı kapandı";
  const flow = new GiftFlow();
  const meta = { username: job.username, nickname: job.nickname, title: job.title, roomId: job.roomId, viewers: job.viewers };
  const saveReward = async (fields: EnvelopeFields | null) => {
    if (!fields || completed) return;
    try {
      const chest = await recordChest(fields, meta, "connector");
      if (chest) {
        flow.markEnvelope(job.username, chest.envelopeId);
        await bumpRoomChest(job.username, chest.coins, chest.slots, deriveChest(chest).ratio);
      }
    } catch (error) { lastError = `ödül yazılamadı: ${(error as Error).message}`; }
  };
  const saveRoomInfo = async () => {
    if (!connection || completed) return;
    try {
      const info = await connection.fetchRoomInfo(job.roomId);
      for (const reward of roomRewards(info, job.roomId)) await saveReward(reward);
    } catch { /* Room metadata can be missing while the socket is healthy. */ }
  };
  try {
    const mod = await import("tiktok-live-connector");
    connection = new mod.TikTokLiveConnection(job.username, { processInitialData: true, enableExtendedGiftInfo: false,
      signApiKey: process.env.EULER_API_KEY || undefined }) as unknown as Connection;
    running.set(job.id, connection);
    const socket = connection;
    const closed = new Promise<void>((resolve) => {
      socket.on("disconnected", () => resolve());
      socket.on("streamEnd", () => { ended = true; resolve(); });
      socket.on("error", (event) => { lastError = String((event as { exception?: { message?: string } })?.exception?.message ?? "bağlantı hatası"); resolve(); });
    });
    socket.on("envelope", (raw) => { void saveReward(envelopeReward(raw, job.roomId)); });
    // Newer decoders may expose goodyBag directly. Current connector also exposes decodedData.
    socket.on("goodyBag", (raw) => { void saveReward(bagReward(raw, job.roomId)); });
    socket.on("decodedData", (method, raw) => {
      if (method === "WebcastGoodyBagMessage") void saveReward(bagReward(raw, job.roomId));
    });
    socket.on("gift", (raw) => {
      const gift = raw as { user?: { uniqueId?: string }; giftId?: string; diamondCount?: number; repeatCount?: number };
      // Gift diamonds are tracked separately. NEVER forwarded as chest coins.
      flow.addGift(job.username, meta, { user: gift.user?.uniqueId ?? "?", giftId: String(gift.giftId ?? ""),
        diamonds: Number(gift.diamondCount ?? 0), repeatCount: gift.repeatCount ?? 1 });
    });
    socket.on("roomUser", (raw) => {
      const count = Number((raw as { viewerCount?: number })?.viewerCount);
      if (Number.isFinite(count) && count > 0) meta.viewers = count;
    });
    await Promise.race([socket.connect(job.roomId), new Promise((_, reject) => setTimeout(() => reject(new Error("bağlantı zaman aşımı")), 15_000))]);
    await upsertLiveRoom({ ...meta, liveNow: true, monitoring: true, source: "scan" });
    for (const reward of roomRewards(socket.roomInfo, job.roomId)) await saveReward(reward);
    void saveRoomInfo();
    refresh = setInterval(() => {
      void saveRoomInfo();
      for (const row of flow.rows()) void upsertFlow({ ...row, liveNow: true }).catch(() => null);
    }, 120_000);
    heartbeat = setInterval(() => {
      void db.update(listenerJobs).set({ leaseUntil: new Date(Date.now() + 45_000), updatedAt: new Date() })
        .where(and(eq(listenerJobs.id, job.id), eq(listenerJobs.owner, owner), eq(listenerJobs.status, "listening")))
        .returning({ id: listenerJobs.id }).then((rows) => {
          if (!rows.length) void socket.disconnect().catch(() => null);
        }).catch(() => void socket.disconnect().catch(() => null));
    }, 15_000);
    await closed; // No arbitrary 30-second disconnection; the lease is renewed while connected.
  } catch (error) {
    lastError = (error as Error).message;
  } finally {
    completed = true;
    if (heartbeat) clearInterval(heartbeat);
    if (refresh) clearInterval(refresh);
    running.delete(job.id);
    if (connection) await connection.disconnect().catch(() => null);
    for (const row of flow.rows()) await upsertFlow({ ...row, liveNow: !ended }).catch(() => null);
    const [fresh] = await db.select().from(listenerJobs).where(eq(listenerJobs.id, job.id)).limit(1).catch(() => []);
    const attempts = (fresh?.attempts ?? 0) + 1;
    const rateLimited = /rate.limit|too many connections|429/i.test(lastError);
    if (rateLimited) globalStore.__arenaListenerCooldown = Date.now() + 65_000;
    const delay = (rateLimited ? 300_000 : Math.min(300_000, 10_000 * 2 ** Math.min(attempts - 1, 5))) + Math.floor(Math.random() * 3000);
    await db.update(listenerJobs).set({
      status: ended ? "offline" : "retry", owner: "", leaseUntil: null,
      attempts, lastError: ended ? "yayın bitti" : lastError,
      nextAttemptAt: new Date(Date.now() + delay), updatedAt: new Date(),
    }).where(and(eq(listenerJobs.id, job.id), eq(listenerJobs.owner, owner))).catch(() => null);
    await db.update(liveRooms).set({ monitoring: false, ...(ended ? { liveNow: false } : {}) })
      .where(eq(liveRooms.username, job.username)).catch(() => null);
  }
}

const rateStore = globalStore as typeof globalThis & { __arenaConnectWindow?: number[] };
function connectGate(): number {
  const now = Date.now();
  const window = (rateStore.__arenaConnectWindow ??= []).filter((time) => now - time < 60_000);
  rateStore.__arenaConnectWindow = window;
  // Anonymous signing allows only a few connections per minute; stay under it.
  const budget = Math.max(1, Number(process.env.LISTENER_CONNECTS_PER_MINUTE ?? 4));
  return window.length >= budget ? budget * 60_000 - (now - window[0]!) : 0;
}
function recordConnect() {
  const window = (rateStore.__arenaConnectWindow ??= []);
  window.push(Date.now());
}
let ticking = false;
export async function tick() {
  if (ticking || (globalStore.__arenaListenerCooldown ?? 0) > Date.now()) return;
  ticking = true;
  try {
    const settings = await getSettings();
    const capacity = Math.max(1, Math.min(120, Number(settings.listenerCapacity ?? settings.scanConcurrency ?? 20)));
    for (let i = 0; i < capacity; i++) {
      const wait = connectGate();
      if (wait > 0) break;
      const job = await claim(capacity);
      if (!job) break;
      recordConnect();
      void listen(job).catch(() => null);
    }
  } finally { ticking = false; }
}

export function startListenerWorker() {
  if (globalStore.__arenaListenerTimer) return;
  globalStore.__arenaListenerTimer = setInterval(() => { void tick().catch(() => null); }, 5000);
  setTimeout(() => { void tick().catch(() => null); }, 1500);
}
