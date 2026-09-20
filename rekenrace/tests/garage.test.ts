import { describe, expect, it } from 'vitest';
import { GARAGE, KART, TICK_HZ, UI } from '../src/config.ts';
import { applySupply, createKart, type Kart } from '../src/engine/kart.ts';
import {
  answerGarage,
  chooseSupply,
  levelFor,
  openGarage,
  tickGarage,
  type GarageContext,
} from '../src/engine/garage.ts';
import { createQuestionSource, type Level } from '../src/engine/questions.ts';
import { createRng } from '../src/engine/rng.ts';
import type { Garage } from '../src/engine/track.ts';

const supplyGarage: Garage = { id: 'g1', kind: 'supply', y: 1600, halfWidth: 70, depth: 90 };
const finishGarage: Garage = { id: 'g2', kind: 'finish', y: 4800, halfWidth: 70, depth: 90 };

function context(level: Level = 2, seed = 'garage'): GarageContext & { levels: Level[] } {
  const source = createQuestionSource(seed, 'grandprix');
  const levels: Level[] = [];
  return {
    levels,
    rng: createRng(`${seed}:rng`),
    level: () => level,
    nextQuestion: (asked: Level) => {
      levels.push(asked);
      return source.next(asked);
    },
  };
}

const healthy = { fuel: KART.maxFuel, condition: KART.maxCondition };

describe('garage, wat een som oplevert', () => {
  const rng = createRng('keuze');

  it('geeft benzine zodra de tank bijna leeg is', () => {
    const kart = createKart({ fuel: 5, condition: KART.maxCondition });
    for (let i = 0; i < 20; i += 1) {
      expect(chooseSupply(kart, supplyGarage, rng).kind).toBe('fuel');
    }
  });

  it('geeft een reparatie bij een gedeukte kart met een volle tank', () => {
    const kart = createKart({ fuel: KART.maxFuel, condition: 20 });
    for (let i = 0; i < 20; i += 1) {
      expect(chooseSupply(kart, supplyGarage, rng).kind).toBe('repair');
    }
  });

  it('laat benzine voorgaan op een reparatie als beide op zijn', () => {
    const kart = createKart({ fuel: 2, condition: 10 });
    expect(chooseSupply(kart, supplyGarage, rng).kind).toBe('fuel');
  });

  it('wisselt tussen benzine, raketten en turbo als je nergens krap in zit', () => {
    const kart = createKart(healthy);
    const kinds = new Set(Array.from({ length: 200 }, () => chooseSupply(kart, supplyGarage, rng).kind));
    expect(kinds).toEqual(new Set(['fuel', 'rocket', 'boost']));
  });

  it('biedt een nieuwe kart aan, maar alleen bij een finishstation', () => {
    let kart = createKart({ fuel: KART.maxFuel, condition: 0 });
    expect(kart.hasKart).toBe(false);

    expect(chooseSupply(kart, finishGarage, rng).kind).toBe('kart');
    // Bij een gewone garage kun je wel tanken, maar je kart krijg je er niet terug.
    for (let i = 0; i < 20; i += 1) {
      expect(chooseSupply(kart, supplyGarage, rng).kind).not.toBe('kart');
    }

    kart = { ...kart, fuel: 5 };
    expect(chooseSupply(kart, supplyGarage, rng).kind).toBe('fuel');
  });

  it('geeft vaten benzine van tien of vijftien', () => {
    const kart = createKart({ fuel: 1, condition: KART.maxCondition });
    const amounts = new Set(Array.from({ length: 60 }, () => chooseSupply(kart, supplyGarage, rng).amount));
    expect(amounts).toEqual(new Set(GARAGE.fuelAmounts));
  });

  it('heeft een Nederlandse naam voor elk item', () => {
    const kart = createKart({ fuel: 1, condition: KART.maxCondition });
    expect(chooseSupply(kart, supplyGarage, rng).label).toBe('Benzine');
    expect(chooseSupply(createKart({ fuel: KART.maxFuel, condition: 0 }), finishGarage, rng).label).toBe(
      'Nieuwe kart',
    );
  });
});

