import { describe, expect, it } from 'vitest'
import { checkPlan, resolveEntitlements } from '../src/entitlements'

const NOW = new Date('2026-11-09T12:00:00Z')
const DAY = 24 * 60 * 60 * 1000

describe('entitlements (FR-C2)', () => {
  it('grants an active plan before prepaid_until', () => {
    const entitlements = resolveEntitlements([
      { plan: 'turbo', status: 'active', prepaidUntil: new Date(NOW.getTime() + DAY) },
    ], NOW)

    expect(entitlements.has('turbo')).toBe(true)
    expect(entitlements.grace).toBe(false)
  })

  it('keeps access during the 3-day grace window', () => {
    const entitlements = resolveEntitlements([
      { plan: 'turbo', status: 'active', prepaidUntil: new Date(NOW.getTime() - 2 * DAY) },
    ], NOW)

    expect(entitlements.has('turbo')).toBe(true)
    expect(entitlements.grace).toBe(true)
    expect(entitlements.isPastDue).toBe(true)
  })

  it('expires access after the grace window', () => {
    const entitlements = resolveEntitlements([
      { plan: 'turbo', status: 'active', prepaidUntil: new Date(NOW.getTime() - 4 * DAY) },
    ], NOW)

    expect(entitlements.has('turbo')).toBe(false)
    expect(entitlements.plans).toEqual([])
  })

  it('ignores explicitly expired subscriptions', () => {
    const entitlements = resolveEntitlements([
      { plan: 'ai', status: 'expired', prepaidUntil: new Date(NOW.getTime() + DAY) },
    ], NOW)

    expect(entitlements.has('ai')).toBe(false)
  })

  it('orders plans Free -> Turbo -> AI -> Boost -> API', () => {
    const entitlements = resolveEntitlements([
      { plan: 'ai', status: 'active', prepaidUntil: new Date(NOW.getTime() + DAY) },
      { plan: 'turbo', status: 'active', prepaidUntil: new Date(NOW.getTime() + DAY) },
    ], NOW)

    expect(entitlements.plans).toEqual(['turbo', 'ai'])
    expect(entitlements.hasAtLeast('turbo')).toBe(true)
    expect(entitlements.hasAtLeast('ai')).toBe(true)
    expect(entitlements.hasAtLeast('boost')).toBe(false)
  })

  it('returns an upsell outcome instead of an error for missing plans', () => {
    const free = resolveEntitlements([], NOW)
    const result = checkPlan(free, 'turbo')

    expect(result).toEqual({ allowed: false, upsell: true, required: 'turbo' })
  })
})
