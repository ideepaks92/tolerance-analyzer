/* Monte Carlo tolerance stack-up simulation worker */
/* Receives: { features, iterations, sigmaK, targetPlus, targetMinus,
               historicalData?, dataMode?, supplement? }              */
/* Posts:    { stats, histogram }                                     */

"use strict";

function boxMuller() {
  let u1, u2;
  do { u1 = Math.random(); } while (u1 === 0);
  u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function randomSample(precomputed) {
  let stackup = 0;
  for (let j = 0; j < precomputed.length; j++) {
    const p = precomputed[j];
    let sample;
    if (p.dist === "uniform") {
      sample = (Math.random() - 0.5) * 2 * p.halfRange;
    } else {
      sample = p.mean + p.sigma * boxMuller();
    }
    stackup += p.dir * sample;
  }
  return stackup;
}

self.onmessage = function (e) {
  const {
    features, iterations, sigmaK, targetPlus, targetMinus,
    historicalData, dataMode, supplement,
  } = e.data;

  const nFeatures = features.length;
  const useHistorical = Array.isArray(historicalData) && historicalData.length > 0 && dataMode;
  const totalIterations = iterations || 1000000;

  const precomputed = features.map((f) => {
    const tp = Math.abs(f.tolPlus);
    const tm = Math.abs(f.tolMinus);
    const sigma = (tp + tm) / (2 * sigmaK);
    const mean = (tp - tm) / 2;
    const halfRange = (tp + tm) / 2;
    return {
      sigma,
      mean,
      halfRange,
      dir: f.direction,
      dist: f.distribution || "normal",
    };
  });

  let N, results;

  if (useHistorical) {
    const histN = historicalData.length;
    const doSupplement = supplement && histN < totalIterations;
    N = doSupplement ? totalIterations : histN;
    results = new Float64Array(N);

    for (let i = 0; i < histN; i++) {
      let stackup = 0;
      const row = historicalData[i];
      for (let j = 0; j < nFeatures; j++) {
        const f = features[j];
        const rawVal = (j < row.length && !isNaN(row[j])) ? row[j] : 0;
        let deviation;
        if (dataMode === "nominal") {
          deviation = rawVal - (f.nominal || 0);
        } else {
          deviation = rawVal;
        }
        stackup += f.direction * deviation;
      }
      results[i] = stackup;
    }

    if (doSupplement) {
      for (let i = histN; i < N; i++) {
        results[i] = randomSample(precomputed);
      }
    }
  } else {
    N = totalIterations;
    results = new Float64Array(N);

    for (let i = 0; i < N; i++) {
      results[i] = randomSample(precomputed);
    }
  }

  let sum = 0;
  let sumSq = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < N; i++) {
    const v = results[i];
    sum += v;
    sumSq += v * v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const mean = sum / N;
  const variance = sumSq / N - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));

  const sorted = results.slice().sort();

  function percentile(p) {
    const idx = Math.min(Math.floor(p * N), N - 1);
    return sorted[idx];
  }

  const p0135 = percentile(0.00135);
  const p50 = percentile(0.5);
  const p99865 = percentile(0.99865);

  let defects = 0;
  const hasTarget = targetPlus !== null && targetPlus !== undefined &&
                    targetMinus !== null && targetMinus !== undefined;
  if (hasTarget) {
    for (let i = 0; i < N; i++) {
      if (results[i] > targetPlus || results[i] < -targetMinus) {
        defects++;
      }
    }
  }

  const dppm = hasTarget ? Math.round((defects / N) * 1000000) : null;
  const yieldPct = hasTarget ? ((1 - defects / N) * 100) : null;

  const NUM_BINS = 120;
  const range = max - min;
  const binMin = min - range * 0.02;
  const binMax = max + range * 0.02;
  const binWidth = (binMax - binMin) / NUM_BINS;
  const bins = new Array(NUM_BINS).fill(0);
  const binCenters = new Array(NUM_BINS);

  for (let i = 0; i < NUM_BINS; i++) {
    binCenters[i] = binMin + (i + 0.5) * binWidth;
  }

  for (let i = 0; i < N; i++) {
    const idx = Math.min(Math.floor((results[i] - binMin) / binWidth), NUM_BINS - 1);
    if (idx >= 0) bins[idx]++;
  }

  self.postMessage({
    stats: {
      mean,
      stdDev,
      min,
      max,
      median: p50,
      p0135,
      p99865,
      dppm,
      yieldPct,
      iterations: N,
    },
    histogram: { bins, binCenters, binWidth, binMin, binMax },
  });
};
