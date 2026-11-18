import { PageHeader } from "@/components/ui";
import { ResourceManager } from "@/components/resource-manager";

export const dynamic = "force-dynamic";

export default function AgenciesPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Network · Ortaklıklar"
        title="Ajanslar & networkler"
        description="Komisyon oranı, tier ve iletişim bilgileriyle ajans kayıtlarını yönet. Her yayıncı bir ajansa bağlanabilir; gelir hesaplamaları bu komisyon oranlarını kullanır."
        actions={<span className="chip">Tier: starter → growth → elite</span>}
      />
      <ResourceManager
        resource="agencies"
        title="Ajans kayıtları"
        subtitle="Komisyon, şehir ve tier bilgileri"
        createLabel="Ajans ekle"
        searchPlaceholder="Ajans adı ara..."
        fields={[
          { key: "name", label: "Ajans adı", type: "text", required: true, placeholder: "Nova Talent" },
          { key: "owner", label: "Yetkili", type: "text", half: true },
          { key: "contact", label: "İletişim", type: "text", half: true, placeholder: "@kullanici / telefon" },
          { key: "city", label: "Şehir", type: "text", half: true, defaultValue: "İstanbul" },
          { key: "commissionRate", label: "Komisyon (%)", type: "number", half: true, defaultValue: 20 },
          { key: "tier", label: "Tier", type: "select", half: true, options: ["starter", "growth", "elite"] },
          { key: "status", label: "Durum", type: "select", half: true, options: ["active", "onboarding", "archived"] },
          { key: "notes", label: "Notlar", type: "textarea" },
        ]}
        columns={[
          { key: "name", label: "Ajans" },
          { key: "owner", label: "Yetkili" },
          { key: "city", label: "Şehir" },
          { key: "commissionRate", label: "Komisyon", format: "number" },
          { key: "tier", label: "Tier", format: "badge" },
          { key: "status", label: "Durum", format: "badge" },
          { key: "createdAt", label: "Kayıt", format: "date" },
        ]}
        filters={[
          {
            key: "status",
            label: "Durum",
            options: [
              { value: "active", label: "Aktif" },
              { value: "onboarding", label: "Kurulumda" },
              { value: "archived", label: "Arşiv" },
            ],
          },
        ]}
      />
    </div>
  );
}
