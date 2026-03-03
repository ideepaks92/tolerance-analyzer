"use client";

import { useMemo } from "react";

interface DiagramFeature {
  tolPlus: string;
  tolMinus: string;
  direction: 1 | -1;
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const COLORS_LIGHT = [
  { fill: "#e2e5f0", stroke: "#6e7fa6", text: "#283756" },
  { fill: "#f9edcc", stroke: "#a07e1e", text: "#504010" },
  { fill: "#d1f5e8", stroke: "#2d9b6b", text: "#0f4d34" },
  { fill: "#dcfce7", stroke: "#15803d", text: "#14532d" },
  { fill: "#f2da99", stroke: "#a07e1e", text: "#504010" },
  { fill: "#fde2e2", stroke: "#c53030", text: "#7b1c1c" },
  { fill: "#e8ecf6", stroke: "#6e7fa6", text: "#283756" },
  { fill: "#fce7f3", stroke: "#be185d", text: "#831843" },
  { fill: "#d1fae5", stroke: "#059669", text: "#065f46" },
  { fill: "#fef3c7", stroke: "#d97706", text: "#78350f" },
];

const COLORS_DARK = [
  { fill: "#1d4a3160", stroke: "#7ab494", text: "#b5d1bd" },
  { fill: "#50401050", stroke: "#d4a537", text: "#f2da99" },
  { fill: "#0f766e40", stroke: "#2dd4bf", text: "#5eead4" },
  { fill: "#16653440", stroke: "#4ade80", text: "#86efac" },
  { fill: "#78350f40", stroke: "#ebc766", text: "#f2da99" },
  { fill: "#991b1b40", stroke: "#f87171", text: "#fca5a5" },
  { fill: "#1d4a3150", stroke: "#93c5ad", text: "#bfe0cf" },
  { fill: "#9d174d40", stroke: "#f472b6", text: "#f9a8d4" },
  { fill: "#065f4640", stroke: "#34d399", text: "#6ee7b7" },
  { fill: "#78350f40", stroke: "#fbbf24", text: "#fcd34d" },
];

const ROW_H = 56;
const BLK_H = 36;
const NODE_R = 12;

export default function StackupDiagram({
  features,
  refreshKey,
  isDark,
  unit = "mm",
}: {
  features: DiagramFeature[];
  refreshKey?: number;
  isDark: boolean;
  unit?: "mm" | "in";
}) {
  const decimals = unit === "mm" ? 3 : 4;

  const layout = useMemo(() => {
    if (features.length === 0) return null;

    const tolerances = features.map((f) => {
      const tp = Math.abs(parseFloat(f.tolPlus) || 0);
      const tm = Math.abs(parseFloat(f.tolMinus) || 0);
      return (tp + tm) / 2;
    });

    const maxTol = Math.max(...tolerances, 0.001);
    const scale = 200 / maxTol;

    let curX = 0;
    const rows = features.map((f, i) => {
      const w = Math.max(tolerances[i] * scale, 70);
      const startX = curX;
      const endX = f.direction === 1 ? curX + w : curX - w;
      curX = endX;
      return {
        i,
        startX,
        endX,
        left: Math.min(startX, endX),
        width: Math.abs(endX - startX),
        tol: tolerances[i],
        dir: f.direction,
      };
    });

    const allX = rows.flatMap((r) => [r.left, r.left + r.width]);
    allX.push(0, curX);
    return {
      rows,
      xMin: Math.min(...allX),
      xMax: Math.max(...allX),
      finalX: curX,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, refreshKey]);

  if (!layout || layout.rows.length === 0) return null;

  const { rows, xMin, xMax, finalX } = layout;
  const n = rows.length;
  const colors = isDark ? COLORS_DARK : COLORS_LIGHT;

  const PAD = { top: 32, bottom: 52, left: 44, right: 44 };
  const svgW = xMax - xMin + PAD.left + PAD.right;
  const gapRowY = n * ROW_H + 8;
  const svgH = gapRowY + PAD.top + PAD.bottom;
  const ox = -xMin + PAD.left;

  const tx = (x: number) => x + ox;
  const cy = (row: number) => PAD.top + row * ROW_H + BLK_H / 2;

  const pts: string[] = [`M ${tx(0)} ${cy(0)}`];
  for (let i = 0; i < n; i++) {
    pts.push(`L ${tx(rows[i].endX)} ${cy(i)}`);
    if (i < n - 1) pts.push(`L ${tx(rows[i].endX)} ${cy(i + 1)}`);
  }
  const gapCY = PAD.top + gapRowY;
  pts.push(`L ${tx(rows[n - 1].endX)} ${gapCY}`);
  pts.push(`L ${tx(0)} ${gapCY}`);
  pts.push("Z");

  const pathStroke = isDark ? "#1d4a31" : "#c7cdde";
  const connStroke = isDark ? "#347a55" : "#9aa5c0";
  const nodeFill = isDark ? "#0a1a10" : "white";
  const nodeStroke = isDark ? "#7ab494" : "#4d608d";
  const nodeText = isDark ? "#dce8e0" : "#1c2840";
  const rowNumFill = isDark ? "#4d9670" : "#9aa5c0";
  const gapStroke = isDark ? "#d4a537" : "#c9a227";
  const gapTextFill = isDark ? "#ebc766" : "#a07e1e";

  const nodes: { x: number; y: number; label: string }[] = [
    { x: tx(0), y: cy(0), label: LETTERS[0] },
  ];
  for (let i = 0; i < n; i++) {
    nodes.push({
      x: tx(rows[i].endX),
      y: cy(i),
      label: i === n - 1 ? LETTERS[0] + "\u02BC" : LETTERS[i + 1],
    });
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto px-2 py-4">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full"
          style={{ minWidth: 520, maxHeight: 560 }}
          preserveAspectRatio="xMidYMin meet"
        >
          <path d={pts.join(" ")} fill="none" stroke={pathStroke} strokeWidth={2.5} strokeDasharray="6 4" />

          {rows.map((r, i) =>
            i < n - 1 ? (
              <line key={`vc-${i}`} x1={tx(r.endX)} y1={cy(i)} x2={tx(r.endX)} y2={cy(i + 1)} stroke={connStroke} strokeWidth={1.5} strokeDasharray="4 3" />
            ) : null
          )}

          <line x1={tx(rows[n - 1].endX)} y1={cy(n - 1)} x2={tx(rows[n - 1].endX)} y2={gapCY} stroke={connStroke} strokeWidth={1.5} strokeDasharray="4 3" />
          <line x1={tx(0)} y1={cy(0)} x2={tx(0)} y2={gapCY} stroke={connStroke} strokeWidth={1.5} strokeDasharray="4 3" />

          <line x1={Math.min(tx(finalX), tx(0)) + NODE_R + 2} y1={gapCY} x2={Math.max(tx(finalX), tx(0)) - NODE_R - 2} y2={gapCY} stroke={gapStroke} strokeWidth={2.5} strokeDasharray="8 4" strokeLinecap="round" />
          <text x={(tx(finalX) + tx(0)) / 2} y={gapCY + 18} textAnchor="middle" fill={gapTextFill} fontSize={10.5} fontWeight={600}>
            {"Gap \u2014 Target Tolerance"}
          </text>

          {rows.map((r, i) => {
            const c = colors[i % colors.length];
            const bx = tx(r.left);
            const by = PAD.top + i * ROW_H;
            const from = LETTERS[i];
            const to = i === n - 1 ? "A\u02BC" : LETTERS[i + 1];
            const wide = r.width > 110;

            return (
              <g key={`blk-${i}`}>
                <rect x={bx} y={by} width={r.width} height={BLK_H} rx={6} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} />
                {wide ? (
                  <text
                    x={bx + r.width / 2}
                    y={by + BLK_H / 2 + 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={c.text}
                    fontSize={13}
                    fontWeight={600}
                    fontFamily="ui-monospace, monospace"
                  >
                    {`${from}-${to} (\u00b1${r.tol.toFixed(decimals)})`}
                  </text>
                ) : (
                  <text
                    x={bx + r.width / 2}
                    y={by + BLK_H / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={c.text}
                    fontSize={11}
                    fontWeight={600}
                  >
                    {`${from}-${to}`}
                  </text>
                )}
                <text x={8} y={by + BLK_H / 2} textAnchor="start" dominantBaseline="central" fill={rowNumFill} fontSize={9.5} fontFamily="ui-monospace, monospace">
                  {`#${i + 1}`}
                </text>
              </g>
            );
          })}

          {nodes.map((nd, i) => (
            <g key={`nd-${i}`}>
              <circle cx={nd.x} cy={nd.y} r={NODE_R} fill={nodeFill} stroke={nodeStroke} strokeWidth={1.5} />
              <text x={nd.x} y={nd.y + 0.5} textAnchor="middle" dominantBaseline="central" fill={nodeText} fontSize={10} fontWeight={700}>
                {nd.label}
              </text>
            </g>
          ))}

          <circle cx={tx(0)} cy={gapCY} r={NODE_R} fill={nodeFill} stroke={gapStroke} strokeWidth={1.5} />
          <text x={tx(0)} y={gapCY + 0.5} textAnchor="middle" dominantBaseline="central" fill={gapStroke} fontSize={10} fontWeight={700}>A</text>

          {Math.abs(finalX) > 1 && (
            <g>
              <circle cx={tx(finalX)} cy={gapCY} r={NODE_R} fill={nodeFill} stroke={gapStroke} strokeWidth={1.5} />
              <text x={tx(finalX)} y={gapCY + 0.5} textAnchor="middle" dominantBaseline="central" fill={gapStroke} fontSize={10} fontWeight={700}>{"A\u02BC"}</text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
