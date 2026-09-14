// HTTP surface (Apify Standby or any Node host):
//   GET  /                      readiness probe
//   POST /telegram              Telegram webhook (X-Telegram-Bot-Api-Secret-Token)
//   POST /jobs/tick|digest|weekly  scheduler entry points (Make / Apify schedule / cron)
//   GET  /jobs/status           JSON status
// Job endpoints require ?secret= or Authorization: Bearer <RADAR_JOBS_SECRET>.
import http from 'node:http';
import { config } from './config.js';
import { log } from './util/log.js';

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2_000_000) reject(new Error('payload too large')); });
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, { 'content-type': typeof payload === 'string' ? 'text/plain' : 'application/json' });
  res.end(body);
}

export function createServer({ radar, handlers, jobsSecret = config.jobsSecret, webhookSecret = config.webhookSecret }) {
  const jobAuthorized = (req, url) => {
    if (!jobsSecret) return true;
    const auth = req.headers.authorization || '';
    return url.searchParams.get('secret') === jobsSecret || auth === `Bearer ${jobsSecret}`;
  };
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) return send(res, 200, { ok: true, service: 'seven-content-radar' });
      if (req.method === 'POST' && url.pathname === '/telegram') {
        if (webhookSecret && req.headers['x-telegram-bot-api-secret-token'] !== webhookSecret) return send(res, 401, 'unauthorized');
        const update = await readJson(req);
        // Answer Telegram immediately; process in the background (Telegram retries otherwise).
        send(res, 200, { ok: true });
        handlers.handleUpdate(update).catch((err) => log.error('update failed', { error: err.message }));
        return undefined;
      }
      if (url.pathname.startsWith('/jobs/')) {
        if (!jobAuthorized(req, url)) return send(res, 401, 'unauthorized');
        const job = url.pathname.slice('/jobs/'.length);
        if (req.method === 'GET' && job === 'status') return send(res, 200, radar.statusSnapshot());
        if (req.method !== 'POST') return send(res, 405, 'method not allowed');
        const wait = url.searchParams.get('wait') === '1';
        let promise;
        if (job === 'tick') promise = radar.tick({ reason: 'schedule' });
        else if (job === 'digest') promise = radar.exclusive(() => radar.dailyDigest());
        else if (job === 'weekly') promise = radar.exclusive(() => radar.weeklyReport());
        else return send(res, 404, 'unknown job');
        if (wait) return send(res, 200, { ok: true, result: await promise });
        promise.catch((err) => log.error(`job ${job} failed`, { error: err.message }));
        return send(res, 202, { ok: true, accepted: job });
      }
      return send(res, 404, 'not found');
    } catch (err) {
      log.error('http error', { path: url.pathname, error: err.message });
      if (!res.headersSent) send(res, 500, { ok: false, error: err.message });
      return undefined;
    }
  });
}
