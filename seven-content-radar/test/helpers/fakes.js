// Controlled fakes for the pipeline tests. The AI fake classifies with
// transparent keyword rules so every KPI can be recomputed by hand.
import { MemoryStore } from '../../src/storage/store.js';
import { Radar } from '../../src/engine/radar.js';
import { TelegramHandlers } from '../../src/telegram/handlers.js';

export class FakeClock {
  constructor(iso = '2026-09-14T05:00:00.000Z') { this.t = new Date(iso); }

  now() { return new Date(this.t); }

  advanceHours(h) { this.t = new Date(this.t.getTime() + h * 3_600_000); }

  set(iso) { this.t = new Date(iso); }
}

export class FakeApify {
  constructor() {
    this.reelsByCreator = {};
    this.commentsByUrl = {};
    this.failReels = false;
    this.failComments = false;
    this.calls = { reels: 0, comments: 0 };
    this.cfg = { reelsActor: 'fake/reels', commentsActor: 'fake/comments' };
  }

  async fetchReels(usernames) {
    this.calls.reels += 1;
    if (this.failReels) throw new Error('Actor fake/reels ended with status FAILED');
    const reels = usernames.flatMap((u) => this.reelsByCreator[u] || []);
    return { reels: reels.map((r) => ({ ...r })), errors: [], runId: 'run', rawCount: reels.length };
  }

  async fetchComments(url) {
    this.calls.comments += 1;
    if (this.failComments) throw new Error('Actor fake/comments ended with status FAILED');
    const comments = this.commentsByUrl[url] || [];
    return { comments: comments.map((c) => ({ ...c, replies: (c.replies || []).map((r) => ({ ...r })) })), errors: [], runId: 'run', rawCount: comments.length };
  }

  async fetchPost(url) {
    const all = Object.values(this.reelsByCreator).flat();
    return all.find((r) => r.url === url) || null;
  }
}

