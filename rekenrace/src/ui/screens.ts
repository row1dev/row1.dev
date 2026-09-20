/**
 * Schermen: menu, garage, startsein en resultaat. Alleen DOM, geen spellogica.
 */

import { RIVALS } from '../config.ts';
import type { GarageSession } from '../engine/garage.ts';
import type { Kart } from '../engine/kart.ts';
import { CIRCUITS, CIRCUIT_LABELS, type Circuit } from '../engine/questions.ts';
import type { RaceResult } from '../engine/race.ts';
import type { RecordEntry, Records } from '../storage/records.ts';
import { colorFor, formatPercent, formatSeconds, formatTime } from './hud.ts';

export type ScreenName = 'menu' | 'race' | 'garage' | 'result';

function need<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`element ontbreekt: ${selector}`);
  return element;
}

const ORDINALS = ['', '1e', '2e', '3e', '4e'] as const;

export function placeLabel(position: number): string {
  return ORDINALS[position] ?? `${position}e`;
}

export interface Screens {
  show(name: ScreenName): void;
  current(): ScreenName;
}

export function createScreens(): Screens {
  const elements: Record<ScreenName, HTMLElement> = {
    menu: need<HTMLElement>('#screen-menu'),
    race: need<HTMLElement>('#screen-race'),
    garage: need<HTMLElement>('#screen-garage'),
    result: need<HTMLElement>('#screen-result'),
  };
  let active: ScreenName = 'menu';

  return {
    show: (name) => {
      active = name;
      for (const [key, element] of Object.entries(elements)) element.hidden = key !== name;
    },
    current: () => active,
  };
}

export interface MenuHandlers {
  onStart(circuit: Circuit): void;
  onRivalCount(count: number): void;
  onToggleMute(): void;
}

export interface Menu {
  render(records: Records, rivalCount: number, muted: boolean): void;
}

export function createMenu(handlers: MenuHandlers): Menu {
  const list = need<HTMLElement>('#circuit-list');
  const chips = need<HTMLElement>('#rival-chips');
  const muteButton = need<HTMLButtonElement>('#menu-mute');
  const muteLabel = need<HTMLElement>('#menu-mute-label');

  const records = new Map<Circuit, HTMLElement>();
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
    records.set(circuit, record);
  }

  const countButtons: HTMLButtonElement[] = [];
  for (let count = 1; count <= RIVALS.profiles.length; count += 1) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = String(count);
    chip.setAttribute('aria-label', `${count} tegenstander${count === 1 ? '' : 's'}`);
    chip.addEventListener('click', () => handlers.onRivalCount(count));
    chips.append(chip);
    countButtons.push(chip);
  }

  muteButton.addEventListener('click', () => handlers.onToggleMute());

  return {
    render: (saved, rivalCount, muted) => {
      for (const [circuit, element] of records) {
        const best = saved[circuit];
        element.textContent = best === undefined ? 'nog nooit' : `PR ${formatTime(best.seconds)}`;
      }
      countButtons.forEach((chip, index) => {
        const selected = index + 1 === rivalCount;
        chip.classList.toggle('selected', selected);
        chip.setAttribute('aria-pressed', String(selected));
      });
      muteLabel.textContent = muted ? 'geluid uit' : 'geluid aan';
      muteButton.setAttribute('aria-pressed', String(muted));
      const icon = muteButton.firstElementChild;
      if (icon !== null) icon.textContent = muted ? '🔇' : '🔊';
    },
  };
}

/** Het startsein: drie rode lampen en dan groen. */
export interface StartLights {
  update(lit: number, visible: boolean): void;
}

export function createStartLights(): StartLights {
  const root = need<HTMLElement>('#lights');
  const lamps = Array.from({ length: 4 }, () => {
    const lamp = document.createElement('span');
    lamp.className = 'lamp';
    root.append(lamp);
    return lamp;
  });

  return {
    update: (lit, visible) => {
      root.hidden = !visible;
      if (!visible) return;
      lamps.forEach((lamp, index) => {
        const on = index < lit;
        // Het laatste lampje is groen: dat is het startsein.
        lamp.className = `lamp${on ? ' on' : ''}${index === lamps.length - 1 ? ' go' : ''}`;
      });
    },
  };
}

const PRIZE_ICONS: Readonly<Record<string, string>> = {
  fuel: '⛽',
  rocket: '🚀',
  boost: '⚡',
  repair: '🔧',
  kart: '🏎️',
};

