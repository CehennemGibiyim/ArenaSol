/**
 * TikTok erişim katmanı.
 *
 * LiveMira (dichvu321.com/live) sistemi tamamen bu üç adım üzerinde çalışır:
 *
 *   1) KEŞİF  : https://www.tiktok.com/api-live/user/room/?aid=1988&uniqueId=...
 *               -> roomId, liveRoom.status, liveRoom.startTime, liveRoomStats.userCount
 *   2) KONTROL: https://webcast.tiktok.com/webcast/room/check_alive/?aid=1988&room_ids=...
 *   3) DİNLEME: canlı odaya imzalı WebSocket (im/fetch) bağlanıp
 *               WebcastGiftMessage + WebcastEnvelopeMessage olaylarını okumak.
 *
 * 1 ve 2 numaralı adımlar herhangi bir anahtar gerektirmez; kendi sunucumuzda
 * ücretsiz çalışır. 3 numaralı adım için TikTok artık imzalı bağlantı istediği
 * için opsiyonel bir imza anahtarı (SIGN_API_KEY) tanımlanabilir; tanımlanmazsa
 * sistem otomatik olarak "manuel toplama" moduna düşer (uygulama tamamen
 * kullanılabilir kalır).
 */

const WEB_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const DEFAULT_TIMEOUT = 15000;

export interface RoomSnapshot {
  uniqueId: string;
  nickname: string | null;
  avatarUrl: string | null;
  secUid: string | null;
  roomId: string | null;
  status: number | null;
  isLive: boolean;
  startTime: number | null; // saniye
  viewers: number;
  title: string | null;
  followers: number;
  liveUrl: string;
}

export interface RawEvent {
  type: string;
  payload: unknown;
}

export interface RoomConnection {
  disconnect: () => void;
}

