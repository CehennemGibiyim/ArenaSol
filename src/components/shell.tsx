"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Bot,
  Briefcase,
  Gift,
  MonitorPlay,
  Building2,
  ChevronRight,
  LayoutDashboard,
  Library,
  Menu,
  MonitorDown,
  Radar,
  Radio,
  Search,
  Settings,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";

const NAV = [
  {
    group: "Genel",
    items: [
      { href: "/", label: "Panel", icon: LayoutDashboard },
      { href: "/canli", label: "Canlı Stüdyo", icon: Radio, badge: "LIVE" },
      { href: "/radar", label: "Radar", icon: Radar },
      { href: "/yayinlar", label: "Canlı Yayınlar", icon: MonitorPlay, badge: "PIN" },
      { href: "/sandik", label: "Sandık Radarı", icon: Gift, badge: "YENİ" },
    ],
  },
  {
    group: "Yönetim",
    items: [
      { href: "/hesaplar", label: "Hesaplar", icon: Users },
      { href: "/ajanslar", label: "Ajanslar", icon: Building2 },
      { href: "/firsatlar", label: "Fırsatlar", icon: Briefcase },
      { href: "/gelir", label: "Gelir", icon: Wallet },
    ],
  },
  {
    group: "Otomasyon",
    items: [
      { href: "/bot", label: "Bot & Uyarılar", icon: Bot },
      { href: "/ai", label: "AI Koç", icon: Sparkles },
    ],
  },
  {
    group: "Platform",
    items: [
      { href: "/kutuphane", label: "Kütüphane", icon: Library },
      { href: "/windows", label: "Windows Paketi", icon: MonitorDown },
      { href: "/ayarlar", label: "Ayarlar", icon: Settings },
    ],
  },
];

