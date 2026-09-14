// End-to-end pipeline with controlled fakes (§50/§51 rehearsal): detection,
// deduplication, snapshots, pre-filter, comment cleaning, classification, KPIs,
// alert, every Telegram button and command, Seven loop, failure handling.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRadar, reelFixture, commentsFixture, FakeClock } from './helpers/fakes.js';
import { config } from '../src/config.js';

const HOT = 'HOT001';
const hotUrl = `https://www.instagram.com/reel/${HOT}/`;

// A creator with 12 ordinary reels (density ≈ 3/1000) + one hot reel (963/74 800 = 12.87/1000)
function seedCreator(apify, clock, creator = 'richissimepodcast') {
  const reels = [];
  for (let i = 0; i < 12; i += 1) {
    const publishedAt = new Date(clock.now().getTime() - (4 + i) * 24 * 3_600_000).toISOString();
    reels.push(reelFixture({ creator, shortcode: `OLD${i}`, views: 50000, comments: 150 + i, publishedAt, caption: `Reel ordinaire ${i}` }));
  }
  reels.push(reelFixture({ creator, shortcode: HOT, views: 74800, comments: 963, publishedAt: new Date(clock.now().getTime() - 7 * 3_600_000).toISOString() }));
  apify.reelsByCreator[creator] = reels;
  apify.commentsByUrl[hotUrl] = commentsFixture({ creator });
}

test('tick: new reels detected, existing reels never duplicated, T0 snapshot recorded', async () => {
  const clock = new FakeClock('2026-09-14T12:00:00.000Z');
  const { radar, store, apify } = await makeRadar({ clock });
  seedCreator(apify, clock);
  const run1 = await radar.tick();
  assert.equal(run1.status, 'ok');
  assert.equal(run1.summary.new_reels, 13);
  assert.equal(store.all('reels').length, 13);
  assert.equal(store.all('snapshots').filter((s) => s.checkpoint === 'T0').length, 13);
  // second tick with the same data + updated metrics → no duplicates, metrics refreshed
  apify.reelsByCreator.richissimepodcast.find((r) => r.shortcode === HOT).views = 90000;
  const run2 = await radar.tick();
  assert.equal(run2.summary.new_reels, 0);
  assert.equal(store.all('reels').length, 13);
  assert.equal(store.all('reels').find((r) => r.shortcode === HOT).views, 90000);
  // same reel with a different id source (shortcode only) is still matched
  const { isNew } = radar.ingestReel({ shortcode: HOT, url: hotUrl, creator_username: 'richissimepodcast', views: 1, comments_count: 1 });
  assert.equal(isNew, false);
});

test('snapshots T+6h / T+24h / T+72h with deltas, T+7j only for the Seven account', async () => {
  const clock = new FakeClock('2026-09-14T06:00:00.000Z');
  const { radar, store, apify } = await makeRadar({ clock });
  const published = clock.now().toISOString();
  apify.reelsByCreator.richissimepodcast = [reelFixture({ shortcode: 'SNAP1', views: 1000, comments: 10, publishedAt: published })];
  apify.reelsByCreator[config.sevenHandle] = [reelFixture({ creator: config.sevenHandle, shortcode: 'SEV1', views: 500, comments: 2, publishedAt: published })];
  await radar.tick();
  const snapsFor = (sc) => store.all('snapshots').filter((s) => s.reel_id === store.all('reels').find((r) => r.shortcode === sc).id).map((s) => s.checkpoint);
  assert.deepEqual(snapsFor('SNAP1'), ['T0']);
  clock.advanceHours(6);
  apify.reelsByCreator.richissimepodcast[0].views = 4000;
  apify.reelsByCreator.richissimepodcast[0].comments_count = 70;
  await radar.tick();
  assert.deepEqual(snapsFor('SNAP1'), ['T0', 'T+6h']);
  const s6 = store.get('snapshots', `${store.all('reels').find((r) => r.shortcode === 'SNAP1').id}:T+6h`);
  assert.equal(s6.delta_views, 3000);
  assert.equal(s6.delta_comments, 60);
  assert.equal(s6.comments_velocity, 10);
  clock.advanceHours(18);
  await radar.tick();
  assert.deepEqual(snapsFor('SNAP1'), ['T0', 'T+6h', 'T+24h']);
  clock.advanceHours(48);
  await radar.tick();
  assert.deepEqual(snapsFor('SNAP1'), ['T0', 'T+6h', 'T+24h', 'T+72h']);
  clock.advanceHours(96);
  await radar.tick();
  assert.deepEqual(snapsFor('SNAP1'), ['T0', 'T+6h', 'T+24h', 'T+72h']);
  assert.deepEqual(snapsFor('SEV1'), ['T0', 'T+6h', 'T+24h', 'T+72h', 'T+168h']);
});

