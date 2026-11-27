#!/usr/bin/env node
/**
 * Arena GitHub Actions Collector — 7/24 arka plan tarayıcısı
 * ---------------------------------------------------------------------------
 * Kullanıcı sisteme girmeden de çalışır (GitHub Actions cron, 5 dakikada bir):
 *   1) WATCHLIST + pinlenenler + açık örnek liste + (varsa) EulerStream bölge feed'i
 *   2) oda kimliği bilinen adayları check_alive ile 50'lik gruplar hâlinde doğrula
 *   3) en iyi N odaya kısa WebSocket dinlemesi yap, sandık/çanta zarflarını yakala
 *   4) sonucu docs/data/rooms.json, chests.json ve status.json olarak commit'le
 *
 * Ortam değişkenleri (Actions secrets/variables):
 *   EULER_API_KEY   (opsiyonel, Business feed için)
 *   SIGN_API_KEY    (opsiyonel, yalnızca WS imza kotası; boşsa ücretsiz kota)
 *   WATCHLIST       "@a,@b" (opsiyonel)
 *   MAX_ROOMS       dinlenecek oda sayısı (varsayılan 8)
 *   LISTEN_SECONDS  oda başına dinleme (varsayılan 50)
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "docs", "data");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";
const MAX_ROOMS = Math.max(1, Number(process.env.MAX_ROOMS || 8));
const LISTEN_SECONDS = Math.max(15, Number(process.env.LISTEN_SECONDS || 50));
const REGIONS = (process.env.REGIONS || "TR,US,GB,DE,FR,BR,ID,VN,PH,IN,MX,ES,IT,SA,EG,NG,JP,KR,PK,AZ,AR,PL,NL,RO,UA,MA,DZ,TN,IQ,IR")
  .split(",")
  .map((r) => r.trim().toUpperCase())
  .filter(Boolean);

const log = (...a) => console.log(`[collect ${new Date().toISOString()}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url, headers = {}, timeoutMs = 12000, attempt = 1) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json", Referer: "https://www.tiktok.com/live", ...headers },
      signal: c.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (attempt < 2) {
      await sleep(1200);
      clearTimeout(t);
      return getJson(url, headers, timeoutMs, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function userRoom(handle) {
  try {
    const p = await getJson(`https://www.tiktok.com/api-live/user/room/?aid=1988&uniqueId=${encodeURIComponent(handle)}&sourceType=54`);
    return {
      roomId: String(p?.data?.user?.roomId ?? ""),
      nickname: p?.data?.user?.nickname ?? handle,
      title: p?.data?.liveRoom?.title ?? "",
      viewers: Number(p?.data?.liveRoom?.stats?.total_user ?? p?.data?.liveRoom?.user_count ?? 0),
    };
  } catch {
    return { roomId: "", nickname: handle, title: "", viewers: 0 };
  }
}

async function checkAlive(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const p = await getJson(`https://webcast.tiktok.com/webcast/room/check_alive/?aid=1988&room_ids=${chunk.join(",")}`);
      for (const row of p?.data ?? []) {
        const id = String(row.room_id_str ?? row.room_id ?? "");
        if (id) out[id] = Boolean(row.alive);
      }
    } catch {
      /* yoksay */
    }
  }
  return out;
}

async function publicSample() {
  try {
    const p = await getJson("https://api.tik.tools/api/live/top-channels");
    return (Array.isArray(p?.channels) ? p.channels : []).slice(0, 10).map((c) => ({
      user: String(c.uniqueId ?? "").replace(/^@/, ""),
      roomId: String(c.roomId ?? ""),
      nickname: String(c.displayName ?? ""),
      region: String(c.region ?? ""),
      viewers: Number(c.viewerCount ?? c.viewers ?? 0),
    }));
  } catch {
    return [];
  }
}

