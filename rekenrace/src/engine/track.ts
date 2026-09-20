/**
 * De baan: een corridor met een slingerende middellijn, obstakels, richtings-
 * pijlen en Rekengarages. Puur en seeded — geen DOM, geen willekeur buiten de rng.
 *
 * y is de rijrichting en loopt van 0 tot `length`. x staat daar dwars op, met
 * x = centerX(y) precies in het midden van de baan.
 */

import { TRACK } from '../config.ts';
import { createRng, type Rng } from './rng.ts';

/** Stenen blokkeren je; cactussen laten je door maar kosten je vaart. */
export type ObstacleKind = 'solid' | 'drag';

export interface Obstacle {
  readonly x: number;
  readonly y: number;
  readonly radius: number;
  readonly kind: ObstacleKind;
}

/** Bij een finishstation kun je ook je kart terugverdienen. */
export type GarageKind = 'supply' | 'finish';

export interface Garage {
  readonly id: string;
  readonly kind: GarageKind;
  /** Middelpunt van de garage op de baan. */
  readonly y: number;
  readonly halfWidth: number;
  readonly depth: number;
}

export interface RouteMarker {
  readonly x: number;
  readonly y: number;
}

export interface Track {
  readonly length: number;
  readonly obstacles: readonly Obstacle[];
  readonly garages: readonly Garage[];
  readonly markers: readonly RouteMarker[];
  /** x van de middellijn op hoogte y. */
  centerX(y: number): number;
  /** Halve breedte van de corridor op hoogte y. */
  halfWidth(y: number): number;
  /** Obstakels binnen [y - range, y + range]; gebruikt een index op y. */
  obstaclesNear(y: number, range: number): readonly Obstacle[];
  /** De garage waarvan de voetafdruk punt (x, y) bevat, of null. */
  garageAt(x: number, y: number): Garage | null;
}

export interface TrackOptions {
  readonly seed: number | string;
  readonly length?: number;
}

export function createTrack(options: TrackOptions): Track {
  const length = options.length ?? TRACK.length;
  const rng = createRng(`${String(options.seed)}:track`);

  // Vaste fases per baan, zodat dezelfde seed dezelfde baan geeft.
  const phase1 = rng.next() * Math.PI * 2;
  const phase2 = rng.next() * Math.PI * 2;
  const phase3 = rng.next() * Math.PI * 2;

  const centerX = (y: number): number =>
    TRACK.curveAmp1 * Math.sin((y / TRACK.curvePeriod1) * Math.PI * 2 + phase1) +
    TRACK.curveAmp2 * Math.sin((y / TRACK.curvePeriod2) * Math.PI * 2 + phase2);

  const halfWidth = (y: number): number =>
    TRACK.halfWidthBase + TRACK.halfWidthAmp * Math.sin((y / TRACK.halfWidthPeriod) * Math.PI * 2 + phase3);

  const garages = buildGarages(length);
  const markers = buildMarkers(length, centerX);
  const obstacles = buildObstacles(rng, length, centerX, halfWidth, garages);

  // Index op y, zodat een tick alleen de obstakels in de buurt naloopt.
  const bins = new Map<number, Obstacle[]>();
  for (const obstacle of obstacles) {
    const key = Math.floor(obstacle.y / TRACK.binSize);
    const bin = bins.get(key);
    if (bin === undefined) bins.set(key, [obstacle]);
    else bin.push(obstacle);
  }

  const obstaclesNear = (y: number, range: number): readonly Obstacle[] => {
    const first = Math.floor((y - range) / TRACK.binSize);
    const last = Math.floor((y + range) / TRACK.binSize);
    const found: Obstacle[] = [];
    for (let key = first; key <= last; key += 1) {
      const bin = bins.get(key);
      if (bin !== undefined) found.push(...bin);
    }
    return found;
  };

  const garageAt = (x: number, y: number): Garage | null => {
    for (const garage of garages) {
      if (Math.abs(y - garage.y) > garage.depth / 2) continue;
      if (Math.abs(x - centerX(y)) > garage.halfWidth) continue;
      return garage;
    }
    return null;
  };

  return { length, obstacles, garages, markers, centerX, halfWidth, obstaclesNear, garageAt };
}

