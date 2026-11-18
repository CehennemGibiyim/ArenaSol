import Link from "next/link";
import { Gift, MonitorPlay } from "lucide-react";
import { ChestRadar } from "@/components/chest-radar";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChestRadarPage({
  searchParams,
}: {
  searchParams: Promise<{ mini?: string; q?: string }>;
}) {
  const { mini, q } = await searchParams;
  if (mini === "1") {
    return <ChestRadar mini initialQuery={q ?? ""} />;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Sandık Radarı · Tüm premium özellikler açık"
        title="Sandık & jeton radarı"
        description="Sandık (chest) ve çanta (goody bag) olayları: jeton, kontenjan, katılan, oran, izleyici ve açılış geri sayımı. 16 hazır sekme (20/16, altın, askıda, oran ≥2/≥4/≥7, çanta Lv 0–10) + gelişmiş filtreler + tam sıralama. QR ile telefondan yayına katıl, jetonu manuel topla."
        actions={
          <>
            <Link href="/yayinlar" className="btn">
              <MonitorPlay size={14} /> Canlı yayınlar
            </Link>
            <Link href="/radar" className="btn btn-primary">
              <Gift size={14} /> Aday radarı
            </Link>
          </>
        }
      />
      <ChestRadar initialQuery={q ?? ""} />
    </div>
  );
}
