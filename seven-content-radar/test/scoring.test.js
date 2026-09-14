import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  commentDensity, creatorBaseline, lift, prefilter, ccr, qualityScore, threadDepthScore, categoryDistribution,
  conversationScore, adaptabilityScore, normalizeCcr, normalizeLift, sufficientData, snapshotDeltas, isQualified,
} from '../src/engine/scoring.js';
import { median, percentileRank, robustZ } from '../src/util/stats.js';
import { predictiveScore, predictiveConfidence } from '../src/engine/seven.js';

test('§11 comment density: 963 comments / 74 800 views = 12.87 per 1000', () => {
  assert.equal(Math.round(commentDensity(963, 74800) * 100) / 100, 12.87);
});

test('§11 density is unavailable when views = 0 or unknown', () => {
  assert.equal(commentDensity(10, 0), null);
  assert.equal(commentDensity(10, null), null);
  assert.equal(commentDensity(null, 100), null);
});

test('§12 baseline = median of the last 20 exploitable reels, reliable from 8', () => {
  const reels = [];
  for (let i = 0; i < 25; i += 1) {
    reels.push({ id: `r${i}`, published_at: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(), views: 10000, comments_count: 10 + i }); // density 1.0 .. 3.4
  }
  const b = creatorBaseline(reels);
  assert.equal(b.count, 20);
  // last 20 → i = 5..24 → densities 1.5..3.4, median = (2.4 + 2.5) / 2
  assert.equal(b.median, 2.45);
  assert.equal(b.reliable, true);
  const small = creatorBaseline(reels.slice(0, 5));
  assert.equal(small.reliable, false);
  assert.equal(small.count, 5);
  // views = 0 reels are not exploitable
  const withZero = creatorBaseline([...reels.slice(0, 3), { id: 'z', published_at: '2026-02-01', views: 0, comments_count: 50 }]);
  assert.equal(withZero.count, 3);
});

test('§12 lift = 12.9 / 3.2 = 4.03', () => {
  assert.equal(Math.round(lift(12.9, 3.2) * 100) / 100, 4.03);
  assert.equal(lift(12.9, 0), null);
  assert.equal(lift(null, 3), null);
});

test('§13 pre-filter conditions', () => {
  const baseline = { median: 3, reliable: true };
  assert.deepEqual(prefilter({ commentsCount: 10, density: 3, baseline }).selected, false);
  assert.ok(prefilter({ commentsCount: 30, density: 3, baseline }).reasons.includes('min_comments'));
  assert.equal(prefilter({ commentsCount: 30, density: 3, baseline, ageHours: 100 }).reasons.includes('min_comments'), false, 'volume rule only for fresh reels');
  assert.ok(prefilter({ commentsCount: 10, density: 4.5, baseline }).reasons.includes('lift'));
  assert.equal(prefilter({ commentsCount: 10, density: 4.4, baseline }).reasons.includes('lift'), false);
  const panel = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3];
  assert.ok(prefilter({ commentsCount: 5, density: 3, baseline: { reliable: false }, panelDensities: panel }).reasons.includes('top_panel'));
  const creatorDensities = [2, 2.1, 1.9, 2, 2.2, 2, 1.8];
  assert.ok(prefilter({ commentsCount: 5, density: 9, baseline: { reliable: false }, creatorDensities }).reasons.includes('anomaly'));
  // unreliable baseline (<8 reels) never triggers the lift rule
  assert.equal(prefilter({ commentsCount: 5, density: 9, baseline: { median: 1, reliable: false } }).reasons.includes('lift'), false);
});

test('§17/§18 CCR estimation from a sample', () => {
  // 100 organic analysed of 500 audience comments, 40 qualified, 100 000 views
  const r = ccr({ views: 100000, audienceComments: 500, organicAnalyzed: 100, qualifiedInSample: 40 });
  assert.equal(r.qualified_ratio, 0.4);
  assert.equal(r.estimated_qualified, 200);
  assert.equal(r.ccr, 2); // 200 / 100000 × 1000
  assert.equal(r.estimated, true);
  const full = ccr({ views: 10000, audienceComments: 50, organicAnalyzed: 50, qualifiedInSample: 25 });
  assert.equal(full.ccr, 2.5);
  assert.equal(full.estimated, false);
  assert.equal(ccr({ views: 0, audienceComments: 50, organicAnalyzed: 50, qualifiedInSample: 25 }).ccr, null);
});

