import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export * as schema from './schema'
export type Database = ReturnType<typeof createDatabase>

/**
 * Creates a Drizzle client over a node-postgres pool.
 */
export function createDatabase(connectionString: string) {
  const pool = new Pool({ connectionString })
  const db = drizzle(pool, { schema })
  return { db, pool }
}
