import { PageHeader } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Sistem · Yapılandırma"
        title="Ayarlar"
        description="Ajans kimliği, TikTok oturum çerezleri, Telegram/Discord bildirimleri ve demo veri yönetimi. Tüm ayarlar tek bir jsonb dokümanında saklanır."
        actions={<span className="chip">jsonb · PostgreSQL</span>}
      />
      <SettingsForm />
    </div>
  );
}
