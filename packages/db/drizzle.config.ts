import type { Config } from 'drizzle-kit'
import 'dotenv/config'

export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://tmr:tmr@localhost:5432/tmr',
  },
  verbose: true,
  strict: true,
} satisfies Config
