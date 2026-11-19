import Link from "next/link";
import { BookOpen, Download, ExternalLink, Gift, MonitorDown, PlayCircle, Radar, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "1 · Windows kurulum paketi",
    body: "GitHub Releases sayfasından ArenaLiveOS-Setup-*.exe dosyasını indir. Taşınabilir sürüm için Arena-Live-OS-*-windows.zip arşivini açıp KURULUM.bat çalıştır.",
    code: "KURULUM.bat → Arena-Live-OS.bat → Durdur.bat",
  },
  {
    title: "2 · Veritabanı ve .env",
    body: "Sihirbaz .env oluşturur ve DATABASE_URL sorar. PostgreSQL çalışmıyorsa Get-Service postgresql* ile kontrol et. Ayarlar sayfasından panel URL ve bildirim bilgilerini girebilirsin.",
    code: "postgresql://postgres:SIFRE@127.0.0.1:5432/app_db",
  },
  {
    title: "3 · 7/24 otomatik tarama",
    body: "GitHub Actions her 5 dakikada bir tarar; sen sistemde olmasan da sandık ve yayın verisi birikir. Depo ayarlarına EULER_API_KEY ve WATCHLIST eklemek kapsamı genişletir.",
    code: "Settings → Secrets and variables → Actions",
  },
  {
    title: "4 · Sandık açma asistanı",
    body: "Ajan sandık açılışına 20 sn kala yayını tarayıcıda açar ve bildirim gönderir. Jeton toplamaz; jetonu almak için hesabınla giriş yapıp tek dokunuşla katılman gerekir.",
    code: "AUTO_JOIN=1 · AUTO_JOIN_MIN_RATIO=1 · AUTO_JOIN_LEAD_SECONDS=20",
  },
];

const ENV_ROWS: Array<[string, string, string]> = [
  ["ARENA_BACKEND", "https://<kullanıcı>.github.io/ArenaSol", "Web verisinin kaynağı"],
  ["ARENA_REPO", "CehennemGibiyim/ArenaSol", "Otomatik güncelleme deposu"],
  ["AUTO_JOIN", "1", "Sandık açılışında yayını aç"],
  ["AUTO_JOIN_MIN_RATIO", "1", "Otomatik açma için min. oran"],
  ["AUTO_JOIN_MIN_COINS", "100", "Otomatik açma için min. jeton"],
  ["AUTO_JOIN_LEAD_SECONDS", "20", "Açılıştan kaç sn önce açılsın"],
  ["POLL_SECONDS", "3", "GitHub verisi yenileme aralığı"],
  ["UPDATE_CHECK_SECONDS", "1800", "Çalışırken güncelleme kontrolü"],
  ["AGENT_PORT", "4780", "Yerel hızlı durum sunucusu"],
];

const TROUBLE: Array<[string, string]> = [
  ["DATABASE_URL is required", "Panel .env dosyasındaki bağlantı dizesi eksik. KURULUM.bat tekrar çalıştırılabilir."],
  ["ECONNREFUSED 5432", "PostgreSQL servisi kapalı: Get-Service postgresql* → Start-Service."],
  ["Panel açılmıyor", "Durdur.bat ardından Arena-Live-OS.bat. Port 3000 doluysa .env içinde PORT=3100."],
  ["Sandık listesi boş", "docs/data/status.json ve Actions loglarına bak. Veri yoksa sahte kayıt üretilmez."],
  ["Güncelleme inmedi", "ARENA_REPO ve internet erişimini kontrol et; ajan 30 dakikada bir yeniden dener."],
];

