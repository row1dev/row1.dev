/**
 * De race: bindt baan, karts, garage, tegenstanders en raketten samen.
 * Vaste timestep van 60 Hz, puur headless — geen DOM, geen requestAnimationFrame.
 *
 * Belangrijk: de race loopt door terwijl je in de garage staat. Elke extra som
 * levert voorraad op maar kost baanpositie, en dat is precies de afweging.
 */

import { RACE, TICK_HZ } from '../config.ts';
import { createDifficulty, recordAttempt, type DifficultyState } from './difficulty.ts';
import { answerGarage, openGarage, tickGarage, type GarageAnswer, type GarageContext, type GarageSession } from './garage.ts';
import { applyRocketHit, applySupply, createKart, stepKart, type Kart, type KartInput } from './kart.ts';
import { createQuestionSource, type Circuit, type Level, type Question } from './questions.ts';
import { createRng } from './rng.ts';
import { rivalProfiles, stepRival, wantsToFire, type RivalProfile } from './opponent.ts';
import { fireRocket, stepRockets, type Rocket, type RocketTarget } from './rocket.ts';
import { createTrack, type Garage, type Track } from './track.ts';

export type RacePhase = 'countdown' | 'racing' | 'garage' | 'finished';

export interface RaceInput extends KartInput {
  /** Vuurt een mini-raket af, als er een op voorraad is. */
  readonly fire: boolean;
}

export const NO_RACE_INPUT: RaceInput = { steer: 0, brake: false, turbo: false, fire: false };

export interface Racer {
  readonly id: string;
  readonly name: string;
  readonly isPlayer: boolean;
  readonly kart: Kart;
  /** Plaats in het veld, 1 is voorop. */
  readonly position: number;
  readonly finishTick: number | null;
}

export interface SlowestQuestion {
  readonly question: Question;
  readonly seconds: number;
}

export interface RaceStats {
  readonly asked: number;
  readonly correct: number;
  readonly accuracy: number;
  readonly averageReaction: number;
  readonly slowest: SlowestQuestion | null;
  /** Hoeveel tijd je in totaal in de garages hebt gestaan. */
  readonly garageSeconds: number;
}

export interface RaceResult {
  readonly position: number;
  readonly racers: readonly Racer[];
  readonly seconds: number;
  readonly stats: RaceStats;
  readonly timedOut: boolean;
}

export interface RaceView {
  readonly tick: number;
  readonly seconds: number;
  readonly phase: RacePhase;
  readonly circuit: Circuit;
  readonly track: Track;
  readonly player: Racer;
  readonly racers: readonly Racer[];
  readonly rockets: readonly Rocket[];
  /** De garage waar je nu in staat, of null. */
  readonly garage: GarageSession | null;
  readonly level: Level;
  readonly stats: RaceStats;
  readonly result: RaceResult | null;
  /** Aantal brandende lampen in het startsein; het laatste is groen. */
  readonly lightsLit: number;
}

export interface RaceOptions {
  readonly seed: number | string;
  readonly circuit: Circuit;
  /** Aantal tegenstanders, 1 tot 3. */
  readonly rivalCount: number;
  readonly startLevel?: Level;
  readonly trackLength?: number;
}

export interface Race {
  tick(input: RaceInput): void;
  /** Beantwoordt de som in de garage. Geeft null als je er niet in staat. */
  answer(value: number): GarageAnswer | null;
  /** Rijdt de garage weer uit. */
  leaveGarage(): void;
  view(): RaceView;
}

/** Duur van het startsein: drie rode lampen en dan groen. */
const COUNTDOWN_TICKS = TICK_HZ * 3;
const LIGHT_TICKS = COUNTDOWN_TICKS / 4;

interface RivalState {
  readonly profile: RivalProfile;
  kart: Kart;
  finishTick: number | null;
  /** Ticks die hij nog stilstaat bij een garage. */
  pauseTicksLeft: number;
  /** De eerstvolgende garage waar hij nog moet stoppen. */
  nextGarage: number;
}

