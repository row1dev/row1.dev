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

  /** Woestijn van bovenaf: zand met rotswanden langs de baan. */
  sand: '#e8a03c',
  sandDark: '#d18a2c',
  canyon: '#6a4b35',
  canyonEdge: '#8d6647',
  garageFloor: '#5b5b66',
  garageWall: '#3e3e47',
  sign: '#2b4a8f',
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

/* ===========================================================================
 * Vanaf hier het nieuwe spel: een top-down racer waarin de sommen bij de
 * Rekengarage gespeeld worden. Het oude model hierboven (snelheid volgt uit
 * reactietijd) verdwijnt zodra de nieuwe renderlaag klaar is.
 * ======================================================================== */

/**
 * De baan is een corridor: een slingerende middellijn met een halve breedte
 * eromheen. Afstanden in baan-eenheden, waarbij y de rijrichting is.
 */
export const TRACK = {
  length: 12000,

  /**
   * Breedte van de corridor: basis plus een rustige variatie. Ruim genoeg dat er
   * naast een steen in het midden nog een rijlijn overblijft; met een smallere
   * baan drukt `obstacleWallMargin` alle stenen juist naar het midden, precies
   * op de lijn waar je rijdt.
   */
  halfWidthBase: 210,
  halfWidthAmp: 30,
  halfWidthPeriod: 900,

  /**
   * Twee sinussen over elkaar maken een baan die niet voorspelbaar slingert.
   * De amplitudes en periodes zijn zo gekozen dat de middellijn nergens steiler
   * loopt dan ongeveer 33 graden, en dat de bocht die hij vraagt ruim onder de
   * draaisnelheid van een kart op topsnelheid blijft. Beide grenzen staan in de
   * tests; draai je hieraan, dan vallen die om.
   */
  curveAmp1: 100,
  curvePeriod1: 1600,
  curveAmp2: 26,
  curvePeriod2: 620,

  /** Rustige stukken aan het begin en het eind. */
  startClear: 400,
  finishClear: 300,

  /** Rekengarages staan op vaste afstanden; elke derde is een finishstation. */
  garageSpacing: 1600,
  /**
   * De garage beslaat het grootste deel van de corridor. Smaller maakt hem te
   * makkelijk om per ongeluk te missen, en je hébt hem nodig: je start met 30
   * benzine en een hele baan kost er ongeveer honderd. Er blijft aan weerszijden
   * ruimte over om er bewust omheen te rijden.
   */
  garageHalfWidth: 132,
  garageDepth: 110,
  finishEvery: 3,

  /** Richtingspijlen op het wegdek. Puur navigatie, geen botsing. */
  markerSpacing: 240,

  /** Stenen blokkeren, cactussen remmen alleen af. */
  rockSpacing: 190,
  rockRadiusMin: 22,
  rockRadiusMax: 40,
  cactusRadius: 15,
  cactusClusterSpacing: 560,
  cactusClusterMin: 5,
  cactusClusterMax: 13,

  /**
   * Stenen blijven minstens zo ver van de rand dat er een kart langs past.
   * Anders klemt een kart zich vast tussen de steen en de muur, die elkaars
   * correctie elke tick ongedaan maken.
   */
  obstacleWallMargin: 52,

  /** Obstakels worden per y-bak geïndexeerd, zodat een tick niet alles naloopt. */
  binSize: 200,
} as const;

/** Rijgedrag van een kart. Snelheden in eenheden per seconde. */
export const KART = {
  maxSpeed: 220,
  /** Te voet, na pech of zonder benzine. */
  footSpeed: 70,
  turboSpeed: 330,
  accel: 190,
  brakeAccel: 330,

  /** Bochtsnelheid in radialen per seconde, en de snelheid waarbij die vol is. */
  steerRate: 2.4,
  fullSteerSpeed: 60,

  turboTicks: 90,

  maxFuel: 99,
  startFuel: 30,
  /** Hoeveel baan-eenheden je aflegt op één eenheid benzine. */
  unitsPerFuel: 120,

  maxCondition: 100,
  startCondition: 100,
  /**
   * Raketten zijn wat je je kart kost: vier treffers en je loopt. Stenen en
   * muren kosten vooral vaart en maar een beetje conditie — anders sloopt een
   * rijder zichzelf in één race op obstakels, zonder dat er iemand op hem schiet.
   */
  rocketDamage: 25,
  collisionDamage: 1.5,
  wallDamage: 1,
  /** Beneden deze snelheid kost een aanraking geen schade meer. */
  damageSpeed: 50,

  /**
   * Bij een aanraking schuif je langs het oppervlak in plaats van erop te
   * stuiteren: de snelheid loodrecht op de steen of de muur valt weg, de rest
   * blijft op deze factor na staan. Zonder dat glijden ramt een kart met
   * automatisch gas dezelfde steen eindeloos opnieuw en komt hij nooit los.
   */
  slideKeep: 0.82,
  wallSlideKeep: 0.9,
  /**
   * Door een cactusveld ploeg je op dit deel van je topsnelheid. Dit is een
   * plafond, geen factor per tick: dat laatste zou je snelheid binnen een halve
   * seconde tot nul terugbrengen en je in het veld laten stilvallen.
   */
  cactusSpeedKeep: 0.45,
} as const;

/**
 * De Rekengarage. Elke som die je goed hebt levert één voorraaditem op, en wat
 * je aangeboden krijgt hangt af van waar je het krapst in zit: een lege tank
 * levert benzine, een gedeukte kart een reparatie.
 */
export const GARAGE = {
  /** Onder deze standen gaat voorrang naar benzine of naar een reparatie. */
  lowFuel: 20,
  lowCondition: 55,

  /** Een vat benzine is 10 of 15, net als in het ontwerp. */
  fuelAmounts: [10, 15] as const,
  repairAmount: 25,
  rocketAmount: 1,
  boostAmount: 1,

  /**
   * Je kart terugwinnen kan alleen bij een finishstation, en kost een som die
   * een niveau hoger ligt dan je normaal krijgt.
   */
  kartLevelBump: 1,

  /** Hoe vaak elk item aan de beurt komt als je nergens krap in zit. */
  weights: { fuel: 3, rocket: 3, boost: 2 } as const,
} as const;

/**
 * De tegenstanders. Ze rijden de baan door zonder te stoppen: de garage is jouw
 * afweging, niet die van hen. Hun tempo ligt daarom onder dat van een kart op
 * volle snelheid, zodat je de tijd die je binnen verliest kunt terugrijden.
 *
 * Namen alliteren, net als in het ontwerp, maar zijn van onszelf.
 */
export const RIVALS = {
  profiles: [
    { name: 'Bram de Bever', speedFactor: 0.8, lookahead: 260, skill: 0.7, rocketEverySeconds: 15 },
    { name: 'Kaat de Kraai', speedFactor: 0.86, lookahead: 300, skill: 0.85, rocketEverySeconds: 12 },
    { name: 'Sil de Slang', speedFactor: 0.92, lookahead: 340, skill: 0.95, rocketEverySeconds: 9 },
  ],

  /** Kleiner verschil dan dit wordt niet bijgestuurd; anders slingert de kart. */
  steerDeadzone: 0.04,
  /** Extra ruimte die een tegenstander om een steen heen houdt. */
  avoidMargin: 30,

  /** Schietbereik en hoe recht de speler voor de loop moet liggen. */
  fireRange: 700,
  fireCone: 0.3,
} as const;

/** Mini-raketten. Ze vliegen rechtuit; wie geraakt wordt verliest conditie. */
export const ROCKET = {
  speed: 430,
  lifeTicks: 150,
  radius: 22,
} as const;
