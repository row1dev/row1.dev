/**
 * Rijbesturing op het scherm. Gas gaat automatisch; jij stuurt, remt, geeft
 * turbo en schiet. Alles met knoppen, want een telefoon heeft geen toetsenbord.
 *
 * Sturen werkt op vasthouden, de acties op indrukken.
 */

import type { RaceInput } from '../engine/race.ts';

export interface Controls {
  /** De invoer voor deze tick. `fire` en `turbo` gelden eenmalig per druk. */
  read(): RaceInput;
  setAmmo(rockets: number, boosts: number): void;
  setEnabled(enabled: boolean): void;
  /** Verwerkt een toets van een fysiek toetsenbord; handig op de desktop. */
  handleKey(key: string, down: boolean): boolean;
  destroy(): void;
}

export interface ControlsOptions {
  onAction?(action: 'turbo' | 'rocket'): void;
}

function need<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`element ontbreekt: ${selector}`);
  return element;
}

export function createControls(options: ControlsOptions = {}): Controls {
  let left = false;
  let right = false;
  let brake = false;
  /** Eenmalige acties: ze worden bij de eerstvolgende read() opgenomen. */
  let turboQueued = false;
  let fireQueued = false;
  let enabled = true;

  const cleanups: Array<() => void> = [];

  /** Een knop die geldt zolang je hem vasthoudt. */
  const hold = (selector: string, set: (down: boolean) => void): HTMLButtonElement => {
    const button = need<HTMLButtonElement>(selector);
    const down = (event: PointerEvent): void => {
      event.preventDefault();
      if (!enabled) return;
      button.classList.add('held');
      set(true);
      // Vastpakken zodat je duim van de knop mag glijden zonder los te laten.
      // Dit is een extraatje: als het niet lukt mag het de knop zelf niet breken,
      // want dan zou sturen helemaal niet meer werken.
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // Geen capture beschikbaar; de knop werkt verder gewoon.
      }
    };
    const up = (event: PointerEvent): void => {
      event.preventDefault();
      button.classList.remove('held');
      set(false);
      try {
        if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
      } catch {
        // Niets aan de hand: er was niets vastgepakt.
      }
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('pointerleave', up);
    cleanups.push(() => {
      button.removeEventListener('pointerdown', down);
      button.removeEventListener('pointerup', up);
      button.removeEventListener('pointercancel', up);
      button.removeEventListener('pointerleave', up);
    });
    return button;
  };

  /** Een knop die één keer per druk telt. */
  const tap = (selector: string, action: 'turbo' | 'rocket'): void => {
    const button = need<HTMLButtonElement>(selector);
    const down = (event: PointerEvent): void => {
      event.preventDefault();
      if (!enabled) return;
      if (action === 'turbo') turboQueued = true;
      else fireQueued = true;
      button.classList.add('held');
      window.setTimeout(() => button.classList.remove('held'), 120);
      options.onAction?.(action);
    };
    button.addEventListener('pointerdown', down);
    cleanups.push(() => button.removeEventListener('pointerdown', down));
  };

  hold('#steer-left', (down) => {
    left = down;
  });
  hold('#steer-right', (down) => {
    right = down;
  });
  hold('#act-brake', (down) => {
    brake = down;
  });
  tap('#act-turbo', 'turbo');
  tap('#act-rocket', 'rocket');

  const rocketCount = need<HTMLElement>('#count-rockets');
  const boostCount = need<HTMLElement>('#count-boosts');
  const rocketButton = need<HTMLButtonElement>('#act-rocket');
  const turboButton = need<HTMLButtonElement>('#act-turbo');
  const root = need<HTMLElement>('#controls');

  const read = (): RaceInput => {
    // Allebei ingedrukt heft elkaar op; dat is minder verwarrend dan de laatste winnen.
    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    const input: RaceInput = { steer, brake, turbo: turboQueued, fire: fireQueued };
    turboQueued = false;
    fireQueued = false;
    return input;
  };

  const handleKey = (key: string, down: boolean): boolean => {
    if (!enabled) return false;
    switch (key) {
      case 'ArrowLeft':
        left = down;
        return true;
      case 'ArrowRight':
        right = down;
        return true;
      case 'ArrowDown':
      case 's':
        brake = down;
        return true;
      case ' ':
        if (down) turboQueued = true;
        return true;
      case 'Enter':
        if (down) fireQueued = true;
        return true;
      default:
        return false;
    }
  };

  return {
    read,
    handleKey,
    setAmmo: (rockets, boosts) => {
      if (rocketCount.textContent !== String(rockets)) rocketCount.textContent = String(rockets);
      if (boostCount.textContent !== String(boosts)) boostCount.textContent = String(boosts);
      rocketButton.classList.toggle('empty', rockets <= 0);
      turboButton.classList.toggle('empty', boosts <= 0);
    },
    setEnabled: (value) => {
      enabled = value;
      root.classList.toggle('disabled', !value);
      if (!value) {
        left = false;
        right = false;
        brake = false;
      }
    },
    destroy: () => {
      for (const cleanup of cleanups) cleanup();
    },
  };
}
