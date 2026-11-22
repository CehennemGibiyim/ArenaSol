import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, liveRooms, radarScans, targets } from "@/db/schema";
import { checkLiveWeb } from "@/server/discovery";
import { REGIONS_ALL, discoverAllRegions, summarizeRegions } from "@/server/discovery-global";
import { publicLiveSample } from "@/server/public-feed";
import { enqueueVerifiedRoom, startListenerWorker } from "@/server/listener-worker";
import { getSettings } from "@/server/settings";
import { listScanTasks, radarOverview, upsertLiveRoom } from "@/server/rooms";
import { expireOldChests } from "@/server/chest";
import { discoverCandidates } from "@/server/discovery-free";

export type ScanScope = { regions: string[]; regionCoverage: "all" | "custom" | "manual"; eulerAvailable: boolean };
export type ScannerStatus = {
  running: boolean; lastRunAt: string | null; nextRunAt: string | null;
  lastResult: { checked: number; liveFound: number; chestsFound: number; source: string; error: string } | null;
  intervalSeconds: number; maxRooms: number; listening: number;
  lastRegionSummary: ReturnType<typeof summarizeRegions> | null; scope: ScanScope;
};
const state = globalThis as typeof globalThis & { __arenaScanner?: {
  timer: ReturnType<typeof setInterval> | null; watchdog: ReturnType<typeof setInterval> | null;
  running: boolean; runningSince: number; lastRunAt: number | null;
  lastResult: ScannerStatus["lastResult"]; lastRegionSummary: ScannerStatus["lastRegionSummary"]; scope: ScanScope;
} };
function store() {
  return state.__arenaScanner ??= { timer: null, watchdog: null, running: false, runningSince: 0, lastRunAt: null,
    lastResult: null, lastRegionSummary: null,
    scope: { regions: [...REGIONS_ALL], regionCoverage: "all", eulerAvailable: Boolean(process.env.EULER_API_KEY) } };
}
/** Tarama aralığı: ayarlardan okunur, asla 60 sn'nin altına inmez. */
function scanInterval(settings: { scanIntervalSeconds?: number } | null): number {
  return Math.max(60, Number(settings?.scanIntervalSeconds ?? 120));
}
function armScanTimer(intervalSeconds: number) {
  const s = store();
  if (s.timer) clearInterval(s.timer);
  // Keşif döngüsü hiçbir koşulda kendiliğinden sonlanmaz; hata yutsa da yeniden dener.
  s.timer = setInterval(() => {
    void expireOldChests().catch(() => null);
    void runScan().catch(() => null);
  }, intervalSeconds * 1000);
}
/**
 * Zamanlayıcıyı yeniden kurar ve tarama bayatsa hemen yeni tur başlatır.
 * Panel, ajan ve watchdog aynı işlevi kullanır: tarama durdurulamaz, yalnızca
 * yeniden ayağa kaldırılır.
 */