test('full chain: pre-filter → comments → cleaning → classification → KPIs → alert → buttons', async () => {
  const clock = new FakeClock('2026-09-14T12:00:00.000Z');
  const { radar, store, apify, ai, bot, handlers } = await makeRadar({ clock });
  seedCreator(apify, clock);
  const run = await radar.tick();
  assert.equal(run.summary.candidates, 1, 'only the hot reel passes the pre-filter');
  assert.equal(run.summary.analyzed, 1);
  assert.equal(apify.calls.comments, 1);
  const reel = store.all('reels').find((r) => r.shortcode === HOT);
  const a = store.get('analyses', reel.id);

  // --- hand-checked KPIs ---
  assert.equal(a.comment_density, 12.87);
  // baseline: 12 old reels, densities (150+i)/50000×1000 = 3.00..3.22, median = (3.10+3.12)/2 = 3.11
  assert.equal(a.baseline_median, 3.11);
  assert.equal(a.baseline_reliable, true);
  assert.equal(a.lift, 4.14); // 12.87 / 3.11
  // fixture: 47 comments = 10 projection + 8 questions + 4 objections + 3 testimonies + 5 compliments + 2 agrees
  //          + 6 CTA "GUIDE" + 3 emoji + 4 creator replies + 2 duplicates
  assert.equal(a.comments_fetched, 47);
  assert.equal(a.creator_replies_in_sample, 4);
  assert.equal(a.cleaning.cta_keyword, 6);
  assert.equal(a.cleaning.emoji_only, 3);
  assert.equal(a.cleaning.duplicate, 2);
  assert.equal(a.comments_organic_analyzed, 32); // 10+8+4+3+5+2
  assert.equal(a.qualified_in_sample, 25); // 10+8+4+3
  assert.equal(a.qualified_ratio, 0.781); // 25/32
  // audience comments = 963 × (1 − 4/47) → 881 ; est. qualified = 881 × 25/32 = 688 ; CCR = 688/74800×1000 = 9.2
  assert.equal(a.estimated_qualified_comments, 688);
  assert.equal(a.ccr, 9.2);
  assert.equal(a.ccr_estimated, true);
  // quality = mean(10×10, 9×8, 9×4, 9×3, 1×5, 3×2)/10×100 = (100+72+36+27+5+6)/32 = 7.6875 → 76.9
  assert.equal(a.quality_score, 76.9);
  // distribution = 32 classified organic + 11 rule-flagged (6 CTA + 3 emoji + 2 duplicates) = 43
  assert.equal(a.distribution.total, 43);
  assert.equal(a.distribution.groups.projection_personnelle, Math.round((10 / 43) * 100));
  assert.equal(a.distribution.groups.faible_valeur, Math.round(((5 + 2 + 11) / 43) * 100));
  assert.equal(a.adaptability_score, 93); // 23+24+20+17+9
  assert.ok(a.thread_depth > 0 && a.thread_depth < 100);
  // conversation score = 0.6×76.9 + 0.2×norm(9.2) + 0.15×norm(4.14) + 0.05×depth
  const normCcr = 88 + ((9.2 - 6) / 4) * 12; // between anchors (6,88) and (10,100)
  const normLift = 78 + ((4.14 - 3) / 2) * 14; // between (3,78) and (5,92)
  const expected = Math.round(0.6 * 76.9 + 0.2 * normCcr + 0.15 * normLift + 0.05 * a.thread_depth);
  assert.equal(a.conversation_score, expected);
  assert.equal(a.calibration, 'cold_start');
  assert.equal(a.structure_family, 'CHIFFRE_COMPARAISON_QUESTION');
  assert.equal(a.recurring_questions[0].id, 'RISK_QUESTION');
  assert.equal(a.recurring_questions[0].count, 8);
  assert.ok(Number.isFinite(a.predictive_score));
  assert.equal(a.predictive_confidence, 'FAIBLE');
  // comments stored without usernames
  const stored = store.all('comments').filter((c) => c.reel_id === reel.id);
  assert.ok(stored.length >= 32);
  assert.ok(stored.every((c) => !('username' in c)));

  // --- alert (score < 90 here → no immediate alert, digest handles it) ---
  assert.equal(run.summary.alerts, expected >= 90 ? 1 : 0);
  // force a high score path: simulate immediate alert threshold by re-scoring with strong quality
  ai.analysisOverride = null;
  const sentBefore = bot.sent.length;
  store.upsert('analyses', { id: a.id, conversation_score: 94 });
  const alerted = await radar.maybeImmediateAlert(reel, store.get('analyses', a.id));
  assert.equal(alerted, true);
  const alert = bot.sent[sentBefore];
  assert.match(alert.text, /PÉPITE DÉTECTÉE/);
  assert.match(alert.text, /Conversation Score :<\/b> 94\/100/);
  assert.match(alert.text, /CCR estimé : 9,2 commentaires qualifiés/);
  assert.match(alert.text, /Lift : ×4,1/);
  assert.match(alert.text, /POURQUOI LES GENS COMMENTENT/);
  assert.equal(alert.keyboard[0][0].url, hotUrl); // VOIR LE REEL
  assert.equal(alert.keyboard[1][0].callback_data, `adapt:${reel.id}`);
  assert.equal(await radar.maybeImmediateAlert(reel, store.get('analyses', a.id)), false, 'never alerted twice');

  // --- buttons ---
  const cq = (data) => ({ callback_query: { id: 'cq1', data, message: { chat: { id: 4242 }, message_id: 7 } } });
  await handlers.handleUpdate(cq(`why:${reel.id}`));
  assert.match(bot.last().text, /POURQUOI ÇA MARCHE/);
  assert.match(bot.last().text, /chiffre → comparaison/);
  await handlers.handleUpdate(cq(`questions:${reel.id}`));
  assert.match(bot.last().text, /RISK_QUESTION/);
  assert.match(bot.last().text, /8 commentaires/);
  await handlers.handleUpdate(cq(`adapt:${reel.id}`));
  const history = bot.sent[bot.sent.length - 2].text;
  const adaptation = bot.last().text;
  assert.match(history, /PERFORMANCE HISTORIQUE CHEZ SEVEN/);
  assert.match(history, /Confiance : FAIBLE/);
  assert.match(adaptation, /3 hooks originaux/);
  assert.match(adaptation, /Script 30–45 s/);
  assert.match(adaptation, /Test A\/B recommandé/);
  assert.equal(bot.last().keyboard[0][0].callback_data, `script:${reel.id}`);
  assert.equal(store.all('ideas').length, 1);
  assert.equal(store.all('ideas')[0].status, 'proposed');
  await handlers.handleUpdate(cq(`script:${reel.id}`));
  assert.match(bot.last().text, /SCRIPT SEVEN/);
  await handlers.handleUpdate(cq(`hook:${reel.id}`));
  assert.match(bot.last().text, /AUTRES HOOKS/);
  assert.equal(ai.calls.adapt, 3);
  await handlers.handleUpdate(cq(`similar:${reel.id}`));
  assert.match(bot.last().text, /Aucun Reel Seven/);
  await handlers.handleUpdate(cq(`save:${reel.id}`));
  assert.equal(store.get('reels', reel.id).saved, true);
  assert.equal(bot.edits.at(-1).keyboard[3][0].text, '✅ GARDÉ');
  await handlers.handleUpdate(cq(`ignore:${reel.id}`));
  assert.equal(store.get('reels', reel.id).status, 'ignored');
  assert.equal(bot.callbacks.at(-1).text, 'Ignoré');
});

