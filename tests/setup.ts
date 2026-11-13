// Vitest setup (runs in each worker before the test file's imports):
// 1. load the repo-root .env through the same loader the server uses;
// 2. point Prisma at the isolated test database, never the development one.
import '../server/src/env.js';
import { resolveTestDatabaseUrl } from './test-db.js';

process.env.DATABASE_URL = resolveTestDatabaseUrl();
