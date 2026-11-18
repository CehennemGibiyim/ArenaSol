import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { overlays } from "@/db/schema";
import { OverlayCanvas } from "@/components/overlay-canvas";

export const dynamic = "force-dynamic";

const FALLBACK = {
  name: "Arena Overlay",
  kind: "goal",
  username: "elif_live",
  goal: 5000,
  accent: "cyan",
};

export default async function OverlayPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let overlay: typeof FALLBACK | null = null;
  try {
    const [row] = await db.select().from(overlays).where(eq(overlays.slug, slug)).limit(1);
    if (row) {
      overlay = {
        name: row.name,
        kind: row.kind,
        username: row.username || FALLBACK.username,
        goal: row.goal || FALLBACK.goal,
        accent: row.accent,
      };
    }
  } catch {
    overlay = null;
  }

  if (!overlay) {
    return (
      <div className="grid min-h-screen place-items-center bg-transparent p-6 text-center">
        <div className="panel max-w-sm p-6">
          <p className="eyebrow">Arena Overlay</p>
          <h1 className="mt-2 text-[18px] font-bold text-white">Overlay bulunamadı</h1>
          <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
            <code className="text-cyan-200/70">/overlay/{slug}</code> kaydı yok. Bot &amp; Uyarılar sayfasından bir
            overlay oluşturun.
          </p>
          <Link href="/bot" className="btn btn-primary mt-4 w-full">
            Overlay oluştur
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-transparent p-6">
      <OverlayCanvas
        kind={overlay.kind}
        username={overlay.username}
        goal={overlay.goal}
        accent={overlay.accent}
        name={overlay.name}
      />
      <div className="fixed bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[9px] text-white/30 backdrop-blur">
        <span className="size-1.5 rounded-full bg-emerald-400" /> Arena Live OS · OBS browser source
      </div>
    </div>
  );
}
