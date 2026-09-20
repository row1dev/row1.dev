/**
 * Tekent de baan, de achtergrond in drie parallaxlagen en de sprites.
 * De renderlaag leest alleen uit de engine en schrijft er nooit in.
 */

import { OPPONENT_COLORS, PARALLAX, RACE, THEME, TICK_HZ, UI } from '../config.ts';
import type { RaceView } from '../engine/race.ts';
import { BLUE_DOG, drawDust, drawRunner, opponentSkin, type RunnerSkin } from './sprites.ts';

export interface Renderer {
  /** Past de canvasgrootte aan aan het element en devicePixelRatio. */
  resize(): void;
  /** Tekent één frame. `alpha` is de interpolatie tussen twee ticks. */
  draw(view: RaceView, elapsedMs: number): void;
}

interface Hill {
  readonly x: number;
  readonly width: number;
  readonly height: number;
}

interface Cloud {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** Hoe ver de speler vanaf links op het scherm rijdt, als fractie van de breedte. */
const PLAYER_ANCHOR = 0.28;
/** Zichtbaar stuk baan in baan-eenheden; bepaalt hoe ver een tegenstander wegloopt. */
const VIEW_UNITS = 120;

function buildHills(count: number, seedStep: number, minHeight: number, maxHeight: number): Hill[] {
  // Vaste, niet-willekeurige vorm: de achtergrond hoeft niet per race te verschillen.
  return Array.from({ length: count }, (_, i) => {
    const t = (i * seedStep) % 1;
    return {
      x: i * 180,
      width: 150 + t * 190,
      height: minHeight + t * (maxHeight - minHeight),
    };
  });
}

const FAR_HILLS = buildHills(24, 0.37, 40, 90);
const NEAR_HILLS = buildHills(24, 0.61, 60, 130);
const CLOUDS: readonly Cloud[] = Array.from({ length: 12 }, (_, i) => ({
  x: i * 260,
  y: 20 + ((i * 47) % 70),
  scale: 0.6 + ((i * 31) % 50) / 100,
}));

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('2D-context niet beschikbaar');

