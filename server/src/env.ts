import path from 'path';
import dotenv from 'dotenv';

/**
 * Loads the repository-root `.env` regardless of the current working directory
 * (npm workspaces run `dev:server` with cwd = server/, Vitest runs from the root).
 * Resolved from this file's location: server/src (tsx/vitest) or server/dist (build)
 * are both two levels below the repo root. Variables already set in the real
 * environment win over `.env` (dotenv's default, no override).
 */
export const ROOT_ENV_PATH = path.resolve(__dirname, '..', '..', '.env');

dotenv.config({ path: ROOT_ENV_PATH });

/** Read a required variable or fail fast with an actionable message. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable ${name}. Set it in ${ROOT_ENV_PATH} (see .env.example).`
    );
  }
  return value;
}
