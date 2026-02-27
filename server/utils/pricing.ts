import type { ModelPricing } from '~~/app/types/stats'

// Pricing per million tokens (https://platform.claude.com/docs/en/about-claude/pricing)
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Opus 4.5+ ($5/$25 - price drop from Nov 2025)
  'claude-opus-4-6': {
    input: 5.00,
    output: 25.00,
    cacheWrite: 6.25,
    cacheRead: 0.50,
  },
  'claude-opus-4-5': {
    input: 5.00,
    output: 25.00,
    cacheWrite: 6.25,
    cacheRead: 0.50,
  },
  // Opus 4.0/4.1 ($15/$75 - original pricing)
  'claude-opus-4-1': {
    input: 15.00,
    output: 75.00,
    cacheWrite: 18.75,
    cacheRead: 1.50,
  },
  'claude-opus-4-0': {
    input: 15.00,
    output: 75.00,
    cacheWrite: 18.75,
    cacheRead: 1.50,
  },
  // Sonnet 4.x ($3/$15)
  'claude-sonnet-4-6': {
    input: 3.00,
    output: 15.00,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  'claude-sonnet-4-5': {
    input: 3.00,
    output: 15.00,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  'claude-sonnet-4-0': {
    input: 3.00,
    output: 15.00,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  // Sonnet 3.7 ($3/$15 - deprecated)
  'claude-sonnet-3-7': {
    input: 3.00,
    output: 15.00,
    cacheWrite: 3.75,
    cacheRead: 0.30,
  },
  // Haiku 4.5 ($1/$5)
  'claude-haiku-4-5': {
    input: 1.00,
    output: 5.00,
    cacheWrite: 1.25,
    cacheRead: 0.10,
  },
  // Haiku 3.5 ($0.80/$4)
  'claude-haiku-3-5': {
    input: 0.80,
    output: 4.00,
    cacheWrite: 1.00,
    cacheRead: 0.08,
  },
  // Opus 3 ($15/$75 - deprecated)
  'claude-opus-3': {
    input: 15.00,
    output: 75.00,
    cacheWrite: 18.75,
    cacheRead: 1.50,
  },
}

// Fallback pricing for unknown models (use haiku pricing as conservative default)
const FALLBACK_PRICING: ModelPricing = {
  input: 3.00,
  output: 15.00,
  cacheWrite: 3.75,
  cacheRead: 0.30,
}

export function getModelPricing(model: string): ModelPricing {
  // Try exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]

  // Try prefix match (e.g. claude-opus-4-5-20251101 matches claude-opus-4-5)
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(key)) return pricing
  }

  return FALLBACK_PRICING
}

export function getAllKnownModels(): string[] {
  return Object.keys(MODEL_PRICING)
}
