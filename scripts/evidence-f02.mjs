#!/usr/bin/env node
/**
 * Regenerates the F-02 verification evidence in docs/sprints/sprint-1/evidence/f-02/.
 *
 *   npm run evidence:f-02
 *
 * Requires Postgres (docker compose up -d) and a committed code state: every file
 * records the commit it was produced on, so the evidence is tied to a real version.
 * Uncommitted changes to code files abort the run; other uncommitted files are
 * listed in each header.
 *
 * Steps: lint, unit+API tests, coverage, seed + E2E, then two failing-first checks
 * for the ACs the F-02 DoD names explicitly (AC-02.4 session revocation and
 * AC-02.6 self-disable). The checks remove the behavior, show the named test
 * failing, restore the file byte-for-byte, and show the same test passing again.
 */
import { spawn, spawnSync, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'sprints', 'sprint-1', 'evidence', 'f-02');
const OUT_REL = 'docs/sprints/sprint-1/evidence/f-02/';
const CODE_PATHS = /^(server\/|web\/src\/|web\/index\.html|prisma\/|tests\/|scripts\/|package(-lock)?\.json|[^/]*\.config\.(ts|mjs|js)|\.env\.example)/;

dotenv.config({ path: path.join(ROOT, '.env') });
const SECRET = process.env.SEED_DEFAULT_PASSWORD;
if (!SECRET) fail('SEED_DEFAULT_PASSWORD must be set in .env.');

function fail(message) {
  console.error(`\n✖ evidence:f-02: ${message}`);
  process.exit(1);
}

const git = (args) => execSync(`git ${args}`, { cwd: ROOT, encoding: 'utf8' }).trim();

// ---- Working-tree state -------------------------------------------------------
// Porcelain lines are "XY path"; X may be a space, so the output must not be trimmed.
const changedPaths = () =>
  execSync('git status --porcelain --untracked-files=all', { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((l) => l.length > 3)
    .map((l) => l.slice(3).replace(/^"|"$/g, ''));

const dirty = changedPaths().filter((f) => !f.startsWith(OUT_REL));
const dirtyCode = dirty.filter((f) => CODE_PATHS.test(f));
if (dirtyCode.length) {
  fail(`uncommitted changes to code files: ${dirtyCode.join(', ')}. Commit them first so the evidence names a real commit.`);
}

const commit = git('rev-parse HEAD');
const subject = git('log -1 --format=%s');
const date = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }) + ' (Asia/Bangkok)';
const treeNote = dirty.length ? `clean for code; uncommitted non-code files: ${dirty.join(', ')}` : 'clean';

// The commit that added the F-02 API tests. When tests were committed before the
// implementation, this is the genuine red commit the DoD asks for.
const addedTestCommit = git('log --diff-filter=A --format=%H -- tests/api/admin.api.test.ts').split('\n')[0] || '';
const redCommitNote = (() => {
  if (!addedTestCommit) return 'not found (tests/api/admin.api.test.ts is not committed yet)';
  const hasImplementation =
    git(`ls-tree -r --name-only ${addedTestCommit} -- server/src/routes/admin.routes.ts`).length > 0;
  return hasImplementation
    ? `${addedTestCommit} (test and implementation were committed together; the mutation checks below are the failing-first evidence)`
    : `${addedTestCommit} (tests committed before implementation: genuine red-to-green commit)`;
})();

// ---- Helpers ----------------------------------------------------------------------
const ESC = String.fromCharCode(27);
const ANSI = new RegExp(`${ESC}\\[[0-9;?]*[A-Za-z]`, 'g');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pathVariants = (p) => [p, p.split('\\').join('/'), p.split('/').join('\\')];

function sanitize(text) {
  let out = text.replace(ANSI, '').replace(/\r\n/g, '\n');
  for (const [p, label] of [[ROOT, '<repo>'], [os.homedir(), '<home>']]) {
    for (const v of pathVariants(p)) out = out.replace(new RegExp(escapeRe(v), 'gi'), label);
  }
  return out;
}

const CHILD_ENV = { ...process.env, NO_COLOR: '1' };

function run(command, timeoutMs = 10 * 60 * 1000) {
  const r = spawnSync(command, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 1 << 26,
    env: CHILD_ENV,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { code: r.status ?? 1, output: sanitize(`${r.stdout ?? ''}${r.stderr ?? ''}`) };
}

// Dev servers for E2E are owned by this script (Playwright reuses them), so they can be
// stopped reliably: on Windows Playwright's own teardown can orphan them and hang.
const servers = [];
const reachable = (url) => fetch(url).then(() => true, () => false);

function startServer(script) {
  const child = spawn(`npm run ${script}`, {
    cwd: ROOT,
    shell: true,
    stdio: 'ignore',
    env: CHILD_ENV,
    detached: process.platform !== 'win32',
  });
  servers.push(child);
}

function killTree(child, group = true) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync(`taskkill /PID ${child.pid} /T /F`, { shell: true, stdio: 'ignore' });
  } else {
    try {
      if (group) process.kill(-child.pid, 'SIGTERM');
      else child.kill('SIGTERM');
    } catch {}
  }
}

