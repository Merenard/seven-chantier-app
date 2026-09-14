import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { makeRadar } from './helpers/fakes.js';

async function withServer(fn) {
  const ctx = await makeRadar();
  const server = createServer({ radar: ctx.radar, handlers: ctx.handlers, jobsSecret: 's3cret', webhookSecret: 'hook' });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn({ ...ctx, base }); } finally { server.close(); }
}

test('HTTP: readiness, job auth, tick with wait, telegram webhook secret', async () => {
  await withServer(async ({ base, bot, store }) => {
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await fetch(`${base}/jobs/status`)).status, 401);
    const status = await fetch(`${base}/jobs/status`, { headers: { authorization: 'Bearer s3cret' } });
    assert.equal(status.status, 200);
    assert.equal((await status.json()).creators, 15);
    const tick = await fetch(`${base}/jobs/tick?secret=s3cret&wait=1`, { method: 'POST' });
    assert.equal(tick.status, 200);
    assert.equal((await tick.json()).result.status, 'ok');
    assert.equal(store.all('runs').length, 1);
    const accepted = await fetch(`${base}/jobs/digest?secret=s3cret`, { method: 'POST' });
    assert.equal(accepted.status, 202);
    const bad = await fetch(`${base}/telegram`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    assert.equal(bad.status, 401);
    const ok = await fetch(`${base}/telegram`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-telegram-bot-api-secret-token': 'hook' }, body: JSON.stringify({ update_id: 1, message: { chat: { id: 4242 }, text: '/watchlist' } }) });
    assert.equal(ok.status, 200);
    await new Promise((r) => setTimeout(r, 50));
    assert.match(bot.last().text, /WATCHLIST/);
  });
});
