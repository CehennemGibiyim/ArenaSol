import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  activityLog,
  agencies,
  alertRules,
  botCommands,
  creators,
  libraryItems,
  overlays,
  settings,
  targets,
} from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/server/settings";
import { checkLiveWeb } from "@/server/discovery";
import { upsertLiveRoom } from "@/server/rooms";

/**
 * Gerçek kurulum verisi.
 *
 * - Ajans/komut/kural/overlay/kütüphane kayıtları panelin çalışma ayarlarıdır.
 * - Yayıncılar varsayılan İZLEME LİSTESİ'dir; canlı durum, izleyici, sandık ve
 *   jeton akışı YALNIZCA gerçek TikTok uçlarından doldurulur.
 * - Hiçbir sahte sandık, izleyici sayısı veya jeton üretilmez.
 */
export async function seedDemoData(force = false) {
  const [existing] = await db.select({ count: sql<number>`count(*)::int` }).from(creators);
  if ((existing?.count ?? 0) > 0 && !force) {
    return { seeded: false, message: "Kurulum verisi zaten mevcut." };
  }

  if (force) {
    await db.execute(
      sql`truncate table live_events, live_sessions, chests, room_flows, live_rooms, scan_tasks, revenue_entries, targets, opportunities, creators, agencies, bot_commands, alert_rules, overlays, library_items, activity_log, settings restart identity cascade`,
    );
  }

  const agencyRows = await db
    .insert(agencies)
    .values([
      { name: "Cehennem Network", owner: "Arena Yönetim", contact: "@cehennem", city: "İstanbul", commissionRate: 20, tier: "elite", status: "active", notes: "Ana yapı." },
      { name: "Bağımsız yayıncılar", owner: "-", contact: "-", city: "İstanbul", commissionRate: 0, tier: "starter", status: "active", notes: "Ajansa bağlı olmayan izleme hesapları." },
    ])
    .returning({ id: agencies.id });

  // Gerçek izleme havuzu: TR + global popüler yayıncılar.
  // Hepsi gerçek TikTok hesabıdır; canlı durum her taramada yeniden sorgulanır.
  const watchlist = [
    "tiktok", "tiktoktuerkiye", "khaby.lame", "mrbeast", "charlidamelio", "addisonre",
    "zachking", "bellapoarch", "therock", "jasonderulo", "selenagomez", "nba",
    "kaanozdemir", "enesbatur", "ruhicenet", "mervetasci", "gokhanozer", "barisozcan",
    "burcukardes", "cagla.s", "duru.bal", "ebrusalliii", "melisalpkaya", "nurgulozdemir",
  ];

  const creatorRows = await db
    .insert(creators)
    .values(
      watchlist.map((username, index) => ({
        username,
        displayName: username,
        agencyId: agencyRows[index % agencyRows.length]?.id ?? null,
        followers: 0,
        category: "sohbet",
        liveStatus: "offline",
        avgViewers: 0,
        diamonds: 0,
        tiktokId: username,
        notes: "İzleme listesi hesabı — canlı durum gerçek TikTok uçlarından kontrol edilir.",
      })),
    )
    .returning({ id: creators.id });

  await db.insert(targets).values(
    watchlist.map((username, index) => ({
      username,
      displayName: username,
      followers: 0,
      category: "sohbet",
      liveNow: false,
      viewers: 0,
      diamonds: 0,
      score: 50 + (index % 5) * 5,
      status: "new",
      notes: "Gerçek canlı kontrol bekliyor.",
    })),
  );

  await db.insert(botCommands).values([
    { trigger: "!hediye", matchType: "contains", response: "Hediye göndermek için yayındaki hediye panelini kullanabilirsin.", action: "reply", cooldown: 20, enabled: true, uses: 0 },
    { trigger: "!sosyal", matchType: "contains", response: "Sosyal medya hesaplarımızı takip ederek yayın saatlerini kaçırma.", action: "reply", cooldown: 30, enabled: true, uses: 0 },
    { trigger: "!taktik", matchType: "contains", response: "Bu yayının hedefi ve kuralları sabitlenmiş mesajda.", action: "pin", cooldown: 60, enabled: true, uses: 0 },
    { trigger: "!basvuru", matchType: "contains", response: "Ajansa katılmak için başvuru formunu doldur.", action: "reply", cooldown: 40, enabled: true, uses: 0 },
  ]);

  await db.insert(alertRules).values([
    { name: "Sandık tespiti", eventType: "gift", giftName: "", threshold: 100, action: "overlay+sound", message: "{{user}} sandık bıraktı: {{diamonds}} jeton", sound: "arena-hit", enabled: true, triggerCount: 0 },
    { name: "Büyük hediye", eventType: "gift", giftName: "", threshold: 1000, action: "overlay+sound", message: "{{user}} {{diamonds}} elmas gönderdi", sound: "arena-hit", enabled: true, triggerCount: 0 },
    { name: "Takipçi artışı", eventType: "follow", giftName: "", threshold: 25, action: "overlay", message: "25 yeni takipçi", sound: "level-up", enabled: true, triggerCount: 0 },
  ]);

  await db.insert(overlays).values([
    { name: "Elmas Hedefi", slug: "elmas-hedefi", kind: "goal", username: "tiktok", accent: "cyan", goal: 5000, enabled: true, config: { subtitle: "Bu yayının hedefi" } },
    { name: "Top Gifters", slug: "top-gifters", kind: "top-gifter", username: "tiktok", accent: "pink", goal: 0, enabled: true, config: { rows: 5 } },
    { name: "Canlı Sohbet", slug: "canli-sohbet", kind: "chat", username: "tiktok", accent: "violet", goal: 0, enabled: true, config: { rows: 8 } },
    { name: "Sandık Alarmı", slug: "sandik-alarmi", kind: "alert", username: "tiktok", accent: "amber", goal: 0, enabled: true, config: { duration: 6 } },
  ]);

  await db.insert(libraryItems).values([
    { name: "TikTok-Live-Connector", repo: "https://github.com/zerodytrash/TikTok-Live-Connector", packageName: "tiktok-live-connector", language: "TypeScript", category: "live", description: "TikTok LIVE Webcast protokolüne bağlanan Node.js köprüsü. Chat, hediye, beğeni, izleyici ve sandık (envelope) olaylarını gerçek zamanlı okur.", install: "npm i tiktok-live-connector", capabilities: ["chat", "gift", "like", "member", "envelope", "room stats"], integration: "integrated", momentum: "high", docsUrl: "https://www.npmjs.com/package/tiktok-live-connector" },
    { name: "SandıkRadar (referans mimari)", repo: "https://github.com/orucmehmet-code/sandikradar", packageName: "sandikradar", language: "Python", category: "live", description: "Sandık radarının açık kaynak referansı: GiftFlow combo sayımı, EnvelopeEvent yakalama, imzasız canlı kontrol uçları, Telegram uyarıları. Arena motoru bu mimariden türetildi.", install: "git clone https://github.com/orucmehmet-code/sandikradar", capabilities: ["envelope", "gift flow", "live check", "telegram"], integration: "integrated", momentum: "high", docsUrl: "" },
    { name: "TikTokLive (Python)", repo: "https://github.com/isaackogan/TikTokLive", packageName: "TikTokLive", language: "Python", category: "live", description: "Python ekosisteminin LIVE istemcisi. Event tabanlı mimari, sandık ve hediye olayları.", install: "pip install TikTokLive", capabilities: ["chat", "gift", "envelope", "viewer"], integration: "ready", momentum: "high", docsUrl: "https://ttl.docs.isaackogan.com" },
    { name: "tiklive", repo: "https://github.com/talkaboutdesign/tiklive", packageName: "tiklive", language: "TypeScript", category: "overlay", description: "Yerel LIVE olay sunucusu + OBS overlay starter kit. Aksiyon motoru ve overlay mimarisi için referans.", install: "npm i tiklive", capabilities: ["overlay", "actions", "tts", "obs"], integration: "ready", momentum: "high", docsUrl: "" },
    { name: "EulerStream Business API", repo: "https://github.com/EulerStream/TikTok-Live-Api", packageName: "eulerstream", language: "TypeScript", category: "managed", description: "Keşif feed'i (/webcast/feed) ile bölge bazlı canlı oda listesi. Business anahtarı ile Arena tarayıcısına bağlanır; anahtar yoksa izleme listesiyle çalışır.", install: "EULER_API_KEY ortam değişkeni", capabilities: ["feed discovery", "region scan", "managed ws"], integration: "ready", momentum: "high", docsUrl: "" },
    { name: "LiveMira (dichvu321)", repo: "https://dichvu321.com", packageName: "livemira", language: "Web", category: "managed", description: "Dünya çapında sandık/çanta keşfi: jeton, oran (jeton ÷ kontenjan), açılış süresi filtreleri ile ücretsiz liste + ücretli Telegram bot. Arena'nın sandık radarı bu ürünün açık kaynak karşılığıdır.", install: "https://dichvu321.com/live/", capabilities: ["ratio filter", "countdown", "telegram bot", "qr join"], integration: "ready", momentum: "high", docsUrl: "https://dichvu321.com/en/" },
    { name: "Arena Web Library (bizim)", repo: "https://github.com/CehennemGibiyim/Arena", packageName: "@arena/web-library", language: "JavaScript", category: "overlay", description: "Arena panelinin overlay kütüphanesi: GitHub Pages üzerinde çalışan zero-dependency widget seti, sandık radarı sayfası ve OBS şablonları.", install: "Panel → Kütüphane → Web kütüphanesini indir", capabilities: ["zero dependency", "github pages", "obs overlay", "sandik radar"], integration: "integrated", momentum: "high", docsUrl: "" },
    { name: "Arena Local Agent (bizim)", repo: "https://github.com/CehennemGibiyim/Arena", packageName: "arena-agent", language: "JavaScript", category: "live", description: "Kendi bilgisayarınızda çalışan paralel toplayıcı: sabitlenen odaları dinler, sandık zarfı ve jeton akışını panelin /api/ingest ucuna gönderir.", install: "node agent/arena-agent.mjs", capabilities: ["parallel watch", "envelope", "gift flow", "ingest"], integration: "integrated", momentum: "high", docsUrl: "" },
    { name: "TikTok-Api (Python)", repo: "https://github.com/davidteather/TikTok-Api", packageName: "TikTokApi", language: "Python", category: "data", description: "Profil, video, trend verisi toplamak için Python API sarmalayıcısı.", install: "pip install TikTokApi", capabilities: ["profile", "video", "trend"], integration: "ready", momentum: "medium", docsUrl: "" },
    { name: "TikTokLiveSharp", repo: "https://github.com/frankvHoof93/TikTokLiveSharp", packageName: "TikTokLiveSharp", language: "C#", category: "live", description: "Unity ve .NET projelerinde TikTok LIVE olaylarını oyun içi etkileşime çevirmek için C# kütüphanesi.", install: "dotnet add package TikTokLiveSharp", capabilities: ["chat", "gift", "unity"], integration: "planned", momentum: "medium", docsUrl: "" },
    { name: "TikTokLiveJava", repo: "https://github.com/jwdeveloper/TikTokLiveJava", packageName: "TikTokLiveJava", language: "Java", category: "live", description: "Java tabanlı canlı etkileşim uygulamaları için TikTok LIVE istemcisi.", install: "maven: io.github.jwdeveloper.tiktok", capabilities: ["chat", "gift", "events"], integration: "planned", momentum: "medium", docsUrl: "" },
    { name: "gotiktoklive", repo: "https://github.com/steampoweredtaco/gotiktoklive", packageName: "gotiktoklive", language: "Go", category: "live", description: "Go ile yazılmış TikTok LIVE bağlayıcısı; yüksek eşzamanlılık hedefler.", install: "go get github.com/steampoweredtaco/gotiktoklive", capabilities: ["chat", "gift", "concurrency"], integration: "planned", momentum: "low", docsUrl: "" },
  ]);

  await db.insert(settings).values({ id: 1, data: DEFAULT_SETTINGS as unknown as Record<string, unknown> }).onConflictDoUpdate({
    target: settings.id,
    set: { data: DEFAULT_SETTINGS as unknown as Record<string, unknown>, updatedAt: new Date() },
  });

  await db.insert(activityLog).values({
    kind: "system",
    message: "Gerçek kurulum verisi yüklendi. İzleme listesi hazır; canlı durum TikTok uçlarından kontrol ediliyor.",
  });

  // Gerçek canlı kontrol — sahte izleyici/sandık üretmez
  let liveCount = 0;
  let checked = 0;
  for (const username of watchlist.slice(0, 6)) {
    try {
      const result = await checkLiveWeb(username);
      checked += 1;
      await upsertLiveRoom({
        username,
        roomId: result.roomId,
        nickname: result.nickname,
        title: result.title,
        avatar: result.avatar,
        viewers: result.viewers,
        liveNow: result.live,
        monitoring: result.live,
        source: "watchlist",
        lastError: result.detail,
      });
      if (result.live) liveCount += 1;
    } catch {
      /* tek hesap hatası kurulumu durdurmaz */
    }
  }

  return {
    seeded: true,
    message: "Gerçek kurulum verisi oluşturuldu. Sahte sandık/izleyici üretilmedi.",
    creators: creatorRows.length,
    watchlist: watchlist.length,
    liveChecked: checked,
    liveFound: liveCount,
  };
}
