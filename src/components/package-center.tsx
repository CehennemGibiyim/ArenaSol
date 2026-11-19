"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileArchive,
  MonitorDown,
  PackageCheck,
  Server,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui";

const TABS = [
  { key: "install", label: "Kurulum", icon: PackageCheck },
  { key: "exe", label: "EXE üretimi", icon: MonitorDown },
  { key: "api", label: "Doğrulama & API", icon: ShieldCheck },
] as const;

const FILES = [
  ["KURULUM.bat", "Çift tıkla kurulum sihirbazı"],
  ["scripts/install-windows.ps1", "Node/PostgreSQL kontrolü + .env + build"],
  ["scripts/build-exe.mjs", "Portable release klasörü + zip"],
  ["scripts/installer.nsi", "NSIS kurulum dosyası (setup.exe)"],
  ["Arena-Live-OS.bat", "Güncelleme kontrolü + panel + ajan"],
  ["Durdur.bat", "Panel ve ajanı durdurur"],
  ["agent/update.mjs", "Açılışta GitHub güncelleme kontrolü"],
  ["src/", "Next.js panel kaynak kodu"],
  ["public/arena-widget.js", "GitHub Pages overlay kütüphanesi"],
];

const EXE_COMMANDS = `# 1) Bagimliliklar ve build
npm ci
npx drizzle-kit push
npm run build

# 2) Portable dagitim klasoru + zip (release/Arena-Live-OS)
npm run windows:bundle

# 3) Opsiyonel: gomulu node runtime
$env:ARENA_PORTABLE_NODE=1; npm run windows:bundle

# 4) NSIS kurulum dosyasi (makensis kurulu ise)
npm run windows:installer
# Cikti: ArenaLiveOS-Setup-1.2.0.exe`;

const SERVICE_COMMANDS = `# NSSM ile arka plan servisi
nssm install ArenaLiveOS "C:\\Program Files\\nodejs\\node.exe" "C:\\Arena-Live-OS\\node_modules\\next\\dist\\bin\\next start"
nssm set ArenaLiveOS AppDirectory "C:\\Arena-Live-OS"
nssm set ArenaLiveOS AppEnvironmentExtra PORT=3000 DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
nssm start ArenaLiveOS`;

