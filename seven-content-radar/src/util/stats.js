// Deterministic statistics helpers. No LLM involvement anywhere here.

export function median(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
}

export function mean(values) {
  const xs = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Median absolute deviation, scaled to be comparable to a standard deviation.
export function mad(values) {
  const m = median(values);
  if (m === null) return null;
  const dev = values.filter((v) => Number.isFinite(v)).map((v) => Math.abs(v - m));
  const md = median(dev);
  return md === null ? null : md * 1.4826;
}

// Robust z-score: (x - median) / MAD. Returns null when undefined.
export function robustZ(x, values) {
  const m = median(values);
  const s = mad(values);
  if (m === null || s === null || s === 0) return null;
  return (x - m) / s;
}

// Percentile rank of x within values (0..100). Empirical CDF with mid-rank for ties.
export function percentileRank(x, values) {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length === 0 || !Number.isFinite(x)) return null;
  let below = 0;
  let equal = 0;
  for (const v of xs) {
    if (v < x) below += 1;
    else if (v === x) equal += 1;
  }
  return ((below + equal / 2) / xs.length) * 100;
}

// Value at percentile p (0..100), linear interpolation.
export function percentile(values, p) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const idx = (p / 100) * (xs.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return xs[lo];
  return xs[lo] + (xs[hi] - xs[lo]) * (idx - lo);
}

export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export function round(x, digits = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return null;
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

// Piecewise-linear interpolation through sorted [x, y] anchor points.
export function piecewise(x, anchors) {
  if (!Number.isFinite(x)) return null;
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i += 1) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return anchors[anchors.length - 1][1];
}
