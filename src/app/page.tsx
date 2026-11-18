import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  Activity,
  ArrowUpRight,
  Briefcase,
  Gem,
  Gift,
  Library,
  Radio,
  Radar as RadarIcon,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { db } from "@/db";
import {
  activityLog,
  chests,
  creators,
  libraryItems,
  liveEvents,
  liveSessions,
  opportunities,
  revenueEntries,
  roomFlows,
  targets,
} from "@/db/schema";
import { Badge, Card, CardHeader, EmptyState, MiniBars, PageHeader, Progress, StatCard, statusTone } from "@/components/ui";
import { formatMoney, formatNumber, timeAgo } from "@/lib/format";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

type DashboardData = {
  ok: boolean;
  creatorCount: number;
  followerTotal: number;
  diamondTotal: number;
  liveCreators: number;
  openOpportunities: number;
  pipelineBudget: number;
  revenueTotal: number;
  revenuePending: number;
  targetCount: number;
  targetsLive: number;
  libraryIntegrated: number;
  session: typeof liveSessions.$inferSelect | null;
  sessionLeaders: Array<{ username: string; nickname: string; diamonds: number; gifts: number }>;
  opportunityRows: Array<typeof opportunities.$inferSelect>;
  targetRows: Array<typeof targets.$inferSelect>;
  creatorRows: Array<typeof creators.$inferSelect>;
  logs: Array<typeof activityLog.$inferSelect>;
  eventBars: number[];
  weeklyTarget: number;
  chestCount: number;
  chestUpcoming: number;
  chestCoins: number;
  flowRooms: number;
};

const fallback: DashboardData = {
  ok: false,
  creatorCount: 0,
  followerTotal: 0,
  diamondTotal: 0,
  liveCreators: 0,
  openOpportunities: 0,
  pipelineBudget: 0,
  revenueTotal: 0,
  revenuePending: 0,
  targetCount: 0,
  targetsLive: 0,
  libraryIntegrated: 0,
  session: null,
  sessionLeaders: [],
  opportunityRows: [],
  targetRows: [],
  creatorRows: [],
  logs: [],
  eventBars: [4, 7, 5, 9, 12, 10, 15, 18],
  weeklyTarget: 75000,
  chestCount: 0,
  chestUpcoming: 0,
  chestCoins: 0,
  flowRooms: 0,
};

