/**
 * Persoonlijke records en instellingen in localStorage.
 * Het versienummer zit in de key, zodat een wijziging van het formaat oude data
 * niet stukmaakt maar gewoon naast zich neerlegt.
 */

import { OPPONENTS, STORAGE, UI } from '../config.ts';
import { CIRCUITS, type Circuit } from '../engine/questions.ts';

export interface RecordEntry {
  /** Beste tijd in seconden. */
  readonly seconds: number;
  readonly accuracy: number;
  /** ISO-datum van de dag waarop het record gezet is. */
  readonly date: string;
}

export type Records = Partial<Record<Circuit, RecordEntry>>;

export interface Settings {
  readonly opponentCount: number;
  readonly muted: boolean;
  readonly autoSubmit: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  opponentCount: 2,
  muted: false,
  autoSubmit: UI.autoSubmit,
};

/** Het stukje Storage-API dat we echt gebruiken. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface RecordStore {
  records(): Records;
  best(circuit: Circuit): RecordEntry | null;
  /** Slaat de tijd op als hij het vorige record verbetert. Geeft terug of dat zo was. */
  submit(circuit: Circuit, entry: RecordEntry): boolean;
  settings(): Settings;
  saveSettings(settings: Settings): void;
  clear(): void;
}

/** Valt terug op een geheugenopslag als localStorage niet mag of niet bestaat. */
export function defaultStorage(): StorageLike {
  try {
    const probe = '__rekenrace__';
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return memoryStorage();
  }
}

export function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

function isCircuit(value: string): value is Circuit {
  return (CIRCUITS as readonly string[]).includes(value);
}

function parseRecords(raw: string | null): Records {
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const out: Records = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!isCircuit(key) || typeof value !== 'object' || value === null) continue;
      const entry = value as Partial<RecordEntry>;
      if (typeof entry.seconds !== 'number' || !Number.isFinite(entry.seconds) || entry.seconds <= 0) continue;
      out[key] = {
        seconds: entry.seconds,
        accuracy: typeof entry.accuracy === 'number' ? entry.accuracy : 0,
        date: typeof entry.date === 'string' ? entry.date : '',
      };
    }
    return out;
  } catch {
    // Onleesbare data negeren we liever dan dat we het spel laten crashen.
    return {};
  }
}

function parseSettings(raw: string | null): Settings {
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_SETTINGS;
    const value = parsed as Partial<Settings>;
    const count =
      typeof value.opponentCount === 'number'
        ? Math.min(OPPONENTS.maxCount, Math.max(OPPONENTS.minCount, Math.round(value.opponentCount)))
        : DEFAULT_SETTINGS.opponentCount;
    return {
      opponentCount: count,
      muted: typeof value.muted === 'boolean' ? value.muted : DEFAULT_SETTINGS.muted,
      autoSubmit: typeof value.autoSubmit === 'boolean' ? value.autoSubmit : DEFAULT_SETTINGS.autoSubmit,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function createRecordStore(storage: StorageLike = defaultStorage()): RecordStore {
  const read = (): Records => parseRecords(storage.getItem(STORAGE.recordsKey));

  const write = (records: Records): void => {
    try {
      storage.setItem(STORAGE.recordsKey, JSON.stringify(records));
    } catch {
      // Vol of geblokkeerd: dan gaat het record verloren, maar het spel loopt door.
    }
  };

  return {
    records: read,
    best: (circuit) => read()[circuit] ?? null,
    submit: (circuit, entry) => {
      const records = read();
      const current = records[circuit];
      if (current !== undefined && current.seconds <= entry.seconds) return false;
      write({ ...records, [circuit]: entry });
      return true;
    },
    settings: () => parseSettings(storage.getItem(STORAGE.settingsKey)),
    saveSettings: (settings) => {
      try {
        storage.setItem(STORAGE.settingsKey, JSON.stringify(settings));
      } catch {
        // Zie boven: niet kunnen opslaan mag het spel niet breken.
      }
    },
    clear: () => {
      storage.removeItem(STORAGE.recordsKey);
      storage.removeItem(STORAGE.settingsKey);
    },
  };
}
