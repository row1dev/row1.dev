/**
 * Alle tuningwaarden van het spel staan hier, en nergens anders.
 * Engelse namen in de code, Nederlandse teksten in de UI.
 */

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Maximaal aantal simulatiestappen per frame, zodat een lange pauze niet tot een freeze leidt. */
export const MAX_TICKS_PER_FRAME = 5;

/**
 * Snelheden staan in baan-eenheden per SECONDE, niet per tick.
 * Per tick wordt v / TICK_HZ bij de afstand opgeteld; de drag-factor is wél per tick.
 * Met vBase = 3.0 duurt een race op basistempo 1000 / 3 = 333 s en ligt de
 * ondergrens op vMax 1000 / 9 = 111 s. Dat sluit aan op de recordtijden in het
 * ontwerp (01:44 tot 03:12). Als eenheden per tick zou een hele race 5,5 seconde
 * duren, dus die lezing klopt niet.
 *
 * Wil je kortere races, draai dan aan `distance` — dat is de bedoelde knop.
 */
export const RACE = {
  /** Lengte van een circuit in baan-eenheden, getoond als meters. */
  distance: 1000,
  /** Basistempo van de speler, in eenheden per seconde. */
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
  /**
   * Harde bovengrens op de duur van een race, als vangnet tegen een oneindige lus.
   * Ruim gekozen: wie alles fout beantwoordt zit lang op vBase * penaltyFactor.
   */
  maxTicks: 60 * 900,
} as const;

/**
 * Afstand per circuit. De Grand Prix rijdt de standaardafstand van 1000; de andere
 * circuits zijn korter, zodat een sterke ronde uitkomt rond de recordtijden uit het
 * ontwerp (Tafelbaan 01:44, Optelcircuit 02:07, Grand Prix 03:12).
 */
export const CIRCUIT_DISTANCE: Readonly<Record<string, number>> = {
  tables: 600,
  addition: 750,
  division: 700,
  grandprix: RACE.distance,
};

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
  /** Basistempo van een tegenstander in eenheden per seconde, per moeilijkheidsindex. */
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

/**
 * Geluid wordt volledig gegenereerd met WebAudio: geen audiobestanden en geen
 * externe bibliotheken. Frequenties in hertz, duur in seconden.
 */
export const AUDIO = {
  /** Algemeen volume; alles eronder schaalt hiermee mee. */
  master: 0.22,
  key: { freq: 660, duration: 0.05, gain: 0.25 },
  correct: { from: 523.25, to: 783.99, duration: 0.16, gain: 0.7 },
  wrong: { from: 233.08, to: 110, duration: 0.3, gain: 0.6 },
  /** Oplopend drieklankje bij turbo. */
  turbo: { steps: [523.25, 659.25, 783.99, 1046.5], step: 0.07, gain: 0.55 },
  /** Kort fanfare-motief aan de finish. */
  finish: { steps: [523.25, 659.25, 783.99, 1046.5, 1046.5], step: 0.13, gain: 0.6 },
} as const;

export const STORAGE = {
  /** Versienummer zit in de key, zodat een formaatwijziging oude records niet stukmaakt. */
  recordsKey: 'rekenrace.records.v1',
  settingsKey: 'rekenrace.settings.v1',
} as const;

/**
 * Kleuren van de baan en de sprites. Staan hier zodat canvas en CSS uit dezelfde
 * bron putten en er nergens een losse hex-waarde rondslingert.
 */
export const THEME = {
  skyTop: '#1b3a6b',
  skyBottom: '#5aa9e6',
  sun: '#ffe08a',
  hillsFar: '#2f5d7c',
  hillsNear: '#3f7d5a',
  cloud: '#eaf4ff',
  trackTop: '#6b5a44',
  trackBottom: '#4a3e2f',
  trackLine: '#f2e9d8',
  grass: '#4e8f5e',
  dog: '#3d7de0',
  dogDark: '#2a5ba8',
  dogBelly: '#bcd8ff',
  correct: '#3ddc84',
  wrong: '#ff5a5a',
  turbo: '#ffcf3d',
  ink: '#0e1726',
} as const;

/** Tegenstanders krijgen elk hun eigen kleur, in dezelfde volgorde als OPPONENTS.pace. */
export const OPPONENT_COLORS = ['#e0913d', '#c65ad6', '#57c9c1'] as const;

export const PARALLAX = {
  /** Snelheid van de drie achtergrondlagen ten opzichte van de baan. */
  hillsFar: 0.15,
  hillsNear: 0.35,
  clouds: 0.07,
  /** Hoeveel de baan zelf meeschuift per baan-eenheid, in pixels. */
  trackScale: 1.4,
} as const;
