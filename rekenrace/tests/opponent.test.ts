import { describe, expect, it } from 'vitest';
import { KART, RIVALS, TICK_HZ } from '../src/config.ts';
import { KART_RADIUS, createKart, type Kart } from '../src/engine/kart.ts';
import { aimPoint, angleDelta, driveRival, rivalProfiles, stepRival, wantsToFire } from '../src/engine/opponent.ts';
import { createTrack, type Track } from '../src/engine/track.ts';

function straightTrack(halfWidth = 210): Track {
  return {
    length: 100000,
    obstacles: [],
    garages: [],
    markers: [],
    centerX: () => 0,
    halfWidth: () => halfWidth,
    obstaclesNear: () => [],
    garageAt: () => null,
  };
}

describe('tegenstanders, profielen', () => {
  it('levert er één tot drie, met alliterende namen', () => {
    expect(rivalProfiles(0)).toHaveLength(0);
    expect(rivalProfiles(2)).toHaveLength(2);
    expect(rivalProfiles(9)).toHaveLength(RIVALS.profiles.length);

    for (const profile of rivalProfiles(3)) {
      const [first, , rest] = profile.name.split(' ');
      expect(first![0]!.toLowerCase()).toBe(rest![0]!.toLowerCase());
    }
  });

  it('zet ze op oplopende sterkte, en allemaal onder een kart op volle kracht', () => {
    const profiles = rivalProfiles(3);
    for (let i = 1; i < profiles.length; i += 1) {
      expect(profiles[i]!.speedFactor).toBeGreaterThan(profiles[i - 1]!.speedFactor);
      expect(profiles[i]!.skill).toBeGreaterThan(profiles[i - 1]!.skill);
    }
    // De speler moet de tijd die hij in de garage verliest kunnen terugrijden.
    for (const profile of profiles) expect(profile.speedFactor).toBeLessThan(1);
  });

  it('geeft elke rijder een eigen id', () => {
    const ids = rivalProfiles(3).map((p) => p.id);
    expect(new Set(ids).size).toBe(3);
  });
});

