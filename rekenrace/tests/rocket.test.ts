import { describe, expect, it } from 'vitest';
import { KART, ROCKET, TICK_HZ } from '../src/config.ts';
import { KART_RADIUS, createKart } from '../src/engine/kart.ts';
import { fireRocket, stepRockets, type Rocket, type RocketTarget } from '../src/engine/rocket.ts';

const armed = { fuel: KART.maxFuel, rockets: 2 };

describe('raketten, afvuren', () => {
  it('lukt niet zonder raketten op voorraad', () => {
    expect(fireRocket(1, 'speler', createKart({ fuel: KART.maxFuel }))).toBeNull();
  });

  it('vertrekt net voor de neus, in de rijrichting', () => {
    const kart = createKart({ ...armed, x: 10, y: 100 });
    const rocket = fireRocket(1, 'speler', kart);
    expect(rocket).not.toBeNull();
    expect(rocket!.ownerId).toBe('speler');
    expect(rocket!.heading).toBe(kart.heading);
    expect(rocket!.x).toBeCloseTo(10, 6);
    expect(rocket!.y).toBeCloseTo(100 + KART_RADIUS + 4, 6);
  });

  it('vertrekt schuin als de kart schuin staat', () => {
    const kart = createKart({ ...armed, heading: Math.PI / 2 });
    const rocket = fireRocket(1, 'speler', kart)!;
    expect(rocket.x).toBeCloseTo(KART_RADIUS + 4, 6);
    expect(rocket.y).toBeCloseTo(0, 6);
  });
});

describe('raketten, vliegen', () => {
  const far: RocketTarget[] = [{ id: 'ander', kart: createKart({ x: 9999, y: 9999 }) }];

  it('vliegt rechtuit met de juiste snelheid', () => {
    const rocket = fireRocket(1, 'speler', createKart(armed))!;
    const after = stepRockets([rocket], far).rockets[0]!;
    expect(after.y - rocket.y).toBeCloseTo(ROCKET.speed / TICK_HZ, 6);
    expect(after.x).toBeCloseTo(rocket.x, 6);
    expect(after.ticksLeft).toBe(ROCKET.lifeTicks - 1);
  });

  it('verdwijnt als hij uitgewerkt is zonder iets te raken', () => {
    let rockets: readonly Rocket[] = [fireRocket(1, 'speler', createKart(armed))!];
    for (let i = 0; i < ROCKET.lifeTicks; i += 1) rockets = stepRockets(rockets, far).rockets;
    expect(rockets).toHaveLength(0);
  });

  it('haalt een doelwit binnen zijn levensduur in', () => {
    // Het bereik volgt uit snelheid maal levensduur; dat moet de speelruimte dekken.
    expect((ROCKET.speed * ROCKET.lifeTicks) / TICK_HZ).toBeGreaterThan(900);
  });
});

describe('raketten, raken', () => {
  it('meldt een treffer op de kart die ervoor rijdt', () => {
    const targets: RocketTarget[] = [{ id: 'rival-1', kart: createKart({ x: 0, y: 300 }) }];
    let rockets: readonly Rocket[] = [fireRocket(7, 'speler', createKart(armed))!];

    let hit: string | null = null;
    for (let i = 0; i < ROCKET.lifeTicks && hit === null; i += 1) {
      const step = stepRockets(rockets, targets);
      rockets = step.rockets;
      if (step.hits.length > 0) hit = step.hits[0]!.targetId;
      if (step.hits.length > 0) expect(step.hits[0]!.rocketId).toBe(7);
    }

    expect(hit).toBe('rival-1');
    // Na de treffer is de raket weg.
    expect(rockets).toHaveLength(0);
  });

  it('raakt nooit degene die hem afvuurde', () => {
    const shooter = createKart(armed);
    const targets: RocketTarget[] = [{ id: 'speler', kart: shooter }];
    let rockets: readonly Rocket[] = [fireRocket(1, 'speler', shooter)!];

    for (let i = 0; i < 30; i += 1) {
      const step = stepRockets(rockets, targets);
      expect(step.hits).toHaveLength(0);
      rockets = step.rockets;
    }
  });

  it('vliegt langs een kart die ver opzij rijdt', () => {
    const targets: RocketTarget[] = [{ id: 'rival-1', kart: createKart({ x: 250, y: 300 }) }];
    let rockets: readonly Rocket[] = [fireRocket(1, 'speler', createKart(armed))!];

    let hits = 0;
    for (let i = 0; i < ROCKET.lifeTicks; i += 1) {
      const step = stepRockets(rockets, targets);
      hits += step.hits.length;
      rockets = step.rockets;
    }
    expect(hits).toBe(0);
  });

  it('raakt maar één kart per raket', () => {
    const targets: RocketTarget[] = [
      { id: 'rival-1', kart: createKart({ x: 0, y: 300 }) },
      { id: 'rival-2', kart: createKart({ x: 0, y: 320 }) },
    ];
    let rockets: readonly Rocket[] = [fireRocket(1, 'speler', createKart(armed))!];

    let hits = 0;
    for (let i = 0; i < ROCKET.lifeTicks; i += 1) {
      const step = stepRockets(rockets, targets);
      hits += step.hits.length;
      rockets = step.rockets;
    }
    expect(hits).toBe(1);
  });

  it('laat meerdere raketten los van elkaar vliegen', () => {
    const kart = createKart({ ...armed, rockets: 2 });
    const rockets = [fireRocket(1, 'speler', kart)!, fireRocket(2, 'rival-1', createKart({ ...armed, x: 60 }))!];
    const step = stepRockets(rockets, []);
    expect(step.rockets).toHaveLength(2);
    expect(step.rockets.map((r) => r.id)).toEqual([1, 2]);
  });
});
