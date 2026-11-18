import { asc } from "drizzle-orm";
import { Users } from "lucide-react";
import { db } from "@/db";
import { agencies } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { ResourceManager } from "@/components/resource-manager";

export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  let agencyOptions: Array<{ value: string; label: string }> = [];
  let counts = { total: 0, live: 0 };
  try {
    const rows = await db.select({ id: agencies.id, name: agencies.name }).from(agencies).orderBy(asc(agencies.name));
    agencyOptions = rows.map((row) => ({ value: String(row.id), label: row.name }));
  } catch {
    agencyOptions = [];
  }

  return (
    <div>
      <PageHeader
        eyebrow="Ajans · Kadro yönetimi"
        title="Yayıncı hesapları"
        description="Kadrodaki tüm TikTok yayıncıları, bağlı ajans, kategori ve performans metrikleri. Kayıtlar PostgreSQL üzerinde tutulur; CSV dışa aktarım ve API erişimi hazırdır."
        actions={
          <span className="chip">
            <Users size={12} /> {agencyOptions.length} ajans bağlı
          </span>
        }
      />
      <ResourceManager
        resource="creators"
        title="Yayıncı kadrosu"
        subtitle="Kullanıcı adı, ajans, takipçi ve elmas performansı"
        searchPlaceholder="Kullanıcı adı ara..."
        createLabel="Yayıncı ekle"
        emptyTitle="Kadro boş"
        emptyDescription="İlk yayıncını ekle veya demo verisini yükle."
        fields={[
          { key: "username", label: "TikTok kullanıcı adı", type: "text", required: true, placeholder: "elif_live" },
          { key: "displayName", label: "Görünen ad", type: "text", half: true, placeholder: "Elif Yıldız" },
          { key: "category", label: "Kategori", type: "select", half: true, options: ["sohbet", "oyun", "muzik", "moda", "dans", "spor", "teknoloji"] },
          { key: "agencyId", label: "Bağlı ajans", type: "select", options: [{ value: "", label: "Bağımsız" }, ...agencyOptions] },
          { key: "followers", label: "Takipçi", type: "number", half: true, defaultValue: 0 },
          { key: "avgViewers", label: "Ortalama izleyici", type: "number", half: true, defaultValue: 0 },
          { key: "diamonds", label: "Toplam elmas", type: "number", half: true, defaultValue: 0 },
          { key: "liveStatus", label: "Yayın durumu", type: "select", half: true, options: ["offline", "live", "planned"] },
          { key: "tiktokId", label: "TikTok ID", type: "text", half: true, placeholder: "otomatik" },
          { key: "notes", label: "Notlar", type: "textarea", placeholder: "Yayın saatleri, iletişim notları..." },
        ]}
        columns={[
          { key: "username", label: "Kullanıcı", format: "user" },
          { key: "displayName", label: "Ad" },
          { key: "category", label: "Kategori" },
          { key: "followers", label: "Takipçi", format: "number" },
          { key: "avgViewers", label: "İzleyici", format: "number" },
          { key: "diamonds", label: "Elmas", format: "number" },
          { key: "liveStatus", label: "Durum", format: "badge" },
          { key: "createdAt", label: "Eklendi", format: "date" },
        ]}
        filters={[
          {
            key: "liveStatus",
            label: "Durum",
            options: [
              { value: "live", label: "Canlı" },
              { value: "offline", label: "Çevrimdışı" },
              { value: "planned", label: "Planlı" },
            ],
          },
        ]}
      />
    </div>
  );
}
