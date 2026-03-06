"use client";

import { useState, useMemo } from "react";
import { normalCDF } from "@/lib/calculations";

interface AllocFeature {
  index: number;
  label: string;
  currentTol: number;
  processName: string;
}

interface Props {
  features: AllocFeature[];
  sigmaK: number;
  unit: string;
  decimals: number;
  step: number;
  targetPlus: number | null;
  onApply: (tolerances: number[]) => void;
}

type Method = "equal" | "proportional";

function inverseCDF(p: number): number {
  /* Rational approximation by Peter Acklam — max error 1.15e-9 */
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];

  const pLow = 0.02425, pHigh = 1 - pLow;
  let q: number, r: number;

  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
           ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5]) * q /
           (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
            ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

export default function ToleranceAllocation({
  features, sigmaK, unit, decimals, step, targetPlus, onApply,
}: Props) {
  const [method, setMethod] = useState<Method>("equal");
  const [desiredYield, setDesiredYield] = useState("99.73");
  const [customTarget, setCustomTarget] = useState("");

  const allocTarget = customTarget !== "" ? parseFloat(customTarget) : targetPlus;
  const yieldVal = parseFloat(desiredYield) || 99.73;
  const defectFraction = 1 - yieldVal / 100;

  const allocated = useMemo(() => {
    if (!allocTarget || allocTarget <= 0 || features.length === 0) return null;

    const zRequired = -inverseCDF(defectFraction / 2);
    const sigmaTotal = allocTarget / zRequired;

    if (method === "equal") {
      const sigmaEach = sigmaTotal / Math.sqrt(features.length);
      const tolEach = sigmaEach * sigmaK;
      return features.map(() => Math.max(+tolEach.toFixed(decimals + 1), 0));
    }

    /* Proportional: distribute variance in proportion to current tolerance squared */
    const currentTols = features.map((f) => f.currentTol || step);
    const totalCurrentSq = currentTols.reduce((s, t) => s + t * t, 0);
    if (totalCurrentSq === 0) {
      const sigmaEach = sigmaTotal / Math.sqrt(features.length);
      const tolEach = sigmaEach * sigmaK;
      return features.map(() => Math.max(+tolEach.toFixed(decimals + 1), 0));
    }

    const totalVarianceBudget = sigmaTotal * sigmaTotal;
    return currentTols.map((t) => {
      const fraction = (t * t) / totalCurrentSq;
      const varianceBudget = fraction * totalVarianceBudget;
      const sigmaI = Math.sqrt(varianceBudget);
      return Math.max(+(sigmaI * sigmaK).toFixed(decimals + 1), 0);
    });
  }, [allocTarget, defectFraction, method, features, sigmaK, decimals, step]);

  const allocRss = allocated
    ? Math.sqrt(allocated.reduce((s, t) => s + (t / sigmaK) ** 2, 0)) * sigmaK
    : 0;
  const allocYield = allocated && allocTarget && allocRss > 0
    ? (() => {
        const sigma = allocRss / sigmaK;
        const z = allocTarget / sigma;
        return ((1 - 2 * (1 - normalCDF(z))) * 100);
      })()
    : null;

  return (
    <div className="card px-5 py-4">
      <h3 className="text-sm font-bold text-navy-600 dark:text-gold-400 uppercase tracking-wider mb-1">
        Tolerance Allocation
      </h3>
      <p className="text-xs text-navy-400 dark:text-forest-400 mb-3">
        Reverse-solve: given a target tolerance and desired yield, compute what each feature&apos;s tolerance should be.
      </p>

      <div className="flex flex-wrap items-end gap-4 mb-4">
        {/* Target override */}
        <div>
          <label className="text-[10px] font-semibold text-navy-600 dark:text-forest-300 uppercase tracking-wider block mb-1">
            Target ({unit})
          </label>
          <input
            type="number"
            step={step}
            min={0}
            value={customTarget || (targetPlus ?? "")}
            onChange={(e) => setCustomTarget(e.target.value)}
            placeholder={targetPlus ? String(targetPlus) : "Enter target"}
            className="w-28 text-sm rounded-md border-navy-200 dark:border-forest-600 bg-navy-50/30 dark:bg-forest-700/50
                       text-navy-700 dark:text-forest-200 focus:border-gold-500 focus:ring-gold-500 px-2 py-1 tabular-nums"
          />
        </div>

        {/* Desired yield */}
        <div>
          <label className="text-[10px] font-semibold text-navy-600 dark:text-forest-300 uppercase tracking-wider block mb-1">
            Desired Yield (%)
          </label>
          <input
            type="number"
            step={0.01}
            min={50}
            max={99.9999}
            value={desiredYield}
            onChange={(e) => setDesiredYield(e.target.value)}
            className="w-28 text-sm rounded-md border-navy-200 dark:border-forest-600 bg-navy-50/30 dark:bg-forest-700/50
                       text-navy-700 dark:text-forest-200 focus:border-gold-500 focus:ring-gold-500 px-2 py-1 tabular-nums"
          />
        </div>

        {/* Method */}
        <div>
          <label className="text-[10px] font-semibold text-navy-600 dark:text-forest-300 uppercase tracking-wider block mb-1">
            Method
          </label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as Method)}
            className="text-xs rounded-md border-navy-200 dark:border-forest-600 bg-navy-50/50 dark:bg-forest-700
                       text-navy-700 dark:text-forest-200 focus:border-gold-500 focus:ring-gold-500 py-1 pl-2 pr-6"
          >
            <option value="equal">Equal allocation</option>
            <option value="proportional">Weighted by current</option>
          </select>
        </div>
      </div>

      {!allocTarget || allocTarget <= 0 ? (
        <p className="text-sm text-navy-400 dark:text-forest-400">Set a target tolerance above to calculate allocation.</p>
      ) : allocated ? (
        <>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-50 dark:bg-forest-800/60 border-b border-navy-200 dark:border-forest-700 text-left">
                  <th className="th-cell w-10 text-center">#</th>
                  <th className="th-cell">Feature</th>
                  <th className="th-cell text-right">Current ({unit})</th>
                  <th className="th-cell text-right">Allocated ({unit})</th>
                  <th className="th-cell text-right">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100 dark:divide-forest-700/50">
                {features.map((f, i) => {
                  const diff = allocated[i] - f.currentTol;
                  const diffPct = f.currentTol > 0 ? (diff / f.currentTol) * 100 : 0;
                  const color = diff > 0.0001 ? "text-emerald-600 dark:text-emerald-400" :
                    diff < -0.0001 ? "text-red-600 dark:text-red-400" :
                    "text-navy-400 dark:text-forest-400";
                  return (
                    <tr key={f.index} className="hover:bg-navy-50/50 dark:hover:bg-forest-800/30">
                      <td className="td-cell text-center font-mono text-navy-400 dark:text-forest-500">{f.index + 1}</td>
                      <td className="td-cell text-navy-700 dark:text-forest-200">{f.label}</td>
                      <td className="td-cell text-right font-mono tabular-nums text-navy-600 dark:text-forest-300">
                        {"\u00b1"}{f.currentTol.toFixed(decimals)}
                      </td>
                      <td className="td-cell text-right font-mono tabular-nums font-semibold text-navy-800 dark:text-forest-100">
                        {"\u00b1"}{allocated[i].toFixed(decimals)}
                      </td>
                      <td className={`td-cell text-right font-mono tabular-nums text-xs ${color}`}>
                        {diff > 0.0001 ? "+" : ""}{diff.toFixed(decimals)} ({diffPct > 0 ? "+" : ""}{diffPct.toFixed(0)}%)
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-navy-500 dark:text-forest-300">
            <span>Allocated RSS: <strong>{"\u00b1"}{allocRss.toFixed(decimals)} {unit}</strong></span>
            {allocYield !== null && (
              <span>Expected yield: <strong>{allocYield >= 99.99 ? allocYield.toFixed(4) : allocYield.toFixed(2)}%</strong></span>
            )}
            <button
              onClick={() => allocated && onApply(allocated)}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                         bg-navy-600 dark:bg-gold-500 text-white dark:text-forest-950
                         hover:bg-navy-700 dark:hover:bg-gold-400 transition-colors"
            >
              Apply to Table
            </button>
          </div>
          <p className="text-[10px] text-navy-400 dark:text-forest-400 mt-2 italic">
            {method === "equal"
              ? "Equal allocation distributes the same tolerance to every feature — simplest approach."
              : "Weighted allocation preserves the relative ratio of current tolerances — features with looser tolerances stay proportionally looser."}
          </p>
        </>
      ) : null}
    </div>
  );
}