export default function HelpPage() {
  return (
    <div>
      <PageHeader
        eyebrow="Platform · Yardım"
        title="Kurulum ve kullanım rehberi"
        description="Web paneli, Windows paketi ve 7/24 sandık radarının resimli anlatımı. Aynı rehber GitHub Pages üzerinde docs/yardim.html olarak da yayınlanır."
        actions={
          <>
            <Link href="/windows" className="btn btn-primary">
              <MonitorDown size={14} /> Windows paketi
            </Link>
            <Link href="/ayarlar" className="btn">
              <Settings size={14} /> Ayarlar
            </Link>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardHeader
              title="7/24 veri akışı"
              subtitle="Sen sistemde olmasan da GitHub taraması çalışır"
              icon={<Radar size={14} />}
              action={<Badge tone="emerald">Otomatik</Badge>}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/help/veri-akisi.svg" alt="7/24 veri akışı diyagramı" className="w-full border-y border-white/[0.06]" />
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {STEPS.map((step) => (
                <div key={step.title} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <p className="text-[12px] font-semibold text-white/85">{step.title}</p>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-white/40">{step.body}</p>
                  <code className="mt-2 block break-all rounded-md bg-black/40 px-2 py-1 text-[10px] text-cyan-200/80">
                    {step.code}
                  </code>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Panel genel görünümü" subtitle="Canlı stüdyo, radar, sandık ve sistemler" icon={<BookOpen size={14} />} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/help/panel-genel.svg" alt="Panel genel görünümü" className="w-full border-y border-white/[0.06]" />
            <p className="p-4 text-[11px] leading-relaxed text-white/40">
              Üstte yayın durumu ve oturum hedefi, altta sandık radarı, yayıncı kadrosu ve sistem sağlığı yer alır.
              Tüm sayılar gerçek TikTok uçlarından veya GitHub taramasından gelir; demo/sahte veri yoktur.
            </p>
          </Card>

          <Card>
            <CardHeader title="Sandık radarı" subtitle="Oran, kontenjan ve geri sayım" icon={<Gift size={14} />} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/help/sandik-radari.svg" alt="Sandık radarı ekranı" className="w-full border-y border-white/[0.06]" />
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <p className="text-[11.5px] font-semibold text-white/80">Oran = jeton ÷ kontenjan</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-white/35">
                  500 jeton / 100 kişi = 5. Yüksek oran, kişi başı daha çok jeton demektir. 16 hazır sekme ve 9 sıralama anahtarı vardır.
                </p>
              </div>
              <div className="rounded-xl border border-amber-300/20 bg-amber-400/[0.06] p-3">
                <p className="text-[11.5px] font-semibold text-amber-100">Dürüst sınır</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-amber-100/60">
                  Sandık açma asistanı yalnızca yayını açar ve bildirir; jeton toplamaz. TikTok zarf toplama mobil
                  oturum ister, sistem hesabına giriş yapmaz ve senin adına talep göndermez.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Windows kurulum adımları" subtitle="Setup.exe veya KURULUM.bat" icon={<MonitorDown size={14} />} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/help/windows-kurulum.svg" alt="Windows kurulum adımları" className="w-full border-y border-white/[0.06]" />
            <div className="flex flex-wrap gap-2 p-4">
              <span className="chip">Node.js 22 LTS</span>
              <span className="chip">PostgreSQL 14+</span>
              <span className="chip">Windows 10/11 64-bit</span>
              <a href="/api/packages/windows" className="btn ml-auto !text-[11px]">
                <Download size={12} /> Paketi indir
              </a>
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Otomatik güncelleme" subtitle="Açılışta GitHub değişikliklerini algılar" icon={<RefreshCw size={14} />} />
            <div className="space-y-2 p-4 text-[11px] leading-relaxed text-white/45">
              <p>
                <b className="text-white/75">agent/update.mjs</b> açılışta <code>agent/manifest.json</code> indirir ve
                her dosyanın sha256 özetini karşılaştırır. Farklı dosyalar indirilir; çalışan betikler sonraki açılışta
                devreye girer.
              </p>
              <ul className="space-y-1.5">
                {[
                  "Açılışta tam kontrol + çalışırken 30 dakikada bir",
                  "Değişen dosyalar .pending olarak bırakılır",
                  ".env ve veritabanı korunur",
                  "Sonuç: agent/data/update.json",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1 size-1 flex-none rounded-full bg-cyan-300" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Ortam değişkenleri" subtitle=".env · Windows paketi" icon={<ShieldCheck size={14} />} />
            <div className="divide-y divide-white/[0.05]">
              {ENV_ROWS.map(([key, value, note]) => (
                <div key={key} className="px-4 py-2">
                  <p className="font-mono text-[10.5px] font-semibold text-cyan-200/80">{key}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-white/45">{value}</p>
                  <p className="mt-0.5 text-[9.5px] text-white/25">{note}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Sorun giderme" subtitle="En sık görülen 5 durum" icon={<Radar size={14} />} />
            <div className="divide-y divide-white/[0.05]">
              {TROUBLE.map(([title, detail]) => (
                <div key={title} className="px-4 py-2.5">
                  <p className="text-[11px] font-semibold text-white/80">{title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-white/35">{detail}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-violet-500/10 via-transparent to-pink-500/10">
            <CardHeader title="Video anlatımlar" subtitle="Yer tutucu kartlar" icon={<PlayCircle size={14} />} />
            <div className="space-y-2 p-4">
              {[
                ["Kurulum (3 dk)", "public/help/video-kurulum.mp4"],
                ["Sandık radarı (2 dk)", "public/help/video-sandik.mp4"],
                ["GitHub Pages yayını (2 dk)", "public/help/video-pages.mp4"],
              ].map(([title, file]) => (
                <div key={title} className="rounded-lg border border-dashed border-white/15 bg-black/25 p-2.5">
                  <p className="text-[11px] font-semibold text-white/80">{title}</p>
                  <p className="mt-0.5 text-[9.5px] text-white/30">
                    Kaydı <code>{file}</code> olarak ekleyince burada oynatılır.
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Bağlantılar" subtitle="Rehberler ve deposu" icon={<ExternalLink size={14} />} />
            <div className="space-y-1.5 p-3">
              <Link href="/sandik" className="btn w-full !text-[11px]">
                Sandık radarını aç
              </Link>
              <Link href="/yayinlar" className="btn w-full !text-[11px]">
                Canlı yayınları yönet
              </Link>
              <a
                href="https://github.com/CehennemGibiyim/ArenaSol"
                target="_blank"
                rel="noopener"
                className="btn w-full !text-[11px]"
              >
                GitHub deposu ↗
              </a>
              <a
                href="https://github.com/CehennemGibiyim/ArenaSol/releases"
                target="_blank"
                rel="noopener"
                className="btn w-full !text-[11px]"
              >
                Windows sürümleri ↗
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
