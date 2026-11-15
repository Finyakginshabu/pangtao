import { describe, it, expect, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TRANSACTION_OPTIONS } from '../../server/src/prisma.js';

// Lab 5 #24 / #31: Prisma gives an interactive transaction 2 s (default) to get a connection and
// fails with P2028 after that. A briefly busy or still-opening pool made `createOpeningBalance`
// answer 500 in the E2E run. The server's client must wait longer than the default.
const WAIT_BEYOND_DEFAULT_MS = 3_000;

// One connection, so the second transaction has to queue behind the first. Same options as the
// server's client; the URL is the test database the suite already uses.
function singleConnectionClient(): PrismaClient {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('connection_limit', '1');
  return new PrismaClient({ datasourceUrl: url.toString(), transactionOptions: TRANSACTION_OPTIONS });
}

describe('Interactive transactions wait for a free connection (Lab 5 #24, #31)', () => {
  const client = singleConnectionClient();
  afterAll(() => client.$disconnect());

  it('TEST-L5.1: a transaction queued behind a busy connection for longer than 2 s still runs', async () => {
    const holder = client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1`;
      await new Promise((resolve) => setTimeout(resolve, WAIT_BEYOND_DEFAULT_MS));
    });
    // Let the holder take the only connection before the second transaction asks for one.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const queued = await client.$transaction(async (tx) => tx.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`);

    expect(queued[0]?.ok).toBe(1);
    await holder;
  }, 20_000);
});
