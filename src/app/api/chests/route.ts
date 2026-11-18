import { NextResponse } from "next/server";
import { SORT_OPTIONS, chestStats, expireOldChests, listChests, listFlows, tabCounts, TABS, type ChestFilters } from "@/server/chest";
import { db } from "@/db";
import { listenerJobs, liveRooms } from "@/db/schema";
import { and, desc, eq, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

function parseFilters(params: URLSearchParams): ChestFilters {
  const num = (key: string) => {
    const value = params.get(key);
    if (value === null || value === "") return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const list = (key: string) => {
    const value = params.get(key);
    if (!value) return undefined;
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  };
  return {
    kind: params.get("kind") ?? "all",
    variants: list("variants"),
    levels: list("levels"),
    min_coins: num("min_coins"),
    max_coins: num("max_coins"),
    min_ratio: num("min_ratio"),
    max_ratio: num("max_ratio"),
    min_slots: num("min_slots"),
    max_slots: num("max_slots"),
    min_joined: num("min_joined"),
    min_time: num("min_time"),
    max_time: num("max_time"),
    min_viewers: num("min_viewers"),
    max_viewers: num("max_viewers"),
    viewers_lt_slots: params.get("viewers_lt_slots") === "1",
    hide_late: num("hide_late"),
    sort: params.get("sort") ?? "opens_at",
    desc: params.get("desc") !== "0",
    status: params.get("status") ?? "all",
    q: params.get("q") ?? "",
  };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const filters = parseFilters(params);
  await expireOldChests().catch(() => 0);

  // Bağımsız çağrılar — biri patlarsa diğeri etkilenmez
  const [chestResult, flowResult, statsResult, roomsResult] = await Promise.allSettled([
    listChests(filters, 300),
    listFlows(100),
    chestStats(),
    db.select({ id: liveRooms.id, username: liveRooms.username, roomId: liveRooms.roomId,
      nickname: liveRooms.nickname, title: liveRooms.title, viewers: liveRooms.viewers,
      monitoring: liveRooms.monitoring, source: liveRooms.source, region: liveRooms.region, lastSeenAt: liveRooms.lastSeenAt,
      jobStatus: listenerJobs.status, nextAttemptAt: listenerJobs.nextAttemptAt })
      .from(liveRooms).leftJoin(listenerJobs, eq(liveRooms.roomId, listenerJobs.roomId))
      .where(and(eq(liveRooms.liveNow, true), gte(liveRooms.lastSeenAt, new Date(Date.now() - 30 * 60_000)))).orderBy(desc(liveRooms.lastSeenAt)).limit(150),
  ]);

  const chestRows = chestResult.status === "fulfilled" ? chestResult.value : [];
  const flowRows = flowResult.status === "fulfilled" ? flowResult.value : [];
  const stats =
    statsResult.status === "fulfilled"
      ? statsResult.value
      : { chests: 0, upcoming: 0, claimed: 0, coins: 0, flowRooms: 0, flowDiamonds: 0 };

  const allRows = [...chestRows, ...flowRows];
  let counts: Record<string, number> = {};
  try {
    counts = tabCounts(allRows as never);
  } catch {
    counts = {};
  }

  const errors: string[] = [];
  if (chestResult.status === "rejected") errors.push(`sandıklar: ${chestResult.reason?.message ?? "bilinmeyen"}`);
  if (flowResult.status === "rejected") errors.push(`akış: ${flowResult.reason?.message ?? "bilinmeyen"}`);
  if (statsResult.status === "rejected") errors.push(`istatistik: ${statsResult.reason?.message ?? "bilinmeyen"}`);

  return NextResponse.json(
    {
      count: chestRows.length,
      total: allRows.length,
      chests: chestRows,
      flows: flowRows,
      live_rooms: roomsResult.status === "fulfilled" ? roomsResult.value : [],
      tabs: TABS,
      sort_options: SORT_OPTIONS,
      tab_counts: counts,
      stats,
      errors,
      generated_at: Date.now(),
      server_time: Date.now(),
    },
    { headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
