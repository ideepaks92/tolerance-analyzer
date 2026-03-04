"use client";

import { useMemo } from "react";

export interface MCStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  median: number;
  p0135: number;
  p99865: number;
  dppm: number | null;
  yieldPct: number | null;
  iterations: number;
}

export interface MCHistogram {
  bins: number[];
  binCenters: number[];
  binWidth: number;
  binMin: number;
  binMax: number;
}

export interface MCResult {
  stats: MCStats;
  histogram: MCHistogram;
}

interface Props {
  result: MCResult;
  targetPlus: number | null;
  targetMinus: number | null;
  unit: string;
  decimals: number;
  sigmaK: number;
  nominalOffset?: number;
}

export default function MonteCarloChart({
  result,
  targetPlus,
  targetMinus,
  unit,
  decimals,
  sigmaK,
  nominalOffset = 0,
}: Props) {
  const { stats, histogram } = result;
  const off = nominalOffset;

  const shiftedBinMin = histogram.binMin + off;
  const shiftedBinMax = histogram.binMax + off;
  const shiftedMean = stats.mean + off;

  const svgW = 700;
  const svgH = 260;
  const pad = { top: 16, right: 20, bottom: 36, left: 50 };
  const chartW = svgW - pad.left - pad.right;
  const chartH = svgH - pad.top - pad.bottom;

  const maxCount = useMemo(
    () => Math.max(...histogram.bins, 1),
    [histogram.bins]
  );

  const xScale = (val: number) =>
    pad.left +
    ((val - shiftedBinMin) / (shiftedBinMax - shiftedBinMin)) * chartW;

  const barW = Math.max(1, chartW / histogram.bins.length - 0.5);

  const ticks = useMemo(() => {
    const range = shiftedBinMax - shiftedBinMin;
    const step = parseFloat((range / 6).toPrecision(1));
    if (step <= 0) return [];
    const arr: number[] = [];
    let v = Math.ceil(shiftedBinMin / step) * step;
    while (v <= shiftedBinMax) {
      arr.push(v);
      v += step;
    }
    return arr;
  }, [shiftedBinMin, shiftedBinMax]);

  const yTicks = useMemo(() => {
    const step = parseFloat((maxCount / 4).toPrecision(1)) || 1;
    const arr: number[] = [];
    let v = 0;
    while (v <= maxCount) {
      arr.push(v);
      v += step;
    }
    return arr;
  }, [maxCount]);

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const barFill = isDark ? "#4d9670" : "#6e7fa6";
  const axisColor = isDark ? "#4d9670" : "#9aa5c0";
  const textColor = isDark ? "#b5d1bd" : "#4d608d";
  const meanColor = isDark ? "#ebc766" : "#c9a227";
  const targetColor = "#dc2626";
  const sigmaColor = isDark ? "#7ab494" : "#6e7fa6";
  const fourSigmaColor = "#16a34a";

  const shiftedTargetPlus = targetPlus !== null ? targetPlus + off : null;
  const shiftedTargetMinus = targetMinus !== null ? -targetMinus + off : null;

  return (
    <div>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Y axis */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + chartH} stroke={axisColor} strokeWidth={1} />
        {yTicks.map((t) => (
          <g key={`yt-${t}`}>
            <line x1={pad.left - 4} y1={pad.top + chartH - (t / maxCount) * chartH} x2={pad.left} y2={pad.top + chartH - (t / maxCount) * chartH} stroke={axisColor} strokeWidth={0.5} />
            <text x={pad.left - 6} y={pad.top + chartH - (t / maxCount) * chartH + 3} textAnchor="end" fontSize={8} fill={textColor}>
              {t >= 1000 ? `${(t / 1000).toFixed(0)}k` : t}
            </text>
          </g>
        ))}

        {/* X axis */}
        <line x1={pad.left} y1={pad.top + chartH} x2={pad.left + chartW} y2={pad.top + chartH} stroke={axisColor} strokeWidth={1} />
        {ticks.map((t) => (
          <g key={`xt-${t}`}>
            <line x1={xScale(t)} y1={pad.top + chartH} x2={xScale(t)} y2={pad.top + chartH + 4} stroke={axisColor} strokeWidth={0.5} />
            <text x={xScale(t)} y={pad.top + chartH + 14} textAnchor="middle" fontSize={8} fill={textColor}>
              {t.toFixed(decimals)}
            </text>
          </g>
        ))}

        <text x={pad.left + chartW / 2} y={svgH - 4} textAnchor="middle" fontSize={9} fill={textColor}>
          {off !== 0 ? `Stack-up dimension (${unit})` : `Stack-up tolerance (${unit})`}
        </text>

        {/* Histogram bars */}
        {histogram.bins.map((count, i) => {
          if (count === 0) return null;
          const cx = histogram.binCenters[i] + off;
          const x = xScale(cx) - barW / 2;
          const h = (count / maxCount) * chartH;
          const isOutside =
            shiftedTargetPlus !== null &&
            shiftedTargetMinus !== null &&
            (cx > shiftedTargetPlus || cx < shiftedTargetMinus);
          return (
            <rect
              key={i}
              x={x} y={pad.top + chartH - h} width={barW} height={h}
              fill={isOutside ? targetColor : barFill}
              opacity={isOutside ? 0.5 : 0.75}
              rx={0.5}
            />
          );
        })}

        {/* 4σ lines (green) */}
        {[shiftedMean - 4 * stats.stdDev, shiftedMean + 4 * stats.stdDev].map(
          (v, i) => (
            <line
              key={`4sig-${i}`}
              x1={xScale(v)} y1={pad.top} x2={xScale(v)} y2={pad.top + chartH}
              stroke={fourSigmaColor} strokeWidth={0.8} strokeDasharray="3 4"
            />
          )
        )}

        {/* kσ bounds */}
        {[shiftedMean - sigmaK * stats.stdDev, shiftedMean + sigmaK * stats.stdDev].map(
          (v, i) => (
            <line
              key={`sig-${i}`}
              x1={xScale(v)} y1={pad.top} x2={xScale(v)} y2={pad.top + chartH}
              stroke={sigmaColor} strokeWidth={0.8} strokeDasharray="2 3"
            />
          )
        )}

        {/* Mean line */}
        <line
          x1={xScale(shiftedMean)} y1={pad.top} x2={xScale(shiftedMean)} y2={pad.top + chartH}
          stroke={meanColor} strokeWidth={1.5} strokeDasharray="4 2"
        />

        {/* Target lines */}
        {shiftedTargetPlus !== null && (
          <line
            x1={xScale(shiftedTargetPlus)} y1={pad.top} x2={xScale(shiftedTargetPlus)} y2={pad.top + chartH}
            stroke={targetColor} strokeWidth={1.5} strokeDasharray="6 3"
          />
        )}
        {shiftedTargetMinus !== null && (
          <line
            x1={xScale(shiftedTargetMinus)} y1={pad.top} x2={xScale(shiftedTargetMinus)} y2={pad.top + chartH}
            stroke={targetColor} strokeWidth={1.5} strokeDasharray="6 3"
          />
        )}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-navy-500 dark:text-forest-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 rounded" style={{ background: meanColor }} />
          Mean ({shiftedMean.toFixed(decimals)} {unit})
        </span>
        {shiftedTargetPlus !== null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 rounded" style={{ background: targetColor }} />
            Target limits ({shiftedTargetPlus.toFixed(decimals)} / {shiftedTargetMinus?.toFixed(decimals)} {unit})
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 rounded" style={{ background: sigmaColor }} />
          {`\u00b1${sigmaK}\u03c3`} bounds
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 rounded" style={{ background: fourSigmaColor }} />
          {"\u00b14\u03c3"} bounds
        </span>
        {shiftedTargetPlus !== null && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm opacity-50" style={{ background: targetColor }} />
            Out of spec
          </span>
        )}
        <span className="text-navy-400 dark:text-forest-500 ml-auto">
          {stats.iterations.toLocaleString()} iterations
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
        <Stat label="Mean" value={shiftedMean.toFixed(decimals)} unit={unit} />
        <Stat label="Std Dev" value={stats.stdDev.toFixed(decimals)} unit={unit} />
        <Stat label="Min" value={(stats.min + off).toFixed(decimals)} unit={unit} />
        <Stat label="Max" value={(stats.max + off).toFixed(decimals)} unit={unit} />
        <Stat
          label="MC DPPM"
          value={stats.dppm !== null ? stats.dppm.toLocaleString() : "\u2014"}
        />
        <Stat
          label="MC Yield"
          value={stats.yieldPct !== null ? `${stats.yieldPct.toFixed(4)}%` : "\u2014"}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-bold uppercase tracking-wider text-navy-500 dark:text-forest-400 mb-0.5">
        {label}
      </p>
      <p className="text-sm font-mono font-semibold text-navy-800 dark:text-forest-100">
        {value}
        {unit && (
          <span className="text-[10px] font-normal text-navy-400 dark:text-forest-400 ml-0.5">{unit}</span>
        )}
      </p>
    </div>
  );
}
