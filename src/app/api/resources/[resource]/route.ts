import { NextResponse } from "next/server";
import { createResource, getResource, listResource } from "@/server/resources";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    const cfg = getResource(resource);
    if (!cfg) return NextResponse.json({ error: "Bilinmeyen kaynak" }, { status: 404 });
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    const { rows, error } = await listResource(resource, query);
    return NextResponse.json(
      { data: rows, resource, label: cfg.label, ...(error ? { error } : {}) },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ data: [], error: (error as Error).message }, { status: 200 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  try {
    const { resource } = await params;
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
    }
    const result = await createResource(resource, body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    return NextResponse.json({ data: result.row }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: `Kayıt oluşturulamadı: ${(error as Error).message}` }, { status: 500 });
  }
}
