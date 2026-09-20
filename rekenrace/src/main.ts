/**
 * Startpunt: koppelt de engine aan de renderlaag en de DOM-UI.
 * De simulatie loopt op een vaste timestep, losgekoppeld van requestAnimationFrame.
 */

import './style.css';
import { MAX_TICKS_PER_FRAME, TICK_MS } from './config.ts';
import { answerDigits, type Circuit } from './engine/questions.ts';
import { createRace, type Race } from './engine/race.ts';
import { createRenderer, type Renderer } from './render/canvas.ts';
import { createHud, createQuestionPanel } from './ui/hud.ts';
import { createNumpad, type Numpad } from './ui/numpad.ts';
import { createMenu, createPortraitHint, createResultScreen, createScreens } from './ui/screens.ts';
import { createRecordStore, type Settings } from './storage/records.ts';

function need<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`element ontbreekt: ${selector}`);
  return element;
}

function boot(): void {
  const store = createRecordStore();
  let settings: Settings = store.settings();

  const screens = createScreens();
  const hud = createHud(need<HTMLElement>('#hud'));
  const panel = createQuestionPanel(need<HTMLElement>('#question'));
  const portraitHint = createPortraitHint();
  const canvas = need<HTMLCanvasElement>('#track-canvas');
  const renderer: Renderer = createRenderer(canvas);

  let race: Race | null = null;
  let circuit: Circuit = 'tables';
  /** Teller die bij elke race oploopt, zodat je niet twee keer dezelfde sommen krijgt. */
  let raceCount = 0;
  let paused = false;
  let resultShown = false;

  const numpad: Numpad = createNumpad(need<HTMLElement>('#numpad'), {
    autoSubmit: settings.autoSubmit,
    onChange: () => refreshQuestion(),
    onSubmit: (value) => submitAnswer(value),
  });

  const menu = createMenu({
    onStart: (chosen) => startRace(chosen),
    onOpponentCount: (count) => {
      settings = { ...settings, opponentCount: count };
      store.saveSettings(settings);
      renderMenu();
    },
    onToggleMute: () => toggleMute(),
  });

  const resultScreen = createResultScreen({
    onAgain: () => startRace(circuit),
    onMenu: () => showMenu(),
  });

  function renderMenu(): void {
    menu.render(store.records(), settings.opponentCount, settings.muted);
    hud.setMuted(settings.muted);
  }

  function toggleMute(): void {
    settings = { ...settings, muted: !settings.muted };
    store.saveSettings(settings);
    renderMenu();
  }

  function showMenu(): void {
    race = null;
    screens.show('menu');
    renderMenu();
  }

  function startRace(chosen: Circuit): void {
    circuit = chosen;
    raceCount += 1;
    resultShown = false;
    race = createRace({
      seed: `${chosen}:${Date.now()}:${raceCount}`,
      circuit: chosen,
      opponentCount: settings.opponentCount,
    });
    numpad.clear();
    numpad.setEnabled(true);
    screens.show('race');
    renderer.resize();
    refreshQuestion();
  }

  function refreshQuestion(): void {
    if (race === null) return;
    const view = race.view();
    panel.update(view, numpad.entry);
    numpad.setExpectedDigits(answerDigits(view.question.answer));
  }

  function submitAnswer(value: number): void {
    if (race === null) return;
    const outcome = race.answer(value);
    if (outcome === null) return;
    if (outcome.correct) panel.flashCorrect();
    else panel.flashWrong();
    refreshQuestion();
  }

  function finishRace(): void {
    if (race === null || resultShown) return;
    const result = race.view().result;
    if (result === null) return;
    resultShown = true;

    const previous = store.best(circuit);
    // Een afgebroken race telt niet mee voor de records.
    const isRecord =
      !result.timedOut &&
      store.submit(circuit, {
        seconds: result.seconds,
        accuracy: result.stats.accuracy,
        date: new Date().toISOString().slice(0, 10),
      });

    resultScreen.render(result, circuit, isRecord, previous);
    screens.show('result');
  }

  // ---- Lus met vaste timestep ----

  let lastFrame = performance.now();
  let accumulator = 0;

  function frame(now: number): void {
    requestAnimationFrame(frame);

    const delta = Math.min(250, now - lastFrame);
    lastFrame = now;

    if (race === null || screens.current() !== 'race') return;
    const view = race.view();

    if (paused) {
      // Tijdens een pauze loopt de tijd niet door: de accumulator blijft leeg.
      accumulator = 0;
      renderer.draw(view, now);
      return;
    }

    accumulator += delta;
    let steps = 0;
    while (accumulator >= TICK_MS && steps < MAX_TICKS_PER_FRAME) {
      race.tick();
      accumulator -= TICK_MS;
      steps += 1;
    }
    // Na een lange onderbreking niet alsnog alles inhalen.
    if (steps === MAX_TICKS_PER_FRAME) accumulator = 0;

    const fresh = race.view();
    hud.update(fresh);
    numpad.setEnabled(fresh.phase === 'running');
    refreshQuestion();
    renderer.draw(fresh, now);

    if (fresh.phase === 'finished') finishRace();
  }

  // ---- Omgeving ----

  const syncPause = (): void => {
    const portrait = portraitHint.update();
    paused = portrait || document.visibilityState === 'hidden';
  };

  window.addEventListener('resize', () => {
    renderer.resize();
    syncPause();
  });
  window.addEventListener('orientationchange', () => {
    renderer.resize();
    syncPause();
  });
  document.addEventListener('visibilitychange', syncPause);
  need<HTMLButtonElement>('#hud-mute').addEventListener('click', () => toggleMute());

  // Een fysiek toetsenbord is handig op de desktop en kost bijna niets.
  window.addEventListener('keydown', (event) => {
    if (screens.current() !== 'race' || paused) return;
    if (numpad.handleKey(event.key)) event.preventDefault();
  });

  renderer.resize();
  syncPause();
  showMenu();
  requestAnimationFrame(frame);
}

boot();
