import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relatieve base zodat de app onder elk pad kan draaien (row1.dev/rekenrace/).
  base: './',
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
