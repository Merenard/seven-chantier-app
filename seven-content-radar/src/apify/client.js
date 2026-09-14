import { ApifyClient } from 'apify-client';
import { config } from '../config.js';
import { retry } from '../util/misc.js';
import { log } from '../util/log.js';
import { mapReel, mapComment, mapProfile } from './mapping.js';

export class ApifyActorError extends Error {
  constructor(message, { actor, status, runId } = {}) {
    super(message);
    this.name = 'ApifyActorError';
    this.actor = actor;
    this.status = status;
    this.runId = runId;
  }
}

// Thin wrapper around the Apify platform. `client` is injectable for tests.
export class ApifySource {
  constructor({ client, token = config.apifyToken, cfg = config.apify } = {}) {
    if (!client && !token) throw new Error('APIFY_TOKEN missing');
    this.client = client || new ApifyClient({ token });
    this.cfg = cfg;
  }

  async runActor(actorId, input, { timeoutSecs = this.cfg.runTimeoutSecs } = {}) {
    return retry(async () => {
      const run = await this.client.actor(actorId).call(input, { waitSecs: timeoutSecs, memory: undefined });
      if (!run || run.status !== 'SUCCEEDED') {
        throw new ApifyActorError(`Actor ${actorId} ended with status ${run?.status}`, { actor: actorId, status: run?.status, runId: run?.id });
      }
      const { items } = await this.client.dataset(run.defaultDatasetId).listItems({ clean: true, limit: 5000 });
      return { items, runId: run.id };
    }, {
      retries: 2,
      baseMs: 5000,
      shouldRetry: (err) => !(err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429),
      onRetry: (err, attempt, delay) => log.warn('apify retry', { actor: actorId, attempt, delay, error: err.message }),
    });
  }

  // Latest reels of several creators. Returns mapped reels (+ raw items for the probe).
  async fetchReels(usernames, { limit = this.cfg.reelsPerCreator, raw = false } = {}) {
    const input = { username: usernames, resultsLimit: limit };
    const { items, runId } = await this.runActor(this.cfg.reelsActor, input);
    const reels = items
      .filter((it) => !it.error && !it.errorDescription)
      .map((it) => ({ ...mapReel(it), _raw: raw ? it : undefined }))
      .filter((r) => r.shortcode || r.instagram_media_id);
    const errors = items.filter((it) => it.error || it.errorDescription).map((it) => ({ username: it.username || it.inputUrl || it.url, error: it.error || it.errorDescription }));
    return { reels, errors, runId, rawCount: items.length };
  }

  // Comments of one reel. The official comment scraper returns top-level
  // comments (with replies when includeNestedComments is on) in a mix of
  // popular and recent order, which is the representative sample §14 asks for.
  async fetchComments(reelUrl, { limit = this.cfg.commentsPerReel, raw = false } = {}) {
    const input = { directUrls: [reelUrl], resultsLimit: limit, includeNestedComments: true, isNewestComments: false };
    const { items, runId } = await this.runActor(this.cfg.commentsActor, input);
    const comments = items
      .filter((it) => !it.error && !it.errorDescription)
      .map((it) => ({ ...mapComment(it), _raw: raw ? it : undefined }))
      .filter((c) => c.text);
    const errors = items.filter((it) => it.error || it.errorDescription).map((it) => it.error || it.errorDescription);
    return { comments, errors, runId, rawCount: items.length };
  }

  // Metadata of a single reel from its URL (used by /analyze URL).
  async fetchPost(url) {
    const input = { directUrls: [url], resultsType: 'posts', resultsLimit: 1, addParentData: false };
    const { items } = await this.runActor(this.cfg.postActor, input);
    const it = items.find((x) => !x.error && !x.errorDescription);
    return it ? mapReel(it) : null;
  }

  async fetchProfiles(usernames) {
    const { items, runId } = await this.runActor(this.cfg.profileActor, { usernames });
    return { profiles: items.map(mapProfile), runId };
  }
}