function stopServers() {
  for (const child of servers.splice(0)) killTree(child);
}
process.on('exit', stopServers);

/**
 * Runs Playwright and decides the result from its per-test lines. On Windows, when
 * launched from a script, Playwright can report every result and then never exit
 * (its worker stalls in browser teardown). So once all tests have reported, it gets
 * 15 s to exit on its own before its process tree is stopped; that is recorded.
 */
function runPlaywright() {
  const cli = path.join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, 'test', '--reporter=list'], {
      cwd: ROOT,
      env: CHILD_ENV,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let raw = '';
    let allReportedAt = null;
    let stoppedAfterResults = false;
    child.stdout.on('data', (d) => (raw += d));
    child.stderr.on('data', (d) => (raw += d));

    const parse = () => {
      const text = sanitize(raw);
      const total = Number((text.match(/Running (\d+) tests? using/) || [])[1] || 0);
      const results = [...text.matchAll(/^\s+(ok|x|✘|-)\s+\d+ \[/gm)].map((m) => m[1]);
      return { text, total, results };
    };
    const poll = setInterval(() => {
      const { total, results } = parse();
      if (!allReportedAt && total > 0 && results.length >= total) allReportedAt = Date.now();
      if (allReportedAt && Date.now() - allReportedAt > 15_000) {
        stoppedAfterResults = true;
        clearInterval(poll);
        killTree(child, false);
      }
    }, 500);
    const hardStop = setTimeout(() => killTree(child, false), 5 * 60 * 1000);

    child.on('exit', (code) => {
      clearInterval(poll);
      clearTimeout(hardStop);
      setTimeout(() => {
        const { text, total, results } = parse();
        resolve({ code, text, total, results, stoppedAfterResults });
      }, 500);
    });
  });
}

