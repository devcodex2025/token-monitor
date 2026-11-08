const DAY_MS = 24 * 60 * 60 * 1000

export type RenewalAction = 'none' | 'remind' | 'grace_remind' | 'expired'

export interface RenewalStatus {
  action: RenewalAction
  /** Whole days until prepaid_until (negative after expiry). */
  daysLeft: number
  inGrace: boolean
  /** 1-based day inside the grace window (0 when not in grace). */
  graceDay: number
}

export interface RenewalOptions {
  /** Start reminding N days before expiry (PRD FR-C3: 3 days). */
  remindDays?: number
  /** Grace window in days (PRD: 3 days). */
  graceDays?: number
}

function toDate(value: Date | string | null): Date | null {
  if (!value)
    return null
  return value instanceof Date ? value : new Date(value)
}

/**
 * Renewal reminder state (FR-C3): remind 3 days before expiry, then daily during the
 * 3-day grace window, then expired (downgrade to Free).
 */
export function getRenewalStatus(
  prepaidUntil: Date | string | null,
  now: Date = new Date(),
  options: RenewalOptions = {},
): RenewalStatus {
  const remindDays = options.remindDays ?? 3
  const graceDays = options.graceDays ?? 3

  const until = toDate(prepaidUntil)
  if (!until) {
    return { action: 'expired', daysLeft: 0, inGrace: false, graceDay: 0 }
  }

  const diffMs = until.getTime() - now.getTime()
  const daysLeft = Math.ceil(diffMs / DAY_MS)

  if (diffMs > 0) {
    return {
      action: daysLeft <= remindDays ? 'remind' : 'none',
      daysLeft,
      inGrace: false,
      graceDay: 0,
    }
  }

  const graceElapsedDays = Math.floor((now.getTime() - until.getTime()) / DAY_MS)
  if (graceElapsedDays < graceDays) {
    return {
      action: 'grace_remind',
      daysLeft,
      inGrace: true,
      graceDay: graceElapsedDays + 1,
    }
  }

  return { action: 'expired', daysLeft, inGrace: false, graceDay: 0 }
}

/**
 * Whether the cron should send a renewal notification for this status.
 */
export function shouldNotifyRenewal(status: RenewalStatus): boolean {
  return status.action === 'remind' || status.action === 'grace_remind'
}
