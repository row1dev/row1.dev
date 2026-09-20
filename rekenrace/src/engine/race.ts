/**
 * De race-simulatie. Draait op een vaste timestep van 60 Hz en raakt geen DOM aan:
 * volledig headless draaibaar en testbaar.
 */

import { CIRCUIT_DISTANCE, OPPONENTS, RACE, SPEED_FACTOR, STREAK, TICK_HZ, UI } from '../config.ts';
import { createDifficulty, recordAttempt, type DifficultyState } from './difficulty.ts';
import { clamp } from './math.ts';
import { createQuestionSource, type Circuit, type Level, type Question, type QuestionSource } from './questions.ts';
import { createRng } from './rng.ts';

export type RacePhase = 'running' | 'reveal' | 'finished';

export interface Racer {
  readonly id: string;
  readonly name: string;
  readonly isPlayer: boolean;
  /**
   * Vaste baan van deze racer, van 0 tot en met het aantal racers - 1.
   * Anders dan `position` verandert dit nooit, zodat de renderlaag en de HUD
   * per racer een vaste rijstrook en kleur kunnen aanhouden.
   */
  readonly lane: number;
  /** Afgelegde afstand in baan-eenheden. */
  readonly distance: number;
  /** Tick waarop deze racer over de finish kwam, of null zolang dat niet zo is. */
  readonly finishTick: number | null;
  /** Plaats in het veld, 1 is voorop. */
  readonly position: number;
}

export interface AnswerOutcome {
  readonly correct: boolean;
  readonly question: Question;
  readonly given: number;
  readonly reactionSeconds: number;
  /** clamp(1.6 - reactietijd / 5, 0.4, 1.6) */
  readonly speedFactor: number;
  /** True als dit antwoord de turbo aanzette. */
  readonly turbo: boolean;
  readonly streak: number;
}

export interface SlowestQuestion {
  readonly question: Question;
  readonly seconds: number;
}

export interface RaceStats {
  readonly asked: number;
  readonly correct: number;
  /** Fractie tussen 0 en 1; 1 zolang er nog niets beantwoord is. */
  readonly accuracy: number;
  readonly averageReaction: number;
  readonly slowest: SlowestQuestion | null;
}

export interface RaceResult {
  readonly position: number;
  readonly racers: readonly Racer[];
  readonly seconds: number;
  readonly stats: RaceStats;
  /** True als de race op de tijdslimiet stuk liep in plaats van op de finish. */
  readonly timedOut: boolean;
}

export interface RaceView {
  readonly tick: number;
  readonly seconds: number;
  readonly phase: RacePhase;
  readonly circuit: Circuit;
  readonly distance: number;
  readonly racers: readonly Racer[];
  readonly player: Racer;
  /** De som in beeld. Tijdens 'reveal' is dit de som die net fout ging. */
  readonly question: Question;
  /** Hoe lang de huidige som al in beeld staat; dit is de reactietijd bij antwoorden. */
  readonly questionSeconds: number;
  readonly level: Level;
  readonly speed: number;
  readonly streak: number;
  readonly turboTicksLeft: number;
  readonly penaltyTicksLeft: number;
  /** Ticks dat het juiste antwoord nog in beeld staat na een fout. */
  readonly revealTicksLeft: number;
  readonly stats: RaceStats;
  readonly result: RaceResult | null;
}

export interface RaceOptions {
  readonly seed: number | string;
  readonly circuit: Circuit;
  /** Aantal tegenstanders, 1 tot 3. */
  readonly opponentCount: number;
  /** Overschrijft de afstand van het circuit; vooral handig in tests. */
  readonly distance?: number;
  readonly startLevel?: Level;
}

export interface Race {
  /** Eén simulatiestap van 1 / 60 seconde. */
  tick(): void;
  /** Verwerkt een ingetypt antwoord. Geeft null als er op dit moment niets te beantwoorden valt. */
  answer(value: number): AnswerOutcome | null;
  /** Momentopname van de hele state, alleen om te lezen. */
  view(): RaceView;
}

