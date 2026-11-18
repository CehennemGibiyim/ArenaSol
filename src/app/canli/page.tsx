import { desc } from "drizzle-orm";
import { Radio, Radar as RadarIcon } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { creators } from "@/db/schema";
import { LiveStudio } from "@/components/live-studio";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LivePage({
  searchParams,
}: {
  searchParams: Promise<{ username?: string }>;
}) {
  const { username } = await searchParams;
  let quickPicks: Array<{ username: string; category: string; liveStatus: string }> = [];
  try {
    const rows = await db
      .select({ username: creators.username, category: creators.category, liveStatus: creators.liveStatus })
      .from(creators)
      .orderBy(desc(creators.diamonds))
      .limit(12);
    quickPicks = rows;
  } catch {
    quickPicks = [];
  }

  return (
    <div>
      <PageHeader
        eyebrow="Canlı Stüdyo · tiktok-live-connector"
        title="TikTok LIVE kontrol merkezi"
        description="Gerçek Webcast olayları: sohbet, hediye, beğeni, takip, sandık zarfları ve izleyici sayısı. Top gifter tablosu, hedef barı ve OBS overlay bağlantıları aynı gerçek oturumdan beslenir."
        actions={
          <>
            <Link href="/radar" className="btn">
              <RadarIcon size={14} /> Radar
            </Link>
            <Link href="/kutuphane" className="btn">
              <Radio size={14} /> Overlay kütüphanesi
            </Link>
          </>
        }
      />
      <LiveStudio quickPicks={quickPicks} initialUsername={username} />
    </div>
  );
}
