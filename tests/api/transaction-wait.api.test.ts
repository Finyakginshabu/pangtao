import { describe, it, expect, afterAll, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';

// Lab 5 #24 (#31): Prisma gives an interactive transaction 2 s by default to get a pooled
// connection and fails with P2028 after that; in the E2E run this answered 500 from
// `createOpeningBalance`. The server's own client (`server/src/prisma.ts`) must wait longer.
const HOLD_BEYOND_DEFAULT_MS = 3_000;

describe('Interactive transactions wait for a free connection (Lab 5 #24)', () => {
  let prisma: PrismaClient;
  const originalUrl = process.env.DATABASE_URL!;

  afterAll(async () => {
    await prisma?.$disconnect();
    process.env.DATABASE_URL = originalUrl;
    vi.resetModules();
  });

  it('a transaction queued behind a busy connection for longer than 2 s still runs on the server client', async () => {
    // A fresh copy of the server's client with a one-connection pool on the test database, so the
    // second transaction has to queue behind the first.
    const url = new URL(originalUrl);
    url.searchParams.set('connection_limit', '1');
    process.env.DATABASE_URL = url.toString();
    vi.resetModules();
    ({ prisma } = await import('../../server/src/prisma.js'));

    const holder = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1`;
      await new Promise((resolve) => setTimeout(resolve, HOLD_BEYOND_DEFAULT_MS));
    });
    // Let the holder take the only connection before the second transaction asks for one.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const queued = await prisma.$transaction(async (tx) => tx.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`);

    expect(queued[0]?.ok).toBe(1);
    await holder;
  }, 20_000);
});
