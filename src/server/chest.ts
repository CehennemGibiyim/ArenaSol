import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, chests, roomFlows, type Chest, type RoomFlow } from "@/db/schema";
import { EventEmitter } from "node:events";
import { sendNotification } from "@/server/notify";

/** Yeni sandık anında SSE abonelerine itilir (Windows agent gecikmesiz alır). */
export const chestEvents = new EventEmitter();
chestEvents.setMaxListeners(50);

/* -------------------------------------------------------------------------- */
/*  Sabitler — sandikradar / LiveMira ile ayni tanimlar                        */
/* -------------------------------------------------------------------------- */

/** skin_id -> (kind, variant) */
export const SKIN_KINDS: Record<number, { kind: string; variant: string }> = {
  1: { kind: "chest", variant: "normal" },
  2: { kind: "chest", variant: "gold" },
  3: { kind: "chest", variant: "hanging" },
};

/** businessType -> ad (tik.tools dokumani) */
export const BUSINESS_TYPES: Record<number, string> = {
  1: "coins",
  19: "super_fan_box",
  20: "spark_box",
};

/**
 * LiveMira sekmelerinin TAMAMI (Plus/Pro kilitleri kaldırıldı).
 * "20/16" = 20+ jeton ve en fazla 16 kontenjan -> kişi başı pay yüksek sandıklar.
 */
export const TABS = [
  { id: "chest", label: "Sandık", filter: { kind: "chest" } },
  { id: "ratio1", label: "Oran ≥ 1", filter: { kind: "chest", min_ratio: 1 } },
  { id: "ratio2", label: "Oran ≥ 2", filter: { kind: "chest", min_ratio: 2 } },
  { id: "ratio4", label: "Oran ≥ 4", filter: { kind: "chest", min_ratio: 4 } },
  { id: "kismet", label: "Kısmet ≥ 7", filter: { kind: "chest", min_ratio: 7 } },
  { id: "s2016", label: "20/16 sandık", filter: { kind: "chest", min_coins: 20, max_slots: 16 } },
  { id: "gold", label: "Altın sandık", filter: { kind: "chest", variants: ["gold"] } },
  { id: "hanging", label: "Askıda sandık", filter: { kind: "chest", variants: ["hanging"] } },
  { id: "large", label: "Büyük (≥500)", filter: { min_coins: 500 } },
  { id: "bag", label: "Tüm çantalar", filter: { kind: "bag" } },
  { id: "bagL010", label: "Çanta Lv 0–10", filter: { kind: "bag", levels: ["l0","l1","l2","l3","l4","l5","l6","l7","l8","l9","l10"] } },
  { id: "bagL0", label: "Çanta Lv 0", filter: { kind: "bag", levels: ["l0"] } },
  { id: "bagL1", label: "Çanta Lv 1", filter: { kind: "bag", levels: ["l1"] } },
  { id: "bagL210", label: "Çanta Lv 2–10", filter: { kind: "bag", levels: ["l2","l3","l4","l5","l6","l7","l8","l9","l10"] } },
  { id: "flow", label: "Jeton akışı", filter: { kind: "live" } },
  { id: "all", label: "Tümü", filter: {} },
] as const;

/* -------------------------------------------------------------------------- */
/*  Turetilmis alanlar                                                         */
/* -------------------------------------------------------------------------- */

export type DerivedChest = Chest & {
  ratio: number;
  secondsLeft: number;
  delta: number;
  derivedStatus: "open" | "upcoming" | "expired" | "claimed";
  viewersLtSlots: boolean;
  hasEnvelope: boolean;
};

export function deriveChest(chest: Chest, nowMs = Date.now()): DerivedChest {
  const coins = Number(chest.coins ?? 0);
  const slots = Math.max(1, Number(chest.slots ?? 1));
  const opensAt = chest.opensAt ? new Date(chest.opensAt).getTime() : 0;
  const left = Math.max(0, opensAt - nowMs);
  // LiveMira resmi oran formülü: jeton / kontenjan (500 jeton ÷ 100 kişi = 5)
  const ratio = Math.round((coins / slots) * 100) / 100;
  const derivedStatus =
    chest.status === "claimed" || chest.status === "expired"
      ? chest.status
      : left <= 0
        ? "open"
        : "upcoming";
  return {
    ...chest,
    ratio,
    secondsLeft: Math.round(left / 1000),
    delta: Math.round((opensAt - nowMs) / 1000),
    derivedStatus,
    viewersLtSlots: Number(chest.viewers ?? 0) < slots,
    hasEnvelope: Boolean(chest.envelopeId),
  };
}

