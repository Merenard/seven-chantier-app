#!/usr/bin/env node
// LIVE end-to-end test (§51) against the real platforms. Requires:
//   APIFY_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ANTHROPIC_API_KEY
// Usage: node scripts/e2e.js <instagram reel url> [--no-wait]
// Steps: Apify probe → reel ingestion → comment scrape → cleaning → AI
// classification → KPIs → Telegram card → waits for the user to press
// ADAPTER À SEVEN (long polling) → adaptation script delivered → summary.
import { promises as fs } from 'node:fs';
import { bootstrap } from '../src/bootstrap.js';
import { probe } from '../src/apify/probe.js';
import { config } from '../src/config.js';
import { BOT_COMMANDS } from '../src/telegram/handlers.js';

const url = process.argv[2];
const noWait = process.argv.includes('--no-wait');
if (!url) { console.error('usage: node scripts/e2e.js <reel url> [--no-wait]'); process.exit(1); }
for (const k of ['APIFY_TOKEN', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'ANTHROPIC_API_KEY']) {
  if (!process.env[k]) { console.error(`missing ${k}`); process.exit(1); }
}

const evidence = { started_at: new Date().toISOString(), url, steps: [] };
const step = (name, data) => { evidence.steps.push({ name, at: new Date().toISOString(), ...data }); console.log(`✔ ${name}`, JSON.stringify(data).slice(0, 300)); };

const { store, radar, handlers } = await bootstrap();
await radar.bot.deleteWebhook();
await radar.bot.setCommands(BOT_COMMANDS);

// 1. Apify probe: real field mapping
const p = await probe({ usernames: [config.sevenHandle], reelUrl: url });
step('apify_probe', { reels_unmapped: p.reels.unmapped, comments_unmapped: p.comments?.unmapped, reel_keys: p.reels.raw_keys.length, comment_keys: p.comments?.raw_keys.length });
await fs.mkdir('./data', { recursive: true });
await fs.writeFile('./data/apify-probe.json', JSON.stringify(p, null, 2));

// 2..9. Ingest + analyse + Telegram card
const { reel, analysis } = await radar.exclusive(() => radar.analyzeUrl(url));
step('analysis', {
  reel_id: reel.id, creator: reel.creator_username, views: analysis.views, comments: analysis.comments_count, density: analysis.comment_density,
  organic_analyzed: analysis.comments_organic_analyzed, qualified: analysis.qualified_in_sample, ccr: analysis.ccr, quality: analysis.quality_score,
  conversation_score: analysis.conversation_score, adaptability_score: analysis.adaptability_score, structure: analysis.structure_family, ai_available: analysis.ai_available, ai_usage: radar.ai.usage,
});
const msg = await radar.sendReelCard(reel, analysis, { title: '🧪 TEST E2E — ANALYSE RÉELLE' });
step('telegram_card_sent', { message_id: msg?.message_id });

// 10..11. Wait for the ADAPTER À SEVEN click (or simulate it with --no-wait)
if (noWait) {
  await handlers.handleCallback({ id: 'e2e', data: `adapt:${reel.id}`, message: { chat: { id: config.telegramChatId }, message_id: msg?.message_id } });
  step('adapt_simulated', { ideas: store.all('ideas').length });
} else {
  console.log('→ Appuyez sur [ ADAPTER À SEVEN ] dans Telegram (attente max 15 min)…');
  const deadline = Date.now() + 15 * 60_000;
  let offset = 0;
  let done = false;
  while (!done && Date.now() < deadline) {
    const updates = await radar.bot.getUpdates(offset).catch(() => []);
    for (const u of updates) {
      offset = u.update_id + 1;
      const r = await handlers.handleUpdate(u);
      if (r === 'adapt' || r === 'script') done = true;
    }
    if (!done) await new Promise((r) => setTimeout(r, 2000));
  }
  step(done ? 'adapt_clicked' : 'adapt_timeout', { ideas: store.all('ideas').length });
}
const idea = store.all('ideas').at(-1);
step('script_delivered', { idea_id: idea?.id, hooks: idea?.hooks?.length, script_words: idea?.script?.split(/\s+/).length, cta: idea?.cta });
evidence.finished_at = new Date().toISOString();
evidence.ai_usage = radar.ai.usage;
await fs.writeFile('./data/e2e-evidence.json', JSON.stringify(evidence, null, 2));
await store.flush();
console.log('\nE2E evidence written to data/e2e-evidence.json');
process.exit(0);