test('§17 qualified comment = score ≥ 7 and not artificial', () => {
  assert.equal(isQualified({ quality_score: 7, is_artificial_engagement: false }), true);
  assert.equal(isQualified({ quality_score: 6, is_artificial_engagement: false }), false);
  assert.equal(isQualified({ quality_score: 10, is_artificial_engagement: true }), false);
});

test('§19 quality score = mean/10×100 over organic audience comments only', () => {
  const rows = [
    { quality_score: 10, is_artificial_engagement: false },
    { quality_score: 2, is_artificial_engagement: false },
    { quality_score: 0, is_artificial_engagement: true }, // excluded
    { quality_score: 9, is_artificial_engagement: false, is_creator: true }, // excluded
    { quality_score: 6, is_artificial_engagement: false, is_duplicate: true }, // excluded
  ];
  assert.equal(qualityScore(rows), 60);
  assert.equal(qualityScore([]), null);
});

test('§20 thread depth score does not reward creator-only replies', () => {
  const base = { is_creator: false, parent_comment_id: null };
  const noReplies = Array.from({ length: 10 }, (_, i) => ({ ...base, username: `u${i}`, replies: [] }));
  assert.equal(threadDepthScore(noReplies, { creatorUsername: 'creator' }).score, 0);
  const audienceReplies = noReplies.map((c, i) => ({ ...c, replies: i < 5 ? [{ username: 'someone' }, { username: 'else' }] : [] }));
  const creatorReplies = noReplies.map((c, i) => ({ ...c, replies: i < 5 ? [{ username: 'creator' }, { username: 'creator' }] : [] }));
  const a = threadDepthScore(audienceReplies, { creatorUsername: 'creator' });
  const c = threadDepthScore(creatorReplies, { creatorUsername: 'creator' });
  assert.ok(a.score > c.score, `${a.score} > ${c.score}`);
  assert.equal(a.pct_with_replies, 50);
  // 50 × min(1, 0.5/0.3) + 30 × (1.0/1.5) + 20 × min(1, 0.5/0.1) = 50 + 20 + 20
  assert.equal(a.score, 90);
});

test('§28 category distribution groups', () => {
  const rows = [
    { category: 'PROJECTION_PERSONNELLE' }, { category: 'PROJECTION_PERSONNELLE' }, { category: 'QUESTION_CONCRETE' },
    { category: 'OBJECTION_ARGUMENTEE' }, { category: 'TEMOIGNAGE' }, { category: 'COMPLIMENT' }, { category: 'SPAM' }, { category: 'X', is_creator: true },
  ];
  const d = categoryDistribution(rows);
  assert.equal(d.total, 7);
  assert.deepEqual(d.groups, { projection_personnelle: 29, questions_concretes: 14, debat_argumente: 14, temoignages: 14, faible_valeur: 29 });
});

test('§21 cold-start normalisation and panel percentile switch at 30 reels', () => {
  assert.equal(normalizeCcr(0).value, 0);
  assert.equal(normalizeCcr(10).value, 100);
  assert.equal(normalizeCcr(2).method, 'cold_start');
  assert.equal(normalizeLift(1).value, 25);
  const panel = Array.from({ length: 30 }, (_, i) => i / 10); // 0 .. 2.9
  const n = normalizeCcr(2.95, panel);
  assert.equal(n.method, 'panel_percentile');
  assert.equal(n.value, 100);
  assert.equal(normalizeCcr(1.45, panel).value, 50);
});