export function createRace(options: RaceOptions): Race {
  const seed = String(options.seed);
  const track = createTrack({ seed, ...(options.trackLength === undefined ? {} : { length: options.trackLength }) });
  const rng = createRng(`${seed}:race`);
  const source = createQuestionSource(`${seed}:questions`, options.circuit);

  let difficulty: DifficultyState = createDifficulty(options.startLevel ?? undefined);
  const ctx: GarageContext = {
    rng,
    level: () => difficulty.level,
    nextQuestion: (level) => source.next(level),
  };

  let tickCount = 0;
  let phase: RacePhase = 'countdown';
  let player = createKart({ x: track.centerX(0), y: 0 });
  let playerFinishTick: number | null = null;

  const profiles = rivalProfiles(options.rivalCount);
  const rivals: RivalState[] = profiles.map((profile, index) => ({
    profile,
    // Naast elkaar op de startgrid, elk in zijn eigen strook.
    kart: createKart({
      // Om en om links en rechts van de speler, die zelf in het midden staat.
      x: track.centerX(0) + (index % 2 === 0 ? -1 : 1) * (Math.floor(index / 2) + 1) * 95,
      y: 0,
      speedFactor: profile.speedFactor,
      // Ze tanken en bewapenen zich buiten beeld: ze stoppen immers nooit.
      rockets: Number.MAX_SAFE_INTEGER,
    }),
    finishTick: null,
    pauseTicksLeft: 0,
    nextGarage: 0,
  }));

  let rockets: Rocket[] = [];
  let nextRocketId = 1;

  let garage: GarageSession | null = null;
  /** De garage die je net verlaten hebt, zodat je er niet meteen weer in rolt. */
  let leftGarageId: string | null = null;
  let garageTicks = 0;

  let asked = 0;
  let correct = 0;
  let reactionTotal = 0;
  let slowest: SlowestQuestion | null = null;
  let result: RaceResult | null = null;

  const statsView = (): RaceStats => ({
    asked,
    correct,
    accuracy: asked === 0 ? 1 : correct / asked,
    averageReaction: asked === 0 ? 0 : reactionTotal / asked,
    slowest,
    garageSeconds: garageTicks / TICK_HZ,
  });

  const rankRacers = (): Racer[] => {
    const entries = [
      { id: 'player', name: 'Blue Dog', isPlayer: true, kart: player, finishTick: playerFinishTick },
      ...rivals.map((rival) => ({
        id: rival.profile.id,
        name: rival.profile.name,
        isPlayer: false,
        kart: rival.kart,
        finishTick: rival.finishTick,
      })),
    ];
    entries.sort((a, b) => {
      if (a.finishTick !== null && b.finishTick !== null) return a.finishTick - b.finishTick;
      if (a.finishTick !== null) return -1;
      if (b.finishTick !== null) return 1;
      return b.kart.y - a.kart.y;
    });
    return entries.map((entry, index) => ({ ...entry, position: index + 1 }));
  };

  const finish = (timedOut: boolean): void => {
    phase = 'finished';
    const racers = rankRacers();
    result = {
      position: racers.find((racer) => racer.isPlayer)!.position,
      racers,
      seconds: tickCount / TICK_HZ,
      stats: statsView(),
      timedOut,
    };
  };

  const targets = (): RocketTarget[] => [
    { id: 'player', kart: player },
    ...rivals.map((rival) => ({ id: rival.profile.id, kart: rival.kart })),
  ];

  const damage = (id: string): void => {
    if (id === 'player') {
      player = applyRocketHit(player);
      return;
    }
    const rival = rivals.find((candidate) => candidate.profile.id === id);
    if (rival !== undefined) rival.kart = applyRocketHit(rival.kart);
  };

  /** Beweegt de tegenstanders en de raketten. Gebeurt ook terwijl je in de garage staat. */
  const advanceWorld = (): void => {
    for (const rival of rivals) {
      if (rival.finishTick !== null) continue;

      // Staat hij te tanken, dan staat hij ook echt stil.
      if (rival.pauseTicksLeft > 0) {
        rival.pauseTicksLeft -= 1;
        rival.kart = { ...rival.kart, speed: 0 };
        continue;
      }

      // Bij elke garage stopt hij een vaste tijd om bij te tanken.
      const stop = track.garages[rival.nextGarage];
      if (stop !== undefined && rival.kart.y >= stop.y) {
        rival.nextGarage += 1;
        rival.pauseTicksLeft = rival.profile.garagePauseTicks;
        rival.kart = { ...rival.kart, speed: 0 };
        continue;
      }

      rival.kart = stepRival(rival.kart, track, rival.profile);
      if (rival.kart.y >= track.length) rival.finishTick = tickCount;

      if (wantsToFire(rival.kart, player, rival.profile, tickCount)) {
        const rocket = fireRocket(nextRocketId, rival.profile.id, rival.kart);
        if (rocket !== null) {
          rockets.push(rocket);
          nextRocketId += 1;
        }
      }
    }

    const step = stepRockets(rockets, targets());
    rockets = [...step.rockets];
    for (const hit of step.hits) damage(hit.targetId);
  };

  const enterGarageIfInside = (): void => {
    const found: Garage | null = track.garageAt(player.x, player.y);
    if (found === null) {
      // Pas als je de voetafdruk uit bent mag je er weer in.
      leftGarageId = null;
      return;
    }
    if (found.id === leftGarageId) return;

    garage = openGarage(found, player, ctx);
    phase = 'garage';
    // De kart staat stil zolang je binnen bent.
    player = { ...player, speed: 0 };
  };

  const tick = (input: RaceInput): void => {
    if (phase === 'finished') return;
    tickCount += 1;

    if (phase === 'countdown') {
      // Voor groen beweegt er niets; het veld staat aan de start.
      if (tickCount >= COUNTDOWN_TICKS) phase = 'racing';
      return;
    }

    advanceWorld();

    if (phase === 'garage' && garage !== null) {
      garageTicks += 1;
      garage = tickGarage(garage, player, ctx);
    } else {
      player = stepKart(player, input, track);

      if (input.fire && player.rockets > 0) {
        const rocket = fireRocket(nextRocketId, 'player', player);
        if (rocket !== null) {
          rockets.push(rocket);
          nextRocketId += 1;
          player = { ...player, rockets: player.rockets - 1 };
        }
      }

      if (player.y >= track.length) {
        player = { ...player, y: track.length };
        playerFinishTick = tickCount;
      } else {
        enterGarageIfInside();
      }
    }

    if (playerFinishTick !== null) {
      finish(false);
      return;
    }
    if (tickCount >= RACE.maxTicks) finish(true);
  };

  const answer = (value: number): GarageAnswer | null => {
    if (phase !== 'garage' || garage === null) return null;

    const outcome = answerGarage(garage, value, player, ctx);
    if (outcome.session === garage) return null;

    garage = outcome.session;
    asked += 1;
    reactionTotal += outcome.reactionSeconds;
    if (outcome.correct) correct += 1;
    if (slowest === null || outcome.reactionSeconds > slowest.seconds) {
      slowest = { question: outcome.session.question, seconds: outcome.reactionSeconds };
    }
    difficulty = recordAttempt(difficulty, {
      correct: outcome.correct,
      reactionSeconds: outcome.reactionSeconds,
    });

    if (outcome.earned !== null) player = applySupply(player, outcome.earned);
    return outcome;
  };

  const leaveGarage = (): void => {
    if (phase !== 'garage' || garage === null) return;
    leftGarageId = garage.garage.id;
    garage = null;
    phase = 'racing';
  };

  const view = (): RaceView => {
    const racers = rankRacers();
    return {
      tick: tickCount,
      seconds: tickCount / TICK_HZ,
      phase,
      circuit: options.circuit,
      track,
      player: racers.find((racer) => racer.isPlayer)!,
      racers,
      rockets,
      garage,
      level: difficulty.level,
      stats: statsView(),
      result,
      lightsLit: phase === 'countdown' ? Math.min(4, Math.floor(tickCount / LIGHT_TICKS) + 1) : 4,
    };
  };

  return { tick, answer, leaveGarage, view };
}

