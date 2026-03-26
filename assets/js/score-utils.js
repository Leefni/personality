const DEFAULT_MAX_SCORES = { EI: 75, SN: 47.5, TF: 92.5, JP: 85 };

function toFinitePositiveNumber(value, fallback) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  return fallback;
}

export function resolveMaxScores(rawMaxScores = {}) {
  const resolved = { ...DEFAULT_MAX_SCORES };

  ['EI', 'SN', 'TF', 'JP'].forEach((dimension) => {
    resolved[dimension] = toFinitePositiveNumber(rawMaxScores?.[dimension], resolved[dimension]);
  });

  return resolved;
}

export function scoreToNormalized(score, dimension, maxScores = DEFAULT_MAX_SCORES) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 0;

  const maxScore = toFinitePositiveNumber(maxScores?.[dimension], DEFAULT_MAX_SCORES[dimension] || 75);
  const clamped = Math.max(-maxScore, Math.min(maxScore, numericScore));
  return Number((clamped / maxScore).toFixed(3));
}

export function normalizedToPercent(normalizedScore) {
  return Math.round(50 + (normalizedScore * 50));
}

export function dominantPercentFromNormalized(normalizedScore) {
  return Math.round((0.5 + (Math.abs(normalizedScore) / 2)) * 100);
}

export { DEFAULT_MAX_SCORES };
