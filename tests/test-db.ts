/**
 * Resolves the database the automated tests run against, keeping them off the
 * development database (tests delete and recreate rows on every file).
 *
 * - TEST_DATABASE_URL, if set, is used as-is.
 * - Otherwise DATABASE_URL with "_test" appended to the database name
 *   (pangtao_db -> pangtao_db_test), so no extra configuration is needed.
 *
 * Safety: refuses any database whose name does not end in "_test", or that is
 * the same database as DATABASE_URL.
 */
export function resolveTestDatabaseUrl(): string {
  const devUrl = process.env.DATABASE_URL?.trim();
  const explicit = process.env.TEST_DATABASE_URL?.trim();

  if (!explicit && !devUrl) {
    throw new Error('DATABASE_URL (or TEST_DATABASE_URL) must be set in .env to run the API tests.');
  }

  const url = new URL(explicit || devUrl!);
  if (!explicit) {
    url.pathname = `${url.pathname}_test`;
  }

  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!dbName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against database "${dbName}": the test database name must end with "_test" ` +
        'because tests delete and recreate data.'
    );
  }
  if (devUrl) {
    const dev = new URL(devUrl);
    if (dev.host === url.host && dev.pathname === url.pathname) {
      throw new Error(`Refusing to run tests against the development database "${dbName}".`);
    }
  }

  return url.toString();
}
