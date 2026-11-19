"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CircleStop,
  Gem,
  Heart,
  MessageSquare,
  Play,
  Radio,
  RefreshCw,
  Gift,
  Share2,
  Sparkles,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { Badge, Card, CardHeader, Progress } from "@/components/ui";
import { formatMoney, formatNumber, timeAgo } from "@/lib/format";

type Session = {
  id: number;
  username: string;
  title: string;
  mode: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  viewers: number;
  peakViewers: number;
  diamonds: number;
  gifts: number;
  comments: number;
  likes: number;
  followers: number;
  roomId: string;
  connectorError: string;
};

type Event = {
  id: number;
  type: string;
  username: string;
  nickname: string;
  giftName: string;
  diamondCount: number;
  repeatCount: number;
  comment: string;
  createdAt: string;
};

type Snapshot = {
  session: Session;
  events: Event[];
  leaderboard: Array<{ username: string; nickname: string; diamonds: number; gifts: number }>;
  connector: { available: boolean; version: string; detail: string };
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

const EVENT_STYLES: Record<string, { icon: typeof Gem; color: string; label: string }> = {
  gift: { icon: Gem, color: "#fe2c55", label: "hediye" },
  comment: { icon: MessageSquare, color: "#25f4ee", label: "sohbet" },
  like: { icon: Heart, color: "#f472b6", label: "beğeni" },
  follow: { icon: UserPlus, color: "#34d399", label: "takip" },
  share: { icon: Share2, color: "#a78bfa", label: "paylaşım" },
  join: { icon: Users, color: "#94a3b8", label: "katılım" },
  bot: { icon: Zap, color: "#c4b5fd", label: "bot" },
  chest: { icon: Gift, color: "#f5b642", label: "sandık" },
};

export function LiveStudio({
  quickPicks,
  initialUsername,
}: {
  quickPicks: Array<{ username: string; category: string; liveStatus: string }>;
  initialUsername?: string;
}) {
  const [username, setUsername] = useState(initialUsername || quickPicks[0]?.username || "elif_live");
  const [title, setTitle] = useState("");
  const [mode] = useState<"auto">("auto");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [connector, setConnector] = useState<{ available: boolean; version: string; detail: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"feed" | "systems">("feed");
  const [autoscroll, setAutoscroll] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  const activeSession = snapshot?.session;

  const fetchSnapshot = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/live/sessions/${id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Oturum verisi alınamadı");
      const data = (await response.json()) as Snapshot;
      setSnapshot(data);
      setConnector(data.connector);
      setError("");
    } catch (fetchError) {
      setError((fetchError as Error).message);
    }
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const response = await fetch("/api/live/sessions", { cache: "no-store" });
      const data = (await response.json()) as { data?: Session[]; connector?: Snapshot["connector"] };
      setSessions(data.data ?? []);
      if (data.connector) setConnector(data.connector);
      const active = (data.data ?? []).find((item) => item.status === "active");
      if (active) await fetchSnapshot(active.id);
    } catch {
      /* ilk yükleme hatası */
    }
  }, [fetchSnapshot]);

  useEffect(() => {
    queueMicrotask(() => void loadSessions());
    const statusTimer = fetch("/api/live/status")
      .then((response) => response.json())
      .then((data) => setConnector(data.connector))
      .catch(() => null);
    void statusTimer;
  }, [loadSessions]);

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") return;
    const timer = setInterval(() => {
      void fetchSnapshot(activeSession.id);
    }, 2500);
    return () => clearInterval(timer);
  }, [activeSession, fetchSnapshot]);

  useEffect(() => {
    if (autoscroll && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [snapshot?.events, autoscroll]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(timer);
  }, [notice]);

  const connect = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/live/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, title, mode, restart: true }),
      });
      const data = (await response.json()) as { session?: Session; error?: string; check?: { live: boolean; source: string }; connector?: Snapshot["connector"] };
      if (!response.ok || !data.session) throw new Error(data.error ?? "Oturum açılamadı");
      setSnapshot(null);
      await fetchSnapshot(data.session.id);
      await loadSessions();
      setNotice(
        `Oturum #${data.session.id} açıldı · GERÇEK Webcast bağlantısı · kaynak: ${data.check?.source ?? "web"}`,
      );
    } catch (connectError) {
      setError((connectError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const end = async () => {
    if (!activeSession) return;
    setLoading(true);
    try {
      await fetch(`/api/live/sessions/${activeSession.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
      setNotice("Yayın oturumu kapatıldı.");
      await loadSessions();
      setSnapshot(null);
    } catch {
      setError("Oturum kapatılamadı");
    } finally {
      setLoading(false);
    }
  };

  const goal = snapshot?.goals.find((item) => item.kind === "goal")?.goal ?? 25000;
  const diamonds = snapshot?.overview.diamonds ?? 0;

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-2.5 text-[12px] text-emerald-100">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-pink-400/25 bg-pink-500/[0.08] px-4 py-2.5 text-[12px] text-pink-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.1em] text-cyan-100">
                  <Radio size={11} /> CANLI STÜDYO
                </span>
                <Badge tone={connector?.available ? "emerald" : "amber"}>
                  tiktok-live-connector v{connector?.version ?? "2.5.0"}
                </Badge>
                <span className="chip">Gerçek bağlantı</span>
                {snapshot ? <Badge tone="emerald">Gerçek bağlantı</Badge> : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <label className="label" htmlFor="live-username">
                    TikTok kullanıcı adı
                  </label>
                  <input
                    id="live-username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="elif_live"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="live-title">
                    Yayın başlığı (opsiyonel)
                  </label>
                  <input
                    id="live-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Yaz hedefi yayını"
                    className="input"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button onClick={() => void connect()} disabled={loading} className="btn btn-primary h-[38px]">
                    {loading ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                    Bağlan
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-white/30">Hızlı seçim:</span>
                {quickPicks.slice(0, 6).map((creator) => (
                  <button
                    key={creator.username}
                    onClick={() => setUsername(creator.username)}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-medium text-white/60 transition hover:border-cyan-300/40 hover:text-cyan-100"
                  >
                    @{creator.username}
                  </button>
                ))}
              </div>
              <p className="rounded-lg border border-white/[0.06] bg-black/25 px-3 py-2 text-[10.5px] leading-relaxed text-white/35">
                {connector?.detail ??
                  "Connector kontrol ediliyor. Yalnızca gerçek TikTok yayınlarına bağlanılır; yayında olmayan hesap için oturum açılmaz."}
              </p>
            </div>
          </Card>

          {activeSession ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: "İzleyici", value: formatNumber(snapshot?.overview.viewers ?? 0), hint: `peak ${formatNumber(snapshot?.overview.peakViewers ?? 0)}`, icon: Users, accent: "#25f4ee" },
                  { label: "Elmas", value: formatNumber(snapshot?.overview.diamonds ?? 0), hint: `≈ ${formatMoney(snapshot?.overview.estimatedTry ?? 0)}`, icon: Gem, accent: "#fe2c55" },
                  { label: "Hediye", value: formatNumber(snapshot?.overview.gifts ?? 0), hint: `${snapshot?.overview.uniqueUsers ?? 0} tekil kullanıcı`, icon: Sparkles, accent: "#8b5cf6" },
                  { label: "Etkileşim", value: `%${snapshot?.overview.engagement ?? 0}`, hint: `${formatNumber(snapshot?.overview.comments ?? 0)} yorum`, icon: MessageSquare, accent: "#f5b642" },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="panel relative overflow-hidden p-3.5">
                      <div className="pointer-events-none absolute -right-4 -top-6 size-16 rounded-full opacity-20 blur-xl" style={{ background: stat.accent }} />
                      <div className="flex items-center justify-between">
                        <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-white/35">{stat.label}</p>
                        <Icon size={12} style={{ color: stat.accent }} />
                      </div>
                      <p className="mt-2 text-[21px] font-bold leading-none tabular-nums text-white">{stat.value}</p>
                      <p className="mt-1 text-[10px] text-white/35">{stat.hint}</p>
                    </div>
                  );
                })}
              </div>

              <Card>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="live-dot" />
                    <p className="text-[12.5px] font-semibold text-white/85">
                      @{activeSession.username}
                      <span className="ml-2 text-[10.5px] font-normal text-white/35">{activeSession.title}</span>
                    </p>
                    <Badge tone={activeSession.status === "active" ? "pink" : "slate"}>{activeSession.status}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAutoscroll((value) => !value)}
                      className={`btn !px-2 !py-1 !text-[10px] ${autoscroll ? "!border-cyan-300/40 !text-cyan-100" : ""}`}
                    >
                      Oto kaydır
                    </button>
                    <button onClick={() => setTab(tab === "feed" ? "systems" : "feed")} className="btn !px-2 !py-1 !text-[10px]">
                      {tab === "feed" ? "Sistem" : "Akış"}
                    </button>
                    <button onClick={() => activeSession && void fetchSnapshot(activeSession.id)} className="btn !px-2 !py-1" aria-label="Yenile">
                      <RefreshCw size={11} />
                    </button>
                    <button onClick={() => void end()} disabled={loading || activeSession.status !== "active"} className="btn btn-danger !px-2 !py-1 !text-[10px]">
                      <CircleStop size={11} /> Bitir
                    </button>
                  </div>
                </div>

                {tab === "feed" ? (
                  <div ref={feedRef} className="h-[340px] overflow-y-auto">
                    {(snapshot?.events ?? []).length === 0 ? (
                      <div className="grid h-full place-items-center px-6 text-center">
                        <div>
                          <p className="text-[12.5px] font-semibold text-white/70">Gerçek olay bekleniyor...</p>
                          <p className="mt-1 text-[11px] text-white/35">
                            Bağlı TikTok yayınından chat, hediye, beğeni, takip ve sandık zarfları anlık düşer.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/[0.04]">
                        {(snapshot?.events ?? []).map((event) => {
                          const style = EVENT_STYLES[event.type] ?? EVENT_STYLES.join;
                          const Icon = style?.icon ?? Zap;
                          return (
                            <div key={event.id} className="feed-line flex items-start gap-2.5 px-4 py-2 hover:bg-white/[0.02]">
                              <span
                                className="mt-0.5 grid size-6 flex-none place-items-center rounded-md border"
                                style={{ borderColor: `${style?.color}33`, background: `${style?.color}14`, color: style?.color }}
                              >
                                <Icon size={11} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11.5px] leading-relaxed text-white/75">
                                  <span className="font-semibold text-white/90">{event.nickname || event.username || "arena"}</span>{" "}
                                  {event.type === "gift" ? (
                                    <>
                                      <span style={{ color: "#ff9eb2" }}>{event.giftName}</span> × {formatNumber(event.repeatCount)}{" "}
                                      <span className="text-white/35">({formatNumber(event.diamondCount)} elmas)</span>
                                    </>
                                  ) : event.type === "like" ? (
                                    <span style={{ color: "#f9a8d4" }}>{formatNumber(event.repeatCount)} beğeni gönderdi</span>
                                  ) : event.type === "join" ? (
                                    <span className="text-white/40">yayına katıldı</span>
                                  ) : event.type === "follow" ? (
                                    <span className="text-emerald-300">seni takip etti</span>
                                  ) : event.type === "share" ? (
                                    <span className="text-violet-300">yayını paylaştı</span>
                                  ) : event.type === "chest" ? (
                                    <span className="text-amber-300">🎁 {event.giftName} — sandık açıldı!</span>
                                  ) : event.type === "bot" ? (
                                    <span className="text-violet-200">🤖 {event.comment}</span>
                                  ) : (
                                    <span>{event.comment}</span>
                                  )}
                                </p>
                              </div>
                              <span className="mt-0.5 flex-none text-[9.5px] tabular-nums text-white/25">
                                {new Date(event.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 p-4 text-[11.5px]">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="panel-flat p-3">
                        <p className="eyebrow">Feed endpoint</p>
                        <code className="mt-1 block break-all text-[10.5px] text-cyan-200/80">
                          GET /api/live/feed?username={activeSession.username}
                        </code>
                      </div>
                      <div className="panel-flat p-3">
                        <p className="eyebrow">Snapshot endpoint</p>
                        <code className="mt-1 block break-all text-[10.5px] text-cyan-200/80">
                          GET /api/live/sessions/{activeSession.id}
                        </code>
                      </div>
                    </div>
                    <div className="panel-flat p-3">
                      <p className="eyebrow">Connector durumu</p>
                      <p className="mt-1 text-white/55">{connector?.detail}</p>
                      <p className="mt-1 text-white/30">
                        Mod: {activeSession.mode} · roomId: {activeSession.roomId || "dinamik"} · başlangıç:{" "}
                        {timeAgo(activeSession.startedAt)}
                      </p>
                      {activeSession.connectorError ? (
                        <p className="mt-1 text-pink-300">{activeSession.connectorError}</p>
                      ) : null}
                    </div>
                    <div className="panel-flat p-3">
                      <p className="eyebrow">OBS overlay bağlantıları</p>
                      <div className="mt-1 space-y-1">
                        {(snapshot?.goals ?? []).map((item) => (
                          <Link
                            key={item.id}
                            href={`/overlay/${item.slug}`}
                            className="flex items-center justify-between rounded border border-white/[0.07] px-2 py-1 text-[10.5px] text-white/60 hover:border-cyan-300/30 hover:text-cyan-100"
                          >
                            <span>{item.name}</span>
                            <span className="text-white/25">/overlay/{item.slug}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Card>
              <div className="p-8 text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <Radio size={22} />
                </div>
                <h3 className="mt-3 text-[16px] font-bold text-white">Aktif yayın yok</h3>
                <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-white/40">
                  Kullanıcı adı gir ve <span className="text-white/70">Bağlan</span>&apos;a bas. Sistem önce gerçek
                  TikTok durumunu kontrol eder; yayın aktifse Webcast bağlantısı kurulur.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {quickPicks.slice(0, 3).map((creator) => (
                    <button
                      key={creator.username}
                      onClick={() => {
                        setUsername(creator.username);
                      }}
                      className="btn !text-[11px]"
                    >
                      <Play size={12} /> @{creator.username}
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Top gifters"
              subtitle="Oturum bazlı elmas sıralaması"
              icon={<Gem size={14} />}
              action={<Badge tone="pink">Canlı</Badge>}
            />
            <div className="p-4">
              {(snapshot?.leaderboard ?? []).length === 0 ? (
                <p className="text-[11.5px] text-white/35">Henüz hediye kaydı yok.</p>
              ) : (
                <div className="space-y-2.5">
                  {(snapshot?.leaderboard ?? []).map((leader, index) => (
                    <div key={`${leader.username}-${index}`} className="flex items-center gap-2.5">
                      <span
                        className={`grid size-6 flex-none place-items-center rounded-md text-[10px] font-bold ${
                          index === 0
                            ? "bg-gradient-to-br from-cyan-300 to-violet-500 text-black"
                            : index === 1
                              ? "bg-gradient-to-br from-pink-400 to-pink-600 text-white"
                              : "border border-white/10 bg-white/[0.04] text-white/60"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11.5px] font-semibold text-white/85">
                          {leader.nickname || leader.username}
                        </p>
                        <Progress value={leader.diamonds} max={snapshot?.leaderboard[0]?.diamonds || 1} height={3} tone="pink" />
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-bold tabular-nums text-pink-200">{formatNumber(leader.diamonds)}</p>
                        <p className="text-[9px] text-white/30">{leader.gifts} hediye</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Yayın hedefi" subtitle="Overlay ile senkron" icon={<Sparkles size={14} />} />
            <div className="p-4">
              <div className="flex items-end justify-between">
                <p className="text-[24px] font-bold leading-none tabular-nums text-white">{formatNumber(diamonds)}</p>
                <p className="text-[11px] text-white/35">/ {formatNumber(goal)} elmas</p>
              </div>
              <div className="mt-2.5">
                <Progress value={diamonds} max={goal} height={10} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="panel-flat p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-white/30">Süre</p>
                  <p className="mt-0.5 font-semibold text-white/80">{snapshot?.overview.durationMin ?? 0} dk</p>
                </div>
                <div className="panel-flat p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-white/30">Tahmini gelir</p>
                  <p className="mt-0.5 font-semibold text-emerald-300">{formatMoney(snapshot?.overview.estimatedTry ?? 0)}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Link href="/bot" className="btn w-full !text-[11px]">
                  <Zap size={12} /> Uyarı kuralları
                </Link>
                <Link href="/kutuphane" className="btn w-full !text-[11px]">
                  Overlay <ArrowUpRight size={11} />
                </Link>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Son oturumlar" subtitle="Tüm yayın geçmişi" />
            <div className="max-h-[300px] divide-y divide-white/[0.05] overflow-y-auto">
              {sessions.length === 0 ? (
                <p className="p-4 text-[11.5px] text-white/35">Henüz oturum açılmadı.</p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => void fetchSnapshot(session.id)}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-white/[0.03]"
                  >
                    <span className={`size-1.5 flex-none rounded-full ${session.status === "active" ? "bg-pink-500" : "bg-white/20"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] font-semibold text-white/80">@{session.username}</p>
                      <p className="text-[9.5px] text-white/30">
                        {formatNumber(session.diamonds)} elmas · {timeAgo(session.startedAt)}
                      </p>
                    </div>
                    <span className="chip !text-[9px]">{session.mode}</span>
                  </button>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
