import { describe, expect, it } from 'vitest';
import { clamp, median } from '../src/engine/math.ts';

describe('math', () => {
  it('klemt binnen de grenzen', () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-1, 1, 10)).toBe(1);
    expect(clamp(99, 1, 10)).toBe(10);
  });

  it('rekent de mediaan van een oneven en een even lijst', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  it('laat de meegegeven lijst ongemoeid', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });
});
