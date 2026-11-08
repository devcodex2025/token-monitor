import process from 'node:process'
import { serve } from '@hono/node-server'
import { parseEnv } from '@tmr/config'
import { createDatabase } from '@tmr/db'
import Redis from 'ioredis'
import { createWorkerApp } from './index'
import { createJsonLogger } from './logger'
import { createDrizzleEventRepository } from './repository'
import { createRedisEventStream } from './stream'

const env = parseEnv()
const { db, pool } = createDatabase(env.DATABASE_URL)
const redis = new Redis(env.REDIS_URL)
const logger = createJsonLogger()

const app = createWorkerApp({
  repository: createDrizzleEventRepository(db),
  stream: createRedisEventStream(redis),
  logger,
  webhookSecret: env.HELIUS_WEBHOOK_SECRET ?? '',
})

const port = Number(process.env.PORT ?? 4000)

const server = serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port, service: 'tmr-worker' }, 'worker.listening')
})

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker.shutdown')
  server.close()
  await pool.end()
  redis.disconnect()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