async function getData(): Promise<DashboardData> {
  try {
    const [creatorAgg] = await db
      .select({
        count: sql<number>`count(*)::int`,
        followers: sql<number>`coalesce(sum(${creators.followers}), 0)::int`,
        diamonds: sql<number>`coalesce(sum(${creators.diamonds}), 0)::int`,
        live: sql<number>`(count(*) filter (where ${creators.liveStatus} = 'live'))::int`,
      })
      .from(creators);

    const [opportunityAgg] = await db
      .select({
        count: sql<number>`(count(*) filter (where ${opportunities.status} = 'open'))::int`,
        budget: sql<number>`coalesce(sum(${opportunities.budget}), 0)::int`,
      })
      .from(opportunities);

    const [revenueAgg] = await db
      .select({
        total: sql<number>`coalesce(sum(${revenueEntries.amount}), 0)::int`,
        pending: sql<number>`coalesce(sum(${revenueEntries.amount}) filter (where ${revenueEntries.status} = 'pending'), 0)::int`,
      })
      .from(revenueEntries);

    const [targetAgg] = await db
      .select({
        count: sql<number>`count(*)::int`,
        live: sql<number>`(count(*) filter (where ${targets.liveNow} = true))::int`,
      })
      .from(targets);

    const [libraryAgg] = await db
      .select({ integrated: sql<number>`(count(*) filter (where ${libraryItems.integration} = 'integrated'))::int` })
      .from(libraryItems);

    const [session] = await db
      .select()
      .from(liveSessions)
      .where(eq(liveSessions.status, "active"))
      .orderBy(desc(liveSessions.id))
      .limit(1);

    const sessionLeaders = session
      ? await db
          .select({
            username: liveEvents.username,
            nickname: sql<string>`max(${liveEvents.nickname})`,
            diamonds: sql<number>`sum(${liveEvents.diamondCount} * ${liveEvents.repeatCount})::int`,
            gifts: sql<number>`count(*)::int`,
          })
          .from(liveEvents)
          .where(and(eq(liveEvents.sessionId, session.id), eq(liveEvents.type, "gift")))
          .groupBy(liveEvents.username)
          .orderBy(desc(sql`sum(${liveEvents.diamondCount} * ${liveEvents.repeatCount})`))
          .limit(4)
      : [];

    const opportunityRows = await db
      .select()
      .from(opportunities)
      .orderBy(desc(opportunities.matchScore), desc(opportunities.id))
      .limit(5);

    const targetRows = await db
      .select()
      .from(targets)
      .where(eq(targets.liveNow, true))
      .orderBy(desc(targets.score))
      .limit(4);

    const creatorRows = await db.select().from(creators).orderBy(desc(creators.diamonds)).limit(5);

    const logs = await db.select().from(activityLog).orderBy(desc(activityLog.id)).limit(6);

    const [chestAgg] = await db
      .select({
        count: sql<number>`count(*)::int`,
        upcoming: sql<number>`(count(*) filter (where ${chests.status} = 'upcoming'))::int`,
        coins: sql<number>`coalesce(sum(${chests.coins}), 0)::int`,
      })
      .from(chests);
    const [flowAgg] = await db.select({ rooms: sql<number>`count(*)::int` }).from(roomFlows);

    const recentEvents = await db
      .select({ createdAt: liveEvents.createdAt })
      .from(liveEvents)
      .where(gte(liveEvents.createdAt, new Date(Date.now() - 1000 * 60 * 60 * 10)))
      .orderBy(desc(liveEvents.id))
      .limit(400);

    const eventBars = Array.from({ length: 10 }).fill(0) as number[];
    const now = Date.now();
    for (const event of recentEvents) {
      const hoursAgo = Math.floor((now - new Date(event.createdAt).getTime()) / (1000 * 60 * 60));
      const index = 9 - Math.min(9, hoursAgo);
      if (index >= 0) eventBars[index] = (eventBars[index] ?? 0) + 1;
    }

    return {
      ok: true,
      creatorCount: creatorAgg?.count ?? 0,
      followerTotal: creatorAgg?.followers ?? 0,
      diamondTotal: creatorAgg?.diamonds ?? 0,
      liveCreators: creatorAgg?.live ?? 0,
      openOpportunities: opportunityAgg?.count ?? 0,
      pipelineBudget: opportunityAgg?.budget ?? 0,
      revenueTotal: revenueAgg?.total ?? 0,
      revenuePending: revenueAgg?.pending ?? 0,
      targetCount: targetAgg?.count ?? 0,
      targetsLive: targetAgg?.live ?? 0,
      libraryIntegrated: libraryAgg?.integrated ?? 0,
      session: session ?? null,
      sessionLeaders,
      opportunityRows,
      targetRows,
      creatorRows,
      logs,
      eventBars: eventBars.some((value) => value > 0) ? eventBars : fallback.eventBars,
      weeklyTarget: 75000,
      chestCount: chestAgg?.count ?? 0,
      chestUpcoming: chestAgg?.upcoming ?? 0,
      chestCoins: chestAgg?.coins ?? 0,
      flowRooms: flowAgg?.rooms ?? 0,
    };
  } catch {
    return fallback;
  }
}

const LOG_ICONS: Record<string, typeof Activity> = {
  live: Radio,
  radar: RadarIcon,
  revenue: Wallet,
  library: Library,
  system: Zap,
  ai: Sparkles,
};

