/**
 * Percentile rank of `value` in `values` array (0–100).
 * Higher value → higher percentile.
 */
export function percentileRank(value: number, values: number[]): number {
  if (values.length === 0) return 50
  const below = values.filter((v) => v < value).length
  const equal = values.filter((v) => v === value).length
  return Math.round(((below + equal * 0.5) / values.length) * 100)
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function stdDev(values: number[], m?: number): number {
  if (values.length === 0) return 1
  const mu = m ?? mean(values)
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mu, 2), 0) / values.length
  return Math.sqrt(variance) || 1
}

/**
 * Clamp x to [min, max].
 */
export function clamp(x: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, x))
}

/**
 * Convert a z-score to a 0–100 grade using a logistic curve.
 * z = 0 → 50, z = 2 → ~88, z = -2 → ~12
 */
export function zToGrade(z: number): number {
  return clamp(Math.round(50 + 25 * Math.tanh(z * 0.8)))
}

/**
 * Weighted average of multiple values.
 */
export function weightedMean(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((s, v) => s + v.weight, 0)
  if (totalWeight === 0) return 0
  return values.reduce((s, v) => s + v.value * v.weight, 0) / totalWeight
}
