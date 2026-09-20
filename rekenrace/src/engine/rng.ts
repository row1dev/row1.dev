/**
 * Seeded pseudo-random generator (mulberry32).
 * Puur en deterministisch: dezelfde seed geeft altijd dezelfde reeks.
 */

export interface Rng {
  /** Volgend getal in [0, 1). */
  next(): number;
  /** Geheel getal in [min, max], grenzen meegerekend. */
  int(min: number, max: number): number;
  /** Willekeurig element uit een niet-lege lijst. */
  pick<T>(items: readonly T[]): T;
}

/** Zet een willekeurige string om in een 32-bits seed, zodat ook "tafelbaan-3" werkt. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed: number | string): Rng {
  let state = (typeof seed === 'string' ? hashSeed(seed) : seed >>> 0) || 1;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => {
    if (max < min) throw new RangeError(`ongeldig bereik: ${min}..${max}`);
    return min + Math.floor(next() * (max - min + 1));
  };

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new RangeError('pick op een lege lijst');
    // Non-null assertion is hier veilig: de index ligt binnen de lengte.
    return items[int(0, items.length - 1)]!;
  };

  return { next, int, pick };
}
