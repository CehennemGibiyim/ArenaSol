import { db } from "@/db";
import { activityLog } from "@/db/schema";
import { getSettings } from "@/server/settings";

export type NotifyResult = {
  sent: boolean;
  channel: "telegram" | "discord" | "none";
  detail: string;
};

/**
 * Alarm motoru bildirimi. Telegram bot token + chat ID veya Discord webhook
 * tanımlıysa gerçek istek gönderilir; aksi halde panel log'una yazılır.
 */
export async function sendNotification(text: string, rule = "arena-alert"): Promise<NotifyResult> {
  const settings = await getSettings();
  const message = `🎯 ${settings.agencyName} · ${rule}\n${text}`;
  let result: NotifyResult = { sent: false, channel: "none", detail: "Bildirim kanalı tanımlı değil." };

  const token = settings.telegramBotToken;
  const chatId = settings.telegramChatId;
  if (settings.telegramEnabled && token && chatId) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML", disable_web_page_preview: true }),
      });
      const payload = (await response.json()) as { ok?: boolean; description?: string };
      result = payload.ok
        ? { sent: true, channel: "telegram", detail: "Telegram bildirimi gönderildi." }
        : { sent: false, channel: "telegram", detail: payload.description ?? "Telegram isteği başarısız." };
    } catch (error) {
      result = { sent: false, channel: "telegram", detail: `Telegram hatası: ${(error as Error).message}` };
    }
  } else if (settings.discordWebhook) {
    try {
      const response = await fetch(settings.discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message }),
      });
      result = response.ok
        ? { sent: true, channel: "discord", detail: "Discord webhook bildirimi gönderildi." }
        : { sent: false, channel: "discord", detail: `Discord HTTP ${response.status}` };
    } catch (error) {
      result = { sent: false, channel: "discord", detail: `Discord hatası: ${(error as Error).message}` };
    }
  }

  await db.insert(activityLog).values({
    kind: "alerts",
    message: result.sent ? `Bildirim gönderildi (${result.channel}): ${rule}` : `Bildirim kuyruğa alındı: ${rule}`,
    meta: { rule, channel: result.channel, sent: result.sent, detail: result.detail },
  });

  return result;
}

export async function notificationStatus() {
  const settings = await getSettings();
  return {
    telegram: { enabled: settings.telegramEnabled, configured: Boolean(settings.telegramBotToken && settings.telegramChatId) },
    discord: { configured: Boolean(settings.discordWebhook) },
    agency: settings.agencyName,
  };
}
