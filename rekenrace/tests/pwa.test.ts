import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

const html = read('index.html');
const manifest: Record<string, unknown> = JSON.parse(read('public/manifest.webmanifest'));

describe('manifest', () => {
  it('start liggend en schermvullend vanaf het homescreen', () => {
    expect(manifest['name']).toBe('Blue Dog Rekenrace');
    expect(manifest['orientation']).toBe('landscape');
    expect(manifest['display']).toBe('fullscreen');
    expect(manifest['lang']).toBe('nl');
  });

  it('gebruikt relatieve paden, zodat de app onder elk pad kan draaien', () => {
    expect(manifest['start_url']).toBe('./');
    expect(manifest['scope']).toBe('./');
  });

  it('verwijst naar iconen die er echt zijn', () => {
    const icons = manifest['icons'] as Array<{ src: string; sizes: string; purpose?: string }>;
    expect(icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of icons) {
      expect(() => read(`public/${icon.src}`)).not.toThrow();
    }
    // Android wil een maskable icoon, anders knipt het launcher-masker het af.
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
    expect(icons.some((i) => i.sizes === '512x512')).toBe(true);
    expect(icons.some((i) => i.sizes === '192x192')).toBe(true);
  });
});

describe('index.html', () => {
  it('heeft de viewport-meta met viewport-fit=cover', () => {
    expect(html).toContain('width=device-width, initial-scale=1, viewport-fit=cover');
  });

  it('koppelt het manifest en de iconen', () => {
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('manifest.webmanifest');
    expect(html).toContain('apple-touch-icon');
  });

  it('gebruikt nergens een invoerveld', () => {
    // Een <input> opent op iOS het systeemtoetsenbord en zoomt het scherm in.
    expect(html).not.toMatch(/<input/i);
    expect(html).not.toMatch(/<textarea/i);
  });

  it('is in het Nederlands', () => {
    expect(html).toContain('lang="nl"');
    expect(html).toContain('Draai je telefoon');
  });
});

describe('service worker', () => {
  const sw = read('src/sw-template.js');

  it('houdt de precache-lijst en het versienummer als bouwplaatshouders', () => {
    expect(sw).toContain('__PRECACHE__');
    expect(sw).toContain('__VERSION__');
  });

  it('negeert Vary bij elke cache-match', () => {
    // Zonder ignoreVary mist de cache juist de CSS en de JS, en start de app
    // offline zonder opmaak. Zie de toelichting in het bestand zelf.
    expect(sw).toContain('ignoreVary: true');
    const calls = sw.split('\n').filter((line) => line.includes('caches.match('));
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) expect(call).toContain('MATCH');
  });

  it('ruimt oude caches op bij activatie', () => {
    expect(sw).toContain('caches.delete');
    expect(sw).toContain('skipWaiting');
    expect(sw).toContain('clients.claim');
  });
});
