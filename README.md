# Arena Live OS

TikTok LIVE ajansları için uçtan uca işletim paneli. Next.js (App Router) + PostgreSQL + Drizzle ORM üzerine kurulu; `tiktok-live-connector` ile erişilebilen gerçek LIVE olaylarını okur; veri yoksa uydurma sandık üretmez.

> Bu sürüm, `CehennemGibiyim/Arena` deposunun (TikTok ajans paneli) incelenmesi ve TikTok ekosistemindeki açık kaynak kütüphanelerin analizi sonrası geliştirilmiştir.
>
> **GERÇEK VERİ KURALI:** Panelde demo/simülasyon verisi YOKTUR. Canlı durum, izleyici sayısı, hediye elması ve sandık zarfı yalnızca gerçek TikTok uçlarından gelir. Yayında olmayan hesap için oturum açılmaz; veri yoksa liste boş kalır ve neden açıklanır.
>
> **KEŞİF KAPSAMI:** Bölge feed’i yalnızca `EULER_API_KEY` (EulerStream Business) varsa çalışır. Anahtarsız kullanımda kayıtlı hesaplar + sabitlenen odalar + [Tik.Tools açık örnek liste](docs/RADAR-DINLEME.md) (en fazla 10 yayın, IP başına 5 dakikada 1 istek) kontrol edilir. Bu dünya taraması değildir; kaynak boşsa boş olarak raporlanır.

## Öne çıkan sistemler

| Sistem | Açıklama | Uç |
| --- | --- | --- |
| **Canlı Stüdyo** | Chat, hediye, beğeni, takip, paylaşım olayları; top gifter tablosu, hedef barı, oturum geçmişi | `/canli`, `POST /api/live/sessions` |
| **Radar** | Toplu canlı durum kontrolü (`fetchIsLive`), aday skorlama, pipeline yönetimi | `/radar`, `POST /api/live/check` |
| **Sandık Radarı** | Canlı yayınlardaki sandıkları (treasure chest) ve hediye elmasını ayrı ölçer: jeton, kontenjan, katılan, oran (jeton ÷ kontenjan), izleyici, açılış geri sayımı, QR ile telefondan katılma, manuel jeton toplama. 16 hazır sekme + gelişmiş filtreler + 9 sıralama anahtarı | `/sandik`, `GET /api/chests`, `GET /api/chests/stream` (SSE), `GET /api/chests/export` |
| **Canlı Yayınlar** | Keşfedilen yayıncılar kalıcıdır; sabitleme (pin), izleyici/sandık/en iyi oran takibi, elle yayıncı ekleme, eşzamanlı tarama görev listesi | `/yayinlar`, `GET /api/rooms`, `PATCH /api/rooms/[id]` |
| **Eşzamanlı tarayıcı** | Worker pool ile aynı anda N oda paralel dinlenir; her doğrulanmış oda kalıcı `listener_jobs` sırasına eklenir | `POST /api/radar/scan` |
| **Küresel bölge kapsamı** | 123 bölge paralel taranır (TR/US/GB/DE/FR/…/JP/BR/NG/AU); bölge başına hata izolasyonu ve canlı oda raporu | `POST /api/radar/scan` (TÜM DÜNYA), `GET /api/radar/scan?regions=list` |
| **Local Agent** | Kendi bilgisayarınızda çalışan paralel toplayıcı; sandık + jeton akışını panele yazar | `agent/arena-agent.mjs`, `POST /api/ingest` |
| **Chat Botu** | Tetikleyici/yanıt/cooldown kuralları, eşleşme simülatörü, demo akışında otomatik yanıt | `/bot`, `api/resources/commands` |
| **Uyarı Motoru** | Hediye eşik alarmları, overlay/ses/Telegram aksiyonları | `api/resources/alerts` |
| **Overlay Sunucusu** | OBS browser source için hedef barı, top gifter, sohbet, alert, stats widget'ları | `/overlay/[slug]`, `GET /api/live/feed` |
| **GitHub Web Kütüphanesi** | Zero-dependency `arena-widget.js`, GitHub Pages workflow'u, statik overlay | `GET /api/packages/library` |
| **Windows Paketi** | `KURULUM.bat`, PowerShell sihirbazı, portable başlatıcı, NSIS şablonu | `GET /api/packages/windows` |
| **Gelir** | Elmas→TL/USD hesaplayıcı, komisyon, tahsilat durumu | `/gelir` |
| **Fırsatlar / Ajanslar / Hesaplar** | Tam CRUD, CSV dışa aktarım, arama ve filtreler | `/firsatlar`, `/ajanslar`, `/hesaplar` |
| **AI Koç** | Yayın senaryosu, hediye stratejisi, marka teklifi; OpenAI opsiyonel | `/ai`, `POST /api/ai/chat` |

