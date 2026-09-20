import { describe, expect, it } from 'vitest';
import { KART, RACE, TICK_HZ, TRACK } from '../src/config.ts';

describe('config', () => {
  it('draait de simulatie op 60 Hz', () => {
    expect(TICK_HZ).toBe(60);
  });

  it('laat een kart harder gaan dan een speler te voet', () => {
    expect(KART.footSpeed).toBeLessThan(KART.maxSpeed);
    expect(KART.maxSpeed).toBeLessThan(KART.turboSpeed);
  });

  it('haalt met een volle tank de finish niet', () => {
    // Zo staat vast dat je onderweg moet tanken, hoe goed je ook rijdt.
    const reach = KART.maxFuel * KART.unitsPerFuel;
    expect(reach).toBeGreaterThan(TRACK.garageSpacing * 2);
    expect(reach).toBeLessThan(TRACK.length);
  });

  it('komt met de starttank niet verder dan de eerste paar garages', () => {
    const reach = KART.startFuel * KART.unitsPerFuel;
    expect(reach).toBeGreaterThan(TRACK.garageSpacing);
    expect(reach).toBeLessThan(TRACK.length / 2);
  });

  it('houdt een vangnet op de duur van een race', () => {
    expect(RACE.maxTicks).toBeGreaterThan(TICK_HZ * 300);
  });
});
