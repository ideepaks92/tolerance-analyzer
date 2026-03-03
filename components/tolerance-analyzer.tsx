"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  calculateStackup,
  sigmaCoverage,
  formatTolerance,
  formatDppm,
  formatYield,
  getQualityLevel,
  getRecommendation,
  type QualityLevel,
  type StackupRecommendation,
} from "@/lib/calculations";
import { MANUFACTURING_PROCESSES, getProcessById } from "@/lib/constants";
import StackupDiagram from "./stackup-diagram";
import ReferencesSection from "./references-section";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const SIGMA_OPTIONS = [3, 3.5, 4, 4.5, 5, 6];

const NODE_PLACEHOLDERS: Record<number, string> = {
  0: "e.g. Hole center",
  1: "e.g. Datum A",
};
const DEFAULT_NODE_PH = "e.g. Feature name";

const QUALITY_STYLES: Record<
  QualityLevel,
  { bg: string; border: string; text: string; label: string }
> = {
  excellent: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    label: "Excellent",
  },
  good: {
    bg: "bg-sky-50 dark:bg-sky-900/20",
    border: "border-sky-200 dark:border-sky-800",
    text: "text-sky-700 dark:text-sky-400",
    label: "Good",
  },
  marginal: {
    bg: "bg-amber-50 dark:bg-amber-900/20",
    border: "border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
    label: "Marginal",
  },
  poor: {
    bg: "bg-red-50 dark:bg-red-900/20",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-400",
    label: "Poor",
  },
};

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

interface Feature {
  id: string;
  processId: string;
  tolPlus: string;
  tolMinus: string;
  direction: 1 | -1;
}

let _nextId = 1;
function uid() {
  return `f-${_nextId++}-${Date.now()}`;
}

function createFeature(u: "mm" | "in" = "mm"): Feature {
  const proc = MANUFACTURING_PROCESSES[0];
  const tol =
    u === "in"
      ? (proc.defaultTol / 25.4).toFixed(4)
      : proc.defaultTol.toString();
  return {
    id: uid(),
    processId: proc.id,
    tolPlus: tol,
    tolMinus: tol,
    direction: 1,
  };
}

