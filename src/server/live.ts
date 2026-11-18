import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  alertRules,
  botCommands,
  liveEvents,
  liveSessions,
  overlays,
  type LiveEvent,
  type LiveSession,
} from "@/db/schema";

/* -------------------------------------------------------------------------- */
/*  Connector                                                                  */
/* -------------------------------------------------------------------------- */

export type ConnectorStatus = {
  available: boolean;
  version: string;
  detail: string;
  packageName: string;
};

let cachedConnector: ConnectorStatus | null = null;

export async function getConnectorStatus(): Promise<ConnectorStatus> {
  if (cachedConnector) return cachedConnector;
  try {
    const mod = await import("tiktok-live-connector");
    const available = typeof mod.TikTokLiveConnection === "function";
    cachedConnector = {
      available,
      version: "2.5.0",
      packageName: "tiktok-live-connector",
      detail: available
        ? "tiktok-live-connector yüklü — Webcast köprüsü gerçek LIVE verisine bağlanabilir."
        : "Paket bulundu fakat TikTokLiveConnection export edilmedi; gerçek bağlantı kullanılamaz.",
    };
  } catch (error) {
    cachedConnector = {
      available: false,
      version: "yok",
      packageName: "tiktok-live-connector",
      detail: `Connector yüklenemedi (${(error as Error).message}); gerçek bağlantı kullanılamaz.`,
    };
  }
  return cachedConnector;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} zaman aşımı (${ms}ms)`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export type LiveCheck = {
  username: string;
  live: boolean;
  viewers: number;
  roomId: string;
  nickname: string;
  title: string;
  source: "web" | "connector" | "unavailable";
  note: string;
};

/**
 * TikTok LIVE durum kontrolü — YALNIZCA GERÇEK VERİ.
 * 1) TikTok web uçları (user/room + check_alive + room/info) — hızlı ve imzasız
 * 2) tiktok-live-connector fetchIsLive/fetchRoomInfo — doğrulama + ayrıntı
 * Sonuç asla tahmin edilmez; bağlantı kurulamazsa açıkça hata bildirilir.
 */
export async function checkLive(username: string): Promise<LiveCheck> {
  const clean = username.replace(/^@+/, "").trim();
  if (!clean) {
    return {
      username: "",
      live: false,
      viewers: 0,
      roomId: "",
      nickname: "",
      title: "",
      source: "unavailable",
      note: "Kullanıcı adı boş.",
    };
  }

  const { checkLiveWeb } = await import("@/server/discovery");
  let webResult: Awaited<ReturnType<typeof checkLiveWeb>> | null = null;
  try {
    webResult = await withTimeout(checkLiveWeb(clean), 12000, "web kontrol");
  } catch (error) {
    webResult = null;
    void error;
  }

  const status = await getConnectorStatus();
  let connectorLive: boolean | null = null;
  let connectorViewers = 0;
  let connectorRoomId = "";
  let connectorNote = "";
  if (status.available) {
    try {
      const mod = await import("tiktok-live-connector");
      const connection = new mod.TikTokLiveConnection(clean, {
        processInitialData: false,
        enableExtendedGiftInfo: true,
      });
      connectorLive = await withTimeout(Promise.resolve(connection.fetchIsLive()), 12000, "fetchIsLive");
      if (connectorLive) {
        try {
          const info = await withTimeout(Promise.resolve(connection.fetchRoomInfo()), 10000, "fetchRoomInfo");
          const data = info as unknown as {
            roomId?: string;
            id_str?: string;
            viewerCount?: number;
            user_count?: number;
            stats?: { totalUser?: number };
            roomInfo?: { stats?: { totalUser?: number }; viewerCount?: number };
          };
          connectorViewers =
            data?.viewerCount ?? data?.user_count ?? data?.stats?.totalUser ?? data?.roomInfo?.stats?.totalUser ?? 0;
          connectorRoomId = String(data?.roomId ?? data?.id_str ?? "");
        } catch {
          /* room info opsiyonel */
        }
      }
    } catch (error) {
      connectorNote = `Connector: ${(error as Error).message}`;
    }
  } else {
    connectorNote = "tiktok-live-connector yüklenemedi.";
  }

  const live = connectorLive === true || Boolean(webResult?.live);
  const viewers = Math.max(connectorViewers, webResult?.viewers ?? 0);
  const roomId = connectorRoomId || webResult?.roomId || "";
  const source = connectorLive !== null ? "connector" : webResult ? "web" : "unavailable";

  if (source === "unavailable") {
    return {
      username: clean,
      live: false,
      viewers: 0,
      roomId: "",
      nickname: webResult?.nickname ?? "",
      title: webResult?.title ?? "",
      source: "unavailable",
      note: `TikTok'a ulaşılamadı — gerçek durum doğrulanamadı. ${connectorNote}`.trim(),
    };
  }

  return {
    username: clean,
    live,
    viewers,
    roomId,
    nickname: webResult?.nickname ?? "",
    title: webResult?.title ?? "",
    source,
    note: live
      ? `Gerçek yayın doğrulandı (${source}) · ${viewers.toLocaleString("tr-TR")} izleyici`
      : `Gerçek durum: şu an yayında değil (${source}). ${connectorNote}`.trim(),
  };
}

