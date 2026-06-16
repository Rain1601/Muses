import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type Schema = typeof schema;
type Database = NeonHttpDatabase<Schema>;

function resolveConnectionString(): string {
  const url =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL (or POSTGRES_URL) is not set — required by lib/db/index.ts',
    );
  }
  return url;
}

let cachedClient: NeonQueryFunction<false, false> | null = null;
let cachedDb: Database | null = null;

function getDb(): Database {
  if (cachedDb) return cachedDb;
  cachedClient = neon(resolveConnectionString());
  cachedDb = drizzle(cachedClient, { schema });
  return cachedDb;
}

/**
 * Drizzle DB client. Lazy-initialized on first method call so that Next.js
 * build-time module loading doesn't trip on missing DATABASE_URL.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
export * from './schema';