## Hata dayanıklılığı

Tüm API rotaları hata yutar: geçersiz kimlik → `400`, bulunamayan kayıt → `404`, veritabanı/uzak uç hatası → açıklayıcı JSON (liste uçları `200` + `error` alanı ile bozulmadan yanıt verir). Tarayıcı döngüsü hata olsa bile ayakta kalır. QR üretimi başarısız olsa bile SVG fallback döner. UI'da her boş/başarısız durum için açıklama metni vardır.

## Hızlı başlangıç

```bash
npm ci
cp .env.example .env       # DATABASE_URL düzenle
npx drizzle-kit push
npm run build && npm run start
# İlk veri:
# Kurulum verisi + gerçek canlı kontrol (sahte veri üretmez):
curl -X POST http://localhost:3000/api/demo/seed
```

Windows için: `KURULUM.bat` → `Arena-Live-OS.bat`. Detay: [docs/WINDOWS-KURULUM.md](docs/WINDOWS-KURULUM.md)

GitHub Pages overlay kütüphanesi: [docs/WEB-KUTUPHANE.md](docs/WEB-KUTUPHANE.md)

## LiveMira premium özellikleri — hepsi ücretsiz

| LiveMira planı | Özellik | Arena |
| --- | --- | --- |
| Free | Oran 1, çanta Lv 2–10, açılış sırası | ✅ |
| Plus | **20/16 sandık**, altın sandık, askıda sandık, oran ≥2, oran ≥4, çanta Lv 0/1, süre filtresi, gelişmiş filtreler | ✅ ücretsiz |
| Pro | **Kısmet ≥7**, özel filtreler, sınırsız oda | ✅ ücretsiz |
| Bot servisi | Telegram/Discord uyarısı, 500–1000 eşzamanlı oda | ✅ ücretsiz, sınırsız |
| Uygulama | Mini pencere, ses eşiği, çoklu dil, sabit sıra, duraklat | ✅ `/sandik` |

Oran formülü LiveMira ile aynıdır: `oran = jeton ÷ kontenjan` (500 jeton / 100 kişi = 5).

## Kütüphane entegrasyonları

- **tiktok-live-connector** (Node.js) — canlı motor, gerçek Webcast bağlantısı
- **TikTokLive** (Python), **TikTokLiveSharp**, **TikTokLiveJava**, **TikTokLiveRust**, **gotiktoklive** — katalogda; dil bazlı genişleme için hazır
- **SandıkRadar** (orucmehmet-code) — sandık/çanta radarının açık kaynak referans mimarisi: GiftFlow combo sayımı, EnvelopeEvent zarf yakalama, Euler feed keşfi, imzasız canlı kontrol. Arena'nın sandık motoru bu mimariden türetildi
- **LiveMira (dichvu321)** — dünya çapında sandık keşfi + Telegram bot servisi; Arena'nın sandık radarı bu ürünün açık kaynak karşılığıdır
- **EulerStream Business API** — bölge bazlı keşif feed'i (`EULER_API_KEY` ile bağlanır)
- **tiklive**, **TikTok-Chat-Reader** — overlay ve chat UI referansları
- **EulerStream TikTok Live API** — yönetilen WebSocket alternatifi
- **TikTok-Api**, **tiktok-scraper** — radar ve içerik keşfi için veri kaynakları

Katalog panelde `/kutuphane` sayfasında canlı olarak listelenir (`library_items` tablosu).

## API

`GET /api/rooms` · `POST /api/rooms` · `PATCH/DELETE /api/rooms/[id]` · `POST /api/ingest` (local agent) · `GET /api/chests/export` · `GET /api/health` · `GET /api/live/status` · `GET/POST /api/live/sessions` · `GET /api/live/sessions/[id]` · `GET/POST /api/live/check` · `GET /api/live/feed` · `GET /api/chests` (filtreli sandık listesi + tab sayaçları) · `GET /api/chests/stream` (SSE) · `GET/PATCH/DELETE /api/chests/[id]` (detay, QR, toplama) · `GET/POST /api/radar/scan` (otomatik tarayıcı) · `GET/PUT /api/settings` · `GET/POST /api/resources/[resource]` · `PATCH/DELETE /api/resources/[resource]/[id]` · `GET /api/qr?text=` · `POST /api/ai/chat` · `POST /api/demo/seed?force=1` · `GET /api/packages/windows` · `GET /api/packages/library`

## Uyarı

TikTok LIVE verisi resmi olmayan Webcast protokolünden okunur. `tiktok-live-connector` MIT lisanslıdır ve TikTok ile bağlantılı değildir. Yalnızca kamuya açık yayınları okumak için kullanın.
