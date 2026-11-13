import bcrypt from 'bcrypt';
import crypto from 'crypto';

const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12', 10);

// Precomputed cost-12 bcrypt hash for dummy comparison on non-existent users
const DUMMY_HASH = '$2b$12$e80yq7k9vQ4sW9F1Jt4zO.Y5cKxZtVjP4u1hZp2iK0Q1n2l3m4o5.';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function dummyBcryptCompare(password: string): Promise<void> {
  await bcrypt.compare(password, DUMMY_HASH);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