export interface GaragePanel {
  update(session: GarageSession, kart: Kart): void;
}

export function createGaragePanel(onLeave: () => void): GaragePanel {
  const kind = need<HTMLElement>('#garage-kind');
  const icon = need<HTMLElement>('#prize-icon');
  const label = need<HTMLElement>('#prize-label');
  const fuel = need<HTMLElement>('#garage-fuel');
  const condition = need<HTMLElement>('#garage-condition');
  const rockets = need<HTMLElement>('#garage-rockets');
  const boosts = need<HTMLElement>('#garage-boosts');
  const answered = need<HTMLElement>('#garage-answered');

  need<HTMLButtonElement>('#garage-leave').addEventListener('click', onLeave);

  const set = (element: HTMLElement, text: string): void => {
    if (element.textContent !== text) element.textContent = text;
  };

  return {
    update: (session, kart) => {
      set(kind, session.garage.kind === 'finish' ? 'finishstation' : 'tussenstation');
      set(icon, PRIZE_ICONS[session.reward.kind] ?? '❓');
      const amount = session.reward.kind === 'fuel' ? ` ${session.reward.amount}` : '';
      set(label, `${session.reward.label}${amount}`);

      set(fuel, String(Math.floor(kart.fuel)));
      set(condition, String(Math.round(kart.condition)));
      set(rockets, String(kart.rockets));
      set(boosts, String(kart.boosts));
      set(answered, String(session.answered));

      condition.classList.toggle('low', kart.condition <= 30);
      fuel.classList.toggle('low', kart.fuel <= 20);
    },
  };
}

export interface ResultHandlers {
  onAgain(): void;
  onMenu(): void;
}

export interface ResultScreen {
  render(result: RaceResult, circuit: Circuit, isRecord: boolean, previous: RecordEntry | null): void;
}

export function createResultScreen(handlers: ResultHandlers): ResultScreen {
  const heading = need<HTMLElement>('#result-heading');
  const time = need<HTMLElement>('#result-time');
  const podium = need<HTMLElement>('#podium');
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

  return {
    render: (result, circuit, isRecord, previous) => {
      heading.replaceChildren(
        document.createTextNode(result.timedOut ? 'Tijd om — ' : `${placeLabel(result.position)} plaats `),
        time,
      );
      time.textContent = formatTime(result.seconds);

      // De uitslag van het veld, met de speler gemarkeerd.
      podium.replaceChildren();
      for (const racer of result.racers) {
        const item = document.createElement('li');
        item.className = racer.isPlayer ? 'podium-row me' : 'podium-row';

        const dot = document.createElement('span');
        dot.className = 'podium-dot';
        dot.style.background = colorFor(racer.name, racer.isPlayer);

        const name = document.createElement('span');
        name.className = 'podium-name';
        name.textContent = racer.name;

        const note = document.createElement('span');
        note.className = 'podium-note';
        // Wie niet over de finish kwam, staat er met zijn afstand.
        note.textContent = racer.finishTick !== null ? placeLabel(racer.position) : `${Math.round(racer.kart.y)}m`;

        item.append(dot, name, note);
        podium.append(item);
      }

      stats.replaceChildren();
      row('Circuit', CIRCUIT_LABELS[circuit]);
      row('Goed', `${result.stats.correct} van ${result.stats.asked}`);
      row('Accuraatheid', formatPercent(result.stats.accuracy));
      row('Gemiddelde reactietijd', formatSeconds(result.stats.averageReaction));
      row('Tijd in de garage', formatTime(result.stats.garageSeconds));
      if (result.stats.slowest !== null) {
        row('Langzaamste som', `${result.stats.slowest.question.text} — ${formatSeconds(result.stats.slowest.seconds)}`);
      }
      if (!isRecord && previous !== null) row('Persoonlijk record', formatTime(previous.seconds));

      record.hidden = !isRecord;
    },
  };
}

export interface PortraitHint {
  /** Geeft terug of het overlay nu zichtbaar is. */
  update(): boolean;
}

export function createPortraitHint(): PortraitHint {
  const overlay = need<HTMLElement>('#portrait-hint');
  return {
    update: () => {
      // Dit spel speelt rechtop: liggend vragen we je te draaien.
      const landscape = window.innerWidth > window.innerHeight;
      overlay.hidden = !landscape;
      return landscape;
    },
  };
}

