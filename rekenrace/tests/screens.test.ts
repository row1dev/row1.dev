// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMenu, createPortraitHint, createResultScreen, createScreens } from '../src/ui/screens.ts';
import type { RaceResult } from '../src/engine/race.ts';

/** Tests draaien tegen de echte index.html, niet tegen een nagebouwde fixture. */
// In de jsdom-omgeving is import.meta.url een http-URL, dus gaan we via de projectmap.
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

function mountPage(): void {
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>'));
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/g, '');
}

function fakeResult(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    position: 2,
    seconds: 98,
    timedOut: false,
    racers: [],
    stats: {
      garageSeconds: 12,
      asked: 27,
      correct: 24,
      accuracy: 24 / 27,
      averageReaction: 2.4,
      slowest: {
        seconds: 6.1,
        question: { kind: 'multiply', left: 7, right: 8, answer: 56, text: '7 × 8' },
      },
    },
    ...overrides,
  };
}

describe('schermen', () => {
  beforeEach(mountPage);

  it('toont er altijd precies één', () => {
    const screens = createScreens();
    for (const name of ['menu', 'race', 'garage', 'result'] as const) {
      screens.show(name);
      expect(screens.current()).toBe(name);
      const visible = ['#screen-menu', '#screen-race', '#screen-garage', '#screen-result'].filter(
        (selector) => !document.querySelector<HTMLElement>(selector)!.hidden,
      );
      expect(visible).toEqual([`#screen-${name}`]);
    }
  });
});

describe('startscherm', () => {
  beforeEach(mountPage);

  it('toont vier circuits met hun record, of "nog nooit"', () => {
    const menu = createMenu({ onStart: vi.fn(), onRivalCount: vi.fn(), onToggleMute: vi.fn() });
    menu.render({ tables: { seconds: 104, accuracy: 0.9, date: '2026-01-01' } }, 2, false);

    const cards = [...document.querySelectorAll('.circuit')];
    expect(cards).toHaveLength(4);
    expect(cards.map((c) => c.querySelector('.circuit-name')?.textContent)).toEqual([
      'Tafelbaan',
      'Optelcircuit',
      'Deelparcours',
      'Grand Prix',
    ]);
    expect(cards[0]?.querySelector('.circuit-record')?.textContent).toBe('PR 01:44');
    expect(cards[2]?.querySelector('.circuit-record')?.textContent).toBe('nog nooit');
  });

  it('start een race met één tap op een circuit, zonder bevestigingsscherm', () => {
    const onStart = vi.fn();
    createMenu({ onStart, onRivalCount: vi.fn(), onToggleMute: vi.fn() });
    document.querySelectorAll<HTMLButtonElement>('.circuit')[1]?.click();
    expect(onStart).toHaveBeenCalledExactlyOnceWith('addition');
  });

  it('laat het aantal tegenstanders kiezen en markeert de keuze', () => {
    const onRivalCount = vi.fn();
    const menu = createMenu({ onStart: vi.fn(), onRivalCount, onToggleMute: vi.fn() });
    menu.render({}, 3, false);

    const chips = [...document.querySelectorAll<HTMLButtonElement>('#rival-chips .chip')];
    expect(chips.map((c) => c.textContent)).toEqual(['1', '2', '3']);
    expect(chips[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(chips[0]?.getAttribute('aria-pressed')).toBe('false');

    chips[0]?.click();
    expect(onRivalCount).toHaveBeenCalledWith(1);
  });

  it('toont de geluidsstatus', () => {
    const menu = createMenu({ onStart: vi.fn(), onRivalCount: vi.fn(), onToggleMute: vi.fn() });
    menu.render({}, 2, false);
    expect(document.querySelector('#menu-mute-label')?.textContent).toBe('geluid aan');
    menu.render({}, 2, true);
    expect(document.querySelector('#menu-mute-label')?.textContent).toBe('geluid uit');
  });
});

describe('resultaatscherm', () => {
  beforeEach(mountPage);

  it('toont plaats, tijd en de statistieken van de race', () => {
    const screen = createResultScreen({ onAgain: vi.fn(), onMenu: vi.fn() });
    screen.render(fakeResult(), 'tables', false, null);

    expect(document.querySelector('#result-heading')?.textContent).toContain('2e plaats');
    expect(document.querySelector('#result-time')?.textContent).toBe('01:38');

    const stats = document.querySelector('#result-stats')?.textContent ?? '';
    expect(stats).toContain('24 van 27');
    expect(stats).toContain('89%');
    expect(stats).toContain('2,4 s');
    expect(stats).toContain('7 × 8');
    expect(stats).toContain('6,1 s');
  });

  it('toont de recordregel alleen bij een nieuw record', () => {
    const screen = createResultScreen({ onAgain: vi.fn(), onMenu: vi.fn() });
    const record = document.querySelector<HTMLElement>('#result-record')!;

    screen.render(fakeResult(), 'tables', false, { seconds: 90, accuracy: 1, date: '2026-01-01' });
    expect(record.hidden).toBe(true);
    expect(document.querySelector('#result-stats')?.textContent).toContain('01:30');

    screen.render(fakeResult(), 'tables', true, null);
    expect(record.hidden).toBe(false);
  });

  it('meldt een afgebroken race in plaats van een plaats', () => {
    const screen = createResultScreen({ onAgain: vi.fn(), onMenu: vi.fn() });
    screen.render(fakeResult({ timedOut: true }), 'tables', false, null);
    expect(document.querySelector('#result-heading')?.textContent).toContain('Tijd om');
  });

  it('koppelt de knoppen Opnieuw en Ander circuit', () => {
    const onAgain = vi.fn();
    const onMenu = vi.fn();
    createResultScreen({ onAgain, onMenu });
    document.querySelector<HTMLButtonElement>('#result-again')?.click();
    document.querySelector<HTMLButtonElement>('#result-menu')?.click();
    expect(onAgain).toHaveBeenCalledOnce();
    expect(onMenu).toHaveBeenCalledOnce();
  });
});

describe('houd-je-telefoon-rechtop', () => {
  beforeEach(mountPage);

  const setViewport = (width: number, height: number): void => {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
  };

  it('verschijnt liggend en verdwijnt staand', () => {
    const hint = createPortraitHint();
    const overlay = document.querySelector<HTMLElement>('#portrait-hint')!;

    // Dit spel speelt rechtop: liggend vragen we je te draaien.
    setViewport(844, 390);
    expect(hint.update()).toBe(true);
    expect(overlay.hidden).toBe(false);

    setViewport(390, 844);
    expect(hint.update()).toBe(false);
    expect(overlay.hidden).toBe(true);
  });
});
