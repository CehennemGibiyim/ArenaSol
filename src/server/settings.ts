import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export type ArenaSettings = {
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
  scanConcurrency: number;
  listenerCapacity: number;
  scanAllCountries: boolean;
  chestAlertMinCoins: number;
};

export const DEFAULT_SETTINGS: ArenaSettings = {
  workspaceName: "Arena Live OS",
  agencyName: "Cehennem Ajans",
  ownerName: "Arena Yönetim",
  currency: "TRY",
  defaultCommission: 20,
  timezone: "Europe/Istanbul",
  autoBot: true,
  telegramEnabled: false,
  telegramBotToken: "",
  telegramChatId: "",
  discordWebhook: "",
  tiktokSessionId: "",
  ttTargetIdc: "",
  aiTone: "enerjik",
  alertSound: "arena-hit",
  publicBaseUrl: "",
  weeklyTargetTry: 75000,
  autoScan: true,
  scanIntervalSeconds: 120,
  maxScanRooms: 12,
  listenSeconds: 30,
  chestAlertMinRatio: 2,
  scanConcurrency: 5,
  listenerCapacity: 20,
  scanAllCountries: true,
  chestAlertMinCoins: 100000,
};

export async function getSettings(): Promise<ArenaSettings> {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.id, 1)).limit(1);
    return { ...DEFAULT_SETTINGS, ...((row?.data ?? {}) as Partial<ArenaSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<ArenaSettings>): Promise<ArenaSettings> {
  const current = await getSettings();
  const next: ArenaSettings = { ...current, ...patch };
  await db
    .insert(settings)
    .values({ id: 1, data: next as unknown as Record<string, unknown>, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.id,
      set: { data: next as unknown as Record<string, unknown>, updatedAt: new Date() },
    });
  return next;
}

export function publicSettings(value: ArenaSettings): ArenaSettings {
  return {
    ...value,
    telegramBotToken: value.telegramBotToken ? "••••••••" : "",
    tiktokSessionId: value.tiktokSessionId ? "••••••••" : "",
  };
}
