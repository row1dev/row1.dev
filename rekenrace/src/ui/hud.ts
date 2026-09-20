/**
 * De DOM-laag boven het canvas: de balk bovenin, de meters eronder en het
 * somvak in de garage. Leest alleen uit de engine.
 */

import { KART, OPPONENT_COLORS, RIVALS, UI } from '../config.ts';
import type { GarageSession } from '../engine/garage.ts';
import type { RaceView } from '../engine/race.ts';

export interface Hud {
  update(view: RaceView): void;
}

export interface Gauges {
  update(view: RaceView): void;
}

export interface QuestionPanel {
  update(session: GarageSession, entry: string): void;
  flashCorrect(): void;
  flashWrong(): void;
}

/** Formatteert seconden als mm:ss. */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

/** Formatteert een reactietijd als "2,4 s", met een Nederlandse komma. */
export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1).replace('.', ',')} s`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/** Schrijft alleen als de tekst echt verandert. */
function write(element: HTMLElement, text: string): void {
  if (element.textContent !== text) element.textContent = text;
}

function need<T extends Element>(selector: string, root: ParentNode = document): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`element ontbreekt: ${selector}`);
  return element;
}

/** De kleur die bij een racer hoort, vast per rijder. */
export function colorFor(name: string, isPlayer: boolean): string {
  if (isPlayer) return '#f2f6ff';
  const index = RIVALS.profiles.findIndex((profile) => profile.name === name);
  return OPPONENT_COLORS[Math.max(0, index) % OPPONENT_COLORS.length] ?? '#ffffff';
}

export function createHud(): Hud {
  const position = need<HTMLElement>('#hud-position');
  const fill = need<HTMLElement>('#hud-progress-fill');
  const markers = need<HTMLElement>('#hud-markers');
  const time = need<HTMLElement>('#hud-time');

  let built = new Map<string, HTMLElement>();

  const update = (view: RaceView): void => {
    if (built.size !== view.racers.length) {
      markers.replaceChildren();
      built = new Map(
        [...view.racers]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((racer) => {
            const marker = document.createElement('div');
            marker.className = racer.isPlayer ? 'hud-marker player' : 'hud-marker';
            marker.style.background = colorFor(racer.name, racer.isPlayer);
            markers.append(marker);
            return [racer.id, marker] as const;
          }),
      );
    }

    for (const racer of view.racers) {
      const marker = built.get(racer.id);
      if (marker !== undefined) {
        marker.style.left = `${Math.min(100, (racer.kart.y / view.track.length) * 100)}%`;
      }
    }

    write(position, `P${view.player.position}/${view.racers.length}`);
    fill.style.width = `${Math.min(100, (view.player.kart.y / view.track.length) * 100)}%`;
    write(time, formatTime(view.seconds));
  };

  return { update };
}

export function createGauges(): Gauges {
  const speed = need<HTMLElement>('#gauge-speed');
  const fuel = need<HTMLElement>('#gauge-fuel');
  const condition = need<HTMLElement>('#gauge-condition');

  const update = (view: RaceView): void => {
    const kart = view.player.kart;
    write(speed, String(Math.round(kart.speed)));
    fuel.style.width = `${(kart.fuel / KART.maxFuel) * 100}%`;
    fuel.classList.toggle('low', kart.fuel <= 20);
    condition.style.width = `${(kart.condition / KART.maxCondition) * 100}%`;
    condition.classList.toggle('low', kart.condition <= 30);
  };

  return { update };
}

export function createQuestionPanel(): QuestionPanel {
  const text = need<HTMLElement>('#question-text');
  const box = need<HTMLElement>('#answer-box');
  let timer: number | undefined;

  const clearFlash = (): void => {
    if (timer !== undefined) window.clearTimeout(timer);
    box.classList.remove('correct', 'wrong');
  };

  return {
    update: (session, entry) => {
      write(text, `${session.question.text} =`);
      const revealing = session.phase === 'reveal';
      box.classList.toggle('reveal', revealing);
      // Tijdens de reveal staat het juiste antwoord in het vak, niet de invoer.
      write(box, revealing ? String(session.question.answer) : entry);
    },
    flashCorrect: () => {
      clearFlash();
      box.classList.add('correct');
      timer = window.setTimeout(() => box.classList.remove('correct'), UI.correctFlashMs);
    },
    flashWrong: () => {
      clearFlash();
      box.classList.add('wrong');
      timer = window.setTimeout(() => box.classList.remove('wrong'), UI.revealMs);
    },
  };
}
