"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Check,
  ExternalLink,
  Gift,
  Loader2,
  Pin,
  PinOff,
  Play,
  Plus,
  QrCode,
  Radar as RadarIcon,
  RefreshCw,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Badge, Card, CardHeader, Progress } from "@/components/ui";
import { formatNumber, timeAgo } from "@/lib/format";

type Room = {
  id: number;
  username: string;
  roomId: string;
  nickname: string;
  title: string;
  avatar: string;
  region: string;
  source: string;
  viewers: number;
  peakViewers: number;
  diamonds: number;
  diamondsPerMin: number;
  chestCount: number;
  bestChestCoins: number;
  bestChestSlots: number;
  bestChestRatio: number;
  lastChestAt: string | null;
  pinned: boolean;
  liveNow: boolean;
  monitoring: boolean;
  lastError: string;
  lastSeenAt: string;
  ratio: number;
  secondsSinceSeen: number;
};

type Overview = {
  rooms: number;
  live: number;
  pinned: number;
  roomChests: number;
  chests: number;
  upcoming: number;
  coins: number;
  flowRooms: number;
  flowDiamonds: number;
  tasks: number;
  listening: number;
};

type Task = {
  id: number;
  username: string;
  status: string;
  viewerCount: number;
  diamonds: number;
  giftEvents: number;
  chestsFound: number;
  listenSeconds: number;
  error: string;
  startedAt: string | null;
  finishedAt: string | null;
};

type ScanStatus = {
  running: boolean;
  lastRunAt: string | null;
  intervalSeconds: number;
  maxRooms: number;
  listening: number;
  lastResult: { checked: number; liveFound: number; chestsFound: number; source: string; error: string } | null;
};

const SORTS = [
  { key: "pinned", label: "Sabitlenen önce" },
  { key: "viewers", label: "İzleyici" },
  { key: "chests", label: "Sandık sayısı" },
  { key: "ratio", label: "Oran" },
  { key: "coins", label: "En iyi jeton" },
  { key: "diamonds", label: "Toplam jeton" },
  { key: "per_min", label: "Jeton/dk" },
];

