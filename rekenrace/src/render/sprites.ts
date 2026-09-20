/**
 * Sprites worden in code getekend, niet uit plaatjes geladen: scheelt assets,
 * schaalt scherp mee met devicePixelRatio en houdt alle art origineel.
 *
 * Alles tekent in een lokale ruimte van ongeveer 64 breed bij 44 hoog, met de
 * oorsprong op de grond onder het midden van de sprite.
 */

import { THEME } from '../config.ts';

export const SPRITE_WIDTH = 64;
export const SPRITE_HEIGHT = 44;

export type EarShape = 'floppy' | 'long' | 'pointy' | 'spiky';
export type TailShape = 'curl' | 'puff' | 'bushy' | 'none';

export interface RunnerSkin {
  readonly body: string;
  readonly shade: string;
  readonly belly: string;
  readonly ears: EarShape;
  readonly tail: TailShape;
}

export const BLUE_DOG: RunnerSkin = {
  body: THEME.dog,
  shade: THEME.dogDark,
  belly: THEME.dogBelly,
  ears: 'floppy',
  tail: 'curl',
};

/** Maakt een tegenstander-skin uit één kleur. */
export function opponentSkin(color: string, index: number): RunnerSkin {
  const ears: EarShape[] = ['long', 'pointy', 'spiky'];
  const tails: TailShape[] = ['puff', 'bushy', 'none'];
  return {
    body: color,
    shade: shade(color, -0.25),
    belly: shade(color, 0.45),
    ears: ears[index % ears.length]!,
    tail: tails[index % tails.length]!,
  };
}

/** Maakt een hexkleur lichter (amount > 0) of donkerder (amount < 0). */
export function shade(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  const num = Number.parseInt(full, 16);
  const channel = (shift: number): number => {
    const base = (num >> shift) & 0xff;
    const mixed = amount >= 0 ? base + (255 - base) * amount : base * (1 + amount);
    return Math.round(Math.min(255, Math.max(0, mixed)));
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawLeg(ctx: CanvasRenderingContext2D, x: number, swing: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, -14);
  ctx.lineTo(x + swing * 7, -4);
  ctx.lineTo(x + swing * 9, 0);
  ctx.stroke();
  ctx.restore();
}

function drawEars(ctx: CanvasRenderingContext2D, skin: RunnerSkin, bob: number): void {
  ctx.fillStyle = skin.shade;
  switch (skin.ears) {
    case 'floppy':
      ellipse(ctx, 18, -30 + bob, 5, 9, skin.shade);
      break;
    case 'long':
      ctx.save();
      ctx.translate(20, -34 + bob);
      ctx.rotate(-0.35);
      ellipse(ctx, 0, -6, 3.5, 12, skin.shade);
      ctx.restore();
      break;
    case 'pointy':
      ctx.beginPath();
      ctx.moveTo(15, -32 + bob);
      ctx.lineTo(22, -44 + bob);
      ctx.lineTo(26, -30 + bob);
      ctx.closePath();
      ctx.fill();
      break;
    case 'spiky':
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-6 + i * 7, -26 + bob);
        ctx.lineTo(-10 + i * 7, -38 + bob);
        ctx.lineTo(-1 + i * 7, -28 + bob);
        ctx.closePath();
        ctx.fill();
      }
      break;
  }
}

function drawTail(ctx: CanvasRenderingContext2D, skin: RunnerSkin, wag: number): void {
  ctx.save();
  ctx.translate(-22, -22);
  ctx.rotate(wag * 0.4);
  switch (skin.tail) {
    case 'curl':
      ctx.strokeStyle = skin.body;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-10, -4, -8, -14);
      ctx.stroke();
      break;
    case 'puff':
      ellipse(ctx, -7, -3, 6, 6, skin.belly);
      break;
    case 'bushy':
      ctx.save();
      ctx.rotate(-0.4);
      ellipse(ctx, -12, -2, 12, 6, skin.body);
      ellipse(ctx, -20, -2, 5, 4, skin.belly);
      ctx.restore();
      break;
    case 'none':
      break;
  }
  ctx.restore();
}

export interface RunnerPose {
  /** Fase van de loopcyclus in radialen; loopt door met de snelheid. */
  readonly phase: number;
  /** 0 = stilstand, 1 = topsnelheid. Bepaalt hoe gestrekt de sprite staat. */
  readonly effort: number;
  /** True tijdens turbo: dan komt er een extra gloed omheen. */
  readonly turbo: boolean;
  /** True tijdens de strafperiode: dan hangt de sprite wat achterover. */
  readonly braking: boolean;
}

/**
 * Tekent een rennend dier. De oorsprong ligt op de grond onder de sprite en
 * de sprite kijkt naar rechts.
 */
export function drawRunner(ctx: CanvasRenderingContext2D, skin: RunnerSkin, pose: RunnerPose): void {
  const bob = Math.sin(pose.phase * 2) * (1 + pose.effort * 1.5);
  const lean = pose.braking ? -0.12 : pose.effort * 0.14;

  ctx.save();
  if (pose.turbo) {
    // Additieve gloed met een zachte rand; een vlakke ellips oogt als een plas.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, -22, 4, 0, -22, 44);
    glow.addColorStop(0, 'rgba(255, 207, 61, 0.55)');
    glow.addColorStop(0.55, 'rgba(255, 207, 61, 0.18)');
    glow.addColorStop(1, 'rgba(255, 207, 61, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, -22, 46, 30, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Schaduw op de grond, losgekoppeld van het stuiteren van het lijf.
  ctx.save();
  ctx.globalAlpha = 0.25;
  ellipse(ctx, 0, 1, 24, 4, '#000000');
  ctx.restore();

  ctx.rotate(lean);
  ctx.translate(0, bob);

  // Achterste poten eerst, zodat ze achter het lijf vallen.
  drawLeg(ctx, -12, Math.sin(pose.phase), skin.shade);
  drawLeg(ctx, 10, Math.sin(pose.phase + Math.PI), skin.shade);

  drawTail(ctx, skin, Math.sin(pose.phase * 2));

  // Romp.
  ellipse(ctx, -2, -22, 22, 13, skin.body);
  ellipse(ctx, -2, -17, 16, 7, skin.belly);

  // Voorste poten.
  drawLeg(ctx, -4, Math.sin(pose.phase + Math.PI * 0.5), skin.body);
  drawLeg(ctx, 16, Math.sin(pose.phase + Math.PI * 1.5), skin.body);

  // Kop.
  ellipse(ctx, 18, -28 + bob * 0.4, 11, 10, skin.body);
  ellipse(ctx, 27, -25 + bob * 0.4, 6, 5, skin.belly);
  drawEars(ctx, skin, bob * 0.4);

  // Neus en oog.
  ellipse(ctx, 32, -25 + bob * 0.4, 2.5, 2.5, THEME.ink);
  ellipse(ctx, 21, -31 + bob * 0.4, 1.8, 1.8, THEME.ink);

  ctx.restore();
}

/** Stofwolkje achter een remmende racer. */
export function drawDust(ctx: CanvasRenderingContext2D, seed: number, strength: number): void {
  ctx.save();
  ctx.globalAlpha = 0.5 * strength;
  for (let i = 0; i < 4; i += 1) {
    const t = (seed + i * 0.27) % 1;
    ellipse(ctx, -26 - t * 30, -6 - t * 10, 4 + t * 10, 3 + t * 7, '#d8ccb4');
  }
  ctx.restore();
}
