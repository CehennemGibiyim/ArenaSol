import type { FeedRoomSummary } from "@/server/discovery-global";

/** Tik.Tools public ticker: https://tik.tools/docs — 10 live channels, one request / 5 min / IP.
 * This is a small sample, NOT a country scan. Cache both empty and failed responses. */
const globalCache = globalThis as typeof globalThis & {
  __arenaPublicFeed?: { until: number; rooms: FeedRoomSummary[]; error: string; requests: number };
};

export async function publicLiveSample(): Promise<{ rooms: FeedRoomSummary[]; error: string; requests: number }> {
  const now = Date.now();
  const cached = globalCache.__arenaPublicFeed;
  if (cached && cached.until > now) return { rooms: cached.rooms, error: cached.error, requests: 0 };
  // Reserve the quota before the await so simultaneous scans do not race.
  globalCache.__arenaPublicFeed = { until: now + 300_000, rooms: [], error: "", requests: 1 };
  try {
    const response = await fetch("https://api.tik.tools/api/live/top-channels", {
      signal: AbortSignal.timeout(10_000),
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { channels?: Array<Record<string, unknown>> };
    const rooms: FeedRoomSummary[] = (Array.isArray(payload.channels) ? payload.channels : []).slice(0, 10).flatMap((item) => {
      const user = String(item.uniqueId ?? "").replace(/^@/, "");
      if (!/^[\w.]{2,24}$/.test(user)) return [];
      return [{
        roomId: String(item.roomId ?? ""), user, nickname: String(item.displayName ?? user),
        avatar: "", title: "", viewers: 0, thumb: "", region: String(item.region ?? ""),
      }];
    });
    globalCache.__arenaPublicFeed = { until: now + 300_000, rooms, error: rooms.length ? "" : "Açık yayın listesi boş döndü; dünya taraması yapılmadı.", requests: 1 };
  } catch (error) {
    const retry = (error as Error).message.includes("429") ? 300_000 : 60_000;
    globalCache.__arenaPublicFeed = { until: now + retry, rooms: [], error: `Açık yayın listesi alınamadı: ${(error as Error).message}`, requests: 1 };
  }
  const result = globalCache.__arenaPublicFeed;
  return { rooms: result.rooms, error: result.error, requests: 1 };
}
