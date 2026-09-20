import { describe, expect, it } from 'vitest';
import { CIRCUIT_DISTANCE, RACE, STREAK, TICK_HZ, UI } from '../src/config.ts';
import { CIRCUITS } from '../src/engine/questions.ts';
import { createRace, speedFactorFor, type RaceResult, type RaceView } from '../src/engine/race.ts';

type Behaviour = 'always-right' | 'always-wrong' | 'never-answers';

interface RunOptions {
  readonly behaviour: Behaviour;
  /** Seconden die de bot over elke som doet. */
  readonly thinkSeconds?: number;
  readonly opponentCount?: number;
  readonly seed?: string;
  readonly circuit?: (typeof CIRCUITS)[number];
}

interface RunOutcome {
  readonly result: RaceResult;
  readonly ticks: number;
  readonly maxSpeed: number;
  readonly views: readonly RaceView[];
}

/** Draait een hele race headless met een bot die zich volgens `behaviour` gedraagt. */
function run(options: RunOptions): RunOutcome {
  const race = createRace({
    seed: options.seed ?? 'test-seed',
    circuit: options.circuit ?? 'tables',
    opponentCount: options.opponentCount ?? 1,
  });
  const thinkSeconds = options.thinkSeconds ?? 1;
  const views: RaceView[] = [];
  let ticks = 0;
  let maxSpeed = 0;

  // Ruime bovengrens: de test wil juist bewijzen dat de race hier ruim onder blijft.
  const hardLimit = RACE.maxTicks + 10;
  for (;;) {
    const view = race.view();
    views.push(view);
    maxSpeed = Math.max(maxSpeed, view.speed);
    if (view.phase === 'finished' || ticks >= hardLimit) break;

    if (options.behaviour !== 'never-answers' && view.phase === 'running' && view.questionSeconds >= thinkSeconds) {
      const given = options.behaviour === 'always-right' ? view.question.answer : view.question.answer + 1;
      race.answer(given);
    }
    race.tick();
    ticks += 1;
  }

  const result = race.view().result;
  if (result === null) throw new Error('de race eindigde niet');
  return { result, ticks, maxSpeed, views };
}

describe('speedFactorFor', () => {
  it('beloont snel antwoorden en klemt tussen 0,4 en 1,6', () => {
    expect(speedFactorFor(0)).toBeCloseTo(1.6);
    expect(speedFactorFor(3)).toBeCloseTo(1.0);
    expect(speedFactorFor(100)).toBeCloseTo(0.4);
    expect(speedFactorFor(1)).toBeGreaterThan(speedFactorFor(4));
  });
});

describe('race, opzet', () => {
  it('start op vBase met een som in beeld en nog geen uitslag', () => {
    const view = createRace({ seed: 's', circuit: 'tables', opponentCount: 2 }).view();
    expect(view.tick).toBe(0);
    expect(view.phase).toBe('running');
    expect(view.speed).toBeCloseTo(RACE.vBase);
    expect(view.racers).toHaveLength(3);
    expect(view.result).toBeNull();
  });

  it('klemt het aantal tegenstanders op 1 tot en met 3', () => {
    expect(createRace({ seed: 's', circuit: 'tables', opponentCount: 0 }).view().racers).toHaveLength(2);
    expect(createRace({ seed: 's', circuit: 'tables', opponentCount: 9 }).view().racers).toHaveLength(4);
  });

  it('is deterministisch bij dezelfde seed', () => {
    const a = run({ behaviour: 'always-right', seed: 'gelijk' });
    const b = run({ behaviour: 'always-right', seed: 'gelijk' });
    expect(a.ticks).toBe(b.ticks);
    expect(a.result.position).toBe(b.result.position);
    expect(a.result.stats).toEqual(b.result.stats);
  });
});

