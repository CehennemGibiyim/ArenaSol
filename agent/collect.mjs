#!/usr/bin/env node
/**
 * Arena GitHub Actions Collector — 7/24 arka plan tarayıcısı
 * ---------------------------------------------------------------------------
 * Kullanıcı sisteme girmeden de çalışır (GitHub Actions cron ile 5 dk'da bir):
 *   1) WATCHLIST + pinlenenler + açık örnek liste + (varsa) EulerStream bölge feed'i
 *   2) her adayı TikTok check_alive ile doğrula
 *   3) en iyi N odaya kısa WebSocket dinlemesi yap, sandık/çanta zarflarını yakala
 *   4) sonucu docs/data/rooms.json ve docs/data/chests.json olarak commit'le
 *
 * Ortam değişkenleri (Actions secrets/variables):
 *   EULER_API_KEY   (opsiyonel, Business feed için)
 *   WATCHLIST       "@a,@b" (opsiyonel)
 *   MAX_ROOMS       dinlenecek oda sayısı (varsayılan 8)
 *   LISTEN_SECONDS  oda başına dinleme (varsayılan 45)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA = path.join(ROOT, "docs", "data");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";
const MAX_ROOMS = Math.max(1, Number(process.env.MAX_ROOMS || 8));
const LISTEN_SECONDS = Math.max(15, Number(process.env.LISTEN_SECONDS || 45));

const log = (...a) => console.log(`[collect ${new Date().toISOString()}]`, ...a);

async function getJson(url, headers = {}, timeoutMs = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://www.tiktok.com/live", ...headers }, signal: c.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function userRoom(handle) {
  try {
    const p = await getJson(`https://www.tiktok.com/api-live/user/room/?aid=1988&uniqueId=${encodeURIComponent(handle)}&sourceType=54`);
    return { roomId: String(p?.data?.user?.roomId ?? ""), nickname: p?.data?.user?.nickname ?? handle, title: p?.data?.liveRoom?.title ?? "" };
  } catch { return { roomId: "", nickname: handle, title: "" }; }
}
async function checkAlive(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const p = await getJson(`https://webcast.tiktok.com/webcast/room/check_alive/?aid=1988&room_ids=${chunk.join(",")}`);
      for (const row of p?.data ?? []) { const id = String(row.room_id_str ?? row.room_id ?? ""); if (id) out[id] = Boolean(row.alive); }
    } catch { /* yoksay */ }
  }
  return out;
}
async function publicSample() {
  try {
    const p = await getJson("https://api.tik.tools/api/live/top-channels");
    return (Array.isArray(p?.channels) ? p.channels : []).slice(0, 10).map((c) => ({ user: String(c.uniqueId ?? "").replace(/^@/, ""), roomId: String(c.roomId ?? ""), nickname: String(c.displayName ?? ""), region: String(c.region ?? "") }));
  } catch { return []; }
}
async function eulerFeed(key, regions) {
  const rooms = [];
  await Promise.all(regions.slice(0, 24).map(async (region) => {
    try {
      const p = await getJson(`https://api.eulerstream.com/webcast/feed?region=${region}`, { "x-api-key": key });
      for (const raw of p?.response?.data?.data ?? []) {
        const user = raw?.owner?.unique_id ?? raw?.owner?.uniqueId;
        if (user) rooms.push({ user: String(user), roomId: String(raw.id_str ?? raw.id ?? ""), nickname: String(raw.owner?.nickname ?? user), title: String(raw.title ?? ""), viewers: Number(raw.stats?.total_user ?? raw.user_count ?? 0), region });
      }
    } catch { /* bölge hatası diğerini etkilemez */ }
  }));
  return rooms;
}

