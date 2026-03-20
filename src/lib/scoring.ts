interface SubtestScore {
  construct: string;
  layer: string;
  percentile: number;
}

interface Weight {
  constructId: string;
  weight: number;
}

interface CutlineData {
  technicalAptitude: number;
  behavioralIntegrity: number;
  learningVelocity: number;
}

interface RedFlagData {
  severity: string;
}

// Fix: PRO-6 — Missing constructs treated as 0; denominator always uses total weight
export function calculateComposite(
  subtestResults: SubtestScore[],
  weights: Weight[]
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const weight of weights) {
    const result = subtestResults.find(r => r.construct === weight.constructId);
    // Always count weight in denominator — missing constructs contribute 0 to numerator
    weightedSum += (result?.percentile ?? 0) * weight.weight;
    totalWeight += weight.weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export function avgPercentile(
  subtestResults: SubtestScore[],
  layer: string
): number {
  const layerResults = subtestResults.filter(r => r.layer === layer);
  if (layerResults.length === 0) return 0;
  const sum = layerResults.reduce((acc, r) => acc + r.percentile, 0);
  return Math.round(sum / layerResults.length);
}

export function evaluateCutline(
  subtestResults: SubtestScore[],
  cutline: CutlineData
): { passed: boolean; distance: number } {
  const techAvg = avgPercentile(subtestResults, "TECHNICAL_APTITUDE");
  const behAvg = avgPercentile(subtestResults, "BEHAVIORAL_INTEGRITY");
  const lv = subtestResults.find(r => r.construct === "LEARNING_VELOCITY")?.percentile ?? 0;

  const passed =
    techAvg >= cutline.technicalAptitude &&
    behAvg >= cutline.behavioralIntegrity &&
    lv >= cutline.learningVelocity;

  const distance = Math.min(
    techAvg - cutline.technicalAptitude,
    behAvg - cutline.behavioralIntegrity,
    lv - cutline.learningVelocity
  );

  return { passed, distance };
}

export function determineStatus(
  passed: boolean,
  distance: number,
  redFlags: RedFlagData[]
): string {
  const hasCriticalFlag = redFlags.some(f => f.severity === "CRITICAL");
  const hasWarningFlag = redFlags.some(f => f.severity === "WARNING");

  if (hasCriticalFlag) return "DO_NOT_ADVANCE";
  if (!passed) return distance >= -5 ? "REVIEW_REQUIRED" : "DO_NOT_ADVANCE";
  if (hasWarningFlag) return "REVIEW_REQUIRED";
  return "RECOMMENDED";
}

export function getCutlineFailures(
  subtestResults: SubtestScore[],
  cutline: CutlineData
): { name: string; actual: number; required: number }[] {
  const failures: { name: string; actual: number; required: number }[] = [];
  const techAvg = avgPercentile(subtestResults, "TECHNICAL_APTITUDE");
  const behAvg = avgPercentile(subtestResults, "BEHAVIORAL_INTEGRITY");
  const lv = subtestResults.find(r => r.construct === "LEARNING_VELOCITY")?.percentile ?? 0;

  if (techAvg < cutline.technicalAptitude) failures.push({ name: "Technical Aptitude", actual: techAvg, required: cutline.technicalAptitude });
  if (behAvg < cutline.behavioralIntegrity) failures.push({ name: "Behavioral Integrity", actual: behAvg, required: cutline.behavioralIntegrity });
  if (lv < cutline.learningVelocity) failures.push({ name: "Learning Velocity", actual: lv, required: cutline.learningVelocity });

  return failures;
}
