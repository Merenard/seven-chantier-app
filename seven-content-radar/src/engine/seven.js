// Seven proprietary learning loop (§32–§38): success rate, predictive score,
// Hook DNA Seven, structure × audience matrix. Deterministic aggregation over
// stored analyses.
import { config } from '../config.js';
import { median, mean, round, clamp } from '../util/stats.js';

const T = config.thresholds;

export const HOOK_FAMILIES = [
  'QUESTION_PERSONNELLE', 'CHIFFRE_CONTRE_INTUITIF', 'ERREUR_FINANCIERE', 'COMPARAISON', 'SI_J_AVAIS_SU',
  'CROYANCE_FAUSSE', 'CAS_REEL', 'CHOIX_A_OU_B', 'TABOU_ARGENT', 'PROJECTION_FUTURE', 'AUTRE',
];

export function isSevenReel(reel) {
  return String(reel.creator_username || '').toLowerCase() === config.sevenHandle.toLowerCase();
}

// Analyses of Seven reels, most recent first
export function sevenAnalyses(store) {
  const reels = new Map(store.all('reels').filter(isSevenReel).map((r) => [r.id, r]));
  return store.all('analyses')
    .filter((a) => reels.has(a.reel_id) && a.ccr !== null && a.ccr !== undefined)
    .map((a) => ({ ...a, reel: reels.get(a.reel_id) }))
    .sort((a, b) => new Date(b.reel.published_at || b.reel.first_seen) - new Date(a.reel.published_at || a.reel.first_seen));
}

// §35 — success = CCR above the median of the last 20 Seven reels
export function sevenSuccessThreshold(analyses, window = T.sevenSuccessWindow) {
  const recent = analyses.slice(0, window).map((a) => a.ccr);
  return { threshold: median(recent), count: recent.length };
}

export function sevenSuccessRates(store) {
  const analyses = sevenAnalyses(store);
  const { threshold, count } = sevenSuccessThreshold(analyses);
  const byStructure = {};
  for (const a of analyses) {
    const fam = a.structure_family || 'AUTRE';
    const s = byStructure[fam] || (byStructure[fam] = { structure_family: fam, reels: 0, ccrs: [], scores: [], successes: 0 });
    s.reels += 1;
    s.ccrs.push(a.ccr);
    if (Number.isFinite(a.conversation_score)) s.scores.push(a.conversation_score);
    if (threshold !== null && a.ccr > threshold) s.successes += 1;
  }
  const rows = Object.values(byStructure).map((s) => ({
    structure_family: s.structure_family,
    seven_reels: s.reels,
    median_ccr: round(median(s.ccrs), 2),
    median_conversation_score: round(median(s.scores), 0),
    best_score: s.scores.length ? Math.max(...s.scores) : null,
    worst_score: s.scores.length ? Math.min(...s.scores) : null,
    success_rate: s.reels ? round((s.successes / s.reels) * 100, 0) : null,
  }));
  return { threshold: round(threshold, 2), window_count: count, rows };
}

export function predictiveConfidence(sevenCount) {
  if (sevenCount >= T.predictiveConfidence.high) return 'ÉLEVÉE';
  if (sevenCount >= T.predictiveConfidence.medium) return 'MOYENNE';
  return 'FAIBLE';
}

// §36 — Seven Predictive Score /100 for using a structure on a future reel.
// Components are 0–100 normalised values; missing history falls back to a
// neutral 50 (and lowers confidence, never raises it).
export function predictiveScore({ sourceConversationScore, sourceQuality, structureHistory, hookHistory, themeCompatibility, sevenCount }) {
  const structurePerf = structureHistory && structureHistory.seven_reels > 0
    ? clamp(50 + (structureHistory.success_rate - 50), 0, 100) : 50;
  const hookPerf = hookHistory && hookHistory.uses > 0 ? clamp(hookHistory.success_rate ?? 50, 0, 100) : 50;
  const theme = Number.isFinite(themeCompatibility) ? clamp(themeCompatibility, 0, 100) : 50;
  const score = 0.30 * (sourceConversationScore ?? 50)
    + 0.25 * structurePerf
    + 0.20 * (sourceQuality ?? 50)
    + 0.15 * hookPerf
    + 0.10 * theme;
  return { score: Math.round(clamp(score, 0, 100)), confidence: predictiveConfidence(sevenCount), components: { structurePerf, hookPerf, theme } };
}

// §37 — Hook DNA Seven library
export function hookDnaSeven(store) {
  const analyses = sevenAnalyses(store);
  const { threshold } = sevenSuccessThreshold(analyses);
  const byHook = {};
  for (const a of analyses) {
    const fam = a.hook_family || 'AUTRE';
    const h = byHook[fam] || (byHook[fam] = { hook_family: fam, uses: 0, ccrs: [], scores: [], qualified: [], reactions: {}, topics: {}, successes: 0 });
    h.uses += 1;
    h.ccrs.push(a.ccr);
    if (Number.isFinite(a.conversation_score)) h.scores.push(a.conversation_score);
    if (Number.isFinite(a.qualified_ratio)) h.qualified.push(a.qualified_ratio * 100);
    if (a.primary_trigger) h.reactions[a.primary_trigger] = (h.reactions[a.primary_trigger] || 0) + 1;
    if (a.topic) h.topics[a.topic] = (h.topics[a.topic] || 0) + 1;
    if (threshold !== null && a.ccr > threshold) h.successes += 1;
  }
  return Object.values(byHook).map((h) => ({
    id: h.hook_family,
    hook_family: h.hook_family,
    uses: h.uses,
    median_ccr: round(median(h.ccrs), 2),
    median_conversation_score: round(median(h.scores), 0),
    pct_qualified: round(mean(h.qualified), 0),
    main_reaction: Object.entries(h.reactions).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    best_topics: Object.entries(h.topics).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t),
    success_rate: h.uses ? round((h.successes / h.uses) * 100, 0) : null,
  }));
}

