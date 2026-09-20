import { describe, expect, it } from 'vitest';
import {
  CIRCUITS,
  MAX_DIVIDEND,
  answerDigits,
  createQuestionSource,
  type Circuit,
  type Level,
  type Question,
} from '../src/engine/questions.ts';

const LEVELS: readonly Level[] = [1, 2, 3, 4, 5];

function sample(circuit: Circuit, level: Level, count = 500, seed = `${circuit}-${level}`): Question[] {
  const source = createQuestionSource(seed, circuit);
  return Array.from({ length: count }, () => source.next(level));
}

describe('questions', () => {
  it('geeft bij dezelfde seed exact dezelfde reeks', () => {
    for (const circuit of CIRCUITS) {
      const a = createQuestionSource('zelfde-seed', circuit);
      const b = createQuestionSource('zelfde-seed', circuit);
      const seqA = Array.from({ length: 100 }, () => a.next(3));
      const seqB = Array.from({ length: 100 }, () => b.next(3));
      expect(seqA).toEqual(seqB);
    }
  });

  it('geeft bij een andere seed een andere reeks', () => {
    const a = Array.from({ length: 30 }, () => createQuestionSource('seed-a', 'grandprix').next(3));
    const b = Array.from({ length: 30 }, () => createQuestionSource('seed-b', 'grandprix').next(3));
    expect(a.map((q) => q.text)).not.toEqual(b.map((q) => q.text));
  });

  it('zet nooit twee identieke sommen direct achter elkaar', () => {
    for (const circuit of CIRCUITS) {
      for (const level of LEVELS) {
        const questions = sample(circuit, level, 2000);
        for (let i = 1; i < questions.length; i += 1) {
          expect(questions[i]!.text).not.toBe(questions[i - 1]!.text);
        }
      }
    }
  });

  it('heeft altijd een antwoord dat klopt met de opgave', () => {
    for (const circuit of CIRCUITS) {
      for (const level of LEVELS) {
        for (const q of sample(circuit, level, 300)) {
          switch (q.kind) {
            case 'multiply':
              expect(q.answer).toBe(q.left * q.right);
              break;
            case 'add':
              expect(q.answer).toBe(q.left + q.right);
              break;
            case 'subtract':
              expect(q.answer).toBe(q.left - q.right);
              break;
            case 'divide':
              expect(q.answer).toBe(q.left / q.right);
              break;
          }
        }
      }
    }
  });

  it('deelt nooit met rest en houdt het deeltal onder de honderd', () => {
    for (const circuit of ['division', 'grandprix'] as const) {
      for (const level of LEVELS) {
        for (const q of sample(circuit, level, 1500)) {
          if (q.kind !== 'divide') continue;
          expect(q.left % q.right).toBe(0);
          expect(q.left).toBeLessThanOrEqual(MAX_DIVIDEND);
          expect(q.right).toBeGreaterThan(0);
          expect(Number.isInteger(q.answer)).toBe(true);
        }
      }
    }
  });

  it('blijft op de Tafelbaan binnen de tafels van 1 tot en met 10', () => {
    for (const level of LEVELS) {
      for (const q of sample('tables', level, 1000)) {
        expect(q.kind).toBe('multiply');
        expect(q.left).toBeGreaterThanOrEqual(1);
        expect(q.left).toBeLessThanOrEqual(10);
        expect(q.right).toBeGreaterThanOrEqual(1);
        expect(q.right).toBeLessThanOrEqual(10);
      }
    }
  });

  it('houdt het Optelcircuit optellend en aftrekkend tot honderd, zonder negatieve uitkomst', () => {
    for (const level of LEVELS) {
      for (const q of sample('addition', level, 1000)) {
        expect(['add', 'subtract']).toContain(q.kind);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.left).toBeLessThanOrEqual(100);
        expect(q.right).toBeLessThanOrEqual(100);
        if (q.kind === 'add') expect(q.answer).toBeLessThanOrEqual(100);
      }
    }
  });

  it('gebruikt op de Grand Prix alle soorten sommen door elkaar', () => {
    const kinds = new Set(sample('grandprix', 3, 500).map((q) => q.kind));
    expect(kinds).toEqual(new Set(['multiply', 'add', 'subtract', 'divide']));
  });

  it('laat de getalbereiken per niveau oplopen', () => {
    const maxAnswer = (level: Level): number =>
      Math.max(...sample('tables', level, 1500, `bereik-${level}`).map((q) => q.answer));
    for (const level of [2, 3, 4, 5] as const) {
      expect(maxAnswer(level)).toBeGreaterThanOrEqual(maxAnswer((level - 1) as Level));
    }
    // Niveau 1 blijft klein, niveau 5 gaat tot de hoogste tafels.
    expect(maxAnswer(1)).toBeLessThanOrEqual(50);
    expect(maxAnswer(5)).toBeGreaterThan(50);
  });

  it('laat ook het Optelcircuit oplopen met het niveau', () => {
    const maxAnswer = (level: Level): number =>
      Math.max(...sample('addition', level, 1500, `optel-${level}`).map((q) => q.answer));
    expect(maxAnswer(1)).toBeLessThanOrEqual(10);
    expect(maxAnswer(5)).toBeGreaterThan(50);
  });

  it('telt de cijfers van een antwoord voor autoSubmit', () => {
    expect(answerDigits(0)).toBe(1);
    expect(answerDigits(7)).toBe(1);
    expect(answerDigits(42)).toBe(2);
    expect(answerDigits(100)).toBe(3);
  });
});
