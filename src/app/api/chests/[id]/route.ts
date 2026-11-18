import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chests } from "@/db/schema";
import { deriveChest } from "@/server/chest";
import { liveUrls } from "@/server/discovery";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Geçersiz sandık kimliği" }, { status: 400 });
    }
    const [row] = await db.select().from(chests).where(eq(chests.id, numericId)).limit(1);
    if (!row) return NextResponse.json({ error: "Sandık bulunamadı" }, { status: 404 });
    const settings = await getSettings();
  const base = settings.publicBaseUrl || "http://localhost:3000";
  const urls = liveUrls(row.username, row.roomId);
    return NextResponse.json({
      data: deriveChest(row),
      urls,
      qr: `/api/qr?text=${encodeURIComponent(`${base}/join/${row.id}`)}`,
      join: `${base}/join/${row.id}`,
    });
  } catch (error) {
    return NextResponse.json({ error: `Sandık detayı alınamadı: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Geçersiz sandık kimliği" }, { status: 400 });
  }
  let body: { status?: string; claimedBy?: string; joined?: number; notes?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
  }
  const patch: Partial<typeof chests.$inferInsert> = {};
  if (body.status) patch.status = body.status;
  if (body.claimedBy !== undefined) patch.claimedBy = body.claimedBy;
  if (body.joined !== undefined) patch.joined = Math.max(0, Number(body.joined) || 0);
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.status === "claimed") patch.claimedAt = new Date();
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Güncellenecek alan yok" }, { status: 400 });

  const [row] = await db
    .update(chests)
    .set(patch)
    .where(eq(chests.id, numericId))
    .returning();
  if (!row) return NextResponse.json({ error: "Sandık bulunamadı" }, { status: 404 });
  return NextResponse.json({ data: deriveChest(row) });
  } catch (error) {
    return NextResponse.json({ error: `Sandık güncellenemedi: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Geçersiz sandık kimliği" }, { status: 400 });
    }
    const [row] = await db.delete(chests).where(eq(chests.id, numericId)).returning();
    if (!row) return NextResponse.json({ error: "Sandık bulunamadı" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: `Sandık silinemedi: ${(error as Error).message}` }, { status: 500 });
  }
}