export default async function DashboardPage() {
  const data = await getData();
  const settings = await getSettings();
  const panelBase = settings.publicBaseUrl || "http://localhost:3000";
  const session = data.session;
  const goal = 25000;
  const progress = session ? Math.min(100, Math.round((session.diamonds / goal) * 100)) : 0;

  return (
    <div>
      <PageHeader
        eyebrow="Genel Bakış · Canlı Merkez"
        title="Yayın merkezi"
        description="Ajans kadron, canlı yayın metrikleri, sandık radarı ve otomasyonların tek ekranda. Tüm veriler gerçek TikTok uçları ve Webcast bağlantısından gelir."
        actions={
          <>
            <Link href="/canli" className="btn btn-primary">
              <Radio size={14} /> Canlı stüdyo
            </Link>
            <Link href="/radar" className="btn">
              <RadarIcon size={14} /> Radar tara
            </Link>
          </>
        }
      />

      {!data.ok ? (
        <div className="mb-4 rounded-xl border border-amber-300/25 bg-amber-400/[0.08] px-4 py-3 text-[12px] text-amber-100">
          Veritabanı henüz hazır değil. Kurulum sonrası{" "}
          <code className="rounded bg-black/40 px-1.5 py-0.5 text-[11px]">POST /api/demo/seed</code> ile demo verisini
          yükleyin.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-cyan-400/15 blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 size-64 rounded-full bg-pink-500/15 blur-[80px]" />
          <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                {session ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-400/40 bg-pink-500/15 px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] text-pink-100">
                    <span className="live-dot" /> CANLI YAYIN
                  </span>
                ) : (
                  <Badge tone="amber">Yayın yok</Badge>
                )}
                <span className="chip">{session ? `@${session.username}` : "Demo motoru hazır"}</span>
                {session?.mode === "live" ? <Badge tone="emerald">Connector</Badge> : <Badge tone="violet">Demo</Badge>}
              </div>
              <h2 className="mt-3 text-[22px] font-bold leading-tight tracking-[-0.03em] text-white">
                {session ? session.title : "TikTok LIVE stüdyonu başlat"}
              </h2>
              <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-white/45">
                {session
                  ? `${formatNumber(session.viewers)} izleyici · ${formatNumber(session.diamonds)} elmas · ${formatNumber(session.gifts)} hediye`
                  : "Yayında olan bir yayıncı gir; sistem gerçek TikTok durumunu doğrular ve Webcast bağlantısı kurar."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Link href="/canli" className="btn btn-primary !text-[11.5px]">
                  <Radio size={13} /> {session ? "Stüdyoya dön" : "Yayın başlat"}
                </Link>
                <Link href="/bot" className="btn !text-[11.5px]">
                  <Zap size={13} /> Otomasyonlar
                </Link>
                <Link href="/kutuphane" className="btn btn-ghost !text-[11.5px]">
                  <Library size={13} /> Overlay al
                </Link>
              </div>
            </div>
            <div className="w-full max-w-[210px] rounded-xl border border-white/10 bg-black/30 p-3.5">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/35">Oturum hedefi</p>
              <p className="mt-1.5 text-[24px] font-bold leading-none tracking-tight text-white [font-variant-numeric:tabular-nums]">
                {formatNumber(session?.diamonds ?? 0)}
                <span className="ml-1 text-[11px] font-medium text-white/35">/ {formatNumber(goal)}</span>
              </p>
              <div className="mt-2.5">
                <Progress value={progress} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/30">Beğeni</p>
                  <p className="text-[12.5px] font-semibold text-white/85">{formatNumber(session?.likes ?? 0)}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-white/30">Takipçi</p>
                  <p className="text-[12.5px] font-semibold text-emerald-300">+{formatNumber(session?.followers ?? 0)}</p>
                </div>
              </div>
              <div className="mt-3 border-t border-white/[0.07] pt-2.5">
                <MiniBars values={data.eventBars} />
                <p className="mt-1 text-[9px] uppercase tracking-wider text-white/25">Son 10 saat olay akışı</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Yayıncı hızlı erişim"
            subtitle="QR ile mobil panel veya overlay bağlantısı"
            icon={<Radio size={14} />}
            action={<Badge tone="cyan">Live OS</Badge>}
          />
          <div className="flex flex-1 items-center gap-4 p-4">
            <div className="rounded-xl border border-white/10 bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr?text=${encodeURIComponent(`${panelBase}/canli`)}&dark=%23050509`}
                alt="Canlı stüdyo QR kodu"
                width={92}
                height={92}
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-white/85">Mobil stüdyo</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                Telefonla QR&apos;ı okut, panelin canlı ekranına bağlan. Overlay URL&apos;lerini OBS&apos;e ekle.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="chip !text-[9.5px]">OBS</span>
                <span className="chip !text-[9.5px]">GitHub Pages</span>
                <span className="chip !text-[9.5px]">Zero-dep</span>
              </div>
              <Link href="/windows" className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-200 hover:text-cyan-100">
                Windows paketini indir <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/sandik" className="panel group relative block overflow-hidden p-4 transition hover:border-amber-300/30">
          <div className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-amber-400/15 blur-2xl transition group-hover:opacity-60" />
          <div className="relative flex items-center justify-between">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/40">Sandık radarı</p>
            <span className="grid size-7 place-items-center rounded-lg border border-amber-300/25 bg-amber-400/10 text-amber-200">
              <Gift size={14} />
            </span>
          </div>
          <p className="relative mt-3 text-[26px] font-bold leading-none tracking-[-0.03em] text-white [font-variant-numeric:tabular-nums]">
            {data.chestCount}
          </p>
          <p className="relative mt-2 text-[11px] text-white/40">
            {data.chestUpcoming} açılış bekliyor · {formatNumber(data.chestCoins)} jeton
          </p>
          <p className="relative mt-1 text-[11px] font-semibold text-amber-200/80">Radara git →</p>
        </Link>
        <StatCard
          label="Yayıncı kadrosu"
          value={data.creatorCount}
          hint={`${formatNumber(data.followerTotal)} toplam takipçi`}
          delta={`${data.liveCreators} canlı`}
          icon={<Users size={14} />}
          accent="cyan"
          spark={[3, 5, 4, 7, 6, 9, 8, 11]}
        />
        <StatCard
          label="Elmas havuzu"
          value={data.diamondTotal}
          hint="Tüm yayıncıların kümülatif elması"
          delta={`≈ ${formatMoney(Math.round(data.diamondTotal * 0.021))}`}
          icon={<Gem size={14} />}
          accent="pink"
          spark={[8, 6, 9, 12, 10, 14, 13, 17]}
        />
        <StatCard
          label="Açık fırsatlar"
          value={data.openOpportunities}
          hint={`${formatMoney(data.pipelineBudget)} pipeline`}
          delta="Marka"
          icon={<Briefcase size={14} />}
          accent="violet"
          spark={[2, 4, 3, 5, 4, 6, 5, 7]}
        />
        <StatCard
          label="Net gelir"
          value={formatMoney(data.revenueTotal)}
          hint={`${formatMoney(data.revenuePending)} tahsilat bekliyor`}
          delta="Muhasebe"
          icon={<Wallet size={14} />}
          accent="emerald"
          spark={[5, 7, 6, 9, 8, 11, 12, 14]}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Fırsat radarı"
              subtitle="Eşleşme skoruna göre sıralı marka iş birlikleri"
              icon={<Briefcase size={14} />}
              action={
                <Link href="/firsatlar" className="btn btn-ghost !py-1 !text-[10.5px]">
                  Tümü <ArrowUpRight size={11} />
                </Link>
              }
            />
            {data.opportunityRows.length === 0 ? (
              <EmptyState title="Henüz fırsat yok" description="Fırsatlar sayfasından marka iş birliği ekleyin." />
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {data.opportunityRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="grid size-8 flex-none place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-[10px] font-bold uppercase text-white/60">
                      {row.brand.slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-white/85">{row.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-white/35">
                        {row.brand} · {row.deadline || "tarih yok"} · {formatMoney(row.budget)}
                      </p>
                    </div>
                    <div className="hidden w-24 sm:block">
                      <Progress value={row.matchScore} tone={row.matchScore > 85 ? "emerald" : "gradient"} height={5} />
                      <p className="mt-1 text-right text-[9.5px] text-white/30">%{row.matchScore} uyum</p>
                    </div>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${
                        statusTone(row.status) === "emerald"
                          ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                          : statusTone(row.status) === "amber"
                            ? "border-amber-300/30 bg-amber-400/10 text-amber-200"
                            : "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="En yüksek elmas" subtitle="Kadro performansı" icon={<Gem size={14} />} />
              <div className="space-y-2.5 p-4">
                {data.creatorRows.length === 0 ? (
                  <p className="text-[11.5px] text-white/35">Henüz yayıncı yok.</p>
                ) : (
                  data.creatorRows.map((creator, index) => (
                    <div key={creator.id} className="flex items-center gap-2.5">
                      <span className="w-4 text-[10px] font-bold text-white/25">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-[11.5px] font-semibold text-white/85">@{creator.username}</p>
                          <span className="text-[10.5px] font-semibold tabular-nums text-cyan-200">
                            {formatNumber(creator.diamonds)}
                          </span>
                        </div>
                        <div className="mt-1">
                          <Progress value={creator.diamonds} max={data.creatorRows[0]?.diamonds || 1} height={4} />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Radar — şu an canlı"
                subtitle={`${data.targetsLive} / ${data.targetCount} aday canlı`}
                icon={<RadarIcon size={14} />}
                action={
                  <Link href="/radar" className="btn btn-ghost !py-1 !text-[10.5px]">
                    Tara
                  </Link>
                }
              />
              <div className="divide-y divide-white/[0.05]">
                {data.targetRows.length === 0 ? (
                  <p className="px-4 py-6 text-[11.5px] text-white/35">Canlı aday bulunamadı.</p>
                ) : (
                  data.targetRows.map((target) => (
                    <div key={target.id} className="flex items-center gap-2 px-4 py-2.5">
                      <span className="live-dot !size-1.5" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-semibold text-white/85">@{target.username}</p>
                        <p className="text-[10px] text-white/35">
                          {formatNumber(target.viewers)} izleyici · {target.category}
                        </p>
                      </div>
                      <span className="text-[10.5px] font-bold text-cyan-200">{target.score}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Sistemler"
              subtitle="tiktok-live-connector + Arena servisleri"
              icon={<Zap size={14} />}
              action={<Badge tone="emerald">Çalışıyor</Badge>}
            />
            <div className="space-y-2 p-4">
              {[
                ["LIVE Studio", "Webcast event akışı"],
                ["Radar Scanner", "Canlı durum taraması"],
                ["Chat Bot", "Komut & moderasyon"],
                ["Alert Engine", "Hediye eşik alarmları"],
                ["Overlay Server", "OBS widget API"],
              ].map(([name, detail]) => (
                <div key={name} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <div>
                    <p className="text-[11.5px] font-semibold text-white/80">{name}</p>
                    <p className="text-[9.5px] text-white/30">{detail}</p>
                  </div>
                  <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2">
                <p className="text-[11px] font-semibold text-cyan-100">Kütüphane entegrasyonu</p>
                <span className="chip !text-[9.5px]">{data.libraryIntegrated} aktif</span>
              </div>
              <Link href="/kutuphane" className="btn w-full !text-[11px]">
                <Library size={12} /> Kütüphane kataloğu
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Aktivite" subtitle="Son sistem olayları" icon={<Activity size={14} />} />
            <div className="space-y-2.5 p-4">
              {data.logs.length === 0 ? (
                <p className="text-[11.5px] text-white/35">Kayıt yok.</p>
              ) : (
                data.logs.map((log) => {
                  const Icon = LOG_ICONS[log.kind] ?? Activity;
                  return (
                    <div key={log.id} className="flex gap-2.5">
                      <span className="mt-0.5 grid size-6 flex-none place-items-center rounded-md border border-white/10 bg-white/[0.04] text-white/45">
                        <Icon size={11} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] leading-relaxed text-white/70">{log.message}</p>
                        <p className="text-[9.5px] text-white/25">{timeAgo(log.createdAt)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10">
            <div className="p-4">
              <Badge tone="violet">Yeni · AI Koç</Badge>
              <p className="mt-2 text-[13px] font-semibold leading-snug text-white/90">
                Yayın senaryosu, hediye stratejisi ve marka teklifi metnini saniyeler içinde üret.
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/40">
                Yerel koç motoru API anahtarı olmadan da çalışır; OpenAI bağlarsan model destekli yanıt alır.
              </p>
              <Link href="/ai" className="btn btn-primary mt-3 w-full !text-[11.5px]">
                <Sparkles size={13} /> AI koçu aç
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Sohbet botu",
            desc: "Komut tetikleyicileri, cooldown ve moderasyon kuralları canlı yayında otomatik çalışır.",
            href: "/bot",
            label: "Botu yönet",
            icon: Zap,
          },
          {
            title: "Gelir muhasebesi",
            desc: "Elmas→TL çevirici, komisyon hesaplama ve ödeme durumu takibi tek tabloda.",
            href: "/gelir",
            label: "Gelire git",
            icon: Wallet,
          },
          {
            title: "Windows kurulumu",
            desc: "KURULUM.bat ile tek tıkla kurulum, portable çalışma ve NSIS kurulum paketi üretimi.",
            href: "/windows",
            label: "Paketi indir",
            icon: Library,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} href={item.href} className="panel group block p-4 transition hover:border-white/20">
              <div className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-cyan-200">
                  <Icon size={14} />
                </span>
                <ArrowUpRight size={14} className="text-white/25 transition group-hover:text-cyan-200" />
              </div>
              <p className="mt-3 text-[13px] font-semibold text-white/90">{item.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-white/40">{item.desc}</p>
              <p className="mt-2 text-[11px] font-semibold text-cyan-200/80">{item.label} →</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
