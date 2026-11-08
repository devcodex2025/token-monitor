export type Plan = 'turbo' | 'ai' | 'boost' | 'api'

export type SubscriptionStatus = 'active' | 'grace' | 'expired'

export interface SubscriptionRecord {
  plan: Plan
  status: SubscriptionStatus
  prepaidUntil: Date | string | null
}

export interface Entitlements {
  plans: Plan[]
  grace: boolean
  isPastDue: boolean
  has: (plan: Plan) => boolean
  hasAtLeast: (plan: Plan) => boolean
}

/** Plan ordering per PRD §2.2: Free -> Turbo -> AI -> Boost -> API. */
export const PLAN_ORDER: Plan[] = ['turbo', 'ai', 'boost', 'api']

export const GRACE_DAYS = 3

function toDate(value: Date | string | null): Date | null {
  if (!value)
    return null
  return value instanceof Date ? value : new Date(value)
}

/**
 * Resolves effective entitlements from subscription rows (FR-C2).
 * A subscription is usable while active and prepaid_until is in the future;
 * it stays usable during the 3-day grace window after prepaid_until.
 */
export function resolveEntitlements(
  subscriptions: SubscriptionRecord[],
  now: Date = new Date(),
): Entitlements {
  const graceLimitMs = GRACE_DAYS * 24 * 60 * 60 * 1000
  const active = new Set<Plan>()
  let grace = false

  for (const subscription of subscriptions) {
    if (subscription.status === 'expired')
      continue

    const prepaidUntil = toDate(subscription.prepaidUntil)

    if (subscription.status === 'grace') {
      active.add(subscription.plan)
      grace = true
      continue
    }

    if (!prepaidUntil) {
      active.add(subscription.plan)
      continue
    }

    if (prepaidUntil.getTime() > now.getTime()) {
      active.add(subscription.plan)
    }
    else if (now.getTime() - prepaidUntil.getTime() <= graceLimitMs) {
      active.add(subscription.plan)
      grace = true
    }
  }

  const plans = PLAN_ORDER.filter(plan => active.has(plan))
  const highestRank = plans.reduce((rank, plan) => Math.max(rank, PLAN_ORDER.indexOf(plan)), -1)

  return {
    plans,
    grace,
    isPastDue: grace,
    has: plan => active.has(plan),
    hasAtLeast: plan => highestRank >= PLAN_ORDER.indexOf(plan),
  }
}

/**
 * Route guard outcome for a required plan. Callers render an upsell (HTTP 200),
 * not an error, when access is denied (AC-C2.1).
 */
export function checkPlan(
  entitlements: Entitlements,
  required: Plan,
): { allowed: boolean, upsell: boolean, required: Plan } {
  const allowed = entitlements.has(required)
  return { allowed, upsell: !allowed, required }
}
