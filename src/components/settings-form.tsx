"use client";

import { useEffect, useState } from "react";
import { Check, Database, Loader2, QrCode, Radar, RefreshCw, Save, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Badge, Card, CardHeader, InputRow } from "@/components/settings-parts";

type Settings = {
  workspaceName: string;
  agencyName: string;
  ownerName: string;
  currency: string;
  defaultCommission: number;
  timezone: string;
  autoBot: boolean;
  telegramEnabled: boolean;
  telegramBotToken: string;
  telegramChatId: string;
  discordWebhook: string;
  tiktokSessionId: string;
  ttTargetIdc: string;
  aiTone: string;
  alertSound: string;
  publicBaseUrl: string;
  weeklyTargetTry: number;
  autoScan: boolean;
  scanIntervalSeconds: number;
  maxScanRooms: number;
  listenSeconds: number;
  chestAlertMinRatio: number;
  chestAlertMinCoins: number;
  scanConcurrency: number;
  listenerCapacity: number;
  scanAllCountries: boolean;
};

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [status, setStatus] = useState<{ available: boolean; version: string; detail: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const load = async () => {
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const data = (await response.json()) as { data?: Settings };
      setSettings(data.data ?? null);
      setError("");
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  };

  useEffect(() => {
    queueMicrotask(() => void load());
    fetch("/api/live/status")
      .then((response) => response.json())
      .then((data) => setStatus(data.connector))
      .catch(() => null);
  }, []);

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = (await response.json()) as { data?: Settings; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Ayarlar kaydedilemedi");
      setSettings(data.data ?? settings);
      setNotice("Ayarlar kaydedildi.");
    } catch (saveError) {
      setError((saveError as Error).message);
    } finally {
      setSaving(false);
      setTimeout(() => setNotice(""), 3000);
    }
  };

  const seed = async () => {
    if (!window.confirm("Kurulum verisi sıfırlanıp yeniden yüklenecek. Mevcut kayıtlar silinir. Devam edilsin mi?")) return;
    setSeeding(true);
    setError("");
    try {
      const response = await fetch("/api/demo/seed?force=1", { method: "POST" });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Seed başarısız");
      setNotice(data.message ?? "Demo verisi yüklendi.");
      await load();
    } catch (seedError) {
      setError((seedError as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  if (!settings) {
    return (
      <div className="panel grid place-items-center p-14 text-[12px] text-white/40">
        <Loader2 size={16} className="mb-2 animate-spin" />
        Ayarlar yükleniyor...
      </div>
    );
  }

  const qrTarget = settings.publicBaseUrl || "http://localhost:3000";

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-400/[0.08] px-4 py-2.5 text-[12px] text-emerald-100">
          <Check size={14} /> {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-pink-400/25 bg-pink-500/[0.08] px-4 py-2.5 text-[12px] text-pink-100">{error}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Çalışma alanı" subtitle="Ajans kimliği ve finans varsayılanları" icon={<Sparkles size={14} />} />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <InputRow label="Çalışma alanı adı" value={settings.workspaceName} onChange={(value) => update("workspaceName", value)} />
              <InputRow label="Ajans adı" value={settings.agencyName} onChange={(value) => update("agencyName", value)} />
              <InputRow label="Yetkili" value={settings.ownerName} onChange={(value) => update("ownerName", value)} />
              <InputRow label="Para birimi" value={settings.currency} onChange={(value) => update("currency", value)} options={["TRY", "USD", "EUR"]} />
              <InputRow
                label="Varsayılan komisyon (%)"
                type="number"
                value={String(settings.defaultCommission)}
                onChange={(value) => update("defaultCommission", Number(value) || 0)}
              />
              <InputRow
                label="Haftalık gelir hedefi (TL)"
                type="number"
                value={String(settings.weeklyTargetTry)}
                onChange={(value) => update("weeklyTargetTry", Number(value) || 0)}
              />
              <InputRow label="Saat dilimi" value={settings.timezone} onChange={(value) => update("timezone", value)} />
              <InputRow label="Panel genel URL" value={settings.publicBaseUrl} onChange={(value) => update("publicBaseUrl", value)} placeholder="https://panel.ornek.com" />
            </div>
          </Card>

          <Card>
            <CardHeader title="TikTok bağlantısı" subtitle="Gerçek LIVE oturumu için opsiyonel çerezler" icon={<ShieldCheck size={14} />} />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <InputRow
                label="TikTok session id"
                value={settings.tiktokSessionId}
                onChange={(value) => update("tiktokSessionId", value)}
                placeholder="oturum çerezi (opsiyonel)"
                type="password"
              />
              <InputRow label="tt_target_idc" value={settings.ttTargetIdc} onChange={(value) => update("ttTargetIdc", value)} placeholder="tr" />
              <div className="col-span-full rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5 text-[10.5px] leading-relaxed text-white/35">
                Okuma (chat, hediye, izleyici) için kimlik gerekmez. Mesaj gönderme ve bazı bölgesel kısıtlar için oturum
                çerezi gerekir. Değerler maskeli saklanır; alanı boş bırakırsan mevcut değer korunur.
              </div>
              <div className="col-span-full flex flex-wrap items-center gap-2">
                <Badge tone={status?.available ? "emerald" : "amber"}>
                  connector {status?.available ? `v${status.version}` : "yok"}
                </Badge>
                <span className="text-[10px] text-white/35">{status?.detail}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Sandık radarı tarayıcısı" subtitle="Otomatik keşif, dinleme ve uyarı eşikleri" icon={<Radar size={14} />} />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <InputRow
                label="Tarama aralığı (sn)"
                type="number"
                value={String(settings.scanIntervalSeconds)}
                onChange={(value) => update("scanIntervalSeconds", Number(value) || 120)}
              />
              <InputRow
                label="Eşzamanlı dinlenen oda"
                type="number"
                value={String(settings.maxScanRooms)}
                onChange={(value) => update("maxScanRooms", Number(value) || 12)}
              />
              <InputRow
                label="Oda başına dinleme (sn)"
                type="number"
                value={String(settings.listenSeconds)}
                onChange={(value) => update("listenSeconds", Number(value) || 30)}
              />
              <InputRow
                label="Eşzamanlı dinleme (paralel oda)"
                type="number"
                value={String(settings.scanConcurrency)}
                onChange={(value) => update("scanConcurrency", Math.max(1, Number(value) || 5))}
              />
              <InputRow
                label="Toplam dinleme kapasitesi"
                type="number"
                value={String(settings.listenerCapacity ?? 20)}
                onChange={(value) => update("listenerCapacity", Math.max(1, Number(value) || 20))}
              />
              <InputRow
                label="Sandık uyarı min. oran"
                type="number"
                value={String(settings.chestAlertMinRatio)}
                onChange={(value) => update("chestAlertMinRatio", Number(value) || 0)}
              />
              <InputRow
                label="Sandık uyarı min. jeton"
                type="number"
                value={String(settings.chestAlertMinCoins)}
                onChange={(value) => update("chestAlertMinCoins", Number(value) || 0)}
              />
              <div className="col-span-full space-y-1.5">
                <button
                  onClick={() => update("scanAllCountries", !settings.scanAllCountries)}
                  className={`flex w-full items-center justify-between rounded-[10px] border px-3 py-2 text-[11.5px] font-semibold transition ${
                    settings.scanAllCountries
                      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                      : "border-white/10 bg-black/30 text-white/45"
                  }`}
                >
                  Tüm ülkeleri tara (EULER_API_KEY gerekir)
                  <span className="text-[9px] uppercase">{settings.scanAllCountries ? "açık" : "kapalı"}</span>
                </button>
                <p className="text-[9.5px] leading-relaxed text-white/25">
                  Açıkken her taramada dünya genelindeki tüm TikTok bölgeleri paralel olarak taranır. EULER_API_KEY
                  tanımlıysa bölge keşfi aktif olur; değilse izleme listesi + sabitlenen odalar taranır.
                </p>
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={() => update("autoScan", !settings.autoScan)}
                  className={`flex w-full items-center justify-between rounded-[10px] border px-3 py-2 text-[11.5px] font-semibold transition ${
                    settings.autoScan
                      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                      : "border-white/10 bg-black/30 text-white/45"
                  }`}
                >
                  Otomatik tarama
                  <span className="text-[9px] uppercase">{settings.autoScan ? "açık" : "kapalı"}</span>
                </button>
                <p className="text-[9.5px] leading-relaxed text-white/25">
                  Açıkken panel her {settings.scanIntervalSeconds} saniyede izleme listesindeki hesapları kontrol eder,
                  canlı odaları dinler ve sandık/jeton akışını kaydeder.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Bildirimler & otomasyon" subtitle="Telegram, Discord ve bot davranışı" icon={<Zap size={14} />} />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <InputRow
                label="Telegram bot token"
                value={settings.telegramBotToken}
                onChange={(value) => update("telegramBotToken", value)}
                type="password"
                placeholder="123456:ABC..."
              />
              <InputRow label="Telegram chat ID" value={settings.telegramChatId} onChange={(value) => update("telegramChatId", value)} />
              <InputRow label="Discord webhook" value={settings.discordWebhook} onChange={(value) => update("discordWebhook", value)} placeholder="https://discord.com/api/webhooks/..." />
              <InputRow label="AI tonu" value={settings.aiTone} onChange={(value) => update("aiTone", value)} options={["enerjik", "sakin", "samimi", "profesyonel"]} />
              <InputRow label="Alarm sesi" value={settings.alertSound} onChange={(value) => update("alertSound", value)} options={["arena-hit", "soft-pop", "level-up", "alarm", "none"]} />
              <div className="space-y-1.5">
                {[
                  ["Telegram bildirimi", "telegramEnabled"],
                  ["Otomatik yanıt botu", "autoBot"],
                ].map(([label, key]) => (
                  <button
                    key={key}
                    onClick={() => update(key as keyof Settings, !settings[key as keyof Settings] as never)}
                    className={`flex w-full items-center justify-between rounded-[10px] border px-3 py-2 text-[11.5px] font-semibold transition ${
                      settings[key as keyof Settings]
                        ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
                        : "border-white/10 bg-black/30 text-white/45"
                    }`}
                  >
                    {label}
                    <span className="text-[9px] uppercase">{settings[key as keyof Settings] ? "açık" : "kapalı"}</span>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => void save()} disabled={saving} className="btn btn-primary">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Ayarları kaydet
            </button>
            <button onClick={() => void load()} className="btn">
              <RefreshCw size={13} /> Sıfırla
            </button>
            <button
              onClick={async () => {
                setTesting(true);
                try {
                  await fetch("/api/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(settings),
                  });
                  const response = await fetch("/api/telegram/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                  const data = (await response.json()) as { detail?: string; channel?: string };
                  setNotice(data.detail ?? "Bildirim denendi.");
                } catch {
                  setError("Bildirim testi başarısız");
                } finally {
                  setTesting(false);
                }
              }}
              disabled={testing}
              className="btn"
            >
              {testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />} Test bildirimi
            </button>
            <span className="ml-auto text-[10px] text-white/25">
              Kayıtlar PostgreSQL&apos;de tek satırlık jsonb dokümanı olarak tutulur.
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Mobil / QR" subtitle="Paneli telefondan aç" icon={<QrCode size={14} />} />
            <div className="flex items-center gap-3 p-4">
              <div className="rounded-xl bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/qr?text=${encodeURIComponent(qrTarget)}`} alt="Panel QR" width={92} height={92} />
              </div>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold text-white/85">Panel adresi</p>
                <code className="mt-1 block break-all text-[10px] text-cyan-200/70">{qrTarget}</code>
                <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">
                  Yerel ağdan erişim için sunucuyu <code>0.0.0.0</code> adresinde dinletin ve güvenlik duvarı kuralı ekleyin.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Kurulum verisi" subtitle="İzleme listesi + ayarlar + gerçek canlı kontrol" icon={<Database size={14} />} />
            <div className="space-y-2 p-4">
              <p className="text-[10.5px] leading-relaxed text-white/40">
                Panel ayarlarını, izleme listesindeki yayıncıları, bot komutlarını, uyarı kurallarını, overlay&apos;leri ve
                kütüphane kataloğunu yükler; ardından ilk 6 hesabı <b className="text-white/60">gerçek TikTok
                uçlarından</b> kontrol eder. Sahte sandık, izleyici veya jeton üretmez.
              </p>
              <button onClick={() => void seed()} disabled={seeding} className="btn w-full !text-[11.5px]">
                {seeding ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />} Kurulum verisini sıfırla ve yükle
              </button>
              <p className="text-[9.5px] text-white/25">API: POST /api/demo/seed?force=1</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Dışa aktarım" subtitle="Kurulum ve kütüphane paketleri" />
            <div className="space-y-1.5 p-3">
              <a href="/api/packages/windows" className="btn w-full !text-[11px]">
                Windows kurulum paketi (.zip)
              </a>
              <a href="/api/packages/library" className="btn w-full !text-[11px]">
                GitHub Pages web kütüphanesi
              </a>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- /api JSON ucu, sayfa değil */}
              <a href="/api/resources/creators" className="btn w-full !text-[11px]">
                Yayıncı verisi (JSON API)
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
