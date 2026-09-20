/**
 * Geluidseffecten, volledig gegenereerd met WebAudio.
 * Geen audiobestanden en geen externe bibliotheken.
 *
 * Een AudioContext mag pas na een gebruikersgebaar starten, anders blijft hij op
 * mobiel in de staat 'suspended' hangen. Daarom wordt hij pas bij de eerste tap
 * aangemaakt, via `unlock()`.
 */

import { AUDIO } from '../config.ts';

export interface Sfx {
  /** Start of hervat de AudioContext. Aanroepen vanuit een gebruikersgebaar. */
  unlock(): void;
  key(): void;
  correct(): void;
  wrong(): void;
  turbo(): void;
  finish(): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  /** Voor tests: is er een werkende context? */
  readonly ready: boolean;
}

type ContextFactory = () => AudioContext | null;

function browserContext(): AudioContext | null {
  try {
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    return Ctor === undefined ? null : new Ctor();
  } catch {
    // Geen WebAudio of geweigerd: het spel gaat gewoon door, dan zonder geluid.
    return null;
  }
}

export function createSfx(createContext: ContextFactory = browserContext): Sfx {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = false;

  const unlock = (): void => {
    if (context === null) {
      context = createContext();
      if (context === null) return;
      master = context.createGain();
      master.gain.value = muted ? 0 : AUDIO.master;
      master.connect(context.destination);
    }
    // Safari zet de context na een tabwissel weer op 'suspended'.
    if (context.state === 'suspended') void context.resume();
  };

  /** Eén toon met een korte attack en een exponentiële uitdoving. */
  const tone = (
    start: number,
    freq: number,
    toFreq: number,
    duration: number,
    gain: number,
    type: OscillatorType,
  ): void => {
    if (context === null || master === null) return;
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (toFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), start + duration);

    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(gain, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(env);
    env.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  };

  const now = (): number => (context === null ? 0 : context.currentTime);

  const play = (fn: (start: number) => void): void => {
    if (muted || context === null) return;
    fn(now());
  };

  const arpeggio = (steps: readonly number[], step: number, gain: number, type: OscillatorType): void => {
    play((start) => {
      steps.forEach((freq, i) => tone(start + i * step, freq, freq, step * 1.6, gain, type));
    });
  };

  return {
    unlock,
    key: () => play((start) => tone(start, AUDIO.key.freq, AUDIO.key.freq, AUDIO.key.duration, AUDIO.key.gain, 'square')),
    correct: () =>
      play((start) =>
        tone(start, AUDIO.correct.from, AUDIO.correct.to, AUDIO.correct.duration, AUDIO.correct.gain, 'triangle'),
      ),
    wrong: () =>
      play((start) =>
        tone(start, AUDIO.wrong.from, AUDIO.wrong.to, AUDIO.wrong.duration, AUDIO.wrong.gain, 'sawtooth'),
      ),
    turbo: () => arpeggio(AUDIO.turbo.steps, AUDIO.turbo.step, AUDIO.turbo.gain, 'square'),
    finish: () => arpeggio(AUDIO.finish.steps, AUDIO.finish.step, AUDIO.finish.gain, 'triangle'),
    setMuted: (value: boolean) => {
      muted = value;
      if (master !== null && context !== null) {
        // Vloeiend dempen in plaats van hard afkappen, dat klikt.
        master.gain.setTargetAtTime(value ? 0 : AUDIO.master, context.currentTime, 0.02);
      }
    },
    get muted() {
      return muted;
    },
    get ready() {
      return context !== null;
    },
  };
}
