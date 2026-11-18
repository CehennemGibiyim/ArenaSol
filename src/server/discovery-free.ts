import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveRooms, targets } from "@/db/schema";
import { REGIONS_ALL, discoverAllRegions, summarizeRegions } from "@/server/discovery-global";
import { publicLiveSample } from "@/server/public-feed";

export type Candidate = {
  username: string; roomId: string; nickname: string; title: string; viewers: number; region: string; source: string;
};

export type FreeDiscovery = {
  candidates: Candidate[];
  /** Kimlik doğrulaması gerektirmeyen (anahtarsız) kaynakların gerçek katkısı. */
  keyless: Record<string, number>;
  eulerRequests: number;
  publicRequests: number;
  regionSummary: ReturnType<typeof summarizeRegions> | null;
  errors: string[];
  /** Anahtarsız keşfin ölçülen sınırı — uydurma "dünya taraması" olmaması için. */
  keylessLimit: string;
};

const HANDLE = /^[\w.]{2,24}$/;

/**
 * Anahtarsız + anahtarlı kaynakların birleşimi.
 *
 * Ölçümlendi (2026-11, anahtarsız):
 *   webcast.tiktok.com/webcast/ranklist/hour  -> 404 page not found
 *   tiktok.com/api/live/explore               -> "url doesn't match"
 *   tiktok.com/api/recommend/live             -> "url doesn't match"
 *   tiktok.com/live/explore                   -> 4.6 KB challenge sayfası, oda listesi yok
 * Bu yüzden anahtarsız kapsamın üst sınırı: kayıtlı hesaplar + sabitlenenler +
 * daha önce bulunan odalar + Tik.Tools'un 10 yayınlık açık listesi.
 */
export async function discoverCandidates(regions: string[]): Promise<FreeDiscovery> {
  const map = new Map<string, Candidate>();
  const keyless: Record<string, number> = { watchlist: 0, pinned: 0, discovered: 0, "public-sample": 0 };
  const errors: string[] = [];
  const add = (input: Partial<Candidate> & { username: string; source: string }) => {
    const username = input.username.replace(/^@/, "").toLowerCase().trim();
    if (!HANDLE.test(username)) return;
    const previous = map.get(username);
    map.set(username, {
      username,
      roomId: input.roomId || previous?.roomId || "",
      nickname: input.nickname || previous?.nickname || username,
      title: input.title || previous?.title || "",
      viewers: input.viewers || previous?.viewers || 0,
      region: input.region || previous?.region || "",
      source: input.source,
    });
  };

  const [pinned, saved, discovered] = await Promise.all([
    db.select().from(liveRooms).where(eq(liveRooms.pinned, true)).orderBy(desc(liveRooms.lastSeenAt)).limit(120).catch(() => []),
    db.select().from(targets).orderBy(desc(targets.score)).limit(200).catch(() => []),
    db.select().from(liveRooms).orderBy(desc(liveRooms.lastSeenAt)).limit(400).catch(() => []),
  ]);
  for (const row of pinned) { add({ username: row.username, roomId: row.roomId, nickname: row.nickname, title: row.title, viewers: row.viewers, region: row.region, source: "pinned" }); keyless.pinned++; }
  for (const row of saved) { add({ username: row.username, nickname: row.displayName, viewers: row.viewers, source: "watchlist" }); keyless.watchlist++; }
  for (const row of discovered) { add({ username: row.username, roomId: row.roomId, nickname: row.nickname, title: row.title, viewers: row.viewers, region: row.region, source: "discovered" }); keyless.discovered++; }

  let eulerRequests = 0;
  let publicRequests = 0;
  let regionSummary: FreeDiscovery["regionSummary"] = null;
  const eulerKey = (process.env.EULER_API_KEY ?? "").trim();
  if (eulerKey) {
    try {
      const feed = await discoverAllRegions(eulerKey, { regions: regions.length ? regions : [...REGIONS_ALL], concurrency: 8, timeoutMs: 12000 });
      eulerRequests = feed.regions.length;
      regionSummary = summarizeRegions(feed.regions);
      errors.push(...feed.errors.slice(0, 10));
      for (const room of feed.rooms) add({ ...room, username: room.user, source: "euler" });
    } catch (error) { errors.push(`bölge keşfi: ${(error as Error).message}`); }
  } else {
    const sample = await publicLiveSample();
    publicRequests = sample.requests;
    if (sample.error) errors.push(sample.error);
    for (const room of sample.rooms) add({ username: room.user, roomId: room.roomId, nickname: room.nickname, region: room.region, source: "public-sample" });
    keyless["public-sample"] = sample.rooms.length;
  }

  return {
    candidates: [...map.values()].sort((a, b) => b.viewers - a.viewers),
    keyless, eulerRequests, publicRequests, regionSummary, errors,
    keylessLimit: eulerKey
      ? `EulerStream bölge feed'i: ${eulerRequests} bölge isteği.`
      : "Anahtarsız: bölge feed'i yok (TikTok uçları 404 / 'url doesn't match' / challenge döndürdü). Kapsam = kayıtlı hesaplar + sabitlenenler + bulunan odalar + 10 yayınlık açık liste.",
  };
}
