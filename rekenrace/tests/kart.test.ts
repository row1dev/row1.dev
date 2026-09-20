import { describe, expect, it } from 'vitest';
import { KART, TICK_HZ } from '../src/config.ts';
import {
  NO_INPUT,
  applyRocketHit,
  createKart,
  stepKart,
  topSpeedOf,
  type Kart,
  type KartInput,
} from '../src/engine/kart.ts';
import { createTrack, type Track } from '../src/engine/track.ts';

/** Een kale, kaarsrechte baan zonder obstakels, om het rijgedrag te isoleren. */
function straightTrack(halfWidth = 200): Track {
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

function drive(kart: Kart, track: Track, ticks: number, input: KartInput = NO_INPUT): Kart {
  let current = kart;
  for (let i = 0; i < ticks; i += 1) current = stepKart(current, input, track);
  return current;
}

const full = { fuel: KART.maxFuel };

describe('kart, rijden', () => {
  it('geeft vanzelf gas tot de topsnelheid en gaat er niet overheen', () => {
    const track = straightTrack();
    let kart = createKart(full);
    expect(kart.speed).toBe(0);

    kart = drive(kart, track, TICK_HZ * 5);
    expect(kart.speed).toBeCloseTo(KART.maxSpeed, 0);

    kart = drive(kart, track, TICK_HZ * 5);
    expect(kart.speed).toBeLessThanOrEqual(KART.maxSpeed + 1e-9);
  });

  it('remt af en staat uiteindelijk stil', () => {
    const track = straightTrack();
    let kart = drive(createKart(full), track, TICK_HZ * 3);
    const rolling = kart.speed;
    kart = drive(kart, track, TICK_HZ, { steer: 0, brake: true, turbo: false });
    expect(kart.speed).toBeLessThan(rolling);
    expect(kart.speed).toBe(0);
  });

  it('rijdt rechtdoor langs de rijrichting als je niet stuurt', () => {
    const track = straightTrack();
    const kart = drive(createKart(full), track, TICK_HZ * 2);
    expect(kart.heading).toBe(0);
    expect(kart.x).toBeCloseTo(0, 6);
    expect(kart.y).toBeGreaterThan(0);
  });

  it('stuurt naar links en naar rechts', () => {
    const track = straightTrack();
    const rolling = drive(createKart(full), track, TICK_HZ);
    const right = drive(rolling, track, TICK_HZ, { steer: 1, brake: false, turbo: false });
    const left = drive(rolling, track, TICK_HZ, { steer: -1, brake: false, turbo: false });

    expect(right.heading).toBeGreaterThan(0);
    expect(right.x).toBeGreaterThan(rolling.x);
    expect(left.heading).toBeLessThan(0);
    expect(left.x).toBeLessThan(rolling.x);
  });

  it('stuurt niet als de kart stilstaat', () => {
    const track = straightTrack();
    const kart = stepKart(createKart(full), { steer: 1, brake: true, turbo: false }, track);
    expect(kart.heading).toBe(0);
  });

  it('is deterministisch: dezelfde invoer geeft dezelfde rit', () => {
    const track = createTrack({ seed: 'rit' });
    const inputs: KartInput[] = Array.from({ length: 400 }, (_, i) => ({
      steer: Math.sin(i / 20) > 0 ? 1 : -1,
      brake: i % 97 === 0,
      turbo: false,
    }));
    const run = (): Kart => {
      let kart = createKart({ ...full, y: 100 });
      for (const input of inputs) kart = stepKart(kart, input, track);
      return kart;
    };
    expect(run()).toEqual(run());
  });
});

describe('kart, benzine', () => {
  it('verbruikt benzine op afstand, niet op tijd', () => {
    const track = straightTrack();
    const kart = drive(createKart(full), track, TICK_HZ * 4);
    const used = KART.maxFuel - kart.fuel;
    expect(used).toBeCloseTo(kart.y / KART.unitsPerFuel, 5);
  });

  it('valt terug op looptempo als de tank leeg is', () => {
    const track = straightTrack();
    let kart = createKart({ fuel: 1 });
    kart = drive(kart, track, TICK_HZ * 20);

    expect(kart.fuel).toBe(0);
    expect(kart.onFoot).toBe(true);
    // Nog steeds in bezit van de kart: bijtanken is genoeg om verder te rijden.
    expect(kart.hasKart).toBe(true);
    expect(kart.speed).toBeLessThanOrEqual(KART.footSpeed + 1e-9);
  });

  it('verbruikt te voet geen benzine', () => {
    const track = straightTrack();
    const kart = drive(createKart({ fuel: 0 }), track, TICK_HZ * 3);
    expect(kart.fuel).toBe(0);
    expect(kart.y).toBeGreaterThan(0);
  });
});

describe('kart, botsen', () => {
  it('houdt je binnen de randen van de baan', () => {
    const track = straightTrack(120);
    // Recht op de rechtermuur af, zonder te sturen.
    let kart = createKart({ ...full, heading: Math.PI / 2 });
    let everHitWall = false;
    for (let i = 0; i < TICK_HZ * 8; i += 1) {
      kart = stepKart(kart, NO_INPUT, track);
      everHitWall = everHitWall || kart.hitWall;
      expect(Math.abs(kart.x)).toBeLessThanOrEqual(120 + 1e-9);
    }
    expect(everHitWall).toBe(true);
  });

  it('draait bij een frontale muur mee en rijdt er langs verder', () => {
    const track = straightTrack(120);
    let kart = createKart({ ...full, heading: Math.PI / 2 });
    kart = drive(kart, track, TICK_HZ * 8);
    // Niet blijven duwen tegen de muur, maar er langs verder de baan op.
    expect(kart.x).toBeCloseTo(120, 0);
    expect(kart.y).toBeGreaterThan(200);
    expect(kart.speed).toBeGreaterThan(KART.footSpeed);
  });

  it('wringt zich door een gat tussen een steen en de muur', () => {
    // Precies het geval dat een kart met automatisch gas eindeloos vasthield:
    // de steen duwt hem in de muur, de muur duwt hem terug in de steen. Het gat
    // is hier ruim genoeg voor een kart, en dat garandeert de baangenerator ook.
    const rock = { x: 30, y: 600, radius: 40, kind: 'solid' as const };
    const track: Track = { ...straightTrack(120), obstacles: [rock], obstaclesNear: () => [rock] };

    let kart = createKart({ ...full, x: 95 });
    kart = drive(kart, track, TICK_HZ * 20);
    expect(kart.y).toBeGreaterThan(1200);
  });

  it('laat je niet door een steen heen rijden', () => {
    const track: Track = {
      ...straightTrack(),
      obstacles: [{ x: 0, y: 400, radius: 30, kind: 'solid' }],
      obstaclesNear: () => [{ x: 0, y: 400, radius: 30, kind: 'solid' }],
    };
    let kart = createKart(full);
    for (let i = 0; i < TICK_HZ * 10; i += 1) {
      kart = stepKart(kart, NO_INPUT, track);
      // Nooit binnen de steen.
      expect(Math.hypot(kart.x - 0, kart.y - 400)).toBeGreaterThanOrEqual(30 + 18 - 1e-6);
    }
  });

  it('kost conditie bij een harde klap, maar niet bij aantikken', () => {
    const rock = { x: 0, y: 300, radius: 30, kind: 'solid' as const };
    const track: Track = { ...straightTrack(), obstacles: [rock], obstaclesNear: () => [rock] };

    const fast = drive(createKart(full), track, TICK_HZ * 6);
    expect(fast.condition).toBeLessThan(KART.startCondition);

    // Langzaam aanschuiven kost niets.
    const slow = drive(createKart({ ...full, y: 240 }), track, 40, {
      steer: 0,
      brake: true,
      turbo: false,
    });
    expect(slow.condition).toBe(KART.startCondition);
  });

  it('laat je door cactussen rijden, maar het kost vaart', () => {
    const cactus = { x: 0, y: 500, radius: 15, kind: 'drag' as const };
    const track: Track = { ...straightTrack(), obstacles: [cactus], obstaclesNear: () => [cactus] };

    let kart = createKart(full);
    let wasInDrag = false;
    let speedInDrag = Infinity;
    for (let i = 0; i < TICK_HZ * 8; i += 1) {
      kart = stepKart(kart, NO_INPUT, track);
      if (kart.inDrag) {
        wasInDrag = true;
        speedInDrag = Math.min(speedInDrag, kart.speed);
      }
    }
    expect(wasInDrag).toBe(true);
    expect(speedInDrag).toBeLessThan(KART.maxSpeed);
    // Er dwars doorheen, niet ervoor blijven steken.
    expect(kart.y).toBeGreaterThan(500);
    expect(kart.condition).toBe(KART.startCondition);
  });
});

describe('kart, turbo', () => {
  it('gebruikt een boost en gaat harder dan de topsnelheid', () => {
    const track = straightTrack();
    let kart = drive(createKart({ ...full, boosts: 2 }), track, TICK_HZ * 4);
    expect(kart.speed).toBeCloseTo(KART.maxSpeed, 0);

    kart = stepKart(kart, { steer: 0, brake: false, turbo: true }, track);
    expect(kart.boosts).toBe(1);
    // De tick die de turbo aanzet telt hem nog niet af: je krijgt de volle duur.
    expect(kart.turboTicksLeft).toBe(KART.turboTicks);

    kart = drive(kart, track, 30);
    expect(kart.speed).toBeGreaterThan(KART.maxSpeed);
    expect(topSpeedOf(kart)).toBe(KART.turboSpeed);
  });

  it('doet niets zonder boosts op voorraad', () => {
    const track = straightTrack();
    const kart = stepKart(createKart(full), { steer: 0, brake: false, turbo: true }, track);
    expect(kart.turboTicksLeft).toBe(0);
    expect(kart.boosts).toBe(0);
  });

  it('loopt af en zakt terug naar de gewone topsnelheid', () => {
    const track = straightTrack();
    let kart = drive(createKart({ ...full, boosts: 1 }), track, TICK_HZ * 3);
    kart = stepKart(kart, { steer: 0, brake: false, turbo: true }, track);
    kart = drive(kart, track, KART.turboTicks + TICK_HZ * 3);
    expect(kart.turboTicksLeft).toBe(0);
    expect(kart.speed).toBeCloseTo(KART.maxSpeed, 0);
  });
});

describe('kart, raketschade', () => {
  it('kost conditie per treffer', () => {
    const kart = applyRocketHit(createKart(full));
    expect(kart.condition).toBe(KART.startCondition - KART.rocketDamage);
    expect(kart.hasKart).toBe(true);
  });

  it('kost je de kart na genoeg treffers', () => {
    let kart = createKart(full);
    const hits = Math.ceil(KART.startCondition / KART.rocketDamage);
    for (let i = 0; i < hits; i += 1) kart = applyRocketHit(kart);

    expect(kart.condition).toBe(0);
    expect(kart.hasKart).toBe(false);
    expect(kart.onFoot).toBe(true);
  });

  it('laat je te voet verder, langzamer, met benzine nog in de tank', () => {
    const track = straightTrack();
    let kart = createKart(full);
    for (let i = 0; i < 4; i += 1) kart = applyRocketHit(kart);
    kart = drive(kart, track, TICK_HZ * 5);

    expect(kart.hasKart).toBe(false);
    expect(kart.speed).toBeCloseTo(KART.footSpeed, 0);
    expect(kart.fuel).toBe(KART.maxFuel);
    expect(kart.y).toBeGreaterThan(0);
  });
});
