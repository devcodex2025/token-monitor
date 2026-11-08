import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDatabase } from './index'
import 'dotenv/config'

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is required to run migrations')
  }

  const { db, pool } = createDatabase(url)
  try {
    await migrate(db, { migrationsFolder: './migrations' })
    console.log('Migrations applied successfully')
  }
  finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('Migration failed:', error)
  process.exit(1)
})
