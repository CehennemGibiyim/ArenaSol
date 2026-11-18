/**
 * TikTok LIVE KEŞİF — GLOBAL BÖLGE KAPSAMI
 * ---------------------------------------------------------------------------
 * "Şimdi tara" tüm ülkeleri kapsar. Her bölge bağımsızdır: biri hata verirse
 * diğeri etkilenmez, sonuç raporu hangi bölgenin çalıştığını gösterir.
 */

export const REGIONS_ALL = [
  // Avrupa
  "TR", "GB", "DE", "FR", "IT", "ES", "PT", "NL", "BE", "AT", "CH", "PL", "CZ",
  "HU", "RO", "BG", "GR", "SE", "NO", "DK", "FI", "IE", "RS", "HR", "SI", "SK",
  "LT", "LV", "EE", "UA", "RU", "MD", "BY", "BA", "AL", "MK", "ME", "XK", "IS",
  // Orta Doğu & Afrika
  "SA", "AE", "EG", "MA", "DZ", "TN", "IQ", "JO", "KW", "QA", "OM", "BH", "YE",
  "IL", "NG", "KE", "GH", "TZ", "UG", "ZA", "ZM", "ZW", "SN", "CI", "CM", "SD",
  // Asya & Pasifik
  "ID", "VN", "TH", "MY", "PH", "SG", "KH", "LA", "MM", "BN", "TL", "IN", "PK",
  "BD", "LK", "NP", "CN", "TW", "HK", "MO", "KR", "JP", "MN", "UZ", "KZ", "AZ",
  "GE", "AM", "AU", "NZ", "FJ", "PG",
  // Amerika
  "US", "CA", "MX", "BR", "AR", "CO", "CL", "PE", "EC", "BO", "PY", "UY", "CR",
  "PA", "DO", "GT", "HN", "SV", "NI", "CU", "PR", "JM", "TT", "GY", "SR", "BZ",
] as const;

export type RegionInfo = {
  region: string;
  ok: boolean;
  rooms: number;
  error: string;
  elapsedMs: number;
};

export type MultiFeedResult = {
  rooms: FeedRoomSummary[];
  regions: RegionInfo[];
  okRegions: string[];
  failedRegions: string[];
  totalRooms: number;
  elapsedMs: number;
  errors: string[];
};

export type FeedRoomSummary = {
  roomId: string;
  user: string;
  nickname: string;
  avatar: string;
  title: string;
  viewers: number;
  thumb: string;
  region: string;
};

/** Bölgesel keşif hatası — diğer bölgeleri etkilemez. */
export class RegionError extends Error {
  constructor(
    public region: string,
    message: string,
  ) {
    super(message);
    this.name = "RegionError";
  }
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36";

async function getJsonWithTimeout(url: string, headers: Record<string, string>, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json", ...headers },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new RegionError("", `HTTP ${response.status}: ${text.slice(0, 160)}`);
    }
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** Tek bölge için EulerStream keşif feed'i */
export async function eulerFeedRegion(
  apiKey: string,
  region: string,
  timeoutMs = 12000,
): Promise<FeedRoomSummary[]> {
  const payload = (await getJsonWithTimeout(
    `https://api.eulerstream.com/webcast/feed?region=${encodeURIComponent(region)}`,
    { "x-api-key": apiKey },
    timeoutMs,
  )) as {
    response?: {
      data?: {
        data?: Array<{
          id_str?: string | number;
          id?: string | number;
          title?: string;
          cover?: { url_list?: string[] };
          owner?: {
            unique_id?: string;
            uniqueId?: string;
            nickname?: string;
            avatar_thumb?: { url_list?: string[] };
            avatarThumb?: { url_list?: string[] };
          };
          stats?: { total_user?: number };
          user_count?: number;
        }>;
      };
    };
    status_code?: number;
  };

  const rows = payload.response?.data?.data ?? [];
  const out: FeedRoomSummary[] = [];
  for (const raw of rows) {
    const owner = raw.owner ?? {};
    const user = owner.unique_id ?? owner.uniqueId ?? "";
    if (!user) continue;
    const firstUrl = (obj?: { url_list?: string[] }) => obj?.url_list?.[0] ?? "";
    out.push({
      roomId: String(raw.id_str ?? raw.id ?? ""),
      user,
      nickname: owner.nickname ?? user,
      avatar: firstUrl(owner.avatar_thumb ?? owner.avatarThumb),
      title: raw.title ?? "",
      viewers: Number(raw.stats?.total_user ?? raw.user_count ?? 0),
      thumb: firstUrl(raw.cover),
      region,
    });
  }
  return out;
}

/**
 * TÜM bölgeleri paralel tarar. Bir bölge hata verse bile diğerleri çalışır.
 * @param concurrency aynı anda sorgulanan bölge sayısı (rate limit için 8 önerilir)
 */
export async function discoverAllRegions(
  apiKey: string,
  options: {
    regions?: string[];
    concurrency?: number;
    timeoutMs?: number;
  } = {},
): Promise<MultiFeedResult> {
  const started = Date.now();
  const regions = options.regions?.length ? options.regions : [...REGIONS_ALL];
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 8, 16));
  const timeoutMs = options.timeoutMs ?? 12000;

  const infos: RegionInfo[] = [];
  const merged = new Map<string, FeedRoomSummary>();

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, regions.length) }, async () => {
    while (cursor < regions.length) {
      const region = regions[cursor];
      cursor += 1;
      if (!region) continue;
      const regionStart = Date.now();
      try {
        const rooms = await eulerFeedRegion(apiKey, region, timeoutMs);
        for (const room of rooms) {
          const key = room.roomId || `${region}:${room.user}`;
          const existing = merged.get(key);
          if (!existing || existing.viewers < room.viewers) merged.set(key, room);
        }
        infos.push({
          region,
          ok: true,
          rooms: rooms.length,
          error: "",
          elapsedMs: Date.now() - regionStart,
        });
      } catch (error) {
        infos.push({
          region,
          ok: false,
          rooms: 0,
          error: (error as Error).message,
          elapsedMs: Date.now() - regionStart,
        });
      }
    }
  });

  await Promise.all(workers);

  const okRegions = infos.filter((info) => info.ok).map((info) => info.region);
  const failedRegions = infos.filter((info) => !info.ok).map((info) => info.region);
  return {
    rooms: [...merged.values()].sort((a, b) => b.viewers - a.viewers),
    regions: infos,
    okRegions,
    failedRegions,
    totalRooms: merged.size,
    elapsedMs: Date.now() - started,
    errors: infos.filter((info) => !info.ok).map((info) => `${info.region}: ${info.error}`),
  };
}