  let width = 0;
  let height = 0;
  /** Loopcyclus van de speler; loopt door met de snelheid in plaats van met de tijd. */
  let runPhase = 0;
  let lastElapsed = 0;

  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const drawSky = (): void => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, THEME.skyTop);
    gradient.addColorStop(1, THEME.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(width * 0.82, height * 0.16, Math.min(width, height) * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = THEME.sun;
    ctx.fill();
    ctx.restore();
  };

  const drawClouds = (offset: number): void => {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = THEME.cloud;
    const span = CLOUDS.length * 260;
    for (const cloud of CLOUDS) {
      const x = wrap(cloud.x - offset * PARALLAX.clouds, span);
      const r = 16 * cloud.scale;
      ctx.beginPath();
      ctx.arc(x, cloud.y, r, 0, Math.PI * 2);
      ctx.arc(x + r, cloud.y + 4, r * 0.8, 0, Math.PI * 2);
      ctx.arc(x - r, cloud.y + 5, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  const drawHills = (hills: readonly Hill[], offset: number, factor: number, color: string, baseY: number): void => {
    const span = hills.length * 180;
    ctx.fillStyle = color;
    for (const hill of hills) {
      const x = wrap(hill.x - offset * factor, span);
      ctx.beginPath();
      ctx.moveTo(x - hill.width / 2, baseY);
      ctx.quadraticCurveTo(x, baseY - hill.height, x + hill.width / 2, baseY);
      ctx.closePath();
      ctx.fill();
    }
  };

  /** Houdt een x-positie binnen [-marge, span) zodat de laag naadloos doorloopt. */
  const wrap = (x: number, span: number): number => {
    const margin = 300;
    const shifted = ((x + margin) % span + span) % span;
    return shifted - margin;
  };

  const trackTop = (): number => height * 0.62;

  const drawTrack = (offset: number): void => {
    const top = trackTop();

    ctx.fillStyle = THEME.grass;
    ctx.fillRect(0, top - 10, width, 12);

    const gradient = ctx.createLinearGradient(0, top, 0, height);
    gradient.addColorStop(0, THEME.trackTop);
    gradient.addColorStop(1, THEME.trackBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, top, width, height - top);

    // Streepjes op de baan die met de snelheid meeschuiven.
    ctx.save();
    ctx.fillStyle = THEME.trackLine;
    ctx.globalAlpha = 0.5;
    const spacing = 90;
    const shift = ((offset * PARALLAX.trackScale) % spacing + spacing) % spacing;
    for (let x = -shift; x < width + spacing; x += spacing) {
      ctx.fillRect(x, top + (height - top) * 0.55, 40, 4);
    }
    ctx.restore();
  };

  const drawFinish = (view: RaceView): void => {
    // De finish staat op de eindafstand; alleen tekenen als hij in beeld komt.
    const unitsToGo = view.distance - view.player.distance;
    if (unitsToGo > VIEW_UNITS) return;
    const x = width * PLAYER_ANCHOR + (unitsToGo / VIEW_UNITS) * (width * (1 - PLAYER_ANCHOR));

    const top = trackTop();
    const squares = 6;
    const size = (height - top) / squares;
    for (let i = 0; i < squares; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : THEME.ink;
      ctx.fillRect(x, top + i * size, 14, size);
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 2, top - 70, 4, 70);
  };

  /** Verticale positie van een rijstrook binnen het zichtbare stuk baan. */
  const laneY = (lane: number, lanes: number): number => {
    const top = trackTop();
    const usable = height - top - 10;
    return top + 16 + (usable / Math.max(1, lanes)) * lane;
  };

  const drawRacers = (view: RaceView): void => {
    const lanes = view.racers.length;
    // Van achter naar voren tekenen, zodat de voorste rijstrook bovenop komt.
    const ordered = [...view.racers].sort((a, b) => a.lane - b.lane);
    for (const racer of ordered) {
      const delta = racer.distance - view.player.distance;
      const x = width * PLAYER_ANCHOR + (delta / VIEW_UNITS) * (width * (1 - PLAYER_ANCHOR));
      if (x < -80 || x > width + 80) continue;

      const skin: RunnerSkin = racer.isPlayer
        ? BLUE_DOG
        : opponentSkin(OPPONENT_COLORS[racer.lane % OPPONENT_COLORS.length]!, racer.lane);

      ctx.save();
      ctx.translate(x, laneY(racer.lane, lanes));
      // Sprites in een achterste rijstrook staan iets kleiner: eenvoudig dieptegevoel.
      const depth = 0.82 + (racer.lane / Math.max(1, lanes - 1)) * 0.18;
      const scale = (Math.min(width, height) / 340) * depth;
      ctx.scale(scale, scale);

      if (racer.isPlayer) {
        if (view.penaltyTicksLeft > 0) drawDust(ctx, (view.tick % 60) / 60, 1);
        drawRunner(ctx, skin, {
          phase: runPhase,
          effort: clamp01((view.speed - RACE.vBase) / (RACE.vMax - RACE.vBase)),
          turbo: view.turboTicksLeft > 0,
          braking: view.penaltyTicksLeft > 0,
        });
      } else {
        drawRunner(ctx, skin, {
          phase: runPhase * 0.9 + racer.lane * 1.7,
          effort: 0.4,
          turbo: false,
          braking: false,
        });
      }
      ctx.restore();
    }
  };

  const drawSpeedLines = (view: RaceView): void => {
    const intensity = clamp01((view.speed - RACE.vBase) / (RACE.vMax - RACE.vBase));
    if (intensity <= 0.05) return;
    ctx.save();
    ctx.globalAlpha = 0.18 + intensity * 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i += 1) {
      const y = ((i * 97 + view.tick * (4 + intensity * 14)) % height);
      const len = 30 + intensity * 90;
      ctx.beginPath();
      ctx.moveTo(width - ((view.tick * 6 + i * 130) % (width + len)), y);
      ctx.lineTo(width - ((view.tick * 6 + i * 130) % (width + len)) + len, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const draw = (view: RaceView, elapsedMs: number): void => {
    const dt = Math.min(64, Math.max(0, elapsedMs - lastElapsed));
    lastElapsed = elapsedMs;
    // De loopcyclus versnelt met de snelheid, zodat het rennen bij het tempo past.
    runPhase += (dt / 1000) * (4 + view.speed * 1.6);

    ctx.save();
    if (view.turboTicksLeft > 0) {
      // Schermschudding tijdens de turbo.
      const remaining = view.turboTicksLeft / TICK_HZ;
      const fade = clamp01(remaining / (UI.shakeMs / 1000));
      ctx.translate(
        (Math.random() - 0.5) * 2 * UI.shakePx * fade,
        (Math.random() - 0.5) * 2 * UI.shakePx * fade,
      );
    }

    const offset = view.player.distance * PARALLAX.trackScale;
    drawSky();
    drawClouds(offset);
    drawHills(FAR_HILLS, offset, PARALLAX.hillsFar, THEME.hillsFar, trackTop() + 2);
    drawHills(NEAR_HILLS, offset, PARALLAX.hillsNear, THEME.hillsNear, trackTop() + 6);
    drawTrack(offset);
    drawFinish(view);
    drawRacers(view);
    drawSpeedLines(view);
    ctx.restore();
  };

  return { resize, draw };
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