/* -------------------------------------------------------------------------- */
/*  Gerçek bağlantı yöneticisi                                                 */
/* -------------------------------------------------------------------------- */

type Listener = (payload: unknown) => void;
type ConnectorLike = {
  connect: () => Promise<unknown>;
  disconnect: () => Promise<void>;
  on: (event: string, listener: Listener) => void;
};

const globalStore = globalThis as typeof globalThis & {
  __arenaConnections?: Map<number, ConnectorLike>;
};
const connections = globalStore.__arenaConnections ?? new Map<number, ConnectorLike>();
globalStore.__arenaConnections = connections;

async function recordEvent(
  sessionId: number,
  event: {
    type: string;
    username?: string;
    nickname?: string;
    giftName?: string;
    diamondCount?: number;
    repeatCount?: number;
    comment?: string;
  },
) {
  await db.insert(liveEvents).values({
    sessionId,
    type: event.type,
    username: event.username ?? "",
    nickname: event.nickname ?? "",
    giftName: event.giftName ?? "",
    diamondCount: event.diamondCount ?? 0,
    repeatCount: event.repeatCount ?? 1,
    comment: event.comment ?? "",
  });
  const increment =
    event.type === "gift"
      ? { diamonds: event.diamondCount ?? 0, gifts: 1 }
      : event.type === "comment"
        ? { comments: 1 }
        : event.type === "like"
          ? { likes: 1 }
          : event.type === "follow"
            ? { followers: 1 }
            : {};
  if (Object.keys(increment).length > 0) {
    await db
      .update(liveSessions)
      .set({
        diamonds: sql`${liveSessions.diamonds} + ${increment.diamonds ?? 0}`,
        gifts: sql`${liveSessions.gifts} + ${increment.gifts ?? 0}`,
        comments: sql`${liveSessions.comments} + ${increment.comments ?? 0}`,
        likes: sql`${liveSessions.likes} + ${increment.likes ?? 0}`,
        followers: sql`${liveSessions.followers} + ${increment.followers ?? 0}`,
      })
      .where(eq(liveSessions.id, sessionId));
  }
}