test('Telegram commands: /today /week /watchlist /add /remove /analyze /saved /settings /status /seven', async () => {
  const clock = new FakeClock('2026-09-14T12:00:00.000Z');
  const { radar, store, apify, bot, handlers } = await makeRadar({ clock });
  seedCreator(apify, clock);
  await radar.tick();
  const msg = (text) => ({ message: { chat: { id: 4242 }, text } });

  await handlers.handleUpdate(msg('/today'));
  assert.match(bot.sent.at(-2).text, /TOP DU JOUR/);
  assert.match(bot.sent.at(-2).text, /@richissimepodcast/);
  assert.ok(bot.last().keyboard, 'top items come with the reel keyboard');
  await handlers.handleUpdate(msg('/week'));
  assert.match(bot.sent.at(-2).text, /TOP DE LA SEMAINE/);

  await handlers.handleUpdate(msg('/watchlist'));
  assert.match(bot.last().text, /WATCHLIST \(15\)/);
  assert.match(bot.last().text, /@stephane.mdg \(Seven\)/);
  await handlers.handleUpdate(msg('/add @NouveauCreateur'));
  assert.equal(store.get('creators', 'nouveaucreateur').active, true);
  await handlers.handleUpdate(msg('/remove @nouveaucreateur'));
  assert.equal(store.get('creators', 'nouveaucreateur').active, false);
  await handlers.handleUpdate(msg('/remove @stephane.mdg'));
  assert.equal(store.get('creators', 'stephane.mdg').active, true, 'Seven account cannot be removed');
  assert.equal(radar.activeCreators().length, 15);

  // /analyze on a reel that fails the pre-filter (ordinary reel) → analysed immediately anyway
  apify.commentsByUrl['https://www.instagram.com/reel/OLD3/'] = commentsFixture({ projection: 2, questions: 2, objections: 0, testimonies: 0, compliments: 3, cta: 0, emoji: 0, creatorReplies: 0, duplicates: 0 });
  await handlers.handleUpdate(msg('/analyze https://www.instagram.com/reel/OLD3/'));
  assert.match(bot.last().text, /ANALYSE À LA DEMANDE/);
  assert.ok(store.get('analyses', store.all('reels').find((r) => r.shortcode === 'OLD3').id));
  // /analyze on an unknown reel → fetched through fetchPost and analysed
  apify.reelsByCreator.autre = [reelFixture({ creator: 'autre', shortcode: 'NEW9', views: 20000, comments: 40, publishedAt: clock.now().toISOString() })];
  apify.commentsByUrl['https://www.instagram.com/reel/NEW9/'] = commentsFixture({ creator: 'autre', projection: 3, questions: 3 });
  await handlers.handleUpdate(msg('/analyze https://www.instagram.com/reel/NEW9/'));
  assert.match(bot.last().text, /@autre/);
  await handlers.handleUpdate(msg('/analyze pas-une-url'));
  assert.match(bot.last().text, /Erreur : URL Instagram non reconnue/);

  await handlers.handleUpdate(msg('/saved'));
  assert.match(bot.last().text, /Aucun contenu sauvegardé/);
  const hot = store.all('reels').find((r) => r.shortcode === HOT);
  store.upsert('reels', { id: hot.id, saved: true });
  await handlers.handleUpdate(msg('/saved'));
  assert.match(bot.last().text, /CONTENUS SAUVEGARDÉS \(1\)/);

  await handlers.handleUpdate(msg('/settings'));
  assert.match(bot.last().text, /Compte Seven : @stephane.mdg/);
  await handlers.handleUpdate(msg('/settings alerts off'));
  assert.equal(store.settings().alerts_enabled, false);
  assert.match(bot.last().text, /Alertes : désactivées/);

  await handlers.handleUpdate(msg('/status'));
  assert.match(bot.last().text, /Dernier run/);
  assert.match(bot.last().text, /cold start/);
  await handlers.handleUpdate(msg('/seven'));
  assert.match(bot.last().text, /BOUCLE SEVEN/);
  await handlers.handleUpdate(msg('/help'));
  assert.match(bot.last().text, /\/analyze URL/);

  // unauthorized chat
  await handlers.handleUpdate({ message: { chat: { id: 999 }, text: '/status' } });
  assert.match(bot.last().text, /Ce bot est privé/);
});

