import Link from "next/link";
import { BotAutomation } from "@/components/bot-automation";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function BotPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Otomasyon · Chat + Alarm + Overlay"
        title="Bot & uyarı merkezi"
        description="TikTok LIVE sohbet komutları, hediye/sandık eşik alarmları ve OBS overlay kayıtları. Gerçek yayın olayları bu kurallarla işlenir; kurallar veritabanında saklanır."
        actions={
          <>
            <Link href="/canli" className="btn">
              Canlı stüdyo
            </Link>
            <Link href="/kutuphane" className="btn btn-primary">
              Overlay kütüphanesi
            </Link>
          </>
        }
      />
      <BotAutomation />
    </div>
  );
}
