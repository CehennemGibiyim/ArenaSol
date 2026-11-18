"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, Wand2 } from "lucide-react";
import { Badge, Card, CardHeader } from "@/components/ui";

type Message = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  { label: "Hediye stratejisi", prompt: "Bu haftaki yayın için 3 kademeli hediye stratejisi hazırla." },
  { label: "60 dk senaryo", prompt: "Sohbet kategorisinde 60 dakikalık yayın senaryosu yaz." },
  { label: "Marka teklifi", prompt: "Moda markası için sponsorluk teklif metni ve fiyat paketleri oluştur." },
  { label: "Moderasyon", prompt: "Sohbette spam artışı var, moderasyon protokolü öner." },
  { label: "PK battle", prompt: "PK battle yayınında izleyiciyi tutacak taktikler ver." },
];

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={index}>{part}</span>;
  });
}

function Markdownish({ content }: { content: string }) {
  return (
    <div className="space-y-1.5">
      {content.split("\n").map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;
        if (trimmed.startsWith("### ")) {
          return (
            <p key={index} className="text-[12.5px] font-bold uppercase tracking-wide text-cyan-200">
              {trimmed.replace("### ", "")}
            </p>
          );
        }
        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          return (
            <p key={index} className="text-[12.5px] font-semibold text-white">
              {trimmed.replace(/\*\*/g, "")}
            </p>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={index} className="flex gap-2 text-[12px] leading-relaxed text-white/70">
              <span className="mt-[7px] size-1 flex-none rounded-full bg-cyan-300/70" />
              <span>{renderInline(trimmed.slice(2))}</span>
            </div>
          );
        }
        if (/^\d+\./.test(trimmed)) {
          return (
            <div key={index} className="flex gap-2 text-[12px] leading-relaxed text-white/70">
              <span className="flex-none font-semibold text-cyan-200">{trimmed.match(/^\d+/)?.[0]}.</span>
              <span>{renderInline(trimmed.replace(/^\d+\.\s*/, ""))}</span>
            </div>
          );
        }
        return (
          <p key={index} className="text-[12px] leading-relaxed text-white/65">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export function AiCoach() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "### Arena Live Coach hazır\nYayın akışı, hediye stratejisi, marka teklifi veya moderasyon hakkında ne planlıyoruz? Hızlı başlıklardan birini seçebilir ya da kendi sorunu yazabilirsin.",
    },
  ]);
  const [input, setInput] = useState("");
  const [tone, setTone] = useState("enerjik");
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<{ provider: string; model: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ai/chat")
      .then((response) => response.json())
      .then((data) => {
        setProvider({ provider: data.provider, model: data.model });
        if (data.tone) setTone(data.tone);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, tone }),
      });
      const data = (await response.json()) as { reply?: string; error?: string; provider?: string };
      if (!response.ok || !data.reply) throw new Error(data.error ?? "Yanıt alınamadı");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply as string }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `**Hata:** ${(error as Error).message}. Panel API'sini kontrol edin.` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <Card className="flex min-h-[560px] flex-col overflow-hidden">
        <CardHeader
          title="Arena Live Coach"
          subtitle="Yayın stratejisi, monetizasyon ve marka iş birlikleri"
          icon={<Sparkles size={14} />}
          action={<Badge tone={provider?.provider === "openai" ? "emerald" : "violet"}>{provider?.model ?? "arena-coach-v1"}</Badge>}
        />
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: 470 }}>
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-2.5 ${message.role === "user" ? "justify-end" : ""}`}>
              {message.role === "assistant" ? (
                <span className="mt-0.5 grid size-7 flex-none place-items-center rounded-lg border border-cyan-300/25 bg-cyan-300/10 text-cyan-200">
                  <Sparkles size={12} />
                </span>
              ) : null}
              <div
                className={`max-w-[86%] rounded-xl border px-3.5 py-2.5 ${
                  message.role === "user"
                    ? "border-white/10 bg-white/[0.07] text-[12px] leading-relaxed text-white/80"
                    : "border-white/[0.08] bg-black/30"
                }`}
              >
                {message.role === "assistant" ? <Markdownish content={message.content} /> : message.content}
              </div>
            </div>
          ))}
          {loading ? (
            <div className="flex items-center gap-2 text-[11.5px] text-white/40">
              <Loader2 size={13} className="animate-spin" /> Koç plan hazırlıyor...
            </div>
          ) : null}
        </div>
        <div className="border-t border-white/[0.07] p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Örn: Bu akşamki yayın için 5 hediye taktiği ver..."
              className="input !min-h-[44px] flex-1 resize-none"
            />
            <button onClick={() => void send()} disabled={loading || !input.trim()} className="btn btn-primary h-[42px]">
              <Send size={14} /> Gönder
            </button>
          </div>
          <p className="mt-1.5 text-[9.5px] text-white/25">
            Enter ile gönder · Shift+Enter yeni satır · Yanıtlar strateji önerisidir, resmi TikTok verisi değildir.
          </p>
        </div>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader title="Hızlı başlıklar" subtitle="Tek tıkla plan üret" icon={<Wand2 size={14} />} />
          <div className="grid gap-1.5 p-3">
            {QUICK_PROMPTS.map((item) => (
              <button
                key={item.label}
                onClick={() => void send(item.prompt)}
                className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2 text-left text-[11.5px] text-white/65 transition hover:border-cyan-300/30 hover:text-cyan-100"
              >
                {item.label}
                <span className="text-white/20">→</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Ton ayarı" subtitle="Yanıtların üslubunu belirle" />
          <div className="grid grid-cols-2 gap-1.5 p-3">
            {["enerjik", "sakin", "samimi", "profesyonel"].map((item) => (
              <button
                key={item}
                onClick={() => setTone(item)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold capitalize transition ${
                  tone === item
                    ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100"
                    : "border-white/10 bg-white/[0.02] text-white/45"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="p-4">
            <p className="text-[11.5px] font-semibold text-white/80">Sağlayıcı durumu</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-white/40">
              {provider?.provider === "openai"
                ? "OPENAI_API_KEY tanımlı. Model destekli yanıtlar kullanılıyor."
                : "API anahtarı yok; Arena yerel koç motoru çalışıyor. OPENAI_API_KEY ekleyerek model desteğini açabilirsin."}
            </p>
            <code className="mt-2 block break-all rounded-md border border-white/[0.07] bg-black/40 p-2 text-[10px] text-cyan-200/70">
              POST /api/ai/chat {`{ "message": "...", "tone": "${tone}" }`}
            </code>
          </div>
        </Card>
      </div>
    </div>
  );
}
