/**
 * Alle tuningwaarden van het spel staan hier, en nergens anders.
 * Engelse namen in de code, Nederlandse teksten in de UI.
 */

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Maximaal aantal simulatiestappen per frame, zodat een lange pauze niet tot een freeze leidt. */
export const MAX_TICKS_PER_FRAME = 5;

export const RACE = {
  /** Lengte van een circuit in baan-eenheden. */
  distance: 1000,
  /** Basistempo van de speler, in eenheden per tick. */
  vBase: 3.0,
  /** Harde bovengrens op de snelheid van de speler. */
  vMax: 9.0,
  /** Boost bij een goed antwoord, nog te vermenigvuldigen met de snelheidsfactor. */
  vBoost: 2.5,
  /** Per tick keert v met deze factor terug naar vBase. */
  drag: 0.98,
  /** Snelheid tijdens een strafperiode, als fractie van vBase. */
  penaltyFactor: 0.4,
  /** Duur van de strafperiode na een fout antwoord, in ticks. */
  penaltyTicks: 60,
  /** Maximale duur van een race in ticks (2 minuten), als vangnet tegen een oneindige lus. */
  maxTicks: 60 * 120,
} as const;

export const STREAK = {
  /** Aantal goede antwoorden op rij dat turbo geeft. */
  threshold: 5,
  /** Duur van de turbo in ticks. */
  ticks: 90,
} as const;

export const SPEED_FACTOR = {
  /** snelheidsfactor = clamp(base - reactietijd / divisor, min, max) */
  base: 1.6,
  divisor: 5,
  min: 0.4,
  max: 1.6,
} as const;

export const DIFFICULTY = {
  minLevel: 1,
  maxLevel: 5,
  startLevel: 2,
  /** Aantal sommen in het rolling window. */
  windowSize: 10,
  /** Boven deze accuraatheid én onder de mediaan-drempel gaat het niveau omhoog. */
  accuracyUp: 0.9,
  /** Onder deze accuraatheid gaat het niveau omlaag. */
  accuracyDown: 0.6,
  /** Mediane reactietijd in seconden waaronder het niveau omhoog mag. */
  medianTimeUp: 3,
} as const;

export const OPPONENTS = {
  /** Basistempo van een tegenstander in eenheden per tick, per moeilijkheidsindex. */
  pace: [2.6, 3.1, 3.6] as const,
  /** Amplitude van de sinusvariatie op het tempo, zodat een tegenstander niet robotachtig rijdt. */
  paceWobble: 0.25,
  /** Periode van die variatie in ticks. */
  wobbleTicks: 240,
  minCount: 1,
  maxCount: 3,
} as const;

export const UI = {
  /** Hoe lang het juiste antwoord in beeld blijft na een fout, in ms. */
  revealMs: 800,
  /** Duur van de groene "goed"-feedback, in ms. */
  correctFlashMs: 320,
  /** Schermschudding bij turbo. */
  shakePx: 3,
  shakeMs: 400,
  /** Standaard automatisch bevestigen zodra het aantal cijfers klopt. */
  autoSubmit: true,
} as const;

export const STORAGE = {
  /** Versienummer zit in de key, zodat een formaatwijziging oude records niet stukmaakt. */
  recordsKey: 'rekenrace.records.v1',
  settingsKey: 'rekenrace.settings.v1',
} as const;
