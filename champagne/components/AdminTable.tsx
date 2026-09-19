"use client";

import { useState } from "react";
import type { Tasting } from "@/lib/types";
import { formatScore } from "@/lib/validation";

const dateTimeFormat = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function AdminTable({
  tastings,
  adminKey,
}: {
  tastings: Tasting[];
  adminKey: string;
}) {
  if (tastings.length === 0) {
    return (
      <p className="mt-16 text-center font-serif text-2xl tracking-wide text-gold-500">
        Nog niets geproefd.
      </p>
    );
  }

  return (
    <div className="mt-10 divide-y divide-gold-200 border-y border-gold-200">
      <div className="hidden grid-cols-[5rem_1fr_4rem_9rem] gap-4 py-3 text-[11px] uppercase tracking-widest text-ink-400 sm:grid">
        <span>Foto</span>
        <span>Wie, wat &amp; het woord</span>
        <span className="text-right">Cijfer</span>
        <span className="text-right">Datum</span>
      </div>

      {tastings.map((tasting) => (
        <div key={tasting.id} className="py-6">
          <div className="grid grid-cols-[5rem_1fr] items-start gap-4 sm:grid-cols-[5rem_1fr_4rem_9rem]">
            <a href={tasting.photo_url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tasting.photo_url}
                alt={tasting.name}
                loading="lazy"
                className="card-lift aspect-4/5 w-20 rounded-sm border border-gold-200 bg-paper object-cover"
              />
            </a>

            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-gold-700">
                {tasting.user_name}
              </p>
              <h2 className="mt-1 truncate text-2xl leading-tight tracking-wide text-ink-900">
                {tasting.name}
              </h2>
              <p className="truncate font-serif text-lg italic tracking-wide text-gold-700">
                &bdquo;{tasting.word}&rdquo;
              </p>
              <p className="mt-2 font-serif text-2xl text-gold-600 lining-nums tabular-nums sm:hidden">
                {formatScore(tasting.score)}
                <span className="ml-3 font-sans text-[11px] uppercase tracking-widest text-ink-400">
                  {dateTimeFormat.format(new Date(tasting.created_at))}
                </span>
              </p>
            </div>

            <p className="hidden text-right font-serif text-3xl font-normal text-gold-600 lining-nums tabular-nums sm:block">
              {formatScore(tasting.score)}
            </p>
            <p className="hidden text-right text-[11px] uppercase tracking-widest text-ink-400 sm:block">
              {dateTimeFormat.format(new Date(tasting.created_at))}
            </p>
          </div>

          <NoteField id={tasting.id} initial={tasting.note ?? ""} adminKey={adminKey} />
        </div>
      ))}
    </div>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

function NoteField({
  id,
  initial,
  adminKey,
}: {
  id: string;
  initial: string;
  adminKey: string;
}) {
  const [note, setNote] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");

  async function save() {
    if (note === saved) return;
    setState("saving");
    try {
      const response = await fetch(`/api/admin/tastings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "x-admin-key": adminKey },
        body: JSON.stringify({ note }),
      });
      if (!response.ok) throw new Error("mislukt");
      setSaved(note);
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between gap-4">
        <label
          htmlFor={`note-${id}`}
          className="text-[11px] uppercase tracking-widest text-ink-400"
        >
          Verhaaltje
        </label>
        <span className="text-[11px] uppercase tracking-widest" aria-live="polite">
          {state === "saving" ? <span className="text-ink-400">Opslaan…</span> : null}
          {state === "saved" ? <span className="text-gold-700">Bewaard</span> : null}
          {state === "error" ? (
            <span className="text-gold-700">Mislukt — klik weg om opnieuw te proberen</span>
          ) : null}
        </span>
      </div>
      <textarea
        id={`note-${id}`}
        value={note}
        rows={3}
        onChange={(event) => {
          setNote(event.target.value);
          if (state !== "idle") setState("idle");
        }}
        onBlur={() => void save()}
        placeholder="Waar, met wie, en waarom dit cijfer…"
        className="mt-3 w-full resize-y rounded-sm border border-gold-200 bg-paper px-4 py-3 text-sm leading-relaxed text-ink-900 outline-hidden transition-colors placeholder:text-ink-300 focus:border-gold-500"
      />
    </div>
  );
}
