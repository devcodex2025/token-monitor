import { describe, expect, it } from 'vitest'
import { getRenewalStatus, shouldNotifyRenewal } from '../src/renewal'

const NOW = new Date('2026-11-09T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

function until(daysFromNow: number): Date {
  return new Date(NOW.getTime() + daysFromNow * DAY)
}

describe('renewal reminders (FR-C3)', () => {
  it('does nothing when expiry is far away', () => {
    expect(getRenewalStatus(until(10), NOW)).toEqual({
      action: 'none',
      daysLeft: 10,
      inGrace: false,
      graceDay: 0,
    })
  })

  it('reminds 3 days before expiry (boundary)', () => {
    expect(getRenewalStatus(until(3), NOW)).toMatchObject({ action: 'remind', daysLeft: 3 })
    expect(getRenewalStatus(until(4), NOW)).toMatchObject({ action: 'none' })
  })

  it('reminds daily inside the grace window', () => {
    expect(getRenewalStatus(until(-0.5), NOW)).toMatchObject({ action: 'grace_remind', inGrace: true, graceDay: 1 })
    expect(getRenewalStatus(until(-2.5), NOW)).toMatchObject({ action: 'grace_remind', graceDay: 3 })
  })

  it('expires after the 3-day grace window', () => {
    expect(getRenewalStatus(until(-3.5), NOW)).toEqual({
      action: 'expired',
      daysLeft: -3,
      inGrace: false,
      graceDay: 0,
    })
  })

  it('treats a missing subscription as expired', () => {
    expect(getRenewalStatus(null, NOW).action).toBe('expired')
  })

  it('notifies only on remind actions', () => {
    expect(shouldNotifyRenewal(getRenewalStatus(until(2), NOW))).toBe(true)
    expect(shouldNotifyRenewal(getRenewalStatus(until(-1), NOW))).toBe(true)
    expect(shouldNotifyRenewal(getRenewalStatus(until(30), NOW))).toBe(false)
    expect(shouldNotifyRenewal(getRenewalStatus(until(-10), NOW))).toBe(false)
  })
})
