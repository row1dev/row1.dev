/**
 * Adaptieve moeilijkheid op basis van een rolling window van de laatste sommen.
 * Puur: elke functie geeft een nieuwe state terug en muteert niets.
 */

import { DIFFICULTY } from '../config.ts';
import { clamp, median } from './math.ts';
import type { Level } from './questions.ts';

export interface Attempt {
  readonly correct: boolean;
  readonly reactionSeconds: number;
}

export interface DifficultyState {
  readonly level: Level;
  /** De laatste DIFFICULTY.windowSize pogingen, oudste eerst. */
  readonly window: readonly Attempt[];
}

function toLevel(value: number): Level {
  return clamp(Math.round(value), DIFFICULTY.minLevel, DIFFICULTY.maxLevel) as Level;
}

export function createDifficulty(level: Level = DIFFICULTY.startLevel as Level): DifficultyState {
  return { level: toLevel(level), window: [] };
}

export function accuracyOf(window: readonly Attempt[]): number {
  if (window.length === 0) return 1;
  const correct = window.filter((a) => a.correct).length;
  return correct / window.length;
}

export function medianReactionOf(window: readonly Attempt[]): number {
  return median(window.map((a) => a.reactionSeconds));
}

/**
 * Bepaalt de niveaustap voor een vol window: -1, 0 of +1.
 * Nooit meer dan één stap, dat is de harde regel.
 */
export function evaluateStep(window: readonly Attempt[]): -1 | 0 | 1 {
  if (window.length < DIFFICULTY.windowSize) return 0;
  const accuracy = accuracyOf(window);
  if (accuracy < DIFFICULTY.accuracyDown) return -1;
  if (accuracy > DIFFICULTY.accuracyUp && medianReactionOf(window) < DIFFICULTY.medianTimeUp) return 1;
  return 0;
}

/**
 * Verwerkt één beantwoorde som.
 * Zodra het window vol is wordt er geëvalueerd; verschuift het niveau, dan begint
 * het window opnieuw, zodat hetzelfde bewijs niet twee keer een stap oplevert.
 */
export function recordAttempt(state: DifficultyState, attempt: Attempt): DifficultyState {
  const window = [...state.window, attempt].slice(-DIFFICULTY.windowSize);
  const step = evaluateStep(window);
  if (step === 0) return { level: state.level, window };

  const level = toLevel(state.level + step);
  if (level === state.level) return { level, window };
  return { level, window: [] };
}
