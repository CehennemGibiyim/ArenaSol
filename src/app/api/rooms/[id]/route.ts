import { NextResponse } from "next/server";
import { deleteRoom, setRoomMonitoring, setRoomPinned } from "@/server/rooms";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Geçersiz oda kimliği" }, { status: 400 });
    }
    let body: { pinned?: boolean; monitoring?: boolean } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
    }
    if (typeof body.pinned === "boolean") {
      const row = await setRoomPinned(numericId, body.pinned);
      if (!row) return NextResponse.json({ error: "Oda bulunamadı" }, { status: 404 });
      return NextResponse.json({ data: row });
    }
    if (typeof body.monitoring === "boolean") {
      const row = await setRoomMonitoring(numericId, body.monitoring);
      if (!row) return NextResponse.json({ error: "Oda bulunamadı" }, { status: 404 });
      return NextResponse.json({ data: row });
    }
    return NextResponse.json({ error: "pinned veya monitoring gerekli" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: `Oda güncellenemedi: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Geçersiz oda kimliği" }, { status: 400 });
    }
    const row = await deleteRoom(numericId);
    if (!row) return NextResponse.json({ error: "Oda bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: `Oda silinemedi: ${(error as Error).message}` }, { status: 500 });
  }
}
