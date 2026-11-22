import { NextResponse } from "next/server";
import { runScan, scannerDashboard, startScannerLoop, stopScannerLoop } from "@/server/scanner";
import { REGIONS_ALL, regionLabel, summarizeRegions } from "@/server/discovery-global";
import { getConnectorStatus } from "@/server/live";

export const dynamic = "force-dynamic";

/** Tüm dünya bölgeleri — UI'da ülke listesini göstermek için */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("regions") === "list") {
    return NextResponse.json({
      regions: REGIONS_ALL.map((code) => ({ code, label: regionLabel(code) })),
      total: REGIONS_ALL.length,
      coverage: process.env.EULER_API_KEY ? "all" : "public-sample-only",
      eulerAvailable: Boolean(process.env.EULER_API_KEY),
    });
  }
  try {
    const dashboard = await scannerDashboard();
    return NextResponse.json(dashboard);
  } catch (error) {
    return NextResponse.json(
      { error: `Tarama durumu okunamadı: ${(error as Error).message}`, status: null, scans: [], tasks: [], overview: null },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: {
    action?: string;
    regions?: string[];
    only?: string[];
    listenSeconds?: number;
    maxRooms?: number;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  // Eylemler — her biri hata yutarak yanıt verir, panel asla beyaz sayfa görmez
  if (body.action === "start") {
    try {
      startScannerLoop();
      return NextResponse.json({ ok: true, ...(await scannerDashboard()) });
    } catch (error) {
      return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
    }
  }
  if (body.action === "stop") {
    try {
      // Tarama kalıcıdır: "durdur" isteği döngüyü kapatmaz, yeniden kurar.
      stopScannerLoop();
      return NextResponse.json({
        ok: true,
        note: "Tarama durdurulamaz; döngü yeniden kuruldu. Jeton/süre sayacı kesintisiz devam eder.",
        ...(await scannerDashboard()),
      });
    } catch (error) {
      return NextResponse.json({ ok: false, error: (error as Error).message }, { status: 500 });
    }
  }

  // TARAMA — varsayılan olarak TÜM ÜLKELER
  const regions = Array.isArray(body.regions) ? body.regions.filter(Boolean) : [];
  const only = Array.isArray(body.only) ? body.only.filter(Boolean) : [];

  try {
    const result = await runScan({
      regions,
      only,
      listenSecondsOverride: body.listenSeconds,
      maxRoomsOverride: body.maxRooms,
    });
    const connector = await getConnectorStatus();
    return NextResponse.json({
      ok: true,
      result,
      connector,
      regionsScanned: result.scope.regions.length,
      regionsCovered: !result.scope.eulerAvailable ? "SINIRLI AÇIK ÖRNEK LİSTE (dünya taraması değil)" : result.scope.regionCoverage === "all" ? "TÜM DÜNYA" : regions.join(", "),
      regionSummary: result.regionSummary,
      errors: result.errors.slice(0, 12),
      ...(await scannerDashboard()),
    });
  } catch (error) {
    // Tarama bile tamamen patlasa panel düzgün hata döner
    return NextResponse.json(
      {
        ok: false,
        error: `Tarama başarısız: ${(error as Error).message}`,
        result: null,
        regionsScanned: 0,
        errors: [(error as Error).message],
        ...(await scannerDashboard().catch(() => ({}))),
      },
      { status: 500 },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
