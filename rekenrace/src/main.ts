/**
 * Startpunt: koppelt de engine aan de renderlaag en de DOM-UI.
 * De simulatie loopt op een vaste timestep, losgekoppeld van requestAnimationFrame.
 */

import './style.css';
import { MAX_TICKS_PER_FRAME, TICK_MS } from './config.ts';
import { answerDigits, type Circuit } from './engine/questions.ts';
import { createRace, NO_RACE_INPUT, type Race } from './engine/race.ts';
import { createRenderer, type Renderer } from './render/canvas.ts';
import { createGauges, createHud, createQuestionPanel } from './ui/hud.ts';
import { createControls } from './ui/controls.ts';
import { createNumpad, type Numpad } from './ui/numpad.ts';
import {
  createGaragePanel,
  createMenu,
  createPortraitHint,
  createResultScreen,
  createScreens,
  createStartLights,
} from './ui/screens.ts';
import { createRecordStore, type Settings } from './storage/records.ts';
import { createSfx } from './audio/sfx.ts';

function need<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`element ontbreekt: ${selector}`);
  return element;
}

function boot(): void {
  const store = createRecordStore();
  let settings: Settings = store.settings();
  const sfx = createSfx();
  sfx.setMuted(settings.muted);

  const screens = createScreens();
  const hud = createHud();
  const gauges = createGauges();
  const panel = createQuestionPanel();
  const lights = createStartLights();
  const portraitHint = createPortraitHint();
  const canvas = need<HTMLCanvasElement>('#track-canvas');
  const renderer: Renderer = createRenderer(canvas);
  const toast = need<HTMLElement>('#toast');

  let race: Race | null = null;
  let circuit: Circuit = 'tables';
  let raceCount = 0;
  let paused = false;
  let resultShown = false;
  let toastTimer: number | undefined;

  const controls = createControls({ onAction: () => sfx.key() });

  const numpad: Numpad = createNumpad(need<HTMLElement>('#numpad'), {
    autoSubmit: settings.autoSubmit,
    onChange: () => refreshGarage(),
    onKey: () => sfx.key(),
    onSubmit: (value) => submitAnswer(value),
  });

  const garagePanel = createGaragePanel(() => leaveGarage());

  const menu = createMenu({
    onStart: (chosen) => startRace(chosen),
    onRivalCount: (count) => {
      settings = { ...settings, rivalCount: count };
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
    menu.render(store.records(), settings.rivalCount, settings.muted);
  }

  function toggleMute(): void {
    settings = { ...settings, muted: !settings.muted };
    sfx.setMuted(settings.muted);
    store.saveSettings(settings);
    renderMenu();
  }

  function showMenu(): void {
    race = null;
    screens.show('menu');
    renderMenu();
  }

  function say(message: string): void {
    toast.textContent = message;
    toast.hidden = false;
    if (toastTimer !== undefined) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      toast.hidden = true;
    }, 1800);
  }

  function startRace(chosen: Circuit): void {
    circuit = chosen;
    raceCount += 1;
    resultShown = false;
    race = createRace({
      seed: `${chosen}:${Date.now()}:${raceCount}`,
      circuit: chosen,
      rivalCount: settings.rivalCount,
    });
    numpad.clear();
    controls.setEnabled(true);
    screens.show('race');
    renderer.resize();
    toast.hidden = true;
    lastCondition = Infinity;
    lastRockets = 0;
    lastHadKart = true;
    wasGarage = false;
  }

  function leaveGarage(): void {
    if (race === null) return;
    race.leaveGarage();
    numpad.clear();
    screens.show('race');
    controls.setEnabled(true);
  }

  function refreshGarage(): void {
    if (race === null) return;
    const view = race.view();
    if (view.garage === null) return;
    panel.update(view.garage, numpad.entry);
    garagePanel.update(view.garage, view.player.kart);
    numpad.setExpectedDigits(answerDigits(view.garage.question.answer));
  }

  function submitAnswer(value: number): void {
    if (race === null) return;
    const outcome = race.answer(value);
    if (outcome === null) return;
    if (outcome.correct) {
      panel.flashCorrect();
      // Je kart terugwinnen klinkt anders dan een vaatje benzine.
      if (outcome.earned?.kind === 'kart') sfx.turbo();
      else sfx.correct();
      if (outcome.earned !== null) say(`${outcome.earned.label} +${outcome.earned.amount}`);
    } else {
      panel.flashWrong();
      sfx.wrong();
    }
    refreshGarage();
  }

  function finishRace(): void {
    if (race === null || resultShown) return;
    const result = race.view().result;
    if (result === null) return;
    resultShown = true;

    const previous = store.best(circuit);
    const isRecord =
      !result.timedOut &&
      store.submit(circuit, {
        seconds: result.seconds,
        accuracy: result.stats.accuracy,
        date: new Date().toISOString().slice(0, 10),
      });

    sfx.finish();
    resultScreen.render(result, circuit, isRecord, previous);
    screens.show('result');
  }

  // ---- Lus met vaste timestep ----

  let lastFrame = performance.now();
  let accumulator = 0;
  let wasGarage = false;
  /** Vorige stand, om te horen wat er deze frame gebeurd is. */
  let lastCondition = Infinity;
  let lastRockets = 0;
  let lastHadKart = true;
  let bumpCooldown = 0;

  function frame(now: number): void {
    requestAnimationFrame(frame);

    const delta = Math.min(250, now - lastFrame);
    lastFrame = now;

    const screen = screens.current();
    if (race === null || (screen !== 'race' && screen !== 'garage')) return;

    if (paused) {
      accumulator = 0;
      renderer.draw(race.view(), now);
      return;
    }

    accumulator += delta;
    let steps = 0;
    while (accumulator >= TICK_MS && steps < MAX_TICKS_PER_FRAME) {
      // In de garage stuurt niemand; daarbuiten leest hij de knoppen.
      race.tick(screens.current() === 'garage' ? NO_RACE_INPUT : controls.read());
      accumulator -= TICK_MS;
      steps += 1;
    }
    if (steps === MAX_TICKS_PER_FRAME) accumulator = 0;

    const view = race.view();

    // De garage opent en sluit vanuit de engine, dus het scherm volgt de fase.
    const inGarage = view.phase === 'garage';
    if (inGarage !== wasGarage) {
      wasGarage = inGarage;
      if (inGarage) {
        numpad.clear();
        controls.setEnabled(false);
        screens.show('garage');
        sfx.key();
      }
    }

    hud.update(view);
    gauges.update(view);
    controls.setAmmo(view.player.kart.rockets, view.player.kart.boosts);
    lights.update(view.lightsLit, view.phase === 'countdown');

    if (inGarage) refreshGarage();
    else renderer.draw(view, now);

    reportEvents(view, steps);

    if (view.phase === 'finished') finishRace();
  }

  /**
   * Laat horen en zien wat er met de kart gebeurt. De engine houdt geen lijst
   * van gebeurtenissen bij, dus we vergelijken de stand met die van het vorige
   * frame — dat is genoeg voor geluid en een melding.
   */
  function reportEvents(view: ReturnType<Race['view']>, steps: number): void {
    const kart = view.player.kart;
    if (bumpCooldown > 0) bumpCooldown -= steps;

    // Een eigen raket die vertrekt: het aantal loopt terug buiten de garage om.
    if (kart.rockets < lastRockets && !inGarageNow(view)) sfx.launch();
    lastRockets = kart.rockets;

    // Een flinke hap uit de conditie is een raket; een schrammetje is een botsing.
    if (lastCondition !== Infinity && kart.condition < lastCondition - 0.5) {
      const lost = lastCondition - kart.condition;
      if (lost >= 10) {
        sfx.hit();
        say('Geraakt!');
      } else if (bumpCooldown <= 0) {
        sfx.bump();
        bumpCooldown = 20;
      }
    }
    lastCondition = kart.condition;

    if (lastHadKart && !kart.hasKart) {
      sfx.wreck();
      say('Je kart is op — ren naar een finishstation');
    }
    lastHadKart = kart.hasKart;
  }

  function inGarageNow(view: ReturnType<Race['view']>): boolean {
    return view.phase === 'garage';
  }

  // ---- Omgeving ----

  const syncPause = (): void => {
    const landscape = portraitHint.update();
    paused = landscape || document.visibilityState === 'hidden';
  };

  window.addEventListener('resize', () => {
    renderer.resize();
    syncPause();
  });
  window.addEventListener('orientationchange', () => {
    renderer.resize();
    syncPause();
  });
  if ('ResizeObserver' in window) new ResizeObserver(() => renderer.resize()).observe(canvas);

  document.addEventListener('visibilitychange', syncPause);
  window.addEventListener('pagehide', syncPause);
  window.addEventListener('blur', syncPause);
  window.addEventListener('focus', syncPause);

  // Geen dubbeltik-zoom, geen pinch-zoom en geen contextmenu tijdens het spelen.
  document.addEventListener('gesturestart', (event) => event.preventDefault());
  document.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener(
    'touchmove',
    (event) => {
      if (event.touches.length > 1) event.preventDefault();
    },
    { passive: false },
  );

  // Een fysiek toetsenbord is handig op de desktop en kost bijna niets.
  window.addEventListener('keydown', (event) => {
    if (paused) return;
    if (screens.current() === 'garage') {
      if (numpad.handleKey(event.key)) event.preventDefault();
      return;
    }
    if (screens.current() === 'race' && controls.handleKey(event.key, true)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (screens.current() === 'race' && controls.handleKey(event.key, false)) event.preventDefault();
  });

  // De AudioContext mag pas bij het eerste gebaar starten; daarna blijft hij staan.
  const unlockAudio = (): void => sfx.unlock();
  document.addEventListener('pointerdown', unlockAudio, { capture: true });
  document.addEventListener('keydown', unlockAudio, { capture: true });

  renderer.resize();
  syncPause();
  showMenu();
  requestAnimationFrame(frame);
}

/**
 * Registreert de service worker zodat de app vanaf het homescreen offline start.
 * Alleen in een productiebuild: tijdens ontwikkeling zit een worker in de weg.
 */
function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(new URL('sw.js', window.location.href), { scope: './' }).catch(() => {
      // Geen worker betekent alleen: niet offline speelbaar. Het spel werkt verder.
    });
  });
}

boot();
registerServiceWorker();