export async function startRealConnection(sessionId: number, username: string): Promise<boolean> {
  const status = await getConnectorStatus();
  if (!status.available) return false;
  try {
    const mod = await import("tiktok-live-connector");
    const { getSettings } = await import("@/server/settings");
    const settings = await getSettings();
    const connection = new mod.TikTokLiveConnection(username.replace(/^@+/, ""), {
      processInitialData: false,
      enableExtendedGiftInfo: true,
      ...(settings.tiktokSessionId
        ? {
            sessionId: settings.tiktokSessionId,
            ...(settings.ttTargetIdc ? { ttTargetIdc: settings.ttTargetIdc } : {}),
          }
        : {}),
    }) as unknown as ConnectorLike;
    connection.on("chat", (raw) => {
      const data = raw as { user?: { uniqueId?: string; nickname?: string }; comment?: string };
      const comment = data.comment ?? "";
      void recordEvent(sessionId, {
        type: "comment",
        username: data.user?.uniqueId,
        nickname: data.user?.nickname,
        comment,
      });
      // Gerçek sohbet komutları: bot kurallarıyla eşleşen mesajlar yanıtlanır
      void (async () => {
        const commands = await db.select().from(botCommands).where(eq(botCommands.enabled, true));
        const matched = commands.find((command) => {
          const trigger = command.trigger.toLowerCase().replace(/^!/, "");
          const text = comment.toLowerCase();
          if (command.matchType === "exact") return text.replace(/^!/, "") === trigger;
          return text.includes(trigger);
        });
        if (!matched) return;
        await db
          .update(botCommands)
          .set({ uses: sql`${botCommands.uses} + 1` })
          .where(eq(botCommands.id, matched.id));
        await recordEvent(sessionId, {
          type: "bot",
          username: "@arena_bot",
          nickname: "Arena Bot",
          comment: matched.response,
        });
        // TikTok sohbetine yazmak için oturum çerezi gerekir; varsa gerçekten gönder
        const settings = await (await import("@/server/settings")).getSettings();
        if (settings.tiktokSessionId && settings.autoBot !== false) {
          const sender = connection as unknown as { sendMessage?: (text: string) => Promise<unknown> };
          if (typeof sender.sendMessage === "function") {
            void sender.sendMessage(matched.response).catch(() => null);
          }
        }
      })().catch(() => null);
    });
    connection.on("gift", (raw) => {
      const data = raw as {
        user?: { uniqueId?: string; nickname?: string };
        giftId?: number | string;
        giftName?: string;
        giftDetails?: { giftName?: string; diamond_count?: number; diamondCount?: number };
        diamondCount?: number;
        repeatCount?: number;
      };
      const gems =
        data.diamondCount ?? data.giftDetails?.diamondCount ?? data.giftDetails?.diamond_count ?? 1;
      void recordEvent(sessionId, {
        type: "gift",
        username: data.user?.uniqueId,
        nickname: data.user?.nickname,
        giftName: data.giftName ?? data.giftDetails?.giftName ?? `Gift #${data.giftId ?? "?"}`,
        diamondCount: Math.max(1, Number(gems) || 1),
        repeatCount: data.repeatCount ?? 1,
      });
    });
    connection.on("like", (raw) => {
      const data = raw as { user?: { uniqueId?: string; nickname?: string }; likeCount?: number };
      void recordEvent(sessionId, {
        type: "like",
        username: data.user?.uniqueId,
        nickname: data.user?.nickname,
        repeatCount: data.likeCount ?? 1,
      });
    });
    connection.on("member", (raw) => {
      const data = raw as { user?: { uniqueId?: string; nickname?: string } };
      void recordEvent(sessionId, {
        type: "join",
        username: data.user?.uniqueId,
        nickname: data.user?.nickname,
      });
    });
    connection.on("social", (raw) => {
      const data = raw as {
        user?: { uniqueId?: string; nickname?: string };
        uniqueId?: string;
        nickname?: string;
        action?: number;
      };
      void recordEvent(sessionId, {
        type: data.action === 3 ? "share" : "follow",
        username: data.user?.uniqueId ?? data.uniqueId,
        nickname: data.user?.nickname ?? data.nickname,
      });
    });
    connection.on("envelope", (raw) => {
      const data = raw as {
        envelopeInfo?: {
          envelopeId?: string;
          roomId?: string;
          diamondCount?: number;
          peopleCount?: number;
          unpackAt?: number;
          skinId?: number;
          businessType?: number;
          sendUserName?: string;
        };
      };
      const info = data.envelopeInfo;
      if (!info) return;
      void (async () => {
        const { recordChest } = await import("@/server/chest");
        const chest = await recordChest(
          {
            envelopeId: info.envelopeId,
            roomId: info.roomId,
            diamondCount: info.diamondCount,
            peopleCount: info.peopleCount,
            unpackAt: info.unpackAt,
            skinId: info.skinId,
            businessType: info.businessType,
            sendUserName: info.sendUserName,
          },
          { username, viewers: 0 },
          "connector",
        );
        if (chest) {
          await recordEvent(sessionId, {
            type: "chest",
            username: chest.username,
            nickname: chest.nickname,
            giftName: `Sandık · ${chest.coins} jeton / ${chest.slots} kişi`,
            diamondCount: chest.coins,
            repeatCount: chest.slots,
          });
        }
      })();
    });
    connection.on("roomUser", (raw) => {
      const data = raw as { viewerCount?: number };
      if (data.viewerCount) {
        void db
          .update(liveSessions)
          .set({
            viewers: data.viewerCount,
            peakViewers: sql`greatest(${liveSessions.peakViewers}, ${data.viewerCount})`,
          })
          .where(eq(liveSessions.id, sessionId));
      }
    });
    connection.on("streamEnd", () => {
      void endSession(sessionId);
    });
    connection.on("disconnected", () => {
      void db
        .update(liveSessions)
        .set({ connectorError: "TikTok bağlantısı kapandı." })
        .where(eq(liveSessions.id, sessionId));
    });
    await withTimeout(Promise.resolve(connection.connect()), 12000, "connect");
    connections.set(sessionId, connection);
    return true;
  } catch (error) {
    await db
      .update(liveSessions)
      .set({ connectorError: `Gerçek bağlantı kurulamadı: ${(error as Error).message}` })
      .where(eq(liveSessions.id, sessionId));
    return false;
  }
}

