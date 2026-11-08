/**
 * AI Insights (PRD §7). Implementation lands in M3; scaffolded in M0.1.
 * Provider-agnostic model map is configured via AI_MODEL_* env vars.
 */
export const AI_FEATURES = ['brief', 'explainer', 'builder', 'qa', 'digest'] as const

export type AiFeature = (typeof AI_FEATURES)[number]
