import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison for webhook shared secrets (PRD §2.9).
 */
export function secureCompare(provided: string, expected: string): boolean {
  if (!provided || !expected)
    return false

  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length)
    return false

  return timingSafeEqual(a, b)
}
