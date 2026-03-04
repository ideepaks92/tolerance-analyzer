import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export interface ExportData {
  title: string;
  user: string;
  unit: "mm" | "in";
  features: {
    from: string;
    to: string;
    process: string;
    tolPlus: number;
    tolMinus: number;
    direction: 1 | -1;
  }[];
  results: {
    worstCasePlus: number;
    worstCaseMinus: number;
    rssPlus: number;
    rssMinus: number;
    dppm: number | null;
    yieldPercent: number | null;
    sigmaLevel: number | null;
  };
  recommendation: string;
  recommendationMethod: string;
  targetPlus: number | null;
  targetMinus: number | null;
  sigmaK: number;
  mcStats: {
    mean: number;
    stdDev: number;
    min: number;
    max: number;
    median: number;
    dppm: number | null;
    yieldPct: number | null;
    iterations: number;
  } | null;
}

/* ------------------------------------------------------------------ */
/*  Color palette (matches light mode)                                 */
/* ------------------------------------------------------------------ */
const C = {
  navy: [28, 40, 64] as const,
  navyMid: [40, 55, 86] as const,
  navyLight: [244, 245, 250] as const,
  altRow: [234, 237, 245] as const,
  gold: [201, 162, 39] as const,
  goldLight: [253, 248, 235] as const,
  goldDark: [160, 126, 30] as const,
  white: [255, 255, 255] as const,
  green: [5, 150, 105] as const,
  red: [220, 38, 38] as const,
};

