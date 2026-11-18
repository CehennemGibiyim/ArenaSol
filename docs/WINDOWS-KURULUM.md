# Arena Live OS — Windows Kurulum Rehberi

> TikTok LIVE ajansları için canlı yayın stüdyosu, radar, bot, overlay sunucusu ve gelir muhasebesi.

## 1. Gereksinimler

| Bileşen | Sürüm | Not |
| --- | --- | --- |
| Windows | 10 / 11 (64-bit) | Windows Server 2019+ da desteklenir |
| Node.js | 20 LTS veya üzeri | https://nodejs.org |
| PostgreSQL | 14+ | Yerel kurulum önerilir |
| PowerShell | 5.1+ | Yönetici olarak çalıştırın |

## 2. Hızlı kurulum (paket)

1. `Arena-Live-OS-windows.zip` dosyasını indirin ve bir klasöre çıkartın.
2. `KURULUM.bat` dosyasına çift tıklayın.
3. Sihirbaz; `.env` oluşturur, `npm ci` çalıştırır, veritabanı şemasını uygular (`drizzle-kit push`) ve production build alır.
4. Kurulum sonunda `Arena-Live-OS.bat` dosyasını çalıştırın.
5. Tarayıcıda `http://localhost:3000` açılır. Kurulum verisi (izleme listesi + ayarlar) için:

```powershell
Invoke-RestMethod -Method Post "http://localhost:3000/api/demo/seed"
```

## 3. Manuel kurulum

```powershell
cd Arena-Live-OS
copy .env.example .env
notepad .env                     # DATABASE_URL değerini düzenleyin
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

## 5. Servis olarak çalıştırma (opsiyonel)

NSSM ile arka plan servisi:

```powershell
nssm install ArenaLiveOS "C:\Program Files\nodejs\node.exe" "C:\Arena-Live-OS\node_modules\next\dist\bin\next start"
nssm set ArenaLiveOS AppDirectory "C:\Arena-Live-OS"
nssm set ArenaLiveOS AppEnvironmentExtra PORT=3000 DATABASE_URL=postgresql://...
nssm start ArenaLiveOS
```

## 6. EXE / kurulum dosyası üretme

```powershell
npm run build
node scripts/build-exe.js
# İsteğe bağlı portable Node:
$env:ARENA_PORTABLE_NODE=1; node scripts/build-exe.js
# NSIS kurulum dosyası (makensis kurulu ise):
makensis scripts/installer.nsi
```

Çıktı: `release/Arena-Live-OS/` klasörü + `ArenaLiveOS-Setup-1.1.0.exe`.

> **Not:** Next.js sunucusu Node runtime gerektirir. `build-exe.js` bu nedenle portable bir klasör + çift tıkla çalışan başlatıcı üretir; NSIS ile tek dosya kurulum paketine dönüştürülür. Tamamen tek `.exe` isteyenler için Electron/Tauri sarmalayıcı veya `ARENA_PORTABLE_NODE=1` ile gömülü `node.exe` kullanın.

## 7. TikTok LIVE bağlantısı

- `tiktok-live-connector` paketi kurulumla birlikte gelir (`package.json`).
- Panel → **Canlı Stüdyo** → kullanıcı adı → **Yayına bağlan**.
- Yayın aktif ve TikTok Webcast erişilebilirse gerçek bağlantı kurulur; aksi halde otomatik olarak demo motoru ile tüm panel canlı çalışır.
- Okuma (chat, hediye, sandık) için kimlik gerekmez; sadece **mesaj gönderme** özelliği için `TIKTOK_SESSION_ID` ve `TT_TARGET_IDC` gerekir. Ayarlar sayfasından da girilebilir.
- Connector durumu: `GET /api/live/status`.

## 8. Sorun giderme

| Belirti | Çözüm |
| --- | --- |
| `DATABASE_URL is required` | `.env` dosyasında bağlantı dizesi eksik |
| `ECONNREFUSED 5432` | PostgreSQL servisi kapalı: `Get-Service postgresql*` |
| Port 3000 dolu | `Durdur.bat` çalıştırın veya `PORT=3100 npm run start` |
| Connector bağlanmıyor | TikTok Webcast bölgesel engeli veya yayın kapalı; hata mesajını kontrol edin |
| Build yavaş | `npm run build` ilk seferde 1-2 dk sürebilir |

## 9. Güncelleme

```powershell
git pull            # veya yeni zip'i üzerine yazın (.env korunur)
npm ci
npx drizzle-kit push
npm run build
```

Otomatik yedek için `pg_dump app_db > yedek.sql` komutunu planlayın.

## 10. Lisans / uyarı

TikTok LIVE verisi resmi olmayan Webcast protokolü üzerinden okunur. `tiktok-live-connector` MIT lisanslıdır ve TikTok ile bağlantılı değildir. Yalnızca kamuya açık yayınların okunması önerilir.