function buildGarages(length: number): Garage[] {
  const garages: Garage[] = [];
  let index = 0;
  for (let y = TRACK.garageSpacing; y < length - TRACK.finishClear; y += TRACK.garageSpacing) {
    index += 1;
    garages.push({
      id: `garage-${index}`,
      // Elke derde garage is een finishstation, waar je je kart terug kunt winnen.
      kind: index % TRACK.finishEvery === 0 ? 'finish' : 'supply',
      y,
      halfWidth: TRACK.garageHalfWidth,
      depth: TRACK.garageDepth,
    });
  }
  return garages;
}

function buildMarkers(length: number, centerX: (y: number) => number): RouteMarker[] {
  const markers: RouteMarker[] = [];
  for (let y = TRACK.markerSpacing; y < length; y += TRACK.markerSpacing) {
    markers.push({ x: centerX(y), y });
  }
  return markers;
}

/** Houdt obstakels uit de voetafdruk van een garage vandaan. */
function insideGarage(y: number, garages: readonly Garage[]): boolean {
  return garages.some((garage) => Math.abs(y - garage.y) < garage.depth);
}

function buildObstacles(
  rng: Rng,
  length: number,
  centerX: (y: number) => number,
  halfWidth: (y: number) => number,
  garages: readonly Garage[],
): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const from = TRACK.startClear;
  const to = length - TRACK.finishClear;

  /** Plaatst iets binnen de corridor, met een marge zodat er een kart langs past. */
  const place = (y: number, radius: number, kind: ObstacleKind): Obstacle | null => {
    const usable = halfWidth(y) - radius - TRACK.obstacleWallMargin;
    if (usable <= 0) return null;
    return { x: centerX(y) + (rng.next() * 2 - 1) * usable, y, radius, kind };
  };

  for (let y = from; y < to; y += TRACK.rockSpacing) {
    const at = y + rng.next() * TRACK.rockSpacing * 0.6;
    if (at >= to || insideGarage(at, garages)) continue;
    const radius = TRACK.rockRadiusMin + rng.next() * (TRACK.rockRadiusMax - TRACK.rockRadiusMin);
    const rock = place(at, radius, 'solid');
    if (rock !== null) obstacles.push(rock);
  }

  // Cactussen staan in velden, zoals in het origineel: je ploegt er dwars doorheen.
  for (let y = from; y < to; y += TRACK.cactusClusterSpacing) {
    const at = y + rng.next() * TRACK.cactusClusterSpacing * 0.5;
    if (at >= to || insideGarage(at, garages)) continue;
    const count = rng.int(TRACK.cactusClusterMin, TRACK.cactusClusterMax);
    const anchorUsable = halfWidth(at) - TRACK.cactusRadius - TRACK.obstacleWallMargin;
    if (anchorUsable <= 0) continue;
    const anchorX = centerX(at) + (rng.next() * 2 - 1) * anchorUsable * 0.6;
    for (let i = 0; i < count; i += 1) {
      const cy = at + (rng.next() * 2 - 1) * 70;
      if (cy < from || cy >= to) continue;
      const usable = halfWidth(cy) - TRACK.cactusRadius - TRACK.obstacleWallMargin;
      const cx = clampTo(anchorX + (rng.next() * 2 - 1) * 80, centerX(cy), usable);
      obstacles.push({ x: cx, y: cy, radius: TRACK.cactusRadius, kind: 'drag' });
    }
  }

  return obstacles.sort((a, b) => a.y - b.y);
}

/** Houdt x binnen [center - reach, center + reach]. */
function clampTo(x: number, center: number, reach: number): number {
  if (reach <= 0) return center;
  const delta = Math.max(-reach, Math.min(reach, x - center));
  return center + delta;
}
