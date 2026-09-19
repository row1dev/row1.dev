import { formatScore } from "@/lib/validation";
import type { Tasting } from "@/lib/types";

const dateFormat = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function TastingCard({ tasting }: { tasting: Tasting }) {
  return (
    <article className="card-lift overflow-hidden rounded-sm border border-gold-200 bg-paper">
      <div className="aspect-4/5 w-full bg-ivory-deep">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tasting.photo_url}
          alt={tasting.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>

      <div className="flex items-baseline justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl leading-tight tracking-wide text-ink-900">
            {tasting.name}
          </h2>
          <p className="mt-1 truncate font-serif text-xl italic tracking-wide text-gold-700">
            &bdquo;{tasting.word}&rdquo;
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-widest text-ink-400">
            {dateFormat.format(new Date(tasting.created_at))}
          </p>
        </div>
        <p className="shrink-0 font-serif text-3xl font-normal tracking-wide text-gold-600 lining-nums tabular-nums">
          {formatScore(tasting.score)}
        </p>
      </div>
    </article>
  );
}

export function TastingCardSkeleton() {
  return (
    <div className="card-lift overflow-hidden rounded-sm border border-gold-200 bg-paper">
      <div className="shimmer aspect-4/5 w-full">
        <div className="shimmer-overlay" />
      </div>
      <div className="flex items-center justify-between gap-4 px-5 py-5">
        <div className="shimmer h-5 w-32 rounded-xs">
          <div className="shimmer-overlay" />
        </div>
        <div className="shimmer h-7 w-12 rounded-xs">
          <div className="shimmer-overlay" />
        </div>
      </div>
    </div>
  );
}
