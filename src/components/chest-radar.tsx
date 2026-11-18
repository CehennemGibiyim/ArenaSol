"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Bell,
  BellRing,
  Check,
  Copy,
  Download,
  ExternalLink,
  Gift,
  Languages,
  Loader2,
  Pause,
  PictureInPicture2,
  Play,
  QrCode,
  Radar as RadarIcon,
  RefreshCw,
  Search,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Badge, Card, CardHeader, Progress, Sparkline } from "@/components/ui";
import { formatNumber } from "@/lib/format";

type ChestRow = {
  id: number;
  envelopeId: string;
  roomId: string;
  username: string;
  nickname: string;
  title: string;
  kind: string;
  variant: string;
  skinId: number;
  businessType: number;
  coins: number;
  slots: number;
  joined: number;
  viewers: number;
  opensAt: string | null;
  detectedAt: string;
  status: string;
  source: string;
  claimedBy: string;
  claimedAt: string | null;
  ratio: number;
  secondsLeft: number;
  derivedStatus: string;
  viewersLtSlots: boolean;
  hasEnvelope: boolean;
};

type FlowRow = {
  id: number;
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
  kind: "live";
  variant: "flow";
  coins: number;
  slots: number;
  joined: number;
  ratio: number;
  secondsLeft: number;
  derivedStatus: string;
  viewersLtSlots: boolean;
};

type LiveRoomRow = { source: string; region: string; lastSeenAt: string; id: number; username: string; roomId: string; nickname: string; title: string; viewers: number; monitoring: boolean; jobStatus: string | null; nextAttemptAt: string | null };

type Tab = { id: string; label: string; filter: Record<string, unknown> };
type SortOption = { key: string; label: string };

const LABELS = {
  tr: {
    search: "Yayıncı ara...",
    open: "CANLI'yı Aç",
    claim: "Topladım",
    claimed: "Toplandı",
    qr: "QR ile katıl",
    copy: "Kopyala",
    copied: "Kopyalandı",
    coins: "Jeton",
    slots: "Kontenjan",
    joined: "Katılan",
    ratio: "Oran",
    viewers: "İzleyici",
    perMin: "Jeton/dk",
    senders: "Gönderen",
    opensIn: "Açılışa kalan",
    openNow: "AÇIK",
    scan: "Şimdi tara",
    sort: "Sıralama",
    filters: "Gelişmiş filtreler",
    pause: "Duraklat",
    resume: "Devam",
    fixed: "Sabit sıra",
    minCoins: "Min jeton",
    maxCoins: "Max jeton",
    minRatio: "Min oran",
    maxRatio: "Max oran",
    minSlots: "Min kontenjan",
    maxSlots: "Max kontenjan",
    minJoined: "Min katılan",
    minViewers: "Min izleyici",
    maxViewers: "Max izleyici",
    minTime: "Min kalan (sn)",
    maxTime: "Max kalan (sn)",
    hideLate: "Geçenleri gizle (sn)",
    viewersLtSlots: "İzleyici < kontenjan",
    soundAt: "Ses eşiği (sn)",
    apply: "Uygula",
    reset: "Sıfırla",
    detail: "Sandık detayı",
    chest: "Sandık",
    bag: "Çanta",
    flow: "Jeton akışı",
    free: "Tüm premium özellikler açık",
  },
  en: {
    search: "Search creator...",
    open: "Open LIVE",
    claim: "Claimed",
    claimed: "Claimed",
    qr: "Join via QR",
    copy: "Copy",
    copied: "Copied",
    coins: "Coins",
    slots: "Slots",
    joined: "Joined",
    ratio: "Ratio",
    viewers: "Viewers",
    perMin: "Coins/min",
    senders: "Senders",
    opensIn: "Opens in",
    openNow: "OPEN",
    scan: "Scan now",
    sort: "Sort",
    filters: "Advanced filters",
    pause: "Pause",
    resume: "Resume",
    fixed: "Fixed order",
    minCoins: "Min coins",
    maxCoins: "Max coins",
    minRatio: "Min ratio",
    maxRatio: "Max ratio",
    minSlots: "Min slots",
    maxSlots: "Max slots",
    minJoined: "Min joined",
    minViewers: "Min viewers",
    maxViewers: "Max viewers",
    minTime: "Min left (s)",
    maxTime: "Max left (s)",
    hideLate: "Hide late (s)",
    viewersLtSlots: "Viewers < slots",
    soundAt: "Sound at (s)",
    apply: "Apply",
    reset: "Reset",
    detail: "Chest detail",
    chest: "Chest",
    bag: "Bag",
    flow: "Coin flow",
    free: "All premium features unlocked",
  },
  vi: {
    search: "Tìm nhà sáng tạo...",
    open: "Mở LIVE",
    claim: "Đã nhận",
    claimed: "Đã nhận",
    qr: "Tham gia bằng QR",
    copy: "Sao chép",
    copied: "Đã chép",
    coins: "Xu",
    slots: "Suất",
    joined: "Đã tham gia",
    ratio: "Tỷ lệ",
    viewers: "Người xem",
    perMin: "Xu/phút",
    senders: "Người tặng",
    opensIn: "Mở sau",
    openNow: "MỞ",
    scan: "Quét ngay",
    sort: "Sắp xếp",
    filters: "Bộ lọc nâng cao",
    pause: "Tạm dừng",
    resume: "Tiếp tục",
    fixed: "Cố định",
    minCoins: "Xu tối thiểu",
    maxCoins: "Xu tối đa",
    minRatio: "Tỷ lệ tối thiểu",
    maxRatio: "Tỷ lệ tối đa",
    minSlots: "Suất tối thiểu",
    maxSlots: "Suất tối đa",
    minJoined: "Tham gia tối thiểu",
    minViewers: "Người xem tối thiểu",
    maxViewers: "Người xem tối đa",
    minTime: "Còn lại tối thiểu (giây)",
    maxTime: "Còn lại tối đa (giây)",
    hideLate: "Ẩn muộn (giây)",
    viewersLtSlots: "Người xem < suất",
    soundAt: "Âm thanh tại (giây)",
    apply: "Áp dụng",
    reset: "Đặt lại",
    detail: "Chi tiết rương",
    chest: "Rương",
    bag: "Túi",
    flow: "Dòng xu",
    free: "Tất cả tính năng premium đã mở",
  },
} as const;