function convertTol(val: string, factor: number, dec: number): string {
  const num = parseFloat(val);
  if (isNaN(num) || num === 0) return val;
  return (num * factor).toFixed(dec);
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function ToleranceAnalyzer() {
  const [features, setFeatures] = useState<Feature[]>(() =>
    Array.from({ length: 7 }, () => createFeature())
  );
  const [targetPlus, setTargetPlus] = useState("");
  const [targetMinus, setTargetMinus] = useState("");
  const [linkTarget, setLinkTarget] = useState(true);
  const [diagramKey, setDiagramKey] = useState(0);
  const [title, setTitle] = useState("");
  const [userName, setUserName] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [unit, setUnit] = useState<"mm" | "in">("mm");
  const [sigmaK, setSigmaK] = useState(3);
  const [nodeDescriptions, setNodeDescriptions] = useState<string[]>(() =>
    Array(26).fill("")
  );
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);

  const targetPlusRef = useRef<HTMLInputElement>(null);
  const targetMinusRef = useRef<HTMLInputElement>(null);

  const decimals = unit === "mm" ? 3 : 4;
  const step = unit === "mm" ? 0.025 : 0.001;

  /* ---- theme ---- */

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ta-theme") as
        | "dark"
        | "light"
        | null;
      if (saved) {
        setTheme(saved);
        document.documentElement.classList.toggle("dark", saved === "dark");
      }
    } catch {
      /* empty */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem("ta-theme", next);
      } catch {
        /* empty */
      }
      return next;
    });
  }, []);

  /* ---- unit toggle ---- */

  const toggleUnit = useCallback(() => {
    const newUnit = unit === "mm" ? "in" : "mm";
    const factor = newUnit === "in" ? 1 / 25.4 : 25.4;
    const dec = newUnit === "mm" ? 3 : 4;

    setFeatures((fs) =>
      fs.map((f) => ({
        ...f,
        tolPlus: convertTol(f.tolPlus, factor, dec),
        tolMinus: convertTol(f.tolMinus, factor, dec),
      }))
    );
    setTargetPlus((prev) => (prev ? convertTol(prev, factor, dec) : prev));
    setTargetMinus((prev) => (prev ? convertTol(prev, factor, dec) : prev));
    setUnit(newUnit);
  }, [unit]);

  /* ---- calculations ---- */

  const featureInputs = useMemo(
    () =>
      features.map((f) => ({
        tolPlus: parseFloat(f.tolPlus) || 0,
        tolMinus: parseFloat(f.tolMinus) || 0,
        direction: f.direction,
      })),
    [features]
  );

  const results = useMemo(() => {
    const tp = targetPlus !== "" ? parseFloat(targetPlus) : null;
    const tm = targetMinus !== "" ? parseFloat(targetMinus) : null;
    return calculateStackup(featureInputs, tp, linkTarget ? tp : tm, sigmaK);
  }, [featureInputs, targetPlus, targetMinus, linkTarget, sigmaK]);

  const hasTarget = targetPlus !== "" && parseFloat(targetPlus) > 0;
  const quality = results.dppm !== null ? getQualityLevel(results.dppm) : null;
  const qStyle = quality ? QUALITY_STYLES[quality] : null;

  const recommendation: StackupRecommendation = useMemo(() => {
    const tp = targetPlus !== "" ? parseFloat(targetPlus) : null;
    const tm = targetMinus !== "" ? parseFloat(targetMinus) : null;
    return getRecommendation(featureInputs, results, tp, linkTarget ? tp : tm);
  }, [featureInputs, results, targetPlus, targetMinus, linkTarget]);

  /* ---- feature CRUD ---- */

  const updateFeature = useCallback(
    (id: string, patch: Partial<Feature>) => {
      setFeatures((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const merged = { ...f, ...patch };
          if ("tolPlus" in patch && !("tolMinus" in patch)) {
            merged.tolMinus = patch.tolPlus!;
          }
          return merged;
        })
      );
    },
    []
  );

  const handleProcessChange = useCallback(
    (id: string, processId: string) => {
      const proc = getProcessById(processId);
      if (!proc) return;
      const tol =
        unit === "in"
          ? (proc.defaultTol / 25.4).toFixed(4)
          : proc.defaultTol.toString();
      setFeatures((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, processId, tolPlus: tol, tolMinus: tol } : f
        )
      );
    },
    [unit]
  );

  const addFeature = useCallback(() => {
    setFeatures((prev) => [...prev, createFeature(unit)]);
  }, [unit]);

  const removeFeature = useCallback((id: string) => {
    setFeatures((prev) =>
      prev.length <= 1 ? prev : prev.filter((f) => f.id !== id)
    );
  }, []);

  const refreshDiagram = useCallback(() => {
    setDiagramKey((k) => k + 1);
  }, []);

  const resetAll = useCallback(() => {
    _nextId = 1;
    setFeatures(Array.from({ length: 7 }, () => createFeature(unit)));
    setTargetPlus("");
    setTargetMinus("");
    setLinkTarget(true);
    setDiagramKey((k) => k + 1);
    setTitle("");
    setUserName("");
    setNodeDescriptions(Array(26).fill(""));
  }, [unit]);

  const updateNodeDescription = useCallback(
    (idx: number, value: string) => {
      setNodeDescriptions((prev) => {
        const next = [...prev];
        next[idx] = value;
        return next;
      });
    },
    []
  );

  const handleTargetPlus = (v: string) => {
    setTargetPlus(v);
    if (linkTarget) setTargetMinus(v);
  };
  const handleTargetMinus = (v: string) => {
    setTargetMinus(v);
    if (linkTarget) setTargetPlus(v);
  };

  useEffect(() => {
    const elPlus = targetPlusRef.current;
    const elMinus = targetMinusRef.current;
    const hPlus = (e: WheelEvent) => {
      e.preventDefault();
      const cur = parseFloat(targetPlus) || 0;
      const delta = e.deltaY < 0 ? step : -step;
      const nv = Math.max(0, +(cur + delta).toFixed(decimals));
      handleTargetPlus(nv.toString());
    };
    const hMinus = (e: WheelEvent) => {
      e.preventDefault();
      if (linkTarget) return;
      const cur = parseFloat(targetMinus) || 0;
      const delta = e.deltaY < 0 ? step : -step;
      const nv = Math.max(0, +(cur + delta).toFixed(decimals));
      handleTargetMinus(nv.toString());
    };
    elPlus?.addEventListener("wheel", hPlus, { passive: false });
    elMinus?.addEventListener("wheel", hMinus, { passive: false });
    return () => {
      elPlus?.removeEventListener("wheel", hPlus);
      elMinus?.removeEventListener("wheel", hMinus);
    };
  });

  /* ---- export ---- */

  const buildExportData = useCallback(() => {
    const methodLabel =
      recommendation.method === "either"
        ? "Either Method"
        : recommendation.method === "rss"
          ? "Use RSS"
          : "Use Worst Case";
    return {
      title,
      user: userName,
      unit,
      features: features.map((f, i) => {
        const fromDesc = nodeDescriptions[i];
        const toIdx = i === features.length - 1 ? 0 : i + 1;
        const toDesc = nodeDescriptions[toIdx];
        return {
          from: LETTERS[i] + (fromDesc ? ` (${fromDesc})` : ""),
          to:
            (i === features.length - 1 ? "A\u02BC" : LETTERS[i + 1]) +
            (toDesc ? ` (${toDesc})` : ""),
          process: getProcessById(f.processId)?.name || "Custom",
          tolPlus: parseFloat(f.tolPlus) || 0,
          tolMinus: parseFloat(f.tolMinus) || 0,
          direction: f.direction as 1 | -1,
        };
      }),
      results,
      recommendation: recommendation.summary,
      recommendationMethod: methodLabel,
      targetPlus: targetPlus !== "" ? parseFloat(targetPlus) : null,
      targetMinus: targetMinus !== "" ? parseFloat(targetMinus) : null,
      sigmaK,
    };
  }, [title, userName, unit, features, nodeDescriptions, results, recommendation, targetPlus, targetMinus, sigmaK]);

  const handleExportPDF = useCallback(async () => {
    const { exportToPDF } = await import("@/lib/export");
    exportToPDF(buildExportData());
  }, [buildExportData]);

  const handleExportXLSX = useCallback(async () => {
    const { exportToXLSX } = await import("@/lib/export");
    exportToXLSX(buildExportData());
  }, [buildExportData]);

  /* ---- render ---- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-navy-50/40 dark:from-forest-950 dark:to-forest-900">
      {/* ===== HEADER ===== */}
      <header className="bg-white/90 dark:bg-forest-950/90 backdrop-blur-sm border-b border-navy-200 dark:border-forest-700 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold font-serif text-navy-800 dark:text-forest-100 tracking-tight">
                Tolerance Stack-Up Analysis
              </h1>
              <p className="text-[11px] sm:text-sm text-navy-500 dark:text-forest-300/70 mt-0.5">
                Statistical tolerance analysis for mechanical assemblies
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className="ml-1 p-2 rounded-lg bg-navy-100 dark:bg-forest-700
                         hover:bg-navy-200 dark:hover:bg-forest-600 transition-colors"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>

          {/* Target tolerance */}
          <div className="flex items-end gap-2 bg-gold-50 dark:bg-gold-900/20 border border-gold-300 dark:border-gold-700 rounded-lg px-3 py-2.5">
            <div>
              <p className="text-[10px] font-semibold text-navy-600 dark:text-gold-400 uppercase tracking-wider mb-1">
                Stack-Up Target
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-navy-700 dark:text-gold-400">+</span>
                <input
                  ref={targetPlusRef}
                  type="number"
                  step={step}
                  min="0"
                  value={targetPlus}
                  onChange={(e) => handleTargetPlus(e.target.value)}
                  className="w-20 rounded-md border-gold-300 dark:border-gold-700 bg-white dark:bg-forest-800 text-sm font-mono tabular-nums
                             focus:border-gold-500 focus:ring-gold-500 text-right px-2 py-1 dark:text-forest-200"
                />
                <span className="text-xs font-medium text-navy-700 dark:text-gold-400">{"/\u2212"}</span>
                <input
                  ref={targetMinusRef}
                  type="number"
                  step={step}
                  min="0"
                  value={linkTarget ? targetPlus : targetMinus}
                  onChange={(e) => handleTargetMinus(e.target.value)}
                  disabled={linkTarget}
                  className="w-20 rounded-md border-gold-300 dark:border-gold-700 bg-white dark:bg-forest-800 text-sm font-mono tabular-nums
                             focus:border-gold-500 focus:ring-gold-500 text-right px-2 py-1 dark:text-forest-200
                             disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  onClick={toggleUnit}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-md border
                             border-navy-200 dark:border-forest-600 bg-navy-50 dark:bg-forest-700
                             text-navy-600 dark:text-gold-400
                             hover:bg-navy-100 dark:hover:bg-forest-600 transition-colors"
                  title={`Switch to ${unit === "mm" ? "inches" : "millimeters"}`}
                >
                  {unit}
                </button>
              </div>
            </div>
            <button
              onClick={() => setLinkTarget((v) => !v)}
              title={linkTarget ? "Symmetric \u2014 click to allow asymmetric target" : "Asymmetric \u2014 click to lock symmetric"}
              className={`mb-0.5 p-1.5 rounded transition-colors ${
                linkTarget
                  ? "text-navy-600 dark:text-gold-400 bg-navy-100 dark:bg-forest-700 hover:bg-navy-200 dark:hover:bg-forest-600"
                  : "text-navy-400 hover:text-navy-600 dark:hover:text-forest-200 hover:bg-navy-100 dark:hover:bg-forest-700"
              }`}
            >
              <LockIcon locked={linkTarget} />
            </button>
          </div>
        </div>
      </header>

      {/* ===== MAIN ===== */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Title + analyst + export */}
        <div className="card px-4 py-3 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. Housing Gap Analysis)"
              className="flex-1 text-base sm:text-lg font-semibold bg-transparent border-0 border-b-2 border-dashed
                         border-navy-200 dark:border-forest-600 focus:border-gold-500 focus:ring-0
                         text-navy-800 dark:text-forest-100
                         placeholder:text-navy-300 dark:placeholder:text-forest-500 px-1 py-1"
            />
            <div className="flex gap-2 shrink-0">
              <button onClick={handleExportPDF} className="export-btn">
                <DocumentIcon /> PDF
              </button>
              <button onClick={handleExportXLSX} className="export-btn">
                <TableIcon /> XLSX
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-navy-500 dark:text-forest-300 shrink-0">User:</span>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="Your name"
              className="max-w-xs text-sm bg-transparent border-0 border-b border-dashed
                         border-navy-200 dark:border-forest-600 focus:border-gold-500 focus:ring-0
                         text-navy-700 dark:text-forest-200
                         placeholder:text-navy-300 dark:placeholder:text-forest-500 px-1 py-0.5"
            />
          </div>
        </div>

        {/* Diagram */}
        <div>
          <StackupDiagram
            features={features}
            refreshKey={diagramKey}
            isDark={theme === "dark"}
            unit={unit}
          />
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px] text-navy-400 dark:text-forest-400">
              Block widths scaled to tolerance magnitude
            </span>
            <button
              onClick={refreshDiagram}
              className="text-[11px] font-medium text-navy-600 dark:text-gold-400
                         hover:text-navy-800 dark:hover:text-gold-300 transition-colors
                         px-2.5 py-1 rounded-md hover:bg-gold-50 dark:hover:bg-gold-900/20
                         border border-transparent hover:border-gold-300 dark:hover:border-gold-700"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Feature Table */}
        <div className="card overflow-hidden">
          {/* Table toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-navy-100 dark:border-forest-700/50 bg-navy-50/30 dark:bg-forest-800/40">
            <span className="text-sm font-bold text-navy-600 dark:text-gold-400 uppercase tracking-wider">
              Features
            </span>
            <button
              onClick={toggleUnit}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md border
                         border-navy-200 dark:border-forest-600 bg-white dark:bg-forest-700
                         hover:bg-navy-50 dark:hover:bg-forest-600 transition-colors"
            >
              <span className={unit === "mm" ? "text-navy-800 dark:text-gold-400" : "text-navy-400 dark:text-forest-500"}>mm</span>
              <span className="text-navy-300 dark:text-forest-500">/</span>
              <span className={unit === "in" ? "text-navy-800 dark:text-gold-400" : "text-navy-400 dark:text-forest-500"}>in</span>
            </button>
          </div>

          <p className="px-4 py-1.5 text-[11px] text-navy-400 dark:text-forest-400 italic border-b border-navy-100 dark:border-forest-700/30">
            For a two-part stack-up, assume shared datums and simply add both feature tolerance analyses.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-50 dark:bg-forest-800/60 border-b border-navy-200 dark:border-forest-700 text-left">
                  <th className="th-cell w-10 text-center">#</th>
                  <th className="th-cell text-left">From</th>
                  <th className="th-cell text-left">To</th>
                  <th className="th-cell w-32">Mfg Process</th>
                  <th className="th-cell w-28 text-right">{"+ Tol (" + unit + ")"}</th>
                  <th className="th-cell w-28 text-right">{"\u2212 Tol (" + unit + ")"}</th>
                  <th className="th-cell w-14 text-center">Dir</th>
                  <th className="th-cell w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100 dark:divide-forest-700/50">
                {features.map((f, idx) => (
                  <FeatureRow
                    key={f.id}
                    feature={f}
                    index={idx}
                    total={features.length}
                    canDelete={features.length > 1}
                    onUpdate={updateFeature}
                    onProcessChange={handleProcessChange}
                    onRemove={removeFeature}
                    unit={unit}
                    step={step}
                    decimals={decimals}
                    nodeDescriptions={nodeDescriptions}
                    onDescChange={updateNodeDescription}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 bg-navy-50/40 dark:bg-forest-800/30 border-t border-navy-100 dark:border-forest-700 flex items-center justify-between">
            <button
              onClick={addFeature}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 dark:text-gold-400 hover:text-navy-800 dark:hover:text-gold-300 transition-colors"
            >
              <PlusIcon />
              Add Feature
            </button>
            <button
              onClick={resetAll}
              className="text-xs text-navy-400 dark:text-forest-400 hover:text-navy-600 dark:hover:text-forest-200 transition-colors"
            >
              Reset All
            </button>
          </div>
        </div>

        {/* Recommendation */}
        <RecommendationCard recommendation={recommendation} />

        {/* Results grid */}
        <div className="flex items-center gap-3 mb-1">
          <p className="text-sm font-bold text-navy-600 dark:text-gold-400 uppercase tracking-wider">Results</p>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-navy-500 dark:text-forest-300">RSS coverage:</label>
            <select
              value={sigmaK}
              onChange={(e) => setSigmaK(parseFloat(e.target.value))}
              className="text-xs rounded-md border-navy-200 dark:border-forest-600 bg-navy-50/50 dark:bg-forest-700
                         text-navy-700 dark:text-forest-200 focus:border-gold-500 focus:ring-gold-500 py-0.5 pl-2 pr-6"
            >
              {SIGMA_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {k}{"\u03c3"} ({sigmaCoverage(k).toFixed(k >= 4 ? 4 : 2)}%)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="metric-card col-span-1">
            <p className="metric-label text-navy-600 dark:text-gold-400">Worst Case</p>
            <p className="metric-value text-navy-800 dark:text-forest-100">
              <span className="text-base font-normal text-navy-400 dark:text-forest-400 mr-0.5">+</span>
              {formatTolerance(results.worstCasePlus, decimals)}
            </p>
            <p className="metric-value text-navy-800 dark:text-forest-100 -mt-1">
              <span className="text-base font-normal text-navy-400 dark:text-forest-400 mr-0.5">{"\u2212"}</span>
              {formatTolerance(results.worstCaseMinus, decimals)}
            </p>
            <p className="metric-sub">{"Sum of all tolerances (" + unit + ")"}</p>
          </div>

          <div className="metric-card col-span-1">
            <p className="metric-label text-navy-600 dark:text-gold-400">{`RSS (${sigmaK}\u03c3)`}</p>
            <p className="metric-value text-navy-800 dark:text-forest-100">
              <span className="text-base font-normal text-navy-400 dark:text-forest-400 mr-0.5">+</span>
              {formatTolerance(results.rssPlus, decimals)}
            </p>
            <p className="metric-value text-navy-800 dark:text-forest-100 -mt-1">
              <span className="text-base font-normal text-navy-400 dark:text-forest-400 mr-0.5">{"\u2212"}</span>
              {formatTolerance(results.rssMinus, decimals)}
            </p>
            <p className="metric-sub">{"Root Sum Square (" + unit + ")"}</p>
          </div>

          <div className={`metric-card col-span-1 ${qStyle ? `${qStyle.bg} ${qStyle.border}` : ""}`}>
            <p className={`metric-label ${qStyle ? qStyle.text : "text-navy-600 dark:text-gold-400"}`}>DPPM</p>
            {hasTarget && results.dppm !== null ? (
              <>
                <p className={`metric-value ${qStyle ? qStyle.text : "text-navy-800 dark:text-forest-100"}`}>
                  {formatDppm(results.dppm)}
                </p>
                <p className={`text-xs mt-1 font-medium ${qStyle ? qStyle.text : ""}`}>
                  {qStyle?.label}
                </p>
              </>
            ) : (
              <p className="text-sm text-navy-400 dark:text-forest-400 mt-2">Set target to calculate</p>
            )}
            <p className="metric-sub">Defective parts per million</p>
          </div>

          <div className={`metric-card col-span-1 ${qStyle ? `${qStyle.bg} ${qStyle.border}` : ""}`}>
            <p className={`metric-label ${qStyle ? qStyle.text : "text-navy-600 dark:text-gold-400"}`}>Yield</p>
            {hasTarget && results.yieldPercent !== null ? (
              <>
                <p className={`metric-value ${qStyle ? qStyle.text : "text-navy-800 dark:text-forest-100"}`}>
                  {formatYield(results.yieldPercent)}
                  <span className="text-base">%</span>
                </p>
                {results.sigmaLevel !== null && (
                  <p className={`text-xs mt-1 font-medium ${qStyle ? qStyle.text : ""}`}>
                    {results.sigmaLevel.toFixed(2)}{"\u03c3"} process level
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-navy-400 dark:text-forest-400 mt-2">Set target to calculate</p>
            )}
            <p className="metric-sub">Expected manufacturing yield</p>
          </div>
        </div>

        {/* Comparison bar */}
        {results.worstCasePlus > 0 && (
          <ComparisonBar
            worstCase={Math.max(results.worstCasePlus, results.worstCaseMinus)}
            rss={Math.max(results.rssPlus, results.rssMinus)}
            target={hasTarget ? parseFloat(targetPlus) : null}
            unit={unit}
            decimals={decimals}
            sigmaK={sigmaK}
          />
        )}

        {/* Feedback */}
        <div className="card px-5 py-4">
          <h3 className="text-sm font-bold text-navy-600 dark:text-gold-400 uppercase tracking-wider mb-3">
            Feedback
          </h3>
          {feedbackSent ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              Thank you for your feedback!
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-navy-500 dark:text-forest-300">
                Tell us what you think about the tool and what we can improve. What else would you like to see?
              </p>
              <input
                type="email"
                value={feedbackEmail}
                onChange={(e) => setFeedbackEmail(e.target.value)}
                placeholder="Your email"
                className="w-full sm:max-w-xs rounded-md border-navy-200 dark:border-forest-600 bg-navy-50/30 dark:bg-forest-700/50
                           text-sm text-navy-700 dark:text-forest-200 placeholder:text-navy-300 dark:placeholder:text-forest-500
                           focus:border-gold-500 focus:ring-gold-500 px-3 py-1.5"
              />
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Your feedback..."
                rows={2}
                className="w-full rounded-md border-navy-200 dark:border-forest-600 bg-navy-50/30 dark:bg-forest-700/50
                           text-sm text-navy-700 dark:text-forest-200 placeholder:text-navy-300 dark:placeholder:text-forest-500
                           focus:border-gold-500 focus:ring-gold-500 px-3 py-2 resize-none"
              />
              <button
                onClick={async () => {
                  if (!feedbackText.trim()) return;
                  setFeedbackSending(true);
                  try {
                    const res = await fetch("/api/feedback", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: feedbackEmail, feedback: feedbackText }),
                    });
                    if (res.ok) setFeedbackSent(true);
                  } catch { /* ignore */ }
                  setFeedbackSending(false);
                }}
                disabled={!feedbackText.trim() || feedbackSending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold
                           bg-navy-600 dark:bg-gold-500 text-white dark:text-forest-950
                           hover:bg-navy-700 dark:hover:bg-gold-400 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {feedbackSending ? "Sending..." : "Submit"}
              </button>
            </div>
          )}
        </div>

        {/* References */}
        <ReferencesSection />

        {/* Notes */}
        <div className="text-[11px] text-navy-400 dark:text-forest-400 text-center space-y-0.5">
          <p>{`RSS assumes each feature tolerance represents a \u00b1${sigmaK}\u03c3 distribution (${sigmaCoverage(sigmaK).toFixed(sigmaK >= 4 ? 4 : 2)}% coverage).`}</p>
          <p>DPPM and yield are based on the RSS stack-up compared to the target tolerance.</p>
        </div>

        {/* Footer */}
        <footer className="text-center pb-6 pt-2">
          <div className="inline-block border-t border-navy-200 dark:border-forest-700 pt-4 px-8">
            <p className="text-sm font-serif italic tracking-wide text-navy-400 dark:text-forest-300/80">
              Made with{" "}
              <span className="not-italic text-red-500">{"\u2764\uFE0F"}</span>{" "}
              in California
            </p>
            <p className="text-xs text-navy-400/70 dark:text-forest-400/60 mt-1">
              Vibe-coded by Deepak (
              <a
                href="https://heydeepak.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gold-500 transition-colors"
              >
                heydeepak.com
              </a>
              ). 4 hours
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function FeatureRow({
  feature,
  index,
  total,
  canDelete,
  onUpdate,
  onProcessChange,
  onRemove,
  unit,
  step,
  decimals,
  nodeDescriptions,
  onDescChange,
}: {
  feature: Feature;
  index: number;
  total: number;
  canDelete: boolean;
  onUpdate: (id: string, patch: Partial<Feature>) => void;
  onProcessChange: (id: string, processId: string) => void;
  onRemove: (id: string) => void;
  unit: "mm" | "in";
  step: number;
  decimals: number;
  nodeDescriptions: string[];
  onDescChange: (nodeIdx: number, value: string) => void;
}) {
  const proc = getProcessById(feature.processId);
  const fromIdx = index;
  const toIdx = index === total - 1 ? 0 : index + 1;
  const from = LETTERS[index];
  const to = index === total - 1 ? "A\u02BC" : LETTERS[index + 1];
  const isLast = index === total - 1;

  void unit;

  const stepTol = (field: "tolPlus" | "tolMinus", dir: 1 | -1) => {
    const sy = window.scrollY;
    const current = parseFloat(feature[field]) || 0;
    const newVal = Math.max(0, +(current + dir * step).toFixed(decimals));
    onUpdate(feature.id, { [field]: newVal.toString() });
    requestAnimationFrame(() => window.scrollTo({ top: sy, behavior: "instant" }));
  };

  const tolPlusRef = useRef<HTMLInputElement>(null);
  const tolMinusRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (field: "tolPlus" | "tolMinus") => (e: WheelEvent) => {
      e.preventDefault();
      const current = parseFloat(feature[field]) || 0;
      const delta = e.deltaY < 0 ? step : -step;
      const newVal = Math.max(0, +(current + delta).toFixed(decimals));
      onUpdate(feature.id, { [field]: newVal.toString() });
    };
    const hPlus = handler("tolPlus");
    const hMinus = handler("tolMinus");
    const elPlus = tolPlusRef.current;
    const elMinus = tolMinusRef.current;
    elPlus?.addEventListener("wheel", hPlus, { passive: false });
    elMinus?.addEventListener("wheel", hMinus, { passive: false });
    return () => {
      elPlus?.removeEventListener("wheel", hPlus);
      elMinus?.removeEventListener("wheel", hMinus);
    };
  }, [feature, step, decimals, onUpdate]);

  return (
    <tr className="group hover:bg-navy-50/30 dark:hover:bg-forest-800/20 transition-colors">
      <td className="px-2 py-2.5 text-xs text-navy-400 dark:text-forest-400 font-mono text-center">
        {index + 1}
      </td>

      {/* From — inline: A: [input] */}
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 min-w-[7rem]">
          <span className="text-xs font-bold font-mono text-navy-600 dark:text-forest-200 shrink-0">
            {from}:
          </span>
          <input
            type="text"
            value={nodeDescriptions[fromIdx]}
            onChange={(e) => onDescChange(fromIdx, e.target.value)}
            placeholder={NODE_PLACEHOLDERS[fromIdx] ?? DEFAULT_NODE_PH}
            className="flex-1 min-w-0 text-xs rounded border border-navy-200 dark:border-forest-600
                       bg-transparent px-1.5 py-0.5 focus:border-gold-500 focus:ring-0 focus:outline-none
                       text-navy-600 dark:text-forest-200 placeholder:text-navy-300/60 dark:placeholder:text-forest-400/50"
            maxLength={20}
          />
        </div>
      </td>

      {/* To — inline: B: [input] */}
      <td className="px-2 py-2">
        <div className="flex items-center gap-1 min-w-[7rem]">
          <span
            className={`text-xs font-bold font-mono shrink-0 ${
              isLast
                ? "text-red-600 dark:text-red-400"
                : "text-navy-600 dark:text-forest-200"
            }`}
          >
            {to}:
          </span>
          <input
            type="text"
            value={nodeDescriptions[toIdx]}
            onChange={(e) => onDescChange(toIdx, e.target.value)}
            placeholder={NODE_PLACEHOLDERS[toIdx] ?? DEFAULT_NODE_PH}
            className="flex-1 min-w-0 text-xs rounded border border-navy-200 dark:border-forest-600
                       bg-transparent px-1.5 py-0.5 focus:border-gold-500 focus:ring-0 focus:outline-none
                       text-navy-600 dark:text-forest-200 placeholder:text-navy-300/60 dark:placeholder:text-forest-400/50"
            maxLength={20}
          />
        </div>
      </td>

      {/* Mfg Process — compact */}
      <td className="px-2 py-2">
        <select
          value={feature.processId}
          onChange={(e) => onProcessChange(feature.id, e.target.value)}
          title={proc?.description}
          className="select-field text-xs w-full max-w-[140px]"
        >
          {MANUFACTURING_PROCESSES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </td>

      {/* + Tol with stepper */}
      <td className="px-2 py-2">
        <div className="flex items-stretch">
          <input
            type="number"
            step={step}
            min="0"
            ref={tolPlusRef}
            value={feature.tolPlus}
            onChange={(e) => onUpdate(feature.id, { tolPlus: e.target.value })}
            className="tol-input flex-1 rounded-r-none"
          />
          <div className="flex flex-col border border-l-0 border-navy-200 dark:border-forest-600 rounded-r-md overflow-hidden">
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); stepTol("tolPlus", 1); }}
              className="px-1 flex-1 bg-navy-50 dark:bg-forest-700 hover:bg-navy-100 dark:hover:bg-forest-600
                         text-navy-500 dark:text-forest-300 transition-colors flex items-center justify-center"
            >
              <ChevronUpSmall />
            </button>
            <div className="h-px bg-navy-200 dark:bg-forest-600" />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); stepTol("tolPlus", -1); }}
              className="px-1 flex-1 bg-navy-50 dark:bg-forest-700 hover:bg-navy-100 dark:hover:bg-forest-600
                         text-navy-500 dark:text-forest-300 transition-colors flex items-center justify-center"
            >
              <ChevronDownSmall />
            </button>
          </div>
        </div>
      </td>

      {/* - Tol with stepper */}
      <td className="px-2 py-2">
        <div className="flex items-stretch">
          <input
            type="number"
            step={step}
            min="0"
            ref={tolMinusRef}
            value={feature.tolMinus}
            onChange={(e) => onUpdate(feature.id, { tolMinus: e.target.value })}
            className="tol-input flex-1 rounded-r-none"
          />
          <div className="flex flex-col border border-l-0 border-navy-200 dark:border-forest-600 rounded-r-md overflow-hidden">
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); stepTol("tolMinus", 1); }}
              className="px-1 flex-1 bg-navy-50 dark:bg-forest-700 hover:bg-navy-100 dark:hover:bg-forest-600
                         text-navy-500 dark:text-forest-300 transition-colors flex items-center justify-center"
            >
              <ChevronUpSmall />
            </button>
            <div className="h-px bg-navy-200 dark:bg-forest-600" />
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); stepTol("tolMinus", -1); }}
              className="px-1 flex-1 bg-navy-50 dark:bg-forest-700 hover:bg-navy-100 dark:hover:bg-forest-600
                         text-navy-500 dark:text-forest-300 transition-colors flex items-center justify-center"
            >
              <ChevronDownSmall />
            </button>
          </div>
        </div>
      </td>

      {/* Dir */}
      <td className="px-2 py-2 text-center">
        <button
          onClick={() =>
            onUpdate(feature.id, {
              direction: feature.direction === 1 ? -1 : 1,
            })
          }
          title={
            feature.direction === 1
              ? "Adding to stack-up"
              : "Subtracting from stack-up"
          }
          className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold transition-colors ${
            feature.direction === 1
              ? "bg-navy-100 dark:bg-forest-800/40 text-navy-700 dark:text-forest-300 hover:bg-navy-200 dark:hover:bg-forest-700/50"
              : "bg-gold-100 dark:bg-gold-900/30 text-gold-700 dark:text-gold-300 hover:bg-gold-200 dark:hover:bg-gold-800/40"
          }`}
        >
          {feature.direction === 1 ? "+" : "\u2212"}
        </button>
      </td>

      {/* Delete */}
      <td className="px-2 py-2">
        <button
          onClick={() => onRemove(feature.id)}
          disabled={!canDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded
                     text-navy-300 dark:text-forest-500 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-0"
          title="Remove feature"
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: StackupRecommendation;
}) {
  const iconColor =
    recommendation.method === "either"
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800"
      : recommendation.method === "rss"
        ? "text-navy-600 dark:text-gold-400 bg-gold-50 dark:bg-gold-900/20 border-gold-300 dark:border-gold-700"
        : "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800";

  const methodLabel =
    recommendation.method === "either"
      ? "Either Method"
      : recommendation.method === "rss"
        ? "Use RSS"
        : "Use Worst Case";

  return (
    <div className="card px-5 py-4 flex gap-4 items-start">
      <div
        className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg border flex items-center justify-center ${iconColor}`}
      >
        {recommendation.method === "either" ? (
          <CheckIcon />
        ) : recommendation.method === "rss" ? (
          <ChartIcon />
        ) : (
          <ShieldIcon />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-navy-600 dark:text-gold-400 uppercase tracking-wider mb-0.5">
          Recommendation:{" "}
          <span className="normal-case">{methodLabel}</span>
        </p>
        <p className="text-sm text-navy-700 dark:text-forest-200 leading-snug">
          {recommendation.summary}
        </p>
        <p className="text-xs text-navy-400 dark:text-forest-400 mt-1 leading-relaxed">
          {recommendation.detail}
        </p>
      </div>
    </div>
  );
}

