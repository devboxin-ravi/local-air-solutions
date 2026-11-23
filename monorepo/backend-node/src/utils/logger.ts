/**
 * Structured JSON logger (one line per event, suitable for log shipping).
 */

import { config } from '../config';

const LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR'] as const;
type Level = (typeof LEVELS)[number];

function write(level: Level, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS.indexOf(level) < LEVELS.indexOf(config.logLevel)) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg: message, ...(meta ?? {}) });
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write('DEBUG', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write('INFO', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write('WARN', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write('ERROR', msg, meta),
};
