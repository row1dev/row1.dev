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

/** De kleinst mogelijke geldige JPEG, voor de schrijftest. */
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a" +
    "HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA" +
    "AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

type Step = { stap: string; ok: boolean; detail?: string };

async function writeTest(db: ReturnType<typeof supabaseAdmin>): Promise<Step[]> {
  const steps: Step[] = [];
  const path = `health/${crypto.randomUUID()}.jpg`;
  let rowId: string | null = null;
  let uploaded = false;

  const up = await db.storage
    .from(PHOTO_BUCKET)
    .upload(path, TINY_JPEG, { contentType: "image/jpeg", cacheControl: "60", upsert: false });
  uploaded = !up.error;
  steps.push({ stap: "foto uploaden", ok: uploaded, detail: up.error?.message });

  const publicUrl = db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
  if (uploaded) {
    try {
      const res = await fetch(publicUrl, { cache: "no-store" });
      steps.push({
        stap: "foto publiek opvragen",
        ok: res.ok,
        detail: res.ok ? `${res.status} ${res.headers.get("content-type")}` : `${res.status}`,
      });
    } catch (err) {
      steps.push({
        stap: "foto publiek opvragen",
        ok: false,
        detail: err instanceof Error ? err.message : "onbekend",
      });
    }
  }

  const row = await db
    .from("tastings")
    .insert({
      user_id: "00000000-0000-4000-8000-000000000000",
      user_name: "Zelftest",
      name: "Zelftest",
      word: "zelftest",
      score: 1.0,
      photo_url: publicUrl,
    })
    .select("id")
    .single();
  rowId = row.data?.id ?? null;
  steps.push({ stap: "rij invoegen", ok: !row.error, detail: row.error?.message });

  if (rowId) {
    const del = await db.from("tastings").delete().eq("id", rowId);
    steps.push({ stap: "testrij opruimen", ok: !del.error, detail: del.error?.message });
  }
  if (uploaded) {
    const del = await db.storage.from(PHOTO_BUCKET).remove([path]);
    steps.push({ stap: "testfoto opruimen", ok: !del.error, detail: del.error?.message });
  }

  return steps;
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

    // Geen head-request: die geeft een lege foutmelding terug, en juist de
    // tekst is hier het hele punt.
    const { error: tableError, count } = await db
      .from("tastings")
      .select("id", { count: "exact" })
      .limit(1);
    report.tabel = tableError
      ? `FOUT: ${tableError.message || tableError.code || "geen melding"}`
      : `ok, ${count ?? "?"} rijen`;

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
    // ?write=1 loopt exact de route van "fles bewaren" af: foto uploaden,
    // publieke URL ophalen, rij invoegen — en ruimt daarna alles weer op.
    if (new URL(request.url).searchParams.get("write") === "1") {
      report.schrijftest = await writeTest(db);
    }
  } catch (err) {
    report.tabel = `FOUT: ${err instanceof Error ? err.message : "onbekend"}`;
  }

  const healthy =
    String(report.tabel).startsWith("ok") && String(report.opslag).startsWith("ok");

  return NextResponse.json({ gezond: healthy, ...report }, { status: healthy ? 200 : 503 });
}