describe('race, snelheidsmodel', () => {
  it('overschrijdt nooit vMax, ook niet met turbo en snelle antwoorden', () => {
    for (const circuit of CIRCUITS) {
      const { views, maxSpeed } = run({ behaviour: 'always-right', thinkSeconds: 0, circuit, opponentCount: 3 });
      expect(maxSpeed).toBeLessThanOrEqual(RACE.vMax + 1e-9);
      for (const v of views) expect(v.speed).toBeGreaterThanOrEqual(0);
    }
  });

  it('zakt bij een fout antwoord terug naar vBase * 0.4 voor zestig ticks', () => {
    const race = createRace({ seed: 'straf', circuit: 'tables', opponentCount: 1 });
    for (let i = 0; i < 30; i += 1) race.tick();
    race.answer(race.view().question.answer + 1);
    race.tick();

    expect(race.view().speed).toBeCloseTo(RACE.vBase * RACE.penaltyFactor);
    // Nog binnen de strafperiode.
    for (let i = 1; i < RACE.penaltyTicks; i += 1) race.tick();
    expect(race.view().speed).toBeCloseTo(RACE.vBase * RACE.penaltyFactor);
    // Daarna kruipt hij terug naar vBase.
    race.tick();
    expect(race.view().speed).toBeGreaterThan(RACE.vBase * RACE.penaltyFactor);
  });

  it('geeft een boost bij een goed antwoord die daarna terugzakt naar vBase', () => {
    const race = createRace({ seed: 'boost', circuit: 'tables', opponentCount: 1 });
    race.answer(race.view().question.answer);
    const boosted = race.view().speed;
    expect(boosted).toBeGreaterThan(RACE.vBase);

    for (let i = 0; i < 600; i += 1) race.tick();
    expect(race.view().speed).toBeCloseTo(RACE.vBase, 1);
  });

  it('zet turbo aan bij vijf goede antwoorden op rij', () => {
    const race = createRace({ seed: 'turbo', circuit: 'tables', opponentCount: 1 });
    for (let i = 0; i < STREAK.threshold - 1; i += 1) {
      expect(race.answer(race.view().question.answer)?.turbo).toBe(false);
      race.tick();
    }
    const outcome = race.answer(race.view().question.answer);
    expect(outcome?.turbo).toBe(true);
    expect(outcome?.streak).toBe(STREAK.threshold);
    expect(race.view().turboTicksLeft).toBe(STREAK.ticks);

    race.tick();
    expect(race.view().speed).toBeCloseTo(RACE.vMax);
  });

  it('reset de streak en de turbo bij een fout antwoord', () => {
    const race = createRace({ seed: 'reset', circuit: 'tables', opponentCount: 1 });
    for (let i = 0; i < STREAK.threshold; i += 1) {
      race.answer(race.view().question.answer);
      race.tick();
    }
    expect(race.view().turboTicksLeft).toBeGreaterThan(0);

    race.answer(race.view().question.answer + 1);
    expect(race.view().streak).toBe(0);
    expect(race.view().turboTicksLeft).toBe(0);
  });
});

describe('race, sommen en feedback', () => {
  it('toont na een fout antwoord het juiste antwoord voor ongeveer 800 ms', () => {
    const race = createRace({ seed: 'reveal', circuit: 'tables', opponentCount: 1 });
    const wrongQuestion = race.view().question;
    race.answer(wrongQuestion.answer + 1);

    expect(race.view().phase).toBe('reveal');
    expect(race.view().question).toEqual(wrongQuestion);
    // Tijdens de reveal neemt de engine geen antwoorden aan.
    expect(race.answer(wrongQuestion.answer)).toBeNull();

    const revealTicks = Math.round((UI.revealMs / 1000) * TICK_HZ);
    for (let i = 0; i < revealTicks; i += 1) race.tick();
    expect(race.view().phase).toBe('running');
    expect(race.view().question).not.toEqual(wrongQuestion);
  });

  it('geeft bij een goed antwoord direct de volgende som', () => {
    const race = createRace({ seed: 'volgende', circuit: 'tables', opponentCount: 1 });
    const first = race.view().question;
    race.answer(first.answer);
    expect(race.view().phase).toBe('running');
    expect(race.view().question).not.toEqual(first);
    expect(race.view().questionSeconds).toBe(0);
  });

  it('leidt de reactietijd af uit de ticks sinds de som verscheen', () => {
    const race = createRace({ seed: 'reactie', circuit: 'tables', opponentCount: 1 });
    for (let i = 0; i < 90; i += 1) race.tick();
    const outcome = race.answer(race.view().question.answer);
    expect(outcome?.reactionSeconds).toBeCloseTo(1.5);
    expect(outcome?.speedFactor).toBeCloseTo(speedFactorFor(1.5));
  });

  it('houdt statistieken bij voor het resultaatscherm', () => {
    const { result } = run({ behaviour: 'always-right', thinkSeconds: 1 });
    expect(result.stats.asked).toBeGreaterThan(0);
    expect(result.stats.correct).toBe(result.stats.asked);
    expect(result.stats.accuracy).toBe(1);
    expect(result.stats.slowest).not.toBeNull();
    expect(result.stats.averageReaction).toBeGreaterThan(0);
  });

  it('onthoudt de langzaamste som', () => {
    const race = createRace({ seed: 'traag', circuit: 'tables', opponentCount: 1 });
    race.answer(race.view().question.answer);
    const slowOne = race.view().question;
    for (let i = 0; i < 300; i += 1) race.tick();
    race.answer(slowOne.answer);
    race.answer(race.view().question.answer);

    expect(race.view().stats.slowest?.question).toEqual(slowOne);
    expect(race.view().stats.slowest?.seconds).toBeCloseTo(5);
  });
});

