// All KPI formulas of Seven Content Radar. Deterministic, unit-tested, no LLM.
import { config } from '../config.js';
import { median, mean, percentileRank, piecewise, clamp, round, robustZ, percentile } from '../util/stats.js';

const T = config.thresholds;

// §11 — Commentaires / 1 000 vues. null when views is 0/unknown.
export function commentDensity(commentsCount, views) {
  if (!Number.isFinite(views) || views <= 0 || !Number.isFinite(commentsCount)) return null;
  return (commentsCount / views) * 1000;
}

// §12 — creator baseline = median density of the last N exploitable reels.
// `reels` are the creator's reels (any order) with published_at, views, comments_count.
export function creatorBaseline(reels, { excludeReelId = null, window = T.baselineWindow, minReels = T.baselineMinReels } = {}) {
  const exploitable = reels
    .filter((r) => r.id !== excludeReelId)
    .map((r) => ({ ...r, density: commentDensity(r.comments_count, r.views) }))
    .filter((r) => r.density !== null)
    .sort((a, b) => new Date(b.published_at || b.first_seen) - new Date(a.published_at || a.first_seen))
    .slice(0, window);
  const densities = exploitable.map((r) => r.density);
  return {
    median: median(densities),
    count: densities.length,
    reliable: densities.length >= minReels,
    densities,
  };
}

// §12 — Lift = current density / creator median density
export function lift(density, baselineMedian) {
  if (density === null || !Number.isFinite(baselineMedian) || baselineMedian <= 0) return null;
  return density / baselineMedian;
}

// §13 — pre-filter before comment scraping. Returns {selected, reasons}.
// The volume rule (≥ 30 comments) only applies to fresh reels: it exists to
// catch a conversation early, not to re-analyse a creator's whole back
// catalogue on the first run (cost control, §46).
export function prefilter({ commentsCount, density, baseline, panelDensities = [], creatorDensities = [], ageHours = 0 }) {
  const reasons = [];
  if (Number.isFinite(commentsCount) && commentsCount >= T.prefilterMinComments && ageHours <= T.prefilterMinCommentsMaxAgeHours) reasons.push('min_comments');
  const l = baseline && baseline.reliable ? lift(density, baseline.median) : null;
  if (l !== null && l >= T.prefilterLiftMin) reasons.push('lift');
  if (density !== null && panelDensities.length >= 10 && ageHours <= T.prefilterMinCommentsMaxAgeHours) {
    const cut = percentile(panelDensities, (1 - T.prefilterTopPanelShare) * 100);
    if (cut !== null && density >= cut) reasons.push('top_panel');
  }
  if (density !== null && creatorDensities.length >= 5) {
    const z = robustZ(density, creatorDensities);
    if (z !== null && z >= T.prefilterAnomalyZ) reasons.push('anomaly');
  }
  return { selected: reasons.length > 0, reasons, lift: l };
}

export function isQualified(c) {
  return c.quality_score >= T.qualifiedMinScore && c.is_artificial_engagement === false;
}

// §18 — CCR (Conversation Conversion Rate), always flagged when estimated.
// audienceComments: total organic (non-creator) comments on the reel — we use
// comments_count minus creator replies seen in the sample ratio.
export function ccr({ views, audienceComments, organicAnalyzed, qualifiedInSample }) {
  if (!Number.isFinite(views) || views <= 0 || !organicAnalyzed) {
    return { ccr: null, estimated: true, qualified_ratio: null, estimated_qualified: null };
  }
  const ratio = qualifiedInSample / organicAnalyzed;
  const sampled = organicAnalyzed < audienceComments;
  const estQualified = sampled ? audienceComments * ratio : qualifiedInSample;
  return {
    ccr: (estQualified / views) * 1000,
    estimated: sampled,
    qualified_ratio: ratio,
    estimated_qualified: estQualified,
  };
}

