/**
 * De tegenstanders. Ze rijden zelfstandig de baan af: mikken op een punt
 * verderop op de middellijn, wijken uit voor stenen en schieten af en toe een
 * raket op wie voor ze rijdt.
 *
 * Ze stoppen nooit bij een garage — dat is jouw afweging, niet die van hen — en
 * hun tank raakt dus ook niet leeg. Hun tempo ligt in ruil daarvoor onder het
 * jouwe, zodat je de tijd die je binnen verliest kunt terugrijden.
 */

import { KART, RIVALS, TICK_HZ } from '../config.ts';
import { KART_RADIUS, stepKart, type Kart, type KartInput } from './kart.ts';
import type { Track } from './track.ts';

export interface RivalProfile {
  readonly id: string;
  readonly name: string;
  readonly speedFactor: number;
  readonly lookahead: number;
  /** 0 tot 1: hoe goed deze rijder stenen ziet aankomen. */
  readonly skill: number;
  readonly rocketEveryTicks: number;
}

/** De profielen voor een veld van `count` tegenstanders, sterkste laatst. */
export function rivalProfiles(count: number): RivalProfile[] {
  const wanted = Math.max(0, Math.min(RIVALS.profiles.length, Math.round(count)));
  return RIVALS.profiles.slice(0, wanted).map((profile, index) => ({
    id: `rival-${index + 1}`,
    name: profile.name,
    speedFactor: profile.speedFactor,
    lookahead: profile.lookahead,
    skill: profile.skill,
    rocketEveryTicks: Math.round(profile.rocketEverySeconds * TICK_HZ),
  }));
}

/** Verschil tussen twee hoeken, genormaliseerd naar [-pi, pi]. */
export function angleDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * Bepaalt waar deze rijder heen stuurt: een punt verderop op de middellijn,
 * opzij geschoven als daar een steen ligt.
 */
export function aimPoint(kart: Kart, track: Track, profile: RivalProfile): number {
  const ahead = kart.y + profile.lookahead;
  const center = track.centerX(ahead);
  const edge = track.halfWidth(ahead);
  let target = center;

  // Alleen een goede rijder kijkt echt ver vooruit.
  const scanRange = Math.max(80, profile.lookahead * profile.skill);

  // Wijk uit voor de éérste steen op de route. Verderop uitwijken heeft geen zin
  // zolang je die nog niet voorbij bent, en een verre steen mag de keuze voor
  // een nabije niet overschrijven.
  let nearest: { x: number; clearance: number } | null = null;
  let nearestY = Infinity;

  for (const obstacle of track.obstaclesNear(kart.y + scanRange / 2, scanRange / 2 + 60)) {
    if (obstacle.kind !== 'solid') continue;
    if (obstacle.y <= kart.y || obstacle.y > kart.y + scanRange) continue;
    if (obstacle.y >= nearestY) continue;

    // Waar rijden we als we daar zijn, op de lijn naar het mikpunt?
    const t = (obstacle.y - kart.y) / profile.lookahead;
    const projected = kart.x + (target - kart.x) * t;
    const clearance = obstacle.radius + KART_RADIUS + RIVALS.avoidMargin;
    if (Math.abs(obstacle.x - projected) > clearance) continue;

    nearest = { x: obstacle.x, clearance };
    nearestY = obstacle.y;
  }

  if (nearest !== null) {
    // Ga er langs aan de kant waar de meeste ruimte is.
    const leftRoom = nearest.x - nearest.clearance - (center - edge);
    const rightRoom = center + edge - (nearest.x + nearest.clearance);
    target = rightRoom > leftRoom ? nearest.x + nearest.clearance : nearest.x - nearest.clearance;
  }

  return Math.max(center - edge + KART_RADIUS, Math.min(center + edge - KART_RADIUS, target));
}

/** De stuur- en remcommando's voor deze tick. */
export function driveRival(kart: Kart, track: Track, profile: RivalProfile): KartInput {
  const target = aimPoint(kart, track, profile);
  const desired = Math.atan2(target - kart.x, profile.lookahead);
  const delta = angleDelta(kart.heading, desired);

  const steer = Math.abs(delta) < RIVALS.steerDeadzone ? 0 : Math.sign(delta);
  // Turbo zodra hij er een heeft en de baan recht genoeg voor ligt.
  const turbo = kart.boosts > 0 && Math.abs(delta) < 0.12;
  return { steer, brake: false, turbo };
}

/**
 * Eén tick voor een tegenstander. Houdt de tank vol: ze doen niet mee aan de
 * benzine-economie, want ze stoppen nooit om te tanken.
 */
export function stepRival(kart: Kart, track: Track, profile: RivalProfile): Kart {
  const next = stepKart(kart, driveRival(kart, track, profile), track);
  return { ...next, fuel: KART.maxFuel, onFoot: !next.hasKart };
}

/**
 * Of deze rijder nu schiet. Hij moet een raket hebben, de tijd moet om zijn, en
 * het doelwit moet binnen bereik recht voor hem liggen.
 */
export function wantsToFire(kart: Kart, target: Kart, profile: RivalProfile, tick: number): boolean {
  if (kart.rockets <= 0) return false;
  if (tick % profile.rocketEveryTicks !== 0) return false;

  const dx = target.x - kart.x;
  const dy = target.y - kart.y;
  const distance = Math.hypot(dx, dy);
  if (distance > RIVALS.fireRange || distance < KART_RADIUS) return false;

  // Alleen naar voren schieten, niet dwars of achteruit.
  return Math.abs(angleDelta(kart.heading, Math.atan2(dx, dy))) < RIVALS.fireCone;
}