describe('tegenstanders, hoeken', () => {
  it('normaliseert het verschil naar het kortste draaien', () => {
    expect(angleDelta(0, 0.5)).toBeCloseTo(0.5);
    expect(angleDelta(0, -0.5)).toBeCloseTo(-0.5);
    // Van net onder 2pi naar net erboven is een klein stapje, geen hele ronde.
    expect(angleDelta(Math.PI * 1.9, Math.PI * 2.1)).toBeCloseTo(0.2 * Math.PI, 6);
    expect(Math.abs(angleDelta(0, Math.PI * 3))).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

describe('tegenstanders, koers bepalen', () => {
  const profile = rivalProfiles(3)[2]!;

  it('mikt op de middellijn als de baan vrij is', () => {
    const track = straightTrack();
    expect(aimPoint(createKart({ x: 80, y: 0 }), track, profile)).toBeCloseTo(0, 6);
  });

  it('wijkt uit voor een steen op de route', () => {
    const rock = { x: 0, y: 200, radius: 40, kind: 'solid' as const };
    const track: Track = { ...straightTrack(), obstacles: [rock], obstaclesNear: () => [rock] };

    const target = aimPoint(createKart({ x: 0, y: 0 }), track, profile);
    expect(Math.abs(target)).toBeGreaterThan(rock.radius + KART_RADIUS);
  });

  it('negeert een cactus, want daar rijdt hij gewoon doorheen', () => {
    const cactus = { x: 0, y: 200, radius: 40, kind: 'drag' as const };
    const track: Track = { ...straightTrack(), obstacles: [cactus], obstaclesNear: () => [cactus] };
    expect(aimPoint(createKart({ x: 0, y: 0 }), track, profile)).toBeCloseTo(0, 6);
  });

  it('negeert een steen waar hij al voorbij is', () => {
    const rock = { x: 0, y: 100, radius: 40, kind: 'solid' as const };
    const track: Track = { ...straightTrack(), obstacles: [rock], obstaclesNear: () => [rock] };
    expect(aimPoint(createKart({ x: 0, y: 300 }), track, profile)).toBeCloseTo(0, 6);
  });

  it('houdt het mikpunt binnen de baan', () => {
    // Een steen tegen de rand mag hem niet de muur in sturen.
    const rock = { x: 150, y: 200, radius: 40, kind: 'solid' as const };
    const track: Track = { ...straightTrack(210), obstacles: [rock], obstaclesNear: () => [rock] };
    const target = aimPoint(createKart({ x: 150, y: 0 }), track, profile);
    expect(Math.abs(target)).toBeLessThanOrEqual(210 - KART_RADIUS + 1e-9);
  });

  it('stuurt naar het mikpunt en laat kleine afwijkingen lopen', () => {
    const track = straightTrack();
    expect(driveRival(createKart({ x: 120, y: 0 }), track, profile).steer).toBe(-1);
    expect(driveRival(createKart({ x: -120, y: 0 }), track, profile).steer).toBe(1);
    expect(driveRival(createKart({ x: 0, y: 0 }), track, profile).steer).toBe(0);
  });

  it('gebruikt turbo alleen op een recht stuk, en alleen met een boost', () => {
    const track = straightTrack();
    expect(driveRival(createKart({ x: 0, boosts: 0 }), track, profile).turbo).toBe(false);
    expect(driveRival(createKart({ x: 0, boosts: 1 }), track, profile).turbo).toBe(true);
    // Scheef in de bocht laat hij de turbo staan.
    expect(driveRival(createKart({ x: 200, boosts: 1 }), track, profile).turbo).toBe(false);
  });
});

describe('tegenstanders, rijden', () => {
  it('houdt de tank vol, want ze stoppen nooit om te tanken', () => {
    const track = straightTrack();
    const profile = rivalProfiles(1)[0]!;
    let kart = createKart({ fuel: 1, speedFactor: profile.speedFactor });
    for (let i = 0; i < TICK_HZ * 30; i += 1) kart = stepRival(kart, track, profile);

    expect(kart.fuel).toBe(KART.maxFuel);
    expect(kart.onFoot).toBe(false);
    expect(kart.speed).toBeGreaterThan(KART.footSpeed);
  });

  it('rijdt niet harder dan zijn handicap toelaat', () => {
    const track = straightTrack();
    const profile = rivalProfiles(1)[0]!;
    let kart = createKart({ fuel: KART.maxFuel, speedFactor: profile.speedFactor });
    for (let i = 0; i < TICK_HZ * 20; i += 1) kart = stepRival(kart, track, profile);

    expect(kart.speed).toBeLessThanOrEqual(KART.maxSpeed * profile.speedFactor + 1e-6);
    expect(kart.speed).toBeGreaterThan(KART.maxSpeed * profile.speedFactor - 5);
  });

  it('rijdt de hele baan uit, in volgorde van hun kunnen', () => {
    const track = createTrack({ seed: 'wedstrijd' });
    const times = rivalProfiles(3).map((profile) => {
      let kart: Kart = createKart({ fuel: KART.maxFuel, y: 50, speedFactor: profile.speedFactor });
      let ticks = 0;
      while (kart.y < track.length && ticks < TICK_HZ * 400) {
        kart = stepRival(kart, track, profile);
        ticks += 1;
      }
      return { name: profile.name, seconds: ticks / TICK_HZ, condition: kart.condition, y: kart.y };
    });

    for (const result of times) {
      // Iedereen komt aan, binnen een tijd die op een race lijkt.
      expect(result.y).toBeGreaterThanOrEqual(track.length);
      expect(result.seconds).toBeGreaterThan(60);
      expect(result.seconds).toBeLessThan(240);
      // En sloopt zichzelf onderweg niet op de obstakels.
      expect(result.condition).toBeGreaterThan(KART.maxCondition / 2);
    }

    // De betere rijder is ook echt sneller.
    expect(times[2]!.seconds).toBeLessThan(times[0]!.seconds);
  });
});

describe('tegenstanders, schieten', () => {
  const profile = rivalProfiles(3)[2]!;
  const shooter = createKart({ fuel: KART.maxFuel, rockets: 1 });
  const onTick = profile.rocketEveryTicks;

  it('schiet niet zonder raketten', () => {
    const empty = createKart({ fuel: KART.maxFuel, rockets: 0 });
    expect(wantsToFire(empty, createKart({ y: 200 }), profile, onTick)).toBe(false);
  });

  it('schiet op wie recht voor hem rijdt', () => {
    expect(wantsToFire(shooter, createKart({ y: 200 }), profile, onTick)).toBe(true);
  });

  it('wacht tussen twee schoten', () => {
    expect(wantsToFire(shooter, createKart({ y: 200 }), profile, onTick + 1)).toBe(false);
  });

  it('schiet niet achteruit of dwars', () => {
    expect(wantsToFire(shooter, createKart({ y: -200 }), profile, onTick)).toBe(false);
    expect(wantsToFire(shooter, createKart({ x: 400, y: 20 }), profile, onTick)).toBe(false);
  });

  it('schiet niet buiten bereik', () => {
    expect(wantsToFire(shooter, createKart({ y: RIVALS.fireRange + 50 }), profile, onTick)).toBe(false);
  });
});
