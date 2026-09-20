/**
 * De Rekengarage: je rijdt naar binnen, beantwoordt sommen, en elke goede som
 * levert één voorraaditem op. Puur en headless, net als de rest van engine/.
 *
 * De race loopt buiten gewoon door, dus elke extra som kost je baanpositie.
 * Dat is de hele afweging: blijven tanken of wegwezen.
 */

import { GARAGE, TICK_HZ, UI } from '../config.ts';
import type { Kart, Supply } from './kart.ts';
import type { Level, Question } from './questions.ts';
import type { Rng } from './rng.ts';
import type { Garage } from './track.ts';
import { clamp } from './math.ts';

export type GaragePhase = 'asking' | 'reveal';

export interface GarageSession {
  readonly garage: Garage;
  /** De som in beeld. Tijdens 'reveal' is dit de som die net fout ging. */
  readonly question: Question;
  /** Wat deze som oplevert als je hem goed hebt. */
  readonly reward: Supply;
  readonly phase: GaragePhase;
  /** Oplopende teller, zoals "Aantal sommen" in het ontwerp. */
  readonly answered: number;
  readonly correct: number;
  readonly questionTicks: number;
  readonly revealTicksLeft: number;
}

/** Alles wat de garage van buiten nodig heeft, zodat hij zelf niets hoeft te weten. */
export interface GarageContext {
  /** Volgende som op het gevraagde niveau. */
  nextQuestion(level: Level): Question;
  /** Huidig niveau uit de adaptieve moeilijkheid. */
  level(): Level;
  readonly rng: Rng;
}

const REVEAL_TICKS = Math.round((UI.revealMs / 1000) * TICK_HZ);

const LABELS: Readonly<Record<Supply['kind'], string>> = {
  fuel: 'Benzine',
  rocket: 'Mini-raket',
  boost: 'Turbo',
  repair: 'Reparatie',
  kart: 'Nieuwe kart',
};

function supply(kind: Supply['kind'], amount: number): Supply {
  return { kind, amount, label: LABELS[kind] };
}

/**
 * Kiest wat de volgende som oplevert. Waar je het krapst in zit gaat voor:
 * een lege tank levert benzine, een gedeukte kart een reparatie. Heb je van
 * alles genoeg, dan wisselt het tussen benzine, raketten en turbo's.
 */
export function chooseSupply(kart: Kart, garage: Garage, rng: Rng): Supply {
  // Je kart terugwinnen kan alleen bij een finishstation, en gaat voor alles.
  if (!kart.hasKart && garage.kind === 'finish') return supply('kart', 1);

  if (kart.fuel <= GARAGE.lowFuel) return supply('fuel', pickFuelAmount(rng));
  if (kart.hasKart && kart.condition <= GARAGE.lowCondition) return supply('repair', GARAGE.repairAmount);

  const total = GARAGE.weights.fuel + GARAGE.weights.rocket + GARAGE.weights.boost;
  const roll = rng.int(1, total);
  if (roll <= GARAGE.weights.fuel) return supply('fuel', pickFuelAmount(rng));
  if (roll <= GARAGE.weights.fuel + GARAGE.weights.rocket) return supply('rocket', GARAGE.rocketAmount);
  return supply('boost', GARAGE.boostAmount);
}

function pickFuelAmount(rng: Rng): number {
  return rng.pick(GARAGE.fuelAmounts);
}

/** Het niveau waarop een som voor dit item gesteld wordt. */
export function levelFor(reward: Supply, level: Level): Level {
  // Je kart terugverdienen kost iets moeilijkere sommen.
  if (reward.kind !== 'kart') return level;
  return clamp(level + GARAGE.kartLevelBump, 1, 5) as Level;
}

/** Je rijdt de garage binnen: eerste som en eerste beloning staan klaar. */
export function openGarage(garage: Garage, kart: Kart, ctx: GarageContext): GarageSession {
  const reward = chooseSupply(kart, garage, ctx.rng);
  return {
    garage,
    reward,
    question: ctx.nextQuestion(levelFor(reward, ctx.level())),
    phase: 'asking',
    answered: 0,
    correct: 0,
    questionTicks: 0,
    revealTicksLeft: 0,
  };
}

export interface GarageAnswer {
  readonly session: GarageSession;
  readonly correct: boolean;
  readonly reactionSeconds: number;
  /** Wat je verdiend hebt, of null bij een fout antwoord. */
  readonly earned: Supply | null;
}

/**
 * Verwerkt een ingetypt antwoord. Bij goed komt de volgende som meteen; bij fout
 * blijft het juiste antwoord even staan, precies zoals in het racescherm.
 */
export function answerGarage(session: GarageSession, value: number, kart: Kart, ctx: GarageContext): GarageAnswer {
  if (session.phase !== 'asking') {
    return { session, correct: false, reactionSeconds: 0, earned: null };
  }

  const reactionSeconds = session.questionTicks / TICK_HZ;
  const correct = value === session.question.answer;

  if (!correct) {
    return {
      session: {
        ...session,
        phase: 'reveal',
        answered: session.answered + 1,
        revealTicksLeft: REVEAL_TICKS,
      },
      correct: false,
      reactionSeconds,
      earned: null,
    };
  }

  // De verdiende voorraad telt mee voor de keuze van de volgende beloning.
  const earned = session.reward;
  const nextReward = chooseSupply(kart, session.garage, ctx.rng);
  return {
    session: {
      ...session,
      reward: nextReward,
      question: ctx.nextQuestion(levelFor(nextReward, ctx.level())),
      phase: 'asking',
      answered: session.answered + 1,
      correct: session.correct + 1,
      questionTicks: 0,
      revealTicksLeft: 0,
    },
    correct: true,
    reactionSeconds,
    earned,
  };
}

/**
 * Eén tick in de garage. Telt de reactietijd mee en haalt na een fout antwoord
 * de volgende som tevoorschijn zodra het juiste antwoord lang genoeg stond.
 */
export function tickGarage(session: GarageSession, kart: Kart, ctx: GarageContext): GarageSession {
  if (session.phase === 'asking') {
    return { ...session, questionTicks: session.questionTicks + 1 };
  }

  const revealTicksLeft = session.revealTicksLeft - 1;
  if (revealTicksLeft > 0) return { ...session, revealTicksLeft };

  const reward = chooseSupply(kart, session.garage, ctx.rng);
  return {
    ...session,
    reward,
    question: ctx.nextQuestion(levelFor(reward, ctx.level())),
    phase: 'asking',
    questionTicks: 0,
    revealTicksLeft: 0,
  };
}
