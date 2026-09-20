import { describe, expect, it } from 'vitest';
import { STORAGE } from '../src/config.ts';
import {
  DEFAULT_SETTINGS,
  createRecordStore,
  memoryStorage,
  type StorageLike,
} from '../src/storage/records.ts';

function store() {
  const storage = memoryStorage();
  return { storage, records: createRecordStore(storage) };
}

const entry = (seconds: number) => ({ seconds, accuracy: 0.9, date: '2026-09-20' });

describe('records', () => {
  it('begint leeg', () => {
    const { records } = store();
    expect(records.records()).toEqual({});
    expect(records.best('tables')).toBeNull();
  });

  it('slaat een eerste tijd altijd op', () => {
    const { records } = store();
    expect(records.submit('tables', entry(104))).toBe(true);
    expect(records.best('tables')?.seconds).toBe(104);
  });

  it('slaat alleen een snellere tijd op', () => {
    const { records } = store();
    records.submit('tables', entry(104));
    expect(records.submit('tables', entry(120))).toBe(false);
    expect(records.best('tables')?.seconds).toBe(104);
    expect(records.submit('tables', entry(98))).toBe(true);
    expect(records.best('tables')?.seconds).toBe(98);
  });

  it('telt een gelijke tijd niet als nieuw record', () => {
    const { records } = store();
    records.submit('tables', entry(104));
    expect(records.submit('tables', entry(104))).toBe(false);
  });

  it('houdt de circuits uit elkaar', () => {
    const { records } = store();
    records.submit('tables', entry(104));
    records.submit('grandprix', entry(192));
    expect(records.best('tables')?.seconds).toBe(104);
    expect(records.best('grandprix')?.seconds).toBe(192);
    expect(records.best('division')).toBeNull();
  });

  it('gebruikt een key met versienummer', () => {
    const { storage, records } = store();
    records.submit('tables', entry(104));
    expect(STORAGE.recordsKey).toMatch(/\.v\d+$/);
    expect(storage.getItem(STORAGE.recordsKey)).not.toBeNull();
  });

  it('negeert onleesbare of onzinnige opgeslagen data', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE.recordsKey, 'dit is geen json');
    expect(createRecordStore(storage).records()).toEqual({});

    storage.setItem(STORAGE.recordsKey, JSON.stringify({ tables: { seconds: 'snel' }, onzin: { seconds: 5 } }));
    expect(createRecordStore(storage).records()).toEqual({});

    storage.setItem(STORAGE.recordsKey, JSON.stringify({ tables: { seconds: -3 } }));
    expect(createRecordStore(storage).records()).toEqual({});
  });

  it('blijft werken als opslaan niet mag', () => {
    const blocked: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined,
    };
    const records = createRecordStore(blocked);
    // Geen exception: een geweigerde opslag mag het spel niet breken.
    expect(() => records.submit('tables', entry(104))).not.toThrow();
    expect(records.best('tables')).toBeNull();
  });
});

describe('instellingen', () => {
  it('valt terug op de standaardwaarden', () => {
    const { records } = store();
    expect(records.settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('bewaart en leest instellingen terug', () => {
    const { records } = store();
    records.saveSettings({ opponentCount: 3, muted: true, autoSubmit: false });
    expect(records.settings()).toEqual({ opponentCount: 3, muted: true, autoSubmit: false });
  });

  it('klemt het aantal tegenstanders uit opgeslagen data', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE.settingsKey, JSON.stringify({ opponentCount: 99 }));
    expect(createRecordStore(storage).settings().opponentCount).toBe(3);

    storage.setItem(STORAGE.settingsKey, JSON.stringify({ opponentCount: 0 }));
    expect(createRecordStore(storage).settings().opponentCount).toBe(1);
  });

  it('negeert kapotte instellingen', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE.settingsKey, '{{{');
    expect(createRecordStore(storage).settings()).toEqual(DEFAULT_SETTINGS);
  });

  it('wist records en instellingen', () => {
    const { storage, records } = store();
    records.submit('tables', entry(104));
    records.saveSettings({ opponentCount: 1, muted: true, autoSubmit: true });
    records.clear();
    expect(storage.getItem(STORAGE.recordsKey)).toBeNull();
    expect(records.records()).toEqual({});
    expect(records.settings()).toEqual(DEFAULT_SETTINGS);
  });
});
