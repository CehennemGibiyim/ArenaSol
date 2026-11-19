#!/usr/bin/env node
/**
 * Arena Agent (Windows paketi) — uzaktan veri + yerel dinleme + otomatik sandık açma
 * ---------------------------------------------------------------------------
 * Çalışma modları:
 *   1) UZAKTAN (varsayılan): ARENA_BACKEND üzerinden GitHub sisteminden veri çeker.
 *      - GitHub Pages ise: data/rooms.json + data/chests.json 3 sn'de bir yenilenir.
 *      - Next.js sunucusu ise: /api/chests/stream (SSE) ile sandık anında itilir.
 *   2) YEREL: tiktok-live-connector ile WATCHLIST odalarını paralel dinler, /api/ingest'e yazar.
 *
 * SANDIK AÇMA ASİSTANI
 *   Sandık açılışına AUTO_JOIN_LEAD_SECONDS kala (varsayılan 20 sn) canlı yayın
 *   tarayıcıda otomatik açılır; jeton toplamaz, almak için tek dokunuş yeter.
 *   NOT: TikTok zarf/jeton toplama işlemi mobil uygulama oturumu ister.
 *   Bu betik hesabınıza giriş yapmaz, sizin yerinize talep göndermez; yalnızca
 *   doğru yayını doğru saniyede açıp bildirir.
 *
 *   AUTO_JOIN=1 / 0                 (varsayılan 1)
 *   AUTO_JOIN_MIN_RATIO=1           (jeton ÷ kontenjan)
 *   AUTO_JOIN_MIN_COINS=100
 *   AUTO_JOIN_LEAD_SECONDS=20
 *   AUTO_JOIN_COOLDOWN_SECONDS=1800
 *   AUTO_JOIN_DRY_RUN=1             (tarayıcı açmadan yalnızca logla)
 *
 * Açılışta agent/update.mjs çalışır; çalışma sırasında UPDATE_CHECK_SECONDS
 * (varsayılan 1800) aralığıyla GitHub değişiklikleri yeniden kontrol edilir.
 *
 * Yerel durum: http://localhost:4780 (AGENT_PORT) — hızlı sandık listesi.
 */
import { setTimeout as sleep } from "node:timers/promises";
import { mkdir, writeFile, readFile, appendFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "agent", "data");
const BACKEND = (process.env.ARENA_BACKEND || "https://cehennemgibiyim.github.io/ArenaSol").replace(/\/$/, "");
const PANEL = (process.env.ARENA_PANEL_URL || "http://localhost:3000").replace(/\/$/, "");
const TOKEN = process.env.ARENA_INGEST_TOKEN || "";
const WATCHLIST = (process.env.WATCHLIST || "").split(",").map((x) => x.trim().replace(/^@+/, "")).filter(Boolean);
const WATCHLIST_SET = new Set(WATCHLIST.map((w) => w.toLowerCase()));
const CONCURRENCY = Math.max(1, Number(process.env.CONCURRENCY || 5));
const LISTEN_SECONDS = Math.max(20, Number(process.env.LISTEN_SECONDS || 300));
const LOCAL_LISTEN = process.env.LOCAL_LISTEN !== "0";
const POLL_SECONDS = Math.max(2, Number(process.env.POLL_SECONDS || 3));
const UPDATE_CHECK_SECONDS = Math.max(300, Number(process.env.UPDATE_CHECK_SECONDS || 1800));
const AGENT_PORT = Number(process.env.AGENT_PORT ?? 4780); // 0 = durum sunucusunu kapat

const AUTO_JOIN = process.env.AUTO_JOIN !== "0";
const AUTO_JOIN_MIN_RATIO = Number(process.env.AUTO_JOIN_MIN_RATIO ?? 1);
const AUTO_JOIN_MIN_COINS = Number(process.env.AUTO_JOIN_MIN_COINS ?? 100);
const AUTO_JOIN_LEAD_SECONDS = Math.max(0, Number(process.env.AUTO_JOIN_LEAD_SECONDS ?? 20));
const AUTO_JOIN_COOLDOWN_SECONDS = Math.max(60, Number(process.env.AUTO_JOIN_COOLDOWN_SECONDS ?? 1800));
const AUTO_JOIN_DRY_RUN = process.env.AUTO_JOIN_DRY_RUN === "1";

const log = (...a) => console.log(`[arena-agent ${new Date().toLocaleTimeString("tr-TR")}]`, ...a);

const state = { mode: "starting", rooms: [], chests: [], lastError: "", remoteGeneratedAt: null, alertCount: 0, opened: [] };
const openedChests = new Map(); // envelopeId|username -> timestamp

function ratioOf(c) {
  const coins = Number(c.coins ?? 0);
  const slots = Math.max(1, Number(c.slots ?? 1));
  return Math.round((coins / slots) * 100) / 100;
}

