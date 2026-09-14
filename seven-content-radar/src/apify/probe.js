// Real Apify probe (§48): runs the actors once, dumps the actual field names
// and reports which model fields could not be mapped. Output feeds
// docs/APIFY_MAPPING.md — never guess a field.
import { ApifySource } from './client.js';
import { REEL_FIELDS, COMMENT_FIELDS, unmappedFields } from './mapping.js';
import { log } from '../util/log.js';

const keysOf = (obj, prefix = '', depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 1) return [];
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    const t = Array.isArray(v) ? `array(${v.length})` : v === null ? 'null' : typeof v;
    return [`${key}: ${t}`, ...(v && typeof v === 'object' && !Array.isArray(v) ? keysOf(v, key, depth + 1) : [])];
  });
};

export async function probe({ usernames = ['stephane.mdg'], reelUrl = null, apify } = {}) {
  const src = apify || new ApifySource();
  const out = { reels: null, comments: null };
  const r = await src.fetchReels(usernames, { limit: 3, raw: true });
  const first = r.reels[0];
  out.reels = {
    actor: src.cfg.reelsActor,
    items: r.rawCount,
    mapped_sample: first ? Object.fromEntries(Object.keys(REEL_FIELDS).map((k) => [k, first[k]])) : null,
    raw_keys: first?._raw ? keysOf(first._raw) : [],
    unmapped: first?._raw ? unmappedFields(first._raw, REEL_FIELDS) : Object.keys(REEL_FIELDS),
    errors: r.errors,
  };
  const url = reelUrl || first?.url;
  if (url) {
    const c = await src.fetchComments(url, { limit: 20, raw: true });
    const fc = c.comments[0];
    out.comments = {
      actor: src.cfg.commentsActor,
      url,
      items: c.rawCount,
      mapped_sample: fc ? Object.fromEntries(Object.keys(COMMENT_FIELDS).map((k) => [k, k === 'replies' ? (fc.replies || []).length : fc[k]])) : null,
      raw_keys: fc?._raw ? keysOf(fc._raw) : [],
      unmapped: fc?._raw ? unmappedFields(fc._raw, COMMENT_FIELDS) : Object.keys(COMMENT_FIELDS),
      errors: c.errors,
    };
  }
  log.info('probe done', { reels: out.reels.items, comments: out.comments?.items });
  return out;
}
