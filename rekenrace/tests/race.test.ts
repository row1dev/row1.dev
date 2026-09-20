import { describe, expect, it } from 'vitest';
import { KART, RACE, TICK_HZ } from '../src/config.ts';
import { NO_RACE_INPUT, createRace, type Race, type RaceInput } from '../src/engine/race.ts';
import { CIRCUITS } from '../src/engine/questions.ts';
import { driveRival, rivalProfiles } from '../src/engine/opponent.ts';

const START = TICK_HZ * 3;

function run(race: Race, ticks: number, input: RaceInput = NO_RACE_INPUT): void {
  for (let i = 0; i < ticks; i += 1) race.tick(input);
}

/**
 * Rijdt naar de garage toe met dezelfde stuurlogica als de tegenstanders. Die
 * mikt op de middellijn, en daar staan de garages. Sturen is nodig: hun
 * voetafdruk is smal, dus wie rechtdoor blijft rijden rijdt er gewoon langs.
 */
const AUTOPILOT = rivalProfiles(1)[0]!;

function driveToGarage(race: Race, maxTicks = TICK_HZ * 200): boolean {
  for (let i = 0; i < maxTicks; i += 1) {
    const view = race.view();
    if (view.phase === 'garage') return true;
    if (view.phase === 'finished') return false;
    race.tick({ ...driveRival(view.player.kart, view.track, AUTOPILOT), fire: false });
  }
  return false;
}

function newRace(seed = 'race', rivalCount = 2): Race {
  return createRace({ seed, circuit: 'tables', rivalCount });
}

describe('race, opzet', () => {
  it('begint met een startsein en een stilstaand veld', () => {
    const view = newRace().view();
    expect(view.phase).toBe('countdown');
    expect(view.racers).toHaveLength(3);
    expect(view.player.kart.speed).toBe(0);
    expect(view.result).toBeNull();
    expect(view.garage).toBeNull();
  });

  it('laat de lampen één voor één aangaan en geeft dan groen', () => {
    const race = newRace();
    expect(race.view().lightsLit).toBeLessThanOrEqual(1);

    run(race, START - 2);
    expect(race.view().phase).toBe('countdown');
    expect(race.view().lightsLit).toBe(4);

    run(race, 4);
    expect(race.view().phase).toBe('racing');
  });

  it('houdt iedereen stil tot het groen is', () => {
    const race = newRace();
    run(race, START - 2);
    for (const racer of race.view().racers) expect(racer.kart.y).toBe(0);

    run(race, TICK_HZ * 2);
    expect(race.view().player.kart.y).toBeGreaterThan(0);
  });

  it('zet het veld naast elkaar op de startgrid', () => {
    const xs = newRace('grid', 3).view().racers.map((racer) => Math.round(racer.kart.x));
    expect(new Set(xs).size).toBe(4);
  });

  it('is deterministisch bij dezelfde seed', () => {
    const drive = (): number => {
      const race = newRace('zelfde');
      run(race, TICK_HZ * 30, { steer: 1, brake: false, turbo: false, fire: false });
      return race.view().player.kart.y;
    };
    expect(drive()).toBe(drive());
  });
});

describe('race, rijden', () => {
  it('reageert op sturen', () => {
    const straight = newRace('stuur');
    run(straight, START + TICK_HZ * 4);

    const turning = newRace('stuur');
    run(turning, START);
    run(turning, TICK_HZ * 4, { steer: 1, brake: false, turbo: false, fire: false });

    expect(turning.view().player.kart.x).not.toBeCloseTo(straight.view().player.kart.x, 1);
  });

  it('remt op commando', () => {
    const race = newRace('rem');
    run(race, START + TICK_HZ * 3);
    const rolling = race.view().player.kart.speed;
    run(race, TICK_HZ, { steer: 0, brake: true, turbo: false, fire: false });
    expect(race.view().player.kart.speed).toBeLessThan(rolling);
  });

  it('laat de tegenstanders zelf rijden', () => {
    const race = newRace('rivalen', 3);
    run(race, START + TICK_HZ * 10);
    for (const racer of race.view().racers) {
      if (racer.isPlayer) continue;
      expect(racer.kart.y).toBeGreaterThan(100);
      // Ze stoppen nooit om te tanken, dus hun tank blijft vol.
      expect(racer.kart.fuel).toBe(KART.maxFuel);
    }
  });

  it('rangschikt het veld op afgelegde afstand', () => {
    const race = newRace('positie', 3);
    run(race, START + TICK_HZ * 20);
    const view = race.view();
    expect(view.racers.map((racer) => racer.position)).toEqual([1, 2, 3, 4]);
    for (let i = 1; i < view.racers.length; i += 1) {
      expect(view.racers[i]!.kart.y).toBeLessThanOrEqual(view.racers[i - 1]!.kart.y);
    }
  });
});