test('daily digest: max 3 items, nothing sent when nothing is interesting, sent once per day', async () => {
  const clock = new FakeClock('2026-09-14T12:00:00.000Z');
  const { radar, store, apify, bot } = await makeRadar({ clock });
  assert.equal(await radar.dailyDigest(), 'nothing_interesting');
  seedCreator(apify, clock);
  for (const c of ['elieattia.fr', 'jb.merov', 'renard_finance', 'edouardclercch']) {
    apify.reelsByCreator[c] = [reelFixture({ creator: c, shortcode: `H_${c}`, views: 60000, comments: 800, publishedAt: new Date(clock.now().getTime() - 8 * 3_600_000).toISOString() })];
    apify.commentsByUrl[`https://www.instagram.com/reel/H_${c}/`] = commentsFixture({ creator: c });
  }
  await radar.tick();
  assert.equal(store.all('analyses').length, 5);
  const before = bot.sent.length;
  assert.equal(await radar.dailyDigest(), 'sent:3');
  assert.equal(bot.sent.length - before, 4); // digest summary + 3 cards
  assert.match(bot.sent[before].text, /DIGEST DU JOUR/);
  assert.equal(await radar.dailyDigest(), 'already_sent');
});

test('Apify failure on reels: tick still completes, error journaled, /status shows it', async () => {
  const clock = new FakeClock('2026-09-14T12:00:00.000Z');
  const { radar, store, apify, bot, handlers } = await makeRadar({ clock });
  apify.failReels = true;
  const run = await radar.tick();
  assert.equal(run.status, 'ok');
  assert.equal(run.summary.errors, 1);
  assert.equal(store.all('errors')[0].stage, 'apify_reels');
  await handlers.handleUpdate({ message: { chat: { id: 4242 }, text: '/status' } });
  assert.match(bot.last().text, /Erreurs \(24 h\) : 1/);
  assert.match(bot.last().text, /apify_reels/);
});

