import { describe, expect, it } from 'vitest';
import { KART, TRACK } from '../src/config.ts';
import { KART_RADIUS } from '../src/engine/kart.ts';
import { createTrack, type Track } from '../src/engine/track.ts';

function sampleY(track: Track, step = 25): number[] {
  const ys: number[] = [];
  for (let y = 0; y <= track.length; y += step) ys.push(y);
  return ys;
}

describe('track, vorm', () => {
  const track = createTrack({ seed: 'baan' });

  it('heeft overal een positieve breedte', () => {
    for (const y of sampleY(track)) {
      expect(track.halfWidth(y)).toBeGreaterThan(50);
    }
  });

  it('slingert, maar niet scherper dan een kart kan volgen', () => {
    // De helling van de middellijn bepaalt hoe scherp de baan draait.
    let maxSlope = 0;
    let moved = false;
    for (const y of sampleY(track, 10)) {
      const slope = Math.abs(track.centerX(y + 10) - track.centerX(y)) / 10;
      maxSlope = Math.max(maxSlope, slope);
      if (Math.abs(track.centerX(y)) > 40) moved = true;
    }
    expect(moved).toBe(true);
    // Ruim onder 45 graden; daarboven wordt de corridor schuin genoeg om vast te lopen.
    expect(maxSlope).toBeLessThan(0.8);
  });

  it('vraagt nergens een scherpere bocht dan een kart op topsnelheid kan draaien', () => {
    // De kromming van de middellijn bepaalt de draaisnelheid die de baan vraagt.
    let maxYawRate = 0;
    const h = 10;
    for (let y = h; y < track.length - h; y += h) {
      const curvature = Math.abs(track.centerX(y + h) - 2 * track.centerX(y) + track.centerX(y - h)) / (h * h);
      maxYawRate = Math.max(maxYawRate, curvature * KART.maxSpeed);
    }
    expect(maxYawRate).toBeLessThan(KART.steerRate * 0.8);
  });

  it('geeft bij dezelfde seed exact dezelfde baan', () => {
    const a = createTrack({ seed: 'zelfde' });
    const b = createTrack({ seed: 'zelfde' });
    expect(a.obstacles).toEqual(b.obstacles);
    expect(a.garages).toEqual(b.garages);
    expect(a.centerX(1234)).toBe(b.centerX(1234));
  });

  it('geeft bij een andere seed een andere baan', () => {
    const a = createTrack({ seed: 'een' });
    const b = createTrack({ seed: 'twee' });
    expect(a.centerX(1234)).not.toBe(b.centerX(1234));
  });
});

describe('track, obstakels', () => {
  const track = createTrack({ seed: 'obstakels' });

  it('zet elk obstakel binnen de corridor', () => {
    expect(track.obstacles.length).toBeGreaterThan(20);
    for (const obstacle of track.obstacles) {
      const offset = Math.abs(obstacle.x - track.centerX(obstacle.y));
      expect(offset + obstacle.radius).toBeLessThanOrEqual(track.halfWidth(obstacle.y));
      expect(obstacle.y).toBeGreaterThanOrEqual(0);
      expect(obstacle.y).toBeLessThanOrEqual(track.length);
    }
  });

  it('houdt de start en de finish vrij', () => {
    for (const obstacle of track.obstacles) {
      expect(obstacle.y).toBeGreaterThanOrEqual(TRACK.startClear - 1);
      expect(obstacle.y).toBeLessThanOrEqual(track.length - TRACK.finishClear + 1);
    }
  });

  it('laat naast elk obstakel een gat waar een kart door past', () => {
    // Zonder deze marge klemt een kart zich vast tussen het obstakel en de muur:
    // de steen duwt hem in de muur, de muur duwt hem terug in de steen.
    const kartWidth = KART_RADIUS * 2;
    for (const obstacle of track.obstacles) {
      const center = track.centerX(obstacle.y);
      const edge = track.halfWidth(obstacle.y);
      const gapLeft = obstacle.x - obstacle.radius - (center - edge);
      const gapRight = center + edge - (obstacle.x + obstacle.radius);
      expect(Math.min(gapLeft, gapRight)).toBeGreaterThan(kartWidth);
    }
  });

  it('kent zowel stenen als cactussen', () => {
    const kinds = new Set(track.obstacles.map((o) => o.kind));
    expect(kinds).toEqual(new Set(['solid', 'drag']));
  });

  it('zet cactussen in velden, niet los verspreid', () => {
    const cacti = track.obstacles.filter((o) => o.kind === 'drag');
    expect(cacti.length).toBeGreaterThan(TRACK.cactusClusterMin);
    // In een veld staat elke cactus dicht bij een andere.
    for (const cactus of cacti) {
      const hasNeighbour = cacti.some(
        (other) => other !== cactus && Math.hypot(other.x - cactus.x, other.y - cactus.y) < 160,
      );
      expect(hasNeighbour).toBe(true);
    }
  });

  it('vindt via de index precies de obstakels in de buurt', () => {
    for (const y of [800, 3000, 7500]) {
      const range = 150;
      const near = track.obstaclesNear(y, range);
      const expected = track.obstacles.filter((o) => Math.abs(o.y - y) <= range);
      // De index werkt met bakken, dus hij mag ruimer zijn, maar niets missen.
      for (const obstacle of expected) expect(near).toContain(obstacle);
      for (const obstacle of near) expect(Math.abs(obstacle.y - y)).toBeLessThan(range + TRACK.binSize * 2);
    }
  });

  it('houdt de garages vrij van obstakels', () => {
    for (const garage of track.garages) {
      for (const obstacle of track.obstacles) {
        const insideDepth = Math.abs(obstacle.y - garage.y) < garage.depth / 2;
        const insideWidth = Math.abs(obstacle.x - track.centerX(obstacle.y)) < garage.halfWidth;
        expect(insideDepth && insideWidth).toBe(false);
      }
    }
  });
});

describe('track, garages', () => {
  const track = createTrack({ seed: 'garages' });

  it('verdeelt garages over de baan', () => {
    expect(track.garages.length).toBeGreaterThanOrEqual(5);
    for (const garage of track.garages) {
      expect(garage.y).toBeGreaterThan(0);
      expect(garage.y).toBeLessThan(track.length);
    }
  });

  it('maakt elke derde garage een finishstation', () => {
    const kinds = track.garages.map((g) => g.kind);
    expect(kinds[0]).toBe('supply');
    expect(kinds[1]).toBe('supply');
    expect(kinds[2]).toBe('finish');
    expect(kinds.filter((k) => k === 'finish').length).toBeGreaterThan(0);
  });

  it('herkent dat je een garage binnenrijdt, en dat je er omheen kunt', () => {
    const garage = track.garages[0]!;
    const center = track.centerX(garage.y);

    expect(track.garageAt(center, garage.y)?.id).toBe(garage.id);
    // Vlak ernaast rijd je er langs.
    expect(track.garageAt(center + garage.halfWidth + 5, garage.y)).toBeNull();
    // Ruim ervoor en erna ook.
    expect(track.garageAt(center, garage.y - garage.depth)).toBeNull();
    expect(track.garageAt(center, garage.y + garage.depth)).toBeNull();
  });

  it('heeft richtingspijlen langs de middellijn', () => {
    expect(track.markers.length).toBeGreaterThan(10);
    for (const marker of track.markers) {
      expect(marker.x).toBeCloseTo(track.centerX(marker.y), 6);
    }
  });
});
