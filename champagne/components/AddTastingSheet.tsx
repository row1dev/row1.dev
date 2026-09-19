"use client";

import { useEffect, useRef, useState } from "react";
import type { Identity } from "@/lib/use-identity";
import type { Tasting } from "@/lib/types";
import { resizeImage } from "@/lib/resize-image";
import { validateName, validateScore } from "@/lib/validation";

type Props = {
  identity: Identity;
  onClose: () => void;
  onCreated: (tasting: Tasting) => void;
};

const fieldClass =
  "mt-3 w-full border-b border-gold-400 bg-transparent pb-3 font-serif text-3xl tracking-wide text-ink-900 outline-hidden transition-colors placeholder:text-ink-300 focus:border-gold-600";

const labelClass = "block text-[11px] uppercase tracking-widest text-ink-400";

export function AddTastingSheet({ identity, onClose, onCreated }: Props) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);

  const [name, setName] = useState("");
  const [score, setScore] = useState("");

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Preview-URL's zijn object-URL's; ruim ze op zodra ze vervangen worden.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setErrors((prev) => ({ ...prev, photo: null }));
    setResizing(true);
    try {
      const resized = await resizeImage(file);
      setPhoto(resized);
      setPreview(URL.createObjectURL(resized));
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        photo: err instanceof Error ? err.message : "Kon de foto niet verwerken.",
      }));
    } finally {
      setResizing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting || resizing) return;

    const next: Record<string, string | null> = {
      photo: photo ? null : "Voeg een foto toe.",
      name: validateName(name),
      score: validateScore(score),
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("user_id", identity.userId);
      form.set("user_name", identity.displayName);
      form.set("name", name.trim());
      form.set("score", score.trim());
      form.set("photo", photo!);

      const response = await fetch("/api/tastings", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrors({ form: payload?.error || "Opslaan mislukte. Probeer het nog eens." });
        return;
      }

      onCreated(payload.tasting as Tasting);
    } catch {
      setErrors({ form: "Geen verbinding. Probeer het nog eens." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ivory">
      <form onSubmit={handleSubmit} className="mx-auto w-full max-w-md px-6 pt-8 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl tracking-wide text-ink-900">Nieuwe fles</h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 p-2 text-[11px] uppercase tracking-widest text-ink-400 transition-colors hover:text-ink-900"
          >
            Sluiten
          </button>
        </div>
        <div className="rule-gold mt-6" />

        {/* 1. Foto */}
        <div className="mt-10">
          <span className={labelClass}>1 — Foto</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={resizing}
            className="card-lift relative mt-3 flex aspect-4/5 w-full items-center justify-center overflow-hidden rounded-sm border border-gold-200 bg-paper transition-colors hover:border-gold-400"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-5 px-8 text-center">
                <Flute />
                <span className="font-serif text-xl tracking-wide text-ink-400">
                  Maak een foto
                </span>
              </span>
            )}

            {resizing ? (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ivory/85">
                <Spinner />
                <span className="text-[11px] uppercase tracking-widest text-ink-400">
                  Foto verkleinen
                </span>
              </span>
            ) : null}
          </button>
          {preview && !resizing ? (
            <p className="mt-3 text-[11px] uppercase tracking-widest text-ink-400">
              Tik op de foto om opnieuw te kiezen
            </p>
          ) : null}
          <FieldError message={errors.photo} />
        </div>

        {/* 2. Naam */}
        <div className="mt-12">
          <label htmlFor="tasting-name" className={labelClass}>
            2 — Naam, één woord
          </label>
          <input
            id="tasting-name"
            value={name}
            enterKeyHint="next"
            autoCapitalize="words"
            autoComplete="off"
            spellCheck={false}
            placeholder="Boizel"
            className={fieldClass}
            onChange={(event) => {
              setName(event.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
            }}
            onBlur={() => {
              if (name.trim()) setErrors((prev) => ({ ...prev, name: validateName(name) }));
            }}
          />
          <FieldError message={errors.name} />
        </div>

        {/* 3. Cijfer */}
        <div className="mt-12">
          <label htmlFor="tasting-score" className={labelClass}>
            3 — Cijfer, één decimaal
          </label>
          <input
            id="tasting-score"
            value={score}
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="8,4"
            className={`${fieldClass} lining-nums tabular-nums`}
            onChange={(event) => {
              // Een punt is bijna altijd een bedoelde komma.
              setScore(event.target.value.replace(".", ","));
              if (errors.score) setErrors((prev) => ({ ...prev, score: null }));
            }}
            onBlur={() => {
              if (score.trim()) setErrors((prev) => ({ ...prev, score: validateScore(score) }));
            }}
          />
          <FieldError message={errors.score} />
        </div>

        <FieldError message={errors.form} />

        <button
          type="submit"
          disabled={submitting || resizing}
          className="card-lift mt-14 flex w-full items-center justify-center gap-3 rounded-sm bg-ink-900 py-4 text-[11px] uppercase tracking-widest text-gold-100 transition-colors hover:bg-ink-700 disabled:opacity-40"
        >
          {submitting ? (
            <>
              <Spinner />
              Opslaan
            </>
          ) : (
            "Bewaren"
          )}
        </button>
      </form>
    </div>
  );
}

function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className="mt-4 rounded-sm border border-gold-200 bg-gold-100/60 px-4 py-3 text-sm leading-relaxed text-gold-700">
      {message}
    </p>
  );
}

function Flute() {
  return (
    <svg
      viewBox="0 0 24 42"
      className="h-20 w-auto text-gold-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* kelk, met een ronde bodem die in de steel overloopt */}
      <path d="M7.5 3.5h9l-1.05 14.7a3.45 3.45 0 0 1-6.9 0L7.5 3.5Z" />
      {/* steel en voet */}
      <path d="M12 21.6v15M8 37.2h8" />
      {/* belletjes */}
      <circle cx="10.9" cy="9.2" r="0.85" />
      <circle cx="13.5" cy="12.8" r="0.65" />
      <circle cx="10.6" cy="14.8" r="0.55" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-4 animate-spin rounded-full border border-current/25 border-t-current"
    />
  );
}
