import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from '../src/engine/rng.ts';

describe('rng', () => {
  it('geeft dezelfde reeks bij dezelfde seed', () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('geeft een andere reeks bij een andere seed', () => {
    const a = Array.from({ length: 20 }, createRng(1).next);
    const b = Array.from({ length: 20 }, createRng(2).next);
    expect(a).not.toEqual(b);
  });

  it('blijft binnen [0, 1)', () => {
    const rng = createRng('blue-dog');
    for (let i = 0; i < 5000; i += 1) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('respecteert de grenzen van int, inclusief min en max', () => {
    const rng = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i += 1) {
      const v = rng.int(3, 7);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
      seen.add(v);
    }
    expect(seen).toEqual(new Set([3, 4, 5, 6, 7]));
  });

  it('accepteert een string als seed en is daarin deterministisch', () => {
    expect(hashSeed('tafelbaan')).toBe(hashSeed('tafelbaan'));
    expect(hashSeed('tafelbaan')).not.toBe(hashSeed('optelcircuit'));
    expect(createRng('tafelbaan').next()).toBe(createRng('tafelbaan').next());
  });

  it('weigert een leeg bereik en een lege pick', () => {
    const rng = createRng(1);
    expect(() => rng.int(5, 4)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});
