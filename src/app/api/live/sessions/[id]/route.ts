import { NextResponse } from "next/server";
import { endSession, getSnapshot } from "@/server/live";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Geçersiz oturum kimliği" }, { status: 400 });
    }
    const snapshot = await getSnapshot(numericId);
    if (!snapshot) return NextResponse.json({ error: "Oturum bulunamadı" }, { status: 404 });
    return NextResponse.json(snapshot);
  } catch (error) {
    return NextResponse.json({ error: `Oturum alınamadı: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Geçersiz oturum kimliği" }, { status: 400 });
    }
    let body: { action?: string } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
    }
    if (body.action !== "end") return NextResponse.json({ error: "Bilinmeyen işlem" }, { status: 400 });
    await endSession(numericId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: `İşlem başarısız: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Geçersiz oturum kimliği" }, { status: 400 });
    }
    await endSession(numericId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: `Oturum kapatılamadı: ${(error as Error).message}` }, { status: 500 });
  }
}
