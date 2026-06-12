import type { Config } from 'drizzle-kit';

export default {
  schema: './src/core/jobjournal/storage/drizzle-schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
