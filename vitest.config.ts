import { defineConfig } from 'vitest/config';

// Windows: a terminal opened as `c:\…` and Vite's resolved `C:\…` paths make v8 count every
// source file twice (once at 0%), which fails the coverage gate. Pin the root to an uppercase drive.
const root = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());

export default defineConfig({
  root,
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['tests/e2e/**/*', 'node_modules/**/*'],
    // Migrate the isolated test database once, then point every worker at it.
    globalSetup: ['tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    // API test files share one database and each resets it, so run files one at a time.
    fileParallelism: false,
    // Explicit so test-only fixture routes are mounted regardless of the .env value.
    env: { NODE_ENV: 'test' },
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['server/src/**/*.ts'],
      exclude: ['server/src/index.ts', 'server/src/types/**'],
      // Wide text table so full file names show in logs (non-TTY output defaults to 80 columns).
      reporter: [['text', { maxCols: 200 }], 'json', 'html'],
      // NFR-09: the run fails when service-layer line coverage drops below 80%.
      thresholds: { 'server/src/services/**': { lines: 80 } },
    },
  },
});
