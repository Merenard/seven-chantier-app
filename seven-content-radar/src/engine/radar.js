// Orchestrator: collection ticks, snapshots, pre-filter, comment analysis,
// scoring, alerts, digests, weekly report and the Seven learning loop.
import { config, INITIAL_WATCHLIST } from '../config.js';
import { log } from '../util/log.js';
import { shortId, sha1, hoursBetween, parisParts, normalizeUsername, extractShortcode, canonicalReelUrl, fmtNum } from '../util/misc.js';
import { median, round } from '../util/stats.js';
import { cleanComments, cleaningSummary } from './cleaning.js';
import {
  commentDensity, creatorBaseline, lift as liftOf, prefilter, isQualified, ccr as ccrOf, qualityScore, threadDepthScore,
  categoryDistribution, conversationScore, adaptabilityScore, sufficientData, snapshotDeltas,
} from './scoring.js';
import { isSevenReel, refreshLibraries, sevenHistoryForStructure, predictiveScore, sevenSuccessRates, sevenAnalyses, sevenSuccessThreshold } from './seven.js';
import { alertMessage, reelKeyboard, digestMessage, weeklyMessage } from '../telegram/format.js';
import { esc } from '../telegram/api.js';

const T = config.thresholds;

export class Radar {
  constructor({ store, apify, ai, bot, chatId = config.telegramChatId, now = () => new Date() }) {
    this.store = store;
    this.apify = apify;
    this.ai = ai;
    this.bot = bot;
    this.chatId = chatId;
    this.now = now;
    this.queue = Promise.resolve();
  }

  ts() {
    return this.now().toISOString();
  }

