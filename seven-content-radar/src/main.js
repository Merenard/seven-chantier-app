// Apify Actor entry point.
//   Standby (HTTP server, Telegram webhook + job endpoints)  → default when APIFY_META_ORIGIN=STANDBY
//   Run modes via input.mode: tick | digest | weekly | trigger | probe | setup | serve
// `trigger` is what the Apify Schedule uses: it POSTs to the standby URL so a
// single process owns the Key-Value Store (no concurrent writers).
import { Actor } from 'apify';
import { config } from './config.js';
import { log } from './util/log.js';
import { ApifyKvStore } from './storage/store.js';
import { bootstrap } from './bootstrap.js';
import { createServer } from './server.js';
import { BOT_COMMANDS } from './telegram/handlers.js';
import { probe } from './apify/probe.js';

await Actor.init();
const input = (await Actor.getInput()) || {};
const isStandby = process.env.APIFY_META_ORIGIN === 'STANDBY';
const mode = input.mode || (isStandby ? 'serve' : 'tick');
log.info('actor start', { mode, isStandby });

const openStore = async () => new ApifyKvStore(await Actor.openKeyValueStore(config.apify.storeName)).init();

async function serve() {
  const store = await openStore();
  const { radar, handlers } = await bootstrap({ store });
  const server = createServer({ radar, handlers });
  server.listen(config.server.port, () => log.info(`listening on ${config.server.port}`));
  // keeps the actor alive
  await new Promise(() => {});
}

async function trigger(job) {
  const base = process.env.RADAR_STANDBY_URL || process.env.ACTOR_STANDBY_URL;
  if (!base) throw new Error('RADAR_STANDBY_URL / ACTOR_STANDBY_URL missing for trigger mode');
  const url = new URL(`/jobs/${job}`, base);
  url.searchParams.set('wait', '1');
  const res = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${config.jobsSecret || ''}` } });
  const body = await res.text();
  if (!res.ok) throw new Error(`trigger ${job} failed: ${res.status} ${body.slice(0, 200)}`);
  log.info(`trigger ${job} ok`, { status: res.status });
  await Actor.setValue('OUTPUT', { job, status: res.status, body: body.slice(0, 2000) });
}

async function setup() {
  const store = await openStore();
  const { radar } = await bootstrap({ store });
  if (radar.bot) {
    await radar.bot.setCommands(BOT_COMMANDS);
    const base = process.env.RADAR_STANDBY_URL || process.env.ACTOR_STANDBY_URL;
    if (base) {
      const r = await radar.bot.setWebhook(new URL('/telegram', base).toString(), { secret: config.webhookSecret });
      log.info('webhook set', { result: r });
    }
    if (config.telegramChatId) await radar.bot.sendMessage(config.telegramChatId, '✅ Seven Content Radar est connecté. Tapez /status.');
  }
  await Actor.setValue('OUTPUT', { ok: true, creators: radar.activeCreators().length });
}

try {
  if (mode === 'serve') await serve();
  else if (mode === 'trigger') await trigger(input.job || 'tick');
  else if (mode === 'probe') await Actor.setValue('OUTPUT', await probe({ usernames: input.usernames, reelUrl: input.reelUrl }));
  else if (mode === 'setup') await setup();
  else {
    const store = await openStore();
    const { radar } = await bootstrap({ store });
    let result;
    if (mode === 'tick') result = await radar.tick({ reason: input.reason || 'schedule' });
    else if (mode === 'digest') result = await radar.exclusive(() => radar.dailyDigest({ force: !!input.force }));
    else if (mode === 'weekly') result = await radar.exclusive(() => radar.weeklyReport());
    else throw new Error(`unknown mode ${mode}`);
    await store.flush();
    await Actor.setValue('OUTPUT', result);
  }
} catch (err) {
  log.error('actor failed', { error: err.message });
  await Actor.fail(err.message);
}
await Actor.exit();
