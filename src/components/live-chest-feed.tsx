"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Gift, Loader2, Radio } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui";
import { formatNumber } from "@/lib/format";

type ChestRow = {
  id: number; username: string; nickname: string; title: string; roomId: string;
  kind: string; variant: string; coins: number; slots: number; viewers: number;
  opensAt: string | null; detectedAt: string; status: string; source: string; ratio: number;
};
type Status = {
  running: boolean; intervalSeconds: number; listening: number;
  lastResult: { checked: number; liveFound: number; chestsFound: number; source: string; error: string } | null;
};

function clock(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function LiveChestFeed() {
  const [chests, setChests] = useState<ChestRow[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [chestResponse, statusResponse] = await Promise.all([
        fetch("/api/chests?kind=all&sort=opens_at&desc=0", { cache: "no-store" }),
        fetch("/api/radar/scan", { cache: "no-store" }),
      ]);
      const chestData = (await chestResponse.json()) as { chests?: ChestRow[] };
      const statusData = (await statusResponse.json()) as { status?: Status };
      setChests((chestData.chests ?? []).filter((row) => row.kind !== "live"));
      if (statusData.status) setStatus(statusData.status);
      setError("");
    } catch (cause) {
      setError(`Canlı akış alınamadı: ${(cause as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    const data = setInterval(() => void load(), 8_000);
    const tick = setInterval(() => setNow(Date.now()), 1_000);
    return () => { clearInterval(data); clearInterval(tick); };
  }, [load]);

  // Süresi dolan sandık listede kalmaz.
  const rows = useMemo(() => chests
    .filter((row) => row.status === "claimed" || !row.opensAt || new Date(row.opensAt).getTime() > now - 90_000)
    .sort((a, b) => {
      const left = (row: ChestRow) => row.opensAt ? new Date(row.opensAt).getTime() : Infinity;
      return left(a) - left(b);
    }), [chests, now]);

  return (
    <Card className="mb-5">
      <CardHeader
        icon={<Gift size={15} />}
        title="Canlı sandık akışı"
        subtitle="Keşif ve dinleme kendiliğinden çalışır; açılan sandıklar süresi geçince listeden düşer."
        action={
          <span className="chip">
            {status?.running ? <Loader2 size={11} className="animate-spin" /> : <Radio size={11} />}
            Otomatik · {status?.listening ?? 0} oda dinlemekte
          </span>
        }
      />
      <div className="px-4 pb-4 pt-3">
        <p className="mb-3 text-[11px] leading-relaxed text-white/40">
          {status?.lastResult
            ? `Son otomatik tur: ${status.lastResult.checked} hesap kontrol edildi · ${status.lastResult.liveFound} canlı doğrulandı · ${status.lastResult.chestsFound} sandık yakalandı. Tur aralığı ${status.intervalSeconds} sn.`
            : "İlk otomatik keşif turu hazırlanıyor. Bu ekranda işlem yapmana gerek yok."}
        </p>
        {loading && rows.length === 0 ? (
          <div className="grid place-items-center p-8 text-[11.5px] text-white/40">
            <Loader2 size={15} className="mb-2 animate-spin" /> Sandık akışı yükleniyor...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-5 text-center">
            <p className="text-[12px] font-semibold text-white/70">Şu anda açık veya bekleyen sandık yok</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/35">
              Canlı yayınlar otomatik bulunup dinleme sırasına alınıyor. Sandık zarfı geldiği anda jeton tutarı,
              kontenjan ve açılış zamanı burada görünür. Daha fazla oda için{" "}
              <Link href="/sandik" className="text-cyan-200 underline">Sandık Radarı</Link> sayfasındaki tüm sekmeler hazır.
            </p>
            {error ? <p className="mt-2 text-[10.5px] text-amber-200/70">{error}</p> : null}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {rows.slice(0, 12).map((row) => {
              const opensAt = row.opensAt ? new Date(row.opensAt).getTime() : 0;
              const left = opensAt ? opensAt - now : 0;
              const open = opensAt > 0 && left <= 0;
              return (
                <a key={`${row.id}`} href={`https://www.tiktok.com/@${row.username}/live`} target="_blank" rel="noopener noreferrer"
                  className={`rounded-xl border p-3 transition hover:border-cyan-300/40 ${open ? "border-pink-400/40 bg-pink-500/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[12px] font-semibold text-white">@{row.username}</p>
                    <Badge tone={row.variant === "gold" ? "amber" : row.kind === "bag" ? "cyan" : "pink"}>
                      {row.kind === "bag" ? "Çanta" : row.variant === "gold" ? "Altın" : row.variant === "hanging" ? "Askıda" : "Sandık"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[10px] text-white/35">{row.title || `${formatNumber(row.viewers)} izleyici`}</p>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-lg bg-black/30 py-1.5">
                      <p className="text-[13px] font-bold tabular-nums text-white">{formatNumber(row.coins)}</p>
                      <p className="text-[8px] uppercase tracking-wide text-white/30">Jeton</p>
                    </div>
                    <div className="rounded-lg bg-black/30 py-1.5">
                      <p className="text-[13px] font-bold tabular-nums text-cyan-200">{row.ratio}</p>
                      <p className="text-[8px] uppercase tracking-wide text-white/30">Oran</p>
                    </div>
                    <div className="rounded-lg bg-black/30 py-1.5">
                      <p className="text-[13px] font-bold tabular-nums text-white">{formatNumber(row.slots)}</p>
                      <p className="text-[8px] uppercase tracking-wide text-white/30">Kontenjan</p>
                    </div>
                  </div>
                  <p className={`mt-2 text-[10.5px] font-semibold tabular-nums ${open ? "text-pink-300" : "text-cyan-200"}`}>
                    {open ? "Açık · katılabilirsin" : `Açılışa ${clock(left)}`}
                  </p>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
