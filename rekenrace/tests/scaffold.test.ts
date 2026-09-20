import { describe, expect, it } from 'vitest';
import { RACE, SPEED_FACTOR, TICK_HZ } from '../src/config.ts';

describe('config', () => {
  it('draait de simulatie op 60 Hz', () => {
    expect(TICK_HZ).toBe(60);
  });

  it('houdt vBase onder vMax', () => {
    expect(RACE.vBase).toBeLessThan(RACE.vMax);
  });

  it('heeft een snelheidsfactor-bereik rond 1', () => {
    expect(SPEED_FACTOR.min).toBeLessThan(1);
    expect(SPEED_FACTOR.max).toBeGreaterThan(1);
  });
});
