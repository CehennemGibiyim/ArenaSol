import { AiCoach } from "@/components/ai-coach";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function AiPage() {
  return (
    <div>
      <PageHeader
        eyebrow="AI · Live Coach"
        title="Yayın stratejisti"
        description="Senaryo, hediye stratejisi, marka teklifi ve moderasyon planlarını üret. OpenAI anahtarı varsa model, yoksa Arena yerel koç motoru yanıtlar."
        actions={<span className="chip">Türkçe · uygulanabilir çıktı</span>}
      />
      <AiCoach />
    </div>
  );
}