describe('race, raketten', () => {
  it('schiet alleen met munitie', () => {
    const race = newRace('schiet');
    run(race, START + TICK_HZ);
    const fire: RaceInput = { steer: 0, brake: false, turbo: false, fire: true };

    race.tick(fire);
    expect(race.view().rockets.filter((rocket) => rocket.ownerId === 'player')).toHaveLength(0);
  });

  it('laat tegenstanders op je schieten, en dat kost conditie', () => {
    // Twee tegenstanders die achter je beginnen en vroeg of laat raak schieten.
    const race = newRace('beschoten', 3);
    let lowest: number = KART.maxCondition;
    for (let i = 0; i < TICK_HZ * 200; i += 1) {
      const view = race.view();
      lowest = Math.min(lowest, view.player.kart.condition);
      if (view.phase === 'garage') race.leaveGarage();
      if (view.phase === 'finished') break;
      race.tick({ ...driveRival(view.player.kart, view.track, AUTOPILOT), fire: false });
    }
    expect(lowest).toBeLessThan(KART.maxCondition);
  });
});

describe('race, de Rekengarage', () => {
  it('opent vanzelf als je een garage binnenrijdt', () => {
    const race = newRace('garage');
    expect(driveToGarage(race)).toBe(true);

    const view = race.view();
    expect(view.phase).toBe('garage');
    expect(view.garage).not.toBeNull();
    expect(view.garage!.question.answer).toBeGreaterThanOrEqual(0);
    // De kart staat stil zolang je binnen bent.
    expect(view.player.kart.speed).toBe(0);
  });

  it('laat de race buiten gewoon doorlopen', () => {
    const race = newRace('doorlopen', 3);
    expect(driveToGarage(race)).toBe(true);

    const before = race.view();
    const rivalsBefore = before.racers.filter((racer) => !racer.isPlayer).map((racer) => racer.kart.y);
    const playerBefore = before.player.kart.y;

    run(race, TICK_HZ * 5);

    const after = race.view();
    const rivalsAfter = after.racers.filter((racer) => !racer.isPlayer).map((racer) => racer.kart.y);
    // Dit is de hele afweging: elke som kost je baanpositie.
    expect(Math.max(...rivalsAfter)).toBeGreaterThan(Math.max(...rivalsBefore));
    expect(after.player.kart.y).toBeCloseTo(playerBefore, 5);
  });

  it('schrijft een goede som bij op je voorraad', () => {
    const race = newRace('voorraad');
    expect(driveToGarage(race)).toBe(true);

    const before = race.view();
    const reward = before.garage!.reward;
    const outcome = race.answer(before.garage!.question.answer);

    expect(outcome?.correct).toBe(true);
    expect(outcome?.earned).toEqual(reward);

    const after = race.view().player.kart;
    if (reward.kind === 'fuel') expect(after.fuel).toBeGreaterThan(before.player.kart.fuel);
    if (reward.kind === 'rocket') expect(after.rockets).toBe(before.player.kart.rockets + reward.amount);
    if (reward.kind === 'boost') expect(after.boosts).toBe(before.player.kart.boosts + reward.amount);
  });

  it('levert bij een fout antwoord niets op', () => {
    const race = newRace('fout');
    expect(driveToGarage(race)).toBe(true);

    const before = race.view().player.kart;
    const outcome = race.answer(race.view().garage!.question.answer + 1);

    expect(outcome?.correct).toBe(false);
    expect(outcome?.earned).toBeNull();
    const after = race.view().player.kart;
    expect(after.fuel).toBeCloseTo(before.fuel, 6);
    expect(after.rockets).toBe(before.rockets);
  });

  it('telt de sommen mee in de statistieken', () => {
    const race = newRace('statistiek');
    expect(driveToGarage(race)).toBe(true);

    race.answer(race.view().garage!.question.answer);
    run(race, 1);
    race.answer(race.view().garage!.question.answer + 1);

    const stats = race.view().stats;
    expect(stats.asked).toBe(2);
    expect(stats.correct).toBe(1);
    expect(stats.accuracy).toBeCloseTo(0.5);
    expect(stats.garageSeconds).toBeGreaterThan(0);
  });

  it('neemt buiten de garage geen antwoorden aan', () => {
    const race = newRace('buiten');
    run(race, START + TICK_HZ);
    expect(race.answer(4)).toBeNull();
  });

  it('rijdt op commando weer naar buiten en rolt er niet meteen weer in', () => {
    const race = newRace('wegwezen');
    expect(driveToGarage(race)).toBe(true);
    const garageId = race.view().garage!.garage.id;

    race.leaveGarage();
    expect(race.view().phase).toBe('racing');
    expect(race.view().garage).toBeNull();

    // Rijd de garage uit; hij mag niet opnieuw openen zolang je er nog in staat.
    for (let i = 0; i < TICK_HZ * 3; i += 1) {
      race.tick(NO_RACE_INPUT);
      if (race.view().phase === 'garage') {
        expect(race.view().garage!.garage.id).not.toBe(garageId);
        break;
      }
    }
  });
});

