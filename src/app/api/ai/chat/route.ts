import { NextResponse } from "next/server";
import { db } from "@/db";
import { activityLog } from "@/db/schema";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

type ChatBody = { message?: string; mode?: string; tone?: string };

const SYSTEM_PROMPT = `Sen "Arena Live Coach" adlı bir TikTok LIVE büyüme stratejistisin.
Türkçe, net ve uygulanabilir yanıt ver. Kısa başlıklar, madde işaretleri ve somut sayılar kullan.
Yanıtlarında: yayın akışı, hediye stratejisi, etkileşim hook'ları, moderasyon, marka iş birliği veya ajans yönetimi konularına odaklan.
5-9 maddeyi geçme. Uydurma istatistik verme; varsayım yaparsan bunu belirt.`;

function localCoach(message: string, tone: string): string {
  const text = message.toLowerCase();
  const intro = `### ${tone === "sakin" ? "Sakin" : "Enerjik"} koç planı`;
  if (text.includes("hediye") || text.includes("gift") || text.includes("elmas")) {
    return `${intro}
**Hediye stratejisi (bu yayın için)**
1. İlk 10 dakikada hedefi ekranda göster: "Bugün 5.000 elmas = 24 saat ekstra yayın".
2. 3 kademeli ödül: 500 elmas → özel selam, 2.000 → oyun seçimi, 5.000 → kostüm/etkinlik.
3. Hediye panelinde en düşük 3 hediyeyi isimle an, "Gül gönderen herkesin adını okuyorum" de.
4. Her 15 dakikada bir "top gifter" tablosunu yüksek sesle oku.
5. Streak gift anlarını kaçırma: aynı kullanıcı üst üste gönderdiğinde adını tekrar et.
6. Bot komutu: \`!hediye\` → hedef + ödül açıklaması. Panelde hazır kural var.
**Beklenen etki:** aynı izleyici sayısında %18-30 daha fazla hediye dönüşümü.`;
  }
  if (text.includes("senaryo") || text.includes("akış") || text.includes("plan")) {
    return `${intro}
**60 dakikalık yayın senaryosu**
- **0-5 dk | Hook:** "Bugün hesabı büyüten 3 taktiği canlı deneyeceğiz" + hedefi göster.
- **5-15 dk | Isınma:** Selam turu, yeni gelenlere isimle teşekkür, sohbet sorusu.
- **15-30 dk | Ana blok:** Oyun/performans + \`!taktik\` komutu ile hedef hatırlatması.
- **30-40 dk | Etkileşim:** Kalp fırtınası, 1000 beğeni = mini ödül.
- **40-50 dk | Monetizasyon:** Hediye hedefi + top 3 destekçiyi anons et.
- **50-60 dk | Kapanış:** Sonraki yayın saati, takip CTA, Discord/Instagram yönlendirmesi.
**Ölçüm:** ortalama izlenme süresi, yeni takipçi, elmas/dakika.`;
  }
  if (text.includes("marka") || text.includes("sponsor") || text.includes("iş birliği")) {
    return `${intro}
**Marka iş birliği paketi**
1. Medya kiti: son 30 günün peak izleyici, ortalama izlenme süresi, elmas ve demografi özeti.
2. 3 paket fiyatla: tek yayın entegrasyonu, 3 bölümlük seri, ay boyu sponsorluk.
3. Ölçülebilir çıktı ver: indirim kodu, link tıklaması, ekran görüntüsü raporu.
4. Fırsatlar sayfasında \`matchScore\` 80+ olan 3 markayı seç, kişiselleştirilmiş DM at.
5. Teklifte net teslim tarihi ve revizyon sayısı belirt; ajans komisyonunu sözleşmeye ekle.`;
  }
  if (text.includes("moderasyon") || text.includes("spam") || text.includes("kriz")) {
    return `${intro}
**Moderasyon protokolü**
1. 3 seviyeli kural: uyarı → 60 sn timeout → kalıcı ban.
2. Bot komutlarına küfür/spam tetikleyicileri ekle ve \`enabled\` durumunu yayın öncesi kontrol et.
3. Uyarı sesi ve overlay mesajını nötr tut: "Sohbet kurallarına uyalım 🤍".
4. Her yayın sonunda moderasyon logunu incele, tekrar eden kullanıcıları kara listeye al.
5. Yayın sırasında 2 moderatör hedefle: biri sohbet, biri hediye/etkinlik.`;
  }
  return `${intro}
**Yayın büyütme kontrol listesi**
1. Açılışta 3 saniyelik net vaat: "Bu yayında ne kazanacaklar?"
2. İlk 15 dakikada 10 farklı izleyicinin adını söyle — yorum oranı artar.
3. Her 10 dakikada bir soru sor, cevapları ekrandan oku.
4. Yayın süresini sabitle: haftada 4 gün, aynı saat (20:30 önerilir).
5. Bir yayında yalnızca tek hedef koy; hedefi overlay ile görünür yap.
6. Bot ile \`!sosyal\`, \`!hediye\`, \`!taktik\` komutlarını mutlaka aktif et.
7. Yayın sonrası 15 dakikada kesit paylaş; bir sonraki yayına trafik taşır.
**Sonraki adım:** LIVE Studio'da demo yayın başlat, gerçek zamanlı metrikleri izle.`;
}

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({
    provider: process.env.OPENAI_API_KEY ? "openai" : "arena-local",
    model: process.env.OPENAI_API_KEY ? process.env.OPENAI_MODEL ?? "gpt-4o-mini" : "arena-coach-v1",
    tone: settings.aiTone,
    modes: ["hediye", "senaryo", "marka", "moderasyon", "genel"],
  });
}

export async function POST(request: Request) {
  let body: ChatBody = {};
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }
  const message = (body.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "Mesaj gerekli" }, { status: 400 });
  const settings = await getSettings();
  const tone = body.tone ?? settings.aiTone ?? "enerjik";

  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
          temperature: 0.7,
          max_tokens: 700,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Ton: ${tone}\nAjans: ${settings.agencyName}\nSoru: ${message}` },
          ],
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const reply = data.choices?.[0]?.message?.content?.trim();
        if (reply) {
          await db.insert(activityLog).values({ kind: "ai", message: `AI koç yanıtı: ${message.slice(0, 60)}` });
          return NextResponse.json({ reply, provider: "openai", tone });
        }
      }
    } catch {
      /* yerel koça düş */
    }
  }

  const reply = localCoach(message, tone);
  await db.insert(activityLog).values({ kind: "ai", message: `Yerel koç yanıtı: ${message.slice(0, 60)}` });
  return NextResponse.json({ reply, provider: "arena-local", tone });
}
