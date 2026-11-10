import { prisma } from '../../server/src/prisma.js';
import { hashPassword, generateSessionToken, hashSessionToken } from '../../server/src/utils/hash.util.js';
import { requireEnv } from '../../server/src/env.js';
import { Role } from '@prisma/client';

// AC-01.10: no plaintext password in test fixtures; reuse the locally configured seed password.
export const TEST_PASSWORD = requireEnv('SEED_DEFAULT_PASSWORD');

export async function resetDatabase() {
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await hashPassword(TEST_PASSWORD);

  const alice = await prisma.user.create({
    data: {
      email: 'alice@example.test',
      displayName: 'Alice User',
      passwordHash,
      role: Role.USER,
      isActive: true,
    },
  });

  const bob = await prisma.user.create({
    data: {
      email: 'bob@example.test',
      displayName: 'Bob User',
      passwordHash,
      role: Role.USER,
      isActive: true,
    },
  });

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.test',
      displayName: 'System Admin',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
    },
  });

  return { alice, bob, admin };
}

const SESSION_TTL_HOURS = parseInt(process.env.SESSION_TTL_HOURS || '8', 10);

export async function createTestSession(userId: string, hoursValid = SESSION_TTL_HOURS): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + hoursValid * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return token;
}

