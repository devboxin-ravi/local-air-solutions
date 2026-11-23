/**
 * Process entry point: starts HTTP server and background jobs; graceful shutdown.
 */

import { createApp } from './app';
import { config } from './config';
import { disconnectDatabase } from './dependencies/dependencies';
import { startJobs, stopJobs } from './jobs/scheduler';
import { logger } from './utils/logger';

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info(`${config.appName} listening`, { port: config.port, env: config.nodeEnv });
  if (config.jobs.enabled) startJobs();
});

const shutdown = (signal: string) => {
  logger.info('Shutting down', { signal });
  stopJobs();
  server.close(() => {
    disconnectDatabase().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => logger.error('unhandledRejection', { reason: String(reason) }));
