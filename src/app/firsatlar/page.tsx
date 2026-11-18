import { Briefcase } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { ResourceManager } from "@/components/resource-manager";

export const dynamic = "force-dynamic";

export default function OpportunitiesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Gelir · Marka iş birlikleri"
        title="Fırsat panosu"
        description="Marka tekliflerini tek boru hattında takip et: açık, başvurulan, kazanılan ve kaybedilen. Uyum skoru yüksek fırsatlar önce gösterilir; CSV ile dışa aktarabilirsin."
        actions={
          <span className="chip">
            <Briefcase size={12} /> Pipeline yönetimi
          </span>
        }
      />
      <ResourceManager
        resource="opportunities"
        title="İş birliği fırsatları"
        subtitle="Bütçe, komisyon ve teslim tarihi takibi"
        createLabel="Fırsat ekle"
        searchPlaceholder="Başlık ara..."
        fields={[
          { key: "title", label: "Başlık", type: "text", required: true, placeholder: "Yaz koleksiyonu lansmanı" },
          { key: "brand", label: "Marka", type: "text", half: true },
          { key: "category", label: "Kategori", type: "select", half: true, options: ["canli-yayin", "moda", "oyun", "muzik", "sohbet", "spor", "teknoloji"] },
          { key: "budget", label: "Bütçe", type: "number", half: true, defaultValue: 0 },
          { key: "currency", label: "Para birimi", type: "select", half: true, options: ["TRY", "USD", "EUR"] },
          { key: "deadline", label: "Teslim tarihi", type: "text", half: true, placeholder: "2026-08-01" },
          { key: "commission", label: "Komisyon (%)", type: "number", half: true, defaultValue: 15 },
          { key: "status", label: "Durum", type: "select", half: true, options: ["open", "applied", "won", "lost"] },
          { key: "matchScore", label: "Uyum skoru", type: "number", half: true, defaultValue: 60 },
          { key: "source", label: "Kaynak", type: "text", half: true, defaultValue: "Arena Radar" },
          { key: "requirements", label: "Gereksinimler", type: "textarea" },
        ]}
        columns={[
          { key: "title", label: "Fırsat" },
          { key: "brand", label: "Marka" },
          { key: "budget", label: "Bütçe", format: "money" },
          { key: "commission", label: "Komisyon", format: "number" },
          { key: "matchScore", label: "Uyum", format: "score" },
          { key: "status", label: "Durum", format: "badge" },
          { key: "deadline", label: "Teslim" },
        ]}
        filters={[
          {
            key: "status",
            label: "Durum",
            options: [
              { value: "open", label: "Açık" },
              { value: "applied", label: "Başvurulan" },
              { value: "won", label: "Kazanılan" },
              { value: "lost", label: "Kaybedilen" },
            ],
          },
        ]}
      />
    </div>
  );
}
