import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chests } from "@/db/schema";
import { deriveChest } from "@/server/chest";
import { liveUrls } from "@/server/discovery";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db.select().from(chests).where(eq(chests.id, Number(id))).limit(1);

  if (!row) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#050509] p-6 text-center">
        <div className="panel max-w-sm p-6">
          <p className="eyebrow">Arena Sandık Radarı</p>
          <h1 className="mt-2 text-[18px] font-bold text-white">Sandık bulunamadı</h1>
          <p className="mt-1.5 text-[12px] text-white/45">Bu sandık kaydı silinmiş veya süresi dolmuş olabilir.</p>
          <Link href="/sandik" className="btn btn-primary mt-4 w-full">
            Sandık radarına dön
          </Link>
        </div>
      </div>
    );
  }

  const chest = deriveChest(row);
  const urls = liveUrls(row.username, row.roomId);
  const left = chest.secondsLeft;

  return (
    <div className="min-h-screen bg-[#050509] p-4">
      <div className="mx-auto max-w-md">
        <div className="panel relative overflow-hidden p-5">
          <div className="pointer-events-none absolute -right-10 -top-14 size-36 rounded-full bg-pink-500/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="chip !border-pink-400/30 !bg-pink-500/10 !text-pink-200">🎁 Sandık Radarı</span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-pink-200">
                <span className="live-dot" /> CANLI
              </span>
            </div>
            <h1 className="mt-3 text-[20px] font-bold tracking-tight text-white">@{row.username}</h1>
            <p className="mt-0.5 text-[12px] text-white/45">{row.title || "TikTok LIVE yayını"}</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="panel-flat p-2.5 text-center">
                <p className="text-[16px] font-bold tabular-nums text-white">{formatNumber(chest.coins)}</p>
                <p className="text-[9px] uppercase tracking-wider text-white/35">Jeton</p>
              </div>
              <div className="panel-flat p-2.5 text-center">
                <p className="text-[16px] font-bold tabular-nums text-white">{formatNumber(chest.slots)}</p>
                <p className="text-[9px] uppercase tracking-wider text-white/35">Kontenjan</p>
              </div>
              <div className="panel-flat p-2.5 text-center">
                <p className="text-[16px] font-bold tabular-nums text-cyan-200">{chest.ratio}</p>
                <p className="text-[9px] uppercase tracking-wider text-white/35">Oran</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-center">
              <p className="text-[9.5px] uppercase tracking-[0.14em] text-white/35">Açılışa kalan süre</p>
              <p
                className="mt-1 text-[30px] font-bold leading-none tabular-nums"
                style={{ color: left <= 0 ? "#ff3b5c" : left <= 30 ? "#ffa62b" : "#2ee6a8" }}
              >
                {left > 0 ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "● AÇIK"}
              </p>
              <p className="mt-1 text-[10.5px] text-white/40">{formatNumber(chest.viewers)} izleyici · {chest.variant}</p>
            </div>

            <a
              href={urls.deep ?? urls.web}
              className="btn btn-primary mt-4 w-full !py-3 !text-[14px]"
            >
              📱 TikTok&apos;ta Yayını Aç
            </a>
            <a href={urls.web} className="btn mt-2 w-full !py-2.5 !text-[12px]">
              Webde aç (masaüstü)
            </a>
            <p className="mt-3 text-center text-[10px] leading-relaxed text-white/30">
              Mobil cihazda TikTok uygulaması otomatik açılır. Sandık açılış anında yayında olun ve sandık simgesine
              dokunun.
            </p>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-white/25">
          Arena Live OS · Sandık Radarı · Jeton toplama manuel yapılır
        </p>
      </div>
    </div>
  );
}
