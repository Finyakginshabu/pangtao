import './env.js';
import { PrismaClient } from '@prisma/client';

/**
 * Interactive `$transaction` (callback form) options; array-form transactions are not affected.
 * Prisma's default `maxWait` (2 s to get a pooled connection) can make a request answer 500
 * (P2028) when the pool is briefly busy or still opening a connection, as seen in the Lab 5 E2E
 * runs (#31). 5 s gives such a request more room, and one that never gets a connection still
 * fails before the 8 s shutdown deadline (`index.ts`). The run limit stays at Prisma's default
 * (5 s). If the server exits with a transaction still open, PostgreSQL rolls it back.
 */
export const TRANSACTION_OPTIONS = { maxWait: 5_000 } as const;

export const prisma = new PrismaClient({ transactionOptions: TRANSACTION_OPTIONS });