// §19 — Quality Score = mean(quality_score)/10×100 over organic audience comments.
export function qualityScore(classified) {
  const usable = classified.filter((c) => !c.is_creator && !c.is_duplicate && c.is_artificial_engagement === false && Number.isFinite(c.quality_score));
  const m = mean(usable.map((c) => c.quality_score));
  return m === null ? null : (m / 10) * 100;
}

// §20 — Thread Depth Score 0–100. Creator-only replies count at a reduced weight
// so a creator answering everyone does not inflate the score.
export function threadDepthScore(comments, { creatorUsername } = {}) {
  const creator = String(creatorUsername || '').toLowerCase();
  const top = comments.filter((c) => !c.is_creator && !c.parent_comment_id);
  if (top.length === 0) return { score: 0, pct_with_replies: 0, avg_replies: 0, multi_participant_threads: 0 };
  let withReplies = 0;
  let totalReplies = 0;
  let multi = 0;
  for (const c of top) {
    const replies = Array.isArray(c.replies) ? c.replies : [];
    const audienceReplies = replies.filter((r) => String(r.username || '').toLowerCase() !== creator);
    const creatorReplies = replies.length - audienceReplies.length;
    let effective;
    if (replies.length > 0) effective = audienceReplies.length + creatorReplies * 0.5;
    else effective = Number.isFinite(c.reply_count) ? c.reply_count * 0.75 : 0; // unknown authorship → discounted
    if (effective > 0) withReplies += 1;
    totalReplies += effective;
    const participants = new Set(audienceReplies.map((r) => String(r.username || '').toLowerCase()).filter(Boolean));
    if (participants.size >= 1 && (participants.size >= 2 || (participants.size === 1 && !participants.has(String(c.username || '').toLowerCase())))) multi += 1;
  }
  const pct = withReplies / top.length;
  const avg = totalReplies / top.length;
  const multiShare = multi / top.length;
  const score = 50 * clamp(pct / 0.3, 0, 1) + 30 * clamp(avg / 1.5, 0, 1) + 20 * clamp(multiShare / 0.1, 0, 1);
  return { score: round(score, 1), pct_with_replies: round(pct * 100, 1), avg_replies: round(avg, 2), multi_participant_threads: multi };
}

// Category groups displayed in "POURQUOI LES GENS COMMENTENT"
export const CATEGORY_GROUPS = {
  projection_personnelle: ['PROJECTION_PERSONNELLE', 'INTENTION_ACTION'],
  questions_concretes: ['QUESTION_CONCRETE'],
  debat_argumente: ['OBJECTION_ARGUMENTEE', 'CONTRIBUTION_ARGUMENTEE', 'ACCORD_ARGUMENTE', 'REFLEXION_REFORMULATION'],
  temoignages: ['TEMOIGNAGE'],
  faible_valeur: ['DESACCORD_SIMPLE', 'ACCORD_SIMPLE', 'COMPLIMENT', 'TAG', 'EMOJI', 'CTA_ARTIFICIEL', 'SPAM', 'AUTRE'],
};

export function categoryDistribution(classified) {
  const usable = classified.filter((c) => !c.is_creator && c.category);
  const total = usable.length;
  const byCat = {};
  for (const c of usable) byCat[c.category] = (byCat[c.category] || 0) + 1;
  const groups = {};
  for (const [g, cats] of Object.entries(CATEGORY_GROUPS)) {
    const n = cats.reduce((s, k) => s + (byCat[k] || 0), 0);
    groups[g] = total ? round((n / total) * 100, 0) : 0;
  }
  return { total, by_category: byCat, groups };
}

// §21 — normalisation. Cold start: robust piecewise anchors. After
// calibrationMinReels analysed reels: empirical percentile rank of the panel.
const CCR_ANCHORS = [[0, 0], [0.5, 20], [1, 35], [2, 55], [4, 75], [6, 88], [10, 100]];
const LIFT_ANCHORS = [[0, 0], [0.5, 5], [1, 25], [1.5, 45], [2, 60], [3, 78], [5, 92], [8, 100]];

