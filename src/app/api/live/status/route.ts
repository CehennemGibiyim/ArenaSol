import { NextResponse } from "next/server";
import { getConnectorStatus } from "@/server/live";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const connector = await getConnectorStatus();
  const settings = await getSettings();
  return NextResponse.json({
    connector,
    runtime: {
      node: process.version,
      platform: process.platform,
      realOnly: true,
      telegram: settings.telegramEnabled === true,
      ai: Boolean(process.env.OPENAI_API_KEY),
      region: process.env.TZ ?? "Europe/Istanbul",
    },
    systems: [
      { key: "live", name: "LIVE Studio", status: "online" },
      { key: "radar", name: "Radar Scanner", status: "online" },
      { key: "bot", name: "Chat Bot", status: "online" },
      { key: "alerts", name: "Alert Engine", status: "online" },
      { key: "overlay", name: "Overlay Server", status: "online" },
      { key: "revenue", name: "Revenue Ledger", status: "online" },
    ],
  });
}