async function savePanel(data) {
  await mkdir(OUT, { recursive: true });
  await writeFile(
    path.join(OUT, "panel.json"),
    JSON.stringify({ ...data, savedAt: new Date().toISOString() }, null, 2),
  );
}

/* ------------------------- sandık açma asistanı ------------------------ */

function openInBrowser(url) {
  if (AUTO_JOIN_DRY_RUN) {
    log(`[dry-run] tarayıcı açılmayacaktı: ${url}`);
    return;
  }
  try {
    if (process.platform === "win32") {
      spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    } else if (process.platform === "darwin") {
      spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    } else {
      spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
    }
    log(`🚀 CANLI AÇILDI: ${url}`);
  } catch (e) {
    log("tarayıcı açılamadı:", e.message);
  }
}

async function logAlert(entry) {
  try {
    await mkdir(OUT, { recursive: true });
    await appendFile(path.join(OUT, "alerts.jsonl"), JSON.stringify(entry) + "\n");
  } catch {
    /* yoksay */
  }
}

/** Sandık açılışına yaklaşanları tarayıcıda açar (aynı sandık için tek kez). */
async function autoJoinSweep(chests) {
  if (!AUTO_JOIN) return;
  const now = Date.now();
  for (const chest of chests || []) {
    const key = String(chest.envelopeId || `${chest.username}:${chest.opensAt}`);
    const coins = Number(chest.coins ?? 0);
    const ratio = Number(chest.ratio ?? ratioOf(chest));
    if (!chest.username) continue;
    if (ratio < AUTO_JOIN_MIN_RATIO || coins < AUTO_JOIN_MIN_COINS) continue;
    const opensAt = chest.opensAt ? new Date(chest.opensAt).getTime() : 0;
    if (!opensAt) continue;
    const diff = opensAt - now;
    if (diff > AUTO_JOIN_LEAD_SECONDS * 1000 || diff < -60_000) continue;
    const last = openedChests.get(key) || 0;
    if (now - last < AUTO_JOIN_COOLDOWN_SECONDS * 1000) continue;
    openedChests.set(key, now);
    const url = chest.url || `https://www.tiktok.com/@${chest.username}/live`;
    const alert = {
      at: new Date().toISOString(),
      type: "auto-join",
      username: chest.username,
      coins,
      slots: Number(chest.slots ?? 0),
      ratio,
      opensAt: chest.opensAt,
      url,
    };
    state.alertCount++;
    state.opened.unshift(alert);
    state.opened = state.opened.slice(0, 20);
    log(
      `🎁 SANDIK AÇMA: @${chest.username} · ${coins} jeton / ${chest.slots} kişi · oran ${ratio} · ` +
        (diff > 0 ? `${Math.round(diff / 1000)} sn sonra açılıyor` : "şimdi açık"),
    );
    await logAlert(alert);
    openInBrowser(url);
  }
}

/* ---------------- 1) UZAKTAN VERİ: polling + SSE anlık bildirim ---------------- */

function mergeChests(previous, incoming) {
  const map = new Map();
  for (const c of [...(previous || []), ...(incoming || [])]) {
    if (!c || !c.username) continue;
    const key = String(c.envelopeId || `${c.username}:${c.opensAt}`);
    map.set(key, { ...(map.get(key) || {}), ...c });
  }
  const cutoff = Date.now() - 120_000;
  return [...map.values()].filter((c) => !c.opensAt || new Date(c.opensAt).getTime() > cutoff);
}

