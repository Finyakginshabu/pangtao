// Prints a markdown test summary for the GitHub Actions step summary (Lab 5 #24, C-01).
//
//   node scripts/ci-summary.mjs --vitest vitest-report.json --coverage coverage/coverage-summary.json >> "$GITHUB_STEP_SUMMARY"
//   node scripts/ci-summary.mjs --playwright playwright-report.json >> "$GITHUB_STEP_SUMMARY"
//
// Prints a pass/fail/skip table, then the names of failed tests (and of flaky end-to-end tests),
// then service-layer coverage. A missing or unreadable report prints "not run" instead of failing,
// so the summary step can run with `if: always()` after a step that crashed before writing its report.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const MAX_LISTED = 50;

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

const relative = (file) => path.relative(process.cwd(), file).replaceAll('\\', '/');

// Vitest's JSON report: one entry per test file. A file that failed to load has status "failed"
// and no failed assertions, so it is listed by file name.
function vitestFailures(report) {
  const names = [];
  for (const file of report.testResults ?? []) {
    const failed = (file.assertionResults ?? []).filter((t) => t.status === 'failed');
    for (const t of failed) {
      names.push([relative(file.name), ...(t.ancestorTitles ?? []), t.title].join(' › '));
    }
    if (file.status === 'failed' && failed.length === 0) {
      names.push(`${relative(file.name)} (file failed to run)`);
    }
  }
  return names;
}

// Playwright's JSON report: nested suites (file, then describe blocks) holding specs; each spec
// has one test per project whose status is expected, unexpected, flaky or skipped.
function playwrightByStatus(report, status) {
  const names = [];
  const walk = (suite, titles) => {
    const here = suite.title ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? []) {
      if ((spec.tests ?? []).some((t) => t.status === status)) {
        names.push([...here, spec.title].join(' › '));
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites ?? []) walk(suite, []);
  return names;
}

const rows = [];
const lists = [];

const vitest = readJson(flag('vitest'));
if (flag('vitest')) {
  if (vitest) {
    rows.push([
      'Unit + API (Vitest)',
      vitest.numPassedTests,
      vitest.numFailedTests,
      vitest.numPendingTests + (vitest.numTodoTests ?? 0),
    ]);
    lists.push(['Failed unit + API tests', vitestFailures(vitest)]);
  } else {
    rows.push(['Unit + API (Vitest)', 'not run', '', '']);
  }
}

const playwright = readJson(flag('playwright'));
if (flag('playwright')) {
  if (playwright) {
    const { expected = 0, unexpected = 0, skipped = 0, flaky = 0 } = playwright.stats ?? {};
    // A flaky test passed only on a retry: count it as passed here and name it below.
    rows.push(['End-to-end (Playwright)', expected + flaky, unexpected, skipped]);
    lists.push(['Failed end-to-end tests', playwrightByStatus(playwright, 'unexpected')]);
    lists.push([
      'Flaky end-to-end tests (passed only after a retry)',
      playwrightByStatus(playwright, 'flaky'),
    ]);
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

for (const [heading, names] of lists) {
  if (names.length === 0) continue;
  lines.push(`**${heading}** (${names.length}):`, '');
  for (const name of names.slice(0, MAX_LISTED)) lines.push(`- \`${name.replaceAll('`', "'")}\``);
  if (names.length > MAX_LISTED) lines.push(`- … and ${names.length - MAX_LISTED} more (see the job log)`);
  lines.push('');
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