export function classifyByRules(text) {
  const t = text.toLowerCase();
  if (/^(guide|info|moi)$/i.test(text.trim())) return { category: 'CTA_ARTIFICIEL', quality_score: 0, is_artificial_engagement: true, is_substantive: false, trigger_detected: null };
  if (/exactement ma situation|mon cas|je suis dans ce cas/.test(t)) return { category: 'PROJECTION_PERSONNELLE', quality_score: 10, is_artificial_engagement: false, is_substantive: true, trigger_detected: 'projection_personnelle' };
  if (/comment je peux|comment faire concr/.test(t)) return { category: 'INTENTION_ACTION', quality_score: 10, is_artificial_engagement: false, is_substantive: true, trigger_detected: 'verification_cas_personnel' };
  if (/j'ai fait|j’ai fait|en 2024/.test(t)) return { category: 'TEMOIGNAGE', quality_score: 9, is_artificial_engagement: false, is_substantive: true, trigger_detected: 'apporter_son_experience' };
  if (/pas d'accord|pas d’accord|tu oublies/.test(t)) return { category: 'OBJECTION_ARGUMENTEE', quality_score: 9, is_artificial_engagement: false, is_substantive: true, trigger_detected: 'desaccord' };
  if (/\?/.test(t)) return { category: 'QUESTION_CONCRETE', quality_score: 9, is_artificial_engagement: false, is_substantive: true, trigger_detected: 'verification_cas_personnel' };
  if (/si je comprends bien/.test(t)) return { category: 'REFLEXION_REFORMULATION', quality_score: 8, is_artificial_engagement: false, is_substantive: true, trigger_detected: null };
  if (/super|top|génial|bravo/.test(t)) return { category: 'COMPLIMENT', quality_score: 1, is_artificial_engagement: false, is_substantive: false, trigger_detected: null };
  return { category: 'ACCORD_SIMPLE', quality_score: 3, is_artificial_engagement: false, is_substantive: false, trigger_detected: null };
}

export class FakeAi {
  constructor() {
    this.calls = { classify: 0, analyze: 0, adapt: 0, cluster: 0, failure: 0 };
    this.failAnalyze = false;
    this.analysisOverride = null;
  }

  async classifyComments(comments) {
    this.calls.classify += 1;
    return comments.map((c) => ({ ...classifyByRules(c.text), reason: 'règle de test' }));
  }

  async analyzeReel({ reel }) {
    this.calls.analyze += 1;
    if (this.failAnalyze) throw new Error('AI unavailable');
    return {
      primary_comment_trigger: 'projection_personnelle',
      secondary_triggers: ['comparaison_sociale', 'verification_cas_personnel'],
      psychological_mechanism: 'Le spectateur compare sa situation au chiffre présenté.',
      why_people_comment: 'Le spectateur compare immédiatement sa propre situation au chiffre présenté.',
      hook_type: 'chiffre choc',
      hook_family: reel.is_seven ? 'CHIFFRE_CONTRE_INTUITIF' : 'CHIFFRE_CONTRE_INTUITIF',
      opening_pattern: 'âge → chiffre',
      tension_mechanism: 'comparaison personnelle',
      proof_mechanism: 'calcul simple',
      payoff: 'explication',
      conversation_trigger: 'question finale ouverte',
      cta_type: 'question',
      abstract_structure: 'chiffre → comparaison → contradiction → explication → question',
      structure_family: 'CHIFFRE_COMPARAISON_QUESTION',
      topic: 'épargne à 30 ans',
      summary: 'Reel test.',
      adaptability: { hook_reproducible: 23, mechanism_identifiable: 24, theme_compatibility: 20, reproduction_ease: 17, low_risk: 9, flags: { celebrity_dependent: false, scandal_dependent: false, exceptional_news: false, giveaway: false, incompatible_polemic: false } },
      adaptability_score_explanation: 'Structure générique, thème finance.',
      theme_compatibility_pct: 95,
      reputation_risk: 'faible',
      suggested_seven_angles: ['Rendement réel de votre patrimoine à 35 ans'],
      ...(this.analysisOverride || {}),
    };
  }

  async adaptForSeven({ avoidHooks = [] }) {
    this.calls.adapt += 1;
    const n = this.calls.adapt;
    return {
      hooks: [
        { text: `Hook A${n} : À 35 ans, votre patrimoine rapporte-t-il vraiment plus que votre livret ?`, hook_family: 'QUESTION_PERSONNELLE' },
        { text: `Hook B${n} : 90 % des trentenaires ignorent le rendement réel de leur épargne`, hook_family: 'CHIFFRE_CONTRE_INTUITIF' },
        { text: `Hook C${n} : Option A ou option B, laquelle choisiriez-vous ?`, hook_family: 'CHOIX_A_OU_B' },
      ],
      recommended_angle: 'Rendement réel vs rendement perçu',
      script: 'Ligne 1.\nLigne 2.\nLigne 3.',
      cta: 'Vous connaissez réellement le rendement de votre patrimoine ?',
      final_questions: ['Q1 ?', 'Q2 ?', 'Q3 ?'],
      ab_test: { version_a: 'hook chiffre', version_b: 'hook question personnelle', hypothesis: 'La version B génère un CCR supérieur.' },
      why_it_should_work: 'Projection personnelle immédiate.',
      _avoided: avoidHooks,
    };
  }

  async clusterComments({ comments }) {
    this.calls.cluster += 1;
    const idx = comments.map((c, i) => (/\?/.test(c.text) ? i : -1)).filter((i) => i >= 0);
    return { clusters: idx.length ? [{ id: 'RISK_QUESTION', type: 'question', label: 'Quel est le risque ?', comment_indices: idx, example: 'Oui mais quel est le risque ?', seven_hook: 'La vraie question : quel risque accepter pour viser ce rendement ?' }] : [] };
  }

  async failureHypothesis() {
    this.calls.failure += 1;
    return { main_hypothesis: 'Hook trop long.', secondary_hypotheses: ['CTA trop abstrait'], what_worked: 'Le chiffre.', recommended_fix: 'Raccourcir le hook.', retest_worth_it: true };
  }
}

export class FakeBot {
  constructor() { this.sent = []; this.callbacks = []; this.edits = []; }

  async sendMessage(chatId, text, opts = {}) { this.sent.push({ chatId, text, keyboard: opts.keyboard || null }); return { message_id: this.sent.length }; }

  async answerCallback(id, text) { this.callbacks.push({ id, text }); return true; }

  async editKeyboard(chatId, messageId, keyboard) { this.edits.push({ chatId, messageId, keyboard }); return true; }

  async setCommands() { return true; }

  last() { return this.sent[this.sent.length - 1]; }

  texts() { return this.sent.map((m) => m.text); }
}

export async function makeRadar({ clock = new FakeClock(), chatId = '4242' } = {}) {
  const store = await new MemoryStore().init();
  const apify = new FakeApify();
  const ai = new FakeAi();
  const bot = new FakeBot();
  const radar = new Radar({ store, apify, ai, bot, chatId, now: () => clock.now() });
  radar.ensureWatchlist();
  const handlers = new TelegramHandlers({ radar, bot, allowedChatId: chatId });
  return { store, apify, ai, bot, radar, handlers, clock };
}

// ----- fixtures -----
export function reelFixture({ creator = 'richissimepodcast', shortcode = 'ABC123', views = 74800, comments = 963, publishedAt, id, caption = 'À 30 ans vous devriez avoir X € de côté. Écris GUIDE et je t’envoie le document.' } = {}) {
  return {
    instagram_media_id: id || `id_${shortcode}`,
    shortcode,
    url: `https://www.instagram.com/reel/${shortcode}/`,
    caption,
    transcript: null,
    published_at: publishedAt,
    views,
    comments_count: comments,
    likes: 5000,
    shares: null,
    duration: 38,
    creator_username: creator,
    followers_count: 120000,
    is_video: true,
  };
}

// Builds a controlled comment set: counts per type are explicit so KPIs can be verified by hand.
export function commentsFixture({ creator = 'richissimepodcast', projection = 10, questions = 8, objections = 4, testimonies = 3, compliments = 5, agrees = 2, cta = 6, emoji = 3, creatorReplies = 4, duplicates = 2 } = {}) {
  const out = [];
  let n = 0;
  const push = (text, extra = {}) => { n += 1; out.push({ comment_id: `c${n}`, username: `user${n}`, text, timestamp: '2026-09-14T00:00:00.000Z', likes: n % 7, reply_count: 0, parent_comment_id: null, replies: [], ...extra }); };
  for (let i = 0; i < projection; i += 1) push(`C'est exactement ma situation, j'ai ${30 + i} ans et je me pose la question du rendement numéro ${i}`);
  for (let i = 0; i < questions; i += 1) push(`Et si on dispose de ${(i + 1) * 10} 000 €, le raisonnement reste le même ?`, { reply_count: i < 3 ? 2 : 0, replies: i < 3 ? [{ comment_id: `r${n}a`, username: `other${i}`, text: 'Bonne question, moi aussi je me demande', replies: [] }, { comment_id: `r${n}b`, username: creator, text: 'Oui, même logique', replies: [] }] : [] });
  for (let i = 0; i < objections; i += 1) push(`Je ne suis pas d'accord car tu oublies l'inflation dans le calcul numéro ${i}`);
  for (let i = 0; i < testimonies; i += 1) push(`J'ai fait exactement ça en 2024 et voici ce qui s'est passé, épisode ${i}`);
  for (let i = 0; i < compliments; i += 1) push(`Super vidéo comme toujours ${i}`);
  for (let i = 0; i < agrees; i += 1) push(`Tellement vrai ${i}`);
  for (let i = 0; i < cta; i += 1) push('GUIDE');
  for (let i = 0; i < emoji; i += 1) push('🔥🔥🔥');
  for (let i = 0; i < creatorReplies; i += 1) push(`Merci pour ton retour ${i}`, { username: creator });
  for (let i = 0; i < duplicates; i += 1) push('Je ne suis pas d\'accord car tu oublies l\'inflation dans le calcul numéro 0');
  return out;
}