async function pullRemote() {
  // Önce JSON veri kaynakları (GitHub Pages)
  try {
    const [rooms, chests] = await Promise.all([
      fetch(`${BACKEND}/data/rooms.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${BACKEND}/data/chests.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
    ]);
    if (rooms || chests) {
      state.mode = "remote-pages";
      state.rooms = rooms?.rooms ?? state.rooms;
      state.chests = mergeChests(state.chests, chests?.chests ?? []);
      state.remoteGeneratedAt = rooms?.generatedAt ?? chests?.generatedAt ?? null;
      state.lastError = "";
      await savePanel({
        mode: "remote-pages",
        rooms: state.rooms,
        chests: state.chests,
        remoteGeneratedAt: state.remoteGeneratedAt,
        source: rooms?.source ?? "remote",
        agent: { autoJoin: AUTO_JOIN, alertCount: state.alertCount, opened: state.opened },
      });
      log(`uzaktan: ${rooms?.liveCount ?? state.rooms.length} canlı · ${state.chests.length} sandık (${rooms?.source ?? "?"})`);
      await autoJoinSweep(state.chests);
      return true;
    }
  } catch {
    /* Pages değil, Next.js olabilir */
  }
  // Next.js sunucusu: REST anlık veri
  try {
    const data = await fetch(`${BACKEND}/api/chests?kind=all&sort=opens_at&desc=0&t=${Date.now()}`, {
      cache: "no-store",
    }).then((r) => (r.ok ? r.json() : null));
    if (data) {
      state.mode = "remote-server";
      state.chests = mergeChests(state.chests, data.chests ?? []);
      state.rooms = data.live_rooms ?? state.rooms;
      state.lastError = "";
      await savePanel({
        mode: "remote-server",
        chests: state.chests,
        liveRooms: state.rooms,
        source: "remote-server",
        agent: { autoJoin: AUTO_JOIN, alertCount: state.alertCount, opened: state.opened },
      });
      log(`uzaktan sunucu: ${state.chests.length} sandık · ${state.rooms.length} canlı oda`);
      await autoJoinSweep(state.chests);
      return true;
    }
  } catch (e) {
    state.lastError = e.message;
  }
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
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const event = /event: (\S+)/.exec(frame)?.[1] ?? "message";
          const dataLine = /data: (.*)/s.exec(frame)?.[1];
          if (!dataLine) continue;
          try {
            const data = JSON.parse(dataLine);
            if (event === "snapshot" || event === "chest") {
              const incoming = data.chest ? [data.chest, ...(data.chests ?? [])] : data.chests ?? [];
              state.mode = "remote-sse";
              state.chests = mergeChests(state.chests, incoming);
              await savePanel({
                mode: "remote-sse",
                chests: state.chests,
                at: data.at,
                agent: { autoJoin: AUTO_JOIN, alertCount: state.alertCount, opened: state.opened },
              });
              if (event === "chest") {
                log(
                  `🎁 ANINDA sandık: @${data.chest?.username} · ${data.chest?.coins} jeton / ${data.chest?.slots} kişi · oran ${data.chest?.ratio}`,
                );
              }
              await autoJoinSweep(state.chests);
            }
          } catch {
            /* yoksay */
          }
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
  try {
    await api("/api/ingest", { method: "POST", body: JSON.stringify({ source: "local-agent", ...payload }) });
  } catch (e) {
    log("ingest hatası:", e.message);
  }
}
async function fetchTargets() {
  const targets = new Map();
  for (const u of WATCHLIST) targets.set(u.toLowerCase(), { username: u });
  try {
    const data = await api("/api/rooms?live=1&limit=100");
    for (const room of data.data ?? [])
      targets.set(room.username.toLowerCase(), {
        username: room.username,
        roomId: room.roomId,
        nickname: room.nickname,
        title: room.title,
        viewers: room.viewers,
      });
  } catch (e) {
    log("oda listesi alınamadı:", e.message);
  }
  return [...targets.values()];
}
async function localListen() {
  let mod;
  try {
    mod = await import("tiktok-live-connector");
  } catch {
    log("tiktok-live-connector yok; yalnızca uzaktan veri modu");
    return;
  }
  while (true) {
    const targets = (await fetchTargets()).filter(
      (t) => !WATCHLIST_SET.size || WATCHLIST_SET.has(t.username.toLowerCase()),
    );
    if (!targets.length) {
      log("dinlenecek oda yok, 60 sn bekleniyor");
      await sleep(60000);
      continue;
    }
    let i = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, targets.length) }, async () => {
        while (i < targets.length) {
          const t = targets[i++];
          if (!t) break;
          try {
            const conn = new mod.TikTokLiveConnection(t.username, {
              processInitialData: false,
              signApiKey: process.env.EULER_API_KEY || undefined,
            });
            let diamonds = 0,
              gifts = 0,
              chests = 0;
            conn.on("envelope", (raw) => {
              const info = raw?.envelopeInfo;
              if (info?.envelopeId) {
                chests++;
                void ingest({
                  kind: "chest",
                  username: t.username,
                  roomId: t.roomId || info.roomId,
                  envelopeId: String(info.envelopeId),
                  diamondCount: Number(info.diamondCount ?? 0),
                  peopleCount: Number(info.peopleCount ?? 0),
                  unpackAt: Number(info.unpackAt ?? 0),
                  skinId: info.skinId,
                  businessType: info.businessType,
                });
              }
            });
            conn.on("gift", (raw) => {
              gifts++;
              diamonds += Number(raw?.diamondCount ?? raw?.giftDetails?.diamondCount ?? 0) * Math.max(1, Number(raw?.repeatCount ?? 1));
            });
            await Promise.race([
              conn.connect(t.roomId),
              new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
            ]);
            log(`dinleniyor: @${t.username}`);
            await sleep(LISTEN_SECONDS * 1000);
            await conn.disconnect().catch(() => {});
            if (diamonds > 0 || chests > 0)
              void ingest({ kind: "flow", username: t.username, roomId: t.roomId, diamonds, events: gifts, watchedSeconds: LISTEN_SECONDS });
          } catch (e) {
            log(`@${t.username}: ${e.message}`);
            await sleep(10000);
          }
        }
      }),
    );
  }
}

/* ---------------- 3) YEREL HIZLI DURUM SUNUCUSU (Windows paketi) ---------------- */

function startStatusServer() {
  if (!AGENT_PORT) return;
  const server = http.createServer(async (req, res) => {
    if (req.url?.startsWith("/status.json")) {
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ ...state, backend: BACKEND, autoJoin: AUTO_JOIN, savedAt: new Date().toISOString() }));
      return;
    }
    const rows = (state.chests || [])
      .slice()
      .sort((a, b) => new Date(a.opensAt || 0).getTime() - new Date(b.opensAt || 0).getTime())
      .slice(0, 40)
      .map((c) => {
        const left = c.opensAt ? Math.round((new Date(c.opensAt).getTime() - Date.now()) / 1000) : 0;
        const when = left > 0 ? `${left} sn` : "AÇIK";
        return `<li><a href="https://www.tiktok.com/@${c.username}/live" target="_blank">@${c.username}</a>
          <b>${Number(c.coins || 0).toLocaleString("tr-TR")}</b> jeton · ${c.slots} kişi ·
          oran <b>${c.ratio ?? ratioOf(c)}</b> · <span class="${left > 0 ? "" : "open"}">${when}</span></li>`;
      })
      .join("");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(`<!doctype html><html lang="tr"><meta charset="utf-8">
<title>Arena Agent — hızlı sandık listesi</title>
<style>body{margin:0;background:#06060c;color:#eef;font-family:Segoe UI,system-ui;padding:20px}
h1{font-size:16px;letter-spacing:.16em}h2{font-size:12px;color:#8ff;letter-spacing:.1em}
ul{list-style:none;padding:0;display:grid;gap:6px;grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
li{border:1px solid #ffffff1a;border-radius:10px;padding:10px;font-size:12px;background:#ffffff08}
a{color:#9df9f5;text-decoration:none}b{color:#fff}.open{color:#ff6b8a;font-weight:800}
small{color:#ffffff55}</style>
<h1>ARENA AGENT · YEREL DURUM</h1>
<p><small>Kaynak: ${BACKEND} · mod: ${state.mode} · sandık açma: ${AUTO_JOIN ? "açık" : "kapalı"} ·
son veri: ${state.remoteGeneratedAt ?? "-"} · hata: ${state.lastError || "-"}</small></p>
<h2>SANDIKLAR (${state.chests.length})</h2>
<ul>${rows || "<li>Henüz sandık yok. GitHub taraması 5 dakikada bir yenilenir.</li>"}</ul>
<h2>CANLI YAYINLAR (${state.rooms.length})</h2>
<ul>${(state.rooms || []).slice(0, 40).map((r) => `<li><a href="https://www.tiktok.com/@${r.user || r.username}/live" target="_blank">@${r.user || r.username}</a> · ${Number(r.viewers || 0).toLocaleString("tr-TR")} izleyici</li>`).join("") || "<li>Yok</li>"}</ul>`);
  });
  server.on("error", (e) => log(`durum sunucusu kapalı (${AGENT_PORT}): ${e.message}`));
  server.listen(AGENT_PORT, () => log(`yerel durum: http://localhost:${AGENT_PORT}`));
}

/* ---------------- ana döngü ---------------- */
(async () => {
  log(`backend=${BACKEND} · yerel dinleme=${LOCAL_LISTEN ? "açık" : "kapalı"} · sandık açma=${AUTO_JOIN ? "açık" : "kapalı"}`);
  if (LOCAL_LISTEN) void localListen().catch((e) => log("yerel dinleme hatası:", e.message));
  startStatusServer();
  void sseLoop().catch(() => {});

  // Periyodik GitHub güncelleme kontrolü (açılışta Arena-Live-OS.bat zaten çalıştırır)
  void (async () => {
    while (true) {
      await sleep(UPDATE_CHECK_SECONDS * 1000);
      try {
        const { checkForUpdates } = await import("./update.mjs");
        const result = await checkForUpdates();
        if (result.stale > 0) log(`GitHub'da ${result.stale} dosya değişmiş (v${result.version}) — sonraki açılışta uygulanacak`);
        else log(`güncelleme kontrolü: güncel (v${result.version})`);
      } catch (e) {
        log("güncelleme kontrolü atlandı:", e.message);
      }
    }
  })();

  while (true) {
    const ok = await pullRemote().catch(() => false);
    if (!ok) log("uzaktan veri alınamadı, 10 sn sonra yeniden denenecek");
    await sleep((ok ? POLL_SECONDS : 10) * 1000);
  }
})();
