"use client";

interface SensitivityFeature {
  label: string;
  tolPlus: number;
  tolMinus: number;
  direction: 1 | -1;
}

interface Props {
  features: SensitivityFeature[];
  sigmaK: number;
  unit: string;
  decimals: number;
}

export default function SensitivityChart({ features, sigmaK, unit, decimals }: Props) {
  const items = features.map((f, i) => {
    const sigma_i = (Math.abs(f.tolPlus) + Math.abs(f.tolMinus)) / (2 * sigmaK);
    return { index: i, label: f.label, variance: sigma_i * sigma_i, tol: Math.max(Math.abs(f.tolPlus), Math.abs(f.tolMinus)) };
  });

  const totalVariance = items.reduce((s, it) => s + it.variance, 0);
  if (totalVariance === 0) return null;

  const withPct = items
    .map((it) => ({ ...it, pct: (it.variance / totalVariance) * 100 }))
    .sort((a, b) => b.pct - a.pct);

  const barH = 22;
  const gap = 6;
  const labelW = 90;
  const pctW = 50;
  const barAreaW = 300;
  const svgW = labelW + barAreaW + pctW + 10;
  const svgH = withPct.length * (barH + gap) + 10;

  const barColor = (pct: number) => {
    if (pct >= 40) return "#ef4444";
    if (pct >= 25) return "#f59e0b";
    if (pct >= 10) return "#3b82f6";
    return "#22c55e";
  };

  return (
    <div className="card px-5 py-4">
      <h3 className="text-sm font-bold text-navy-600 dark:text-gold-400 uppercase tracking-wider mb-3">
        Sensitivity Analysis
      </h3>
      <p className="text-xs text-navy-400 dark:text-forest-400 mb-3">
        Each feature&apos;s percentage contribution to total RSS variance. Focus design effort on the top contributors.
      </p>
      <div className="overflow-x-auto">
        <svg width={svgW} height={svgH} className="block">
          {withPct.map((item, i) => {
            const y = i * (barH + gap) + 4;
            const w = (item.pct / 100) * barAreaW;
            return (
              <g key={item.index}>
                <text
                  x={labelW - 6}
                  y={y + barH / 2 + 1}
                  textAnchor="end"
                  className="fill-navy-700 dark:fill-forest-200"
                  fontSize={11}
                  fontWeight={600}
                >
                  #{item.index + 1} ({item.tol.toFixed(decimals)} {unit})
                </text>
                <rect
                  x={labelW}
                  y={y}
                  width={Math.max(w, 2)}
                  height={barH}
                  rx={3}
                  fill={barColor(item.pct)}
                  opacity={0.85}
                />
                <text
                  x={labelW + Math.max(w, 2) + 6}
                  y={y + barH / 2 + 1}
                  className="fill-navy-600 dark:fill-forest-300"
                  fontSize={11}
                  fontWeight={600}
                  dominantBaseline="middle"
                >
                  {item.pct.toFixed(1)}%
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-[10px]">
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#ef4444" }} /> {"\u226540%"} — Critical</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#f59e0b" }} /> 25–39% — High</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#3b82f6" }} /> 10–24% — Moderate</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#22c55e" }} /> {"<10%"} — Low</span>
      </div>
    </div>
  );
}