export function PackageCenter() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("install");
  const [copied, setCopied] = useState("");
  const [status, setStatus] = useState<{
    connector?: { available: boolean; version: string; detail: string };
    runtime?: { node: string; platform: string; realOnly: boolean; ai: boolean; telegram: boolean };
  } | null>(null);

  useEffect(() => {
    fetch("/api/live/status")
      .then((response) => response.json())
      .then((data) => setStatus(data))
      .catch(() => null);
  }, []);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-pink-500/15 blur-3xl" />
          <div className="relative p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="pink">Windows 10 / 11 · 64-bit</Badge>
              <Badge tone="cyan">v1.1.0</Badge>
              <Badge tone="emerald">Tam kaynak dahil</Badge>
            </div>
            <h3 className="mt-3 text-[20px] font-bold tracking-tight text-white">Arena Live OS kurulum paketi</h3>
            <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-white/45">
              Zip&apos;i indir, çıkart, <code className="text-white/70">KURULUM.bat</code>&apos;a çift tıkla. Sihirbaz Node ve
              PostgreSQL&apos;i kontrol eder, <code className="text-white/70">.env</code> oluşturur, şemayı uygular, production
              build alır ve masaüstü kısayolu ekler.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/api/packages/windows" className="btn btn-primary">
                <Download size={14} /> Windows paketini indir (.zip)
              </a>
              <button onClick={() => void copy(EXE_COMMANDS, "exe")} className="btn">
                {copied === "exe" ? <Check size={13} /> : <Terminal size={13} />}
                {copied === "exe" ? "Kopyalandı" : "EXE komutlarını kopyala"}
              </button>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {FILES.map(([file, description]) => (
                <div key={file} className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                  <FileArchive size={12} className="mt-0.5 flex-none text-cyan-200/60" />
                  <div className="min-w-0">
                    <p className="truncate text-[10.5px] font-semibold text-white/70">{file}</p>
                    <p className="truncate text-[9.5px] text-white/30">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Sistem gereksinimleri" subtitle="Kurulum öncesi kontrol" icon={<Server size={14} />} />
            <div className="space-y-1.5 p-3">
              {[
                ["Node.js", "20 LTS veya üzeri", "zorunlu"],
                ["PostgreSQL", "14+ (15 önerilir)", "zorunlu"],
                ["PowerShell", "5.1+", "yerleşik"],
                ["İnternet", "npm + TikTok Webcast", "önerilir"],
              ].map(([name, detail, tag]) => (
                <div key={name} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                  <div>
                    <p className="text-[11px] font-semibold text-white/75">{name}</p>
                    <p className="text-[9.5px] text-white/30">{detail}</p>
                  </div>
                  <span className="chip !text-[9px]">{tag}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Canlı ortam" subtitle="Sunucu ve connector durumu" icon={<ShieldCheck size={14} />} />
            <div className="space-y-1.5 p-3 text-[10.5px]">
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] px-2.5 py-1.5">
                <span className="text-white/40">Node runtime</span>
                <span className="font-semibold text-white/75">{status?.runtime?.node ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] px-2.5 py-1.5">
                <span className="text-white/40">Platform</span>
                <span className="font-semibold text-white/75">{status?.runtime?.platform ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] px-2.5 py-1.5">
                <span className="text-white/40">tiktok-live-connector</span>
                <Badge tone={status?.connector?.available ? "emerald" : "amber"}>
                  {status?.connector?.available ? `v${status.connector.version}` : "yüklenmedi"}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] px-2.5 py-1.5">
                <span className="text-white/40">AI sağlayıcı</span>
                <Badge tone={status?.runtime?.ai ? "emerald" : "violet"}>{status?.runtime?.ai ? "OpenAI" : "yerel koç"}</Badge>
              </div>
              <p className="px-1 pt-1 text-[9.5px] leading-relaxed text-white/25">{status?.connector?.detail}</p>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-semibold transition ${
                tab === item.key
                  ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white/80"
              }`}
            >
              <Icon size={13} /> {item.label}
            </button>
          );
        })}
      </div>

      {tab === "install" ? (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader title="Adım adım kurulum" subtitle="KURULUM.bat otomatik yapar" icon={<PackageCheck size={14} />} />
            <div className="space-y-3 p-4">
              {[
                ["Zip'i çıkart", "Örn: C:\\Arena-Live-OS — Türkçe karakter içermeyen klasör önerilir."],
                ["KURULUM.bat çalıştır", "PowerShell sihirbazı .env oluşturur ve bağımlılıkları kurar."],
                ["Veritabanı hazırla", "CREATE DATABASE app_db; ardından drizzle-kit push çalışır."],
                ["Arena-Live-OS.bat başlat", "Tarayıcı http://localhost:3000 adresinde açılır."],
                ["Kurulum verisini yükle", "Ayarlar → Kurulum verisi veya POST /api/demo/seed"],
                ["Canlı stüdyoyu bağla", "Yayında olan bir yayıncı gir; gerçek Webcast bağlantısı kurulur."],
              ].map(([title, detail], index) => (
                <div key={title} className="flex gap-3">
                  <span className="grid size-6 flex-none place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-[10px] font-bold text-cyan-200">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold text-white/85">{title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-white/40">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Windows başlatıcı" subtitle="Kurulum sonrası oluşan dosyalar" />
            <pre className="m-3 overflow-x-auto rounded-lg border border-white/[0.07] bg-black/45 p-3 text-[10.5px] leading-relaxed text-cyan-100/70">
{`@echo off
chcp 65001 >nul
title Arena Live OS
cd /d "%~dp0"
if not exist node_modules call npm ci
if not exist .next call npm run build
start "" http://localhost:3000
call npm run start`}
            </pre>
            <div className="space-y-1.5 px-3 pb-3">
              <button onClick={() => void copy("powershell -ExecutionPolicy Bypass -File scripts/install-windows.ps1", "install")} className="btn w-full !text-[11px]">
                {copied === "install" ? <Check size={12} /> : <Copy size={12} />} Kurulum komutunu kopyala
              </button>
              <button onClick={() => void copy(SERVICE_COMMANDS, "service")} className="btn w-full !text-[11px]">
                {copied === "service" ? <Check size={12} /> : <Copy size={12} />} Windows servis komutları
              </button>
              <p className="text-[9.5px] leading-relaxed text-white/25">
                NSSM ile arka planda servis olarak çalıştırabilir, uzak panel olarak yayınlayabilirsin.
              </p>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "exe" ? (
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader title="EXE & kurulum üretimi" subtitle="build-exe.js + NSIS" icon={<MonitorDown size={14} />} />
            <pre className="m-3 overflow-x-auto rounded-lg border border-white/[0.07] bg-black/45 p-3 text-[10.5px] leading-relaxed text-cyan-100/70">
              {EXE_COMMANDS}
            </pre>
            <div className="px-3 pb-3">
              <button onClick={() => void copy(EXE_COMMANDS, "exe2")} className="btn !text-[11px]">
                {copied === "exe2" ? <Check size={12} /> : <Copy size={12} />} Komutları kopyala
              </button>
            </div>
          </Card>
          <Card>
            <CardHeader title="Paketleme mimarisi" subtitle="Ne üretiliyor?" />
            <div className="space-y-2 p-4 text-[11px] leading-relaxed text-white/45">
              <p>
                <span className="font-semibold text-white/75">release/Arena-Live-OS/</span> — `.next`, `public`, `src`,
                `scripts`, `package.json`, `next.config.ts` ve `.env.example` kopyalanır.
              </p>
              <p>
                <span className="font-semibold text-white/75">Arena-Live-OS.bat</span> — bağımlılık ve build kontrolü yapar,
                sunucuyu başlatır, tarayıcıyı açar.
              </p>
              <p>
                <span className="font-semibold text-white/75">ArenaLiveOS-Setup-1.1.0.exe</span> — NSIS şablonu ile Program
                Files kurulumu, başlat menüsü + masaüstü kısayolu.
              </p>
              <p className="rounded-lg border border-amber-300/20 bg-amber-400/[0.07] p-2 text-[10px] text-amber-100/80">
                Next.js sunucusu Node runtime gerektirir. Tamamen tek .exe için `ARENA_PORTABLE_NODE=1` ile gömülü Node
                veya Electron/Tauri sarmalayıcı kullanın.
              </p>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "api" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Kurulum sonrası doğrulama" subtitle="Health & sistem uçları" icon={<ShieldCheck size={14} />} />
            <div className="space-y-1.5 p-3">
              {[
                ["GET", "/api/health", "Veritabanı ve sunucu sağlığı"],
                ["GET", "/api/live/status", "Connector + runtime bilgisi"],
                ["GET", "/api/live/sessions", "Oturum geçmişi"],
                ["POST", "/api/live/check", "Toplu canlı durum kontrolü"],
                ["GET", "/api/live/feed?username=...", "Overlay widget verisi (CORS açık)"],
                ["POST", "/api/demo/seed?force=1", "Kurulum verisini sıfırla"],
                ["GET", "/api/packages/windows", "Windows paketini indir"],
                ["GET", "/api/packages/library", "GitHub Pages kütüphanesini indir"],
              ].map(([method, path, detail]) => (
                <div key={path} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                  <span className={`rounded px-1.5 py-0.5 text-[8.5px] font-bold ${method === "GET" ? "bg-cyan-300/15 text-cyan-200" : "bg-pink-500/15 text-pink-200"}`}>
                    {method}
                  </span>
                  <code className="min-w-0 flex-1 truncate text-[10px] text-white/60">{path}</code>
                  <span className="hidden text-[9.5px] text-white/25 sm:block">{detail}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Veritabanı" subtitle="Drizzle ORM şeması" icon={<Server size={14} />} />
            <div className="space-y-2 p-4">
              <p className="text-[11px] leading-relaxed text-white/45">
                Kurulum `npx drizzle-kit push` ile 12 tabloyu oluşturur: ajanslar, yayıncılar, fırsatlar, radar adayları,
                canlı oturumlar, olaylar, bot komutları, uyarı kuralları, overlay&apos;ler, gelirler, kütüphane ve ayarlar.
              </p>
              <pre className="overflow-x-auto rounded-lg border border-white/[0.07] bg-black/45 p-3 text-[10px] leading-relaxed text-cyan-100/70">
{`DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

npx drizzle-kit push
npm run build
npm run start`}
              </pre>
              <button
                onClick={() => void copy("DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db", "db")}
                className="btn w-full !text-[11px]"
              >
                {copied === "db" ? <Check size={12} /> : <Copy size={12} />} Bağlantı dizesini kopyala
              </button>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