describe('race, uitslag', () => {
  it('wint met een reeks snelle goede antwoorden van het AI-basistempo', () => {
    for (const opponentCount of [1, 2, 3]) {
      const { result } = run({ behaviour: 'always-right', thinkSeconds: 0.5, opponentCount });
      expect(result.position).toBe(1);
      expect(result.timedOut).toBe(false);
    }
  });

  it('verliest met een reeks foute antwoorden', () => {
    const { result } = run({ behaviour: 'always-wrong', thinkSeconds: 1, opponentCount: 1 });
    expect(result.position).toBeGreaterThan(1);
    expect(result.stats.correct).toBe(0);
  });

  it('verliest ook van de snelste tegenstander als er niets beantwoord wordt', () => {
    const { result } = run({ behaviour: 'never-answers', opponentCount: 3 });
    expect(result.position).toBeGreaterThan(1);
  });

  it('eindigt altijd binnen de tickslimiet, hoe er ook gespeeld wordt', () => {
    for (const behaviour of ['always-right', 'always-wrong', 'never-answers'] as const) {
      const { result, ticks } = run({ behaviour, thinkSeconds: 1, opponentCount: 3 });
      expect(ticks).toBeLessThan(RACE.maxTicks);
      expect(result.seconds).toBeGreaterThan(0);
      expect(result.timedOut).toBe(false);
    }
  });

  it('rangschikt het hele veld met de speler op zijn plaats', () => {
    const { result } = run({ behaviour: 'always-right', thinkSeconds: 0.5, opponentCount: 3 });
    expect(result.racers).toHaveLength(4);
    expect(result.racers.map((r) => r.position)).toEqual([1, 2, 3, 4]);
    const player = result.racers.find((r) => r.isPlayer);
    expect(player?.position).toBe(result.position);
    expect(player?.distance).toBe(CIRCUIT_DISTANCE['tables']);
  });

  it('bevriest de simulatie zodra de race klaar is', () => {
    const race = createRace({ seed: 'klaar', circuit: 'tables', opponentCount: 1, distance: 5 });
    while (race.view().phase !== 'finished') race.tick();
    const frozen = race.view();
    race.tick();
    race.tick();
    expect(race.view().tick).toBe(frozen.tick);
    expect(race.answer(frozen.question.answer)).toBeNull();
  });
});

describe('race, circuitafstanden', () => {
  it('geeft elk circuit zijn eigen afstand, met 1000 als standaard', () => {
    for (const circuit of CIRCUITS) {
      const view = createRace({ seed: 'afstand', circuit, opponentCount: 1 }).view();
      expect(view.distance).toBe(CIRCUIT_DISTANCE[circuit]);
      expect(view.distance).toBeGreaterThan(0);
    }
    expect(CIRCUIT_DISTANCE['grandprix']).toBe(RACE.distance);
  });

  it('laat een expliciete afstand voorgaan op die van het circuit', () => {
    const view = createRace({ seed: 'afstand', circuit: 'tables', opponentCount: 1, distance: 42 }).view();
    expect(view.distance).toBe(42);
  });

  it('levert racetijden op in de orde van de recordtijden uit het ontwerp', () => {
    for (const circuit of CIRCUITS) {
      const { result } = run({ behaviour: 'always-right', thinkSeconds: 1.5, circuit, opponentCount: 3 });
      // Een sterke ronde duurt tussen de anderhalve en vier minuten.
      expect(result.seconds).toBeGreaterThan(80);
      expect(result.seconds).toBeLessThan(240);
    }
  });
});
