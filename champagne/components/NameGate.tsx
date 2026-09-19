"use client";

import { useState } from "react";

export function NameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 pb-24">
      <p className="text-[11px] uppercase tracking-widest text-gold-500">Champagne</p>
      <h1 className="mt-6 text-5xl leading-[1.05] tracking-wide text-cream">
        Wat drinken
        <br />
        we vandaag?
      </h1>
      <div className="rule-gold my-10" />
      <p className="text-sm leading-relaxed text-mist">
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
          className="block text-[11px] uppercase tracking-widest text-mist/70"
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
          className="mt-3 w-full border-b border-gold-500/30 bg-transparent pb-3 font-serif text-3xl tracking-wide text-cream outline-hidden transition-colors placeholder:text-mist/30 focus:border-gold-400"
          placeholder="Rowan"
        />
        {error ? <p className="mt-3 text-sm text-gold-300">{error}</p> : null}

        <button
          type="submit"
          className="mt-10 w-full border border-gold-500/50 bg-gold-500/10 py-4 text-[11px] uppercase tracking-widest text-gold-300 transition-colors hover:bg-gold-500/20 active:bg-gold-500/25"
        >
          Beginnen
        </button>
      </form>
    </main>
  );
}