/** Bölgeyi güvenli biçimde Türkçeleştir — UI'da ülke adı olarak gösterilir */
export const REGION_LABELS: Record<string, string> = {
  TR: "Türkiye", US: "ABD", GB: "İngiltere", DE: "Almanya", FR: "Fransa",
  IT: "İtalya", ES: "İspanya", PT: "Portekiz", NL: "Hollanda", BE: "Belçika",
  AT: "Avusturya", CH: "İsviçre", PL: "Polonya", CZ: "Çekya", HU: "Macaristan",
  RO: "Romanya", BG: "Bulgaristan", GR: "Yunanistan", SE: "İsveç", NO: "Norveç",
  DK: "Danimarka", FI: "Finlandiya", IE: "İrlanda", RS: "Sırbistan", HR: "Hırvatistan",
  UA: "Ukrayna", RU: "Rusya", ID: "Endonezya", VN: "Vietnam", TH: "Tayland",
  MY: "Malezya", PH: "Filipinler", SG: "Singapur", IN: "Hindistan", PK: "Pakistan",
  BD: "Bangladeş", LK: "Sri Lanka", CN: "Çin", TW: "Tayvan", HK: "Hong Kong",
  KR: "Güney Kore", JP: "Japonya", SA: "Suudi Arabistan", AE: "BAE", EG: "Mısır",
  MA: "Fas", DZ: "Cezayir", TN: "Tunus", IQ: "Irak", JO: "Ürdün", KW: "Kuveyt",
  QA: "Katar", IL: "İsrail", NG: "Nijerya", KE: "Kenya", GH: "Gana", ZA: "Güney Afrika",
  CA: "Kanada", MX: "Meksika", BR: "Brezilya", AR: "Arjantin", CO: "Kolombiya",
  CL: "Şili", PE: "Peru", EC: "Ekvador", UY: "Uruguay", PY: "Paraguay", BO: "Bolivya",
  AU: "Avustralya", NZ: "Yeni Zelanda", KZ: "Kazakistan", UZ: "Özbekistan", AZ: "Azerbaycan",
  GE: "Gürcistan", AM: "Ermenistan", MN: "Moğolistan", KH: "Kamboçya", LA: "Laos",
  MM: "Myanmar", NP: "Nepal", BA: "Bosna", AL: "Arnavutluk", MK: "K. Makedonya",
  MD: "Moldova", BY: "Belarus", LT: "Litvanya", LV: "Letonya", EE: "Estonya",
  SK: "Slovakya", SI: "Slovenya", PR: "Porto Riko", DO: "Dominik", GT: "Guatemala",
  CR: "Kosta Rika", PA: "Panama", HN: "Honduras", SV: "El Salvador", NI: "Nikaragua",
  CU: "Küba", JM: "Jamaika", TT: "Trinidad", IS: "İzlanda", CIV: "Fildişi", SD: "Sudan",
};

export function regionLabel(code: string): string {
  return REGION_LABELS[code] ?? code;
}

/** Aday havuzu için hızlı ülke özeti */
export function summarizeRegions(infos: RegionInfo[]): {
  total: number;
  ok: number;
  failed: number;
  rooms: number;
  byRegion: Array<{ region: string; label: string; rooms: number; ok: boolean }>;
} {
  return {
    total: infos.length,
    ok: infos.filter((info) => info.ok).length,
    failed: infos.filter((info) => !info.ok).length,
    rooms: infos.reduce((sum, info) => sum + info.rooms, 0),
    byRegion: infos
      .map((info) => ({ region: info.region, label: regionLabel(info.region), rooms: info.rooms, ok: info.ok }))
      .sort((a, b) => b.rooms - a.rooms),
  };
}
