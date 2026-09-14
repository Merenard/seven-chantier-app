#!/usr/bin/env node
// Local operator CLI (file storage in ./data).
//   node src/cli.js serve            HTTP server (webhook + jobs)
//   node src/cli.js poll             Telegram long-polling (no public URL needed)
//   node src/cli.js tick|digest|weekly
//   node src/cli.js probe [username] [reelUrl]
//   node src/cli.js analyze <url>
//   node src/cli.js setup <publicBaseUrl>   set webhook + bot commands
import { config } from './config.js';
import { log } from './util/log.js';
import { bootstrap } from './bootstrap.js';
import { createServer } from './server.js';
import { BOT_COMMANDS } from './telegram/handlers.js';
import { probe } from './apify/probe.js';
import { alertMessage } from './telegram/format.js';

const [cmd, ...args] = process.argv.slice(2);

async function main() {
  if (cmd === 'probe') {
    const out = await probe({ usernames: args[0] ? [args[0]] : undefined, reelUrl: args[1] });
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  const { store, radar, handlers } = await bootstrap();
  if (cmd === 'serve') {
    createServer({ radar, handlers }).listen(config.server.port, () => log.info(`listening on ${config.server.port}`));
    return new Promise(() => {});
  }
  if (cmd === 'poll') {
    if (!handlers) throw new Error('TELEGRAM_BOT_TOKEN missing');
    await radar.bot.deleteWebhook();
    await radar.bot.setCommands(BOT_COMMANDS);
    let offset = 0;
    log.info('polling telegram');
    for (;;) {
      const updates = await radar.bot.getUpdates(offset).catch((e) => { log.warn('poll error', { error: e.message }); return []; });
      for (const u of updates) {
        offset = u.update_id + 1;
        await handlers.handleUpdate(u);
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  if (cmd === 'tick') { console.log(JSON.stringify(await radar.tick({ reason: args[0] || 'manual' }), null, 2)); return; }
  if (cmd === 'digest') { console.log(await radar.exclusive(() => radar.dailyDigest({ force: args.includes('--force') }))); return; }
  if (cmd === 'weekly') { console.log(JSON.stringify(await radar.exclusive(() => radar.weeklyReport()), null, 2).slice(0, 3000)); return; }
  if (cmd === 'analyze') {
    const { reel, analysis } = await radar.exclusive(() => radar.analyzeUrl(args[0]));
    console.log(alertMessage(reel, analysis));
    if (radar.bot && radar.chatId) await radar.sendReelCard(reel, analysis, { title: '🔎 ANALYSE À LA DEMANDE' });
    return;
  }
  if (cmd === 'setup') {
    if (!radar.bot) throw new Error('TELEGRAM_BOT_TOKEN missing');
    await radar.bot.setCommands(BOT_COMMANDS);
    if (args[0]) console.log(await radar.bot.setWebhook(new URL('/telegram', args[0]).toString(), { secret: config.webhookSecret }));
    if (radar.chatId) await radar.bot.sendMessage(radar.chatId, '✅ Seven Content Radar est connecté. Tapez /status.');
    return;
  }
  if (cmd === 'status') { console.log(JSON.stringify(radar.statusSnapshot(), null, 2)); return; }
  console.log('usage: cli.js serve|poll|tick|digest|weekly|probe|analyze|setup|status');
  await store.flush();
}

main().then(() => process.exit(0)).catch((err) => { log.error(err.message); process.exit(1); });
