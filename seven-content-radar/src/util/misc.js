import { createHash } from 'node:crypto';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Exponential backoff retry. `shouldRetry(err)` can veto retries (e.g. 4xx).
export async function retry(fn, { retries = 3, baseMs = 1000, factor = 2, shouldRetry = () => true, onRetry } = {}) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const delay = baseMs * factor ** attempt;
      if (onRetry) onRetry(err, attempt, delay);
      await sleep(delay);
      attempt += 1;
    }
  }
}

// Short internal identifier for Telegram callbacks: R_ + 8 base36 chars derived
// from a stable key (instagram media id / shortcode / url).
export function shortId(prefix, key) {
  const h = createHash('sha1').update(String(key)).digest();
  const n = h.readUIntBE(0, 6);
  return `${prefix}_${n.toString(36).toUpperCase().padStart(8, '0').slice(0, 8)}`;
}

export function sha1(s) {
  return createHash('sha1').update(String(s)).digest('hex');
}

export function nowIso() {
  return new Date().toISOString();
}

export function hoursBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

// Europe/Paris local parts of a date (hour, weekday, yyyy-mm-dd).
export function parisParts(date = new Date(), timeZone = 'Europe/Paris') {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: weekdays[parts.weekday],
  };
}

export function normalizeUsername(u) {
  return String(u || '').trim().replace(/^@/, '').replace(/\/$/, '').toLowerCase();
}

export function extractShortcode(url) {
  const m = String(url || '').match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

export function canonicalReelUrl(shortcode) {
  return `https://www.instagram.com/reel/${shortcode}/`;
}

export function fmtInt(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'n/d';
  return new Intl.NumberFormat('fr-FR').format(Math.round(n));
}

export function fmtNum(n, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'n/d';
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: digits }).format(n);
}

// Redact anything that looks like a token before it reaches logs/Telegram.
export function redact(text) {
  return String(text)
    .replace(/apify_api_[A-Za-z0-9]+/g, 'apify_api_***')
    .replace(/\b\d{6,}:[A-Za-z0-9_-]{30,}\b/g, '<telegram-token>')
    .replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-***');
}