function liveUrl(uniqueId: string) {
  return `https://www.tiktok.com/@${uniqueId}/live`;
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<{ ok: boolean; status: number; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": WEB_UA,
        Accept: "text/html,application/json,application/protobuf",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.tiktok.com/",
        Origin: "https://www.tiktok.com",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

/** Kullanıcı adının yayın durumunu ve oda bilgisini getirir. */
/**
 * HTML yedeği (gotiktoklive ve TikTok-Live-Connector ile aynı strateji):
 * api-live uç noktası rate-limit yediğinde kullanıcı sayfasındaki `roomId`
 * değeri çekilir ve oda `check_alive` ile doğrulanır.
 */
export async function fetchRoomIdFromHtml(
  uniqueId: string,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<string | null> {
  const res = await fetchWithTimeout(`https://www.tiktok.com/@${uniqueId}/live`, timeoutMs);
  if (!res.ok || !res.text) return null;
  const html = res.text;
  for (const re of [
    /"roomId"\s*:\s*"(\d{10,25})"/,
    /roomId["']?\s*[:=]\s*["']?(\d{10,25})/,
    /"room_id"\s*:\s*["']?(\d{10,25})/,
  ]) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

/**
 * TikTok'un gerçek jeton (coin) fiyat listesi — `webcast/diamond/` uç noktası.
 * Collector kütüphanelerinde (gotiktoklive `GetPriceList`) karşılığı olan bu uç
 * nokta paketleri ve USD birim fiyatını döndürür; gelir motoru gerçek fiyatla çalışır.
 */
export async function fetchDiamondPrices(
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<{
  packages: { coins: number; usd: number; label: string }[];
  unitPriceUsd: number;
  fetchedAt: string;
} | null> {
  const url =
    "https://webcast.tiktok.com/webcast/diamond/?aid=1988&app_name=tiktok_web&device_platform=web&channel=tiktok_web&live_id=12";
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok || !res.text) return null;
  try {
    const json = JSON.parse(res.text) as {
      data?: {
        diamond_count?: number;
        describe?: string;
        currency_price?: { currency?: string; price?: number; price_dot?: number }[];
      }[];
    };
    const packages: { coins: number; usd: number; label: string }[] = [];
    for (const p of json.data ?? []) {
      const coins = p.diamond_count ?? 0;
      const cp = (p.currency_price ?? []).find((c) => c.currency === "USD") ?? p.currency_price?.[0];
      if (!cp || coins <= 0) continue;
      const dot = cp.price_dot ?? 2;
      const usd = Number(((cp.price ?? 0) / Math.pow(10, dot)).toFixed(6));
      if (usd <= 0) continue;
      packages.push({ coins, usd, label: p.describe ?? `${coins} coin` });
    }
    if (packages.length === 0) return null;
    const biggest = [...packages].sort((a, b) => b.coins - a.coins)[0];
    return {
      packages,
      unitPriceUsd: Number((biggest.usd / biggest.coins).toFixed(6)),
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function fetchRoomSnapshot(
  uniqueId: string,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<RoomSnapshot | null> {
  const url = `https://www.tiktok.com/api-live/user/room/?aid=1988&uniqueId=${encodeURIComponent(
    uniqueId,
  )}&sourceType=54`;
  const res = await fetchWithTimeout(url, timeoutMs);
  if (res.ok && res.text) {
    try {
      const json = JSON.parse(res.text) as {
        statusCode?: number;
        data?: {
          user?: Record<string, unknown>;
          stats?: Record<string, unknown>;
          liveRoom?: Record<string, unknown>;
        };
      };
      const user = json.data?.user ?? {};
      const room = json.data?.liveRoom ?? {};
      const stats = (room.liveRoomStats ?? {}) as Record<string, unknown>;
      const status = typeof room.status === "number" ? room.status : null;
      const roomId = (user.roomId as string) ?? (room.roomId as string) ?? null;
      const followerCount = json.data?.stats?.followerCount;
      return {
        uniqueId,
        nickname: (user.nickname as string) ?? null,
        avatarUrl: (user.avatarMedium as string) ?? (user.avatarThumb as string) ?? null,
        secUid: (user.secUid as string) ?? null,
        roomId: roomId ? String(roomId) : null,
        status,
        isLive: status === 2,
        startTime:
          typeof room.startTime === "number" && room.startTime > 0 ? room.startTime : null,
        viewers: typeof stats.userCount === "number" ? stats.userCount : 0,
        title: typeof room.title === "string" && room.title.length > 0 ? room.title : null,
        followers: typeof followerCount === "number" ? followerCount : 0,
        liveUrl: liveUrl(uniqueId),
      };
    } catch {
      /* HTML yedeğine düş */
    }
  }

  // ---- Yedek strateji: HTML roomId + check_alive ----
  const htmlRoomId = await fetchRoomIdFromHtml(uniqueId, timeoutMs);
  if (!htmlRoomId) return null;
  const alive = await checkAlive([htmlRoomId], timeoutMs);
  const isLive = Boolean(alive[htmlRoomId]);
  return {
    uniqueId,
    nickname: null,
    avatarUrl: null,
    secUid: null,
    roomId: htmlRoomId,
    status: isLive ? 2 : 4,
    isLive,
    startTime: null,
    viewers: 0,
    title: null,
    followers: 0,
    liveUrl: liveUrl(uniqueId),
  };
}

/** Verilen room id'lerinin canlı olup olmadığını toplu sorgular. */
export async function checkAlive(
  roomIds: string[],
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<Record<string, boolean>> {
  if (roomIds.length === 0) return {};
  const url = `https://webcast.tiktok.com/webcast/room/check_alive/?aid=1988&room_ids=${roomIds.join(
    ",",
  )}`;
  const res = await fetchWithTimeout(url, timeoutMs);
  const out: Record<string, boolean> = {};
  if (!res.ok) return out;
  try {
    const json = JSON.parse(res.text) as {
      data?: { alive?: boolean; room_id_str?: string }[];
    };
    for (const row of json.data ?? []) {
      if (row.room_id_str) out[row.room_id_str] = Boolean(row.alive);
    }
  } catch {
    /* yoksay */
  }
  return out;
}

/** Kullanıcı adının gerçekten var olup olmadığını oEmbed ile doğrular. */
export async function oembedValidate(
  uniqueId: string,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<{ ok: boolean; authorName: string | null; authorUrl: string | null }> {
  const url = `https://www.tiktok.com/oembed?url=${encodeURIComponent(
    `https://www.tiktok.com/@${uniqueId}`,
  )}`;
  const res = await fetchWithTimeout(url, timeoutMs);
  if (!res.ok) return { ok: false, authorName: null, authorUrl: null };
  try {
    const json = JSON.parse(res.text) as { author_name?: string; author_url?: string };
    if (!json.author_name) return { ok: false, authorName: null, authorUrl: null };
    return { ok: true, authorName: json.author_name, authorUrl: json.author_url ?? null };
  } catch {
    return { ok: false, authorName: null, authorUrl: null };
  }
}

/** Odadaki hediye kataloğu (sandık hedeflerini adlandırmak için). */
export async function fetchRoomGifts(
  roomId: string,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<Record<string, { name: string; diamondCount: number }>> {
  const url = `https://webcast.tiktok.com/webcast/gift/list/?aid=1988&room_id=${roomId}&version_code=180809&version_name=18.8.9&device_platform=web&channel=tiktok_web`;
  const res = await fetchWithTimeout(url, timeoutMs);
  const out: Record<string, { name: string; diamondCount: number }> = {};
  if (!res.ok) return out;
  try {
    const json = JSON.parse(res.text) as {
      data?: { gifts?: { id?: number; name?: string; diamondCount?: number }[] };
    };
    for (const g of json.data?.gifts ?? []) {
      if (g.id !== undefined) {
        out[String(g.id)] = { name: g.name ?? "hediye", diamondCount: g.diamondCount ?? 0 };
      }
    }
  } catch {
    /* yoksay */
  }
  return out;
}

/**
 * Canlı odaya WebSocket bağlanır.
 * Bağlantı için imza anahtarı gerekir (SIGN_API_KEY). Anahtar yoksa null döner.
 */
export async function connectToRoom(params: {
  uniqueId: string;
  roomId: string;
  onEvent: (event: RawEvent) => void;
  onStatus?: (status: string, detail?: string) => void;
  signApiKey?: string;
  sessionId?: string;
}): Promise<RoomConnection | null> {
  if (!params.signApiKey) {
    params.onStatus?.("no-signer", "Imza anahtari tanimli degil");
    return null;
  }
  try {
    const mod = (await import("tiktok-live-connector")) as {
      TikTokLiveConnection: new (
        uniqueId: string,
        options: Record<string, unknown>,
      ) => {
        on: (event: string, cb: (data: unknown) => void) => void;
        connect: () => Promise<unknown>;
        disconnect: () => Promise<void> | void;
      };
    };
    const conn = new mod.TikTokLiveConnection(params.uniqueId, {
      signApiKey: params.signApiKey,
      session: params.sessionId ? { cookie: `sessionid=${params.sessionId}` } : undefined,
      fetchRoomInfoOnConnect: false,
      processInitialData: true,
      enableExtendedGiftInfo: true,
    });

    const forward = (type: string) => (data: unknown) => params.onEvent({ type, payload: data });
    const events = ["gift", "envelope", "chat", "like", "member", "roomUser", "social", "system", "control"];
    for (const ev of events) conn.on(ev, forward(ev));
    conn.on("streamEnd", () => params.onStatus?.("stream-end"));
    conn.on("disconnected", () => params.onStatus?.("disconnected"));
    conn.on("error", (err: unknown) =>
      params.onStatus?.("error", err instanceof Error ? err.message : String(err)),
    );

    await conn.connect();
    params.onStatus?.("connected");
    return {
      disconnect: () => {
        void conn.disconnect();
      },
    };
  } catch (err) {
    params.onStatus?.("error", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export const tiktokUserAgent = WEB_UA;
