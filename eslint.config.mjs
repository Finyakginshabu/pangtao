// ESLint flat config (DoD §4: lint passes with zero warnings; run with --max-warnings=0).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      // Dot-directories hold editor/tool configuration, not project source.
      '.*/**',
      '**/node_modules/**',
      // Vite's dependency pre-bundle cache (generated, git-ignored).
      '**/.vite/**',
      '**/dist/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'blob-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Underscore prefix marks an intentionally unused parameter (e.g. Express `_req`, `_next`).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Node: server, Prisma seed, tests, and tool config files.
    files: ['server/**/*.ts', 'prisma/**/*.ts', 'tests/**/*.ts', '*.config.{ts,mjs,js}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Browser: the React app.
    files: ['web/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  }
);
