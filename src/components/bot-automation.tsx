"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Bot, Check, Copy, ExternalLink, MessageSquare, Sparkles, Terminal, Zap } from "lucide-react";
import { ResourceManager } from "@/components/resource-manager";
import { Badge, Card, CardHeader } from "@/components/ui";

type Overlay = {
  id: number;
  name: string;
  slug: string;
  kind: string;
  username: string;
  accent: string;
  goal: number;
  enabled: boolean;
};

type Command = { id: number; trigger: string; matchType: string; response: string; cooldown: number; enabled: boolean };

const TABS = [
  { key: "commands", label: "Sohbet botu", icon: MessageSquare },
  { key: "alerts", label: "Uyarı kuralları", icon: Bell },
  { key: "overlays", label: "Overlay'ler", icon: Sparkles },
] as const;

export function BotAutomation() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("commands");
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [commands, setCommands] = useState<Command[]>([]);
  const [testMessage, setTestMessage] = useState("!hediye");
  const [botReply, setBotReply] = useState<{ response: string; trigger: string } | null>(null);
  const [copied, setCopied] = useState("");

  const load = () => {
    fetch("/api/resources/overlays?limit=100", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setOverlays((data.data ?? []) as Overlay[]))
      .catch(() => null);
    fetch("/api/resources/commands?limit=100", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setCommands((data.data ?? []) as Command[]))
      .catch(() => null);
  };

  useEffect(() => {
    load();
  }, []);

  const runBot = () => {
    const text = testMessage.toLowerCase();
    const match = commands.find((command) => {
      if (!command.enabled) return false;
      const trigger = command.trigger.toLowerCase().replace(/^!/, "");
      if (command.matchType === "exact") return text.replace(/^!/, "") === trigger;
      return text.includes(trigger);
    });
    if (match) {
      setBotReply({ response: match.response, trigger: match.trigger });
    } else {
      setBotReply({ response: "Eşleşen komut bulunamadı. Yayında bot yanıt vermez.", trigger: "—" });
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(""), 1800);
    } catch {
      setCopied("");
    }
  };

  return (
    <div className="space-y-4">
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
        <span className="chip ml-auto">
          <Zap size={11} /> {commands.filter((command) => command.enabled).length} aktif komut
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {tab === "commands" ? (
            <ResourceManager
              key="commands"
              resource="commands"
              title="Sohbet botu komutları"
              subtitle="Tetikleyici, yanıt ve cooldown. Gerçek yayın akışındaki chat olayları bu kurallarla işlenir."
              createLabel="Komut ekle"
              searchPlaceholder="Komut ara..."
              fields={[
                { key: "trigger", label: "Tetikleyici", type: "text", required: true, placeholder: "!hediye" },
                { key: "matchType", label: "Eşleşme", type: "select", half: true, options: ["contains", "exact"] },
                { key: "action", label: "Aksiyon", type: "select", half: true, options: ["reply", "pin", "skip"] },
                { key: "response", label: "Yanıt metni", type: "textarea", required: true },
                { key: "cooldown", label: "Cooldown (sn)", type: "number", half: true, defaultValue: 15 },
                { key: "enabled", label: "Aktif", type: "boolean", half: true, defaultValue: true },
              ]}
              columns={[
                { key: "trigger", label: "Komut" },
                { key: "matchType", label: "Eşleşme" },
                { key: "response", label: "Yanıt" },
                { key: "cooldown", label: "Cooldown", format: "number" },
                { key: "uses", label: "Kullanım", format: "number" },
                { key: "enabled", label: "Aktif", format: "bool" },
              ]}
            />
          ) : null}
          {tab === "alerts" ? (
            <ResourceManager
              key="alerts"
              resource="alerts"
              title="Hediye & etkinlik alarmları"
              subtitle="Eşik aşıldığında overlay, ses veya Telegram bildirimi tetiklenir."
              createLabel="Kural ekle"
              searchPlaceholder="Kural ara..."
              fields={[
                { key: "name", label: "Kural adı", type: "text", required: true },
                { key: "eventType", label: "Olay", type: "select", half: true, options: ["gift", "follow", "comment", "battle"] },
                { key: "threshold", label: "Eşik (elmas/adet)", type: "number", half: true, required: true, defaultValue: 100 },
                { key: "giftName", label: "Hediye filtresi", type: "text", half: true, placeholder: "boş = tümü" },
                { key: "action", label: "Aksiyon", type: "select", half: true, options: ["overlay", "overlay+sound", "telegram", "tts"] },
                { key: "sound", label: "Ses", type: "select", half: true, options: ["arena-hit", "soft-pop", "level-up", "alarm", "none"] },
                { key: "message", label: "Mesaj şablonu", type: "textarea", placeholder: "{{user}} {{diamonds}} elmas gönderdi!" },
                { key: "enabled", label: "Aktif", type: "boolean", defaultValue: true },
              ]}
              columns={[
                { key: "name", label: "Kural" },
                { key: "eventType", label: "Olay", format: "badge" },
                { key: "threshold", label: "Eşik", format: "number" },
                { key: "action", label: "Aksiyon" },
                { key: "triggerCount", label: "Tetiklenme", format: "number" },
                { key: "enabled", label: "Aktif", format: "bool" },
              ]}
            />
          ) : null}
          {tab === "overlays" ? (
            <ResourceManager
              key="overlays"
              resource="overlays"
              title="OBS overlay kayıtları"
              subtitle="Her overlay kendi slug adresinden canlı veri yayınlar."
              createLabel="Overlay ekle"
              searchPlaceholder="Overlay ara..."
              fields={[
                { key: "name", label: "Overlay adı", type: "text", required: true },
                { key: "slug", label: "Slug", type: "text", half: true, hint: "Boş bırakılırsa otomatik üretilir" },
                { key: "kind", label: "Tür", type: "select", half: true, options: ["goal", "top-gifter", "chat", "alert", "stats"] },
                { key: "username", label: "TikTok kullanıcı adı", type: "text", half: true, placeholder: "elif_live" },
                { key: "accent", label: "Renk", type: "select", half: true, options: ["cyan", "pink", "violet", "amber"] },
                { key: "goal", label: "Hedef elmas", type: "number", half: true, defaultValue: 5000 },
                { key: "enabled", label: "Aktif", type: "boolean", defaultValue: true },
              ]}
              columns={[
                { key: "name", label: "Overlay" },
                { key: "kind", label: "Tür", format: "badge" },
                { key: "slug", label: "Slug" },
                { key: "username", label: "Kullanıcı", format: "user" },
                { key: "goal", label: "Hedef", format: "number" },
                { key: "enabled", label: "Aktif", format: "bool" },
              ]}
            />
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Bot simülatörü" subtitle="Komut eşleşmesini anında test et" icon={<Terminal size={14} />} />
            <div className="p-4">
              <div className="rounded-xl border border-white/[0.08] bg-black/40 p-2.5">
                <p className="text-[9.5px] uppercase tracking-wider text-white/25">Sohbet girdisi</p>
                <div className="mt-1 flex gap-1.5">
                  <input
                    value={testMessage}
                    onChange={(event) => setTestMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") runBot();
                    }}
                    className="input !border-0 !bg-transparent !px-0 !py-0.5 !text-[12px]"
                    placeholder="!hediye"
                  />
                  <button onClick={runBot} className="btn btn-primary !px-2 !py-1 !text-[10.5px]">
                    Gönder
                  </button>
                </div>
              </div>
              {botReply ? (
                <div className="mt-2.5 rounded-xl border border-violet-400/25 bg-violet-500/10 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Bot size={11} className="text-violet-200" />
                    <p className="text-[9.5px] font-bold uppercase tracking-wider text-violet-200">
                      Arena Bot · {botReply.trigger}
                    </p>
                  </div>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-white/75">{botReply.response}</p>
                </div>
              ) : null}
              <p className="mt-2 text-[10px] leading-relaxed text-white/30">
                Gerçek yayında bot, connector&apos;dan gelen chat olaylarını dinler ve yanıtları kaydeder. TikTok
                sohbetine yazmak için oturum çerezi (session id + tt_target_idc) gerekir.
              </p>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Yayın overlay'leri"
              subtitle="OBS browser source adresleri"
              icon={<Sparkles size={14} />}
              action={<Badge tone="cyan">{overlays.length}</Badge>}
            />
            <div className="space-y-2 p-3">
              {overlays.length === 0 ? (
                <p className="p-2 text-[11px] text-white/35">Overlay kaydı yok. Overlay sekmesinden ekleyin.</p>
              ) : (
                overlays.map((overlay) => {
                  const url = `/overlay/${overlay.slug}`;
                  return (
                    <div key={overlay.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11.5px] font-semibold text-white/85">{overlay.name}</p>
                        <span className="chip !text-[9px]">{overlay.kind}</span>
                      </div>
                      <code className="mt-1 block truncate text-[9.5px] text-cyan-200/60">{url}</code>
                      <div className="mt-1.5 flex gap-1.5">
                        <Link
                          href={url}
                          target="_blank"
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/60 hover:text-white"
                        >
                          <ExternalLink size={10} /> Aç
                        </Link>
                        <button
                          onClick={() => void copy(url)}
                          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/60 hover:text-white"
                        >
                          {copied === url ? <Check size={10} /> : <Copy size={10} />}
                          {copied === url ? "Kopyalandı" : "Kopyala"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              <Link href="/kutuphane" className="btn w-full !text-[11px]">
                <Sparkles size={12} /> Web kütüphanesi / GitHub Pages
              </Link>
            </div>
          </Card>

          <Card>
            <div className="p-4">
              <p className="text-[11.5px] font-semibold text-white/80">Ayar ipucu</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-white/40">
                Telegram bildirimi için <Link href="/ayarlar" className="text-cyan-200 underline decoration-dotted">Ayarlar</Link>{" "}
                sayfasında bot token ve chat ID girin. Alarm kurallarında aksiyon olarak <code className="text-white/60">telegram</code>{" "}
                seçin.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