  // Serialises every job so the single-document collections are never written concurrently.
  exclusive(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  // ---------- errors / runs ----------
  recordError(stage, err, context = {}) {
    const entry = { id: shortId('E', `${stage}:${this.ts()}:${Math.random()}`), ts: this.ts(), stage, message: String(err?.message || err).slice(0, 500), context };
    this.store.upsert('errors', entry);
    const errors = this.store.all('errors');
    if (errors.length > 300) this.store.replace('errors', errors.slice(-300));
    log.error(`[${stage}] ${entry.message}`, context);
    return entry;
  }

  // ---------- watchlist ----------
  ensureWatchlist() {
    const existing = new Set(this.store.all('creators').map((c) => c.username));
    for (const u of [...INITIAL_WATCHLIST, config.sevenHandle]) {
      if (!existing.has(u)) this.addCreator(u, { seeded: true });
    }
  }

  addCreator(username, extra = {}) {
    const u = normalizeUsername(username);
    if (!u) return null;
    const cur = this.store.get('creators', u);
    return this.store.upsert('creators', {
      id: u, username: u, active: true, date_added: cur?.date_added || this.ts(), baseline_comment_density: cur?.baseline_comment_density ?? null,
      reels_analyzed: cur?.reels_analyzed ?? 0, is_seven: u === config.sevenHandle.toLowerCase(), ...extra,
    });
  }

  removeCreator(username) {
    const u = normalizeUsername(username);
    const c = this.store.get('creators', u);
    if (!c) return false;
    if (c.is_seven) return false;
    this.store.upsert('creators', { id: u, active: false, date_removed: this.ts() });
    return true;
  }

  activeCreators() {
    return this.store.all('creators').filter((c) => c.active);
  }

  // ---------- reels ----------
  reelIdFor(mapped) {
    const key = mapped.instagram_media_id || mapped.shortcode || mapped.url;
    return shortId('R', key);
  }

  findExistingReel(mapped) {
    const reels = this.store.all('reels');
    return reels.find((r) => (mapped.instagram_media_id && r.instagram_media_id === mapped.instagram_media_id)
      || (mapped.shortcode && r.shortcode === mapped.shortcode)
      || (mapped.url && r.url === mapped.url)) || null;
  }

  // Upserts a mapped reel; returns {reel, isNew}
  ingestReel(mapped, ts = this.ts()) {
    const existing = this.findExistingReel(mapped);
    const metrics = { views: mapped.views, comments_count: mapped.comments_count, likes: mapped.likes, shares: mapped.shares, last_seen: ts };
    if (existing) {
      const patch = { id: existing.id, ...metrics };
      if (!existing.caption && mapped.caption) patch.caption = mapped.caption;
      if (!existing.transcript && mapped.transcript) patch.transcript = mapped.transcript;
      if (mapped.followers_count !== null) patch.followers_count = mapped.followers_count;
      if (!existing.instagram_media_id && mapped.instagram_media_id) patch.instagram_media_id = mapped.instagram_media_id;
      const reel = this.store.upsert('reels', patch);
      return { reel, isNew: false };
    }
    const reel = {
      id: this.reelIdFor(mapped),
      instagram_media_id: mapped.instagram_media_id,
      shortcode: mapped.shortcode,
      url: mapped.url || (mapped.shortcode ? canonicalReelUrl(mapped.shortcode) : null),
      creator_username: mapped.creator_username,
      caption: mapped.caption,
      transcript: mapped.transcript,
      published_at: mapped.published_at,
      first_seen: ts,
      duration: mapped.duration,
      followers_count: mapped.followers_count,
      ...metrics,
      is_seven: String(mapped.creator_username || '').toLowerCase() === config.sevenHandle.toLowerCase(),
      status: 'new',
      saved: false,
      conversation_score: null,
      adaptability_score: null,
      predictive_score: null,
      source_inspiration_reel_id: null,
    };
    this.store.upsert('reels', reel);
    this.recordSnapshot(reel, 'T0', ts);
    return { reel, isNew: true };
  }

  reelAgeHours(reel, at = this.ts()) {
    return hoursBetween(reel.published_at || reel.first_seen, at);
  }

  recordSnapshot(reel, checkpoint, ts = this.ts()) {
    const id = `${reel.id}:${checkpoint}`;
    if (this.store.get('snapshots', id)) return null;
    const prev = this.store.all('snapshots').filter((s) => s.reel_id === reel.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    const cur = { views: reel.views, comments_count: reel.comments_count, timestamp: ts };
    const snap = {
      id, reel_id: reel.id, checkpoint, timestamp: ts, views: reel.views, comments_count: reel.comments_count,
      comment_density: round(commentDensity(reel.comments_count, reel.views), 2),
      age_hours: round(this.reelAgeHours(reel, ts), 1),
      ...snapshotDeltas(prev, cur),
    };
    this.store.upsert('snapshots', snap);
    return snap;
  }

  dueCheckpoints(reel, ts = this.ts()) {
    const age = this.reelAgeHours(reel, ts);
    const cps = config.snapshots.checkpoints.filter((h) => h < 168 || reel.is_seven || config.snapshots.trackAllFor7d);
    return cps.filter((h) => age >= h && !this.store.get('snapshots', `${reel.id}:T+${h}h`)).map((h) => `T+${h}h`);
  }

  // ---------- tick ----------
  async tick({ reason = 'schedule' } = {}) {
    return this.exclusive(async () => {
      const startedAt = this.ts();
      const run = { id: shortId('RUN', startedAt), started_at: startedAt, reason, status: 'running', summary: {} };
      this.store.upsert('runs', run);
      const summary = { creators: 0, reels_seen: 0, new_reels: 0, snapshots: 0, candidates: 0, analyzed: 0, alerts: 0, errors: 0 };
      try {
        this.ensureWatchlist();
        const creators = this.activeCreators();
        summary.creators = creators.length;
        const usernames = creators.map((c) => c.username);
        let fetched = { reels: [], errors: [] };
        try {
          fetched = await this.apify.fetchReels(usernames);
        } catch (err) {
          this.recordError('apify_reels', err, { usernames: usernames.length });
          summary.errors += 1;
        }
        for (const e of fetched.errors || []) { this.recordError('apify_reels_item', e.error, { username: e.username }); summary.errors += 1; }
        const ts = this.ts();
        const touched = [];
        for (const mapped of fetched.reels) {
          try {
            if (mapped.is_video === false) continue;
            if (!mapped.creator_username) continue;
            if (mapped.published_at && hoursBetween(mapped.published_at, ts) > config.snapshots.maxReelAgeHoursForCollection) continue;
            const { reel, isNew } = this.ingestReel(mapped, ts);
            summary.reels_seen += 1;
            if (isNew) summary.new_reels += 1;
            touched.push(reel);
          } catch (err) {
            this.recordError('ingest_reel', err, { shortcode: mapped.shortcode });
            summary.errors += 1;
          }
        }
        for (const reel of touched) {
          for (const cp of this.dueCheckpoints(reel, ts)) {
            if (this.recordSnapshot(reel, cp, ts)) summary.snapshots += 1;
          }
        }
        this.updateBaselines();
        const candidates = this.selectCandidates(ts);
        summary.candidates = candidates.length;
        for (const { reel, reasons } of candidates) {
          try {
            const res = await this.analyzeReel(reel.id, { trigger: reasons.join(',') });
            if (res?.analysis) summary.analyzed += 1;
            if (res?.alerted) summary.alerts += 1;
          } catch (err) {
            this.recordError('analyze', err, { reel_id: reel.id });
            this.store.upsert('reels', { id: reel.id, status: 'error', last_error: String(err.message).slice(0, 200) });
            summary.errors += 1;
          }
          await this.store.flush();
        }
        const paris = parisParts(this.now(), config.timezone);
        if (paris.hour === config.digestHourParis && reason === 'schedule') {
          try { summary.digest = await this.dailyDigest(); } catch (err) { this.recordError('digest', err); }
          if (paris.weekday === config.weeklyReportDay) {
            try { summary.weekly = await this.weeklyReport(); } catch (err) { this.recordError('weekly', err); }
          }
        }
        run.status = 'ok';
      } catch (err) {
        this.recordError('tick', err);
        run.status = 'failed';
      }
      run.finished_at = this.ts();
      run.summary = summary;
      this.store.upsert('runs', run);
      const runs = this.store.all('runs');
      if (runs.length > 200) this.store.replace('runs', runs.slice(-200));
      await this.store.flush();
      log.info('tick done', summary);
      return run;
    });
  }

  updateBaselines() {
    const reels = this.store.all('reels');
    for (const c of this.activeCreators()) {
      const mine = reels.filter((r) => r.creator_username === c.username);
      const b = creatorBaseline(mine);
      this.store.upsert('creators', { id: c.id, baseline_comment_density: round(b.median, 3), baseline_count: b.count, baseline_reliable: b.reliable, reels_known: mine.length, reels_analyzed: mine.filter((r) => r.status === 'analyzed').length });
    }
  }

  panelDensities() {
    return this.store.all('reels').map((r) => commentDensity(r.comments_count, r.views)).filter((d) => d !== null);
  }

  // §13 — which reels deserve a comment scrape this tick
  selectCandidates(ts = this.ts(), { maxPerTick = 6 } = {}) {
    const reels = this.store.all('reels');
    const panel = this.panelDensities();
    const out = [];
    for (const reel of reels) {
      if (['analyzed', 'ignored', 'error'].includes(reel.status)) continue;
      const age = this.reelAgeHours(reel, ts);
      if (age < 6 || age > config.snapshots.maxReelAgeHoursForCollection) continue;
      const density = commentDensity(reel.comments_count, reel.views);
      if (reel.is_seven) {
        if ((reel.comments_count || 0) >= 5 && age >= 24) out.push({ reel, reasons: ['seven'], priority: 1e9 });
        continue;
      }
      const mine = reels.filter((r) => r.creator_username === reel.creator_username);
      const baseline = creatorBaseline(mine, { excludeReelId: reel.id });
      const pf = prefilter({ commentsCount: reel.comments_count, density, baseline, panelDensities: panel, creatorDensities: baseline.densities, ageHours: age });
      if (pf.selected) out.push({ reel, reasons: pf.reasons, priority: (pf.lift || 1) * (density || 0) });
    }
    return out.sort((a, b) => b.priority - a.priority).slice(0, maxPerTick);
  }

  // ---------- analysis of one reel ----------
  async analyzeReel(reelId, { force = false, trigger = 'manual' } = {}) {
    const reel = this.store.get('reels', reelId);
    if (!reel) throw new Error(`Reel ${reelId} inconnu`);
    if (!reel.url) throw new Error(`Reel ${reelId} sans URL`);
    const ts = this.ts();
    const { comments: rawComments } = await this.apify.fetchComments(reel.url);
    const datasetHash = sha1(rawComments.map((c) => `${c.comment_id}|${c.text}`).sort().join('\n') + `|${reel.views}|${reel.comments_count}`);
    const existing = this.store.get('analyses', reel.id);
    if (existing && existing.dataset_hash === datasetHash && !force) {
      log.info('analysis cached', { reel_id: reel.id });
      return { analysis: existing, cached: true, alerted: false };
    }

    const cleaned = cleanComments(rawComments, { creatorUsername: reel.creator_username, caption: reel.caption });
    const organic = cleaned.filter((c) => c.organic);
    const classifications = organic.length ? await this.ai.classifyComments(organic, { caption: reel.caption }) : [];
    const classified = organic.map((c, i) => {
      const k = classifications[i];
      if (!k) return { ...c, category: null, quality_score: null, is_artificial_engagement: null, unclassified: true };
      return { ...c, category: k.category, quality_score: k.quality_score, reason: k.reason, is_artificial_engagement: k.is_artificial_engagement, is_substantive: k.is_substantive, trigger_detected: k.trigger_detected };
    }).filter((c) => !c.unclassified);
    const artificialFromRules = cleaned.filter((c) => c.artificial_reason && !c.is_creator).map((c) => ({ ...c, category: c.artificial_reason === 'cta_keyword' ? 'CTA_ARTIFICIEL' : c.artificial_reason === 'emoji_only' ? 'EMOJI' : c.artificial_reason === 'mention_only' ? 'TAG' : 'SPAM', quality_score: 0, is_artificial_engagement: true }));

    // Persist comment records (no personal identifiers: username dropped)
    for (const c of [...classified, ...artificialFromRules]) {
      this.store.upsert('comments', {
        id: c.comment_id ? `${reel.id}:${c.comment_id}` : `${reel.id}:${sha1(c.text).slice(0, 12)}`,
        reel_id: reel.id, text: c.text.slice(0, 1000), quality_category: c.category, quality_score: c.quality_score,
        artificial_engagement: c.is_artificial_engagement, reply_count: c.reply_count, likes: c.likes, timestamp: c.timestamp, trigger_detected: c.trigger_detected || null,
      });
    }
    const all = this.store.all('comments');
    if (all.length > 20000) this.store.replace('comments', all.slice(-20000));

    // Deterministic KPIs
    const views = reel.views;
    const density = commentDensity(reel.comments_count, views);
    const mine = this.store.all('reels').filter((r) => r.creator_username === reel.creator_username);
    const baseline = creatorBaseline(mine, { excludeReelId: reel.id });
    const lift = baseline.reliable ? liftOf(density, baseline.median) : (baseline.count >= 3 ? liftOf(density, baseline.median) : null);
    const creatorRepliesInSample = cleaned.filter((c) => c.is_creator).length;
    const sampleShareCreator = cleaned.length ? creatorRepliesInSample / cleaned.length : 0;
    const audienceComments = Math.max(0, Math.round((reel.comments_count || 0) * (1 - sampleShareCreator)));
    const organicAnalyzed = classified.length;
    const qualifiedInSample = classified.filter(isQualified).length;
    const ccrRes = ccrOf({ views, audienceComments, organicAnalyzed, qualifiedInSample });
    const quality = qualityScore(classified);
    const depth = threadDepthScore(cleaned, { creatorUsername: reel.creator_username });
    const distribution = categoryDistribution([...classified, ...artificialFromRules]);
    const panel = this.panel(reel.id);
    const conv = conversationScore({ quality, ccrValue: ccrRes.ccr, liftValue: lift, depth: depth.score, panel });

    // AI reasoning (qualitative only)
    const qualifiedSample = classified.filter(isQualified).sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 40);
    const knownStructures = [...new Set(this.store.all('analyses').map((a) => a.structure_family).filter(Boolean))].slice(0, 40);
    let ai = null;
    let adapt = { score: null, detail: {}, penalty: 0, penalties_applied: [] };
    if (organicAnalyzed > 0) {
      try {
        ai = await this.ai.analyzeReel({
          reel,
          metrics: { views, comments_count: reel.comments_count, density: round(density, 2), baseline: round(baseline.median, 2), lift: round(lift, 2), ccr: round(ccrRes.ccr, 2), quality: round(quality, 0) },
          distribution: distribution.groups,
          sampleComments: qualifiedSample.map((c) => ({ category: c.category, quality_score: c.quality_score, text: c.text })),
          knownStructures,
        });
        adapt = adaptabilityScore(ai.adaptability, ai.adaptability.flags);
      } catch (err) {
        this.recordError('ai_analyze', err, { reel_id: reel.id });
      }
    }
    let clusters = [];
    if (qualifiedSample.length >= 5) {
      try {
        const res = await this.ai.clusterComments({ comments: qualifiedSample, topic: ai?.topic });
        clusters = res.clusters.map((c) => ({ ...c, count: new Set(c.comment_indices.filter((i) => i >= 0 && i < qualifiedSample.length)).size })).filter((c) => c.count > 0).sort((a, b) => b.count - a.count);
      } catch (err) {
        this.recordError('ai_cluster', err, { reel_id: reel.id });
      }
    }

    const analysis = {
      id: reel.id,
      reel_id: reel.id,
      analyzed_at: ts,
      trigger,
      dataset_hash: datasetHash,
      views,
      comments_count: reel.comments_count,
      comment_density: round(density, 2),
      baseline_median: round(baseline.median, 2),
      baseline_count: baseline.count,
      baseline_reliable: baseline.reliable,
      lift: round(lift, 2),
      comments_fetched: rawComments.length,
      comments_organic_analyzed: organicAnalyzed,
      creator_replies_in_sample: creatorRepliesInSample,
      cleaning: cleaningSummary(cleaned),
      qualified_in_sample: qualifiedInSample,
      qualified_ratio: round(ccrRes.qualified_ratio, 3),
      estimated_qualified_comments: round(ccrRes.estimated_qualified, 0),
      ccr: round(ccrRes.ccr, 2),
      ccr_estimated: ccrRes.estimated,
      quality_score: round(quality, 1),
      thread_depth: depth.score,
      thread_depth_detail: depth,
      distribution,
      conversation_score: conv.score,
      conversation_components: conv.components,
      calibration: conv.calibration,
      sufficient_data: sufficientData({ organicAnalyzed, views: views || 0 }),
      adaptability_score: adapt.score,
      adaptability_detail: adapt,
      adaptability_explanation: ai?.adaptability_score_explanation || null,
      primary_trigger: ai?.primary_comment_trigger || null,
      secondary_triggers: ai?.secondary_triggers || [],
      psychological_mechanism: ai?.psychological_mechanism || null,
      why_people_comment: ai?.why_people_comment || null,
      hook_type: ai?.hook_type || null,
      hook_family: ai?.hook_family || null,
      opening_pattern: ai?.opening_pattern || null,
      tension_mechanism: ai?.tension_mechanism || null,
      proof_mechanism: ai?.proof_mechanism || null,
      payoff: ai?.payoff || null,
      conversation_trigger: ai?.conversation_trigger || null,
      cta_type: ai?.cta_type || null,
      abstract_structure: ai?.abstract_structure || null,
      structure_family: ai?.structure_family ? ai.structure_family.toUpperCase().replace(/[^A-Z0-9]+/g, '_') : null,
      topic: ai?.topic || null,
      summary: ai?.summary || null,
      reputation_risk: ai?.reputation_risk || null,
      theme_compatibility_pct: ai?.theme_compatibility_pct ?? null,
      suggested_seven_angles: ai?.suggested_seven_angles || [],
      recurring_questions: clusters,
      ai_available: !!ai,
    };
    this.store.upsert('analyses', analysis);
    for (const c of clusters) this.store.upsert('clusters', { id: `${reel.id}:${c.id}`, reel_id: reel.id, ...c, created_at: ts });
    this.store.upsert('reels', { id: reel.id, status: 'analyzed', analyzed_at: ts, conversation_score: conv.score, adaptability_score: adapt.score, structure_family: analysis.structure_family, hook_family: analysis.hook_family });

    // Predictive score for source reels (uses Seven history)
    if (!reel.is_seven && analysis.structure_family) {
      const pred = this.predictiveFor(analysis);
      analysis.predictive_score = pred.score;
      analysis.predictive_confidence = pred.confidence;
      this.store.upsert('analyses', { id: analysis.id, predictive_score: pred.score, predictive_confidence: pred.confidence });
      this.store.upsert('reels', { id: reel.id, predictive_score: pred.score });
    }

    refreshLibraries(this.store);
    let alerted = false;
    if (reel.is_seven) {
      await this.afterSevenAnalysis(reel, analysis);
    } else if (trigger !== 'manual') {
      alerted = await this.maybeImmediateAlert(reel, analysis);
    }
    await this.store.flush();
    return { analysis, cached: false, alerted };
  }

  panel(excludeReelId) {
    const rows = this.store.all('analyses').filter((a) => a.reel_id !== excludeReelId);
    return { ccrs: rows.map((a) => a.ccr).filter(Number.isFinite), lifts: rows.map((a) => a.lift).filter(Number.isFinite) };
  }

  predictiveFor(analysis) {
    const lib = this.store.get('structure_library', analysis.structure_family);
    const rates = sevenSuccessRates(this.store).rows.find((r) => r.structure_family === analysis.structure_family);
    const hook = this.store.get('hook_dna_seven', analysis.hook_family);
    return predictiveScore({
      sourceConversationScore: analysis.conversation_score,
      sourceQuality: analysis.quality_score,
      structureHistory: rates ? { seven_reels: rates.seven_reels, success_rate: rates.success_rate ?? 50 } : (lib?.seven_uses ? { seven_reels: lib.seven_uses, success_rate: lib.seven_success_rate ?? 50 } : null),
      hookHistory: hook ? { uses: hook.uses, success_rate: hook.success_rate } : null,
      themeCompatibility: analysis.theme_compatibility_pct,
      sevenCount: sevenAnalyses(this.store).length,
    });
  }

  // ---------- alerts ----------
  async maybeImmediateAlert(reel, analysis) {
    const settings = this.store.settings();
    if (settings.alerts_enabled === false) return false;
    if (!(analysis.conversation_score >= T.immediateAlertScore && analysis.sufficient_data)) return false;
    if (this.store.get('alerts', `${reel.id}:immediate`)) return false;
    await this.sendReelCard(reel, analysis, { title: '🔥 SEVEN RADAR — PÉPITE DÉTECTÉE' });
    this.store.upsert('alerts', { id: `${reel.id}:immediate`, reel_id: reel.id, type: 'immediate', ts: this.ts(), score: analysis.conversation_score });
    return true;
  }

  async sendReelCard(reel, analysis, { title } = {}) {
    if (!this.bot || !this.chatId) return null;
    return this.bot.sendMessage(this.chatId, alertMessage(reel, analysis, { title }), { keyboard: reelKeyboard(reel, { saved: reel.saved }) });
  }

  topAnalyses({ sinceHours, limit = 3, minScore = 0 }) {
    const since = this.now().getTime() - sinceHours * 3_600_000;
    return this.store.all('analyses')
      .filter((a) => new Date(a.analyzed_at).getTime() >= since && Number.isFinite(a.conversation_score) && a.conversation_score >= minScore)
      .map((a) => ({ analysis: a, reel: this.store.get('reels', a.reel_id) }))
      .filter((x) => x.reel && !x.reel.is_seven && x.reel.status !== 'ignored')
      .sort((a, b) => b.analysis.conversation_score - a.analysis.conversation_score)
      .slice(0, limit);
  }

  async dailyDigest({ force = false } = {}) {
    const today = parisParts(this.now(), config.timezone).date;
    if (!force && this.store.get('alerts', `digest:${today}`)) return 'already_sent';
    const items = this.topAnalyses({ sinceHours: 24, limit: T.digestMaxItems, minScore: T.digestMinScore })
      .filter((x) => force || !this.store.get('alerts', `${x.reel.id}:immediate`));
    if (!items.length) return 'nothing_interesting';
    if (this.bot && this.chatId) {
      await this.bot.sendMessage(this.chatId, digestMessage(items));
      for (const { reel, analysis } of items) await this.sendReelCard(reel, analysis, { title: `⭐ OPPORTUNITÉ DU JOUR — ${analysis.conversation_score}/100` });
    }
    this.store.upsert('alerts', { id: `digest:${today}`, type: 'digest', ts: this.ts(), reel_ids: items.map((x) => x.reel.id) });
    return `sent:${items.length}`;
  }

  buildWeeklyReport() {
    const since = this.now().getTime() - 7 * 24 * 3_600_000;
    const reels = new Map(this.store.all('reels').map((r) => [r.id, r]));
    const recent = this.store.all('analyses').filter((a) => new Date(a.analyzed_at).getTime() >= since && Number.isFinite(a.conversation_score));
    const source = recent.filter((a) => !isSevenReel(reels.get(a.reel_id) || {}));
    const group = (rows, key) => {
      const m = {};
      for (const a of rows) {
        const k = a[key];
        if (!k) continue;
        (m[k] = m[k] || []).push(a.conversation_score);
      }
      return Object.entries(m).map(([name, scores]) => ({ name, count: scores.length, median_score: round(median(scores), 0) })).sort((a, b) => b.median_score - a.median_score || b.count - a.count).slice(0, 5);
    };
    const lib = this.store.all('structure_library');
    const clusters = this.store.all('clusters').filter((c) => new Date(c.created_at).getTime() >= since);
    const qm = {};
    for (const c of clusters) { const k = c.id.split(':').slice(1).join(':'); qm[k] = qm[k] || { label: c.label, count: 0 }; qm[k].count += c.count; }
    const creators = {};
    for (const a of source) { const u = reels.get(a.reel_id).creator_username; (creators[u] = creators[u] || []).push(a.conversation_score); }
    const seven = sevenAnalyses(this.store);
    return {
      period: `7 derniers jours — ${parisParts(this.now(), config.timezone).date}`,
      topReels: source.sort((a, b) => b.conversation_score - a.conversation_score).slice(0, T.weeklyTop).map((a) => ({ analysis: a, reel: reels.get(a.reel_id) })),
      topStructures: group(source, 'structure_family').map((g) => ({ structure_family: g.name, median_score: g.median_score, occurrences: g.count, creators_count: lib.find((l) => l.structure_family === g.name)?.creators_count ?? 1 })),
      topTriggers: group(source, 'primary_trigger'),
      topHooks: group(source, 'hook_family').map((g) => ({ hook_family: g.name, count: g.count, median_score: g.median_score })),
      topQuestions: Object.values(qm).sort((a, b) => b.count - a.count).slice(0, 6),
      newIdeas: this.store.all('ideas').filter((i) => new Date(i.created_at).getTime() >= since).slice(-6).map((i) => ({ hook: i.hooks?.[0]?.text || i.hook })),
      topCreators: Object.entries(creators).map(([username, s]) => ({ username, count: s.length, median_score: round(median(s), 0) })).sort((a, b) => b.median_score - a.median_score).slice(0, 5),
      crossCreatorStructures: lib.filter((l) => l.creators_count >= 2).sort((a, b) => (b.median_source_ccr || 0) - (a.median_source_ccr || 0)).slice(0, 6),
      sevenSection: seven.length ? { handle: config.sevenHandle, count: seven.length, median_ccr: median(seven.map((a) => a.ccr)), threshold: sevenSuccessThreshold(seven).threshold, matrix: lib.filter((l) => l.seven_uses > 0).slice(0, 8) } : null,
    };
  }

  async weeklyReport() {
    const report = this.buildWeeklyReport();
    if (this.bot && this.chatId) await this.bot.sendMessage(this.chatId, weeklyMessage(report));
    this.store.upsert('alerts', { id: `weekly:${parisParts(this.now(), config.timezone).date}`, type: 'weekly', ts: this.ts() });
    return report;
  }

  // ---------- Seven loop ----------
  async afterSevenAnalysis(reel, analysis) {
    // Auto-link to the idea/source that inspired it (caption vs generated hooks)
    if (!reel.source_inspiration_reel_id) {
      const link = this.autoLink(reel);
      if (link) {
        this.store.upsert('reels', { id: reel.id, source_inspiration_reel_id: link.source_reel_id, script_id: link.idea_id, link_method: 'auto_caption' });
        this.store.upsert('ideas', { id: link.idea_id, status: 'published', seven_reel_id: reel.id });
        reel.source_inspiration_reel_id = link.source_reel_id;
      }
    }
    const seven = sevenAnalyses(this.store);
    const { threshold } = sevenSuccessThreshold(seven.filter((a) => a.reel_id !== reel.id));
    const success = threshold !== null && analysis.ccr !== null ? analysis.ccr > threshold : null;
    this.store.upsert('analyses', { id: analysis.id, seven_success: success, seven_threshold: round(threshold, 2) });
    const source = reel.source_inspiration_reel_id ? this.store.get('analyses', reel.source_inspiration_reel_id) : null;
    let failure = null;
    if (source && Number.isFinite(source.ccr) && Number.isFinite(analysis.ccr) && analysis.ccr < source.ccr * 0.7) {
      try {
        const srcReel = this.store.get('reels', source.reel_id);
        failure = await this.ai.failureHypothesis([
          `REEL SOURCE (@${srcReel?.creator_username}) : structure ${source.abstract_structure}; hook ${source.hook_type}; CTA ${source.cta_type}; durée ${srcReel?.duration ?? 'n/d'} s; CCR ${source.ccr}; conversation score ${source.conversation_score}; sujet ${source.topic}; publié ${srcReel?.published_at}`,
          `REEL SEVEN : légende """${(reel.caption || '').slice(0, 800)}"""; durée ${reel.duration ?? 'n/d'} s; structure ${analysis.abstract_structure}; hook ${analysis.hook_type}; CTA ${analysis.cta_type}; CCR ${analysis.ccr}; conversation score ${analysis.conversation_score}; distribution ${JSON.stringify(analysis.distribution?.groups)}; publié ${reel.published_at}`,
          `Questions/objections de l'audience Seven : ${(analysis.recurring_questions || []).map((q) => q.label).join(' | ') || 'n/d'}`,
        ].join('\n\n'));
        this.store.upsert('analyses', { id: analysis.id, failure_analysis: failure });
      } catch (err) {
        this.recordError('ai_failure', err, { reel_id: reel.id });
      }
    }
    if (this.bot && this.chatId) {
      const lines = [
        `<b>📈 SEVEN — REEL ANALYSÉ (@${esc(config.sevenHandle)})</b>`, '',
        `Conversation Score : ${analysis.conversation_score ?? 'n/d'}/100 · CCR ${analysis.ccr_estimated ? 'estimé' : ''} ${fmtNum(analysis.ccr, 1)} · Qualité ${analysis.quality_score !== null ? Math.round(analysis.quality_score) : 'n/d'}/100`,
        `Commentaires / 1 000 vues : ${fmtNum(analysis.comment_density, 1)} (${fmtNum(analysis.views ?? 0, 0)} vues)`,
        `Réussite Seven : ${success === null ? 'n/d (historique insuffisant)' : success ? '✅ au-dessus de la médiane Seven' : '❌ sous la médiane Seven'}${threshold !== null ? ` (seuil ${fmtNum(threshold, 1)})` : ''}`,
        `Hook : ${esc(analysis.hook_family || 'n/d')} · Structure : ${esc(analysis.structure_family || 'n/d')}`,
        '', `<b>Pourquoi l'audience Seven a commenté</b>`, esc(analysis.why_people_comment || 'n/d'),
      ];
      const dom = Object.entries(analysis.distribution?.groups || {}).sort((a, b) => b[1] - a[1])[0];
      if (dom) lines.push(`Réaction dominante : ${esc(dom[0])} (${dom[1]} %)`);
      if (analysis.recurring_questions?.length) lines.push('', '<b>Questions / objections</b>', ...analysis.recurring_questions.slice(0, 4).map((q) => `• ${esc(q.label)} (${q.count})`));
      if (source) lines.push('', `<b>Comparaison avec la source</b> (@${esc(this.store.get('reels', source.reel_id)?.creator_username)}) : source ${source.conversation_score}/100, CCR ${fmtNum(source.ccr, 1)} → Seven ${analysis.conversation_score}/100, CCR ${fmtNum(analysis.ccr, 1)}`);
      if (failure) lines.push('', '<b>Hypothèse d\'échec</b>', esc(failure.main_hypothesis), `Correction : ${esc(failure.recommended_fix)}`);
      await this.bot.sendMessage(this.chatId, lines.join('\n'), { keyboard: [[{ text: '▶️ VOIR LE REEL', url: reel.url }], [{ text: '🔗 LIER À UNE SOURCE', callback_data: `link:${reel.id}` }]] });
    }
  }

  autoLink(reel) {
    const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    const caption = norm(reel.caption);
    if (caption.length < 15) return null;
    for (const idea of this.store.all('ideas')) {
      const hooks = [...(idea.hooks || []).map((h) => h.text), idea.cta].filter(Boolean);
      for (const h of hooks) {
        const key = norm(h);
        if (key.length >= 20 && caption.includes(key.slice(0, 40).trim())) return { idea_id: idea.id, source_reel_id: idea.source_reel_id };
      }
    }
    return null;
  }

  linkSevenReel(sevenReelId, sourceReelId) {
    const reel = this.store.get('reels', sevenReelId);
    const src = this.store.get('reels', sourceReelId);
    if (!reel || !src) return false;
    this.store.upsert('reels', { id: sevenReelId, source_inspiration_reel_id: sourceReelId, link_method: 'manual' });
    refreshLibraries(this.store);
    return true;
  }

  // ---------- adaptation (§25, §41) ----------
  async adaptForSeven(reelId, { topic = null, avoidHooks = [] } = {}) {
    const reel = this.store.get('reels', reelId);
    const analysis = this.store.get('analyses', reelId);
    if (!reel || !analysis) throw new Error('Analyse indisponible pour ce Reel');
    const history = sevenHistoryForStructure(this.store, analysis.structure_family, analysis.hook_family);
    const predictive = this.predictiveFor(analysis);
    const idea = await this.ai.adaptForSeven({ analysis, reel, topic, sevenHistory: history, hookDna: this.store.all('hook_dna_seven'), avoidHooks });
    const record = {
      id: shortId('I', `${reelId}:${this.ts()}:${Math.random()}`),
      source_reel_id: reelId,
      created_at: this.ts(),
      topic,
      hooks: idea.hooks,
      hook: idea.hooks[0]?.text,
      angle: idea.recommended_angle,
      script: idea.script,
      cta: idea.cta,
      final_questions: idea.final_questions,
      ab_test: idea.ab_test,
      why_it_should_work: idea.why_it_should_work,
      structure_family: analysis.structure_family,
      hook_family: idea.hooks[0]?.hook_family || analysis.hook_family,
      predictive_score: predictive.score,
      predictive_confidence: predictive.confidence,
      status: 'proposed',
    };
    this.store.upsert('ideas', record);
    await this.store.flush();
    return { idea: record, history, predictive, analysis, reel };
  }

  // ---------- manual analysis from a URL (/analyze) ----------
  async analyzeUrl(url) {
    const shortcode = extractShortcode(url);
    if (!shortcode) throw new Error('URL Instagram non reconnue (attendu : https://www.instagram.com/reel/…)');
    let reel = this.store.all('reels').find((r) => r.shortcode === shortcode);
    if (!reel) {
      const post = this.apify.fetchPost ? await this.apify.fetchPost(canonicalReelUrl(shortcode)) : null;
      const mapped = post || { shortcode, url: canonicalReelUrl(shortcode), creator_username: null, views: null, comments_count: null };
      if (!mapped.creator_username) mapped.creator_username = 'inconnu';
      if (!mapped.url) mapped.url = canonicalReelUrl(shortcode);
      ({ reel } = this.ingestReel(mapped));
    }
    const res = await this.analyzeReel(reel.id, { force: true, trigger: 'manual' });
    return { reel: this.store.get('reels', reel.id), analysis: res.analysis };
  }

  // ---------- status ----------
  statusSnapshot() {
    const runs = this.store.all('runs');
    const since = this.now().getTime() - 24 * 3_600_000;
    const errors = this.store.all('errors');
    const analyses = this.store.all('analyses');
    return {
      lastRun: runs[runs.length - 1] || null,
      creators: this.activeCreators().length,
      reels: this.store.all('reels').length,
      analyses: analyses.length,
      sevenReels: this.store.all('reels').filter((r) => r.is_seven).length,
      ideas: this.store.all('ideas').length,
      saved: this.store.all('reels').filter((r) => r.saved).length,
      calibration: analyses.length >= T.calibrationMinReels ? `percentiles du panel (${analyses.length} Reels)` : `cold start (${analyses.length}/${T.calibrationMinReels} Reels)`,
      errors24h: errors.filter((e) => new Date(e.ts).getTime() >= since).length,
      recentErrors: errors.slice(-3),
      schedule: config.schedule,
    };
  }
}
