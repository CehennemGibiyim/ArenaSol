import { NextResponse } from "next/server";
import { deleteResource, updateResource } from "@/server/resources";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource, id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Geçersiz kayıt kimliği" }, { status: 400 });
    }
    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Geçersiz JSON gövdesi" }, { status: 400 });
    }
    const result = await updateResource(resource, numericId, body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    return NextResponse.json({ data: result.row });
  } catch (error) {
    return NextResponse.json({ error: `Güncellenemedi: ${(error as Error).message}` }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ resource: string; id: string }> },
) {
  try {
    const { resource, id } = await params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Geçersiz kayıt kimliği" }, { status: 400 });
    }
    const result = await deleteResource(resource, numericId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    return NextResponse.json({ data: result.row });
  } catch (error) {
    return NextResponse.json({ error: `Silinemedi: ${(error as Error).message}` }, { status: 500 });
  }
}