const TITLES: Record<string, string> = {
  "/": "Panel",
  "/canli": "Canlı Stüdyo",
  "/radar": "Radar",
  "/sandik": "Sandık Radarı",
  "/yayinlar": "Canlı Yayınlar",
  "/hesaplar": "Hesaplar",
  "/ajanslar": "Ajanslar",
  "/firsatlar": "Fırsatlar",
  "/gelir": "Gelir",
  "/bot": "Bot & Uyarılar",
  "/ai": "AI Koç",
  "/kutuphane": "Kütüphane",
  "/windows": "Windows Paketi",
  "/ayarlar": "Ayarlar",
};

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState<{ available: boolean; version: string; detail: string } | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/overlay")) return;
    let active = true;
    fetch("/api/live/status")
      .then((response) => response.json())
      .then((data) => {
        if (active) setOnline(data.connector ?? null);
      })
      .catch(() => {
        if (active) setOnline({ available: false, version: "?", detail: "Sunucuya ulaşılamadı" });
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  if (pathname.startsWith("/overlay")) return <>{children}</>;

  const title = TITLES[pathname] ?? "Arena";

  return (
    <div className="app-bg min-h-screen">
      <div className="pointer-events-none fixed inset-0 grid-lines opacity-70" />
      <div className="relative flex min-h-screen">
        {open ? (
          <button
            aria-label="Menüyü kapat"
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setOpen(false)}
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-white/[0.07] bg-[#07070d]/95 backdrop-blur-xl transition-transform duration-200 lg:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between px-5 pb-4 pt-5">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="relative grid size-9 place-items-center overflow-hidden rounded-[11px] bg-gradient-to-br from-cyan-300 via-violet-500 to-pink-500 text-[15px] font-black text-[#05060a] shadow-[0_8px_24px_-8px_rgba(37,244,238,0.8)]">
                A
              </span>
              <span>
                <span className="block text-[12.5px] font-extrabold tracking-[0.24em] text-white">ARENA</span>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-white/35">
                  LIVE OS · v1.1
                </span>
              </span>
            </Link>
            <button className="text-white/50 lg:hidden" onClick={() => setOpen(false)} aria-label="Kapat">
              <X size={16} />
            </button>
          </div>

          <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-6">
            {NAV.map((section) => (
              <div key={section.group}>
                <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                  {section.group}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active =
                      item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[12.5px] font-medium transition ${
                          active
                            ? "border border-white/10 bg-gradient-to-r from-cyan-300/[0.14] to-pink-500/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                            : "border border-transparent text-white/50 hover:bg-white/[0.045] hover:text-white/85"
                        }`}
                      >
                        <Icon size={15} className={active ? "text-cyan-300" : "text-white/35 group-hover:text-white/70"} />
                        <span className="flex-1">{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full border border-pink-400/30 bg-pink-500/15 px-1.5 py-[1px] text-[8.5px] font-bold tracking-wider text-pink-200">
                            {item.badge}
                          </span>
                        ) : null}
                        {active ? <ChevronRight size={12} className="text-white/30" /> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] to-transparent p-3">
            <div className="flex items-center gap-2">
              <span className={`size-1.5 rounded-full ${online?.available ? "bg-emerald-400" : "bg-pink-500"}`} />
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/60">
                tiktok-live-connector
              </p>
            </div>
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-white/35">
              {online ? online.detail : "Connector durumu kontrol ediliyor..."}
            </p>
            <Link
              href="/canli"
              className="mt-2.5 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1.5 text-[10.5px] font-semibold text-white/70 hover:bg-white/10"
            >
              Stüdyoyu aç <ChevronRight size={12} />
            </Link>
          </div>

          <div className="flex items-center gap-2 border-t border-white/[0.07] px-4 py-3">
            <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-violet-500 text-[11px] font-bold text-white">
              CY
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11.5px] font-semibold text-white/85">Cehennem Yönetim</p>
              <p className="truncate text-[9.5px] uppercase tracking-wider text-white/30">Elite Partner</p>
            </div>
            <Link href="/ayarlar" aria-label="Ayarlar" className="text-white/35 hover:text-white/70">
              <Settings size={14} />
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:pl-[248px]">
          <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#050509]/80 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-3 md:px-6">
              <button
                onClick={() => setOpen(true)}
                className="grid size-8 place-items-center rounded-lg border border-white/10 text-white/60 lg:hidden"
                aria-label="Menü"
              >
                <Menu size={15} />
              </button>
              <div className="hidden items-center gap-1.5 text-[11px] text-white/30 md:flex">
                <span>Arena</span>
                <ChevronRight size={11} />
                <span className="font-semibold text-white/70">{title}</span>
              </div>

              <form action="/hesaplar" className="ml-auto hidden max-w-[280px] flex-1 items-center gap-2 md:flex">
                <div className="flex w-full items-center gap-2 rounded-[10px] border border-white/[0.09] bg-white/[0.035] px-2.5 py-1.5 focus-within:border-cyan-300/40">
                  <Search size={13} className="text-white/30" />
                  <input
                    name="q"
                    placeholder="Yayıncı, ajans, fırsat ara..."
                    className="w-full bg-transparent text-[12px] text-white placeholder:text-white/25 focus:outline-none"
                  />
                  <kbd className="rounded border border-white/10 px-1 text-[9px] text-white/30">⌘K</kbd>
                </div>
              </form>

              <div className="ml-auto flex items-center gap-2 md:ml-0">
                <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold text-white/60 sm:flex">
                  <span className={`size-1.5 rounded-full ${online?.available ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {online?.available ? "Connector hazır" : "Demo motoru"}
                </span>
                <button
                  aria-label="Bildirimler"
                  className="relative grid size-8 place-items-center rounded-lg border border-white/[0.09] bg-white/[0.03] text-white/55 hover:text-white"
                >
                  <Bell size={14} />
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-pink-500" />
                </button>
                <Link href="/canli" className="btn btn-primary !px-3 !py-1.5 !text-[11.5px]">
                  Yeni yayın
                </Link>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>

          <footer className="flex flex-col gap-1 border-t border-white/[0.06] px-6 py-4 text-[10.5px] text-white/25 sm:flex-row sm:items-center sm:justify-between">
            <span>Arena Live OS · TikTok LIVE ajans işletim sistemi</span>
            <span className="flex items-center gap-2">
              <span className="text-white/35">Connector v{online?.version ?? "2.5.0"}</span>
              <span className="text-white/15">|</span>
              <Link href="/kutuphane" className="hover:text-white/60">
                Kütüphane
              </Link>
              <span className="text-white/15">|</span>
              <Link href="/windows" className="hover:text-white/60">
                Windows paketi
              </Link>
            </span>
          </footer>
        </div>
      </div>
    </div>
  );
}
