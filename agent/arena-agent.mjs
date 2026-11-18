#!/usr/bin/env node
/**
 * Arena Agent (Windows paketi) — uzaktan veri + yerel dinleme + anlık sandık bildirimi
 * ---------------------------------------------------------------------------
 * Çalışma modları:
 *   1) UZAKTAN (varsayılan): ARENA_BACKEND üzerinden çalışan GitHub sisteminden veri çeker.
 *      - GitHub Pages ise: data/rooms.json + data/chests.json 5 sn'de bir yenilenir.
 *      - Next.js sunucusu ise: /api/chests/stream (SSE) ile sandık anında itilir (gecikme yok).
 *   2) YEREL: tiktok-live-connector ile WATCHLIST odalarını paralel dinler, /api/ingest'e yazar.
 * Sonuçlar agent/data/panel.json'a yazılır; yerel mini panel buradan okur.
 *
 * Açılışta önce agent/update.mjs çalışır (GitHub'daki değişiklikleri otomatik uygular).
 *
 * Ortam değişkenleri:
 *   ARENA_BACKEND      https://cehennemgibiyim.github.io/Arena  (veya http://sunucu:3000)
 *   ARENA_PANEL_URL    yerel mod için panel (varsayılan http://localhost:3000)
 *   ARENA_INGEST_TOKEN opsiyonel
 *   WATCHLIST          "@a,@b" yerel dinleme listesi
 *   CONCURRENCY        yerel paralel oda (varsayılan 5)
 *   LISTEN_SECONDS     oda başına süre (varsayılan 300)
 *   LOCAL_LISTEN=0     yerel dinlemeyi kapat, yalnızca uzaktan veri
 */
import { setTimeout as sleep } from "node:timers/promises";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const OUT = path.join(ROOT, "agent", "data");
const BACKEND = (process.env.ARENA_BACKEND || "https://cehennemgibiyim.github.io/Arena").replace(/\/$/, "");
const PANEL = (process.env.ARENA_PANEL_URL || "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.ARENA_INGEST_TOKEN || "";
const WATCHLIST = (process.env.WATCHLIST || "").split(",").map((x) => x.trim().replace(/^@+/, "")).filter(Boolean);
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 5));
const LISTEN_SECONDS = Math.max(20, Number(process.env.LISTEN_SECONDS || 300));
const LOCAL_LISTEN = process.env.LOCAL_LISTEN !== "0";
const log = (...a) => console.log(`[arena-agent ${new Date().toLocaleTimeString("tr-TR")}]`, ...a);

async function savePanel(data) {
  await mkdir(OUT, { recursive: true });
  await writeFile(path.join(OUT, "panel.json"), JSON.stringify({ ...data, savedAt: new Date().toISOString() }, null, 2));
}

/* ---------------- 1) UZAKTAN VERİ: polling + SSE anlık bildirim ---------------- */

async function pullRemote() {
  // Önce JSON veri kaynakları (Pages)
  try {
    const [rooms, chests] = await Promise.all([
      fetch(`${BACKEND}/data/rooms.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${BACKEND}/data/chests.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (rooms || chests) {
      await savePanel({ mode: "remote-pages", rooms: rooms?.rooms ?? [], chests: chests?.chests ?? [], remoteGeneratedAt: rooms?.generatedAt ?? chests?.generatedAt ?? null, source: rooms?.source ?? "remote" });
      log(`uzaktan: ${rooms?.liveCount ?? rooms?.rooms?.length ?? 0} canlı · ${chests?.count ?? 0} sandık (${rooms?.source ?? "?"})`);
      return true;
    }
  } catch { /* Pages değil, Next.js olabilir */ }
  // Next.js sunucusu: REST anlık veri
  try {
    const data = await fetch(`${BACKEND}/api/chests?kind=all&sort=opens_at&desc=0&t=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null));
    if (data) {
      await savePanel({ mode: "remote-server", chests: data.chests ?? [], liveRooms: data.live_rooms ?? [], source: "remote-server" });
      log(`uzaktan sunucu: ${data.count} sandık · ${data.live_rooms?.length ?? 0} canlı oda`);
      return true;
    }
  } catch { /* yok */ }
  return false;
}

/** SSE: sandık anında (saniye gecikmesi olmadan) Windows'a itilir. */
async function sseLoop() {
  while (true) {
    try {
      const response = await fetch(`${BACKEND}/api/chests/stream`, { headers: { Accept: "text/event-stream" } });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
      log("SSE akışı bağlandı — sandıklar anında gelecek");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const frame = buffer.slice(0, idx); buffer = buffer.slice(idx + 2);
          const event = /event: (\S+)/.exec(frame)?.[1] ?? "message";
          const dataLine = /data: (.*)/s.exec(frame)?.[1];
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine);
            if (event === "snapshot" || event === "chest") {
              await savePanel({ mode: "remote-sse", chests: data.chests ?? data.chest ? [data.chest, ...(data.chests ?? [])] : [], at: data.at });
              if (event === "chest") log(`🎁 ANINDA sandık: @${data.chest?.username} · ${data.chest?.coins} jeton / ${data.chest?.slots} kişi · oran ${data.chest?.ratio}`);
            }
          } catch { /* yoksay */ }
        }
      }
    } catch (e) {
      log("SSE koptu, yeniden deneniyor:", e.message);
    }
    await sleep(5000);
  }
}