test('§21 conversation score weights 60/20/15/5', () => {
  // quality 90, CCR 6 → 88 (cold start), lift 3 → 78, depth 40
  const r = conversationScore({ quality: 90, ccrValue: 6, liftValue: 3, depth: 40 });
  const expected = 0.6 * 90 + 0.2 * 88 + 0.15 * 78 + 0.05 * 40;
  assert.equal(r.score, Math.round(expected));
  assert.deepEqual(r.missing, []);
  // missing lift → re-weighted over remaining components
  const noLift = conversationScore({ quality: 90, ccrValue: 6, liftValue: null, depth: 40 });
  assert.deepEqual(noLift.missing, ['lift']);
  assert.equal(noLift.score, Math.round((0.6 * 90 + 0.2 * 88 + 0.05 * 40) / 0.85));
  assert.equal(conversationScore({ quality: null, ccrValue: 6, liftValue: 3, depth: 40 }).score, null);
});

test('§22 adaptability score = sub-scores capped, penalties applied, never merged with conversation score', () => {
  const full = adaptabilityScore({ hook_reproducible: 25, mechanism_identifiable: 25, theme_compatibility: 20, reproduction_ease: 20, low_risk: 10 }, {});
  assert.equal(full.score, 100);
  const capped = adaptabilityScore({ hook_reproducible: 40, mechanism_identifiable: 25, theme_compatibility: 20, reproduction_ease: 20, low_risk: 10 }, {});
  assert.equal(capped.score, 100);
  const penalised = adaptabilityScore({ hook_reproducible: 20, mechanism_identifiable: 20, theme_compatibility: 15, reproduction_ease: 15, low_risk: 5 }, { giveaway: true, scandal_dependent: true });
  assert.equal(penalised.score, 75 - 25 - 20);
  assert.deepEqual(penalised.penalties_applied, ['scandal_dependent', 'giveaway']);
  assert.equal(adaptabilityScore({}, { giveaway: true }).score, 0);
});

test('§29 sufficient data for an immediate alert', () => {
  assert.equal(sufficientData({ organicAnalyzed: 30, views: 3000 }), true);
  assert.equal(sufficientData({ organicAnalyzed: 29, views: 100000 }), false);
  assert.equal(sufficientData({ organicAnalyzed: 100, views: 2000 }), false);
});

test('§10 snapshot deltas and velocity', () => {
  const prev = { views: 1000, comments_count: 10, timestamp: '2026-09-14T00:00:00.000Z' };
  const cur = { views: 4000, comments_count: 70, timestamp: '2026-09-14T06:00:00.000Z' };
  assert.deepEqual(snapshotDeltas(prev, cur), { delta_views: 3000, delta_comments: 60, comments_velocity: 10 });
  assert.deepEqual(snapshotDeltas(null, cur), { delta_views: null, delta_comments: null, comments_velocity: null });
});

test('§36 predictive score components and confidence tiers', () => {
  const p = predictiveScore({ sourceConversationScore: 90, sourceQuality: 80, structureHistory: { seven_reels: 5, success_rate: 70 }, hookHistory: { uses: 4, success_rate: 75 }, themeCompatibility: 100, sevenCount: 25 });
  const expected = 0.3 * 90 + 0.25 * 70 + 0.2 * 80 + 0.15 * 75 + 0.1 * 100;
  assert.equal(p.score, Math.round(expected));
  assert.equal(p.confidence, 'MOYENNE');
  assert.equal(predictiveConfidence(5), 'FAIBLE');
  assert.equal(predictiveConfidence(50), 'ÉLEVÉE');
  const cold = predictiveScore({ sourceConversationScore: 90, sourceQuality: 80, structureHistory: null, hookHistory: null, themeCompatibility: null, sevenCount: 0 });
  assert.equal(cold.confidence, 'FAIBLE');
  assert.equal(cold.score, Math.round(0.3 * 90 + 0.25 * 50 + 0.2 * 80 + 0.15 * 50 + 0.1 * 50));
});

test('stats helpers', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 2, 3]), 2.5);
  assert.equal(median([]), null);
  assert.equal(percentileRank(5, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 45);
  assert.ok(robustZ(100, [1, 2, 3, 2, 1, 2, 3]) > 10);
});
