export interface FeatureInput {
  tolPlus: number;
  tolMinus: number;
  direction: 1 | -1;
}

export interface StackupResult {
  worstCasePlus: number;
  worstCaseMinus: number;
  rssPlus: number;
  rssMinus: number;
  meanShift: number;
  sigma: number;
  dppm: number | null;
  yieldPercent: number | null;
  sigmaLevel: number | null;
}

/**
 * Standard normal CDF using Abramowitz & Stegun approximation.
 * Max error ~1.5e-7, sufficient for engineering DPPM calculations.
 */
export function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Coverage percentage for a given k-sigma level (two-sided).
 */
export function sigmaCoverage(k: number): number {
  return (normalCDF(k) - normalCDF(-k)) * 100;
}

/**
 * Calculate tolerance stack-up using both worst-case and RSS methods.
 *
 * Each feature's tolerance is assumed to represent a ±kσ range (default k=3).
 * For asymmetric tolerances: σ = (tolPlus + tolMinus) / (2·k),
 * and a mean shift of (tolPlus - tolMinus) / 2 from nominal.
 *
 * Direction (+1 or -1) controls whether the feature adds or subtracts
 * in the stack-up loop.
 */
export function calculateStackup(
  features: FeatureInput[],
  targetPlus: number | null,
  targetMinus: number | null,
  sigmaK: number = 3
): StackupResult {
  let worstCasePlus = 0;
  let worstCaseMinus = 0;
  let sumSigmaSquared = 0;
  let totalMeanShift = 0;

  for (const f of features) {
    const tp = Math.abs(f.tolPlus);
    const tm = Math.abs(f.tolMinus);

    if (f.direction === 1) {
      worstCasePlus += tp;
      worstCaseMinus += tm;
    } else {
      worstCasePlus += tm;
      worstCaseMinus += tp;
    }

    const sigma_i = (tp + tm) / (2 * sigmaK);
    const meanShift_i = (tp - tm) / 2;

    sumSigmaSquared += sigma_i * sigma_i;
    totalMeanShift += f.direction * meanShift_i;
  }

  const sigma = Math.sqrt(sumSigmaSquared);
  const rssPlus = totalMeanShift + sigmaK * sigma;
  const rssMinus = -totalMeanShift + sigmaK * sigma;

  let dppm: number | null = null;
  let yieldPercent: number | null = null;
  let sigmaLevel: number | null = null;

  if (targetPlus !== null && targetMinus !== null && sigma > 0) {
    const zUpper = (targetPlus - totalMeanShift) / sigma;
    const zLower = (targetMinus + totalMeanShift) / sigma;

    const pDefect = normalCDF(-zUpper) + normalCDF(-zLower);
    dppm = Math.round(pDefect * 1_000_000);
    yieldPercent = (1 - pDefect) * 100;
    sigmaLevel = Math.min(zUpper, zLower);
  }

  return {
    worstCasePlus,
    worstCaseMinus,
    rssPlus,
    rssMinus,
    meanShift: totalMeanShift,
    sigma,
    dppm,
    yieldPercent,
    sigmaLevel,
  };
}

export function formatTolerance(value: number, decimals = 3): string {
  return value.toFixed(decimals);
}

export function formatDppm(dppm: number): string {
  if (dppm >= 1_000_000) return ">999,999";
  return dppm.toLocaleString("en-US");
}

export function formatYield(yieldPct: number): string {
  if (yieldPct >= 99.99) return yieldPct.toFixed(4);
  if (yieldPct >= 99.9) return yieldPct.toFixed(3);
  if (yieldPct >= 99) return yieldPct.toFixed(2);
  return yieldPct.toFixed(1);
}

export type QualityLevel = "excellent" | "good" | "marginal" | "poor";

export function getQualityLevel(dppm: number): QualityLevel {
  if (dppm <= 3_400) return "excellent";
  if (dppm <= 10_000) return "good";
  if (dppm <= 66_800) return "marginal";
  return "poor";
}

/* ------------------------------------------------------------------ */
/*  Worst-case vs RSS recommendation                                   */
/* ------------------------------------------------------------------ */

export interface StackupRecommendation {
  method: "worst-case" | "rss" | "either";
  summary: string;
  detail: string;
}

