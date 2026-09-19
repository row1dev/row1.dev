import { AdminTable } from "@/components/AdminTable";
import type { Tasting } from "@/lib/types";
import { isAdminKey, supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;

  if (!isAdminKey(key)) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
        <p className="text-[11px] uppercase tracking-widest text-gold-700">Admin</p>
        <h1 className="mt-6 text-5xl leading-none tracking-wide text-ink-900">Gesloten</h1>
        <div className="rule-gold my-8" />
        <p className="text-sm leading-relaxed text-ink-700">
          Deze pagina heeft een sleutel nodig: <code>/admin?key=…</code>
        </p>
      </main>
    );
  }

  let tastings: Tasting[] = [];
  let error: string | null = null;

  try {
    const { data, error: queryError } = await supabaseAdmin()
      .from("tastings")
      .select("id, user_id, user_name, name, score, photo_url, note, created_at")
      .order("created_at", { ascending: false });
    if (queryError) throw new Error(queryError.message);
    tastings = (data ?? []) as Tasting[];
  } catch (err) {
    error = err instanceof Error ? err.message : "Onbekende fout.";
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-12 pb-24">
      <header>
        <p className="text-[11px] uppercase tracking-widest text-gold-700">Admin</p>
        <h1 className="mt-4 text-5xl leading-none tracking-wide text-ink-900">Alle flessen</h1>
        <div className="rule-gold mt-8" />
        {!error ? (
          <p className="mt-6 text-sm leading-relaxed text-ink-700">
            {tastings.length} {tastings.length === 1 ? "tasting" : "tastings"}. Verhaaltjes
            worden bewaard zodra je het veld verlaat.
          </p>
        ) : null}
      </header>

      {error ? (
        <p className="card-lift mt-10 rounded-sm border border-gold-200 bg-paper px-5 py-6 text-sm leading-relaxed text-gold-700">
          {error}
        </p>
      ) : (
        <AdminTable tastings={tastings} adminKey={key!} />
      )}
    </main>
  );
}
