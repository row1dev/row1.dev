import { describe, expect, it, vi } from 'vitest';
import { AUDIO } from '../src/config.ts';
import { createSfx } from '../src/audio/sfx.ts';

/** Minimale namaak-AudioContext, genoeg om het gedrag van sfx.ts te volgen. */
function fakeContext() {
  const started: Array<{ type: string; freq: number; at: number }> = [];
  const resume = vi.fn();
  const gainNodes: Array<{ value: number }> = [];

  const makeGain = () => {
    const param = {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    };
    const node = { gain: param, connect: vi.fn(), disconnect: vi.fn() };
    gainNodes.push(param);
    return node;
  };

  const context = {
    state: 'suspended' as AudioContextState,
    currentTime: 0,
    destination: {},
    resume,
    createGain: makeGain,
    createOscillator: () => {
      const osc = {
        type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
        start: vi.fn((at: number) => started.push({ type: osc.type, freq: 0, at })),
        stop: vi.fn(),
      };
      return osc;
    },
  };

  return { context: context as unknown as AudioContext, started, resume, gainNodes };
}

describe('sfx', () => {
  it('maakt pas een AudioContext aan bij het eerste gebaar', () => {
    const factory = vi.fn(() => fakeContext().context);
    const sfx = createSfx(factory);
    expect(sfx.ready).toBe(false);
    expect(factory).not.toHaveBeenCalled();

    // Zonder context maakt geluid afspelen niets kapot.
    sfx.key();
    sfx.correct();
    expect(sfx.ready).toBe(false);

    sfx.unlock();
    expect(factory).toHaveBeenCalledOnce();
    expect(sfx.ready).toBe(true);
  });

  it('hervat een opgeschorte context en maakt er maar één aan', () => {
    const fake = fakeContext();
    const sfx = createSfx(() => fake.context);
    sfx.unlock();
    sfx.unlock();
    expect(fake.resume).toHaveBeenCalledTimes(2);
    expect(sfx.ready).toBe(true);
  });

  it('speelt tonen voor elk effect', () => {
    const fake = fakeContext();
    const sfx = createSfx(() => fake.context);
    sfx.unlock();

    sfx.key();
    expect(fake.started).toHaveLength(1);

    sfx.correct();
    expect(fake.started).toHaveLength(2);

    sfx.wrong();
    expect(fake.started).toHaveLength(3);

    sfx.launch();
    sfx.hit();
    sfx.bump();
    expect(fake.started).toHaveLength(6);

    // Turbo, finish en wrak zijn arpeggio's van meerdere tonen.
    sfx.turbo();
    expect(fake.started).toHaveLength(6 + AUDIO.turbo.steps.length);

    sfx.finish();
    sfx.wreck();
    expect(fake.started).toHaveLength(
      6 + AUDIO.turbo.steps.length + AUDIO.finish.steps.length + AUDIO.wreck.steps.length,
    );
  });

  it('speelt niets als het geluid uitstaat', () => {
    const fake = fakeContext();
    const sfx = createSfx(() => fake.context);
    sfx.unlock();
    sfx.setMuted(true);
    expect(sfx.muted).toBe(true);

    sfx.key();
    sfx.correct();
    sfx.turbo();
    sfx.launch();
    sfx.hit();
    sfx.wreck();
    expect(fake.started).toHaveLength(0);

    sfx.setMuted(false);
    sfx.key();
    expect(fake.started).toHaveLength(1);
  });

  it('valt stil terug als WebAudio niet beschikbaar is', () => {
    const sfx = createSfx(() => null);
    sfx.unlock();
    expect(sfx.ready).toBe(false);
    // Geen van deze aanroepen mag gooien.
    expect(() => {
      sfx.key();
      sfx.correct();
      sfx.wrong();
      sfx.turbo();
      sfx.finish();
      sfx.launch();
      sfx.hit();
      sfx.bump();
      sfx.wreck();
      sfx.setMuted(true);
    }).not.toThrow();
  });

  it('onthoudt een mute die vóór het eerste gebaar is gezet', () => {
    const fake = fakeContext();
    const sfx = createSfx(() => fake.context);
    sfx.setMuted(true);
    sfx.unlock();
    sfx.key();
    expect(fake.started).toHaveLength(0);
    // Het master-volume staat meteen op nul, niet pas na de eerste toon.
    expect(fake.gainNodes[0]?.value).toBe(0);
  });
});