describe('garage, moeilijkheid', () => {
  it('vraagt een moeilijkere som voor je kart dan voor gewone voorraad', () => {
    const kartReward = { kind: 'kart' as const, amount: 1, label: 'Nieuwe kart' };
    const fuelReward = { kind: 'fuel' as const, amount: 10, label: 'Benzine' };
    expect(levelFor(kartReward, 2)).toBe(2 + GARAGE.kartLevelBump);
    expect(levelFor(fuelReward, 2)).toBe(2);
  });

  it('gaat nooit boven niveau vijf uit', () => {
    expect(levelFor({ kind: 'kart', amount: 1, label: 'Nieuwe kart' }, 5)).toBe(5);
  });

  it('stelt de som voor een nieuwe kart echt op dat hogere niveau', () => {
    const ctx = context(3);
    const kart = createKart({ fuel: KART.maxFuel, condition: 0 });
    openGarage(finishGarage, kart, ctx);
    expect(ctx.levels[0]).toBe(3 + GARAGE.kartLevelBump);
  });
});

describe('garage, sommen beantwoorden', () => {
  it('opent met een som en een beloning in beeld', () => {
    const ctx = context();
    const session = openGarage(supplyGarage, createKart(healthy), ctx);
    expect(session.phase).toBe('asking');
    expect(session.answered).toBe(0);
    expect(session.correct).toBe(0);
    expect(session.question.answer).toBeGreaterThanOrEqual(0);
    expect(session.reward.label).not.toBe('');
  });

  it('levert bij een goed antwoord het item op en zet de volgende som klaar', () => {
    const ctx = context();
    const kart = createKart(healthy);
    const session = openGarage(supplyGarage, kart, ctx);
    const reward = session.reward;

    const result = answerGarage(session, session.question.answer, kart, ctx);
    expect(result.correct).toBe(true);
    expect(result.earned).toEqual(reward);
    expect(result.session.correct).toBe(1);
    expect(result.session.answered).toBe(1);
    expect(result.session.phase).toBe('asking');
    expect(result.session.question).not.toEqual(session.question);
  });

  it('levert bij een fout antwoord niets op en toont eerst het juiste antwoord', () => {
    const ctx = context();
    const kart = createKart(healthy);
    const session = openGarage(supplyGarage, kart, ctx);

    const result = answerGarage(session, session.question.answer + 1, kart, ctx);
    expect(result.correct).toBe(false);
    expect(result.earned).toBeNull();
    expect(result.session.phase).toBe('reveal');
    expect(result.session.answered).toBe(1);
    expect(result.session.correct).toBe(0);
    // De som blijft staan zodat je het juiste antwoord ziet.
    expect(result.session.question).toEqual(session.question);
  });

  it('neemt tijdens het tonen van het juiste antwoord geen antwoorden aan', () => {
    const ctx = context();
    const kart = createKart(healthy);
    let session = openGarage(supplyGarage, kart, ctx);
    session = answerGarage(session, session.question.answer + 1, kart, ctx).session;

    const blocked = answerGarage(session, session.question.answer, kart, ctx);
    expect(blocked.earned).toBeNull();
    expect(blocked.session.answered).toBe(1);
  });

  it('komt na de reveal met een nieuwe som', () => {
    const ctx = context();
    const kart = createKart(healthy);
    let session = openGarage(supplyGarage, kart, ctx);
    const wrongOne = session.question;
    session = answerGarage(session, wrongOne.answer + 1, kart, ctx).session;

    const revealTicks = Math.round((UI.revealMs / 1000) * TICK_HZ);
    for (let i = 0; i < revealTicks; i += 1) session = tickGarage(session, kart, ctx);

    expect(session.phase).toBe('asking');
    expect(session.question).not.toEqual(wrongOne);
    expect(session.questionTicks).toBe(0);
  });

  it('leidt de reactietijd af uit de ticks in de garage', () => {
    const ctx = context();
    const kart = createKart(healthy);
    let session = openGarage(supplyGarage, kart, ctx);
    for (let i = 0; i < 90; i += 1) session = tickGarage(session, kart, ctx);

    const result = answerGarage(session, session.question.answer, kart, ctx);
    expect(result.reactionSeconds).toBeCloseTo(1.5);
  });

  it('telt het aantal sommen op in plaats van af', () => {
    const ctx = context();
    let kart = createKart(healthy);
    let session = openGarage(supplyGarage, kart, ctx);
    for (let i = 0; i < 6; i += 1) {
      const result = answerGarage(session, session.question.answer, kart, ctx);
      session = result.session;
      if (result.earned !== null) kart = applySupply(kart, result.earned);
    }
    expect(session.answered).toBe(6);
    expect(session.correct).toBe(6);
  });
});

