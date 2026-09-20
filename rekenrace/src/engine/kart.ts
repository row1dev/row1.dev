/**
 * Rijgedrag van één kart, top-down. Puur: `stepKart` krijgt een state en geeft
 * een nieuwe terug, zonder iets te muteren en zonder DOM.
 *
 * Zowel de speler als de tegenstanders gebruiken dit; alleen de invoer verschilt.
 *
 * Richting: heading 0 wijst langs +y, de rijrichting van de baan. Een positieve
 * heading draait naar +x.
 */

import { KART, TICK_HZ } from '../config.ts';
import { clamp } from './math.ts';
import type { Track } from './track.ts';

export interface KartInput {
  /** -1 naar links, 0 rechtdoor, 1 naar rechts. */
  readonly steer: number;
  readonly brake: boolean;
  /** Vraagt turbo aan; alleen effect als er een boost op voorraad is. */
  readonly turbo: boolean;
}

export const NO_INPUT: KartInput = { steer: 0, brake: false, turbo: false };

export interface Kart {
  readonly x: number;
  readonly y: number;
  readonly heading: number;
  readonly speed: number;
  /** Handicap op de topsnelheid; 1 is een kart op volle kracht. */
  readonly speedFactor: number;

  readonly fuel: number;
  readonly condition: number;
  readonly rockets: number;
  readonly boosts: number;

  /** False zodra de conditie op is; alleen een finishstation geeft hem terug. */
  readonly hasKart: boolean;
  readonly turboTicksLeft: number;

  /** Afgeleid: te voet door pech of door een lege tank. */
  readonly onFoot: boolean;
  /** Wat er deze tick geraakt is, voor geluid en beeld. */
  readonly hitWall: boolean;
  readonly hitSolid: boolean;
  readonly inDrag: boolean;
}

export interface KartOptions {
  readonly x?: number;
  readonly y?: number;
  /** Beginrichting in radialen; 0 is recht vooruit langs de baan. */
  readonly heading?: number;
  readonly speed?: number;
  readonly fuel?: number;
  readonly condition?: number;
  readonly rockets?: number;
  readonly boosts?: number;
  readonly speedFactor?: number;
}

export function createKart(options: KartOptions = {}): Kart {
  const fuel = options.fuel ?? KART.startFuel;
  const condition = options.condition ?? KART.startCondition;
  return {
    x: options.x ?? 0,
    y: options.y ?? 0,
    heading: options.heading ?? 0,
    speed: options.speed ?? 0,
    speedFactor: options.speedFactor ?? 1,
    fuel,
    condition,
    rockets: options.rockets ?? 0,
    boosts: options.boosts ?? 0,
    hasKart: condition > 0,
    turboTicksLeft: 0,
    onFoot: condition <= 0 || fuel <= 0,
    hitWall: false,
    hitSolid: false,
    inDrag: false,
  };
}

/** Topsnelheid nu, gegeven pech, turbo en een lege tank. */
export function topSpeedOf(kart: Kart): number {
  if (!kart.hasKart || kart.fuel <= 0) return KART.footSpeed;
  if (kart.turboTicksLeft > 0) return KART.turboSpeed * kart.speedFactor;
  return KART.maxSpeed * kart.speedFactor;
}

