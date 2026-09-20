/**
 * Sprites worden in code getekend, niet uit plaatjes geladen: scheelt assets,
 * schaalt scherp mee met devicePixelRatio en houdt alle art origineel.
 *
 * Alles is van bovenaf gezien. Een kart tekent met zijn neus naar +y en wordt
 * door de renderlaag om zijn middelpunt gedraaid.
 */

import { THEME } from '../config.ts';

export interface KartSkin {
  readonly body: string;
  readonly shade: string;
  readonly trim: string;
  /** Kleur van de rijder in het zadel. */
  readonly driver: string;
}

export const BLUE_DOG_SKIN: KartSkin = {
  body: THEME.dog,
  shade: THEME.dogDark,
  trim: THEME.dogBelly,
  driver: '#8fc4ff',
};

export function rivalSkin(color: string): KartSkin {
  return { body: color, shade: shade(color, -0.3), trim: shade(color, 0.5), driver: shade(color, 0.35) };
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

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: string,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

export interface KartPose {
  /** 0 = stilstand, 1 = topsnelheid; bepaalt de uitlaatvlam. */
  readonly effort: number;
  readonly turbo: boolean;
  /** Zonder kart loop je: dan tekenen we het hondje zelf. */
  readonly onFoot: boolean;
  /** Loopt door met de tijd, voor de wielen en de pootjes. */
  readonly phase: number;
}

/** Een kart van bovenaf, neus naar +y, middelpunt op de oorsprong. */
export function drawKart(ctx: CanvasRenderingContext2D, skin: KartSkin, pose: KartPose): void {
  if (pose.onFoot) {
    drawRunner(ctx, skin, pose);
    return;
  }

  ctx.save();

  if (pose.turbo) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, 34);
    glow.addColorStop(0, 'rgba(255, 207, 61, 0.5)');
    glow.addColorStop(1, 'rgba(255, 207, 61, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Uitlaatvlam achter de kart, sterker naarmate je harder gaat.
  const flame = pose.effort * (pose.turbo ? 22 : 12);
  if (flame > 1) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    const fire = ctx.createLinearGradient(0, -12, 0, -12 - flame);
    fire.addColorStop(0, pose.turbo ? '#fff0a8' : '#ffb347');
    fire.addColorStop(1, 'rgba(255, 90, 40, 0)');
    ctx.fillStyle = fire;
    ctx.beginPath();
    ctx.moveTo(-5, -11);
    ctx.lineTo(0, -11 - flame);
    ctx.lineTo(5, -11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.beginPath();
  ctx.ellipse(2, -2, 15, 19, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();

  // Wielen: donkere blokjes die net buiten de carrosserie uitsteken.
  const wheel = (wx: number, wy: number): void => roundedRect(ctx, wx - 4.5, wy - 6, 9, 12, 3, '#1b1b22');
  wheel(-12, -7);
  wheel(12, -7);
  wheel(-11, 9);
  wheel(11, 9);

  // Carrosserie: breed achter, spits naar voren.
  ctx.beginPath();
  ctx.moveTo(0, 20);
  ctx.quadraticCurveTo(11, 12, 11, -2);
  ctx.lineTo(10, -13);
  ctx.quadraticCurveTo(0, -17, -10, -13);
  ctx.lineTo(-11, -2);
  ctx.quadraticCurveTo(-11, 12, 0, 20);
  ctx.closePath();
  ctx.fillStyle = skin.body;
  ctx.fill();

  // Neuskegel en een streep over de motorkap.
  roundedRect(ctx, -3, 8, 6, 10, 3, skin.trim);
  roundedRect(ctx, -8, -12, 16, 6, 3, skin.shade);

  // De rijder in het zadel.
  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fillStyle = skin.driver;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 2, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = skin.shade;
  ctx.fill();

  ctx.restore();
}

/** Zonder kart loop je zelf, van bovenaf gezien. */
function drawRunner(ctx: CanvasRenderingContext2D, skin: KartSkin, pose: KartPose): void {
  const swing = Math.sin(pose.phase * 2.5) * 4;

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.ellipse(1, -1, 9, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();

  // Pootjes die heen en weer gaan.
  roundedRect(ctx, -8, -4 + swing, 5, 9, 2.5, skin.shade);
  roundedRect(ctx, 3, -4 - swing, 5, 9, 2.5, skin.shade);

  // Lijf en kop.
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 11, 0, 0, Math.PI * 2);
  ctx.fillStyle = skin.body;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 9, 6, 0, Math.PI * 2);
  ctx.fillStyle = skin.body;
  ctx.fill();

  // Oren en snuit.
  roundedRect(ctx, -7, 8, 4, 7, 2, skin.shade);
  roundedRect(ctx, 3, 8, 4, 7, 2, skin.shade);
  ctx.beginPath();
  ctx.arc(0, 14, 2.4, 0, Math.PI * 2);
  ctx.fillStyle = THEME.ink;
  ctx.fill();
}

/** Een mini-raket, neus naar +y. */
export function drawRocket(ctx: CanvasRenderingContext2D, phase: number): void {
  ctx.save();
  ctx.globalAlpha = 0.8;
  const trail = ctx.createLinearGradient(0, -6, 0, -22);
  trail.addColorStop(0, 'rgba(255, 190, 90, 0.9)');
  trail.addColorStop(1, 'rgba(255, 120, 40, 0)');
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(-3, -5);
  ctx.lineTo(0, -20 - Math.sin(phase * 8) * 4);
  ctx.lineTo(3, -5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(0, 9);
  ctx.lineTo(3.5, 0);
  ctx.lineTo(3.5, -6);
  ctx.lineTo(-3.5, -6);
  ctx.lineTo(-3.5, 0);
  ctx.closePath();
  ctx.fillStyle = THEME.wrong;
  ctx.fill();
  roundedRect(ctx, -1.4, -6, 2.8, 4, 1, '#ffffff');
}

/** Een cactus van bovenaf: een bol met armen. */
export function drawCactus(ctx: CanvasRenderingContext2D, radius: number): void {
  ctx.fillStyle = '#2f8f4e';
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.62, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 3; i += 1) {
    const angle = (i / 3) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * radius * 0.6, Math.sin(angle) * radius * 0.6, radius * 0.34, radius * 0.24, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#3fae63';
  ctx.beginPath();
  ctx.arc(-radius * 0.15, -radius * 0.15, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Een steen van bovenaf. */
export function drawRock(ctx: CanvasRenderingContext2D, radius: number, seed: number): void {
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.ellipse(radius * 0.18, -radius * 0.18, radius, radius * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  // Een licht onregelmatige vorm, vast per steen via de seed.
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const wobble = 0.82 + ((Math.sin(seed * 12.9898 + i * 4.1414) + 1) / 2) * 0.3;
    const px = Math.cos(angle) * radius * wobble;
    const py = Math.sin(angle) * radius * wobble;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = '#8a6b4f';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(-radius * 0.25, -radius * 0.25, radius * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = '#a5845f';
  ctx.fill();
}