export async function ensureScanning() {
  const s = store();
  const settings = await getSettings().catch(() => null);
  const intervalSeconds = scanInterval(settings);
  if (!s.timer) armScanTimer(intervalSeconds);
  const staleAfter = intervalSeconds * 4 * 1000;
  if (!s.running && (!s.lastRunAt || Date.now() - s.lastRunAt > staleAfter)) {
    void runScan().catch(() => null);
  }
}
export async function getScannerStatus(): Promise<ScannerStatus> {
  const settings = await getSettings();
  const s = store();
  const intervalSeconds = Number(settings.scanIntervalSeconds ?? 120);
  const overview = await radarOverview().catch(() => null);
  return { running: s.running, lastRunAt: s.lastRunAt ? new Date(s.lastRunAt).toISOString() : null,
    nextRunAt: s.lastRunAt ? new Date(s.lastRunAt + intervalSeconds * 1000).toISOString() : null,
    lastResult: s.lastResult, intervalSeconds, maxRooms: Number(settings.maxScanRooms ?? 12),
    listening: overview?.listening ?? 0, lastRegionSummary: s.lastRegionSummary, scope: s.scope };
}
export function startScannerLoop() {
  startListenerWorker();
  const s = store();
  // 30 sn'lik watchdog: süreç ayakta kaldıkça tarama zamanlayıcısı da ayakta kalır.
  if (!s.watchdog) {
    s.watchdog = setInterval(() => { void ensureScanning().catch(() => null); }, 30_000);
  }
  if (s.timer) return;
  // Tam otomatik: panel açılmasa da keşif döngüsü kendiliğinden çalışır.
  void runScan().catch(() => null);
  void ensureScanning().catch(() => null);
}
/** Geriye dönük uyumluluk: "durdur" isteği taramayı kapatmaz, yeniden kurar. */
export function stopScannerLoop() {
  startScannerLoop();
  void ensureScanning().catch(() => null);
}
export type ScanOptions = { regions?: string[]; only?: string[]; listenSecondsOverride?: number; maxRoomsOverride?: number };
export async function runScan(options: ScanOptions = {}) {
  const s = store();
  const regions = options.regions?.length ? options.regions : [...REGIONS_ALL];
  const scope: ScanScope = { regions: process.env.EULER_API_KEY ? regions : [],
    regionCoverage: process.env.EULER_API_KEY ? options.regions?.length ? "custom" : "all" : "manual",
    eulerAvailable: Boolean(process.env.EULER_API_KEY) };
  const stuck = s.running && s.runningSince > 0 && Date.now() - s.runningSince > 5 * 60_000;
  if (s.running && !stuck) return { checked: 0, liveFound: 0, chestsFound: 0, source: "busy", error: "Tarama zaten çalışıyor.",
    scanId: 0, regionSummary: s.lastRegionSummary, scope: s.scope, errors: [], roomsConsidered: 0, eulerRequests: 0, publicRequests: 0, queued: 0 };
  // 5 dakikadan uzun süren tur kilitlenmiş sayılır: tarama zinciri kopmaz.
  s.running = true;
  s.runningSince = Date.now();
  s.scope = scope;
  let checked = 0, liveFound = 0, eulerRequests = 0, publicRequests = 0, queued = 0, roomsConsidered = 0;
  let error = "";
  let keylessBreakdown: Record<string, number> = {};
  let keylessLimit = "";
  const errors: string[] = [];
  let regionSummary: ReturnType<typeof summarizeRegions> | null = null;
  const source = process.env.EULER_API_KEY ? "euler+watchlist" : "public-sample+watchlist";
  let scanId = 0;
  try {
    const [scan] = await db.insert(radarScans).values({ source }).returning();
    scanId = scan?.id ?? 0;
    const candidates = new Map<string, { username: string; roomId: string; nickname: string; title: string; viewers: number; region: string; source: string }>();
    const add = (input: { username: string; roomId?: string; nickname?: string; title?: string; viewers?: number; region?: string; source: string }) => {
      const key = input.username.replace(/^@/, "").toLowerCase();
      if (!/^[\w.]{2,24}$/.test(key)) return;
      const previous = candidates.get(key);
      candidates.set(key, { username: key, roomId: input.roomId || previous?.roomId || "",
        nickname: input.nickname || previous?.nickname || key, title: input.title || previous?.title || "",
        viewers: input.viewers || previous?.viewers || 0, region: input.region || previous?.region || "", source: input.source });
    };
    const discovery = await discoverCandidates(regions);
    eulerRequests = discovery.eulerRequests;
    publicRequests = discovery.publicRequests;
    regionSummary = discovery.regionSummary;
    if (regionSummary) s.lastRegionSummary = regionSummary;
    errors.push(...discovery.errors);
    keylessBreakdown = discovery.keyless;
    keylessLimit = discovery.keylessLimit;
    for (const item of discovery.candidates) candidates.set(item.username, item);
    if (options.only?.length) {
      const only = new Set(options.only.map((x) => x.replace(/^@/, "").toLowerCase()));
      for (const username of only) if (!candidates.has(username)) add({ username, source: "manual" });
      for (const username of candidates.keys()) if (!only.has(username)) candidates.delete(username);
    }
    roomsConsidered = candidates.size;
    let cursor = 0;
    const list = [...candidates.values()];
    await Promise.all(Array.from({ length: Math.min(16, list.length) }, async () => {
      while (cursor < list.length) {
        const item = list[cursor++];
        if (!item) break;
        checked++;
        try {
          const result = await checkLiveWeb(item.username);
          await db.update(targets).set({ liveNow: result.live, viewers: result.live ? result.viewers : 0,
            lastCheckedAt: new Date() }).where(eq(targets.username, item.username)).catch(() => null);
          await upsertLiveRoom({ username: item.username, roomId: result.roomId || item.roomId,
            nickname: result.nickname || item.nickname, title: result.title || item.title, avatar: result.avatar,
            region: item.region || "TR", viewers: result.viewers, liveNow: result.live,
            source: item.source, lastError: result.detail });
          if (!result.live || !result.roomId) continue;
          liveFound++;
          await enqueueVerifiedRoom({ username: item.username, roomId: result.roomId,
            nickname: result.nickname || item.nickname, title: result.title || item.title,
            viewers: result.viewers || item.viewers });
          queued++;
        } catch (e) { errors.push(`${item.username}: ${(e as Error).message}`); }
      }
    }));
    if (!list.length) error = "Aday bulunamadı; açık liste boş olabilir. Bu bir dünya taraması değildir.";
    else if (!liveFound) error = `${checked} hesap kontrol edildi; doğrulanmış canlı yayın yok.`;
    else error = `${liveFound} canlı yayın kalıcı dinleme sırasına alındı; sandık olayları arka planda izleniyor.`;
  } catch (e) { error = (e as Error).message; errors.push(error); }
  finally {
    await expireOldChests().catch(() => 0);
    s.running = false;
    s.runningSince = 0;
    s.lastRunAt = Date.now();
    // Tur bittiğinde zamanlayıcı ölmüşse hemen yeniden kur.
    if (!s.timer) armScanTimer(scanInterval(await getSettings().catch(() => null)));
    s.lastResult = { checked, liveFound, chestsFound: 0, source, error };
    if (scanId) await db.update(radarScans).set({ finishedAt: new Date(), checked, liveFound,
      chestsFound: 0, source, error }).where(eq(radarScans.id, scanId)).catch(() => null);
    await db.insert(activityLog).values({ kind: "radar",
      message: `Keşif: Euler ${eulerRequests} istek · açık liste ${publicRequests} istek · ${checked} kontrol · ${liveFound} canlı · ${queued} sırada.`,
      meta: { eulerRequests, publicRequests, checked, liveFound, queued, keyless: keylessBreakdown, regionSummary, errors: errors.slice(0, 5) } }).catch(() => null);
  }
  return { ...s.lastResult!, scanId, regionSummary, scope, errors, roomsConsidered, eulerRequests, publicRequests, queued, keylessBreakdown, keylessLimit };
}
export async function recentScans(limit = 10) {
  return db.select().from(radarScans).orderBy(desc(radarScans.id)).limit(limit);
}
export async function scannerDashboard() {
  const [status, scansResult, tasksResult, overviewResult] = await Promise.allSettled([
    getScannerStatus(), recentScans(10), listScanTasks(undefined, 40), radarOverview()]);
  return { status: status.status === "fulfilled" ? status.value : null,
    scans: scansResult.status === "fulfilled" ? scansResult.value : [],
    tasks: tasksResult.status === "fulfilled" ? tasksResult.value : [],
    overview: overviewResult.status === "fulfilled" ? overviewResult.value : null };
}