export function exportToPDF(data: ExportData) {
  const doc = new jsPDF();
  const u = data.unit || "mm";
  const dec = u === "mm" ? 3 : 4;
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pw - margin * 2;

  let y = 0;

  const drawFooter = () => {
    doc.setFillColor(...C.navy);
    doc.rect(0, ph - 10, pw, 10, "F");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(...C.gold);
    doc.text(
      "Made with love in California  -  Vibe-coded by Deepak (heydeepak.com)",
      pw / 2,
      ph - 4,
      { align: "center" }
    );
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > ph - 16) {
      drawFooter();
      doc.addPage();
      y = 14;
    }
  };

  const sectionHeader = (label: string) => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navyMid);
    doc.text(label, margin, y);
    y += 2;
    doc.setDrawColor(...C.gold);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + contentW, y);
    y += 5;
  };

  /* ================================================================ */
  /*  HEADER                                                           */
  /* ================================================================ */
  doc.setFillColor(...C.navy);
  doc.rect(0, 0, pw, 30, "F");
  doc.setFillColor(...C.gold);
  doc.rect(0, 30, pw, 1.2, "F");

  y = 12;
  if (data.title) {
    doc.setFont("times", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...C.white);
    const titleLines = doc.splitTextToSize(data.title, contentW);
    doc.text(titleLines, margin, y);
    y += titleLines.length * 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gold);
    doc.text(
      `Tolerance Analysis  |  ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      margin,
      y
    );
  } else {
    doc.setFont("times", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...C.white);
    doc.text("Tolerance Analysis", margin, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.gold);
    doc.text(
      new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      margin,
      y
    );
  }

  if (data.user) {
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(200, 210, 230);
    doc.text(`Prepared by: ${data.user}`, margin, y);
  }

  y = 38;

  /* ================================================================ */
  /*  STACK-UP TARGET                                                   */
  /* ================================================================ */
  if (data.targetPlus !== null) {
    sectionHeader("STACK-UP TARGET");
    doc.setFillColor(...C.goldLight);
    doc.setDrawColor(...C.gold);
    doc.roundedRect(margin, y - 2, contentW, 11, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...C.navy);
    doc.text("Target Tolerance:", margin + 4, y + 5);
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    const targetStr = `+${data.targetPlus.toFixed(dec)}  /  -${(data.targetMinus ?? data.targetPlus).toFixed(dec)}  ${u}`;
    doc.text(targetStr, margin + 48, y + 5);
    y += 16;
  }

  /* ================================================================ */
  /*  FEATURES TABLE                                                    */
  /* ================================================================ */
  sectionHeader("FEATURES");

  autoTable(doc, {
    head: [
      [
        "#",
        "From",
        "To",
        "Mfg Process",
        `+ Tol (${u})`,
        `- Tol (${u})`,
        "Dir",
      ],
    ],
    body: data.features.map((f, i) => [
      (i + 1).toString(),
      f.from,
      f.to,
      f.process,
      f.tolPlus.toFixed(dec),
      f.tolMinus.toFixed(dec),
      f.direction === 1 ? "+" : "-",
    ]),
    startY: y,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      font: "helvetica",
      textColor: [...C.navy],
      lineWidth: 0.2,
      lineColor: [200, 205, 220],
    },
    headStyles: {
      fillColor: [...C.navyMid],
      textColor: [...C.white],
      fontStyle: "bold",
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [...C.altRow],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 36 },
      4: { cellWidth: 22, halign: "right", font: "courier" },
      5: { cellWidth: 22, halign: "right", font: "courier" },
      6: { cellWidth: 10, halign: "center" },
    },
  });

  y =
    ((doc as unknown as Record<string, { finalY: number }>).lastAutoTable
      ?.finalY ?? y) + 10;

  /* ================================================================ */
  /*  RESULTS — 4 metric cards                                         */
  /* ================================================================ */
  sectionHeader("RESULTS");
  ensureSpace(40);

  const cardW = (contentW - 6) / 4;
  const cardH = 28;
  const cardY = y;

  const drawCard = (
    col: number,
    label: string,
    lines: string[],
    sub: string,
    accent?: readonly [number, number, number]
  ) => {
    const cx = margin + col * (cardW + 2);
    doc.setFillColor(...C.navyLight);
    doc.setDrawColor(200, 205, 220);
    doc.roundedRect(cx, cardY, cardW, cardH, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...(accent || C.navyMid));
    doc.text(label.toUpperCase(), cx + 3, cardY + 5);

    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.navy);
    lines.forEach((line, li) => {
      doc.text(line, cx + 3, cardY + 12 + li * 5);
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(120, 130, 150);
    doc.text(sub, cx + 3, cardY + cardH - 3);
  };

  drawCard(
    0,
    "Worst Case",
    [
      `+${data.results.worstCasePlus.toFixed(dec)}`,
      `-${data.results.worstCaseMinus.toFixed(dec)}`,
    ],
    `Sum of tolerances (${u})`
  );

  const sk = data.sigmaK || 3;

  drawCard(
    1,
    `RSS (${sk}s)`,
    [
      `+${data.results.rssPlus.toFixed(dec)}`,
      `-${data.results.rssMinus.toFixed(dec)}`,
    ],
    `Root Sum Square (${u})`
  );

  if (data.results.dppm !== null) {
    const dppmStr = data.results.dppm.toLocaleString();
    const dppmQual =
      data.results.dppm <= 3400
        ? "Excellent"
        : data.results.dppm <= 10000
          ? "Good"
          : data.results.dppm <= 66800
            ? "Marginal"
            : "Poor";
    drawCard(2, "DPPM", [dppmStr, dppmQual], "Defective parts/million");

    const yldStr = `${data.results.yieldPercent!.toFixed(4)}%`;
    const sigStr = data.results.sigmaLevel
      ? `${data.results.sigmaLevel.toFixed(2)}s`
      : "";
    drawCard(3, "Yield", [yldStr, sigStr], "Manufacturing yield");
  } else {
    drawCard(2, "DPPM", ["\u2014"], "Set target to calculate");
    drawCard(3, "Yield", ["\u2014"], "Set target to calculate");
  }

  y = cardY + cardH + 10;

  /* ================================================================ */
  /*  COMPARISON BAR                                                    */
  /* ================================================================ */
  const wcMax = Math.max(data.results.worstCasePlus, data.results.worstCaseMinus);
  const rssMax = Math.max(data.results.rssPlus, data.results.rssMinus);

  if (wcMax > 0) {
    sectionHeader("WORST CASE VS RSS COMPARISON");
    ensureSpace(28);

    const barLeft = margin + 28;
    const barW = contentW - 56;
    const maxVal =
      data.targetPlus !== null
        ? Math.max(wcMax, rssMax, data.targetPlus)
        : Math.max(wcMax, rssMax);

    const drawBar = (
      label: string,
      value: number,
      barY: number,
      color: readonly [number, number, number]
    ) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C.navyMid);
      doc.text(label, barLeft - 2, barY + 4, { align: "right" });

      doc.setFillColor(...C.navyLight);
      doc.roundedRect(barLeft, barY, barW, 6, 1, 1, "F");

      const pct = (value / maxVal) * barW;
      doc.setFillColor(...color);
      doc.roundedRect(barLeft, barY, Math.max(pct, 2), 6, 1, 1, "F");

      if (data.targetPlus !== null) {
        const tPct = (data.targetPlus / maxVal) * barW;
        doc.setDrawColor(220, 38, 38);
        doc.setLineWidth(0.5);
        doc.line(barLeft + tPct, barY - 1, barLeft + tPct, barY + 7);
      }

      doc.setFont("courier", "normal");
      doc.setFontSize(7);
      doc.text(value.toFixed(dec), barLeft + barW + 2, barY + 4);
    };

    drawBar("Worst Case", wcMax, y, [154, 165, 192]);
    y += 10;
    drawBar(`RSS (${sk}s)`, rssMax, y, C.gold);
    y += 10;

    if (data.targetPlus !== null) {
      doc.setFillColor(...C.red);
      doc.rect(barLeft, y, 6, 1.5, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...C.red);
      doc.text(
        `Target: ${data.targetPlus.toFixed(dec)} ${u}`,
        barLeft + 8,
        y + 1.2
      );
      y += 4;
    }

    const reduction =
      wcMax > 0 ? ((1 - rssMax / wcMax) * 100).toFixed(0) : "0";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 110, 130);
    doc.text(
      `RSS is ${reduction}% tighter than worst case`,
      barLeft,
      y + 2
    );
    y += 10;
  }

  /* ================================================================ */
  /*  RECOMMENDATION                                                    */
  /* ================================================================ */
  sectionHeader("RECOMMENDATION");
  ensureSpace(24);

  const recBodyText = doc.splitTextToSize(data.recommendation, contentW - 12);
  const recH = recBodyText.length * 3.8 + 14;
  ensureSpace(recH + 4);

  doc.setFillColor(...C.goldLight);
  doc.setDrawColor(...C.gold);
  doc.roundedRect(margin, y - 2, contentW, recH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.goldDark);
  doc.text(data.recommendationMethod.toUpperCase(), margin + 4, y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.navy);
  doc.text(recBodyText, margin + 4, y + 10);

  y += recH + 8;

  /* ================================================================ */
  /*  MONTE CARLO (if available)                                        */
  /* ================================================================ */
  if (data.mcStats) {
    sectionHeader("MONTE CARLO SIMULATION");
    ensureSpace(30);

    const mc = data.mcStats;
    const mcCardW = (contentW - 4) / 3;
    const mcCardH = 16;
    const mcY = y;

    const drawMcStat = (col: number, label: string, value: string) => {
      const cx = margin + col * (mcCardW + 2);
      doc.setFillColor(...C.navyLight);
      doc.setDrawColor(200, 205, 220);
      doc.roundedRect(cx, mcY, mcCardW, mcCardH, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(...C.navyMid);
      doc.text(label, cx + 3, mcY + 5);
      doc.setFont("courier", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...C.navy);
      doc.text(value, cx + 3, mcY + 12);
    };

    drawMcStat(0, "MEAN / STD DEV", `${mc.mean.toFixed(dec)} / ${mc.stdDev.toFixed(dec)} ${u}`);
    drawMcStat(1, "MC DPPM", mc.dppm !== null ? mc.dppm.toLocaleString() : "-");
    drawMcStat(2, "MC YIELD", mc.yieldPct !== null ? `${mc.yieldPct.toFixed(4)}%` : "-");

    y = mcY + mcCardH + 4;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(140, 150, 165);
    doc.text(
      `Based on ${mc.iterations.toLocaleString()} random assemblies. Range: [${mc.min.toFixed(dec)}, ${mc.max.toFixed(dec)}] ${u}`,
      margin,
      y
    );
    y += 8;
  }

  /* ================================================================ */
  /*  NOTES                                                             */
  /* ================================================================ */
  ensureSpace(14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(140, 150, 165);
  doc.text(
    `RSS assumes each feature tolerance represents a +/-${sk} sigma distribution.`,
    margin,
    y
  );
  y += 3.5;
  doc.text(
    "DPPM and yield are based on the RSS stack-up compared to the target tolerance.",
    margin,
    y
  );

  /* ================================================================ */
  /*  FOOTER                                                            */
  /* ================================================================ */
  drawFooter();

  const filename = (data.title || "Tolerance_Analysis")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, "_");
  doc.save(`${filename}.pdf`);
}

/* ================================================================== */
/*  XLSX Export                                                         */
/* ================================================================== */

export function exportToXLSX(data: ExportData) {
  const pageTitle = data.title || "Tolerance Stack-Up Analysis";
  const u = data.unit || "mm";
  const dec = u === "mm" ? 3 : 4;

  const rows: (string | number | null)[][] = [
    [pageTitle],
    [`Generated ${new Date().toLocaleDateString()}`],
  ];
  if (data.user) rows.push([`Prepared by: ${data.user}`]);
  rows.push([]);

  if (data.targetPlus !== null) {
    rows.push([
      `Target: +${data.targetPlus.toFixed(dec)} / -${(data.targetMinus ?? data.targetPlus).toFixed(dec)} ${u}`,
    ]);
    rows.push([]);
  }

  rows.push([
    "#",
    "From",
    "To",
    "Mfg Process",
    `+ Tol (${u})`,
    `- Tol (${u})`,
    "Direction",
  ]);
  data.features.forEach((f, i) => {
    rows.push([
      i + 1,
      f.from,
      f.to,
      f.process,
      +f.tolPlus.toFixed(dec),
      +f.tolMinus.toFixed(dec),
      f.direction === 1 ? "+" : "-",
    ]);
  });

  rows.push([]);
  rows.push(["Results"]);
  rows.push(["Worst Case +", +data.results.worstCasePlus.toFixed(dec)]);
  rows.push(["Worst Case -", +data.results.worstCaseMinus.toFixed(dec)]);
  rows.push(["RSS (3s) +", +data.results.rssPlus.toFixed(dec)]);
  rows.push(["RSS (3s) -", +data.results.rssMinus.toFixed(dec)]);
  if (data.results.dppm !== null) {
    rows.push(["DPPM", data.results.dppm]);
    rows.push(["Yield %", data.results.yieldPercent]);
    if (data.results.sigmaLevel !== null)
      rows.push(["Process Sigma", data.results.sigmaLevel]);
  }
  rows.push([]);
  rows.push(["Recommendation"]);
  rows.push([data.recommendation]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 14 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Tolerance Analysis");

  const filename = pageTitle
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, "_");
  XLSX.writeFile(wb, `${filename || "tolerance_analysis"}.xlsx`);
}
