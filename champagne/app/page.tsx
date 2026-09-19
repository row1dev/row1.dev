"use client";

import { useCallback, useEffect, useState } from "react";
import { AddTastingSheet } from "@/components/AddTastingSheet";
import { NameGate } from "@/components/NameGate";
import { TastingCard, TastingCardSkeleton } from "@/components/TastingCard";
import type { Tasting } from "@/lib/types";
import { useIdentity } from "@/lib/use-identity";

export default function HomePage() {
  const { identity, ready, signIn } = useIdentity();
  const [tastings, setTastings] = useState<Tasting[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const userId = identity?.userId;

  const load = useCallback(async () => {
    if (!userId) return;
    setLoadError(null);
    try {
      const response = await fetch(`/api/tastings?user_id=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Kon je flessen niet laden.");
      setTastings(payload.tastings as Tasting[]);
    } catch (err) {
      setTastings([]);
      setLoadError(err instanceof Error ? err.message : "Kon je flessen niet laden.");
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <BootSkeleton />;
  if (!identity) return <NameGate onSubmit={signIn} />;

  const loading = tastings === null;

  return (
    <>
      <main className="mx-auto w-full max-w-md px-6 pt-12 pb-32">
        <header>
          <p className="text-[11px] uppercase tracking-widest text-gold-500">
            {identity.displayName}
          </p>
          <h1 className="mt-4 text-5xl leading-none tracking-wide text-cream">Champagne</h1>
          <div className="rule-gold mt-8" />
          <p className="mt-6 text-sm leading-relaxed text-mist">
            {loading
              ? " "
              : tastings.length === 0
                ? "Nog niets geproefd. Begin met de eerste fles."
                : `${tastings.length} ${tastings.length === 1 ? "fles" : "flessen"} geproefd.`}
          </p>
        </header>

        {loadError ? (
          <div className="mt-10 border border-gold-500/25 bg-night-800/60 px-5 py-6">
            <p className="text-sm leading-relaxed text-gold-300">{loadError}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 text-[11px] uppercase tracking-widest text-mist/70 underline-offset-4 hover:text-cream hover:underline"
            >
              Opnieuw proberen
            </button>
          </div>
        ) : null}

        <section className="mt-10 space-y-10">
          {loading ? (
            <>
              <TastingCardSkeleton />
              <TastingCardSkeleton />
            </>
          ) : (
            tastings.map((tasting) => <TastingCard key={tasting.id} tasting={tasting} />)
          )}
        </section>

        {!loading && tastings.length === 0 && !loadError ? (
          <p className="mt-16 text-center font-serif text-xl tracking-wide text-mist/40">
            Santé.
          </p>
        ) : null}
      </main>

      <button
        type="button"
        aria-label="Champagne toevoegen"
        onClick={() => setSheetOpen(true)}
        className="fixed right-6 bottom-8 z-40 flex size-16 items-center justify-center rounded-full border border-gold-500/60 bg-night-800 text-gold-300 shadow-[0_0_40px_rgba(198,161,91,0.25)] transition-transform active:scale-95"
        style={{ bottom: "calc(2rem + env(safe-area-inset-bottom))" }}
      >
        <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {sheetOpen ? (
        <AddTastingSheet
          identity={identity}
          onClose={() => setSheetOpen(false)}
          onCreated={(tasting) => {
            setTastings((prev) => [tasting, ...(prev ?? [])]);
            setSheetOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

function BootSkeleton() {
  return (
    <main className="mx-auto w-full max-w-md px-6 pt-12 pb-32">
      <div className="shimmer h-3 w-24 rounded-xs">
        <div className="shimmer-overlay" />
      </div>
      <div className="shimmer mt-5 h-11 w-56 rounded-xs">
        <div className="shimmer-overlay" />
      </div>
      <div className="rule-gold mt-8" />
      <div className="mt-10 space-y-10">
        <TastingCardSkeleton />
        <TastingCardSkeleton />
      </div>
    </main>
  );
}
