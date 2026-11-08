import type { Connection } from '@solana/web3.js'
import type { WsAdapter } from './ws-manager'
import { PublicKey } from '@solana/web3.js'

/**
 * Real Solana RPC `logsSubscribe` adapter for the free path (PRD FR-B2).
 * One subscription per mint is enforced by FreePathWsManager.
 */
export function createSolanaLogsAdapter(connection: Connection): WsAdapter {
  return {
    async subscribeLogs({ mint, onLogs }) {
      const id = connection.onLogs(
        new PublicKey(mint),
        (logs) => {
          onLogs({
            signature: logs.signature,
            err: logs.err,
            logs: logs.logs,
          })
        },
        'confirmed',
      )

      return {
        async close() {
          await connection.removeOnLogsListener(id)
        },
      }
    },
  }
}