// §31 + §38 — Structure library across creators and Seven, with priority.
export function buildStructureLibrary(store) {
  const reels = new Map(store.all('reels').map((r) => [r.id, r]));
  const analyses = store.all('analyses').filter((a) => a.structure_family);
  const seven = sevenAnalyses(store);
  const sevenMedianCcr = median(seven.map((a) => a.ccr));
  const sourceMedianCcr = median(analyses.filter((a) => !isSevenReel(reels.get(a.reel_id) || {})).map((a) => a.ccr).filter(Number.isFinite));
  const successRates = Object.fromEntries(sevenSuccessRates(store).rows.map((r) => [r.structure_family, r]));
  const byStruct = {};
  for (const a of analyses) {
    const reel = reels.get(a.reel_id);
    if (!reel) continue;
    const s = byStruct[a.structure_family] || (byStruct[a.structure_family] = {
      structure_family: a.structure_family, hook_families: {}, triggers: {}, creators: new Set(), occurrences: 0, source_ccrs: [], source_scores: [], seven_ccrs: [], seven_scores: [],
    });
    s.occurrences += 1;
    if (a.hook_family) s.hook_families[a.hook_family] = (s.hook_families[a.hook_family] || 0) + 1;
    if (a.primary_trigger) s.triggers[a.primary_trigger] = (s.triggers[a.primary_trigger] || 0) + 1;
    if (isSevenReel(reel)) {
      if (Number.isFinite(a.ccr)) s.seven_ccrs.push(a.ccr);
      if (Number.isFinite(a.conversation_score)) s.seven_scores.push(a.conversation_score);
    } else {
      s.creators.add(reel.creator_username);
      if (Number.isFinite(a.ccr)) s.source_ccrs.push(a.ccr);
      if (Number.isFinite(a.conversation_score)) s.source_scores.push(a.conversation_score);
    }
  }
  const level = (v, ref) => {
    if (!Number.isFinite(v) || !Number.isFinite(ref) || ref <= 0) return null;
    const r = v / ref;
    if (r >= 1.8) return 'très élevé';
    if (r >= 1.2) return 'élevé';
    if (r >= 0.8) return 'moyen';
    return 'faible';
  };
  return Object.values(byStruct).map((s) => {
    const creatorsCount = s.creators.size;
    const medSource = median(s.source_ccrs);
    const medSeven = median(s.seven_ccrs);
    const sr = successRates[s.structure_family];
    const repeatability = creatorsCount >= 3 ? 'élevée' : creatorsCount === 2 ? 'moyenne' : 'faible';
    const sevenLevel = level(medSeven, sevenMedianCcr);
    const sourceLevel = level(medSource, sourceMedianCcr);
    let priority = 'À TESTER';
    if (s.seven_ccrs.length >= 2) {
      if (['élevé', 'très élevé'].includes(sevenLevel) && (sr?.success_rate ?? 0) >= 50) priority = 'PRIORITAIRE';
      else if (sevenLevel === 'faible' && ['élevé', 'très élevé'].includes(sourceLevel)) priority = 'ÉVITER';
      else if (sevenLevel === 'faible') priority = 'FAIBLE';
      else priority = 'À TESTER';
    } else if (creatorsCount >= 2 && ['élevé', 'très élevé'].includes(sourceLevel)) {
      priority = 'À TESTER (multi-créateurs)';
    }
    return {
      id: s.structure_family,
      structure_family: s.structure_family,
      hook_family: Object.entries(s.hook_families).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      psychological_trigger: Object.entries(s.triggers).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
      occurrences: s.occurrences,
      creators_count: creatorsCount,
      median_source_ccr: round(medSource, 2),
      median_source_score: round(median(s.source_scores), 0),
      median_seven_ccr: round(medSeven, 2),
      median_seven_score: round(median(s.seven_scores), 0),
      seven_uses: s.seven_ccrs.length,
      seven_success_rate: sr?.success_rate ?? null,
      ccr_creators_level: sourceLevel,
      ccr_seven_level: sevenLevel,
      repeatability,
      priority,
    };
  }).sort((a, b) => (b.occurrences - a.occurrences));
}

export function refreshLibraries(store) {
  const lib = buildStructureLibrary(store);
  store.replace('structure_library', lib);
  store.replace('hook_dna_seven', hookDnaSeven(store));
  return lib;
}

// §41 — historical performance block for a structure (shown on ADAPTER À SEVEN)
export function sevenHistoryForStructure(store, structureFamily, hookFamily) {
  const seven = sevenAnalyses(store);
  const lib = store.get('structure_library', structureFamily);
  const hook = store.get('hook_dna_seven', hookFamily);
  const globalMedian = median(seven.map((a) => a.ccr));
  const uses = seven.filter((a) => a.structure_family === structureFamily);
  const meanCcr = mean(uses.map((a) => a.ccr));
  return {
    available: uses.length > 0,
    uses: uses.length,
    mean_ccr: round(meanCcr, 2),
    global_median_ccr: round(globalMedian, 2),
    overperformance: Number.isFinite(meanCcr) && Number.isFinite(globalMedian) && globalMedian > 0 ? round(meanCcr / globalMedian, 1) : null,
    success_rate: lib?.seven_success_rate ?? null,
    hook: hook || null,
    seven_count: seven.length,
    similar_reel_ids: uses.slice(0, 5).map((a) => a.reel_id),
  };
}
