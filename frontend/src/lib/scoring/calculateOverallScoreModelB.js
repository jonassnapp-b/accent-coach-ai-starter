export function calculateOverallScoreModelB(phonemes) {
  if (!phonemes || phonemes.length === 0) {
    return {
      overall: 0,
      detectedAvg: 0,
      missingCount: 0,
      total: 0,
    };
  }

  const scores = phonemes
    .map(p => Number(p.score))
    .filter(s => Number.isFinite(s));

  const detected = scores.filter(s => s > 0);
  const missing = scores.filter(s => s === 0);

  const detectedAvg = detected.length
    ? detected.reduce((a, b) => a + b, 0) / detected.length
    : 0;

  const missingRatio = scores.length
    ? missing.length / scores.length
    : 1;

  const MAX_PENALTY = 30; // ← justér hvis ønsket
  const penalty = Math.round(missingRatio * MAX_PENALTY);

  const overall = Math.max(0, Math.round(detectedAvg - penalty));

  return {
    overall,
    detectedAvg: Math.round(detectedAvg),
    missingCount: missing.length,
    total: scores.length,
  };
}
