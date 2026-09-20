/**
 * Mini-raketten. Ze vliegen rechtuit vanaf de neus van de kart die ze afvuurt
 * en treffen de eerste andere kart die ze tegenkomen. Puur en headless.
 */

import { ROCKET, TICK_HZ } from '../config.ts';
import { KART_RADIUS, type Kart } from './kart.ts';

export interface Rocket {
  readonly id: number;
  /** Wie hem afvuurde; die kan er zelf niet door geraakt worden. */
  readonly ownerId: string;
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly ticksLeft: number;
}

export interface RocketHit {
  readonly rocketId: number;
  readonly targetId: string;
}

export interface RocketStep {
  readonly rockets: readonly Rocket[];
  readonly hits: readonly RocketHit[];
}

/** Karts zoals de raketten ze zien: een positie met een naam eraan. */
export interface RocketTarget {
  readonly id: string;
  readonly kart: Kart;
}

/**
 * Vuurt een raket af. Geeft null als er niets op voorraad is, zodat de aanroeper
 * niet zelf hoeft te tellen.
 */
export function fireRocket(id: number, ownerId: string, kart: Kart): Rocket | null {
  if (kart.rockets <= 0) return null;
  return {
    id,
    ownerId,
    // Net voor de neus, zodat je jezelf niet meteen in de weg zit.
    x: kart.x + Math.sin(kart.heading) * (KART_RADIUS + 4),
    y: kart.y + Math.cos(kart.heading) * (KART_RADIUS + 4),
    heading: kart.heading,
    ticksLeft: ROCKET.lifeTicks,
  };
}

/** Eén tick voor alle raketten in de lucht. */
export function stepRockets(rockets: readonly Rocket[], targets: readonly RocketTarget[]): RocketStep {
  const moved: Rocket[] = [];
  const hits: RocketHit[] = [];
  const step = ROCKET.speed / TICK_HZ;

  for (const rocket of rockets) {
    const x = rocket.x + Math.sin(rocket.heading) * step;
    const y = rocket.y + Math.cos(rocket.heading) * step;
    const ticksLeft = rocket.ticksLeft - 1;

    const struck = targets.find((target) => {
      if (target.id === rocket.ownerId) return false;
      const reach = ROCKET.radius + KART_RADIUS;
      return Math.hypot(target.kart.x - x, target.kart.y - y) <= reach;
    });

    if (struck !== undefined) {
      hits.push({ rocketId: rocket.id, targetId: struck.id });
      continue;
    }
    // Uitgewerkt: hij verdwijnt zonder iets te raken.
    if (ticksLeft <= 0) continue;

    moved.push({ ...rocket, x, y, ticksLeft });
  }

  return { rockets: moved, hits };
}
