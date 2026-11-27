import { desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { chests, liveRooms } from "@/db/schema";

/**
 * Oda başına sandık ritmi — dinleme kotasını verimli kullanmak için.
 *
 * Amaç: pahalı olan kaynak WebSocket bağlantısıdır (eşzamanlı dinleme kapasitesi
 * ve ücretsiz imza kotası). Her oda için gözlenen sandık zamanlarından medyan
 * aralık çıkarılır; bağlantı yalnızca bir sonraki sandığın beklendiği pencere
 * açıldığında kurulur. Bilinen bir ritmi olmayan (yeni/az örnekli) odalar
 * kısıtlanmaz, böylece mevcut sandık tespiti bozulmaz.
 */

/** Geçerli sayılan en kısa / en uzun sandık aralığı. */
const MIN_GAP_MS = 60_000;
const MAX_GAP_MS = 6 * 3600_000;
/** Sandık beklentisinden önce bağlanma payı: aralığın %30'u, 1.5–10 dk arası. */
const LEAD_MIN_MS = 90_000;
const LEAD_MAX_MS = 10 * 60_000;
/** Ritim bilinse bile bağlantı en fazla bu kadar ertelenir (kaçırma koruması). */
const SAFETY_DEFER_MS = 15 * 60_000;
/** Ritim için gereken en az sandık sayısı (tek tesadüf ritim sayılmaz). */
const MIN_SAMPLES = 3;
/** Ritim hesabında kullanılan geçmiş penceresi. */
const HISTORY_MS = 30 * 24 * 3600_000;

export type ChestRhythm = {
  username: string;
  /** Gözlenen sandık sayısı. */
  samples: number;
  /** Medyan sandık aralığı (sn); 0 = ritim bilinmiyor. */
  intervalSeconds: number;
  lastChestAt: number | null;
  /** Son sandığa göre beklenen bir sonraki sandık (epoch ms). */
  dueAt: number | null;
  /** Dinleme penceresinin açıldığı an (dueAt - pay). */
  windowStartsAt: number | null;
  /** 0..1 — elde edilen aralık sayısına göre güven. */
  confidence: number;
};

export function deriveChestRhythm(input: { username: string; chestTimes: number[] }): ChestRhythm {
  const times = [...new Set(input.chestTimes.filter((time) => Number.isFinite(time) && time > 0))]
    .sort((a, b) => a - b);
  const samples = times.length;
  const lastChestAt = samples ? times[samples - 1]! : null;
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i]! - times[i - 1]!;
    if (gap >= MIN_GAP_MS && gap <= MAX_GAP_MS) gaps.push(gap);
  }
  gaps.sort((a, b) => a - b);
  const intervalMs = gaps.length ? gaps[Math.floor(gaps.length / 2)]! : 0;
  const known = samples >= MIN_SAMPLES && gaps.length >= 2 && intervalMs > 0;
  const intervalSeconds = known ? Math.round(intervalMs / 1000) : 0;
  const dueAt = known && lastChestAt ? lastChestAt + intervalMs : null;
  const lead = known ? Math.min(LEAD_MAX_MS, Math.max(LEAD_MIN_MS, intervalMs * 0.3)) : 0;
  return {
    username: input.username.replace(/^@+/, "").toLowerCase(),
    samples,
    intervalSeconds,
    lastChestAt,
    dueAt,
    windowStartsAt: dueAt != null ? dueAt - lead : null,
    confidence: known ? Math.min(1, Math.round((gaps.length / 4) * 100) / 100) : 0,
  };
}

/**
 * WebSocket kapısı: null = kısıtlama yok (ritim bilinmiyor), aksi hâlde
 * bağlantının açılabileceği en erken an. Kaçırmamak için en fazla
 * SAFETY_DEFER_MS ertelenir.
 */
export function rhythmGate(rhythm: ChestRhythm, now = Date.now()): number | null {
  if (rhythm.windowStartsAt == null) return null;
  return Math.min(rhythm.windowStartsAt, now + SAFETY_DEFER_MS);
}

/**
 * Tüm odaların ritmini tazeler ve dinleme kapısını (`next_listen_at`) yazar.
 * Yalnızca ritmi değişen odalar güncellenir; tur başına yazma yükü minimaldir.
 */
export async function refreshChestRhythms(now = Date.now()): Promise<{ rooms: number; known: number; gated: number }> {
  const since = new Date(now - HISTORY_MS);
  const [history, rooms] = await Promise.all([
    db.select({ username: chests.username, detectedAt: chests.detectedAt })
      .from(chests)
      .where(gte(chests.detectedAt, since))
      .orderBy(desc(chests.detectedAt))
      .limit(4000)
      .catch(() => []),
    db.select({
      id: liveRooms.id,
      username: liveRooms.username,
      chestIntervalSeconds: liveRooms.chestIntervalSeconds,
      chestDueAt: liveRooms.chestDueAt,
      nextListenAt: liveRooms.nextListenAt,
    }).from(liveRooms).limit(1000).catch(() => []),
  ]);

  const timesByUser = new Map<string, number[]>();
  for (const row of history) {
    const key = String(row.username).replace(/^@+/, "").toLowerCase();
    const at = row.detectedAt ? new Date(row.detectedAt).getTime() : 0;
    if (!key || !at) continue;
    const list = timesByUser.get(key);
    if (list) list.push(at);
    else timesByUser.set(key, [at]);
  }

  let known = 0;
  let gated = 0;
  for (const room of rooms) {
    const rhythm = deriveChestRhythm({ username: room.username, chestTimes: timesByUser.get(room.username) ?? [] });
    const gate = rhythmGate(rhythm, now);
    if (rhythm.intervalSeconds > 0) known++;
    if (gate != null && gate > now) gated++;
    // Ritim değişmediyse mevcut kapı korunur (kapı kendiliğinden kaymaz).
    const intervalChanged = (room.chestIntervalSeconds ?? 0) !== rhythm.intervalSeconds;
    const dueChanged = Math.abs((room.chestDueAt?.getTime() ?? 0) - (rhythm.dueAt ?? 0)) > 60_000;
    if (!intervalChanged && !dueChanged) continue;
    await db.update(liveRooms).set({
      chestIntervalSeconds: rhythm.intervalSeconds,
      chestDueAt: rhythm.dueAt != null ? new Date(rhythm.dueAt) : null,
      nextListenAt: gate != null ? new Date(gate) : null,
    }).where(eq(liveRooms.id, room.id)).catch(() => null);
  }
  return { rooms: rooms.length, known, gated };
}
