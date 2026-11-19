# Arena Local Agent — localhost toplayıcı

Panele ek olarak kendi bilgisayarınızda çalışan, TikTok LIVE odalarını **paralel** dinleyen ve sandık/jeton verisini panele yazan ajan. GitHub Pages üzerindeki statik panel veya uzak sunucu ile birlikte kullanılabilir.

## Neden?

| Senaryo | Panel tarayıcısı | Local Agent |
| --- | --- | --- |
| Otomatik keşif + sandık yakalama | ✅ (sunucu tarafında) | ✅ (kendi IP'nizden) |
| Aynı anda çok oda dinleme | Panel worker pool (ayarlanabilir) | Sınırsız (CPU/bağlantı sınırı) |
| TikTok bölge/veri merkezi engeli | Sunucu IP'sine bağlı | Ev/office IP'si genelde daha iyi |
| Panel kapalıyken toplama | ❌ | ✅ (veri birikir) |

## Kapsamlı tarama (tüm ülkeler)

Panel `POST /api/radar/scan` çağrıldığında 123 bölge paralel taranır. Bölge keşfi için `EULER_API_KEY` tanımlayın; anahtar yoksa sistem izleme listesi + sabitlenen odalar üzerinden çalışmaya devam eder ve bu durumu açıkça bildirir.

## Hızlı başlangıç (Windows)

```bat
:: proje kökünde
copy .env.example .env      :: DATABASE_URL + ARENA_INGEST_TOKEN
npm ci
npx drizzle-kit push
npm run build && npm run start     :: panel: http://localhost:3000

:: ikinci terminal
agent\baslat.bat
```

## Elle çalıştırma

```bash
ARENA_PANEL_URL=http://localhost:3000 \
ARENA_INGEST_TOKEN=gizli-token \
WATCHLIST="@elif_live,@mertt34" \
CONCURRENCY=6 LISTEN_SECONDS=300 \
node agent/arena-agent.mjs
```

Değişkenler:

| Değişken | Varsayılan | Açıklama |
| --- | --- | --- |
| `ARENA_PANEL_URL` | `http://localhost:3000` | Panel adresi |
| `ARENA_INGEST_TOKEN` | boş | Panel `.env` ile aynı olmalı; boşsa ingest açıktır |
| `WATCHLIST` | boş | Virgülle ayrılmış kullanıcı adları |
| `CONCURRENCY` | `5` | Aynı anda dinlenen oda |
| `LISTEN_SECONDS` | `300` | Oda başına dinleme süresi |
| `POLL_SECONDS` | `3` | GitHub/panel verisi yenileme aralığı |
| `AUTO_JOIN` | `1` | Sandık açılışında yayını tarayıcıda aç |
| `AUTO_JOIN_MIN_RATIO` | `1` | Otomatik açma için min. oran |
| `AUTO_JOIN_LEAD_SECONDS` | `20` | Açılıştan kaç saniye önce |
| `UPDATE_CHECK_SECONDS` | `1800` | Çalışırken GitHub güncelleme kontrolü |
| `AGENT_PORT` | `4780` | Yerel hızlı durum sunucusu |

## Panel tarafı

- **Canlı Yayınlar** (`/yayinlar`): keşfedilen odalar kalıcıdır, sabitlenenler (`pin`) her turda öncelikli dinlenir.
- **Sandık Radarı** (`/sandik`): sandık filtreleri, sıralama, 16 sekme, QR ile katılma.
- Ingest ucu: `POST /api/ingest`

```bash
# sandık
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-arena-token: gizli-token" \
  -d '{"type":"chest","room":{"username":"elif_live","viewers":1200},"chest":{"envelopeId":"env-1","diamondCount":500,"peopleCount":20,"unpackAt":1760000000,"skinId":1}}'

# jeton akışı
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"type":"flow","flow":{"username":"elif_live","diamonds":12000,"events":40,"senders":12,"diamondsPerMin":2400,"watchedSeconds":300,"viewers":1500}}'
```

## GitHub Pages + Local Agent

1. **Kütüphane** sayfasından `arena-web-library.zip` indirin, GitHub Pages'e atın.
2. Statik panel (`sandik.html`) yalnızca okuyamazsa `window.ARENA_API_BASE` ile panel/agent adresini gösterin.
3. Ajan arka planda çalışırken panel verisi tazelenir; tarayıcı kapalı olsa da toplama sürer.

> TikTok oturum çerezi yalnızca **mesaj gönderme** için gerekir. Okuma (chat/hediye/zarf) çerezsiz çalışır. Oturum çerezini asla üçüncü taraflara vermeyin.
