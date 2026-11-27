import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** Ajanslar — TikTok LIVE ajans / network kayıtları */
export const agencies = pgTable("agencies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  owner: text("owner").notNull().default(""),
  contact: text("contact").notNull().default(""),
  city: text("city").notNull().default("İstanbul"),
  commissionRate: integer("commission_rate").notNull().default(20),
  tier: text("tier").notNull().default("growth"),
  status: text("status").notNull().default("active"),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Yayıncı hesapları */
export const creators = pgTable(
  "creators",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull().default(""),
    agencyId: integer("agency_id"),
    followers: integer("followers").notNull().default(0),
    category: text("category").notNull().default("sohbet"),
    liveStatus: text("live_status").notNull().default("offline"),
    avgViewers: integer("avg_viewers").notNull().default(0),
    diamonds: integer("diamonds").notNull().default(0),
    tiktokId: text("tiktok_id").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("creators_username_idx").on(table.username)],
);

/** Marka iş birlikleri / fırsatlar */
export const opportunities = pgTable("opportunities", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  brand: text("brand").notNull().default(""),
  category: text("category").notNull().default("canli-yayin"),
  budget: integer("budget").notNull().default(0),
  currency: text("currency").notNull().default("TRY"),
  deadline: text("deadline").notNull().default(""),
  status: text("status").notNull().default("open"),
  commission: integer("commission").notNull().default(15),
  requirements: text("requirements").notNull().default(""),
  source: text("source").notNull().default("Arena Radar"),
  matchScore: integer("match_score").notNull().default(60),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Taranan yayıncı adayları */
export const targets = pgTable("targets", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull().default(""),
  followers: integer("followers").notNull().default(0),
  category: text("category").notNull().default("sohbet"),
  liveNow: boolean("live_now").notNull().default(false),
  viewers: integer("viewers").notNull().default(0),
  diamonds: integer("diamonds").notNull().default(0),
  score: integer("score").notNull().default(50),
  status: text("status").notNull().default("new"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Canlı yayın oturumları (gerçek connector veya demo) */
export const liveSessions = pgTable("live_sessions", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  roomId: text("room_id").notNull().default(""),
  title: text("title").notNull().default(""),
  mode: text("mode").notNull().default("demo"),
  status: text("status").notNull().default("active"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  peakViewers: integer("peak_viewers").notNull().default(0),
  viewers: integer("viewers").notNull().default(0),
  diamonds: integer("diamonds").notNull().default(0),
  gifts: integer("gifts").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  followers: integer("followers").notNull().default(0),
  connectorError: text("connector_error").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Yayın olay akışı */
export const liveEvents = pgTable("live_events", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull(),
  type: text("type").notNull(),
  username: text("username").notNull().default(""),
  nickname: text("nickname").notNull().default(""),
  giftName: text("gift_name").notNull().default(""),
  diamondCount: integer("diamond_count").notNull().default(0),
  repeatCount: integer("repeat_count").notNull().default(1),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sohbet botu komutları */
export const botCommands = pgTable("bot_commands", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").notNull(),
  matchType: text("match_type").notNull().default("contains"),
  response: text("response").notNull().default(""),
  action: text("action").notNull().default("reply"),
  cooldown: integer("cooldown").notNull().default(15),
  enabled: boolean("enabled").notNull().default(true),
  uses: integer("uses").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Hediye / etkinlik uyarı kuralları */
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  eventType: text("event_type").notNull().default("gift"),
  giftName: text("gift_name").notNull().default(""),
  threshold: integer("threshold").notNull().default(100),
  action: text("action").notNull().default("overlay"),
  message: text("message").notNull().default(""),
  sound: text("sound").notNull().default("arena-hit"),
  enabled: boolean("enabled").notNull().default(true),
  triggerCount: integer("trigger_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** OBS overlay widget'ları */
export const overlays = pgTable(
  "overlays",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    kind: text("kind").notNull().default("goal"),
    username: text("username").notNull().default(""),
    accent: text("accent").notNull().default("cyan"),
    goal: integer("goal").notNull().default(5000),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("overlays_slug_idx").on(table.slug)],
);

/** Gelir kayıtları */
export const revenueEntries = pgTable("revenue_entries", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id"),
  source: text("source").notNull().default("hediye"),
  amount: integer("amount").notNull().default(0),
  currency: text("currency").notNull().default("TRY"),
  diamonds: integer("diamonds").notNull().default(0),
  commission: integer("commission").notNull().default(20),
  status: text("status").notNull().default("pending"),
  period: text("period").notNull().default(""),
  note: text("note").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** TikTok kütüphane kataloğu */
export const libraryItems = pgTable("library_items", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  repo: text("repo").notNull().default(""),
  packageName: text("package_name").notNull().default(""),
  language: text("language").notNull().default("TypeScript"),
  category: text("category").notNull().default("live"),
  description: text("description").notNull().default(""),
  install: text("install").notNull().default(""),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  integration: text("integration").notNull().default("available"),
  momentum: text("momentum").notNull().default("high"),
  docsUrl: text("docs_url").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Tespit edilen sandık / zarf (treasure chest) kayıtları */
export const chests = pgTable(
  "chests",
  {
    id: serial("id").primaryKey(),
    envelopeId: text("envelope_id").notNull().default(""),
    roomId: text("room_id").notNull().default(""),
    username: text("username").notNull().default(""),
    nickname: text("nickname").notNull().default(""),
    title: text("title").notNull().default(""),
    avatar: text("avatar").notNull().default(""),
    kind: text("kind").notNull().default("chest"),
    variant: text("variant").notNull().default("normal"),
    skinId: integer("skin_id").notNull().default(1),
    businessType: integer("business_type").notNull().default(1),
    coins: integer("coins").notNull().default(0),
    slots: integer("slots").notNull().default(1),
    joined: integer("joined").notNull().default(0),
    viewers: integer("viewers").notNull().default(0),
    opensAt: timestamp("opens_at", { withTimezone: true }),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    status: text("status").notNull().default("upcoming"),
    source: text("source").notNull().default("connector"),
    claimedBy: text("claimed_by").notNull().default(""),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("chests_envelope_idx").on(table.envelopeId)],
);

/** Oda bazlı jeton akışı (hediye ölçümü) */
export const roomFlows = pgTable(
  "room_flows",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    roomId: text("room_id").notNull().default(""),
    nickname: text("nickname").notNull().default(""),
    title: text("title").notNull().default(""),
    diamonds: integer("diamonds").notNull().default(0),
    events: integer("events").notNull().default(0),
    senders: integer("senders").notNull().default(0),
    topSenders: jsonb("top_senders").$type<Array<[string, number]>>().notNull().default([]),
    diamondsPerMin: integer("diamonds_per_min").notNull().default(0),
    watchedSeconds: integer("watched_seconds").notNull().default(0),
    hasEnvelope: boolean("has_envelope").notNull().default(false),
    envelopeId: text("envelope_id").notNull().default(""),
    viewers: integer("viewers").notNull().default(0),
    liveNow: boolean("live_now").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("room_flows_username_idx").on(table.username)],
);

/** Keşfedilen canlı yayın odaları — panelde sabit tutulabilir */
export const liveRooms = pgTable(
  "live_rooms",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    roomId: text("room_id").notNull().default(""),
    nickname: text("nickname").notNull().default(""),
    title: text("title").notNull().default(""),
    avatar: text("avatar").notNull().default(""),
    region: text("region").notNull().default("TR"),
    source: text("source").notNull().default("watchlist"),
    viewers: integer("viewers").notNull().default(0),
    peakViewers: integer("peak_viewers").notNull().default(0),
    diamonds: integer("diamonds").notNull().default(0),
    diamondsPerMin: integer("diamonds_per_min").notNull().default(0),
    chestCount: integer("chest_count").notNull().default(0),
    bestChestCoins: integer("best_chest_coins").notNull().default(0),
    bestChestSlots: integer("best_chest_slots").notNull().default(0),
    bestChestRatio: integer("best_chest_ratio").notNull().default(0),
    lastChestAt: timestamp("last_chest_at", { withTimezone: true }),
    pinned: boolean("pinned").notNull().default(false),
    liveNow: boolean("live_now").notNull().default(false),
    monitoring: boolean("monitoring").notNull().default(false),
    lastError: text("last_error").notNull().default(""),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** En son canlı kontrol zamanı — çevrimdışı havuzun dönüşümlü taranması için. */
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    /** Gözlenen sandıklar arası medyan süre (sn) — oda başına sandık ritmi. 0 = bilinmiyor. */
    chestIntervalSeconds: integer("chest_interval_seconds").notNull().default(0),
    /** Son sandığa göre beklenen bir sonraki sandık zamanı. */
    chestDueAt: timestamp("chest_due_at", { withTimezone: true }),
    /** Dinleme kapısı: bu zamandan önce WebSocket açılmaz (null = ritim yok, kısıtlama yok). */
    nextListenAt: timestamp("next_listen_at", { withTimezone: true }),
    /** Yayında bulunmadığı doğrulanan ardışık kontrol sayısı (artan aralıklı yeniden deneme). */
    checkMisses: integer("check_misses").notNull().default(0),
    /** Bir sonraki canlı kontrol zamanı — geri çekilen adaylar o zamana kadar atlanır. */
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("live_rooms_username_idx").on(table.username)],
);

/** Eşzamanlı tarama görevleri — her oda ayrı işlem */
export const scanTasks = pgTable("scan_tasks", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull().default(0),
  username: text("username").notNull(),
  roomId: text("room_id").notNull().default(""),
  status: text("status").notNull().default("queued"),
  viewerCount: integer("viewer_count").notNull().default(0),
  diamonds: integer("diamonds").notNull().default(0),
  giftEvents: integer("gift_events").notNull().default(0),
  chestsFound: integer("chests_found").notNull().default(0),
  listenSeconds: integer("listen_seconds").notNull().default(0),
  error: text("error").notNull().default(""),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Doğrulanan canlı odalar için kalıcı, oda kimliğiyle tekilleştirilmiş dinleme sırası. */
export const listenerJobs = pgTable(
  "listener_jobs",
  {
    id: serial("id").primaryKey(),
    roomId: text("room_id").notNull(),
    username: text("username").notNull(),
    nickname: text("nickname").notNull().default(""),
    title: text("title").notNull().default(""),
    viewers: integer("viewers").notNull().default(0),
    status: text("status").notNull().default("queued"),
    owner: text("owner").notNull().default(""),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("listener_jobs_room_idx").on(table.roomId)],
);

/** Radar tarama geçmişi */
export const radarScans = pgTable("radar_scans", {
  id: serial("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  checked: integer("checked").notNull().default(0),
  liveFound: integer("live_found").notNull().default(0),
  chestsFound: integer("chests_found").notNull().default(0),
  source: text("source").notNull().default("watchlist"),
  error: text("error").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Panel ayarları (tek satır jsonb) */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Aktivite akışı */
export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("info"),
  message: text("message").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Agency = typeof agencies.$inferSelect;
export type Creator = typeof creators.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type Target = typeof targets.$inferSelect;
export type LiveSession = typeof liveSessions.$inferSelect;
export type LiveEvent = typeof liveEvents.$inferSelect;
export type BotCommand = typeof botCommands.$inferSelect;
export type AlertRule = typeof alertRules.$inferSelect;
export type Overlay = typeof overlays.$inferSelect;
export type RevenueEntry = typeof revenueEntries.$inferSelect;
export type LibraryItem = typeof libraryItems.$inferSelect;
export type Chest = typeof chests.$inferSelect;
export type LiveRoom = typeof liveRooms.$inferSelect;
export type ScanTask = typeof scanTasks.$inferSelect;
export type ListenerJob = typeof listenerJobs.$inferSelect;
export type RoomFlow = typeof roomFlows.$inferSelect;
export type RadarScan = typeof radarScans.$inferSelect;
