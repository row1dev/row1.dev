import { NextResponse } from "next/server";
import { PHOTO_BUCKET, isAdminKey, supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Leest de `role`-claim uit een Supabase JWT zonder de sleutel zelf prijs te geven. */
function keyRole(raw: string | undefined): string {
  const key = raw?.trim();
  if (!key) return "ontbreekt";
  if (key.startsWith("sb_secret_")) return "secret (nieuwe stijl)";
  if (key.startsWith("sb_publishable_")) return "publishable — FOUT, dit is de publieke sleutel";
  const parts = key.split(".");
  if (parts.length !== 3) return "onherkenbaar formaat";
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return String(claims.role ?? "geen role-claim");
  } catch {
    return "kon de sleutel niet lezen";
  }
}

/**
 * Diagnose van de omgeving, achter dezelfde sleutel als /admin:
 *   /api/health?key=<ADMIN_KEY>
 * Geeft nooit sleutels terug, alleen of ze kloppen.
 */
export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  if (!isAdminKey(key)) {
    return NextResponse.json({ error: "Geen toegang." }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const role = keyRole(serviceKey);

  const report: Record<string, unknown> = {
    supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "ontbreekt",
    service_key_rol: role,
    service_key_lengte: serviceKey?.length ?? 0,
    // De app knipt witruimte zelf weg; dit blijft staan zodat je het kunt opschonen.
    service_key_heeft_witruimte: serviceKey ? serviceKey !== serviceKey.trim() : false,
    service_key_lengte_zonder_witruimte: serviceKey?.trim().length ?? 0,
    admin_key_gezet: Boolean(process.env.ADMIN_KEY),
    bucket: PHOTO_BUCKET,
  };

  try {
    const db = supabaseAdmin();

    const { error: tableError, count } = await db
      .from("tastings")
      .select("id", { count: "exact", head: true });
    report.tabel = tableError ? `FOUT: ${tableError.message}` : `ok, ${count ?? "?"} rijen`;

    const { data: buckets, error: bucketError } = await db.storage.listBuckets();
    if (bucketError) {
      report.opslag = `FOUT: ${bucketError.message}`;
    } else {
      const found = buckets?.find((b) => b.id === PHOTO_BUCKET);
      report.opslag = !found
        ? `FOUT: bucket ${PHOTO_BUCKET} bestaat niet`
        : found.public
          ? "ok, bucket is publiek"
          : `FOUT: bucket ${PHOTO_BUCKET} staat niet op publiek`;
    }
  } catch (err) {
    report.tabel = `FOUT: ${err instanceof Error ? err.message : "onbekend"}`;
  }

  const healthy =
    String(report.tabel).startsWith("ok") && String(report.opslag).startsWith("ok");

  return NextResponse.json({ gezond: healthy, ...report }, { status: healthy ? 200 : 503 });
}