export type DerivedFlow = RoomFlow & {
  ratio: number;
  derivedStatus: "open";
  secondsLeft: number;
  delta: number;
  viewersLtSlots: boolean;
  hasEnvelope: boolean;
  kind: "live";
  variant: "flow";
  coins: number;
  slots: number;
  joined: number;
  opensAt: string;
};

export function deriveFlow(flow: RoomFlow): DerivedFlow {
  return {
    ...flow,
    kind: "live",
    variant: "flow",
    coins: 0, // Gift diamonds are not chest coins.
    slots: Math.max(1, flow.senders),
    joined: 0,
    opensAt: new Date().toISOString(),
    // Jeton akışında "oran" = gönderen başına jeton
    ratio: 0, // No chest prize, so no chest ratio.
    secondsLeft: 0,
    delta: 0,
    derivedStatus: "open",
    viewersLtSlots: flow.viewers < Math.max(1, flow.senders),
    hasEnvelope: flow.hasEnvelope,
  };
}

/* -------------------------------------------------------------------------- */
/*  Zarf alanlari -> sandik kaydi                                              */
/* -------------------------------------------------------------------------- */

export type EnvelopeFields = {
  envelopeId?: string;
  roomId?: string;
  diamondCount?: number;
  peopleCount?: number;
  unpackAt?: number;
  skinId?: number;
  businessType?: number;
  sendUserName?: string;
  sendUserId?: string;
  createAt?: string;
};

export type RoomMeta = {
  username: string;
  nickname?: string;
  title?: string;
  avatar?: string;
  roomId?: string;
  viewers?: number;
};

/** tiktok-live-connector WebcastEnvelopeMessage.envelopeInfo -> sandik kaydi */
export function chestFromEnvelope(fields: EnvelopeFields, meta: RoomMeta): {
  envelopeId: string;
  roomId: string;
  username: string;
  nickname: string;
  title: string;
  avatar: string;
  kind: string;
  variant: string;
  skinId: number;
  businessType: number;
  coins: number;
  slots: number;
  viewers: number;
  opensAt: Date;
} | null {
  const coins = Number(fields.diamondCount);
  const slots = Number(fields.peopleCount);
  const unpackAt = Number(fields.unpackAt);
  const opensMs = unpackAt < 1e12 ? unpackAt * 1000 : unpackAt;
  if (!fields.envelopeId || !Number.isSafeInteger(coins) || coins <= 0 || !Number.isSafeInteger(slots) || slots <= 0 ||
      !Number.isFinite(opensMs) || opensMs < Date.now() - 60_000 || opensMs > Date.now() + 86_400_000) return null;
  const skinId = Number(fields.skinId ?? 1);
  const mapped = skinId === 0 ? { kind: "bag", variant: "l0" } : SKIN_KINDS[skinId] ?? { kind: "chest", variant: "normal" };
  return {
    envelopeId: String(fields.envelopeId ?? ""),
    roomId: String(fields.roomId ?? meta.roomId ?? ""),
    username: meta.username.replace(/^@+/, ""),
    nickname: meta.nickname ?? meta.username,
    title: meta.title ?? "",
    avatar: meta.avatar ?? "",
    kind: mapped.kind,
    variant: mapped.variant,
    skinId,
    businessType: Number(fields.businessType ?? 1),
    coins,
    slots: Math.max(1, slots),
    viewers: Number(meta.viewers ?? 0),
    opensAt: new Date(opensMs),
  };
}

/** Yeni sandik tespitini DB'ye yaz, Telegram/Discord uyarisi gonder */
export async function recordChest(
  fields: EnvelopeFields,
  meta: RoomMeta,
  source: "connector" | "demo" | "euler" = "connector",
): Promise<Chest | null> {
  const parsed = chestFromEnvelope(fields, meta);
  if (!parsed) return null;

  const [chest] = await db
    .insert(chests)
    .values({ ...parsed, source, status: "upcoming" })
    .onConflictDoNothing()
    .returning();
  // A repeated WS/room-info message is not a new prize, even across processes.
  if (!chest) return null;

  await db
    .update(roomFlows)
    .set({ hasEnvelope: true, envelopeId: chest.envelopeId, updatedAt: new Date() })
    .where(eq(roomFlows.username, chest.username));

  await db.insert(activityLog).values({
    kind: "chest",
    message: `🎁 Sandık tespit edildi: @${chest.username} · ${chest.coins} jeton / ${chest.slots} kişi · oran ${deriveChest(chest).ratio}`,
    meta: { chestId: chest.id, envelopeId: chest.envelopeId, coins: chest.coins, slots: chest.slots },
  });

  chestEvents.emit("chest", deriveChest(chest));
  const derived = deriveChest(chest);
  if (derived.ratio >= 1 || chest.coins >= 500) {
    void sendNotification(formatChestAlert(derived), `sandik-${chest.variant}`).catch(() => null);
  }

  return chest;
}