async function waitFor(url, timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await reachable(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

function header(title, command, extra = []) {
  return [
    `# F-02 evidence: ${title}`,
    `# Command : ${command}`,
    `# Commit  : ${commit} (${subject})`,
    `# Tree    : ${treeNote}`,
    `# Date    : ${date}`,
    `# Node    : ${process.version}`,
    ...extra.map((l) => `# ${l}`),
    '',
  ].join('\n');
}

const files = {};
function save(name, content) {
  if (content.includes(SECRET)) fail(`refusing to write ${name}: output contains the seed password.`);
  files[name] = content.endsWith('\n') ? content : `${content}\n`;
}

function step(name, title, command, { expectExit = 0, note = [], timeoutMs } = {}) {
  process.stdout.write(`• ${title} … `);
  const { code, output } = run(command, timeoutMs);
  if (code !== expectExit) {
    console.log(`exit ${code}`);
    console.log(output.slice(-3000));
    fail(`"${command}" exited ${code}, expected ${expectExit}.`);
  }
  console.log('ok');
  save(name, `${header(title, command, [`Result  : exit code ${code}`, ...note])}\n${output}`);
}

// ---- 1-4: lint, tests, coverage, E2E ----------------------------------------------
step('lint.txt', 'ESLint, zero warnings allowed (DoD §4)', 'npx eslint . --max-warnings=0', {
  note: ['No output below means no errors and no warnings.'],
});
step('npm-test.txt', 'Unit + API tests (Vitest, verbose)', 'npx vitest run --reporter=verbose');
step('coverage.txt', 'Line coverage, NFR-09 target >= 80% (service layer)', 'npx vitest run --coverage');

process.stdout.write('• Seeding the development database for E2E … ');
const seed = run('npx prisma db seed');
if (seed.code !== 0) fail(`seed failed:\n${seed.output}`);
console.log('ok');
const API_URL = 'http://localhost:8080/api/v1/health';
const WEB_URL = 'http://localhost:3000/';
if ((await reachable(API_URL)) || (await reachable(WEB_URL))) {
  fail('a dev server is already running on port 8080 or 3000. Stop it first, so E2E runs against this commit.');
}
process.stdout.write('• Starting API and web dev servers for E2E … ');
startServer('dev:server');
startServer('dev:web');
if (!(await waitFor(API_URL, 90_000)) || !(await waitFor(WEB_URL, 90_000))) fail('dev servers did not become ready within 90 s.');
console.log('ok');
process.stdout.write('• Playwright end-to-end (TEST-02.8 + TEST-01.14 regression) … ');
const e2e = await runPlaywright();
stopServers();
const e2ePassed = e2e.total > 0 && e2e.results.length === e2e.total && e2e.results.every((r) => r === 'ok');
const exitedCleanly = !e2e.stoppedAfterResults && e2e.code === 0;
if (!e2ePassed || (!exitedCleanly && !e2e.stoppedAfterResults)) {
  console.log(`failed (exit ${e2e.code})`);
  console.log(e2e.text.slice(-3000));
  fail('the E2E suite did not pass.');
}
console.log(exitedCleanly ? 'ok' : 'ok (Playwright stopped after reporting all results)');
save(
  'e2e.txt',
  `${header('Playwright end-to-end (TEST-02.8 + TEST-01.14 regression)', 'npx playwright test --reporter=list', [
    `Result  : ${e2e.results.length}/${e2e.total} tests passed (every per-test line is "ok")`,
    exitedCleanly
      ? 'Exit    : Playwright exited on its own with code 0'
      : 'Exit    : all results were reported, but Playwright did not exit within 15 s afterwards (a known',
    ...(exitedCleanly ? [] : ['          Windows teardown stall when run from a script), so the evidence script stopped it.']),
    'Servers : the API (npm run dev:server) and web (npm run dev:web) dev servers were started by',
    '          the evidence script for this run and reused by Playwright.',
  ])}\n${e2e.text}`
);

// ---- 5: failing-first checks for AC-02.4 and AC-02.6 --------------------------------
const MUTATIONS = [
  {
    test: 'TEST-02.4',
    file: 'server/src/services/admin.service.ts',
    find: [
      '      // BR-13: purge all sessions of the disabled user within the same transaction.',
      '      if (!isActive) {',
      '        await tx.session.deleteMany({ where: { userId: targetUserId } });',
      '      }',
    ].join('\n'),
    replace: [
      '      // BR-13: purge all sessions of the disabled user within the same transaction.',
      '      // Mutation: session revocation removed for the failing-first check.',
    ].join('\n'),
    what: 'session revocation removed from the disable transaction (AC-02.4)',
  },
  {
    test: 'TEST-02.6',
    file: 'server/src/services/admin.service.ts',
    find: [
      '      // BR-03: an Administrator can never disable their own account.',
      '      if (!isActive && targetUserId === actorUserId) {',
      "        throw new AppError(409, 'CANNOT_DISABLE_SELF', 'You cannot disable your own account');",
      '      }',
    ].join('\n'),
    replace: [
      '      // BR-03: an Administrator can never disable their own account.',
      '      // Mutation: self-disable guard removed for the failing-first check.',
    ].join('\n'),
    what: 'self-disable prohibition removed (AC-02.6)',
  },
];

for (const m of MUTATIONS) {
  const abs = path.join(ROOT, m.file);
  const original = readFileSync(abs);
  const source = original.toString('utf8');
  if (!source.includes(m.find)) fail(`mutation anchor for ${m.test} not found in ${m.file}.`);

  const command = `npx vitest run tests/api/admin.api.test.ts -t "${m.test}" --reporter=verbose`;
  process.stdout.write(`• Failing-first check ${m.test} … `);
  let broken;
  let diff;
  try {
    writeFileSync(abs, source.replace(m.find, m.replace));
    diff = sanitize(git(`diff -- ${m.file}`));
    broken = run(command);
  } finally {
    writeFileSync(abs, original);
  }
  if (git(`status --porcelain -- ${m.file}`) !== '') fail(`${m.file} was not restored to its committed state.`);
  if (broken.code === 0 || !/FAIL/.test(broken.output)) {
    console.log('NOT caught');
    fail(`${m.test} did not fail as expected when the behavior was removed.`);
  }
  const restored = run(command);
  if (restored.code !== 0) fail(`${m.test} did not pass again after restoring ${m.file}.`);
  console.log('caught, restored, passing');

  save(
    `failing-first-${m.test}.txt`,
    [
      header(`failing-first check for ${m.test}`, command, [
        `Red commit: ${redCommitNote}`,
        'DISCLOSURE: this is a mutation check run on the committed green state. It removes the',
        'behavior, shows the named test failing, restores the file byte-for-byte (verified against',
        'git), and shows the same test passing again. When the test commit predates the',
        'implementation, that commit is the genuine red-to-green evidence; this file proves the',
        'test still detects the behavior on the final commit.',
        `Mutation: ${m.what}`,
      ]),
      '## 1. Mutation applied (temporary, never committed)',
      '',
      diff,
      '',
      `## 2. ${m.test} with the behavior removed: exit code ${broken.code} (expected: failure)`,
      '',
      broken.output.trimEnd(),
      '',
      `## 3. ${m.test} after restoring ${m.file}: exit code ${restored.code} (expected: pass)`,
      '',
      restored.output.trimEnd(),
    ].join('\n')
  );
}

// ---- Write -------------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
for (const [name, content] of Object.entries(files)) writeFileSync(path.join(OUT_DIR, name), content);

const after = changedPaths().filter((f) => !f.startsWith(OUT_REL) && !dirty.includes(f));
if (after.length) fail(`unexpected files changed during the run: ${after.join(', ')}`);

console.log(`\n✔ Wrote ${Object.keys(files).length} files to ${OUT_REL} for commit ${commit.slice(0, 7)}.`);
