/**
 * HUD en somvak: de DOM-laag boven het canvas. Leest alleen uit de engine.
 */

import { OPPONENT_COLORS, STREAK, UI } from '../config.ts';
import type { RaceView } from '../engine/race.ts';

export interface Hud {
  update(view: RaceView): void;
  setMuted(muted: boolean): void;
}

export interface QuestionPanel {
  update(view: RaceView, entry: string): void;
  /** Groene sprong bij een goed antwoord. */
  flashCorrect(): void;
  /** Rode flits bij een fout antwoord. */
  flashWrong(): void;
}

/** Formatteert seconden als mm:ss. */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
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

function need<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`element ontbreekt: ${selector}`);
  return element;
}

export function createHud(root: HTMLElement): Hud {
  const position = need<HTMLElement>(root, '#hud-position');
  const fill = need<HTMLElement>(root, '#hud-progress-fill');
  const markers = need<HTMLElement>(root, '#hud-markers');
  const distance = need<HTMLElement>(root, '#hud-distance');
  const time = need<HTMLElement>(root, '#hud-time');
  const streak = need<HTMLElement>(root, '#hud-streak');
  const mute = need<HTMLButtonElement>(root, '#hud-mute');
  const turbo = need<HTMLElement>(root, '#hud-turbo');
  const turboFill = need<HTMLElement>(root, '#hud-turbo-fill');

  /** Markers worden één keer gemaakt en daarna alleen verschoven. */
  let markerElements = new Map<string, HTMLElement>();

  const ensureMarkers = (view: RaceView): void => {
    if (markerElements.size === view.racers.length) return;
    markers.replaceChildren();
    markerElements = new Map(
      [...view.racers]
        .sort((a, b) => a.lane - b.lane)
        .map((racer) => {
          const marker = document.createElement('div');
          marker.className = racer.isPlayer ? 'hud-marker player' : 'hud-marker';
          if (!racer.isPlayer) {
            marker.style.background = OPPONENT_COLORS[racer.lane % OPPONENT_COLORS.length] ?? '#ffffff';
          }
          markers.append(marker);
          return [racer.id, marker] as const;
        }),
    );
  };

  const update = (view: RaceView): void => {
    ensureMarkers(view);
    // De markers hangen aan de vaste rijstrook van een racer, niet aan zijn positie,
    // die immers elke tick kan wisselen.
    for (const racer of view.racers) {
      const marker = markerElements.get(racer.id);
      if (marker === undefined) continue;
      marker.style.left = `${(racer.distance / view.distance) * 100}%`;
    }

    // Tekst alleen herschrijven als hij verandert: scheelt zestig DOM-schrijfacties
    // per seconde per veld, wat op een telefoon merkbaar is.
    write(position, `P${view.player.position}/${view.racers.length}`);
    fill.style.width = `${(view.player.distance / view.distance) * 100}%`;
    write(distance, `${Math.round(view.player.distance)}m`);
    write(time, formatTime(view.seconds));
    write(streak, `streak x${view.streak}`);
    streak.classList.toggle('hot', view.streak >= STREAK.threshold);

    const turboActive = view.turboTicksLeft > 0;
    turbo.hidden = !turboActive;
    if (turboActive) turboFill.style.width = `${(view.turboTicksLeft / STREAK.ticks) * 100}%`;
  };

  const setMuted = (muted: boolean): void => {
    mute.textContent = muted ? '🔇' : '🔊';
    mute.setAttribute('aria-pressed', String(muted));
  };

  return { update, setMuted };
}

export function createQuestionPanel(root: HTMLElement): QuestionPanel {
  const text = need<HTMLElement>(root, '#question-text');
  const box = need<HTMLElement>(root, '#answer-box');
  let flashTimer: number | undefined;

  const clearFlash = (): void => {
    if (flashTimer !== undefined) window.clearTimeout(flashTimer);
    box.classList.remove('correct', 'wrong');
  };

  const update = (view: RaceView, entry: string): void => {
    write(text, `${view.question.text} =`);
    const revealing = view.phase === 'reveal' || (view.phase === 'finished' && view.revealTicksLeft > 0);
    box.classList.toggle('reveal', revealing);
    // Tijdens de reveal staat het juiste antwoord in het vak, niet de invoer.
    write(box, revealing ? String(view.question.answer) : entry);
  };

  const flashCorrect = (): void => {
    clearFlash();
    box.classList.add('correct');
    flashTimer = window.setTimeout(() => box.classList.remove('correct'), UI.correctFlashMs);
  };

  const flashWrong = (): void => {
    clearFlash();
    box.classList.add('wrong');
    // De rode flits loopt door zolang het juiste antwoord in beeld staat.
    flashTimer = window.setTimeout(() => box.classList.remove('wrong'), UI.revealMs);
  };

  return { update, flashCorrect, flashWrong };
}