type Lang = keyof typeof LABELS;
type Dict = Record<keyof (typeof LABELS)["tr"], string>;

const EMPTY_FILTERS = {
  min_coins: "",
  max_coins: "",
  min_ratio: "",
  max_ratio: "",
  min_slots: "",
  max_slots: "",
  min_joined: "",
  min_viewers: "",
  max_viewers: "",
  min_time: "",
  max_time: "",
  hide_late: "",
  viewers_lt_slots: false,
};

function fmtClock(sec: number) {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m < 60) return `${m}:${String(r).padStart(2, "0")}`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

function timerColor(left: number) {
  if (left <= 0) return "#ff3b5c";
  if (left <= 30) return "#ffa62b";
  return "#2ee6a8";
}

function variantLabel(row: ChestRow | FlowRow, dict: Dict) {
  if (row.kind === "live") return dict.flow;
  if (row.kind === "bag") return `${dict.bag} ${row.variant}`;
  if (row.variant === "gold") return "Altın sandık";
  if (row.variant === "hanging") return "Askıda sandık";
  return dict.chest;
}

export function ChestRadar({ initialQuery = "", mini = false }: { initialQuery?: string; mini?: boolean }) {
  const [chests, setChests] = useState<ChestRow[]>([]);
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [liveRooms, setLiveRooms] = useState<LiveRoomRow[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [sortOptions, setSortOptions] = useState<SortOption[]>([]);
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<{ chests: number; upcoming: number; claimed: number; coins: number; flowRooms: number; flowDiamonds: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("chest");
  const [query, setQuery] = useState(initialQuery);
  const [lang, setLang] = useState<Lang>("tr");
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS });
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState("opens_at");
  const [desc, setDesc] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fixedOrder, setFixedOrder] = useState(false);
  const [sound, setSound] = useState(true);
  const [soundAt, setSoundAt] = useState(60);
  const [notify, setNotify] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState("");
  const [qrChest, setQrChest] = useState<ChestRow | null>(null);
  const [detail, setDetail] = useState<ChestRow | null>(null);
  const [copied, setCopied] = useState("");
  const [now, setNow] = useState(Date.now());
  const [scanRegionInfo, setScanRegionInfo] = useState<{
    scanned?: number;
    covered?: string;
    ok?: number;
    failed?: number;
    rooms?: number;
    top?: Array<{ region: string; label: string; rooms: number; ok: boolean }>;
    errors?: string[];
  } | null>(null);
  const [regionsList, setRegionsList] = useState<Array<{ code: string; label: string }>>([]);
  const [eulerOn, setEulerOn] = useState(false);
  const [regionsFilter, setRegionsFilter] = useState<string[]>([]);
  const frozenRef = useRef<ChestRow[] | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const audioRef = useRef<AudioContext | null>(null);
  const dict = LABELS[lang] as Dict;

  const load = useCallback(async () => {
    if (paused) return;
    try {
      const params = new URLSearchParams();
      const activeTab = tabs.find((item) => item.id === tab);
      if (activeTab) {
        for (const [key, value] of Object.entries(activeTab.filter)) {
          if (Array.isArray(value)) params.set(key, value.join(","));
          else if (value !== undefined) params.set(key, String(value));
        }
      }
      for (const [key, value] of Object.entries(filters)) {
        if (value === "" || value === false) continue;
        params.set(key, String(value));
      }
      if (query.trim()) params.set("q", query.trim());
      params.set("sort", sort);
      params.set("desc", desc ? "1" : "0");
      const response = await fetch(`/api/chests?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as {
        chests?: ChestRow[];
        flows?: FlowRow[];
        live_rooms?: LiveRoomRow[];
        tabs?: Tab[];
        sort_options?: SortOption[];
        tab_counts?: Record<string, number>;
        stats?: typeof stats;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Veri alınamadı");
      let nextChests = data.chests ?? [];
      if (fixedOrder && frozenRef.current) {
        const order = new Map(frozenRef.current.map((item, index) => [item.envelopeId || String(item.id), index]));
        nextChests = [...nextChests].sort(
          (a, b) => (order.get(a.envelopeId || String(a.id)) ?? 999) - (order.get(b.envelopeId || String(b.id)) ?? 999),
        );
      } else {
        frozenRef.current = nextChests;
      }
      setChests(nextChests);
      setFlows(data.flows ?? []);
       setLiveRooms(data.live_rooms ?? []);
      if (data.tabs?.length && tabs.length === 0) setTabs(data.tabs);
      if (data.sort_options?.length && sortOptions.length === 0) setSortOptions(data.sort_options);
      if (data.tab_counts) setTabCounts(data.tab_counts);
      if (data.stats) setStats(data.stats);

      for (const chest of nextChests) {
        const key = chest.envelopeId || String(chest.id);
        if (seenRef.current.has(key)) continue;
        seenRef.current.add(key);
        if (seenRef.current.size <= 1 || chest.ratio < 1) continue;
        if (sound && soundAt > 0 && chest.secondsLeft <= soundAt) beep();
        if (notify && "Notification" in window && Notification.permission === "granted") {
          new Notification("🎁 Sandık açılıyor", {
            body: `@${chest.username} · ${formatNumber(chest.coins)} jeton · ${chest.slots} kişi · oran ${chest.ratio}`,
          });
        }
      }
      setError("");
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, tabs, filters, sound, soundAt, notify, sort, desc, query, paused, fixedOrder, sortOptions.length]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notify) return;
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  }, [notify]);

  useEffect(() => {
    fetch("/api/radar/scan?regions=list", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { regions?: Array<{ code: string; label: string }>; eulerAvailable?: boolean }) => {
        if (data.regions?.length) setRegionsList(data.regions);
        setEulerOn(Boolean(data.eulerAvailable));
      })
      .catch(() => null);
  }, []);

  const beep = () => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const ctx = audioRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 1180;
      gain.gain.value = 0.045;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch {
      /* ses kapalı */
    }
  };

  const scan = async (regions?: string[]) => {
    setScanning(true);
    const scopeLabel = !eulerOn ? "sınırlı açık liste + kayıtlı hesaplar" : regions?.length ? `${regions.length} bölge` : "TÜM DÜNYA";
    setScanInfo(`Keşif başlatıldı (${scopeLabel}). Adaylar TikTok'tan canlılık için doğrulanıyor...`);
    try {
      const response = await fetch("/api/radar/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan", ...(regions?.length ? { regions } : {}) }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        result?: { checked: number; liveFound: number; chestsFound: number; source: string; error: string };
        regionsScanned?: number;
        regionsCovered?: string;
        regionSummary?: { ok: number; failed: number; rooms: number; byRegion: Array<{ region: string; label: string; rooms: number; ok: boolean }> };
        errors?: string[];
        error?: string;
      };
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || data.result?.error || "Tarama başarısız");
      }
      const result = data.result;
      const summary = data.regionSummary;
      setScanRegionInfo({
        scanned: data.regionsScanned ?? 0,
        covered: data.regionsCovered ?? "—",
        ok: summary?.ok ?? 0,
        failed: summary?.failed ?? 0,
        rooms: summary?.rooms ?? 0,
        top: (summary?.byRegion ?? []).filter((r) => r.rooms > 0).slice(0, 8),
        errors: data.errors ?? [],
      });
      setScanInfo(
        result
          ? `(${data.regionsCovered ?? "?"}) ${result.checked} hesap · ${result.liveFound} canlı · ${result.chestsFound} sandık · ${result.source}${result.error ? ` · ${result.error}` : ""}`
          : "Tarama tamamlandı.",
      );
      frozenRef.current = null;
      await load();
    } catch (scanError) {
      setScanInfo(`Tarama hatası: ${(scanError as Error).message}`);
    } finally {
      setScanning(false);
    }
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  };

  const claim = async (chest: ChestRow) => {
    await fetch(`/api/chests/${chest.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "claimed", claimedBy: "manuel" }),
    });
    await load();
  };

  const openPip = () => {
    const width = 420;
    const height = 720;
    window.open(
      `/sandik?mini=1`,
      "arenaMiniRadar",
      `width=${width},height=${height},menubar=no,toolbar=no,location=no,status=no,resizable=yes,alwaysRaised=yes`,
    );
  };

  const rows = useMemo(() => {
    if (tab === "flow") return flows as Array<ChestRow | FlowRow>;
    // Süresi geçen sandıklar listede tutulmaz (90 sn tolerans; toplananlar kalır).
    const live = chests.filter((row) => row.status === "claimed" ||
      !row.opensAt || new Date(row.opensAt).getTime() > now - 90_000);
    return live as Array<ChestRow | FlowRow>;
  }, [tab, chests, flows, now]);

  if (mini) {
    return (
      <div className="space-y-2 bg-[#050509] p-2">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200">
            <span className="live-dot !size-1.5" /> Arena Mini Radar
          </span>
          <span className="text-[9px] text-white/30">{chests.length} sandık</span>
        </div>
        {chests.slice(0, 12).map((chest) => {
          const left = Math.max(0, Math.round((new Date(chest.opensAt ?? Date.now()).getTime() - now) / 1000));
          return (
            <div key={chest.id} className="rounded-lg border border-white/[0.09] bg-white/[0.03] p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[11px] font-semibold text-white/85">@{chest.username}</p>
                <span className="text-[12px] font-bold tabular-nums" style={{ color: timerColor(left) }}>
                  {left > 0 ? fmtClock(left) : "●"}
                </span>
              </div>
              <p className="text-[9.5px] text-white/40">
                {formatNumber(chest.coins)} jeton · {chest.slots} kişi · oran {chest.ratio} · {formatNumber(chest.viewers)} izleyici
              </p>
              <a
                href={`https://www.tiktok.com/@${chest.username}/live`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block rounded-md border border-cyan-300/30 bg-cyan-300/10 py-1 text-center text-[9.5px] font-semibold text-cyan-100"
              >
                {dict.open}
              </a>
            </div>
          );
        })}
        {chests.length === 0 ? <p className="p-3 text-center text-[10px] text-white/35">Uygun sandık yok</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Tespit edilen sandık", value: stats?.chests ?? 0, hint: `${stats?.upcoming ?? 0} açılış bekliyor` },
          { label: "Sandık jetonu", value: stats?.coins ?? 0, hint: `${stats?.claimed ?? 0} toplandı` },
          { label: "Akış odası", value: stats?.flowRooms ?? 0, hint: `${formatNumber(stats?.flowDiamonds ?? 0)} hediye elması ölçüldü` },
          { label: "Listelenen", value: rows.length, hint: `${tabs.length} hazır sekme` },
        ].map((stat) => (
          <div key={stat.label} className="panel p-3.5">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-white/35">{stat.label}</p>
            <p className="mt-1.5 text-[22px] font-bold leading-none tabular-nums text-white">{formatNumber(stat.value)}</p>
            <p className="mt-1 text-[10px] text-white/35">{stat.hint}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-pink-400/25 bg-pink-500/[0.08] px-4 py-2.5 text-[12px] text-pink-100">{error}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="emerald">{dict.free}</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-1.5 py-1">
            <Languages size={12} className="text-white/30" />
            {(["tr", "en", "vi"] as Lang[]).map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                className={`rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase ${
                  lang === code ? "bg-cyan-300/20 text-cyan-100" : "text-white/35"
                }`}
              >
                {code}
              </button>
            ))}
          </div>
          <button
            onClick={() => setSound((value) => !value)}
            className={`btn !px-2 !py-1.5 ${sound ? "!border-cyan-300/40 !text-cyan-100" : ""}`}
            aria-label="Sesli uyarı"
          >
            {sound ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>
          <button
            onClick={() => setNotify((value) => !value)}
            className={`btn !px-2 !py-1.5 ${notify ? "!border-cyan-300/40 !text-cyan-100" : ""}`}
            aria-label="Tarayıcı bildirimi"
          >
            {notify ? <BellRing size={13} /> : <Bell size={13} />}
          </button>
          <button
            onClick={() => setPaused((value) => !value)}
            className={`btn !px-2 !py-1.5 ${paused ? "!border-amber-300/40 !text-amber-200" : ""}`}
            aria-label={paused ? dict.resume : dict.pause}
            title={paused ? dict.resume : dict.pause}
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
          </button>
          <button
            onClick={() => {
              setFixedOrder((value) => !value);
              frozenRef.current = null;
            }}
            className={`btn !px-2 !py-1.5 ${fixedOrder ? "!border-cyan-300/40 !text-cyan-100" : ""}`}
            title={dict.fixed}
          >
            {fixedOrder ? <ArrowDownWideNarrow size={13} /> : <ArrowUpNarrowWide size={13} />}
          </button>
          <button onClick={openPip} className="btn !px-2 !py-1.5" aria-label="Mini pencere">
            <PictureInPicture2 size={13} />
          </button>
          <a href="/api/chests/export" className="btn !px-2 !py-1.5" aria-label="CSV indir">
            <Download size={13} />
          </a>
          <button onClick={() => setShowFilters((value) => !value)} className="btn !px-2 !py-1.5" aria-label={dict.filters}>
            <Settings2 size={13} />
          </button>
          <button onClick={() => void load()} className="btn !px-2 !py-1.5" aria-label="Yenile">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => void scan()} disabled={scanning} className="btn btn-primary !py-1.5 !text-[11.5px]">
            {scanning ? <Loader2 size={13} className="animate-spin" /> : <RadarIcon size={13} />}
            🌍 {dict.scan}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(tabs.length ? tabs : [{ id: "chest", label: "Sandık", filter: { kind: "chest" } }]).map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setTab(item.id);
              frozenRef.current = null;
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition ${
              tab === item.id
                ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"
            }`}
          >
            {item.label}
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] tabular-nums">{tabCounts[item.id] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-[10px] border border-white/10 bg-black/30 px-2.5 py-1.5">
          <Search size={13} className="text-white/30" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={dict.search}
            className="w-full bg-transparent text-[12px] text-white placeholder:text-white/25 focus:outline-none"
          />
          {query ? (
            <button onClick={() => setQuery("")} aria-label="Temizle" className="text-white/30 hover:text-white/70">
              <X size={12} />
            </button>
          ) : null}
        </div>
        <select value={sort} onChange={(event) => setSort(event.target.value)} className="input !w-auto !py-1.5 !text-[11.5px]">
          {(sortOptions.length ? sortOptions : [{ key: "opens_at", label: dict.opensIn }]).map((item) => (
            <option key={item.key} value={item.key}>
              {dict.sort}: {item.label}
            </option>
          ))}
        </select>
        <button onClick={() => setDesc((value) => !value)} className="btn !px-2 !py-1.5" title={desc ? "Azalan" : "Artan"}>
          {desc ? <ArrowDownWideNarrow size={13} /> : <ArrowUpNarrowWide size={13} />}
        </button>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1">
          <span className="text-[9.5px] uppercase tracking-wider text-white/30">{dict.soundAt}</span>
          <input
            type="number"
            value={soundAt}
            onChange={(event) => setSoundAt(Math.max(0, Number(event.target.value) || 0))}
            className="w-12 bg-transparent text-[11.5px] text-white focus:outline-none"
          />
        </div>
        <span className="chip">{paused ? "DURAKLATILDI" : "CANLI GÜNCELLEME"}</span>
        {fixedOrder ? <span className="chip !border-cyan-300/30 !text-cyan-100">SABİT SIRA</span> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.02] p-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">Tarama kapsamı</span>
        <button
          onClick={() => setRegionsFilter([])}
          className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold transition ${
            regionsFilter.length === 0
              ? "border-cyan-300/50 bg-cyan-300/15 text-cyan-100"
              : "border-white/10 bg-white/[0.03] text-white/50"
          }`}
        >
          🌍 Tüm ülkeler ({regionsList.length || 130}+)
        </button>
        <span className="text-[10px] text-white/25">veya seç:</span>
        <select
          multiple
          value={regionsFilter}
          onChange={(event) => {
            const selected = Array.from(event.target.selectedOptions).map((option) => option.value);
            setRegionsFilter(selected);
          }}
          className="input !h-[52px] !w-auto !min-w-[190px] !py-1 !text-[10.5px]"
          size={3}
        >
          {regionsList.map((item) => (
            <option key={item.code} value={item.code}>
              {item.label} ({item.code})
            </option>
          ))}
        </select>
        <button
          onClick={() => void scan(regionsFilter.length ? regionsFilter : undefined)}
          disabled={scanning}
          className="btn btn-primary !py-1.5 !text-[11.5px]"
        >
          {scanning ? <Loader2 size={13} className="animate-spin" /> : <RadarIcon size={13} />}
          {!eulerOn ? "Açık liste + kayıtlıları tara" : regionsFilter.length ? `${regionsFilter.length} bölgeyi tara` : "TÜM DÜNYAYI TARA"}
        </button>
        {scanRegionInfo ? (
          <span className="chip !text-[9.5px]">
            {scanRegionInfo.ok} bölge OK · {scanRegionInfo.failed} hata · {scanRegionInfo.rooms} canlı oda
          </span>
        ) : null}
      </div>

      {scanRegionInfo?.top?.length ? (
        <div className="rounded-xl border border-white/[0.09] bg-white/[0.02] p-2.5">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/40">Bölge sonuçları (canlı oda sayıları)</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {scanRegionInfo.top.map((region) => (
              <span
                key={region.region}
                className={`chip !text-[9.5px] ${region.ok ? "!border-emerald-300/25 !text-emerald-100" : "!border-pink-400/30 !text-pink-200"}`}
              >
                {region.label} · {region.rooms}
              </span>
            ))}
          </div>
          {scanRegionInfo.errors?.length ? (
            <p className="mt-1.5 text-[9.5px] leading-relaxed text-white/30">
              {scanRegionInfo.errors.slice(0, 3).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      {scanInfo ? (
        <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-[11px] text-white/50">{scanInfo}</p>
      ) : null}

      {showFilters ? (
        <Card>
          <CardHeader title={dict.filters} subtitle="Jeton, oran, kontenjan, katılan, izleyici ve süre" />
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
            {(
              [
                ["min_coins", dict.minCoins],
                ["max_coins", dict.maxCoins],
                ["min_ratio", dict.minRatio],
                ["max_ratio", dict.maxRatio],
                ["min_slots", dict.minSlots],
                ["max_slots", dict.maxSlots],
                ["min_joined", dict.minJoined],
                ["min_viewers", dict.minViewers],
                ["max_viewers", dict.maxViewers],
                ["min_time", dict.minTime],
                ["max_time", dict.maxTime],
                ["hide_late", dict.hideLate],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="label" htmlFor={`f-${key}`}>
                  {label}
                </label>
                <input
                  id={`f-${key}`}
                  type="number"
                  value={filters[key]}
                  onChange={(event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }))}
                  className="input !py-1.5 !text-[11.5px]"
                />
              </div>
            ))}
            <label className="flex items-end gap-2 pb-1 text-[11px] text-white/55">
              <input
                type="checkbox"
                checked={filters.viewers_lt_slots}
                onChange={(event) => setFilters((prev) => ({ ...prev, viewers_lt_slots: event.target.checked }))}
                className="size-3.5 accent-cyan-300"
              />
              {dict.viewersLtSlots}
            </label>
            <div className="flex items-end gap-2">
              <button onClick={() => setFilters({ ...EMPTY_FILTERS })} className="btn !py-1.5 !text-[11px]">
                {dict.reset}
              </button>
            </div>
          </div>
        </Card>
      ) : null}

      {liveRooms.length > 0 && (
        <section className="mb-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h2 className="text-[13px] font-semibold text-white">Doğrulanmış canlı yayınlar</h2>
              <p className="text-[10px] text-white/40">Sandık tespit edilmese de canlı odalar burada kalır. Hediye elması sandık jetonu değildir.</p></div>
            <span className="chip">{liveRooms.length} canlı</span>
          </div>
          <div className="mb-3 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-[10px] leading-relaxed text-white/50">
            {eulerOn
              ? "Bölge keşfi açık (EulerStream Business anahtarı)."
              : "Anahtarsız dünya feed'i yok (TikTok uçları 404 / 'url doesn't match' / challenge döndürdü). Adaylar kayıtlı hesaplar, sabitlenenler, daha önce bulunan odalar ve Tik.Tools'un en fazla 10 yayınlık açık listesinden gelir; her aday TikTok'un kendi check_alive ucuyla doğrulanır. Daha geniş kapsam için ücretsiz EulerStream anahtarı bağlantı kotasını artırır."}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {liveRooms.filter((room) => !query || `${room.username} ${room.nickname}`.toLowerCase().includes(query.toLowerCase())).map((room) => (
              <a key={room.id} href={`https://www.tiktok.com/@${room.username}/live`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 hover:border-cyan-300/35">
                <div className="min-w-0"><p className="truncate text-[12px] font-semibold text-white">🔴 @{room.username}</p>
                  <p className="truncate text-[10px] text-white/40">{room.title || room.nickname || 'TikTok LIVE'} · {formatNumber(room.viewers)} izleyici</p>
                  <p className="truncate text-[9px] text-white/30">Kaynak: {({'public-sample':'Açık liste (Tik.Tools)', euler:'EulerStream', pinned:'Sabitlenen', targets:'Kayıtlı hesap', manual:'Elle eklendi', check:'Canlı kontrolü', discovered:'Önceki keşif'} as Record<string,string>)[room.source] ?? room.source}{room.region ? ` · ${room.region}` : ''} · oda {room.roomId} · doğrulama {new Date(room.lastSeenAt).toLocaleTimeString('tr-TR')}</p></div>
                <span className="shrink-0 rounded-full bg-cyan-300/10 px-2 py-1 text-[10px] text-cyan-200">
                  {room.jobStatus === 'listening' ? 'Dinleniyor' : room.jobStatus === 'retry' ? 'Yeniden denenecek' : room.jobStatus === 'queued' ? 'Sırada' : 'Canlı doğrulandı'}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}
      {loading && rows.length === 0 ? (
        <div className="panel grid place-items-center p-14 text-[12px] text-white/40">
          <Loader2 size={16} className="mb-2 animate-spin" /> Sandıklar yükleniyor...
        </div>
      ) : rows.length === 0 ? (
        <div className="panel grid place-items-center p-14 text-center">
          <Gift size={22} className="mb-2 text-cyan-200/60" />
          <p className="text-[13px] font-semibold text-white/75">Uygun sandık yok</p>
          <p className="mt-1 max-w-sm text-[11.5px] text-white/35">
            Bu pencerede sandık zarfı yakalanmadı. Canlı yayınlar yukarıda listelenir; hesap eklemek için Canlı Yayınlar sayfasından yayında olan
            yayıncıları ekleyip sabitle. EULER_API_KEY tanımlıysa dünya geneli keşif otomatik çalışır.
          </p>
          <button onClick={() => void scan()} className="btn btn-primary mt-3 !text-[11.5px]">
            <RadarIcon size={13} /> Şimdi keşfet
          </button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => {
            const isFlow = row.kind === "live";
            const opensAt = isFlow ? null : (row as ChestRow).opensAt;
            const left = isFlow ? 0 : Math.max(0, Math.round((new Date(opensAt ?? Date.now()).getTime() - now) / 1000));
            const isOpen = !isFlow && left <= 0;
            const isClaimed = !isFlow && (row as ChestRow).status === "claimed";
            const webUrl = `https://www.tiktok.com/@${row.username}/live`;
            const deepUrl = row.roomId && /^\d{10,20}$/.test(row.roomId) ? `snssdk1233://live?room_id=${row.roomId}` : null;
            return (
              <div
                key={`${row.kind}-${row.id}`}
                className={`panel relative overflow-hidden p-4 transition ${
                  isOpen ? "border-pink-400/40" : row.variant === "gold" ? "border-amber-300/30" : ""
                }`}
              >
                {isOpen ? <div className="pointer-events-none absolute -right-8 -top-10 size-24 rounded-full bg-pink-500/20 blur-2xl" /> : null}
                <div className="relative flex items-start gap-3">
                  <span
                    className={`grid size-10 flex-none place-items-center rounded-xl text-[15px] ${
                      isFlow
                        ? "border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"
                        : row.variant === "gold"
                          ? "bg-gradient-to-br from-amber-300 to-amber-600 text-black"
                          : "bg-gradient-to-br from-pink-500/70 to-violet-500/70 text-white"
                    }`}
                  >
                    {isFlow ? "💎" : row.kind === "bag" ? "👜" : "🎁"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[13px] font-semibold text-white/90">@{row.username}</p>
                      <Badge tone={isFlow ? "cyan" : row.variant === "gold" ? "amber" : "pink"}>{variantLabel(row, dict)}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-white/40">{row.title || row.nickname || "TikTok LIVE"}</p>
                    <p className="mt-0.5 text-[10px] text-white/30">
                      {formatNumber(row.viewers)} {dict.viewers} · {isFlow ? "hediye elması (sandık değil)" : `kaynak: ${(row as ChestRow).source}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[19px] font-bold leading-none tabular-nums" style={{ color: isFlow ? "#2ee6a8" : timerColor(left) }}>
                      {isFlow ? "●" : isOpen ? "●" : fmtClock(left)}
                    </p>
                    <p className="mt-0.5 text-[9px] uppercase tracking-wider text-white/30">
                      {isFlow ? "canlı" : isOpen ? dict.openNow : dict.opensIn}
                    </p>
                  </div>
                </div>

                <div className="relative mt-3 grid grid-cols-3 gap-2">
                  <div className="panel-flat p-2 text-center">
                    <p className="text-[14px] font-bold tabular-nums text-white">{formatNumber(isFlow ? (row as FlowRow).diamonds : row.coins)}</p>
                    <p className="text-[8.5px] uppercase tracking-wider text-white/30">{isFlow ? "Hediye elması" : dict.coins}</p>
                  </div>
                  <div className="panel-flat p-2 text-center">
                    <p className="text-[14px] font-bold tabular-nums text-cyan-200">{isFlow ? "—" : row.ratio}</p>
                    <p className="text-[8.5px] uppercase tracking-wider text-white/30">{isFlow ? "Sandık oranı yok" : dict.ratio}</p>
                  </div>
                  <div className="panel-flat p-2 text-center">
                    <p className="text-[14px] font-bold tabular-nums text-white">{formatNumber(row.slots)}</p>
                    <p className="text-[8.5px] uppercase tracking-wider text-white/30">{isFlow ? dict.senders : dict.slots}</p>
                  </div>
                </div>

                {!isFlow ? (
                  <div className="relative mt-2.5">
                    <Progress
                      value={row.viewers}
                      max={Math.max(row.slots, row.viewers, 1)}
                      tone={row.viewersLtSlots ? "emerald" : "pink"}
                      height={4}
                    />
                    <p className="mt-1 flex items-center justify-between text-[9px] text-white/30">
                      <span>
                        {formatNumber(row.viewers)} {dict.viewers} / {formatNumber(row.slots)} {dict.slots}
                        {row.viewersLtSlots ? " · şans yüksek" : ""}
                      </span>
                      <span>
                        {dict.joined}: {formatNumber((row as ChestRow).joined)}
                      </span>
                    </p>
                  </div>
                ) : null}

                {isFlow && (row as FlowRow).topSenders?.length ? (
                  <div className="relative mt-2.5 flex flex-wrap gap-1">
                    {(row as FlowRow).topSenders.slice(0, 3).map(([user, diamonds]) => (
                      <span key={user} className="chip !text-[9px]">
                        {user} · {formatNumber(diamonds)}
                      </span>
                    ))}
                    <span className="chip !text-[9px]">
                      {formatNumber((row as FlowRow).diamondsPerMin)} {dict.perMin}
                    </span>
                  </div>
                ) : null}

                <div className="relative mt-3 flex flex-wrap gap-1.5">
                  <a href={deepUrl ?? webUrl} target="_blank" rel="noreferrer" className="btn btn-primary flex-1 !py-2 !text-[11.5px]">
                    <Play size={12} /> {dict.open}
                  </a>
                  {!isFlow ? (
                    <>
                      <button onClick={() => setQrChest(row as ChestRow)} className="btn !px-2.5 !py-2" aria-label={dict.qr}>
                        <QrCode size={13} />
                      </button>
                      <button onClick={() => setDetail(row as ChestRow)} className="btn !px-2.5 !py-2 !text-[10.5px]">
                        {dict.detail.split(" ")[0]}
                      </button>
                      <button onClick={() => void copy(webUrl, `link-${row.id}`)} className="btn !px-2.5 !py-2" aria-label={dict.copy}>
                        {copied === `link-${row.id}` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                      {isClaimed ? (
                        <span className="chip !border-emerald-300/30 !bg-emerald-400/10 !text-emerald-200">
                          <Check size={11} /> {dict.claimed}
                        </span>
                      ) : (
                        <button onClick={() => void claim(row as ChestRow)} className="btn !px-2.5 !py-2 !text-[10.5px]">
                          {dict.claim}
                        </button>
                      )}
                    </>
                  ) : (
                    <a href={webUrl} target="_blank" rel="noreferrer" className="btn !px-2.5 !py-2" aria-label={dict.open}>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detail ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button className="flex-1 bg-black/70 backdrop-blur-sm" onClick={() => setDetail(null)} aria-label="Kapat" />
          <div className="h-full w-full max-w-[420px] overflow-y-auto border-l border-white/10 bg-[#08080f] p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">{dict.detail}</p>
                <h3 className="mt-1 text-[18px] font-bold text-white">@{detail.username}</h3>
                <p className="mt-0.5 text-[11.5px] text-white/40">{detail.title || "TikTok LIVE"}</p>
              </div>
              <button onClick={() => setDetail(null)} className="text-white/40 hover:text-white" aria-label="Kapat">
                <X size={17} />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                [dict.coins, formatNumber(detail.coins)],
                [dict.slots, formatNumber(detail.slots)],
                [dict.ratio, String(detail.ratio)],
                [dict.viewers, formatNumber(detail.viewers)],
                [dict.joined, formatNumber(detail.joined)],
                ["Kalan süre", detail.secondsLeft > 0 ? fmtClock(detail.secondsLeft) : "AÇIK"],
              ].map(([label, value]) => (
                <div key={label} className="panel-flat p-2.5">
                  <p className="text-[9px] uppercase tracking-wider text-white/30">{label}</p>
                  <p className="mt-0.5 text-[14px] font-bold tabular-nums text-white/90">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1.5 text-[11px]">
              {[
                ["Tür", variantLabel(detail, dict)],
                ["Durum", detail.status],
                ["Kaynak", detail.source],
                ["Skin ID", String(detail.skinId)],
                ["Business type", String(detail.businessType)],
                ["Envelope ID", detail.envelopeId || "—"],
                ["Room ID", detail.roomId || "—"],
                ["Açılış", detail.opensAt ? new Date(detail.opensAt).toLocaleString("tr-TR") : "—"],
                ["Tespit", new Date(detail.detectedAt).toLocaleString("tr-TR")],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-1.5">
                  <span className="text-white/35">{label}</span>
                  <code className="max-w-[210px] truncate text-[10.5px] text-white/65">{value}</code>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <a
                href={`https://www.tiktok.com/@${detail.username}/live`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary flex-1 !text-[11.5px]"
              >
                <Play size={12} /> {dict.open}
              </a>
              <button onClick={() => void claim(detail)} className="btn flex-1 !text-[11.5px]">
                <Check size={12} /> {dict.claim}
              </button>
            </div>
            <div className="mt-3 grid place-items-center rounded-xl bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr?text=${encodeURIComponent(`https://www.tiktok.com/@${detail.username}/live`)}&dark=%23050509`}
                alt="QR"
                width={130}
                height={130}
              />
            </div>
            <p className="mt-2 text-center text-[9.5px] text-white/25">Telefonla okut → TikTok yayını açılır</p>
          </div>
        </div>
      ) : null}

      {qrChest ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setQrChest(null)}>
          <div className="panel w-full max-w-sm p-5" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">{dict.qr}</p>
                <h3 className="mt-1 text-[16px] font-bold text-white">@{qrChest.username}</h3>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {formatNumber(qrChest.coins)} {dict.coins} · {formatNumber(qrChest.slots)} {dict.slots} · {dict.ratio}{" "}
                  {qrChest.ratio}
                </p>
              </div>
              <button onClick={() => setQrChest(null)} className="text-white/40 hover:text-white" aria-label="Kapat">
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 grid place-items-center rounded-xl border border-white/10 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/qr?text=${encodeURIComponent(`https://www.tiktok.com/@${qrChest.username}/live`)}&dark=%23050509`}
                alt={`@${qrChest.username} QR`}
                width={180}
                height={180}
              />
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/45">
              Telefonunuzla okutun — TikTok uygulaması doğrudan canlı yayını açar. Sandık açılış anında yayında olun.
            </p>
            <a
              href={`https://www.tiktok.com/@${qrChest.username}/live`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary mt-3 w-full !text-[11.5px]"
            >
              <ExternalLink size={12} /> {dict.open}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
