// Prints a markdown test summary for the GitHub Actions step summary (Lab 5 #24, C-01).
//
//   node scripts/ci-summary.mjs --vitest vitest-report.json --coverage coverage/coverage-summary.json >> "$GITHUB_STEP_SUMMARY"
//   node scripts/ci-summary.mjs --playwright playwright-report.json >> "$GITHUB_STEP_SUMMARY"
//
// A missing or unreadable report prints "not run" instead of failing, so the summary step can run
// with `if: always()` after a step that crashed before writing its report.
import { readFileSync } from 'node:fs';
import process from 'node:process';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? undefined : args[i + 1];
};

function readJson(file) {
  if (!file) return undefined;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

const rows = [];

const vitest = readJson(flag('vitest'));
if (flag('vitest')) {
  if (vitest) {
    rows.push([
      'Unit + API (Vitest)',
      vitest.numPassedTests,
      vitest.numFailedTests,
      vitest.numPendingTests + (vitest.numTodoTests ?? 0),
    ]);
  } else {
    rows.push(['Unit + API (Vitest)', 'not run', '', '']);
  }
}

const playwright = readJson(flag('playwright'));
if (flag('playwright')) {
  if (playwright) {
    const { expected = 0, unexpected = 0, skipped = 0, flaky = 0 } = playwright.stats ?? {};
    // A flaky test passed only on a retry: count it as passed here and call it out below.
    rows.push(['End-to-end (Playwright)', expected + flaky, unexpected, skipped]);
  } else {
    rows.push(['End-to-end (Playwright)', 'not run', '', '']);
  }
}

const lines = ['## Test summary', ''];
if (rows.length > 0) {
  lines.push('| Suite | Passed | Failed | Skipped |', '|---|---|---|---|');
  for (const [suite, passed, failed, skipped] of rows) {
    lines.push(`| ${suite} | ${passed} | ${failed} | ${skipped} |`);
  }
  lines.push('');
}

if (playwright?.stats?.flaky > 0) {
  lines.push(`> ${playwright.stats.flaky} end-to-end test(s) passed only after a retry (flaky).`, '');
}

if (flag('coverage')) {
  const coverage = readJson(flag('coverage'));
  if (coverage) {
    // Same scope as the NFR-09 gate in vitest.config.ts: service-layer line coverage.
    let covered = 0;
    let total = 0;
    for (const [file, entry] of Object.entries(coverage)) {
      if (file !== 'total' && file.replaceAll('\\', '/').includes('/server/src/services/')) {
        covered += entry.lines.covered;
        total += entry.lines.total;
      }
    }
    const pct = total === 0 ? 'n/a' : `${((covered / total) * 100).toFixed(2)}%`;
    lines.push(`Service-layer line coverage: **${pct}** (${covered}/${total} lines; gate 80%, NFR-09).`, '');
  } else {
    lines.push('Service-layer line coverage: not available.', '');
  }
}

process.stdout.write(lines.join('\n'));
