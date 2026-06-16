import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

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

const client = neon(resolveConnectionString());

export const db = drizzle(client, { schema });

export { schema };
export * from './schema';
