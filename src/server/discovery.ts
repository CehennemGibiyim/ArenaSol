/**
 * TikTok LIVE keşif katmanı — sadece GERÇEK veri.
 *
 * Doğrulanmış çalışan uçlar (imza/anahtar gerekmez):
 *   GET https://www.tiktok.com/api-live/user/room/?aid=1988&uniqueId=...&sourceType=54
 *   GET https://webcast.tiktok.com/webcast/room/check_alive/?aid=1988&room_ids=...
 *   GET https://webcast.tiktok.com/webcast/room/info/?aid=1988&room_id=...
 *
 * Not: /api/search/live/full gibi genel keşif uçları TikTok tarafından imzalı
 * oturum (2483 login) gerektirir; bu yüzden keşif listesi WATCHLIST + pinlenen
 * odalar + EulerStream feed (Business anahtarı) üzerinden kurulur.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

const USER_ROOM = "https://www.tiktok.com/api-live/user/room/";
const CHECK_ALIVE = "https://webcast.tiktok.com/webcast/room/check_alive/";
const ROOM_INFO = "https://webcast.tiktok.com/webcast/room/info/";

const SNSSDK_RE = /snssdk\d*:\/\/live\?.*?room_id=(\d+)/i;
const ROOM_ID_RE = /\broom_id=(\d+)/i;
const URL_USER_RE = /tiktok\.com\/@([A-Za-z0-9._]+)/i;
const HANDLE_RE = /^@?([A-Za-z0-9._]{2,24})$/;

export type LiveTarget = { handle: string; roomId: string };

export function parseLiveTarget(text: string): LiveTarget {
  const raw = (text ?? "").trim();
  if (!raw) throw new Error("boş");
  const snssdk = raw.match(SNSSDK_RE) ?? raw.match(ROOM_ID_RE);
  if (snssdk) return { handle: "", roomId: snssdk[1]! };
  if (/^\d+$/.test(raw)) return { handle: "", roomId: raw };
  const urlUser = raw.match(URL_USER_RE);
  if (urlUser) return { handle: urlUser[1]!, roomId: "" };
  const handle = raw.match(HANDLE_RE);
  if (handle) return { handle: handle[1]!, roomId: "" };
  throw new Error(`anlaşılamadı: ${raw.slice(0, 60)}`);
}

async function getJson(url: string, timeoutMs = 15000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Referer: "https://www.tiktok.com/live",
        "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (!text) throw new Error("boş yanıt");
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

type UserRoomPayload = {
  data?: {
    user?: { roomId?: string; nickname?: string; avatarThumb?: { url_list?: string[] } };
    liveRoom?: { title?: string; status?: number };
  };
  statusCode?: number;
};

export type UserRoomInfo = {
  handle: string;
  roomId: string;
  nickname: string;
  title: string;
  avatar: string;
  status: number | null;
  error: string;
};

export async function userRoom(handle: string, attempts = 2): Promise<UserRoomInfo> {
  const out: UserRoomInfo = {
    handle: handle.replace(/^@+/, "").toLowerCase(),
    roomId: "",
    nickname: "",
    title: "",
    avatar: "",
    status: null,
    error: "",
  };
  const params = new URLSearchParams({ aid: "1988", uniqueId: out.handle, sourceType: "54" });
  let payload: UserRoomPayload | null = null;
  for (let i = 0; i < Math.max(1, attempts); i += 1) {
    try {
      payload = (await getJson(`${USER_ROOM}?${params.toString()}`)) as UserRoomPayload;
      break;
    } catch (error) {
      out.error = (error as Error).message;
      if (i + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, 600 + i * 400));
    }
  }
  if (!payload) return out;
  const data = payload.data ?? {};
  out.roomId = String(data.user?.roomId ?? "");
  out.nickname = data.user?.nickname ?? "";
  out.title = data.liveRoom?.title ?? "";
  out.avatar = data.user?.avatarThumb?.url_list?.[0] ?? "";
  out.status = data.liveRoom?.status ?? null;
  out.error = payload.statusCode && payload.statusCode !== 0 ? `statusCode ${payload.statusCode}` : "";
  return out;
}

export async function checkAlive(roomIds: string[]): Promise<Record<string, boolean>> {
  const ids = roomIds.filter(Boolean);
  const out: Record<string, boolean> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    try {
      const params = new URLSearchParams({ aid: "1988", room_ids: chunk.join(",") });
      const payload = (await getJson(`${CHECK_ALIVE}?${params.toString()}`, 15000)) as {
        data?: Array<{ room_id_str?: string; room_id?: string; alive?: boolean }>;
      };
      const rows = Array.isArray(payload.data) ? payload.data : [];
      for (const row of rows) {
        const rid = String(row.room_id_str ?? row.room_id ?? "");
        if (rid) out[rid] = Boolean(row.alive);
      }
    } catch {
      for (const rid of chunk) out[rid] = out[rid] ?? false;
    }
  }
  return out;
}

export async function roomInfo(roomId: string) {
  try {
    const params = new URLSearchParams({ aid: "1988", room_id: String(roomId) });
    const payload = (await getJson(`${ROOM_INFO}?${params.toString()}`, 15000)) as {
      data?: {
        id_str?: string;
        title?: string;
        user_count?: number;
        owner?: { nickname?: string; avatar_thumb?: { url_list?: string[] } };
        cover?: { url_list?: string[] };
      };
    };
    const data = payload.data ?? {};
    const firstUrl = (obj?: { url_list?: string[] }) => obj?.url_list?.[0] ?? "";
    return {
      roomId: String(data.id_str ?? roomId),
      title: data.title ?? "",
      viewers: Number(data.user_count ?? 0),
      nickname: data.owner?.nickname ?? "",
      avatar: firstUrl(data.owner?.avatar_thumb),
      thumb: firstUrl(data.cover),
    };
  } catch {
    return { roomId: String(roomId), title: "", viewers: 0, nickname: "", avatar: "", thumb: "" };
  }
}

export type LiveCheckResult = {
  target: string;
  handle: string;
  roomId: string;
  live: boolean;
  url: string;
  title: string;
  viewers: number;
  nickname: string;
  avatar: string;
  detail: string;
  source: "web" | "connector";
  checkedAt: string;
};

/** Gerçek canlı kontrol — tahmin yok. */
export async function checkLiveWeb(target: string): Promise<LiveCheckResult> {
  const parsed = parseLiveTarget(target);
  let { handle, roomId } = parsed;
  const out: LiveCheckResult = {
    target,
    handle,
    roomId,
    live: false,
    url: handle ? `https://www.tiktok.com/@${handle}/live` : `https://www.tiktok.com/live?room_id=${roomId}`,
    title: "",
    viewers: 0,
    nickname: "",
    avatar: "",
    detail: "",
    source: "web",
    checkedAt: new Date().toISOString(),
  };
  if (handle && !roomId) {
    const info = await userRoom(handle);
    roomId = info.roomId;
    out.roomId = roomId;
    out.nickname = info.nickname;
    out.title = info.title;
    out.avatar = info.avatar;
    out.detail = info.error;
    if (!roomId) {
      out.detail = out.detail || "hesabın kayıtlı yayını yok";
      return out;
    }
  }
  if (roomId) {
    const alive = await checkAlive([roomId]);
    out.live = Boolean(alive[String(roomId)]);
    if (out.live) {
      const extra = await roomInfo(String(roomId));
      out.title = extra.title || out.title;
      out.viewers = extra.viewers;
      out.nickname = extra.nickname || out.nickname;
      out.avatar = extra.avatar || out.avatar;
      out.url = handle ? `https://www.tiktok.com/@${handle}/live` : out.url;
    } else {
      out.detail = out.detail || "şu an yayında değil";
    }
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  EulerStream keşif feed'i (Business plan)                                   */
/* -------------------------------------------------------------------------- */

export type FeedRoom = {
  roomId: string;
  user: string;
  nickname: string;
  avatar: string;
  title: string;
  viewers: number;
  thumb: string;
  region: string;
};

export class ProviderError extends Error {}

export async function eulerFeed(apiKey: string, region = "TR"): Promise<FeedRoom[]> {
  if (!apiKey) throw new ProviderError("EULER_API_KEY yok");
  const params = new URLSearchParams({ region });
  let payload: { response?: { data?: { data?: Array<Record<string, unknown>> } } };
  try {
    const response = await fetch(`https://api.eulerstream.com/webcast/feed?${params.toString()}`, {
      headers: { "x-api-key": apiKey, "User-Agent": UA },
    });
    if (!response.ok) {
      const body = (await response.text().catch(() => "")).slice(0, 200);
      if (response.status === 401) throw new ProviderError(`401 — Business plan gerekli ya da anahtar geçersiz: ${body}`);
      if (response.status === 429) throw new ProviderError("429 — istek sınırı (rate limit)");
      throw new ProviderError(`HTTP ${response.status}: ${body}`);
    }
    payload = (await response.json()) as typeof payload;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(`${(error as Error).name}: ${(error as Error).message}`);
  }
  const rows = payload.response?.data?.data ?? [];
  const out: FeedRoom[] = [];
  for (const raw of rows) {
    const room = mapFeedRoom(raw, region);
    if (room) out.push(room);
  }
  return out;
}

function mapFeedRoom(raw: Record<string, unknown>, region: string): FeedRoom | null {
  const owner = (raw.owner ?? {}) as Record<string, unknown>;
  const user = String(owner.unique_id ?? owner.uniqueId ?? "");
  if (!user) return null;
  const stats = (raw.stats ?? {}) as Record<string, unknown>;
  const firstUrl = (obj: unknown) => {
    const list = (obj as { url_list?: string[] } | undefined)?.url_list;
    return Array.isArray(list) ? String(list[0] ?? "") : "";
  };
  return {
    roomId: String(raw.id_str ?? raw.id ?? ""),
    user,
    nickname: String(owner.nickname ?? user),
    avatar: firstUrl(owner.avatar_thumb ?? owner.avatarThumb),
    title: String(raw.title ?? ""),
    viewers: Number(stats.total_user ?? raw.user_count ?? 0),
    thumb: firstUrl(raw.cover),
    region,
  };
}

/** TikTok canlı yayın URL'si + mobil derin bağlantı (sadece gerçek roomId ile) */
export function liveUrls(username: string, roomId?: string) {
  const handle = username.replace(/^@+/, "");
  const web = `https://www.tiktok.com/@${handle}/live`;
  const deep = roomId && /^\d{10,20}$/.test(roomId) ? `snssdk1233://live?room_id=${roomId}` : null;
  return { web, deep };
}