test('Apify failure on comments for one reel does not block the others', async () => {
  const clock = new FakeClock('2026-09-14T12:00:00.000Z');
  const { radar, store, apify } = await makeRadar({ clock });
  seedCreator(apify, clock);
  apify.reelsByCreator['jb.merov'] = [reelFixture({ creator: 'jb.merov', shortcode: 'JB1', views: 60000, comments: 800, publishedAt: new Date(clock.now().getTime() - 8 * 3_600_000).toISOString() })];
  let calls = 0;
  const original = apify.fetchComments.bind(apify);
  apify.fetchComments = async (url) => { calls += 1; if (url.includes('JB1')) throw new Error('Reel supprimé'); return original(url); };
  const run = await radar.tick();
  assert.equal(calls, 2);
  assert.equal(run.summary.analyzed, 1);
  assert.equal(run.summary.errors, 1);
  assert.equal(store.all('reels').find((r) => r.shortcode === 'JB1').status, 'error');
  assert.equal(store.all('reels').find((r) => r.shortcode === HOT).status, 'analyzed');
});

test('AI analysis failure: deterministic KPIs are still stored, ai_available=false, no crash', async () => {
  const clock = new FakeClock('2026-09-14T12:00:00.000Z');
  const { radar, store, apify, ai } = await makeRadar({ clock });
  seedCreator(apify, clock);
  ai.failAnalyze = true;
  const run = await radar.tick();
  assert.equal(run.summary.analyzed, 1);
  const a = store.all('analyses')[0];
  assert.equal(a.ai_available, false);
  assert.equal(a.ccr, 9.2);
  assert.equal(a.adaptability_score, null);
  assert.equal(store.all('errors').some((e) => e.stage === 'ai_analyze'), true);
});

test('analysis cache: same comment dataset is not re-analysed', async () => {
  const clock = new FakeClock('2026-09-14T12:00:00.000Z');
  const { radar, store, apify, ai } = await makeRadar({ clock });
  seedCreator(apify, clock);
  await radar.tick();
  const reel = store.all('reels').find((r) => r.shortcode === HOT);
  const res = await radar.analyzeReel(reel.id);
  assert.equal(res.cached, true);
  assert.equal(ai.calls.classify, 1);
  const forced = await radar.analyzeReel(reel.id, { force: true });
  assert.equal(forced.cached, false);
  assert.equal(ai.calls.classify, 2);
});

