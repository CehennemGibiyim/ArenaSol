# Arena Live OS — Windows Kurulum Rehberi

> TikTok LIVE ajansları için canlı yayın stüdyosu, radar, 7/24 sandık taraması ve gelir muhasebesi.

![Windows kurulum adımları](../public/help/windows-kurulum.svg)

## 1. Gereksinimler

| Bileşen | Sürüm | Not |
| --- | --- | --- |
| Windows | 10 / 11 (64-bit) | Windows Server 2019+ da desteklenir |
| Node.js | 22 LTS (min 20) | https://nodejs.org |
| PostgreSQL | 14+ | Yerel kurulum önerilir |
| PowerShell | 5.1+ | Yönetici gerekmez |

## 2. Kurulum paketi (önerilen)

1. [Releases](https://github.com/CehennemGibiyim/ArenaSol/releases) → en yeni sürüm.
2. `ArenaLiveOS-Setup-<sürüm>.exe` dosyasını çalıştır (kullanıcı dizinine kurulur, yönetici istemez).
3. Masaüstündeki **Arena Live OS** kısayolunu aç.

Taşınabilir sürüm:

1. `Arena-Live-OS-<sürüm>-windows.zip` arşivini bir klasöre çıkar.
2. `KURULUM.bat` dosyasına çift tıkla.

Kurulum sihirbazı (`scripts/install-windows.ps1`) şunları yapar:

- Node.js sürüm kontrolü
- `.env` oluşturma ve `DATABASE_URL` sorma (mevcut `.env` korunur)
- `npm ci` (lockfile varsa), `npx drizzle-kit push`, `npm run build`
- Agent manifesti hazırlama, masaüstü kısayolu

Bitişte:

```text
Panel      : http://localhost:3000
Başlat     : Arena-Live-OS.bat
Durdur     : Durdur.bat
Yardım     : http://localhost:3000/yardim
```

## 3. Manuel kurulum

```powershell
cd Arena-Live-OS
copy .env.example .env
notepad .env                     # DATABASE_URL düzenle
npm ci
npx drizzle-kit push
npm run build
npm run start
```

## 4. Veritabanı oluşturma

```sql
CREATE DATABASE app_db;
```

Bağlantı dizesi: `postgresql://postgres:SIFRE@127.0.0.1:5432/app_db`

## 5. Açılış akışı

`Arena-Live-OS.bat` sırayla:

1. `node_modules` yoksa `npm ci`
2. `agent/update.mjs` → GitHub manifest + sha256 karşılaştırması, değişenleri indirir
3. `.next` yoksa `npm run build`
4. `http://localhost:3000` açar
5. Ayrı pencerede `agent/arena-agent.mjs` çalışır (3 sn'de bir veri, sandık açma, `4780` durum sunucusu)
6. `npm run start` ile paneli ayakta tutar

## 6. Otomatik güncelleme

| Adım | Davranış |
| --- | --- |
| Açılış | `agent/update.mjs` tam kontrol |
| Çalışırken | Her `UPDATE_CHECK_SECONDS` (varsayılan 1800 sn) kontrol |
| Çalışan `.mjs` | Windows kilidi nedeniyle `.pending` bırakılır, sonraki açılışta uygulanır |
| Korunanlar | `.env`, veritabanı, `agent/data/*` |
| Sonuç dosyası | `agent/data/update.json` |

Depo değiştirmek için `.env`:

```env
ARENA_REPO=CehennemGibiyim/ArenaSol
ARENA_BRANCH=main
```

## 7. Sandık açma asistanı

```env
AUTO_JOIN=1
AUTO_JOIN_MIN_RATIO=1
AUTO_JOIN_MIN_COINS=100
AUTO_JOIN_LEAD_SECONDS=20
AUTO_JOIN_COOLDOWN_SECONDS=1800
```

Ajan, eşiği geçen sandığın açılışına 20 sn kala `https://www.tiktok.com/@kullanıcı/live` adresini varsayılan tarayıcıda açar, `agent/data/alerts.jsonl` dosyasına kaydeder. Aynı sandık için cooldown vardır.

> Sandık açma asistanı yalnızca yayını açar ve bildirir; **jeton toplamaz**. TikTok zarf/jeton toplama mobil oturum ister, betik hesabınıza giriş yapmaz ve sizin adınıza talep göndermez.

## 8. Servis olarak çalıştırma (opsiyonel)

NSSM ile arka plan servisi:

```powershell
nssm install ArenaLiveOS "C:\Program Files\nodejs\node.exe" "C:\Arena-Live-OS\node_modules\next\dist\bin\next start"
nssm set ArenaLiveOS AppDirectory "C:\Arena-Live-OS"
nssm set ArenaLiveOS AppEnvironmentExtra PORT=3000 DATABASE_URL=postgresql://...
nssm start ArenaLiveOS
```

## 9. Kurulum dosyası üretme (geliştirici)

```powershell
npm run build
npm run windows:bundle                 # release/Arena-Live-OS + zip
$env:ARENA_PORTABLE_NODE=1; npm run windows:bundle   # node.exe'yi de göm
npm run windows:installer              # makensis kuruluysa setup.exe
```

GitHub Actions bunu otomatik yapar: `.github/workflows/windows-release.yml` → Release'e `.exe` + `.zip` yükler.

## 10. Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| `DATABASE_URL is required` | `.env` içinde bağlantı dizesi eksik |
| `ECONNREFUSED 5432` | `Get-Service postgresql*` → `Start-Service` |
| Port 3000 dolu | `Durdur.bat` veya `.env` içinde `PORT=3100` |
| Sandık listesi boş | `docs/data/status.json` ve Actions logları; veri yoksa sahte kayıt üretilmez |
| Connector bağlanmıyor | TikTok Webcast bölgesel engeli veya yayın kapalı |
| Güncelleme inmedi | İnternet + `ARENA_REPO`; ajan 30 dk'da bir yeniden dener |

## 11. Güncelleme (git ile çalışanlar)

```powershell
git pull
npm ci
npx drizzle-kit push
npm run build
```

Otomatik yedek: `pg_dump app_db > yedek.sql`

## 12. Lisans / uyarı

TikTok LIVE verisi resmi olmayan Webcast protokolü üzerinden okunur. `tiktok-live-connector` MIT lisanslıdır ve TikTok ile bağlantılı değildir. Yalnızca kamuya açık yayınların okunması önerilir.
