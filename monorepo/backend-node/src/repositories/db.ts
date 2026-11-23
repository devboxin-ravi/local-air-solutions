/**
 * Prisma client singleton and transaction helper.
 * Repositories accept an optional `db` (transaction client) so services can compose
 * several repository calls inside one ACID transaction.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { config } from '../config';

export const prisma = new PrismaClient({
  datasources: { db: { url: config.databaseUrl } },
  log: config.debug ? ['warn', 'error'] : ['error'],
});

export type Db = PrismaClient | Prisma.TransactionClient;

/** Runs `fn` inside a SERIALIZABLE-safe interactive transaction (MySQL REPEATABLE READ + row locks). */
export const runInTransaction = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> =>
  prisma.$transaction(fn, { maxWait: 10_000, timeout: 30_000 });

/**
 * Atomically increments and returns a named sequence.
 * INSERT … ON DUPLICATE KEY UPDATE takes a row lock that is held until the
 * surrounding transaction commits — concurrent callers serialize on it.
 */
export async function nextSequence(db: Db, key: string): Promise<number> {
  await db.$executeRaw`INSERT INTO sequences (\`key\`, value) VALUES (${key}, 1) ON DUPLICATE KEY UPDATE value = value + 1`;
  const rows = await db.$queryRaw<Array<{ value: number }>>`SELECT value FROM sequences WHERE \`key\` = ${key}`;
  return Number(rows[0].value);
}
