import { formatScore } from "@/lib/validation";
import type { Tasting } from "@/lib/types";

const dateFormat = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function TastingCard({ tasting }: { tasting: Tasting }) {
  return (
    <article className="overflow-hidden border border-gold-500/20 bg-night-800/60">
      <div className="relative aspect-4/5 w-full bg-night-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={tasting.photo_url}
          alt={tasting.name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-night-900/85 to-transparent" />
      </div>

      <div className="flex items-baseline justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-2xl leading-tight tracking-wide text-cream">
            {tasting.name}
          </h2>
          <p className="mt-1 text-[11px] uppercase tracking-widest text-mist/60">
            {dateFormat.format(new Date(tasting.created_at))}
          </p>
        </div>
        <p className="shrink-0 font-serif text-3xl font-light tracking-wide text-gold-400 lining-nums tabular-nums">
          {formatScore(tasting.score)}
        </p>
      </div>
    </article>
  );
}

export function TastingCardSkeleton() {
  return (
    <div className="border border-gold-500/10 bg-night-800/40">
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
