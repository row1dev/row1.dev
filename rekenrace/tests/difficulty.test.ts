import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../src/config.ts';
import {
  accuracyOf,
  createDifficulty,
  evaluateStep,
  medianReactionOf,
  recordAttempt,
  type Attempt,
  type DifficultyState,
} from '../src/engine/difficulty.ts';
import { median } from '../src/engine/math.ts';

const fast: Attempt = { correct: true, reactionSeconds: 1.5 };
const slow: Attempt = { correct: true, reactionSeconds: 4.5 };
const wrong: Attempt = { correct: false, reactionSeconds: 2 };

function feed(state: DifficultyState, attempt: Attempt, times: number): DifficultyState {
  let next = state;
  for (let i = 0; i < times; i += 1) next = recordAttempt(next, attempt);
  return next;
}

describe('difficulty', () => {
  it('start op het ingestelde niveau met een leeg window', () => {
    const state = createDifficulty();
    expect(state.level).toBe(DIFFICULTY.startLevel);
    expect(state.window).toEqual([]);
  });

  it('houdt het window op tien pogingen', () => {
    const state = feed(createDifficulty(), slow, 25);
    expect(state.window.length).toBeLessThanOrEqual(DIFFICULTY.windowSize);
  });

  it('evalueert pas als het window vol is', () => {
    let state = createDifficulty(1);
    for (let i = 0; i < DIFFICULTY.windowSize - 1; i += 1) {
      state = recordAttempt(state, fast);
      expect(state.level).toBe(1);
    }
    state = recordAttempt(state, fast);
    expect(state.level).toBe(2);
  });

  it('gaat omhoog bij hoge accuraatheid en snelle antwoorden', () => {
    const state = feed(createDifficulty(1), fast, DIFFICULTY.windowSize);
    expect(state.level).toBe(2);
  });

  it('gaat niet omhoog als de antwoorden goed maar traag zijn', () => {
    const state = feed(createDifficulty(1), slow, DIFFICULTY.windowSize * 2);
    expect(state.level).toBe(1);
  });

  it('gaat omlaag bij lage accuraatheid', () => {
    const state = feed(createDifficulty(4), wrong, DIFFICULTY.windowSize);
    expect(state.level).toBe(3);
  });

  it('verschuift nooit meer dan één stap per evaluatie', () => {
    let state = createDifficulty(1);
    const levels: number[] = [];
    for (let i = 0; i < 100; i += 1) {
      const before = state.level;
      state = recordAttempt(state, fast);
      expect(Math.abs(state.level - before)).toBeLessThanOrEqual(1);
      levels.push(state.level);
    }
    expect(Math.max(...levels)).toBe(DIFFICULTY.maxLevel);
  });

  it('blijft binnen niveau 1 tot en met 5', () => {
    const top = feed(createDifficulty(5), fast, 200);
    expect(top.level).toBe(DIFFICULTY.maxLevel);
    const bottom = feed(createDifficulty(1), wrong, 200);
    expect(bottom.level).toBe(DIFFICULTY.minLevel);
  });

  it('begint met een leeg window na een niveauwissel', () => {
    const state = feed(createDifficulty(1), fast, DIFFICULTY.windowSize);
    expect(state.level).toBe(2);
    expect(state.window).toEqual([]);
  });

  it('houdt het window vast als het niveau al op de grens zit', () => {
    const state = feed(createDifficulty(5), fast, DIFFICULTY.windowSize);
    expect(state.level).toBe(5);
    expect(state.window.length).toBe(DIFFICULTY.windowSize);
  });

  it('rekent accuraatheid en mediane reactietijd uit', () => {
    const window: Attempt[] = [fast, fast, wrong, slow];
    expect(accuracyOf(window)).toBeCloseTo(0.75);
    expect(medianReactionOf(window)).toBeCloseTo(median([1.5, 1.5, 2, 4.5]));
  });

  it('muteert de meegegeven state niet', () => {
    const state = createDifficulty(3);
    const next = recordAttempt(state, fast);
    expect(state.window).toEqual([]);
    expect(next.window).toEqual([fast]);
  });

  it('geeft geen stap voor een window dat niet vol is', () => {
    expect(evaluateStep([wrong, wrong, wrong])).toBe(0);
  });
});