/** Eén simulatiestap van 1 / 60 seconde. */
export function stepKart(kart: Kart, input: KartInput, track: Track): Kart {
  const dt = 1 / TICK_HZ;

  let { x, y, heading, speed, fuel, condition, turboTicksLeft } = kart;
  let hasKart = kart.hasKart;

  // Turbo starten kost een boost; hij loopt daarna vanzelf af.
  let boosts = kart.boosts;
  if (input.turbo && turboTicksLeft <= 0 && boosts > 0 && hasKart && fuel > 0) {
    boosts -= 1;
    turboTicksLeft = KART.turboTicks;
  } else if (turboTicksLeft > 0) {
    turboTicksLeft -= 1;
  }

  const onFoot = !hasKart || fuel <= 0;
  const topSpeed = onFoot
    ? KART.footSpeed
    : (turboTicksLeft > 0 ? KART.turboSpeed : KART.maxSpeed) * kart.speedFactor;

  // Gas gaat vanzelf: de kart trekt op naar zijn topsnelheid tenzij je remt.
  if (input.brake) speed = Math.max(0, speed - KART.brakeAccel * dt);
  else if (speed < topSpeed) speed = Math.min(topSpeed, speed + KART.accel * dt);
  else speed = Math.max(topSpeed, speed - KART.accel * dt);

  // Sturen lukt alleen als je rijdt, en gaat pas vol op snelheid.
  const steerFactor = clamp(speed / KART.fullSteerSpeed, 0, 1);
  heading += clamp(input.steer, -1, 1) * KART.steerRate * steerFactor * dt;

  const moved = speed * dt;
  x += Math.sin(heading) * moved;
  y += Math.cos(heading) * moved;

  // Benzine gaat op afstand, niet op tijd; te voet verbruik je niets.
  if (!onFoot) fuel = Math.max(0, fuel - moved / KART.unitsPerFuel);

  /**
   * Botsingen worden opgelost door langs het oppervlak te schuiven: de snelheid
   * loodrecht erop valt weg, de rest blijft. Zo glijd je langs een steen in
   * plaats van er met gas tegenaan te blijven duwen.
   */
  const slide = (nx: number, ny: number, keep: number): number => {
    const vx = Math.sin(heading) * speed;
    const vy = Math.cos(heading) * speed;
    const into = vx * nx + vy * ny;
    // Rij je al van het oppervlak af, dan valt er niets te corrigeren.
    if (into >= 0) return 0;

    const sx = (vx - into * nx) * keep;
    const sy = (vy - into * ny) * keep;
    const slideSpeed = Math.hypot(sx, sy);

    if (slideSpeed > 1) {
      heading = Math.atan2(sx, sy);
      speed = slideSpeed;
    } else {
      // Recht op de neus geraakt: kies de kant van het oppervlak die vooruit wijst,
      // anders staat de kart er voorgoed tegenaan te drukken.
      const tx = -ny;
      const ty = nx;
      const forward = ty >= 0 ? 1 : -1;
      heading = Math.atan2(tx * forward, ty * forward);
      speed = 0;
    }
    return -into;
  };

  // Rand van de baan: je schuift er langs en verliest vaart.
  let hitWall = false;
  const center = track.centerX(y);
  const edge = track.halfWidth(y);
  if (x < center - edge) {
    x = center - edge;
    hitWall = true;
    if (slide(1, 0, KART.wallSlideKeep) > KART.damageSpeed) condition -= KART.wallDamage;
  } else if (x > center + edge) {
    x = center + edge;
    hitWall = true;
    if (slide(-1, 0, KART.wallSlideKeep) > KART.damageSpeed) condition -= KART.wallDamage;
  }

  // Obstakels: stenen blokkeren, cactussen laten je door maar remmen hard af.
  let hitSolid = false;
  let inDrag = false;
  for (const obstacle of track.obstaclesNear(y, 120)) {
    const dx = x - obstacle.x;
    const dy = y - obstacle.y;
    const reach = obstacle.radius + KART_RADIUS;
    if (dx * dx + dy * dy > reach * reach) continue;

    if (obstacle.kind === 'drag') {
      inDrag = true;
      continue;
    }

    hitSolid = true;
    const distance = Math.hypot(dx, dy) || 1;
    const nx = dx / distance;
    const ny = dy / distance;
    // Zet de kart net buiten de steen en schuif er langs.
    x = obstacle.x + nx * reach;
    y = obstacle.y + ny * reach;
    if (slide(nx, ny, KART.slideKeep) > KART.damageSpeed) condition -= KART.collisionDamage;
  }

  // Een cactusveld is een plafond op je snelheid, geen rem die elke tick opnieuw
  // aangrijpt: zo ploeg je er dwars doorheen in plaats van erin stil te vallen.
  if (inDrag) speed = Math.min(speed, topSpeed * KART.cactusSpeedKeep);

  // Na het uitduwen langs een steen kan de kart buiten de baan zijn geduwd;
  // dat corrigeren we hier, zonder opnieuw schade of snelheidsverlies.
  const finalCenter = track.centerX(y);
  const finalEdge = track.halfWidth(y);
  x = clamp(x, finalCenter - finalEdge, finalCenter + finalEdge);

  condition = clamp(condition, 0, KART.maxCondition);
  if (condition <= 0) hasKart = false;

  return {
    x,
    y,
    heading,
    speed: Math.max(0, speed),
    speedFactor: kart.speedFactor,
    fuel: clamp(fuel, 0, KART.maxFuel),
    condition,
    rockets: kart.rockets,
    boosts,
    hasKart,
    turboTicksLeft,
    onFoot: !hasKart || fuel <= 0,
    hitWall,
    hitSolid,
    inDrag,
  };
}

/** Straal van een kart, voor botsingen. */
export const KART_RADIUS = 18;

/** Een treffer door een raket: kost conditie en kan je de kart kosten. */
export function applyRocketHit(kart: Kart): Kart {
  const condition = clamp(kart.condition - KART.rocketDamage, 0, KART.maxCondition);
  const hasKart = condition > 0 && kart.hasKart;
  return {
    ...kart,
    condition,
    hasKart,
    // Zonder kart val je meteen terug op looptempo.
    speed: hasKart ? kart.speed : Math.min(kart.speed, KART.footSpeed),
    turboTicksLeft: hasKart ? kart.turboTicksLeft : 0,
    onFoot: !hasKart || kart.fuel <= 0,
  };
}

/** Wat één goed beantwoorde som bij de Rekengarage oplevert. */
export type SupplyKind = 'fuel' | 'rocket' | 'boost' | 'repair' | 'kart';

export interface Supply {
  readonly kind: SupplyKind;
  readonly amount: number;
  /** Nederlandse naam, zoals hij op de kaart in het rekenscherm staat. */
  readonly label: string;
}

/** Schrijft een voorraaditem bij op de kart. Puur, net als de rest. */
export function applySupply(kart: Kart, supply: Supply): Kart {
  switch (supply.kind) {
    case 'fuel': {
      const fuel = clamp(kart.fuel + supply.amount, 0, KART.maxFuel);
      return { ...kart, fuel, onFoot: !kart.hasKart || fuel <= 0 };
    }
    case 'rocket':
      return { ...kart, rockets: kart.rockets + supply.amount };
    case 'boost':
      return { ...kart, boosts: kart.boosts + supply.amount };
    case 'repair': {
      const condition = clamp(kart.condition + supply.amount, 0, KART.maxCondition);
      // Oplappen geeft je de kart niet terug; daarvoor moet je naar een finishstation.
      return { ...kart, condition };
    }
    case 'kart': {
      const condition = Math.max(kart.condition, KART.maxCondition);
      return { ...kart, hasKart: true, condition, onFoot: kart.fuel <= 0 };
    }
  }
}