async function main() {
  const watchlist = (process.env.WATCHLIST || "").split(",").map((x) => x.trim().replace(/^@+/, "")).filter(Boolean);
  let pinned = [];
  try { pinned = JSON.parse(await readFile(path.join(DATA, "rooms.json"), "utf8")).rooms?.map((r) => r.user) ?? []; } catch { /* ilk tur */ }

  const candidates = new Map();
  for (const user of [...watchlist, ...pinned]) if (/^[\w.]{2,24}$/.test(user)) candidates.set(user.toLowerCase(), { user, source: "watchlist" });
  for (const room of await publicSample()) if (/^[\w.]{2,24}$/.test(room.user)) candidates.set(room.user.toLowerCase(), { ...room, source: "public-sample" });
  const eulerKey = (process.env.EULER_API_KEY || "").trim();
  if (eulerKey) {
    for (const room of await eulerFeed(eulerKey, ["TR","US","GB","DE","FR","BR","ID","VN","PH","IN","MX","ES","IT","SA","EG","NG","JP","KR"])) {
      if (/^[\w.]{2,24}$/.test(room.user)) candidates.set(room.user.toLowerCase(), { ...room, source: "euler" });
    }
  }

  const live = [];
  let cursor = 0;
  const list = [...candidates.values()];
  await Promise.all(Array.from({ length: Math.min(10, list.length || 1) }, async () => {
    while (cursor < list.length) {
      const c = list[cursor++];
      if (!c) break;
      try {
        let roomId = c.roomId;
        let nickname = c.nickname || c.user;
        let title = c.title || "";
        if (!roomId) { const info = await userRoom(c.user); roomId = info.roomId; nickname = info.nickname || nickname; title = info.title || title; }
        if (!roomId) continue;
        const alive = await checkAlive([roomId]);
        if (alive[roomId]) live.push({ user: c.user, roomId, nickname, title, region: c.region || "", source: c.source, viewers: c.viewers || 0, checkedAt: new Date().toISOString() });
      } catch { /* tek hesap hatası */ }
    }
  }));
  live.sort((a, b) => b.viewers - a.viewers);

  // Kısa dinleme: sandık zarflarını yakala
  const chests = [];
  const seen = new Set();
  try { for (const c of JSON.parse(await readFile(path.join(DATA, "chests.json"), "utf8")).chests ?? []) seen.add(c.envelopeId); } catch { /* ilk tur */ }
  try {
    const mod = await import("tiktok-live-connector");
    const picked = live.slice(0, MAX_ROOMS);
    await Promise.all(picked.map(async (room) => {
      try {
        const conn = new mod.TikTokLiveConnection(room.user, { processInitialData: false, enableExtendedGiftInfo: false, signApiKey: eulerKey || undefined });
        conn.on("envelope", (raw) => {
          const info = raw?.envelopeInfo;
          if (!info?.envelopeId || seen.has(info.envelopeId)) return;
          seen.add(info.envelopeId);
          const coins = Number(info.diamondCount ?? 0), slots = Number(info.peopleCount ?? 0);
          if (coins <= 0 || slots <= 0) return;
          let opens = Number(info.unpackAt ?? 0); const opensMs = opens < 1e12 ? opens * 1000 : opens;
          chests.push({ envelopeId: String(info.envelopeId), username: room.user, roomId: room.roomId, nickname: room.nickname, coins, slots, ratio: Math.round((coins / Math.max(1, slots)) * 100) / 100, opensAt: new Date(opensMs > 0 ? opensMs : Date.now() + 180000).toISOString(), detectedAt: new Date().toISOString(), source: "actions-collector" });
        });
        await Promise.race([conn.connect(room.roomId), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000))]);
        await new Promise((r) => setTimeout(r, LISTEN_SECONDS * 1000));
        await conn.disconnect().catch(() => {});
      } catch (e) { log(`${room.user}: ${e.message}`); }
    }));
  } catch { log("connector yok — yalnızca keşif yapıldı"); }

  // Süresi geçen sandıkları temizle
  const cutoff = Date.now() - 90_000;
  const activeChests = chests.filter((c) => new Date(c.opensAt).getTime() > cutoff);

  await mkdir(DATA, { recursive: true });
  await writeFile(path.join(DATA, "rooms.json"), JSON.stringify({ generatedAt: new Date().toISOString(), source: eulerKey ? "euler+watchlist+public" : "watchlist+public-sample", eulerKey: Boolean(eulerKey), checked: list.length, liveCount: live.length, rooms: live }, null, 2));
  await writeFile(path.join(DATA, "chests.json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: activeChests.length, chests: activeChests }, null, 2));
  log(`tamam: ${list.length} kontrol · ${live.length} canlı · ${activeChests.length} aktif sandık`);
}

main().catch((e) => { console.error(e); process.exit(1); });