describe('garage, voorraad bijschrijven', () => {
  it('tankt bij tot de tank vol is en niet verder', () => {
    const kart = createKart({ fuel: KART.maxFuel - 5, condition: KART.maxCondition });
    const filled = applySupply(kart, { kind: 'fuel', amount: 15, label: 'Benzine' });
    expect(filled.fuel).toBe(KART.maxFuel);
  });

  it('haalt je met benzine weer van je voeten af', () => {
    const kart = createKart({ fuel: 0, condition: KART.maxCondition });
    expect(kart.onFoot).toBe(true);
    const filled = applySupply(kart, { kind: 'fuel', amount: 10, label: 'Benzine' });
    expect(filled.onFoot).toBe(false);
  });

  it('telt raketten en turbo bij elkaar op', () => {
    let kart = createKart(healthy);
    kart = applySupply(kart, { kind: 'rocket', amount: 1, label: 'Mini-raket' });
    kart = applySupply(kart, { kind: 'rocket', amount: 1, label: 'Mini-raket' });
    kart = applySupply(kart, { kind: 'boost', amount: 1, label: 'Turbo' });
    expect(kart.rockets).toBe(2);
    expect(kart.boosts).toBe(1);
  });

  it('lapt de kart op zonder hem terug te geven', () => {
    const wrecked = createKart({ fuel: KART.maxFuel, condition: 0 });
    const patched = applySupply(wrecked, { kind: 'repair', amount: 25, label: 'Reparatie' });
    expect(patched.condition).toBe(25);
    // Oplappen is niet genoeg: daarvoor moet je naar een finishstation.
    expect(patched.hasKart).toBe(false);
  });

  it('geeft bij een nieuwe kart de volle conditie terug', () => {
    const wrecked = createKart({ fuel: KART.maxFuel, condition: 0 });
    const fresh = applySupply(wrecked, { kind: 'kart', amount: 1, label: 'Nieuwe kart' });
    expect(fresh.hasKart).toBe(true);
    expect(fresh.condition).toBe(KART.maxCondition);
    expect(fresh.onFoot).toBe(false);
  });
});

describe('garage, een hele stop', () => {
  it('brengt een gestrande speler weer op de baan', () => {
    const ctx = context(2, 'stop');
    // Zonder kart en met een lege tank: precies het moment waarop je de garage nodig hebt.
    let kart: Kart = createKart({ fuel: 0, condition: 0 });
    let session = openGarage(finishGarage, kart, ctx);

    for (let i = 0; i < 12; i += 1) {
      const result = answerGarage(session, session.question.answer, kart, ctx);
      session = result.session;
      if (result.earned !== null) kart = applySupply(kart, result.earned);
    }

    expect(kart.hasKart).toBe(true);
    expect(kart.fuel).toBeGreaterThan(0);
    expect(kart.onFoot).toBe(false);
    expect(session.correct).toBe(12);
  });

  it('is deterministisch bij dezelfde seed', () => {
    const run = (): { fuel: number; rockets: number; boosts: number } => {
      const ctx = context(2, 'zelfde');
      let kart = createKart({ fuel: 10, condition: 60 });
      let session = openGarage(supplyGarage, kart, ctx);
      for (let i = 0; i < 15; i += 1) {
        const result = answerGarage(session, session.question.answer, kart, ctx);
        session = result.session;
        if (result.earned !== null) kart = applySupply(kart, result.earned);
      }
      return { fuel: kart.fuel, rockets: kart.rockets, boosts: kart.boosts };
    };
    expect(run()).toEqual(run());
  });
});