describe('race, uitslag', () => {
  it('eindigt als de speler over de finish komt', () => {
    // Een korte baan, zodat de test niet een halve minuut simuleert.
    const race = createRace({ seed: 'finish', circuit: 'tables', rivalCount: 1, trackLength: 900 });
    for (let i = 0; i < RACE.maxTicks; i += 1) {
      const view = race.view();
      if (view.phase === 'garage') race.leaveGarage();
      if (view.phase === 'finished') break;
      race.tick({ ...driveRival(view.player.kart, view.track, AUTOPILOT), fire: false });
    }

    const result = race.view().result;
    expect(result).not.toBeNull();
    expect(result!.timedOut).toBe(false);
    expect(result!.position).toBeGreaterThanOrEqual(1);
    expect(result!.racers).toHaveLength(2);
    expect(result!.seconds).toBeGreaterThan(0);
  });

  it('bevriest de simulatie zodra de race klaar is', () => {
    const race = createRace({ seed: 'klaar', circuit: 'tables', rivalCount: 1, trackLength: 700 });
    for (let i = 0; i < RACE.maxTicks; i += 1) {
      const view = race.view();
      if (view.phase === 'garage') race.leaveGarage();
      if (view.phase === 'finished') break;
      race.tick({ ...driveRival(view.player.kart, view.track, AUTOPILOT), fire: false });
    }

    const frozen = race.view().tick;
    run(race, 10);
    expect(race.view().tick).toBe(frozen);
    expect(race.answer(1)).toBeNull();
  });

  it('werkt op elk circuit', () => {
    for (const circuit of CIRCUITS) {
      const race = createRace({ seed: `c-${circuit}`, circuit, rivalCount: 1, trackLength: 800 });
      for (let i = 0; i < RACE.maxTicks; i += 1) {
        const view = race.view();
        if (view.phase === 'garage') race.leaveGarage();
        if (view.phase === 'finished') break;
        race.tick({ ...driveRival(view.player.kart, view.track, AUTOPILOT), fire: false });
      }
      expect(race.view().result).not.toBeNull();
    }
  });
});
