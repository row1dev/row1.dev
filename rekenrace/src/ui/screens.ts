/**
 * Schermen: menu, circuitkeuze en resultaat. Alleen DOM, geen spellogica.
 */

import { OPPONENTS } from '../config.ts';
import { CIRCUITS, CIRCUIT_LABELS, type Circuit } from '../engine/questions.ts';
import type { RaceResult } from '../engine/race.ts';
import type { RecordEntry, Records } from '../storage/records.ts';
import { formatPercent, formatSeconds, formatTime } from './hud.ts';

export type ScreenName = 'menu' | 'race' | 'result';

export interface MenuHandlers {
  /** Circuitkeuze is één tap: hier begint de race meteen. */
  onStart(circuit: Circuit): void;
  onOpponentCount(count: number): void;
  onToggleMute(): void;
}

export interface Menu {
  render(records: Records, opponentCount: number, muted: boolean): void;
}

export interface ResultScreen {
  render(result: RaceResult, circuit: Circuit, isRecord: boolean, previous: RecordEntry | null): void;
}

export interface Screens {
  show(name: ScreenName): void;
  current(): ScreenName;
}

function need<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`element ontbreekt: ${selector}`);
  return element;
}

const ORDINALS = ['', '1e', '2e', '3e', '4e'] as const;

export function placeLabel(position: number): string {
  return ORDINALS[position] ?? `${position}e`;
}

export function createScreens(): Screens {
  const elements: Record<ScreenName, HTMLElement> = {
    menu: need<HTMLElement>('#screen-menu'),
    race: need<HTMLElement>('#screen-race'),
    result: need<HTMLElement>('#screen-result'),
  };
  let active: ScreenName = 'menu';

  return {
    show: (name) => {
      active = name;
      for (const [key, element] of Object.entries(elements)) {
        element.hidden = key !== name;
      }
    },
    current: () => active,
  };
}

export function createMenu(handlers: MenuHandlers): Menu {
  const list = need<HTMLElement>('#circuit-list');
  const chips = need<HTMLElement>('#opponent-chips');
  const muteButton = need<HTMLButtonElement>('#menu-mute');
  const muteLabel = need<HTMLElement>('#menu-mute-label');

  const circuitButtons = new Map<Circuit, { record: HTMLElement }>();

  for (const circuit of CIRCUITS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'circuit';

    const name = document.createElement('span');
    name.className = 'circuit-name';
    name.textContent = CIRCUIT_LABELS[circuit];

    const record = document.createElement('span');
    record.className = 'circuit-record';
    record.textContent = 'nog nooit';

    button.append(name, record);
    button.addEventListener('click', () => handlers.onStart(circuit));
    list.append(button);
    circuitButtons.set(circuit, { record });
  }

  const countButtons: HTMLButtonElement[] = [];
  for (let count = OPPONENTS.minCount; count <= OPPONENTS.maxCount; count += 1) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = String(count);
    chip.setAttribute('aria-label', `${count} tegenstander${count === 1 ? '' : 's'}`);
    chip.addEventListener('click', () => handlers.onOpponentCount(count));
    chips.append(chip);
    countButtons.push(chip);
  }

  muteButton.addEventListener('click', () => handlers.onToggleMute());

  const render = (records: Records, opponentCount: number, muted: boolean): void => {
    for (const [circuit, refs] of circuitButtons) {
      const best = records[circuit];
      refs.record.textContent = best === undefined ? 'nog nooit' : `PR ${formatTime(best.seconds)}`;
    }
    countButtons.forEach((chip, index) => {
      const selected = index + OPPONENTS.minCount === opponentCount;
      chip.classList.toggle('selected', selected);
      chip.setAttribute('aria-pressed', String(selected));
    });
    muteLabel.textContent = muted ? 'geluid uit' : 'geluid aan';
    muteButton.setAttribute('aria-pressed', String(muted));
    const icon = muteButton.firstElementChild;
    if (icon !== null) icon.textContent = muted ? '🔇' : '🔊';
  };

  return { render };
}

export interface ResultHandlers {
  onAgain(): void;
  onMenu(): void;
}

export function createResultScreen(handlers: ResultHandlers): ResultScreen {
  const heading = need<HTMLElement>('#result-heading');
  const time = need<HTMLElement>('#result-time');
  const stats = need<HTMLElement>('#result-stats');
  const record = need<HTMLElement>('#result-record');

  need<HTMLButtonElement>('#result-again').addEventListener('click', () => handlers.onAgain());
  need<HTMLButtonElement>('#result-menu').addEventListener('click', () => handlers.onMenu());

  const row = (term: string, value: string): void => {
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');
    dd.textContent = value;
    stats.append(dt, dd);
  };

  const render = (
    result: RaceResult,
    circuit: Circuit,
    isRecord: boolean,
    previous: RecordEntry | null,
  ): void => {
    heading.replaceChildren(
      document.createTextNode(
        result.timedOut ? 'Tijd om — ' : `${placeLabel(result.position)} plaats `,
      ),
      time,
    );
    time.textContent = formatTime(result.seconds);

    stats.replaceChildren();
    row('Circuit', CIRCUIT_LABELS[circuit]);
    row('Goed', `${result.stats.correct} van ${result.stats.asked}`);
    row('Accuraatheid', formatPercent(result.stats.accuracy));
    row('Gemiddelde reactietijd', formatSeconds(result.stats.averageReaction));
    if (result.stats.slowest !== null) {
      row('Langzaamste som', `${result.stats.slowest.question.text} — ${formatSeconds(result.stats.slowest.seconds)}`);
    }
    if (!isRecord && previous !== null) {
      row('Persoonlijk record', formatTime(previous.seconds));
    }

    // De recordregel verschijnt alleen als de tijd het vorige record verbetert.
    record.hidden = !isRecord;
  };

  return { render };
}

export interface PortraitHint {
  /** Geeft terug of het overlay nu zichtbaar is. */
  update(): boolean;
}

export function createPortraitHint(): PortraitHint {
  const overlay = need<HTMLElement>('#portrait-hint');
  const update = (): boolean => {
    // Staand: hoger dan breed. Dan pauzeert de simulatie.
    const portrait = window.innerHeight > window.innerWidth;
    overlay.hidden = !portrait;
    return portrait;
  };
  return { update };
}
