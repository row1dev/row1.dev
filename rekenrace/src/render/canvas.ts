/**
 * Tekent de baan van bovenaf, staand. De camera volgt de speler, die iets onder
 * het midden rijdt zodat je ruim vooruit kijkt.
 *
 * De renderlaag leest alleen uit de engine en schrijft er nooit in.
 */

import { OPPONENT_COLORS, RIVALS, THEME, TICK_HZ, TRACK, UI } from '../config.ts';

import type { RaceView } from '../engine/race.ts';
import type { Track } from '../engine/track.ts';
import { BLUE_DOG_SKIN, drawCactus, drawKart, drawRock, drawRocket, rivalSkin } from './sprites.ts';

export interface Renderer {
  resize(): void;
  draw(view: RaceView, elapsedMs: number): void;
}

/** Waar de speler op het scherm staat, als fractie van de hoogte vanaf boven. */
const PLAYER_ANCHOR = 0.72;
/** Breedste corridor die we moeten kunnen tonen, plus wat berm. */
const VIEW_WIDTH = (TRACK.halfWidthBase + TRACK.halfWidthAmp) * 2 + 220;

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('2D-context niet beschikbaar');

  let width = 0;
  let height = 0;
  let scale = 1;
  let phase = 0;
  let lastElapsed = 0;

  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Zo veel schalen dat de breedste corridor altijd in beeld past.
    scale = width / VIEW_WIDTH;
  };

  /** Zet een wereldpunt om naar schermcoördinaten. y loopt op het scherm omlaag. */
  const project = (worldX: number, worldY: number, cameraX: number, cameraY: number): [number, number] => [
    width / 2 + (worldX - cameraX) * scale,
    height * PLAYER_ANCHOR - (worldY - cameraY) * scale,
  ];

  const drawGround = (): void => {
    ctx.fillStyle = THEME.sand;
    ctx.fillRect(0, 0, width, height);
  };

  /** De rotswanden links en rechts van de corridor. */
  const drawWalls = (track: Track, camX: number, camY: number, fromY: number, toY: number): void => {
    const step = 30;

    for (const side of [-1, 1] as const) {
      // De rand van het scherm waar deze wand tegenaan ligt, ruim buiten beeld.
      const outer = side < 0 ? -60 : width + 60;

      // Trace de baanrand van boven naar beneden en sluit af langs de schermrand.
      // Beginnen bij de schermrand en dan pas de wand tracen levert een polygoon
      // op die zichzelf kruist, en dat tekent als bruine banen dwars over de baan.
      ctx.beginPath();
      let started = false;
      for (let y = toY; y >= fromY; y -= step) {
        const [sx, sy] = project(track.centerX(y) + side * track.halfWidth(y), y, camX, camY);
        if (started) ctx.lineTo(sx, sy);
        else {
          ctx.moveTo(sx, sy);
          started = true;
        }
      }
      ctx.lineTo(outer, height + 60);
      ctx.lineTo(outer, -60);
      ctx.closePath();
      ctx.fillStyle = THEME.canyon;
      ctx.fill();

      // Een lichtere richel langs de rand, zodat de baangrens afleesbaar is.
      ctx.beginPath();
      started = false;
      for (let y = toY; y >= fromY; y -= step) {
        const [sx, sy] = project(track.centerX(y) + side * track.halfWidth(y), y, camX, camY);
        if (started) ctx.lineTo(sx, sy);
        else {
          ctx.moveTo(sx, sy);
          started = true;
        }
      }
      ctx.strokeStyle = THEME.canyonEdge;
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  /** Richtingspijlen op het wegdek. Puur navigatie, geen botsing. */
  const drawMarkers = (track: Track, camX: number, camY: number, fromY: number, toY: number): void => {
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#ffffff';
    for (const marker of track.markers) {
      if (marker.y < fromY || marker.y > toY) continue;
      const [sx, sy] = project(marker.x, marker.y, camX, camY);
      for (const offset of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx + offset * 13, sy + 9 * scale * 2);
        ctx.lineTo(sx + offset * 13 - 9, sy - 2);
        ctx.lineTo(sx + offset * 13 + 9, sy - 2);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  };

  const drawObstacles = (track: Track, camX: number, camY: number, fromY: number, toY: number): void => {
    const span = (toY - fromY) / 2;
    for (const obstacle of track.obstaclesNear(fromY + span, span + 200)) {
      if (obstacle.y < fromY - 60 || obstacle.y > toY + 60) continue;
      const [sx, sy] = project(obstacle.x, obstacle.y, camX, camY);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(scale, scale);
      if (obstacle.kind === 'solid') drawRock(ctx, obstacle.radius, obstacle.y);
      else drawCactus(ctx, obstacle.radius);
      ctx.restore();
    }
  };

  /** De Rekengarage: een poort dwars over de baan met een bord erboven. */
  const drawGarages = (track: Track, camX: number, camY: number, fromY: number, toY: number): void => {
    for (const garage of track.garages) {
      if (garage.y < fromY - 200 || garage.y > toY + 200) continue;
      const center = track.centerX(garage.y);
      const [sx, sy] = project(center, garage.y, camX, camY);
      const halfW = garage.halfWidth * scale;
      const halfD = (garage.depth / 2) * scale;

      ctx.save();
      ctx.translate(sx, sy);

      // Vloer van de garage.
      ctx.fillStyle = THEME.garageFloor;
      ctx.fillRect(-halfW, -halfD, halfW * 2, halfD * 2);

      // Zijmuren.
      ctx.fillStyle = THEME.garageWall;
      ctx.fillRect(-halfW - 8, -halfD, 8, halfD * 2);
      ctx.fillRect(halfW, -halfD, 8, halfD * 2);

      // Markeringshoeken op de vloer.
      ctx.strokeStyle = '#7de08a';
      ctx.lineWidth = 3;
      for (const cornerY of [-halfD * 0.5, halfD * 0.5]) {
        for (const cornerX of [-halfW * 0.6, halfW * 0.6]) {
          ctx.beginPath();
          ctx.moveTo(cornerX - 8 * Math.sign(cornerX || 1), cornerY);
          ctx.lineTo(cornerX, cornerY);
          ctx.lineTo(cornerX, cornerY - 8 * Math.sign(cornerY || 1));
          ctx.stroke();
        }
      }

      // Bord boven de ingang.
      const signW = Math.max(96, halfW * 1.7);
      ctx.fillStyle = THEME.sign;
      ctx.beginPath();
      ctx.roundRect(-signW / 2, -halfD - 34, signW, 30, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+ − × :', 0, -halfD - 26);
      ctx.fillStyle = garage.kind === 'finish' ? THEME.turbo : '#cfe4ff';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.fillText(garage.kind === 'finish' ? 'REKENGARAGE ★' : 'REKENGARAGE', 0, -halfD - 13);
      ctx.restore();
    }
  };

  const drawFinish = (track: Track, camX: number, camY: number, toY: number): void => {
    if (track.length > toY + 200) return;
    const center = track.centerX(track.length);
    const edge = track.halfWidth(track.length);
    const [left, sy] = project(center - edge, track.length, camX, camY);
    const [right] = project(center + edge, track.length, camX, camY);

    const squares = 10;
    const cell = (right - left) / squares;
    for (let row = 0; row < 2; row += 1) {
      for (let i = 0; i < squares; i += 1) {
        ctx.fillStyle = (i + row) % 2 === 0 ? '#ffffff' : THEME.ink;
        ctx.fillRect(left + i * cell, sy + row * 12 - 12, cell, 12);
      }
    }
  };

  const drawRacers = (view: RaceView, camX: number, camY: number): void => {
    // Van achter naar voren, zodat de leider bovenop komt.
    const ordered = [...view.racers].sort((a, b) => a.kart.y - b.kart.y);
    for (const racer of ordered) {
      const [sx, sy] = project(racer.kart.x, racer.kart.y, camX, camY);
      if (sy < -80 || sy > height + 80) continue;

      const rivalIndex = RIVALS.profiles.findIndex((profile) => profile.name === racer.name);
      const skin = racer.isPlayer
        ? BLUE_DOG_SKIN
        : rivalSkin(OPPONENT_COLORS[Math.max(0, rivalIndex) % OPPONENT_COLORS.length]!);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-racer.kart.heading);
      ctx.scale(scale * 1.6, scale * 1.6);
      drawKart(ctx, skin, {
        effort: Math.min(1, racer.kart.speed / 220),
        turbo: racer.kart.turboTicksLeft > 0,
        onFoot: racer.kart.onFoot,
        phase,
      });
      ctx.restore();

      // Naamlabel boven een tegenstander, zodat je weet wie je inhaalt.
      if (!racer.isPlayer) {
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = '#ffffff';
        ctx.font = '600 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(racer.name.split(' ')[0] ?? '', sx, sy - 26);
        ctx.restore();
      }
    }
  };

  const drawRockets = (view: RaceView, camX: number, camY: number): void => {
    for (const rocket of view.rockets) {
      const [sx, sy] = project(rocket.x, rocket.y, camX, camY);
      if (sy < -40 || sy > height + 40) continue;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-rocket.heading);
      ctx.scale(scale * 1.6, scale * 1.6);
      drawRocket(ctx, phase);
      ctx.restore();
    }
  };

  const draw = (view: RaceView, elapsedMs: number): void => {
    const dt = Math.min(64, Math.max(0, elapsedMs - lastElapsed));
    lastElapsed = elapsedMs;
    phase += dt / 1000;

    const track = view.track;
    const kart = view.player.kart;
    const camX = track.centerX(kart.y);
    const camY = kart.y;

    ctx.save();
    // Schermschudding tijdens de turbo.
    if (kart.turboTicksLeft > 0 && !reducedMotion()) {
      const elapsedTurbo = 1 - kart.turboTicksLeft / (UI.shakeMs / 1000) / TICK_HZ;
      const fade = Math.max(0, Math.min(1, 1 - elapsedTurbo));
      ctx.translate((Math.random() - 0.5) * 2 * UI.shakePx * fade, (Math.random() - 0.5) * 2 * UI.shakePx * fade);
    }

    // Hoeveel baan er boven en onder de camera in beeld past.
    const aheadY = camY + (height * PLAYER_ANCHOR) / scale;
    const behindY = camY - (height * (1 - PLAYER_ANCHOR)) / scale;

    drawGround();
    drawWalls(track, camX, camY, behindY - 200, aheadY + 200);
    drawMarkers(track, camX, camY, behindY, aheadY);
    drawGarages(track, camX, camY, behindY, aheadY);
    drawFinish(track, camX, camY, aheadY);
    drawObstacles(track, camX, camY, behindY, aheadY);
    drawRockets(view, camX, camY);
    drawRacers(view, camX, camY);
    ctx.restore();
  };

  return { resize, draw };
}

/** Respecteert de systeeminstelling voor minder beweging. */
function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

