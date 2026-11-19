"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Play, Plus, Radar as RadarIcon, RefreshCw, Search, Trash2, Wifi } from "lucide-react";
import { Badge, Card, CardHeader, Progress, statusTone } from "@/components/ui";
import { formatNumber, timeAgo } from "@/lib/format";

type Target = {
  id: number;
  username: string;
  displayName: string;
  followers: number;
  category: string;
  liveNow: boolean;
  viewers: number;
  diamonds: number;
  score: number;
  status: string;
  lastCheckedAt: string | null;
  notes: string;
};

type CheckResult = {
  username: string;
  live: boolean;
  viewers: number;
  roomId: string;
  source: string;
  note: string;
};

const STATUS_OPTIONS = ["new", "contacted", "negotiating", "signed", "archived"];

export function RadarConsole() {
  const [targets, setTargets] = useState<Target[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("live");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const [source, setSource] = useState("");
  const [connector, setConnector] = useState<{ available: boolean; detail: string; version: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [scanInfo, setScanInfo] = useState("");
  const [newTarget, setNewTarget] = useState({ username: "", displayName: "", followers: "", category: "sohbet" });
  const [error, setError] = useState("");
  const [scanStatus, setScanStatus] = useState<{ running: boolean; lastResult: { checked: number; liveFound: number; chestsFound: number; source: string; error: string } | null; intervalSeconds: number; maxRooms: number; listening: number } | null>(null);
  const [scans, setScans] = useState<Array<{ id: number; startedAt: string; finishedAt: string | null; checked: number; liveFound: number; chestsFound: number; source: string; error: string }>>([]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/resources/targets?limit=200", { cache: "no-store" });
      const data = (await response.json()) as { data?: Target[] };
      setTargets(data.data ?? []);
    } catch {
      setError("Radar listesi yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadScanStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/radar/scan", { cache: "no-store" });
      const data = (await response.json()) as { status?: typeof scanStatus; scans?: typeof scans };
      if (data.status) setScanStatus(data.status);
      if (data.scans) setScans(data.scans);
    } catch {
      /* durum alınamadı */
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
      void loadScanStatus();
    });
    fetch("/api/live/status")
      .then((response) => response.json())
      .then((data) => setConnector(data.connector))
      .catch(() => null);
    const timer = setInterval(() => void loadScanStatus(), 10000);
    return () => clearInterval(timer);
  }, [load, loadScanStatus]);

  const filtered = useMemo(() => {
    return targets.filter((target) => {
      if (query && !`${target.username} ${target.displayName}`.toLowerCase().includes(query.toLowerCase())) return false;
      if (category && target.category !== category) return false;
      if (status === "live" && !target.liveNow) return false;
      if (status === "offline" && target.liveNow) return false;
      if (status && !["live", "offline"].includes(status) && target.status !== status) return false;
      return true;
    });
  }, [targets, query, category, status]);

  const scan = async () => {
    setScanning(true);
    setError("");
    try {
      const response = await fetch("/api/radar/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      const data = (await response.json()) as {
        result?: { checked: number; liveFound: number; chestsFound: number; source: string; error: string };
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Tarama başarısız");
      const result = data.result;
      if (result) {
        setSource(result.source);
        setScanInfo(`${result.checked} hedef kontrol edildi · ${result.liveFound} canlı · ${result.chestsFound} sandık tespit edildi (${result.source})`);
      }
      await load();
      await loadScanStatus();
    } catch (scanError) {
      setError((scanError as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const toggleAutoScan = async () => {
    try {
      const response = await fetch("/api/radar/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: scanStatus?.running ? "stop" : "start" }),
      });
      const data = (await response.json()) as { status?: typeof scanStatus };
      if (data.status) setScanStatus(data.status);
    } catch {
      setError("Otomatik tarama değiştirilemedi");
    }
  };

  const addTarget = async () => {
    if (!newTarget.username.trim()) return;
    setError("");
    try {
      const response = await fetch("/api/resources/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newTarget.username,
          displayName: newTarget.displayName || newTarget.username,
          followers: Number(newTarget.followers) || 0,
          category: newTarget.category,
          score: 55,
          status: "new",
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Aday eklenemedi");
      }
      setNewTarget({ username: "", displayName: "", followers: "", category: "sohbet" });
      setShowAdd(false);
      await load();
    } catch (addError) {
      setError((addError as Error).message);
    }
  };

  const updateStatus = async (target: Target, next: string) => {
    setTargets((prev) => prev.map((item) => (item.id === target.id ? { ...item, status: next } : item)));
    await fetch(`/api/resources/targets/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  };

  const remove = async (target: Target) => {
    if (!window.confirm(`@${target.username} radardan silinsin mi?`)) return;
    await fetch(`/api/resources/targets/${target.id}`, { method: "DELETE" });
    await load();
  };

  const categories = Array.from(new Set(targets.map((target) => target.category)));
  const liveCount = targets.filter((target) => target.liveNow).length;
  const avgScore = Math.round(targets.reduce((sum, target) => sum + target.score, 0) / Math.max(1, targets.length));
  const totalViewers = targets.reduce((sum, target) => sum + target.viewers, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Taranan aday", value: targets.length, hint: `${categories.length} kategori` },
          { label: "Şu an canlı", value: liveCount, hint: `${formatNumber(totalViewers)} toplam izleyici` },
          { label: "Ortalama skor", value: avgScore, hint: "0-100 potansiyel" },
          { label: "Kaynak", value: source === "connector" ? "Webcast" : "Radar", hint: connector?.available ? "Connector hazır" : "Web uçları" },
        ].map((stat) => (
          <div key={stat.label} className="panel p-3.5">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-white/35">{stat.label}</p>
            <p className="mt-1.5 text-[22px] font-bold leading-none tabular-nums text-white">{typeof stat.value === "number" ? formatNumber(stat.value) : stat.value}</p>
            <p className="mt-1 text-[10px] text-white/35">{stat.hint}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="rounded-xl border border-pink-400/25 bg-pink-500/[0.08] px-4 py-2.5 text-[12px] text-pink-100">{error}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-white/90">Aday havuzu</h3>
                <Badge tone="cyan">{filtered.length} sonuç</Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-white/40">
                Canlı durum gerçek TikTok web uçları ve Webcast üzerinden kontrol edilir.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-black/30 px-2.5 py-1.5">
                <Search size={13} className="text-white/30" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Kullanıcı ara..."
                  className="w-[120px] bg-transparent text-[12px] text-white placeholder:text-white/25 focus:outline-none"
                />
              </div>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className="input !w-auto !py-1.5 !text-[11.5px]">
                <option value="">Kategori: Tümü</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="input !w-auto !py-1.5 !text-[11.5px]">
                <option value="">Durum: Tümü</option>
                <option value="live">Sadece canlı</option>
                <option value="offline">Sadece çevrimdışı</option>
                {STATUS_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button onClick={() => setShowAdd((value) => !value)} className="btn !py-1.5 !text-[11.5px]">
                <Plus size={13} /> Ekle
              </button>
              <button onClick={() => void scan()} disabled={scanning} className="btn btn-primary !py-1.5 !text-[11.5px]">
                {scanning ? <Loader2 size={13} className="animate-spin" /> : <RadarIcon size={13} />}
                Tara
              </button>
            </div>
          </div>

          {showAdd ? (
            <div className="grid gap-2 border-b border-white/[0.07] bg-white/[0.02] p-4 sm:grid-cols-[1fr_1fr_120px_120px_auto]">
              <input
                value={newTarget.username}
                onChange={(event) => setNewTarget((prev) => ({ ...prev, username: event.target.value }))}
                placeholder="kullanici_adi"
                className="input"
              />
              <input
                value={newTarget.displayName}
                onChange={(event) => setNewTarget((prev) => ({ ...prev, displayName: event.target.value }))}
                placeholder="Görünen ad"
                className="input"
              />
              <input
                value={newTarget.followers}
                onChange={(event) => setNewTarget((prev) => ({ ...prev, followers: event.target.value }))}
                placeholder="Takipçi"
                type="number"
                className="input"
              />
              <input
                value={newTarget.category}
                onChange={(event) => setNewTarget((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Kategori"
                className="input"
              />
              <button onClick={() => void addTarget()} className="btn btn-primary">
                Kaydet
              </button>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Aday</th>
                  <th>Durum</th>
                  <th>İzleyici</th>
                  <th>Takipçi</th>
                  <th>Skor</th>
                  <th>Pipeline</th>
                  <th>Son tarama</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="!py-12 text-center text-[12px] text-white/40">
                      <Loader2 size={14} className="mr-2 inline animate-spin" /> Radar yükleniyor...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="!py-12 text-center">
                      <p className="text-[12.5px] font-semibold text-white/70">Sonuç yok</p>
                      <p className="mt-1 text-[11px] text-white/35">Filtreleri değiştir veya yeni aday ekle.</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((target) => (
                    <tr key={target.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span
                            className={`grid size-6 place-items-center rounded-md text-[9.5px] font-bold uppercase ${
                              target.liveNow
                                ? "bg-gradient-to-br from-pink-500/60 to-violet-500/60 text-white"
                                : "border border-white/10 bg-white/[0.04] text-white/50"
                            }`}
                          >
                            {target.username.slice(0, 2)}
                          </span>
                          <div>
                            <p className="text-[12px] font-semibold text-white/85">@{target.username}</p>
                            <p className="text-[9.5px] text-white/35">{target.displayName || target.category}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {target.liveNow ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-400/30 bg-pink-500/10 px-2 py-0.5 text-[9.5px] font-semibold text-pink-200">
                            <span className="live-dot !size-1" /> CANLI
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9.5px] text-white/45">
                            offline
                          </span>
                        )}
                      </td>
                      <td className="tabular-nums">{target.liveNow ? formatNumber(target.viewers) : "—"}</td>
                      <td className="tabular-nums text-white/60">{formatNumber(target.followers)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-12">
                            <Progress value={target.score} height={4} tone={target.score > 80 ? "emerald" : "gradient"} />
                          </div>
                          <span className="text-[10.5px] font-semibold tabular-nums text-white/70">{target.score}</span>
                        </div>
                      </td>
                      <td>
                        <select
                          value={target.status}
                          onChange={(event) => void updateStatus(target, event.target.value)}
                          className="rounded-md border border-white/10 bg-black/40 px-1.5 py-1 text-[10.5px] text-white/70 focus:outline-none"
                        >
                          {STATUS_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-[10px] text-white/35">{timeAgo(target.lastCheckedAt)}</td>
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <Link
                            href={`/canli?username=${target.username}`}
                            className="grid size-6 place-items-center rounded-md border border-white/10 text-white/50 hover:border-cyan-300/40 hover:text-cyan-200"
                            aria-label="Yayına bağlan"
                          >
                            <Play size={11} />
                          </Link>
                          <button
                            onClick={() => void remove(target)}
                            className="grid size-6 place-items-center rounded-md border border-white/10 text-white/40 hover:border-pink-400/40 hover:text-pink-300"
                            aria-label="Sil"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="relative overflow-hidden">
            <div className="relative grid h-[180px] place-items-center">
              <div className="absolute size-[150px] rounded-full border border-cyan-300/15" />
              <div className="absolute size-[105px] rounded-full border border-cyan-300/20" />
              <div className="absolute size-[58px] rounded-full border border-cyan-300/25" />
              <div
                className="absolute size-[150px] rounded-full"
                style={{
                  background: "conic-gradient(from 0deg, rgba(37,244,238,0.45), transparent 42%)",
                  animation: "spin 4s linear infinite",
                  maskImage: "radial-gradient(circle, black 60%, transparent 61%)",
                }}
              />
              <RadarIcon size={20} className="relative text-cyan-200" />
              {targets
                .filter((target) => target.liveNow)
                .slice(0, 5)
                .map((target, index) => (
                  <span
                    key={target.id}
                    className="absolute size-1.5 rounded-full bg-pink-400 shadow-[0_0_8px_rgba(254,44,85,0.9)]"
                    style={{
                      top: `${30 + ((index * 17) % 55)}%`,
                      left: `${28 + ((index * 23) % 55)}%`,
                    }}
                  />
                ))}
            </div>
            <div className="border-t border-white/[0.07] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11.5px] font-semibold text-white/80">Tarama motoru</p>
                <Badge tone={connector?.available ? "emerald" : "amber"}>{connector?.available ? "Webcast" : "Web"}</Badge>
              </div>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/40">{connector?.detail}</p>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/30">
                <Wifi size={11} /> Son tarama {results.length ? `${results.length} aday` : "yapılmadı"}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Tarama sonuçları" subtitle="En son kontrol edilen adaylar" />
            <div className="max-h-[300px] divide-y divide-white/[0.05] overflow-y-auto">
              {results.length === 0 ? (
                <p className="p-4 text-[11px] text-white/35">Tara&apos;ya basarak canlı durumları güncelle.</p>
              ) : (
                results.map((result) => (
                  <div key={result.username} className="flex items-center gap-2 px-4 py-2">
                    <span className={`size-1.5 rounded-full ${result.live ? "bg-pink-500" : "bg-white/20"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-semibold text-white/80">@{result.username}</p>
                      <p className="truncate text-[9.5px] text-white/30">{result.note}</p>
                    </div>
                    <span className="text-[10px] tabular-nums text-cyan-200">{result.live ? formatNumber(result.viewers) : "—"}</span>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Otomatik tarayıcı"
              subtitle="Canlı odaları dinler, sandık + jeton akışını toplar"
              icon={<RadarIcon size={14} />}
              action={<Badge tone={scanStatus?.running ? "emerald" : "slate"}>{scanStatus?.running ? "Çalışıyor" : "Durduruldu"}</Badge>}
            />
            <div className="space-y-2 p-4 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-white/40">Tarama aralığı</span>
                <span className="font-semibold text-white/75">{scanStatus?.intervalSeconds ?? 120} sn</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Dinlenen oda</span>
                <span className="font-semibold text-white/75">{scanStatus?.listening ?? 0} / {scanStatus?.maxRooms ?? 12}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Son tarama</span>
                <span className="font-semibold text-white/75">
                  {scanStatus?.lastResult
                    ? `${scanStatus.lastResult.checked} hedef · ${scanStatus.lastResult.liveFound} canlı · ${scanStatus.lastResult.chestsFound} sandık`
                    : "henüz yok"}
                </span>
              </div>
              {scanStatus?.lastResult?.error ? (
                <p className="rounded-md border border-amber-300/20 bg-amber-400/[0.07] px-2 py-1 text-[10px] leading-relaxed text-amber-100/80">
                  {scanStatus.lastResult.error}
                </p>
              ) : null}
              {scanInfo ? <p className="text-[10px] text-white/40">{scanInfo}</p> : null}
              <button onClick={() => void toggleAutoScan()} className="btn w-full !text-[11px]">
                {scanStatus?.running ? "Otomatik taramayı durdur" : "Otomatik taramayı başlat"}
              </button>
              <div className="border-t border-white/[0.06] pt-2">
                <p className="text-[9.5px] uppercase tracking-wider text-white/25">Son taramalar</p>
                {scans.length === 0 ? (
                  <p className="mt-1 text-[10px] text-white/30">Kayıt yok.</p>
                ) : (
                  scans.slice(0, 4).map((scan) => (
                    <div key={scan.id} className="mt-1 flex items-center justify-between text-[10px]">
                      <span className="text-white/35">{timeAgo(scan.startedAt)}</span>
                      <span className="text-white/60">
                        {scan.checked} hedef · {scan.liveFound} canlı · {scan.chestsFound} sandık
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <p className="text-[11.5px] font-semibold text-white/80">Radar API</p>
              <code className="mt-1.5 block break-all rounded-md border border-white/[0.07] bg-black/40 p-2 text-[10px] text-cyan-200/70">
                POST /api/live/check {`{ "usernames": ["elif_live"] }`}
              </code>
              <p className="mt-2 text-[10.5px] leading-relaxed text-white/35">
                Tek aday: <code className="text-white/55">GET /api/live/check?username=elif_live</code>. Sonuçlar
                veritabanındaki radar adaylarını otomatik günceller.
              </p>
              <button onClick={() => void load()} className="btn mt-2.5 w-full !text-[11px]">
                <RefreshCw size={12} /> Listeyi yenile
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