test('Seven loop: Seven reel analysed at T+24h, success vs median, source comparison, failure hypothesis, libraries', async () => {
  const clock = new FakeClock('2026-09-14T12:00:00.000Z');
  const { radar, store, apify, ai, bot, handlers } = await makeRadar({ clock });
  seedCreator(apify, clock);
  await radar.tick();
  const source = store.all('reels').find((r) => r.shortcode === HOT);
  // an adaptation is generated from the source, then Seven publishes a reel using hook A
  const { idea } = await radar.adaptForSeven(source.id);
  const sevenReels = [];
  for (let i = 0; i < 3; i += 1) {
    const publishedAt = new Date(clock.now().getTime() - (30 + i * 24) * 3_600_000).toISOString();
    sevenReels.push(reelFixture({ creator: config.sevenHandle, shortcode: `SEV${i}`, views: 20000, comments: 60, publishedAt, caption: `Reel Seven ${i}` }));
    apify.commentsByUrl[`https://www.instagram.com/reel/SEV${i}/`] = commentsFixture({ creator: config.sevenHandle, projection: 6, questions: 4, objections: 1, testimonies: 1, compliments: 6, cta: 0, emoji: 1, creatorReplies: 2, duplicates: 0 });
  }
  // the adapted reel: caption carries hook A → auto-linked to the idea/source; weak performance → failure hypothesis
  sevenReels.push(reelFixture({ creator: config.sevenHandle, shortcode: 'SEVADAPT', views: 30000, comments: 20, publishedAt: new Date(clock.now().getTime() - 26 * 3_600_000).toISOString(), caption: `${idea.hooks[0].text} — nouvelle vidéo` }));
  apify.commentsByUrl['https://www.instagram.com/reel/SEVADAPT/'] = commentsFixture({ creator: config.sevenHandle, projection: 1, questions: 1, objections: 0, testimonies: 0, compliments: 8, cta: 0, emoji: 2, creatorReplies: 1, duplicates: 0 });
  apify.reelsByCreator[config.sevenHandle] = sevenReels;
  const run = await radar.tick();
  assert.equal(run.summary.analyzed, 4);
  const adapted = store.all('reels').find((r) => r.shortcode === 'SEVADAPT');
  assert.equal(adapted.source_inspiration_reel_id, source.id);
  assert.equal(adapted.link_method, 'auto_caption');
  assert.equal(store.get('ideas', idea.id).status, 'published');
  const aAdapted = store.get('analyses', adapted.id);
  assert.ok(aAdapted.ccr < store.get('analyses', source.id).ccr);
  assert.ok(aAdapted.failure_analysis, 'failure hypothesis produced for the under-performing adaptation');
  assert.equal(ai.calls.failure, 1);
  const sevenMsgs = bot.texts().filter((t) => t.includes('SEVEN — REEL ANALYSÉ'));
  assert.equal(sevenMsgs.length, 4);
  assert.ok(sevenMsgs.some((t) => t.includes('Comparaison avec la source') && t.includes('Hypothèse d\'échec')));
  // libraries
  const lib = store.get('structure_library', 'CHIFFRE_COMPARAISON_QUESTION');
  assert.equal(lib.seven_uses, 4);
  assert.equal(lib.creators_count, 1);
  assert.ok(['PRIORITAIRE', 'À TESTER', 'FAIBLE', 'ÉVITER'].includes(lib.priority));
  const dna = store.get('hook_dna_seven', 'CHIFFRE_CONTRE_INTUITIF');
  assert.equal(dna.uses, 4);
  assert.ok(Number.isFinite(dna.median_ccr));
  // ADAPTER À SEVEN now shows Seven history + similar reels
  await handlers.handleUpdate({ callback_query: { id: 'x', data: `adapt:${source.id}`, message: { chat: { id: 4242 }, message_id: 1 } } });
  assert.match(bot.sent.at(-2).text, /Utilisée : 4 fois/);
  await handlers.handleUpdate({ callback_query: { id: 'x', data: `similar:${source.id}`, message: { chat: { id: 4242 }, message_id: 1 } } });
  assert.match(bot.last().text, /REELS SEVEN SIMILAIRES/);
  // manual link command
  await handlers.handleUpdate({ message: { chat: { id: 4242 }, text: `/link ${store.all('reels').find((r) => r.shortcode === 'SEV0').id} ${source.id}` } });
  assert.match(bot.last().text, /Relation source/);
  // weekly report renders with a Seven section
  const report = await radar.weeklyReport();
  assert.ok(report.sevenSection);
  assert.match(bot.last().text, /RAPPORT HEBDOMADAIRE/);
  assert.match(bot.last().text, /BOUCLE SEVEN/);
});

test('scheduled 07:00 Paris tick sends the digest, Monday adds the weekly report', async () => {
  const clock = new FakeClock('2026-09-14T05:00:00.000Z'); // Monday 07:00 Paris (UTC+2)
  const { radar, apify, bot, store } = await makeRadar({ clock });
  seedCreator(apify, clock);
  await radar.tick({ reason: 'schedule' });
  assert.ok(store.get('alerts', 'digest:2026-09-14'));
  assert.ok(store.get('alerts', 'weekly:2026-09-14'));
  assert.ok(bot.texts().some((t) => t.includes('RAPPORT HEBDOMADAIRE')));
});
