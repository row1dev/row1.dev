/**
 * Sommen genereren: puur, seeded en zonder enige DOM-afhankelijkheid.
 */

import { createRng, type Rng } from './rng.ts';
import { DIFFICULTY } from '../config.ts';

export const CIRCUITS = ['tables', 'addition', 'division', 'grandprix'] as const;
export type Circuit = (typeof CIRCUITS)[number];

export const CIRCUIT_LABELS: Readonly<Record<Circuit, string>> = {
  tables: 'Tafelbaan',
  addition: 'Optelcircuit',
  division: 'Deelparcours',
  grandprix: 'Grand Prix',
};

export type QuestionKind = 'multiply' | 'add' | 'subtract' | 'divide';

export interface Question {
  readonly kind: QuestionKind;
  readonly left: number;
  readonly right: number;
  readonly answer: number;
  /** Weergavetekst, bijvoorbeeld "7 × 8". */
  readonly text: string;
}

export type Level = 1 | 2 | 3 | 4 | 5;

export function isLevel(value: number): value is Level {
  return Number.isInteger(value) && value >= DIFFICULTY.minLevel && value <= DIFFICULTY.maxLevel;
}

interface Range {
  readonly min: number;
  readonly max: number;
}

/** Bereiken per niveau, geïndexeerd op niveau - 1. */
const TABLE_RANGES: readonly Range[] = [
  { min: 1, max: 5 },
  { min: 1, max: 7 },
  { min: 2, max: 9 },
  { min: 2, max: 10 },
  { min: 3, max: 10 },
];

/** Maximale uitkomst van een optelling of aftrekking per niveau. */
const SUM_MAX: readonly number[] = [10, 20, 50, 80, 100];
/** Kleinste linkerterm per niveau, zodat hogere niveaus geen "3 + 1" meer geven. */
const SUM_MIN_TERM: readonly number[] = [1, 1, 2, 5, 10];

/** Deler- en quotiëntbereik per niveau; het deeltal blijft daarmee onder de 100. */
const DIVISOR_RANGES: readonly Range[] = [
  { min: 2, max: 3 },
  { min: 2, max: 5 },
  { min: 2, max: 8 },
  { min: 3, max: 9 },
  { min: 4, max: 10 },
];
const QUOTIENT_RANGES: readonly Range[] = [
  { min: 1, max: 5 },
  { min: 2, max: 6 },
  { min: 2, max: 9 },
  { min: 2, max: 10 },
  { min: 3, max: 10 },
];

/** Maximaal deeltal in het Deelparcours. */
export const MAX_DIVIDEND = 100;

function rangeFor(ranges: readonly Range[], level: Level): Range {
  return ranges[level - 1]!;
}

function multiplyQuestion(rng: Rng, level: Level): Question {
  const range = rangeFor(TABLE_RANGES, level);
  const left = rng.int(range.min, range.max);
  const right = rng.int(1, 10);
  return { kind: 'multiply', left, right, answer: left * right, text: `${left} × ${right}` };
}

function addQuestion(rng: Rng, level: Level): Question {
  const max = SUM_MAX[level - 1]!;
  const minTerm = SUM_MIN_TERM[level - 1]!;
  // Zorg dat er altijd ruimte is voor een tweede term van minstens minTerm.
  const left = rng.int(minTerm, Math.max(minTerm, max - minTerm));
  const right = rng.int(minTerm, Math.max(minTerm, max - left));
  return { kind: 'add', left, right, answer: left + right, text: `${left} + ${right}` };
}

function subtractQuestion(rng: Rng, level: Level): Question {
  const max = SUM_MAX[level - 1]!;
  const minTerm = SUM_MIN_TERM[level - 1]!;
  // Trek af van een geheel, zodat de uitkomst nooit negatief wordt.
  const left = rng.int(Math.min(minTerm * 2, max), max);
  const right = rng.int(minTerm, Math.max(minTerm, left - minTerm));
  return { kind: 'subtract', left, right, answer: left - right, text: `${left} − ${right}` };
}

function divideQuestion(rng: Rng, level: Level): Question {
  const divisorRange = rangeFor(DIVISOR_RANGES, level);
  const quotientRange = rangeFor(QUOTIENT_RANGES, level);
  const divisor = rng.int(divisorRange.min, divisorRange.max);
  // Begrens het quotiënt zodat het deeltal onder MAX_DIVIDEND blijft.
  const maxQuotient = Math.max(quotientRange.min, Math.min(quotientRange.max, Math.floor(MAX_DIVIDEND / divisor)));
  const quotient = rng.int(quotientRange.min, maxQuotient);
  const dividend = divisor * quotient;
  return { kind: 'divide', left: dividend, right: divisor, answer: quotient, text: `${dividend} : ${divisor}` };
}

const GRAND_PRIX_KINDS: readonly QuestionKind[] = ['multiply', 'add', 'subtract', 'divide'];

function questionOfKind(rng: Rng, kind: QuestionKind, level: Level): Question {
  switch (kind) {
    case 'multiply':
      return multiplyQuestion(rng, level);
    case 'add':
      return addQuestion(rng, level);
    case 'subtract':
      return subtractQuestion(rng, level);
    case 'divide':
      return divideQuestion(rng, level);
  }
}

function kindFor(rng: Rng, circuit: Circuit): QuestionKind {
  switch (circuit) {
    case 'tables':
      return 'multiply';
    case 'addition':
      return rng.next() < 0.5 ? 'add' : 'subtract';
    case 'division':
      return 'divide';
    case 'grandprix':
      return rng.pick(GRAND_PRIX_KINDS);
  }
}

export interface QuestionSource {
  /** Volgende som op het gegeven niveau. Nooit gelijk aan de vorige som. */
  next(level: Level): Question;
}

/** Hoeveel keer we opnieuw trekken om een herhaling te vermijden voor we het opgeven. */
const MAX_REDRAWS = 20;

/**
 * Maakt een deterministische stroom sommen voor één circuit.
 * Dezelfde seed plus dezelfde reeks niveaus geeft altijd dezelfde sommen.
 */
export function createQuestionSource(seed: number | string, circuit: Circuit): QuestionSource {
  const rng = createRng(seed);
  let previous: Question | null = null;

  const next = (level: Level): Question => {
    let candidate = questionOfKind(rng, kindFor(rng, circuit), level);
    // Op lage niveaus is de ruimte klein; na MAX_REDRAWS pogingen geven we het op
    // in plaats van door te blijven trekken. De kans daarop is verwaarloosbaar.
    for (let i = 0; i < MAX_REDRAWS && previous !== null && candidate.text === previous.text; i += 1) {
      candidate = questionOfKind(rng, kindFor(rng, circuit), level);
    }
    previous = candidate;
    return candidate;
  };

  return { next };
}

/** Aantal cijfers van een antwoord, voor autoSubmit in de numpad. */
export function answerDigits(answer: number): number {
  return String(Math.abs(answer)).length;
}
