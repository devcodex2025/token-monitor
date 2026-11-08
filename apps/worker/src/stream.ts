import type { TxEvent } from '@tmr/parser'
import type { Redis } from 'ioredis'
import type { EventStream } from './types'

export const TX_STREAM_KEY = 'txs:main'

/**
 * Publishes canonical events to a Redis Stream consumed by the Rules Engine / web feed (FR-B1).
 */
export function createRedisEventStream(redis: Redis, streamKey = TX_STREAM_KEY): EventStream {
  return {
    async publish(event: TxEvent) {
      await redis.xadd(streamKey, '*', 'event', JSON.stringify(event))
    },
  }
}