export function formatChestAlert(chest: DerivedChest): string {
  const kindLabel = chest.kind === "bag" ? "👜 Çanta" : chest.variant === "gold" ? "🏆 Altın sandık" : "🎁 Sandık";
  const left = chest.secondsLeft;
  const when = left <= 0 ? "şimdi açık" : left < 60 ? `${left} sn sonra` : `${Math.floor(left / 60)} dk ${left % 60} sn sonra`;
  return [
    `<b>${kindLabel}</b> · ${chest.coins.toLocaleString("tr-TR")} jeton · oran ${chest.ratio}`,
    `@${chest.username} — ${chest.viewers.toLocaleString("tr-TR")} izleyici · kontenjan ${chest.slots}`,
    `⏱ ${when}`,
    `https://www.tiktok.com/@${chest.username}/live`,
  ].join("\n");
}

/* -------------------------------------------------------------------------- */
/*  GiftFlow — combo duyarli jeton akisi (sandikradar ile ayni)                */
/* -------------------------------------------------------------------------- */

type FlowState = {
  diamonds: number;
  events: number;
  senders: Set<string>;
  top: Map<string, number>;
  combo: Map<string, number>;
  firstAt: number;
  lastAt: number;
  meta: RoomMeta;
  envelopeId: string;
};

export class GiftFlow {
  private rooms = new Map<string, FlowState>();

  touch(key: string, meta: RoomMeta): FlowState {
    let state = this.rooms.get(key);
    if (!state) {
      state = {
        diamonds: 0,
        events: 0,
        senders: new Set(),
        top: new Map(),
        combo: new Map(),
        firstAt: 0,
        lastAt: 0,
        meta,
        envelopeId: "",
      };
      this.rooms.set(key, state);
    } else {
      state.meta = { ...state.meta, ...meta };
    }
    return state;
  }

  addGift(
    key: string,
    meta: RoomMeta,
    opts: { user: string; giftId?: string; giftName?: string; diamonds: number; repeatCount?: number },
  ): number {
    const diamonds = Number(opts.diamonds ?? 0);
    if (diamonds <= 0) return 0;
    const state = this.touch(key, meta);
    const now = Date.now();
    const count = Number(opts.repeatCount ?? 0);
    const sender = (opts.user || "?").replace(/^@+/, "");
    const comboKey = `${sender}:${opts.giftId || opts.giftName || "?"}`;
    const prev = state.combo.get(comboKey) ?? 0;
    let delta: number;
    if (count <= 0) delta = 1;
    else if (count <= prev) delta = count;
    else delta = count - prev;
    state.combo.set(comboKey, count);
    const gained = diamonds * Math.max(1, delta);
    state.diamonds += gained;
    state.events += 1;
    state.senders.add(sender);
    state.top.set(sender, (state.top.get(sender) ?? 0) + gained);
    if (!state.firstAt) state.firstAt = now;
    state.lastAt = now;
    return gained;
  }

  markEnvelope(key: string, envelopeId: string) {
    const state = this.touch(key, { username: key });
    if (envelopeId) state.envelopeId = envelopeId;
  }

