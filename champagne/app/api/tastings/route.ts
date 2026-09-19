import { NextResponse } from "next/server";
import { PHOTO_BUCKET, supabaseAdmin } from "@/lib/supabase";
import { parseScore, validateName, validateScore, validateWord } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Databasefouten horen niet op het scherm van een bezoeker: die lekken
 * schemadetails en zeggen niemand iets. Detail gaat naar de serverlog,
 * de bezoeker krijgt iets leesbaars. De echte oorzaak staat in /api/health.
 */
function serverFail(context: string, detail: unknown) {
  console.error(`[tastings] ${context}:`, detail);
  return NextResponse.json(
    { error: "Er ging iets mis aan onze kant. Probeer het zo nog eens." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  const userId = new URL(request.url).searchParams.get("user_id");
  if (!userId || !UUID.test(userId)) return fail("Ongeldige gebruiker.");

  try {
    const { data, error } = await supabaseAdmin()
      .from("tastings")
      .select("id, user_id, user_name, name, word, score, photo_url, note, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) return serverFail("ophalen mislukte", error);
    return NextResponse.json({ tastings: data ?? [] });
  } catch (err) {
    return serverFail("ophalen wierp een fout", err);
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Kon het formulier niet lezen.");
  }

  const userId = String(form.get("user_id") ?? "");
  const userName = String(form.get("user_name") ?? "").trim();
  const name = String(form.get("name") ?? "");
  const word = String(form.get("word") ?? "");
  const score = String(form.get("score") ?? "");
  const photo = form.get("photo");

  if (!UUID.test(userId)) return fail("Ongeldige gebruiker.");
  if (!userName) return fail("Vul je naam in.");

  const nameError = validateName(name);
  if (nameError) return fail(nameError);

  const wordError = validateWord(word);
  if (wordError) return fail(wordError);

  const scoreError = validateScore(score);
  if (scoreError) return fail(scoreError);

  if (!(photo instanceof File) || photo.size === 0) return fail("Voeg een foto toe.");
  if (!photo.type.startsWith("image/")) return fail("Dat is geen afbeelding.");
  if (photo.size > MAX_PHOTO_BYTES) return fail("De foto is te groot.");

  try {
    const db = supabaseAdmin();
    const path = `${userId}/${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await db.storage
      .from(PHOTO_BUCKET)
      // De Blob zelf doorgeven, niet een ArrayBuffer: dat is het pad dat
      // supabase-js zelf documenteert en het zet de headers goed.
      .upload(path, photo, {
        contentType: photo.type || "image/jpeg",
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) return serverFail("foto uploaden mislukte", uploadError);

    const {
      data: { publicUrl },
    } = db.storage.from(PHOTO_BUCKET).getPublicUrl(path);

    const { data, error } = await db
      .from("tastings")
      .insert({
        user_id: userId,
        user_name: userName,
        name: name.trim(),
        word: word.trim(),
        score: parseScore(score),
        photo_url: publicUrl,
      })
      .select("id, user_id, user_name, name, word, score, photo_url, note, created_at")
      .single();

    if (error) {
      // Laat geen weesfoto achter als de rij niet wegschrijft.
      await db.storage.from(PHOTO_BUCKET).remove([path]);
      return serverFail("opslaan mislukte", error);
    }

    return NextResponse.json({ tasting: data }, { status: 201 });
  } catch (err) {
    return serverFail("opslaan wierp een fout", err);
  }
}
