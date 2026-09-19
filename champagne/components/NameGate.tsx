"use client";

import { useState } from "react";
import { Bubbles } from "@/components/Bubbles";

export function NameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Bubbles />
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pb-24">
        <p className="text-[11px] uppercase tracking-widest text-gold-700">Champagne</p>
        <h1 className="mt-6 text-5xl leading-[1.05] tracking-wide text-ink-900">
          Wat drinken
          <br />
          we vandaag?
        </h1>
        <div className="rule-gold my-10" />
        <p className="text-sm leading-relaxed text-ink-700">
          Vul je naam in, dan houden we bij wat je proeft. Geen wachtwoord, geen gedoe.
        </p>

        <form
          className="mt-10"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setError("Vul je naam in.");
              return;
            }
            setError(null);
            onSubmit(name);
          }}
        >
          <label
            htmlFor="display-name"
            className="block text-[11px] uppercase tracking-widest text-ink-400"
          >
            Je naam
          </label>
          <input
            id="display-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            autoComplete="given-name"
            autoFocus
            className="mt-3 w-full border-b border-gold-400 bg-transparent pb-3 font-serif text-3xl tracking-wide text-ink-900 outline-hidden transition-colors placeholder:text-ink-300 focus:border-gold-600"
            placeholder="Rowan"
          />
          {error ? <p className="mt-3 text-sm text-gold-700">{error}</p> : null}

          <button
            type="submit"
            className="card-lift mt-10 w-full rounded-sm bg-ink-900 py-4 text-[11px] uppercase tracking-widest text-gold-100 transition-colors hover:bg-ink-700"
          >
            Beginnen
          </button>
        </form>
      </main>
    </>
  );
}
