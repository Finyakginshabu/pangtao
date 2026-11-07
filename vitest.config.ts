import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
    exclude: ['tests/e2e/**/*', 'node_modules/**/*'],
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['server/src/**/*.ts'],
      exclude: ['server/src/index.ts', 'server/src/types/**'],
      reporter: ['text', 'json', 'html'],
    },
  },
});
