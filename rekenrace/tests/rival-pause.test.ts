import { describe, expect, it } from 'vitest';
import { RIVALS, TICK_HZ } from '../src/config.ts';
import { rivalProfiles } from '../src/engine/opponent.ts';
import { NO_RACE_INPUT, createRace } from '../src/engine/race.ts';

describe('tegenstanders, tanken bij de garage', () => {
  it('geeft elke rijder een pauze, waarbij de zwakkere er langer over doet', () => {
    const profiles = rivalProfiles(3);
    for (const profile of profiles) expect(profile.garagePauseTicks).toBeGreaterThan(0);
    // Wie langzamer rijdt, staat ook langer stil.
    for (let i = 1; i < profiles.length; i += 1) {
      expect(profiles[i]!.garagePauseTicks).toBeLessThan(profiles[i - 1]!.garagePauseTicks);
    }
  });

  it('laat een tegenstander bij elke garage echt stilstaan', () => {
    const race = createRace({ seed: 'pauze', circuit: 'tables', rivalCount: 1 });
    const track = race.view().track;
    const firstGarage = track.garages[0]!;

    let sawStop = false;
    let stoppedTicks = 0;
    for (let i = 0; i < TICK_HZ * 120; i += 1) {
      race.tick(NO_RACE_INPUT);
      const rival = race.view().racers.find((racer) => !racer.isPlayer)!;
      if (rival.kart.y < firstGarage.y) continue;
      if (rival.kart.speed === 0) {
        sawStop = true;
        stoppedTicks += 1;
      } else if (sawStop) break;
    }

    expect(sawStop).toBe(true);
    // Ongeveer de pauze uit zijn profiel, niet een enkele tick.
    expect(stoppedTicks).toBeGreaterThan(TICK_HZ * 3);
  });

  it('stopt bij elke garage opnieuw, niet alleen bij de eerste', () => {
    const race = createRace({ seed: 'meerdere', circuit: 'tables', rivalCount: 1 });
    const track = race.view().track;

    let stops = 0;
    let stoppedBefore = false;
    for (let i = 0; i < TICK_HZ * 400; i += 1) {
      race.tick(NO_RACE_INPUT);
      const view = race.view();
      const rival = view.racers.find((racer) => !racer.isPlayer)!;
      if (rival.finishTick !== null) break;
      const stopped = rival.kart.speed === 0 && rival.kart.y > 100;
      if (stopped && !stoppedBefore) stops += 1;
      stoppedBefore = stopped;
    }

    expect(stops).toBeGreaterThanOrEqual(Math.min(3, track.garages.length));
  });

  it('kost de pauze evenveel tijd als in de instellingen staat', () => {
    const profile = rivalProfiles(1)[0]!;
    expect(profile.garagePauseTicks).toBe(Math.round(RIVALS.profiles[0]!.garagePauseSeconds * TICK_HZ));
  });
});
