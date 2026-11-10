// Vitest globalSetup: runs once before all test files. Brings the isolated test
// database up to the latest schema (creates it if missing) so `npm test` never
// touches the development database.
import { execSync } from 'node:child_process';
import '../server/src/env.js';
import { resolveTestDatabaseUrl } from './test-db.js';

export default function setup(): void {
  const testUrl = resolveTestDatabaseUrl();
  try {
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    });
  } catch (error) {
    const e = error as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      `Could not prepare the test database (${new URL(testUrl).pathname.slice(1)}). Is Postgres running (docker compose up -d)?\n` +
        `${e.stdout?.toString() ?? ''}${e.stderr?.toString() ?? ''}`
    );
  }
}
