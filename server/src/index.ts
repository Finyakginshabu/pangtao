import './env.js';
import { app } from './app.js';
import { prisma } from './prisma.js';

const PORT = parseInt(process.env.PORT || '8080', 10);
// Cloud Run sends SIGTERM and kills the container 10 seconds later.
const SHUTDOWN_TIMEOUT_MS = 8000;

const server = app.listen(PORT, () => {
  const commit = process.env.APP_COMMIT ? ` commit ${process.env.APP_COMMIT}` : '';
  console.log(`🚀 Pangtao server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]${commit}`);
});

/** Stop accepting connections, let in-flight requests finish, then close the database pool. */
function shutdown(signal: NodeJS.Signals) {
  console.log(`${signal} received, shutting down`);
  setTimeout(() => {
    console.error('Shutdown timed out, exiting');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close(() => {
    prisma
      .$disconnect()
      .catch(() => undefined)
      .finally(() => process.exit(0));
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