export async function stopRealConnection(sessionId: number) {
  const connection = connections.get(sessionId);
  if (!connection) return;
  try {
    await connection.disconnect();
  } catch {
    /* bağlantı zaten kapalı */
  }
  connections.delete(sessionId);
}

/* -------------------------------------------------------------------------- */
/*  Snapshot                                                                   */
/* -------------------------------------------------------------------------- */

export type LiveLeader = { username: string; nickname: string; diamonds: number; gifts: number };

export type LiveSnapshot = {
  session: LiveSession;
  events: LiveEvent[];
  leaderboard: LiveLeader[];
  connector: ConnectorStatus;
  overview: {
    diamonds: number;
    gifts: number;
    comments: number;
    likes: number;
    followers: number;
    viewers: number;
    peakViewers: number;
    estimatedTry: number;
    durationMin: number;
    uniqueUsers: number;
    engagement: number;
  };
  goals: Array<{ id: number; name: string; slug: string; kind: string; goal: number; accent: string; enabled: boolean }>;
};

export async function getSnapshot(sessionId: number): Promise<LiveSnapshot | null> {
  const [session] = await db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).limit(1);
  if (!session) return null;

  const [fresh] = await db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).limit(1);
  const current = fresh ?? session;
  const events = await db
    .select()
    .from(liveEvents)
    .where(eq(liveEvents.sessionId, sessionId))
    .orderBy(desc(liveEvents.id))
    .limit(60);

  const leaderboard = await db
    .select({
      username: liveEvents.username,
      nickname: sql<string>`max(${liveEvents.nickname})`,
      diamonds: sql<number>`sum(${liveEvents.diamondCount} * ${liveEvents.repeatCount})::int`,
      gifts: sql<number>`count(*)::int`,
    })
    .from(liveEvents)
    .where(and(eq(liveEvents.sessionId, sessionId), eq(liveEvents.type, "gift")))
    .groupBy(liveEvents.username)
    .orderBy(desc(sql`sum(${liveEvents.diamondCount} * ${liveEvents.repeatCount})`))
    .limit(8);

  const uniqueUsers = await db
    .select({ count: sql<number>`count(distinct ${liveEvents.username})::int` })
    .from(liveEvents)
    .where(eq(liveEvents.sessionId, sessionId));

  const goals = await db.select().from(overlays).where(eq(overlays.enabled, true));
  const start = new Date(current.startedAt).getTime();
  const end = current.endedAt ? new Date(current.endedAt).getTime() : Date.now();
  const durationMin = Math.max(1, Math.round((end - start) / 60000));

  return {
    session: current,
    events,
    leaderboard,
    connector: await getConnectorStatus(),
    overview: {
      diamonds: current.diamonds,
      gifts: current.gifts,
      comments: current.comments,
      likes: current.likes,
      followers: current.followers,
      viewers: current.viewers,
      peakViewers: Math.max(current.peakViewers, current.viewers),
      estimatedTry: Math.round(current.diamonds * 0.021),
      durationMin,
      uniqueUsers: uniqueUsers[0]?.count ?? 0,
      engagement: Math.min(
        99,
        Math.round(((current.comments + current.gifts + current.followers) / Math.max(1, current.viewers)) * 100),
      ),
    },
    goals: goals.map((goal) => ({
      id: goal.id,
      name: goal.name,
      slug: goal.slug,
      kind: goal.kind,
      goal: goal.goal,
      accent: goal.accent,
      enabled: goal.enabled,
    })),
  };
}

export async function endSession(sessionId: number) {
  await db
    .update(liveSessions)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(liveSessions.id, sessionId));
  await stopRealConnection(sessionId);
  await db.insert(activityLog).values({
    kind: "live",
    message: `Yayın oturumu #${sessionId} kapatıldı.`,
    meta: { sessionId },
  });
}