/**
 * Provides a recommendation on whether to use worst-case or RSS analysis.
 *
 * Based on guidelines from:
 *  - Drake, P. "Dimensioning and Tolerancing Handbook" (1999)
 *  - Creveling, C.M. "Tolerance Design" (1997)
 *  - ASME Y14.5 & ISO 8015 dimensional tolerancing standards
 *
 * Key heuristics:
 *  - Central Limit Theorem requires ≥4 independent contributors for RSS
 *    to be statistically justified.
 *  - RSS assumes independent, normally-distributed processes with Cpk ≥ 1.33.
 *  - Worst-case is appropriate for safety-critical, low-volume, or
 *    few-contributor stacks.
 */
export function getRecommendation(
  features: FeatureInput[],
  result: StackupResult,
  targetPlus: number | null,
  targetMinus: number | null
): StackupRecommendation {
  const n = features.length;
  const hasTarget = targetPlus !== null && targetMinus !== null;
  const targetMax =
    hasTarget ? Math.max(targetPlus!, targetMinus!) : Infinity;
  const wcMax = Math.max(result.worstCasePlus, result.worstCaseMinus);
  const rssMax = Math.max(result.rssPlus, result.rssMinus);
  const wcPasses = wcMax <= targetMax;
  const rssPasses = rssMax <= targetMax;

  if (n <= 3) {
    if (hasTarget && !wcPasses) {
      return {
        method: "worst-case",
        summary: `With only ${n} contributor${n > 1 ? "s" : ""}, the Central Limit Theorem provides weak justification for RSS. Worst-case analysis is recommended, but the stack exceeds the target — individual tolerances should be tightened.`,
        detail:
          "Per Creveling (1997), RSS requires a sufficient number of independent variables (typically ≥ 4) for the normal approximation to hold. Consider tightening the largest contributors or changing manufacturing processes.",
      };
    }
    return {
      method: "worst-case",
      summary: `With only ${n} contributor${n > 1 ? "s" : ""}, worst-case analysis is the safer choice. RSS provides limited statistical benefit when the number of contributors is small.`,
      detail:
        "The Central Limit Theorem, which underpins RSS, requires a sufficient number of independent random variables. With ≤ 3 features, the composite distribution may not be well-approximated by a normal distribution (Drake, 1999).",
    };
  }

  if (hasTarget) {
    if (wcPasses) {
      return {
        method: "either",
        summary:
          "The stack-up meets the target even under worst-case analysis. Both methods are valid — no statistical assumption is required.",
        detail: `All ${n} features with their worst-case tolerances still produce a stack within the target. This is the most robust scenario; RSS would only provide additional margin.`,
      };
    }
    if (rssPasses) {
      return {
        method: "rss",
        summary: `With ${n} contributors, RSS analysis is statistically justified and meets the target. Worst case exceeds it. Ensure each feature\'s process is well-controlled (Cpk \u2265 1.33).`,
        detail: `Per the Central Limit Theorem, with ${n} independent contributors the stack-up distribution closely approximates a normal. RSS with \u00b13\u03c3 gives 99.73% confidence. Monitor process capability regularly and investigate any feature with Cpk < 1.33 (Creveling, 1997).`,
      };
    }
    return {
      method: "rss",
      summary:
        "Neither worst-case nor RSS meets the target tolerance. Individual feature tolerances must be tightened, or the target must be relaxed.",
      detail:
        "Prioritize tightening the largest contributors first (Pareto principle). Alternatively, consider switching to tighter manufacturing processes for the dominant features, or redesigning the assembly to reduce the number of contributors in the stack.",
    };
  }

  if (n >= 8) {
    return {
      method: "rss",
      summary: `With ${n} contributors, RSS is strongly recommended over worst-case. Worst-case becomes overly conservative as the number of features grows, since it assumes every feature simultaneously hits its extreme — a statistically improbable event.`,
      detail: `The ratio of RSS to worst-case tolerance scales as 1/\u221aN. For ${n} features, RSS is roughly ${((1 / Math.sqrt(n)) * 100).toFixed(0)}% of worst-case, making worst-case analysis unnecessarily expensive. RSS with \u00b13\u03c3 tolerances provides 99.73% confidence when processes are in control.`,
    };
  }

  return {
    method: "rss",
    summary: `With ${n} contributors, RSS analysis is a reasonable approach for production scenarios. Use worst-case only for safety-critical or low-volume applications where 100% conformance is required.`,
    detail: `RSS assumes independent, normally-distributed feature dimensions. Verify this with process capability data (Cpk \u2265 1.33). For critical assemblies — medical, aerospace, or safety-related — worst-case is the conservative, industry-accepted default.`,
  };
}
