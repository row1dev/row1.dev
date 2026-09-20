/**
 * Alle tuningwaarden van het spel staan hier, en nergens anders.
 * Engelse namen in de code, Nederlandse teksten in de UI.
 */

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Maximaal aantal simulatiestappen per frame, zodat een lange pauze niet tot een freeze leidt. */
export const MAX_TICKS_PER_FRAME = 5;

/** Vangnet tegen een race die nooit eindigt. */
export const RACE = {
  /**
   * Harde bovengrens op de duur van een race. Ruim gekozen: wie zonder benzine
   * komt te staan legt de rest van de baan te voet af.
   */
  maxTicks: 60 * 900,
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

  /** Een raket die vertrekt: een korte veeg omhoog. */
  launch: { from: 220, to: 880, duration: 0.18, gain: 0.5 },
  /** Zelf geraakt worden: een lage klap. */
  hit: { from: 180, to: 60, duration: 0.35, gain: 0.75 },
  /** Tegen een steen of de muur: kort en dof. */
  bump: { from: 140, to: 80, duration: 0.09, gain: 0.45 },
  /** De kart is op: een zakkend drieklankje. */
  wreck: { steps: [440, 330, 220, 165], step: 0.1, gain: 0.6 },
} as const;

export const STORAGE = {
  /** Versienummer zit in de key, zodat een formaatwijziging oude records niet stukmaakt. */
  recordsKey: 'rekenrace.records.v1',
  // v2: het aantal tegenstanders heet nu rivalCount in plaats van opponentCount.
  settingsKey: 'rekenrace.settings.v2',
} as const;

/**
 * Kleuren van de baan en de sprites. Staan hier zodat canvas en CSS uit dezelfde
 * bron putten en er nergens een losse hex-waarde rondslingert.
 */
export const THEME = {
  /** Woestijn van bovenaf: zand met rotswanden langs de baan. */
  sand: '#e8a03c',
  canyon: '#6a4b35',
  canyonEdge: '#8d6647',
  garageFloor: '#5b5b66',
  garageWall: '#3e3e47',
  sign: '#2b4a8f',
  dog: '#3d7de0',
  dogDark: '#2a5ba8',
  dogBelly: '#bcd8ff',
  wrong: '#ff5a5a',
  turbo: '#ffcf3d',
  ink: '#0e1726',
} as const;

/** Elke tegenstander zijn eigen kleur, in dezelfde volgorde als RIVALS.profiles. */
export const RIVAL_COLORS = ['#e0913d', '#c65ad6', '#57c9c1'] as const;

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
  /**
   * Zo lang dat er vijf garages op passen. Langer maakt een race van een
   * kwartier voor wie nog moet nadenken over de sommen.
   */
  length: 9000,

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

  /**
   * Een volle tank haalt de finish niet: daarmee staat vast dat je onderweg
   * minstens twee keer moet tanken, hoe goed je ook rijdt. De test in
   * scaffold.test.ts bewaakt dat tegen de lengte van de baan.
   */
  maxFuel: 60,
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
 * De tegenstanders.
 *
 * Ze stoppen bij elke Rekengarage om bij te tanken, net als jij, maar ze rekenen
 * niet: ze staan er een vaste tijd. Dáár wordt de race beslist. Reken je sneller
 * dan hun pauze, dan win je bij elke garage tijd; doe je er langer over, dan
 * verlies je hem. Zonder die pauze kon je nooit winnen: stoppen voor benzine is
 * verplicht, en elke seconde binnen was er één cadeau aan het veld.
 *
 * Een zwakkere rijder staat langer stil, net zoals hij ook langzamer rijdt.
 *
 * Namen alliteren, net als in het ontwerp, maar zijn van onszelf.
 */
export const RIVALS = {
  profiles: [
    { name: 'Bram de Bever', speedFactor: 0.8, lookahead: 260, skill: 0.7, rocketEverySeconds: 15, garagePauseSeconds: 11 },
    { name: 'Kaat de Kraai', speedFactor: 0.86, lookahead: 300, skill: 0.85, rocketEverySeconds: 12, garagePauseSeconds: 9 },
    { name: 'Sil de Slang', speedFactor: 0.92, lookahead: 340, skill: 0.95, rocketEverySeconds: 9, garagePauseSeconds: 7.5 },
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