function ComparisonBar({
  worstCase,
  rss,
  target,
  unit,
  decimals,
  sigmaK,
}: {
  worstCase: number;
  rss: number;
  target: number | null;
  unit: "mm" | "in";
  decimals: number;
  sigmaK: number;
}) {
  const maxVal = target
    ? Math.max(worstCase, rss, target)
    : Math.max(worstCase, rss);
  const wcPct = (worstCase / maxVal) * 100;
  const rssPct = (rss / maxVal) * 100;
  const targetPct = target ? (target / maxVal) * 100 : null;
  const reduction =
    worstCase > 0 ? ((1 - rss / worstCase) * 100).toFixed(0) : "0";

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-navy-600 dark:text-gold-400 uppercase tracking-wider">
          Worst Case vs RSS Comparison
        </p>
        <p className="text-xs text-navy-500 dark:text-forest-300">
          RSS is{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {reduction}%
          </span>{" "}
          tighter than worst case
        </p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-navy-500 dark:text-forest-300/70 w-20 text-right">
            Worst Case
          </span>
          <div className="flex-1 h-6 bg-navy-100 dark:bg-forest-700 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-navy-300 dark:bg-forest-500 rounded-full transition-all duration-500"
              style={{ width: `${wcPct}%` }}
            />
            {targetPct !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                style={{ left: `${targetPct}%` }}
              />
            )}
          </div>
          <span className="text-xs font-mono text-navy-600 dark:text-forest-300/70 w-16 text-right">
            {formatTolerance(worstCase, decimals)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-navy-500 dark:text-forest-300/70 w-20 text-right">
            {`RSS (${sigmaK}\u03c3)`}
          </span>
          <div className="flex-1 h-6 bg-navy-100 dark:bg-forest-700 rounded-full overflow-hidden relative">
            <div
              className="h-full bg-navy-400 dark:bg-gold-500 rounded-full transition-all duration-500"
              style={{ width: `${rssPct}%` }}
            />
            {targetPct !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                style={{ left: `${targetPct}%` }}
              />
            )}
          </div>
          <span className="text-xs font-mono text-navy-600 dark:text-gold-400 w-16 text-right">
            {formatTolerance(rss, decimals)}
          </span>
        </div>
        {target !== null && (
          <div className="flex items-center gap-3">
            <span className="w-20" />
            <div className="flex-1 flex items-center gap-1.5 pl-1">
              <div className="w-3 h-0.5 bg-red-400 rounded" />
              <span className="text-[10px] text-red-400 font-medium">
                Target: {formatTolerance(target, decimals)} {unit}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Icons                                                              */
/* ================================================================== */

function SunIcon() {
  return (
    <svg className="w-4 h-4 text-gold-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="w-4 h-4 text-navy-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

function TableIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0 1 12 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M11.25 12h.008v.008h-.008V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM12 13.5v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 13.5c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m0 0v1.5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function ChevronUpSmall() {
  return (
    <svg className="w-3 h-2" viewBox="0 0 12 8" fill="currentColor">
      <path d="M6 2L10 6H2L6 2Z" />
    </svg>
  );
}

function ChevronDownSmall() {
  return (
    <svg className="w-3 h-2" viewBox="0 0 12 8" fill="currentColor">
      <path d="M6 6L2 2H10L6 6Z" />
    </svg>
  );
}
