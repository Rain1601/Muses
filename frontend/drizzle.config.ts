import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? '',
  },
  // Existing DB uses camelCase quoted identifiers (e.g. "User", "userId");
  // do NOT let drizzle-kit normalize names.
  casing: 'preserve',
} satisfies Config;