/* ---------------- 2) YEREL DİNLEME (yedek / tek başına mod) ---------------- */

async function api(pathUrl, init = {}) {
  const headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  if (TOKEN) headers["x-arena-token"] = TOKEN;
  const response = await fetch(`${PANEL}${pathUrl}`, { ...init, headers });
  if (!response.ok) throw new Error(`${pathUrl} → HTTP ${response.status}`);
  return response.json();
}
async function ingest(payload) {
  try { await api("/api/ingest", { method: "POST", body: JSON.stringify({ source: "local-agent", ...payload }) }); }
  catch (e) { log("ingest hatası:", e.message); }
}
async function fetchTargets() {
  const targets = new Map();
  for (const u of WATCHLIST) targets.set(u.toLowerCase(), { username: u });
  try {
    const data = await api("/api/rooms?live=1&limit=100");
    for (const room of data.data ?? []) targets.set(room.username.toLowerCase(), { username: room.username, roomId: room.roomId, nickname: room.nickname, title: room.title, viewers: room.viewers });
  } catch (e) { log("oda listesi alınamadı:", e.message); }
  return [...targets.values()];
}
async function localListen() {
  let mod;
  try { mod = await import("tiktok-live-connector"); } catch { log("tiktok-live-connector yok; yalnızca uzaktan veri modu"); return; }
  while (true) {
    const targets = (await fetchTargets()).filter((t) => !WATCHLIST.length || WATCHLIST.map((w) => w.toLowerCase()).includes(t.username.toLowerCase()));
    if (!targets.length) { log("dinlenecek oda yok, 60 sn bekleniyor"); await sleep(60000); continue; }
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
      while (i < targets.length) {
        const t = targets[i++];
        if (!t) break;
        try {
          const conn = new mod.TikTokLiveConnection(t.username, { processInitialData: false, signApiKey: process.env.EULER_API_KEY || undefined });
          let diamonds = 0, gifts = 0, chests = 0;
          conn.on("envelope", (raw) => {
            const info = raw?.envelopeInfo;
            if (info?.envelopeId) { chests++; void ingest({ kind: "chest", username: t.username, roomId: t.roomId || info.roomId, envelopeId: String(info.envelopeId), diamondCount: Number(info.diamondCount ?? 0), peopleCount: Number(info.peopleCount ?? 0), unpackAt: Number(info.unpackAt ?? 0), skinId: info.skinId, businessType: info.businessType }); }
          });
          conn.on("gift", (raw) => { gifts++; diamonds += Number(raw?.diamondCount ?? raw?.giftDetails?.diamondCount ?? 0) * Math.max(1, Number(raw?.repeatCount ?? 1)); });
          await Promise.race([conn.connect(t.roomId), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000))]);
          log(`dinleniyor: @${t.username}`);
          await sleep(LISTEN_SECONDS * 1000);
          await conn.disconnect().catch(() => {});
          if (diamonds > 0 || chests > 0) void ingest({ kind: "flow", username: t.username, roomId: t.roomId, diamonds, events: gifts, watchedSeconds: LISTEN_SECONDS });
        } catch (e) { log(`@${t.username}: ${e.message}`); await sleep(10000); }
      }
    }));
  }
}

/* ---------------- ana döngü ---------------- */
(async () => {
  log(`backend=${BACKEND} · yerel dinleme=${LOCAL_LISTEN ? "açık" : "kapalı"}`);
  if (LOCAL_LISTEN) void localListen().catch((e) => log("yerel dinleme hatası:", e.message));
  // SSE varsa anlık bildirim; yoksa 5 sn polling ile uzaktan veri çek
  void sseLoop().catch(() => {});
  while (true) {
    const ok = await pullRemote().catch(() => false);
    if (!ok) log("uzaktan veri alınamadı, 10 sn sonra yeniden denenecek");
    await sleep(ok ? 5000 : 10000);
  }
})();