  rows(windowSeconds = 0): Array<{
    username: string;
    roomId: string;
    nickname: string;
    title: string;
    diamonds: number;
    events: number;
    senders: number;
    topSenders: Array<[string, number]>;
    diamondsPerMin: number;
    watchedSeconds: number;
    hasEnvelope: boolean;
    envelopeId: string;
    viewers: number;
  }> {
    const out = [];
    for (const [key, state] of this.rooms) {
      if (state.diamonds <= 0) continue;
      const span = state.firstAt && state.lastAt ? (state.lastAt - state.firstAt) / 1000 : 1;
      const seconds = windowSeconds > 0 ? windowSeconds : Math.max(1, span);
      const top = [...state.top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      out.push({
        username: key,
        roomId: state.meta.roomId ?? "",
        nickname: state.meta.nickname ?? key,
        title: state.meta.title ?? "",
        diamonds: state.diamonds,
        events: state.events,
        senders: state.senders.size,
        topSenders: top,
        diamondsPerMin: Math.round((state.diamonds / Math.max(1, seconds)) * 60),
        watchedSeconds: Math.round(seconds),
        hasEnvelope: Boolean(state.envelopeId),
        envelopeId: state.envelopeId,
        viewers: Number(state.meta.viewers ?? 0),
      });
    }
    return out;
  }
}

/* -------------------------------------------------------------------------- */
/*  Filtre motoru (sandikradar apply_filters ile ayni sozlesme)                */
/* -------------------------------------------------------------------------- */

export type ChestFilters = {
  kind?: string;
  variants?: string[];
  levels?: string[];
  min_coins?: number;
  max_coins?: number;
  min_ratio?: number;
  max_ratio?: number;
  min_slots?: number;
  max_slots?: number;
  min_joined?: number;
  min_time?: number;
  max_time?: number;
  max_viewers?: number;
  min_viewers?: number;
  viewers_lt_slots?: boolean;
  hide_late?: number;
  sort?: string;
  desc?: boolean;
  status?: string;
  q?: string;
  pinned?: boolean;
};

/** Panelde siralama icin kullanilabilen alanlar */
export const SORT_OPTIONS = [
  { key: "opens_at", label: "Açılış zamanı" },
  { key: "coins", label: "Jeton" },
  { key: "ratio", label: "Oran" },
  { key: "per_slot", label: "Kişi başı jeton" },
  { key: "slots", label: "Kontenjan" },
  { key: "joined", label: "Katılan" },
  { key: "viewers", label: "İzleyici" },
  { key: "detected", label: "Tespit zamanı" },
  { key: "per_min", label: "Jeton/dk" },
] as const;

type Filterable = {
  kind: string;
  variant: string;
  coins: number;
  ratio: number;
  slots: number;
  secondsLeft: number;
  viewers: number;
  derivedStatus: string;
  joined?: number;
  diamondsPerMin?: number;
  username?: string;
  title?: string;
  nickname?: string;
};

export function levelOf(variant: string): string {
  return /^l\d+$/.test(variant) ? variant : "";
}

export function applyChestFilters<T extends Filterable>(rows: T[], filters: ChestFilters): T[] {
  const kind = (filters.kind ?? "all").toLowerCase();
  const variants = filters.variants ?? [];
  const levels = filters.levels ?? [];
  const status = (filters.status ?? "all").toLowerCase();
  const q = (filters.q ?? "").trim().toLowerCase();

  const out = rows.filter((row) => {
    if (kind !== "all" && row.kind !== kind) return false;
    if (variants.length && !variants.includes(row.variant)) return false;
    if (levels.length && !levels.includes(levelOf(row.variant))) return false;
    if (status !== "all" && row.derivedStatus !== status) return false;
    if (filters.min_coins !== undefined && row.coins < filters.min_coins) return false;
    if (filters.max_coins !== undefined && row.coins > filters.max_coins) return false;
    if (filters.min_ratio !== undefined && row.ratio < filters.min_ratio) return false;
    if (filters.max_ratio !== undefined && row.ratio > filters.max_ratio) return false;
    if (filters.min_slots !== undefined && row.slots < filters.min_slots) return false;
    if (filters.max_slots !== undefined && row.slots > filters.max_slots) return false;
    if (filters.min_joined !== undefined && Number(row.joined ?? 0) < filters.min_joined) return false;
    if (filters.min_time !== undefined && row.secondsLeft < filters.min_time) return false;
    if (filters.max_time !== undefined && row.secondsLeft > filters.max_time) return false;
    if (filters.min_viewers !== undefined && row.viewers < filters.min_viewers) return false;
    if (filters.max_viewers !== undefined && row.viewers > filters.max_viewers) return false;
    if (filters.viewers_lt_slots && !(row.viewers < row.slots)) return false;
    if (filters.hide_late !== undefined && row.secondsLeft <= 0 && Math.abs(row.secondsLeft) > filters.hide_late) return false;
    if (q) {
      const haystack = `${row.username ?? ""} ${row.nickname ?? ""} ${row.title ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  const sortKey = filters.sort ?? "opens_at";
  const desc = filters.desc ?? true;
  const perSlot = (row: T) => (row.slots > 0 ? row.coins / row.slots : row.coins);
  const keyOf = (row: T): number => {
    switch (sortKey) {
      case "coins":
        return row.coins;
      case "ratio":
        return row.ratio;
      case "per_slot":
        return perSlot(row);
      case "slots":
        return row.slots;
      case "joined":
        return Number(row.joined ?? 0);
      case "viewers":
        return row.viewers;
      case "per_min":
        return Number(row.diamondsPerMin ?? 0);
      case "detected":
        return -row.secondsLeft;
      case "opens_at":
      case "time":
      default:
        return row.secondsLeft;
    }
  };
  return out.sort((a, b) => (desc ? keyOf(b) - keyOf(a) : keyOf(a) - keyOf(b)));
}

export function tabCounts(rows: Filterable[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tab of TABS) {
    counts[tab.id] = applyChestFilters(rows, tab.filter as ChestFilters).length;
  }
  return counts;
}

/* -------------------------------------------------------------------------- */
/*  DB sorgulari                                                               */
/* -------------------------------------------------------------------------- */

/** Süresi geçen ödülleri kalıcı listeden düşür (radarda sadece canlı/bekleyen kalır). */
export async function expireOldChests(): Promise<number> {
  const result = await db
    .update(chests)
    .set({ status: "expired" })
    .where(and(eq(chests.status, "upcoming"), sql`${chests.opensAt} is not null and ${chests.opensAt} < now() - interval '90 seconds'`))
    .returning({ id: chests.id });
  return result.length;
}

export async function listChests(filters: ChestFilters, limit = 200) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 6);
  const rows = await db
    .select()
    .from(chests)
    .where(and(gte(chests.detectedAt, since),
      sql`${chests.status} <> 'expired'`,
      sql`(${chests.opensAt} is null or ${chests.opensAt} >= now() - interval '90 seconds')`))
    .orderBy(desc(chests.detectedAt))
    .limit(limit);
  const derived = rows.map((row) => deriveChest(row));
  return applyChestFilters(derived, filters);
}

export async function listFlows(limit = 100): Promise<DerivedFlow[]> {
  const rows = await db
    .select()
    .from(roomFlows)
    .where(gte(roomFlows.updatedAt, new Date(Date.now() - 1000 * 60 * 30)))
    .orderBy(desc(roomFlows.diamondsPerMin))
    .limit(limit);
  return rows.map(deriveFlow);
}

export async function upsertFlow(row: {
  username: string;
  roomId?: string;
  nickname?: string;
  title?: string;
  diamonds: number;
  events: number;
  senders: number;
  topSenders: Array<[string, number]>;
  diamondsPerMin: number;
  watchedSeconds: number;
  hasEnvelope?: boolean;
  envelopeId?: string;
  viewers?: number;
  liveNow?: boolean;
}) {
  await db
    .insert(roomFlows)
    .values({
      username: row.username.replace(/^@+/, ""),
      roomId: row.roomId ?? "",
      nickname: row.nickname ?? row.username,
      title: row.title ?? "",
      diamonds: row.diamonds,
      events: row.events,
      senders: row.senders,
      topSenders: row.topSenders,
      diamondsPerMin: row.diamondsPerMin,
      watchedSeconds: row.watchedSeconds,
      hasEnvelope: row.hasEnvelope ?? false,
      envelopeId: row.envelopeId ?? "",
      viewers: row.viewers ?? 0,
      liveNow: row.liveNow ?? true,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: roomFlows.username,
      set: {
        roomId: row.roomId ?? "",
        nickname: row.nickname ?? row.username,
        title: row.title ?? "",
        diamonds: row.diamonds,
        events: row.events,
        senders: row.senders,
        topSenders: row.topSenders,
        diamondsPerMin: row.diamondsPerMin,
        watchedSeconds: row.watchedSeconds,
        hasEnvelope: row.hasEnvelope ?? false,
        envelopeId: row.envelopeId ?? "",
        viewers: row.viewers ?? 0,
        liveNow: row.liveNow ?? true,
        updatedAt: new Date(),
      },
    });
}

export async function chestStats() {
  const [agg] = await db
    .select({
      total: sql<number>`count(*)::int`,
      upcoming: sql<number>`(count(*) filter (where ${chests.status} = 'upcoming'))::int`,
      claimed: sql<number>`(count(*) filter (where ${chests.status} = 'claimed'))::int`,
      coins: sql<number>`coalesce(sum(${chests.coins}), 0)::int`,
    })
    .from(chests);
  const [flowAgg] = await db
    .select({
      rooms: sql<number>`count(*)::int`,
      diamonds: sql<number>`coalesce(sum(${roomFlows.diamonds}), 0)::int`,
    })
    .from(roomFlows);
  return {
    chests: agg?.total ?? 0,
    upcoming: agg?.upcoming ?? 0,
    claimed: agg?.claimed ?? 0,
    coins: agg?.coins ?? 0,
    flowRooms: flowAgg?.rooms ?? 0,
    flowDiamonds: flowAgg?.diamonds ?? 0,
  };
}

export { and, lte };