const REVEAL_TICKS = Math.round((UI.revealMs / 1000) * TICK_HZ);

/** clamp(1.6 - reactietijd / 5, 0.4, 1.6): snel antwoorden loont. */
export function speedFactorFor(reactionSeconds: number): number {
  return clamp(SPEED_FACTOR.base - reactionSeconds / SPEED_FACTOR.divisor, SPEED_FACTOR.min, SPEED_FACTOR.max);
}

interface OpponentState {
  id: string;
  name: string;
  pace: number;
  phase: number;
  distance: number;
  finishTick: number | null;
}

const OPPONENT_NAMES = ['Haas', 'Vos', 'Egel'] as const;

export function createRace(options: RaceOptions): Race {
  const distance = options.distance ?? CIRCUIT_DISTANCE[options.circuit] ?? RACE.distance;
  const count = clamp(Math.round(options.opponentCount), OPPONENTS.minCount, OPPONENTS.maxCount);
  const rng = createRng(`${String(options.seed)}:race`);
  const source: QuestionSource = createQuestionSource(`${String(options.seed)}:questions`, options.circuit);

  let difficulty: DifficultyState = createDifficulty(options.startLevel ?? undefined);
  let question: Question = source.next(difficulty.level);

  let tickCount = 0;
  let phase: RacePhase = 'running';
  let speed: number = RACE.vBase;
  let playerDistance = 0;
  let playerFinishTick: number | null = null;
  let penaltyTicksLeft = 0;
  let turboTicksLeft = 0;
  let revealTicksLeft = 0;
  let streak = 0;
  /** Ticks sinds de huidige som in beeld kwam; hieruit volgt de reactietijd. */
  let ticksOnQuestion = 0;

  let asked = 0;
  let correct = 0;
  let reactionTotal = 0;
  let slowest: SlowestQuestion | null = null;
  let result: RaceResult | null = null;

  const opponents: OpponentState[] = Array.from({ length: count }, (_, i) => ({
    id: `opponent-${i + 1}`,
    name: OPPONENT_NAMES[i] ?? `Tegenstander ${i + 1}`,
    pace: OPPONENTS.pace[i] ?? OPPONENTS.pace[OPPONENTS.pace.length - 1]!,
    // Eigen fase, zodat de tegenstanders niet in de pas lopen.
    phase: rng.next() * Math.PI * 2,
    distance: 0,
    finishTick: null,
  }));

  const statsView = (): RaceStats => ({
    asked,
    correct,
    accuracy: asked === 0 ? 1 : correct / asked,
    averageReaction: asked === 0 ? 0 : reactionTotal / asked,
    slowest,
  });

  /**
   * Rangschikt het veld: wie gefinisht is staat voorop op finishtijd,
   * de rest daarachter op afgelegde afstand.
   */
  const rankRacers = (): Racer[] => {
    const entries = [
      // De speler rijdt altijd in de voorste baan, de tegenstanders daarachter.
      {
        id: 'player',
        name: 'Blue Dog',
        isPlayer: true,
        lane: opponents.length,
        distance: playerDistance,
        finishTick: playerFinishTick,
      },
      ...opponents.map((o, i) => ({
        id: o.id,
        name: o.name,
        isPlayer: false,
        lane: i,
        distance: o.distance,
        finishTick: o.finishTick,
      })),
    ];
    entries.sort((a, b) => {
      if (a.finishTick !== null && b.finishTick !== null) return a.finishTick - b.finishTick;
      if (a.finishTick !== null) return -1;
      if (b.finishTick !== null) return 1;
      return b.distance - a.distance;
    });
    return entries.map((e, i) => ({ ...e, position: i + 1 }));
  };

  const finish = (timedOut: boolean): void => {
    phase = 'finished';
    const racers = rankRacers();
    const player = racers.find((r) => r.isPlayer)!;
    result = {
      position: player.position,
      racers,
      seconds: tickCount / TICK_HZ,
      stats: statsView(),
      timedOut,
    };
  };

  const advancePlayer = (): void => {
    if (turboTicksLeft > 0) {
      speed = RACE.vMax;
      turboTicksLeft -= 1;
    } else if (penaltyTicksLeft > 0) {
      speed = RACE.vBase * RACE.penaltyFactor;
      penaltyTicksLeft -= 1;
    } else {
      // Terug naar vBase met de drag-factor, per tick.
      speed = RACE.vBase + (speed - RACE.vBase) * RACE.drag;
    }
    speed = clamp(speed, 0, RACE.vMax);
    playerDistance += speed / TICK_HZ;
    if (playerDistance >= distance) {
      playerDistance = distance;
      playerFinishTick = tickCount;
    }
  };

  const advanceOpponents = (): void => {
    for (const o of opponents) {
      if (o.finishTick !== null) continue;
      const wobble = OPPONENTS.paceWobble * Math.sin((tickCount / OPPONENTS.wobbleTicks) * Math.PI * 2 + o.phase);
      o.distance += Math.max(0, o.pace + wobble) / TICK_HZ;
      if (o.distance >= distance) {
        o.distance = distance;
        o.finishTick = tickCount;
      }
    }
  };

  const nextQuestion = (): void => {
    question = source.next(difficulty.level);
    ticksOnQuestion = 0;
  };

  const tick = (): void => {
    if (phase === 'finished') return;

    tickCount += 1;
    advancePlayer();
    advanceOpponents();

    if (phase === 'reveal') {
      revealTicksLeft -= 1;
      if (revealTicksLeft <= 0) {
        revealTicksLeft = 0;
        phase = 'running';
        nextQuestion();
      }
    } else {
      ticksOnQuestion += 1;
    }

    if (playerFinishTick !== null) {
      finish(false);
      return;
    }
    if (tickCount >= RACE.maxTicks) finish(true);
  };

  const answer = (value: number): AnswerOutcome | null => {
    if (phase !== 'running') return null;

    const reactionSeconds = ticksOnQuestion / TICK_HZ;
    const isCorrect = value === question.answer;
    const speedFactor = speedFactorFor(reactionSeconds);

    asked += 1;
    reactionTotal += reactionSeconds;
    if (isCorrect) correct += 1;
    if (slowest === null || reactionSeconds > slowest.seconds) {
      slowest = { question, seconds: reactionSeconds };
    }
    difficulty = recordAttempt(difficulty, { correct: isCorrect, reactionSeconds });

    let turbo = false;
    if (isCorrect) {
      streak += 1;
      penaltyTicksLeft = 0;
      speed = clamp(speed + RACE.vBoost * speedFactor, 0, RACE.vMax);
      if (streak % STREAK.threshold === 0) {
        turbo = true;
        turboTicksLeft = STREAK.ticks;
      }
      nextQuestion();
    } else {
      streak = 0;
      turboTicksLeft = 0;
      speed = RACE.vBase * RACE.penaltyFactor;
      penaltyTicksLeft = RACE.penaltyTicks;
      // Het juiste antwoord blijft even staan voordat de volgende som komt.
      phase = 'reveal';
      revealTicksLeft = REVEAL_TICKS;
    }

    return { correct: isCorrect, question, given: value, reactionSeconds, speedFactor, turbo, streak };
  };

  const view = (): RaceView => {
    const racers = rankRacers();
    return {
      tick: tickCount,
      seconds: tickCount / TICK_HZ,
      phase,
      circuit: options.circuit,
      distance,
      racers,
      player: racers.find((r) => r.isPlayer)!,
      question,
      questionSeconds: ticksOnQuestion / TICK_HZ,
      level: difficulty.level,
      speed,
      streak,
      turboTicksLeft,
      penaltyTicksLeft,
      revealTicksLeft,
      stats: statsView(),
      result,
    };
  };

  return { tick, answer, view };
}