export function LiveRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("pinned");
  const [desc, setDesc] = useState(true);
  const [onlyLive, setOnlyLive] = useState(false);
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ sort, desc: desc ? "1" : "0", limit: "300" });
      if (onlyLive) params.set("live", "1");
      if (onlyPinned) params.set("pinned", "1");
      const [roomsResponse, scanResponse] = await Promise.all([
        fetch(`/api/rooms?${params.toString()}`, { cache: "no-store" }),
        fetch("/api/radar/scan", { cache: "no-store" }),
      ]);
      const roomsData = (await roomsResponse.json()) as { data?: Room[]; overview?: Overview };
      const scanData = (await scanResponse.json()) as {
        status?: ScanStatus;
        tasks?: Task[];
        overview?: Overview;
      };
      setRooms(roomsData.data ?? []);
      setOverview(roomsData.overview ?? scanData.overview ?? null);
      setStatus(scanData.status ?? null);
      setTasks(scanData.tasks ?? []);
      setError("");
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sort, desc, onlyLive, onlyPinned]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 12000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2800);
    return () => clearTimeout(timer);
  }, [notice]);

  const togglePin = async (room: Room) => {
    setRooms((prev) => prev.map((item) => (item.id === room.id ? { ...item, pinned: !item.pinned } : item)));
    await fetch(`/api/rooms/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !room.pinned }),
    });
    setNotice(room.pinned ? `@${room.username} sabitten çıkarıldı` : `@${room.username} panele sabitlendi`);
    await load();
  };

  const removeRoom = async (room: Room) => {
    if (!window.confirm(`@${room.username} izleme listesinden çıkarılsın mı?`)) return;
    await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
    await load();
  };

  const addRoom = async () => {
    const username = newHandle.trim().replace(/^@+/, "");
    if (!username) return;
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pin: true }),
      });
      const data = (await response.json()) as { error?: string; live?: boolean };
      if (!response.ok) throw new Error(data.error ?? "Eklenemedi");
      setNewHandle("");
      setNotice(`@${username} eklendi${data.live ? " · yayında" : " · şu an çevrimdışı"}`);
      await load();
    } catch (addError) {
      setError((addError as Error).message);
    }
  };

  const scan = async () => {
    setScanning(true);
    try {
      const response = await fetch("/api/radar/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      const data = (await response.json()) as { result?: ScanStatus["lastResult"] };
      if (data.result) {
        setNotice(
          `${data.result.checked} hedef · ${data.result.liveFound} canlı · ${data.result.chestsFound} sandık (${data.result.source})`,
        );
      }
      await load();
    } catch (scanError) {
      setError((scanError as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rooms.filter((room) => {
      if (onlyLive && !room.liveNow) return false;
      if (onlyPinned && !room.pinned) return false;
      if (q && !`${room.username} ${room.nickname} ${room.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (a.pinned !== b.pinned && sort === "pinned") return a.pinned ? -1 : 1;
      const keyOf = (room: Room) => {
        switch (sort) {
          case "viewers":
            return room.viewers;
          case "chests":
            return room.chestCount;
          case "ratio":
            return room.ratio;
          case "coins":
            return room.bestChestCoins;
          case "diamonds":
            return room.diamonds;
          case "per_min":
            return room.diamondsPerMin;
          default:
            return 0;
        }
      };
      return desc ? keyOf(b) - keyOf(a) : keyOf(a) - keyOf(b);
    });
  }, [rooms, query, sort, desc, onlyLive, onlyPinned]);

  const liveRooms = rooms.filter((room) => room.liveNow).length;
  const activeTasks = tasks.filter((task) => task.status === "listening").length;

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-2.5 text-[12px] text-emerald-100">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-pink-400/25 bg-pink-500/[0.08] px-4 py-2.5 text-[12px] text-pink-100">{error}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Keşfedilen oda", value: overview?.rooms ?? rooms.length, hint: `${overview?.pinned ?? 0} sabitlenmiş` },
          { label: "Şu an canlı", value: liveRooms, hint: `${overview?.listening ?? activeTasks} oda dinleniyor` },
          { label: "Oda sandıkları", value: overview?.roomChests ?? 0, hint: `${overview?.upcoming ?? 0} açılış bekliyor` },
          { label: "Ölçülen jeton", value: overview?.flowDiamonds ?? 0, hint: `${overview?.flowRooms ?? 0} akış odası` },
        ].map((stat) => (
          <div key={stat.label} className="panel p-3.5">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-white/35">{stat.label}</p>
            <p className="mt-1.5 text-[22px] font-bold leading-none tabular-nums text-white">{formatNumber(stat.value)}</p>
            <p className="mt-1 text-[10px] text-white/35">{stat.hint}</p>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-semibold text-white/90">Canlı yayın izleme listesi</h3>
              <Badge tone={status?.running ? "emerald" : "slate"}>
                {status?.running ? `Otomatik ${status.intervalSeconds}sn` : "Manuel"}
              </Badge>

            </div>
            <p className="mt-0.5 text-[11px] text-white/40">
              Keşfedilen yayıncılar burada kalıcıdır. Sabitlediğin odalar her taramada öncelikli dinlenir.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/30 px-2.5 py-1.5">
              <Search size={13} className="text-white/30" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Yayıncı ara..."
                className="w-[120px] bg-transparent text-[12px] text-white placeholder:text-white/25 focus:outline-none"
              />
            </div>
            <select value={sort} onChange={(event) => setSort(event.target.value)} className="input !w-auto !py-1.5 !text-[11.5px]">
              {SORTS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => setDesc((value) => !value)}
              className="btn !px-2 !py-1.5"
              aria-label={desc ? "Azalan" : "Artan"}
              title={desc ? "Azalan" : "Artan"}
            >
              {desc ? <ArrowDownWideNarrow size={13} /> : <ArrowUpNarrowWide size={13} />}
            </button>
            <button
              onClick={() => setOnlyLive((value) => !value)}
              className={`btn !py-1.5 !text-[11px] ${onlyLive ? "!border-pink-400/40 !text-pink-200" : ""}`}
            >
              Canlı
            </button>
            <button
              onClick={() => setOnlyPinned((value) => !value)}
              className={`btn !py-1.5 !text-[11px] ${onlyPinned ? "!border-cyan-300/40 !text-cyan-100" : ""}`}
            >
              <Pin size={11} /> Sabit
            </button>
            <button onClick={() => void load()} className="btn !px-2 !py-1.5" aria-label="Yenile">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
            <button onClick={() => void scan()} disabled={scanning} className="btn btn-primary !py-1.5 !text-[11.5px]">
              {scanning ? <Loader2 size={13} className="animate-spin" /> : <RadarIcon size={13} />}
              Otomatik keşif (şimdi kontrol et)
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-white/[0.06] bg-white/[0.02] p-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-white/10 bg-black/30 px-2.5 py-1.5">
            <Plus size={13} className="text-white/30" />
            <input
              value={newHandle}
              onChange={(event) => setNewHandle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addRoom();
              }}
              placeholder="Yayıncı ekle: @kullanici veya tiktok.com/@kullanici/live"
              className="w-full bg-transparent text-[12px] text-white placeholder:text-white/25 focus:outline-none"
            />
          </div>
          <button onClick={() => void addRoom()} className="btn !py-1.5 !text-[11.5px]">
            <Pin size={12} /> Ekle ve sabitle
          </button>
        </div>

        {loading && rooms.length === 0 ? (
          <div className="grid place-items-center p-14 text-[12px] text-white/40">
            <Loader2 size={16} className="mb-2 animate-spin" /> Odalar yükleniyor...
          </div>
        ) : filtered.length === 0 ? (
          <div className="grid place-items-center p-14 text-center">
            <RadarIcon size={22} className="mb-2 text-cyan-200/60" />
            <p className="text-[13px] font-semibold text-white/75">İzleme listesi boş</p>
            <p className="mt-1 max-w-sm text-[11.5px] text-white/35">
              Bir kullanıcı adı ekleyin veya taramayı çalıştırın. Keşfedilen canlı yayıncılar otomatik burada birikir.
            </p>
            <button onClick={() => void scan()} className="btn btn-primary mt-3 !text-[11.5px]">
              <RadarIcon size={13} /> Taramayı başlat
            </button>
          </div>
        ) : (
          <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((room) => (
              <div
                key={room.id}
                className={`relative overflow-hidden rounded-xl border p-3.5 transition ${
                  room.pinned
                    ? "border-cyan-300/30 bg-gradient-to-br from-cyan-300/[0.07] to-transparent"
                    : "border-white/[0.08] bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`relative grid size-9 flex-none place-items-center rounded-lg text-[12px] font-bold uppercase ${
                      room.liveNow
                        ? "bg-gradient-to-br from-pink-500/70 to-violet-500/70 text-white"
                        : "border border-white/10 bg-white/[0.04] text-white/50"
                    }`}
                  >
                    {room.username.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-[12.5px] font-semibold text-white/90">@{room.username}</p>
                      {room.pinned ? <Pin size={10} className="flex-none text-cyan-300" /> : null}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-white/35">{room.title || room.nickname || "TikTok LIVE"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {room.liveNow ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-pink-400/30 bg-pink-500/10 px-1.5 py-0.5 text-[8.5px] font-bold text-pink-200">
                          <span className="live-dot !size-1" /> CANLI
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[8.5px] text-white/40">
                          çevrimdışı
                        </span>
                      )}
                      <span className="chip !text-[8.5px]">{room.source}</span>
                      <span className="chip !text-[8.5px]">{room.region}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => void togglePin(room)}
                    className={`grid size-6 flex-none place-items-center rounded-md border ${
                      room.pinned
                        ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-200"
                        : "border-white/10 text-white/40 hover:text-white"
                    }`}
                    aria-label={room.pinned ? "Sabitten çıkar" : "Sabitle"}
                  >
                    {room.pinned ? <PinOff size={11} /> : <Pin size={11} />}
                  </button>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  <div className="rounded-lg border border-white/[0.06] bg-black/25 p-1.5 text-center">
                    <p className="text-[12px] font-bold tabular-nums text-white">{formatNumber(room.viewers)}</p>
                    <p className="text-[8px] uppercase tracking-wider text-white/30">İzleyici</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-black/25 p-1.5 text-center">
                    <p className="text-[12px] font-bold tabular-nums text-pink-200">{room.chestCount}</p>
                    <p className="text-[8px] uppercase tracking-wider text-white/30">Sandık</p>
                  </div>
                  <div className="rounded-lg border border-white/[0.06] bg-black/25 p-1.5 text-center">
                    <p className="text-[12px] font-bold tabular-nums text-cyan-200">{room.ratio || "—"}</p>
                    <p className="text-[8px] uppercase tracking-wider text-white/30">En iyi oran</p>
                  </div>
                </div>

                {room.bestChestCoins > 0 ? (
                  <div className="mt-2">
                    <Progress value={room.bestChestCoins} max={Math.max(room.bestChestCoins, 1000)} height={3} tone="pink" />
                    <p className="mt-1 text-[9px] text-white/30">
                      En iyi sandık: {formatNumber(room.bestChestCoins)} jeton / {room.bestChestSlots} kişi ·{" "}
                      {room.lastChestAt ? timeAgo(room.lastChestAt) : "—"}
                    </p>
                  </div>
                ) : null}

                <div className="mt-2.5 flex items-center gap-1.5">
                  <a
                    href={`https://www.tiktok.com/@${room.username}/live`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn flex-1 !py-1.5 !text-[10.5px]"
                  >
                    <Play size={11} /> Yayına git
                  </a>
                  <Link href={`/sandik?q=${room.username}`} className="btn !px-2 !py-1.5" aria-label="Sandıkları gör">
                    <Gift size={11} />
                  </Link>
                  <Link href={`/join/${room.id}`} className="btn !px-2 !py-1.5" aria-label="QR katıl">
                    <QrCode size={11} />
                  </Link>
                  <button onClick={() => void removeRoom(room)} className="btn !px-2 !py-1.5" aria-label="Kaldır">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Eşzamanlı tarama görevleri"
            subtitle="Her oda ayrı işlem olarak paralel dinlenir"
            icon={<Users size={14} />}
            action={<Badge tone="cyan">{activeTasks} aktif</Badge>}
          />
          <div className="max-h-[320px] divide-y divide-white/[0.05] overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="p-4 text-[11px] text-white/35">Henüz dinleme görevi yok. Otomatik keşif birkaç saniye içinde kendiliğinden başlar.</p>
            ) : (
              tasks.slice(0, 20).map((task) => (
                <div key={task.id} className="flex items-center gap-2 px-4 py-2">
                  <span
                    className={`size-1.5 flex-none rounded-full ${
                      task.status === "listening"
                        ? "bg-amber-400"
                        : task.status === "done"
                          ? "bg-emerald-400"
                          : task.status === "failed"
                            ? "bg-pink-500"
                            : "bg-white/25"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold text-white/80">@{task.username}</p>
                    <p className="truncate text-[9.5px] text-white/30">
                      {task.status} · {task.listenSeconds}sn · {formatNumber(task.giftEvents)} hediye ·{" "}
                      {formatNumber(task.diamonds)} jeton
                      {task.error ? ` · ${task.error}` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold ${task.chestsFound > 0 ? "text-amber-200" : "text-white/30"}`}>
                    {task.chestsFound} 🎁
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Premium özellikler açık"
            subtitle="LiveMira Plus/Pro kilitleri bu panelde ücretsiz"
            icon={<Check size={14} />}
            action={<Badge tone="emerald">Tümü açık</Badge>}
          />
          <div className="grid gap-1.5 p-3 sm:grid-cols-2">
            {[
              "20/16 sandık sekmesi",
              "Altın sandık",
              "Askıda sandık",
              "Oran ≥ 2 / ≥ 4",
              "Kısmet ≥ 7",
              "Çanta Lv 0–10",
              "Gelişmiş filtreler",
              "Sınırsız oda kapasitesi",
              "Telegram / Discord uyarısı",
              "Sıralama + sabitleme",
              "Sesli + bildirim alarmı",
              "Çoklu dil TR/EN/VI",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-1.5 rounded-lg border border-emerald-300/15 bg-emerald-400/[0.05] px-2 py-1.5">
                <Check size={10} className="flex-none text-emerald-300" />
                <span className="text-[10px] text-white/65">{feature}</span>
              </div>
            ))}
          </div>
          <div className="px-3 pb-3">
            <div className="flex gap-2">
              <Link href="/sandik" className="btn btn-primary flex-1 !text-[11px]">
                <Gift size={12} /> Sandık radarı
              </Link>
              <a href="/api/chests/export" className="btn !text-[11px]">
                <ExternalLink size={12} /> CSV
              </a>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
        <p className="text-[10.5px] text-white/35">
          API: <code className="text-cyan-200/70">GET /api/rooms</code> ·{" "}
          <code className="text-cyan-200/70">PATCH /api/rooms/[id]</code> ·{" "}
          <code className="text-cyan-200/70">POST /api/radar/scan</code>
        </p>
        <span className="flex items-center gap-1 text-[10px] text-white/25">
          <X size={10} /> otomatik yenileme 12 sn
        </span>
      </div>
    </div>
  );
}
