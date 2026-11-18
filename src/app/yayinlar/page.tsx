import Link from "next/link";
import { Gift, Pin, Radar as RadarIcon } from "lucide-react";
import { LiveRooms } from "@/components/live-rooms";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function LiveRoomsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Keşif · Canlı yayın izleme"
        title="Canlı yayınlar & sabitlenen yayıncılar"
        description="Otomatik keşfedilen TikTok LIVE yayıncıları panelde kalıcı tutulur. Sabitlediğin odalar her taramada öncelikli dinlenir; sandık sayısı, en iyi oran, izleyici ve jeton akışı gerçek verilerle güncellenir."
        actions={
          <>
            <Link href="/sandik" className="btn">
              <Gift size={14} /> Sandık radarı
            </Link>
            <Link href="/radar" className="btn btn-primary">
              <RadarIcon size={14} /> Aday radarı
            </Link>
          </>
        }
      />
      <LiveRooms />
    </div>
  );
}
