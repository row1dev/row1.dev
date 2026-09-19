import { NextResponse } from "next/server";
import { isAdminKey, supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminKey(request.headers.get("x-admin-key"))) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID.test(id)) {
    return NextResponse.json({ error: "Onbekende tasting." }, { status: 400 });
  }

  let payload: { note?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige body." }, { status: 400 });
  }

  const raw = typeof payload.note === "string" ? payload.note.trim() : "";
  const note = raw === "" ? null : raw;

  try {
    const { error } = await supabaseAdmin().from("tastings").update({ note }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, note });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Onbekende fout." },
      { status: 500 },
    );
  }
}