async function eulerFeed(key, regions) {
  const rooms = [];
  await Promise.all(
    regions.slice(0, 30).map(async (region) => {
      try {
        const p = await getJson(`https://api.eulerstream.com/webcast/feed?region=${region}`, { "x-api-key": key });
        for (const raw of p?.response?.data?.data ?? []) {
          const user = raw?.owner?.unique_id ?? raw?.owner?.uniqueId;
          if (!user) continue;
          rooms.push({
            user: String(user),
            roomId: String(raw.id_str ?? raw.id ?? ""),
            nickname: String(raw.owner?.nickname ?? user),
            title: String(raw.title ?? ""),
            viewers: Number(raw.stats?.total_user ?? raw.user_count ?? 0),
            region,
          });
        }
      } catch {
        /* bölge hatası diğerini etkilemez */
      }
    }),
  );
  return rooms;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(path.join(DATA, file), "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  const startedAt = Date.now();
  const previousRooms = await readJson("rooms.json", { rooms: [] });
  const previousChests = await readJson("chests.json", { chests: [] });

  const watchlist = (process.env.WATCHLIST || "")
    .split(",")
    .map((x) => x.trim().replace(/^@+/, ""))
    .filter(Boolean);
  const pinned = (previousRooms?.rooms ?? []).map((r) => r.user || r.username).filter(Boolean);
  // Önceki turun geri çekme durumu (checkMisses / nextCheckAt) korunur.
  const previousByName = new Map();
  for (const room of previousRooms?.rooms ?? []) {
    const user = String(room?.user || room?.username || "").replace(/^@+/, "").toLowerCase();
    if (user) previousByName.set(user, room);
  }

  const candidates = new Map();
  for (const user of [...watchlist, ...pinned])
    if (/^[\w.]{2,24}$/.test(user)) candidates.set(user.toLowerCase(), { user, source: "watchlist" });
  for (const room of await publicSample())
    if (/^[\w.]{2,24}$/.test(room.user)) candidates.set(room.user.toLowerCase(), { ...room, source: "public-sample" });

  const eulerKey = (process.env.EULER_API_KEY || "").trim();
  const signKey = (process.env.SIGN_API_KEY || "").trim() || eulerKey;
  if (eulerKey) {
    for (const room of await eulerFeed(eulerKey, REGIONS)) {
      if (/^[\w.]{2,24}$/.test(room.user)) candidates.set(room.user.toLowerCase(), { ...room, source: "euler" });
    }
  }

  /* --- Toplu anahtarsız doğrulama -----------------------------------------
   * Oda kimliği bilinen adaylar tek `check_alive` isteğiyle 50'li gruplar
   * hâlinde sorulur; hesap başına `user/room` çağrısı harcanmaz. Yayında
   * olmadığı doğrulanan adaya artan aralıklı yeniden deneme zamanı yazılır
   * (2 → 4 → 8 → 15 → 30 → 60 dk) ve o zamana kadar atlanır.
   */
  const BACKOFF_MINUTES = [2, 4, 8, 15, 30, 60];
  const ROOM_ID = /^\d{10,20}$/;
  const list = [...candidates.values()];
  const now = Date.now();
  for (const [name, state] of previousByName) {
    const c = candidates.get(name);
    if (!c) continue;
    if (state?.checkMisses) c.checkMisses = Number(state.checkMisses) || 0;
    if (state?.nextCheckAt) c.nextCheckAt = String(state.nextCheckAt);
  }

  // 1) Oda kimliği bilinmeyen adlar çözülür (en fazla 10 paralel istek).
  const unresolved = list.filter((c) => !ROOM_ID.test(c.roomId || ""));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(10, unresolved.length || 1) }, async () => {
      while (cursor < unresolved.length) {
        const c = unresolved[cursor++];
        if (!c) break;
        try {
          const info = await userRoom(c.user);
          if (info.roomId) {
            c.roomId = info.roomId;
            c.nickname = info.nickname || c.nickname || c.user;
            c.title = info.title || c.title || "";
            c.viewers = Number(info.viewers || c.viewers || 0);
          }
        } catch {
          /* tek hesap hatası */
        }
      }
    }),
  );

  // 2) Geri çekilmiş adaylar atlanır; hiçbiri sırası gelmemişse en yakın 20'si denenir.
  const ready = list.filter((c) => ROOM_ID.test(c.roomId || ""));
  const due = ready.filter((c) => !c.nextCheckAt || new Date(c.nextCheckAt).getTime() <= now);
  const dueSet = new Set(due);
  const deferred = ready
    .filter((c) => !dueSet.has(c))
    .sort((a, b) => new Date(a.nextCheckAt || 0).getTime() - new Date(b.nextCheckAt || 0).getTime());
  const batch = due.length ? due : deferred.slice(0, 20);

  // 3) check_alive: tek istekte 50 oda kimliği.
  const aliveMap = batch.length ? await checkAlive(batch.map((c) => c.roomId)) : {};
  const live = [];
  const checkedUsers = new Set();
  for (const c of batch) {
    const user = String(c.user).toLowerCase();
    checkedUsers.add(user);
    if (aliveMap[c.roomId]) {
      c.checkMisses = 0;
      c.nextCheckAt = null;
      live.push({
        user: c.user,
        roomId: c.roomId,
        nickname: c.nickname || c.user,
        title: c.title || "",
        region: c.region || "",
        source: c.source,
        viewers: Number(c.viewers || 0),
        checkMisses: 0,
        nextCheckAt: null,
        checkedAt: new Date().toISOString(),
        url: `https://www.tiktok.com/@${c.user}/live`,
      });
    } else {
      const misses = Math.min(6, Number(c.checkMisses || 0) + 1);
      c.checkMisses = misses;
      c.nextCheckAt = new Date(now + BACKOFF_MINUTES[misses - 1] * 60000).toISOString();
    }
  }
  live.sort((a, b) => b.viewers - a.viewers);

  // Çevrimdışı havuzu koru: önceki turlarda doğrulanan yayıncılar veride kalır.
  // Yayına geçtiklerinde aday listesinde oldukları için bir sonraki tur onları yakalar.
  const RETENTION_MS = 7 * 24 * 3600 * 1000;
  const liveUsers = new Set(live.map((room) => String(room.user || room.username).toLowerCase()));
  const retained = (previousRooms?.rooms ?? [])
    .filter((room) => room?.user && !liveUsers.has(String(room.user).toLowerCase()))
    .map((room) => {
      const user = String(room.user || "").replace(/^@+/, "").toLowerCase();
      const c = candidates.get(user);
      // Bu turda geri çekildiği için atlanan oda eski durumunu korur.
      if (c && !checkedUsers.has(user)) return { ...room };
      return {
        ...room,
        live: false,
        checkMisses: Number(c?.checkMisses ?? room.checkMisses ?? 0) || 0,
        nextCheckAt: c?.nextCheckAt ?? room.nextCheckAt ?? null,
        lastSeenAt: room.lastSeenAt || room.checkedAt || new Date().toISOString(),
        checkedAt: new Date().toISOString(),
      };
    })
    .filter((room) => Date.now() - new Date(room.lastSeenAt).getTime() < RETENTION_MS);
  const roomsOut = [
    ...live.map((room) => ({ ...room, live: true, lastSeenAt: room.checkedAt })),
    ...retained,
  ];

  // Kısa dinleme: sandık zarflarını yakala
  const freshChests = [];
  const seen = new Set((previousChests?.chests ?? []).map((c) => c.envelopeId).filter(Boolean));
  try {
    const mod = await import("tiktok-live-connector");
    await Promise.all(
      live.slice(0, MAX_ROOMS).map(async (room) => {
        try {
          const conn = new mod.TikTokLiveConnection(room.user, {
            processInitialData: false,
            enableExtendedGiftInfo: false,
            signApiKey: signKey || undefined,
          });
          conn.on("envelope", (raw) => {
            const info = raw?.envelopeInfo;
            if (!info?.envelopeId || seen.has(info.envelopeId)) return;
            seen.add(info.envelopeId);
            const coins = Number(info.diamondCount ?? 0);
            const slots = Number(info.peopleCount ?? 0);
            if (coins <= 0 || slots <= 0) return;
            const opens = Number(info.unpackAt ?? 0);
            const opensMs = opens < 1e12 ? opens * 1000 : opens;
            freshChests.push({
              envelopeId: String(info.envelopeId),
              username: room.user,
              roomId: room.roomId,
              nickname: room.nickname,
              coins,
              slots,
              ratio: Math.round((coins / Math.max(1, slots)) * 100) / 100,
              opensAt: new Date(opensMs > 0 ? opensMs : Date.now() + 180000).toISOString(),
              detectedAt: new Date().toISOString(),
              skinId: Number(info.skinId ?? 1),
              source: "actions-collector",
              url: `https://www.tiktok.com/@${room.user}/live`,
            });
          });
          await Promise.race([
            conn.connect(room.roomId),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 15000)),
          ]);
          await sleep(LISTEN_SECONDS * 1000);
          await conn.disconnect().catch(() => {});
        } catch (e) {
          log(`${room.user}: ${e.message}`);
        }
      }),
    );
  } catch {
    log("connector yok — yalnızca keşif yapıldı");
  }

  // Önceki turlardan kalan, süresi geçmemiş sandıklar korunur (5 dk'lık tur aralığı kaçmasın)
  const cutoff = Date.now() - 120_000;
  const byId = new Map();
  for (const chest of [...(previousChests?.chests ?? []), ...freshChests]) {
    const key = String(chest.envelopeId || `${chest.username}:${chest.opensAt}`);
    byId.set(key, { ...(byId.get(key) || {}), ...chest });
  }
  const activeChests = [...byId.values()]
    .filter((c) => !c.opensAt || new Date(c.opensAt).getTime() > cutoff)
    .sort((a, b) => new Date(a.opensAt || 0).getTime() - new Date(b.opensAt || 0).getTime());

  const generatedAt = new Date().toISOString();
  await mkdir(DATA, { recursive: true });
  await writeFile(
    path.join(DATA, "rooms.json"),
    JSON.stringify(
      {
        generatedAt,
        source: eulerKey ? "euler+watchlist+public" : "watchlist+public-sample",
        eulerKey: Boolean(eulerKey),
        checked: checkedUsers.size,
        deferredCount: ready.length - batch.length,
        liveCount: live.length,
        retainedCount: retained.length,
        totalKnown: roomsOut.length,
        rooms: roomsOut,
      },
      null,
      2,
    ),
  );
  await writeFile(
    path.join(DATA, "chests.json"),
    JSON.stringify({ generatedAt, count: activeChests.length, chests: activeChests }, null, 2),
  );
  await writeFile(
    path.join(DATA, "status.json"),
    JSON.stringify(
      {
        generatedAt,
        ok: true,
        durationMs: Date.now() - startedAt,
        nextRunInSeconds: 300,
        candidates: list.length,
        checked: checkedUsers.size,
        deferred: ready.length - batch.length,
        liveRooms: live.length,
        activeChests: activeChests.length,
        autoJoin: true,
        source: eulerKey ? "euler+watchlist+public" : "watchlist+public-sample",
        note: "GitHub Actions taraması — kullanıcı paneli kapalı olsa da çalışır.",
      },
      null,
      2,
    ),
  );
  log(`tamam: ${checkedUsers.size} kontrol (${ready.length - batch.length} geri çekilmiş) · ${live.length} canlı · ${activeChests.length} aktif sandık`);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await mkdir(DATA, { recursive: true });
    await writeFile(
      path.join(DATA, "status.json"),
      JSON.stringify({ generatedAt: new Date().toISOString(), ok: false, error: String(e?.message || e) }, null, 2),
    );
  } catch {
    /* yoksay */
  }
  process.exit(1);
});
