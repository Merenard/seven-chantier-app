// Central configuration. Secrets come exclusively from environment variables
// (Apify secret env vars in production) and are never written to storage,
// Telegram messages or AI prompts.

const env = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
};

export const SEVEN_INSTAGRAM_HANDLE = env('SEVEN_INSTAGRAM_HANDLE', 'stephane.mdg');

export const INITIAL_WATCHLIST = [
  'richissimepodcast',
  'elieattia.fr',
  'jb.merov',
  'renard_finance',
  'edouardclercch',
  'julianmuller.fr',
  'realsimonsquibb',
  'themarkshapiro',
  'meikyuschmitt',
  'marvinndiaye_',
  'matthieupacaud',
  'matthiasbaccino',
  'jeanbenoit_gambet',
  'roro.usdt',
];

export const TIMEZONE = 'Europe/Paris';

export const config = {
  timezone: TIMEZONE,
  sevenHandle: SEVEN_INSTAGRAM_HANDLE,

  // --- Secrets (read lazily, never logged) ---
  get apifyToken() { return env('APIFY_TOKEN'); },
  get telegramToken() { return env('TELEGRAM_BOT_TOKEN'); },
  get telegramChatId() { return env('TELEGRAM_CHAT_ID'); },
  get anthropicApiKey() { return env('ANTHROPIC_API_KEY'); },
  // Shared secret protecting the /jobs/* HTTP endpoints (Make / cron callers)
  get jobsSecret() { return env('RADAR_JOBS_SECRET'); },
  // Telegram webhook secret token (X-Telegram-Bot-Api-Secret-Token)
  get webhookSecret() { return env('TELEGRAM_WEBHOOK_SECRET'); },

  // --- Apify actors (verified with a real probe run at install time, see docs/APIFY_MAPPING.md) ---
  apify: {
    reelsActor: env('APIFY_REELS_ACTOR', 'apify/instagram-reel-scraper'),
    commentsActor: env('APIFY_COMMENTS_ACTOR', 'apify/instagram-comment-scraper'),
    profileActor: env('APIFY_PROFILE_ACTOR', 'apify/instagram-profile-scraper'),
    postActor: env('APIFY_POST_ACTOR', 'apify/instagram-scraper'),
    reelsPerCreator: Number(env('APIFY_REELS_PER_CREATOR', 20)),
    commentsPerReel: Number(env('APIFY_COMMENTS_PER_REEL', 150)),
    runTimeoutSecs: Number(env('APIFY_RUN_TIMEOUT_SECS', 600)),
    storeName: env('APIFY_KV_STORE_NAME', 'seven-content-radar'),
  },

  // --- AI ---
  ai: {
    // Analysis / adaptation model (quality first)
    model: env('RADAR_AI_MODEL', 'claude-opus-5'),
    // Bulk comment classifier (cheaper worker model)
    classifierModel: env('RADAR_AI_CLASSIFIER_MODEL', 'claude-sonnet-5'),
    classifierBatchSize: Number(env('RADAR_AI_CLASSIFIER_BATCH', 40)),
    maxRetries: 2,
  },

  // --- Detection thresholds ---
  thresholds: {
    baselineWindow: 20,          // last N exploitable reels for creator median
    baselineMinReels: 8,         // minimum reels before baseline is considered reliable
    prefilterMinComments: 30,
    prefilterMinCommentsMaxAgeHours: 72, // volume rule only for fresh reels (cost control)
    prefilterLiftMin: 1.5,
    prefilterTopPanelShare: 0.30,
    prefilterAnomalyZ: 2.5,      // robust z-score (MAD) considered a manifest anomaly
    qualifiedMinScore: 7,
    immediateAlertScore: 90,
    immediateAlertMinOrganicComments: 30,
    immediateAlertMinViews: 3000,
    digestMaxItems: 3,
    digestMinScore: 70,
    weeklyTop: 10,
    calibrationMinReels: 30,     // switch from cold-start normalisation to panel percentiles
    sevenSuccessWindow: 20,
    predictiveConfidence: { medium: 20, high: 50 },
  },

  // Snapshot checkpoints in hours (T+7d only for the Seven account unless
  // trackAllFor7d is true)
  snapshots: {
    checkpoints: [6, 24, 72, 168],
    trackAllFor7d: false,
    maxReelAgeHoursForCollection: 24 * 21,
  },

  // Conversation Score weights (sum = 1)
  weights: {
    quality: 0.60,
    ccr: 0.20,
    lift: 0.15,
    depth: 0.05,
  },

  // Schedule (Europe/Paris) — implemented by Make / Apify schedule calling /jobs/tick
  schedule: ['07:00', '13:00', '19:00', '23:00'],
  digestHourParis: 7,
  weeklyReportDay: 1, // Monday

  server: {
    port: Number(env('ACTOR_STANDBY_PORT', env('PORT', 4321))),
  },

  dataDir: env('RADAR_DATA_DIR', './data'),
};

export default config;