export function normalizeCcr(value, panelCcrs = []) {
  if (value === null || value === undefined) return { value: null, method: 'none' };
  if (panelCcrs.length >= T.calibrationMinReels) return { value: percentileRank(value, panelCcrs), method: 'panel_percentile' };
  return { value: piecewise(value, CCR_ANCHORS), method: 'cold_start' };
}

export function normalizeLift(value, panelLifts = []) {
  if (value === null || value === undefined) return { value: null, method: 'none' };
  if (panelLifts.length >= T.calibrationMinReels) return { value: percentileRank(value, panelLifts), method: 'panel_percentile' };
  return { value: piecewise(value, LIFT_ANCHORS), method: 'cold_start' };
}

// §21 — Seven Conversation Score /100. Missing components are re-weighted so
// a reel without baseline (new creator) is still scorable, and flagged.
export function conversationScore({ quality, ccrValue, liftValue, depth, panel = { ccrs: [], lifts: [] } }) {
  const W = config.weights;
  const nCcr = normalizeCcr(ccrValue, panel.ccrs);
  const nLift = normalizeLift(liftValue, panel.lifts);
  const parts = [
    ['quality', quality, W.quality],
    ['ccr', nCcr.value, W.ccr],
    ['lift', nLift.value, W.lift],
    ['depth', depth, W.depth],
  ];
  let sum = 0;
  let wsum = 0;
  const missing = [];
  for (const [name, v, w] of parts) {
    if (v === null || v === undefined || !Number.isFinite(v)) { missing.push(name); continue; }
    sum += clamp(v, 0, 100) * w;
    wsum += w;
  }
  if (wsum === 0 || quality === null) return { score: null, components: {}, missing, calibration: nCcr.method };
  return {
    score: round(sum / wsum, 0),
    components: { quality: round(quality, 1), ccr_norm: round(nCcr.value, 1), lift_norm: round(nLift.value, 1), depth: round(depth, 1) },
    missing,
    calibration: nCcr.method,
  };
}

// §22 — Adaptability Score /100. The model returns sub-scores + risk flags;
// the arithmetic (and the penalties) live here.
export const ADAPTABILITY_MAX = { hook_reproducible: 25, mechanism_identifiable: 25, theme_compatibility: 20, reproduction_ease: 20, low_risk: 10 };
const PENALTY_FLAGS = { celebrity_dependent: 15, scandal_dependent: 20, exceptional_news: 15, giveaway: 25, incompatible_polemic: 25 };

export function adaptabilityScore(sub = {}, flags = {}) {
  let total = 0;
  const detail = {};
  for (const [k, max] of Object.entries(ADAPTABILITY_MAX)) {
    const v = clamp(Number(sub[k]) || 0, 0, max);
    detail[k] = v;
    total += v;
  }
  let penalty = 0;
  const applied = [];
  for (const [k, p] of Object.entries(PENALTY_FLAGS)) {
    if (flags[k]) { penalty += p; applied.push(k); }
  }
  return { score: Math.round(clamp(total - penalty, 0, 100)), detail, penalty, penalties_applied: applied };
}

// §29 — enough data to trust a score for an immediate alert
export function sufficientData({ organicAnalyzed, views }) {
  return organicAnalyzed >= T.immediateAlertMinOrganicComments && views >= T.immediateAlertMinViews;
}

// §10 — snapshot deltas
export function snapshotDeltas(prev, cur) {
  if (!prev) return { delta_views: null, delta_comments: null, comments_velocity: null };
  const hours = (new Date(cur.timestamp) - new Date(prev.timestamp)) / 3_600_000;
  const dv = Number.isFinite(cur.views) && Number.isFinite(prev.views) ? cur.views - prev.views : null;
  const dc = Number.isFinite(cur.comments_count) && Number.isFinite(prev.comments_count) ? cur.comments_count - prev.comments_count : null;
  return { delta_views: dv, delta_comments: dc, comments_velocity: dc !== null && hours > 0 ? round(dc / hours, 2) : null };
}
