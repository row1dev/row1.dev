import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';

/**
 * Schrijft de service worker met de precache-lijst van deze build erin.
 * Vite hasht de bestandsnamen, dus die lijst kan niet met de hand bijgehouden
 * worden. Scheelt een externe PWA-plugin.
 */
function serviceWorker(): Plugin {
  return {
    name: 'rekenrace-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((name) => !name.endsWith('.map'));
      // public/ komt niet in de bundle voor, dus die bestanden staan hier expliciet.
      const statics = [
        './',
        // De scope-URL en index.html zijn aparte cache-keys; allebei nodig.
        'index.html',
        'manifest.webmanifest',
        'icons/icon.svg',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
      ];
      const precache = [...new Set([...statics, ...assets])];
      const version = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12);

      const source = readFileSync('src/sw-template.js', 'utf8')
        .replaceAll('__PRECACHE__', JSON.stringify(precache, null, 2))
        .replaceAll('__VERSION__', version);

      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  // Relatieve base zodat de app onder elk pad kan draaien (row1.dev/rekenrace/).
  base: './',
  plugins: [serviceWorker()],
  build: {
    target: 'es2022',
    assetsDir: 'assets',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
