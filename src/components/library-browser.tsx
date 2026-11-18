"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  GitBranch,
  Globe,
  Library,
  MonitorDown,
  Search,
  Terminal,
} from "lucide-react";
import { Badge, Card, CardHeader, Progress } from "@/components/ui";

export type LibraryRow = {
  id: number;
  name: string;
  repo: string;
  packageName: string;
  language: string;
  category: string;
  description: string;
  install: string;
  capabilities: string[];
  integration: string;
  momentum: string;
  docsUrl: string;
};

const INTEGRATION_LABELS: Record<string, { label: string; tone: "emerald" | "cyan" | "violet" }> = {
  integrated: { label: "Panele entegre", tone: "emerald" },
  ready: { label: "Hazır — uyarlanabilir", tone: "cyan" },
  planned: { label: "Yol haritası", tone: "violet" },
};

const CATEGORY_LABELS: Record<string, string> = {
  live: "LIVE connector",
  overlay: "Overlay & UI",
  data: "Veri & analiz",
  managed: "Yönetilen API",
};

export function LibraryBrowser({ items }: { items: LibraryRow[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [integration, setIntegration] = useState("");
  const [copied, setCopied] = useState("");

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (category && item.category !== category) return false;
      if (integration && item.integration !== integration) return false;
      if (query) {
        const haystack = `${item.name} ${item.description} ${item.language} ${item.capabilities.join(" ")}`.toLowerCase();
        if (!haystack.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, query, category, integration]);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  };

  const integrated = items.filter((item) => item.integration === "integrated").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="relative p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                <Globe size={15} />
              </span>
              <Badge tone="cyan">GitHub Web Kütüphanesi</Badge>
            </div>
            <h3 className="mt-3 text-[17px] font-bold tracking-tight text-white">arena-widget.js · zero dependency</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
              Elmas hedefi, top gifters, canlı sohbet, alert ve istatistik widget&apos;ları. GitHub Pages&apos;e at,
              OBS&apos;e browser source olarak ekle. Panel API&apos;sinden canlı beslenir.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["goal", "top-gifters", "chat", "alert", "stats"].map((tag) => (
                <span key={tag} className="chip !text-[9.5px]">
                  {tag}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/api/packages/library" className="btn btn-primary !text-[11.5px]">
                <Download size={13} /> Web kütüphanesini indir (.zip)
              </a>
              <button
                onClick={() =>
                  void copy(
                    '<script src="arena-widget.js"></script>\n<div data-arena="goal" data-username="elif_live" data-goal="5000"></div>',
                    "embed",
                  )
                }
                className="btn !text-[11.5px]"
              >
                {copied === "embed" ? <Check size={13} /> : <Copy size={13} />}
                {copied === "embed" ? "Kopyalandı" : "Embed kodunu kopyala"}
              </button>
            </div>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-white/[0.07] bg-black/45 p-3 text-[10.5px] leading-relaxed text-cyan-100/70">
{`<script src="arena-widget.js"></script>
<div data-arena="goal" data-username="elif_live" data-goal="5000"></div>
<div data-arena="top-gifters" data-username="elif_live"></div>`}
            </pre>
            <p className="mt-2 text-[10px] text-white/30">
              Ayrıca <span className="text-cyan-200/70">docs/WEB-KUTUPHANE.md</span> rehberi ve hazır GitHub Actions
              workflow&apos;u zip içinde gelir.
            </p>
          </div>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-12 -top-16 size-44 rounded-full bg-pink-500/15 blur-3xl" />
          <div className="relative p-5">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg border border-pink-400/25 bg-pink-500/10 text-pink-200">
                <MonitorDown size={15} />
              </span>
              <Badge tone="pink">Windows Kurulum Paketi</Badge>
            </div>
            <h3 className="mt-3 text-[17px] font-bold tracking-tight text-white">Arena Live OS · Setup bundle</h3>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
              Tam kaynak kod + `KURULUM.bat` + PowerShell sihirbazı + portable başlatıcı + NSIS kurulum şablonu.
              Çift tıkla kur, tarayıcıda panel açılır.
            </p>
            <div className="mt-3 space-y-1.5">
              {[
                ["PostgreSQL şeması otomatik uygulanır", "drizzle-kit push"],
                ["tiktok-live-connector dahil", "npm ci"],
                ["Masaüstü + başlat menüsü kısayolu", "install-windows.ps1"],
              ].map(([label, code]) => (
                <div key={label} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
                  <span className="text-[10.5px] text-white/55">{label}</span>
                  <code className="text-[9.5px] text-pink-200/60">{code}</code>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <a href="/api/packages/windows" className="btn btn-primary !text-[11.5px]">
                <Download size={13} /> Windows paketini indir (.zip)
              </a>
              <Link href="/windows" className="btn !text-[11.5px]">
                Kurulum rehberi
              </Link>
            </div>
            <p className="mt-2 text-[10px] text-white/30">
              EXE üretimi: <code className="text-white/50">node scripts/build-exe.js</code> · sonra{" "}
              <code className="text-white/50">makensis scripts/installer.nsi</code>
            </p>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="TikTok kütüphane kataloğu"
          subtitle="Ekosistemdeki connector, overlay ve veri kütüphaneleri — entegrasyon durumu ile"
          icon={<Library size={14} />}
          action={
            <div className="flex items-center gap-2">
              <Badge tone="emerald">{integrated} entegre</Badge>
              <Badge tone="cyan">{items.length} kaynak</Badge>
            </div>
          }
        />
        <div className="flex flex-col gap-2 border-b border-white/[0.06] p-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-2 rounded-[10px] border border-white/10 bg-black/30 px-2.5 py-1.5">
            <Search size={13} className="text-white/30" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Kütüphane, dil veya yetenek ara..."
              className="w-full bg-transparent text-[12px] text-white placeholder:text-white/25 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => {
                setCategory("");
                setIntegration("");
              }}
              className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${
                !category && !integration ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-white/45"
              }`}
            >
              Tümü
            </button>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCategory(category === key ? "" : key)}
                className={`rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold ${
                  category === key ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-white/[0.03] text-white/45"
                }`}
              >
                {label}
              </button>
            ))}
            <select
              value={integration}
              onChange={(event) => setIntegration(event.target.value)}
              className="input !w-auto !py-1 !text-[10.5px]"
            >
              <option value="">Entegrasyon: Tümü</option>
              <option value="integrated">Panele entegre</option>
              <option value="ready">Hazır</option>
              <option value="planned">Yol haritası</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full py-10 text-center">
              <p className="text-[12.5px] font-semibold text-white/70">Eşleşen kütüphane yok</p>
              <p className="mt-1 text-[11px] text-white/35">Filtreleri temizleyip yeniden deneyin.</p>
            </div>
          ) : (
            filtered.map((item) => {
              const meta = INTEGRATION_LABELS[item.integration] ?? INTEGRATION_LABELS.planned;
              return (
                <div
                  key={item.id}
                  className="group flex flex-col rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-3.5 transition hover:border-white/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-white/90">{item.name}</p>
                      <p className="mt-0.5 text-[10px] text-white/35">
                        {item.language} · {CATEGORY_LABELS[item.category] ?? item.category}
                      </p>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="mt-2 flex-1 text-[11px] leading-relaxed text-white/45 line-clamp-4">{item.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.capabilities.slice(0, 5).map((capability) => (
                      <span key={capability} className="rounded border border-white/[0.07] bg-white/[0.03] px-1.5 py-0.5 text-[9px] text-white/45">
                        {capability}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate rounded-md border border-white/[0.06] bg-black/40 px-2 py-1 text-[9.5px] text-cyan-200/60">
                      {item.install}
                    </code>
                    <button
                      onClick={() => void copy(item.install, `install-${item.id}`)}
                      className="grid size-6 flex-none place-items-center rounded-md border border-white/10 text-white/40 hover:text-white"
                      aria-label="Kurulum komutunu kopyala"
                    >
                      {copied === `install-${item.id}` ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                    {item.repo ? (
                      <a
                        href={item.repo}
                        target="_blank"
                        rel="noreferrer"
                        className="grid size-6 flex-none place-items-center rounded-md border border-white/10 text-white/40 hover:text-cyan-200"
                        aria-label="GitHub deposu"
                      >
                        <ExternalLink size={11} />
                      </a>
                    ) : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-wider text-white/25">
                      momentum: <span className="text-white/50">{item.momentum}</span>
                    </span>
                    {item.integration === "integrated" ? (
                      <span className="text-[9px] font-semibold text-emerald-300">Arena&apos;da aktif</span>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            title: "Node / TypeScript",
            pkg: "tiktok-live-connector",
            body: "Panelin canlı motoru. Chat, gift, like, member, social ve battle eventleri.",
            progress: 100,
          },
          {
            title: "Python",
            pkg: "TikTokLive",
            body: "Bot ve analiz işleri için event tabanlı Python istemcisi; katalogda hazır.",
            progress: 70,
          },
          {
            title: "Overlay sunucusu",
            pkg: "tiklive",
            body: "Actions/TTS fikirleri ve overlay mimarisi için referans alındı.",
            progress: 55,
          },
        ].map((item) => (
          <Card key={item.title}>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-semibold text-white/85">{item.title}</p>
                <GitBranch size={12} className="text-white/30" />
              </div>
              <code className="mt-1 block text-[10px] text-cyan-200/60">{item.pkg}</code>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/40">{item.body}</p>
              <div className="mt-2">
                <Progress value={item.progress} height={4} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Terminal size={14} className="text-cyan-200" />
            <p className="text-[11.5px] text-white/55">
              Katalog API: <code className="text-cyan-200/70">GET /api/resources/library</code> · yeni kaynak eklemek için{" "}
              <code className="text-cyan-200/70">POST /api/resources/library</code>
            </p>
          </div>
          <a href="/api/packages/library" className="btn !text-[11px]">
            <Download size={12} /> Web kütüphanesi
          </a>
        </div>
      </Card>
    </div>
  );
}
