// Telegram commands (§7) and inline-button callbacks (§8, §41).
import { config } from '../config.js';
import { log } from '../util/log.js';
import { normalizeUsername, fmtNum } from '../util/misc.js';
import { esc } from './api.js';
import {
  reelKeyboard, adaptKeyboard, alertMessage, whyMessage, questionsMessage, sevenHistoryBlock, adaptationMessage,
  reelLine, statusMessage, settingsMessage, helpMessage,
} from './format.js';
import { sevenSuccessRates } from '../engine/seven.js';

export class TelegramHandlers {
  constructor({ radar, bot, allowedChatId = config.telegramChatId }) {
    this.radar = radar;
    this.bot = bot;
    this.allowedChatId = allowedChatId ? String(allowedChatId) : null;
    this.store = radar.store;
  }

  authorized(chatId) {
    return !this.allowedChatId || String(chatId) === this.allowedChatId;
  }

  async handleUpdate(update) {
    try {
      if (update.message?.text) return await this.handleMessage(update.message);
      if (update.callback_query) return await this.handleCallback(update.callback_query);
    } catch (err) {
      this.radar.recordError('telegram_update', err, { update_id: update.update_id });
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) await this.bot.sendMessage(chatId, `⚠️ Erreur : ${esc(err.message)}`).catch(() => {});
    }
    return null;
  }

  async handleMessage(message) {
    const chatId = message.chat.id;
    if (!this.authorized(chatId)) {
      await this.bot.sendMessage(chatId, `Ce bot est privé. Votre chat id : <code>${chatId}</code>`);
      return 'unauthorized';
    }
    const text = message.text.trim();
    const [cmdRaw, ...args] = text.split(/\s+/);
    const cmd = cmdRaw.toLowerCase().replace(/@[\w_]+$/, '');
    const reply = (t, opts) => this.bot.sendMessage(chatId, t, opts);
    switch (cmd) {
      case '/start':
      case '/help':
        await reply(helpMessage());
        return cmd;
      case '/today':
        await this.sendTop(chatId, { sinceHours: 24, title: '🏆 TOP DU JOUR' });
        return cmd;
      case '/week':
        await this.sendTop(chatId, { sinceHours: 24 * 7, title: '🏆 TOP DE LA SEMAINE', limit: 10 });
        return cmd;
      case '/watchlist': {
        const creators = this.radar.activeCreators();
        const lines = creators.map((c) => `• @${esc(c.username)}${c.is_seven ? ' (Seven)' : ''} — baseline ${c.baseline_comment_density !== null && c.baseline_comment_density !== undefined ? fmtNum(c.baseline_comment_density, 1) : 'n/d'}${c.baseline_reliable === false ? ' (provisoire)' : ''} · ${c.reels_known ?? 0} Reels`);
        await reply(`<b>👀 WATCHLIST (${creators.length})</b>\n\n${lines.join('\n')}`);
        return cmd;
      }
      case '/add': {
        const u = normalizeUsername(args[0]);
        if (!u) { await reply('Usage : /add @username'); return cmd; }
        this.radar.addCreator(u);
        await this.store.flush();
        await reply(`✅ @${esc(u)} ajouté à la watchlist. Ses Reels seront collectés au prochain run.`);
        return cmd;
      }
      case '/remove': {
        const u = normalizeUsername(args[0]);
        if (!u) { await reply('Usage : /remove @username'); return cmd; }
        const ok = this.radar.removeCreator(u);
        await this.store.flush();
        await reply(ok ? `🗑 @${esc(u)} retiré de la watchlist.` : `@${esc(u)} n'est pas dans la watchlist (le compte Seven ne peut pas être retiré).`);
        return cmd;
      }
      case '/analyze': {
        const url = args[0];
        if (!url) { await reply('Usage : /analyze https://www.instagram.com/reel/…'); return cmd; }
        await reply('🔎 Analyse en cours (scraping des commentaires + classification IA, 1 à 3 minutes)…');
        const { reel, analysis } = await this.radar.exclusive(() => this.radar.analyzeUrl(url));
        await reply(alertMessage(reel, analysis, { title: '🔎 ANALYSE À LA DEMANDE' }), { keyboard: reelKeyboard(reel, { saved: reel.saved }) });
        return cmd;
      }
      case '/saved': {
        const saved = this.store.all('reels').filter((r) => r.saved);
        if (!saved.length) { await reply('Aucun contenu sauvegardé.'); return cmd; }
        const lines = saved.map((r, i) => reelLine(r, this.store.get('analyses', r.id), i + 1));
        const ideas = this.store.all('ideas');
        const ideaLines = ideas.slice(-5).map((i) => `• ${esc(i.hook)} <i>(${esc(i.id)}, source ${esc(i.source_reel_id)})</i>`);
        await reply(`<b>💾 CONTENUS SAUVEGARDÉS (${saved.length})</b>\n\n${lines.join('\n')}${ideaLines.length ? `\n\n<b>Dernières idées Seven</b>\n${ideaLines.join('\n')}` : ''}`);
        return cmd;
      }
      case '/settings': {
        if (args[0] === 'alerts' && ['on', 'off'].includes(args[1])) {
          this.store.setSettings({ alerts_enabled: args[1] === 'on' });
          await this.store.flush();
        }
        await reply(settingsMessage(this.store.settings(), config));
        return cmd;
      }
      case '/status':
        await reply(statusMessage(this.radar.statusSnapshot()));
        return cmd;
      case '/seven': {
        const rates = sevenSuccessRates(this.store);
        const dna = this.store.all('hook_dna_seven');
        const lib = this.store.all('structure_library').filter((l) => l.seven_uses > 0);
        const L = [`<b>🧬 BOUCLE SEVEN — @${esc(config.sevenHandle)}</b>`, '', `Seuil de réussite (médiane CCR des ${rates.window_count} derniers Reels Seven) : ${fmtNum(rates.threshold, 1)}`, '', '<b>Seven Success Rate par structure</b>'];
        if (!rates.rows.length) L.push('Aucun Reel Seven analysé pour le moment.');
        rates.rows.forEach((r) => L.push(`• ${esc(r.structure_family)} — ${r.seven_reels} Reel(s), CCR médian ${fmtNum(r.median_ccr, 1)}, score médian ${r.median_conversation_score ?? 'n/d'}, réussite ${r.success_rate ?? 'n/d'} %`));
        L.push('', '<b>Hook DNA Seven</b>');
        if (!dna.length) L.push('n/d');
        dna.forEach((h) => L.push(`• ${esc(h.hook_family)} — ${h.uses} utilisation(s), CCR médian ${fmtNum(h.median_ccr, 1)}, ${h.pct_qualified ?? 'n/d'} % qualifiés, réaction ${esc(h.main_reaction || 'n/d')}`));
        L.push('', '<b>Matrice structure × audience Seven</b>');
        if (!lib.length) L.push('n/d');
        lib.forEach((r) => L.push(`• ${esc(r.structure_family)} — créateurs ${esc(r.ccr_creators_level || 'n/d')} / Seven ${esc(r.ccr_seven_level || 'n/d')} / répétabilité ${esc(r.repeatability)} → <b>${esc(r.priority)}</b>`));
        await reply(L.join('\n'));
        return cmd;
      }
      case '/link': {
        const [sevenId, sourceId] = args;
        if (!sevenId || !sourceId) { await reply('Usage : /link R_SEVEN R_SOURCE'); return cmd; }
        const ok = this.radar.linkSevenReel(sevenId, sourceId);
        await this.store.flush();
        await reply(ok ? '🔗 Relation source → Reel Seven enregistrée.' : 'Identifiants inconnus.');
        return cmd;
      }
      case '/run': {
        await reply('▶️ Cycle de collecte lancé…');
        const run = await this.radar.tick({ reason: 'manual' });
        await reply(`Run ${esc(run.status)} : ${esc(JSON.stringify(run.summary))}`);
        return cmd;
      }
      case '/digest': {
        const r = await this.radar.exclusive(() => this.radar.dailyDigest({ force: true }));
        await reply(`Digest : ${esc(r)}`);
        return cmd;
      }
      case '/weekly': {
        await this.radar.exclusive(() => this.radar.weeklyReport());
        return cmd;
      }
      default:
        if (cmd.startsWith('/')) await reply(`Commande inconnue. ${helpMessage()}`);
        return 'ignored';
    }
  }

  async handleCallback(cq) {
    const chatId = cq.message?.chat?.id;
    const messageId = cq.message?.message_id;
    if (!this.authorized(chatId)) { await this.bot.answerCallback(cq.id, 'Non autorisé'); return 'unauthorized'; }
    const [action, reelId, extra] = String(cq.data || '').split(':');
    const reel = this.store.get('reels', reelId);
    const analysis = this.store.get('analyses', reelId);
    const reply = (t, opts) => this.bot.sendMessage(chatId, t, opts);
    if (!reel) { await this.bot.answerCallback(cq.id, 'Reel inconnu'); return 'unknown'; }
    switch (action) {
      case 'why':
        await this.bot.answerCallback(cq.id);
        await reply(analysis ? whyMessage(reel, analysis) : 'Analyse indisponible.');
        return action;
      case 'questions':
        await this.bot.answerCallback(cq.id);
        await reply(analysis ? questionsMessage(reel, analysis) : 'Analyse indisponible.');
        return action;
      case 'save':
        this.store.upsert('reels', { id: reelId, saved: true, saved_at: this.radar.ts() });
        await this.store.flush();
        await this.bot.answerCallback(cq.id, 'Sauvegardé');
        if (messageId) await this.bot.editKeyboard(chatId, messageId, reelKeyboard({ ...reel, saved: true }, { saved: true })).catch(() => {});
        return action;
      case 'ignore':
        this.store.upsert('reels', { id: reelId, status: 'ignored', saved: false, ignored_at: this.radar.ts() });
        await this.store.flush();
        await this.bot.answerCallback(cq.id, 'Ignoré');
        if (messageId) await this.bot.editKeyboard(chatId, messageId, [[{ text: '🗑 Ignoré', callback_data: `noop:${reelId}` }]]).catch(() => {});
        return action;
      case 'adapt': {
        if (!analysis) { await this.bot.answerCallback(cq.id, 'Analyse indisponible'); return action; }
        await this.bot.answerCallback(cq.id, 'Génération de l’adaptation…');
        const { idea, history, predictive } = await this.radar.adaptForSeven(reelId);
        await reply(sevenHistoryBlock(analysis, history, predictive));
        await reply(adaptationMessage(reel, idea), { keyboard: adaptKeyboard(reel) });
        return action;
      }
      case 'script': {
        await this.bot.answerCallback(cq.id, 'Script en cours…');
        const { idea } = await this.radar.adaptForSeven(reelId);
        await reply(`<b>📝 SCRIPT SEVEN</b>\n\n<b>Hook :</b> ${esc(idea.hook)}\n\n${esc(idea.script)}\n\n<b>CTA :</b> ${esc(idea.cta)}\n\n<i>Idée ${esc(idea.id)}</i>`, { keyboard: adaptKeyboard(reel) });
        return action;
      }
      case 'hook': {
        await this.bot.answerCallback(cq.id, 'Nouveaux hooks…');
        const previous = this.store.all('ideas').filter((i) => i.source_reel_id === reelId).flatMap((i) => (i.hooks || []).map((h) => h.text));
        const { idea } = await this.radar.adaptForSeven(reelId, { avoidHooks: previous.slice(-12) });
        await reply(`<b>🔁 AUTRES HOOKS</b>\n\n${idea.hooks.map((h, i) => `${i + 1}. ${esc(h.text)} <i>(${esc(h.hook_family)})</i>`).join('\n')}\n\n<b>Angle :</b> ${esc(idea.angle)}`, { keyboard: adaptKeyboard(reel) });
        return action;
      }
      case 'similar': {
        await this.bot.answerCallback(cq.id);
        const fam = analysis?.structure_family;
        const similar = this.store.all('reels').filter((r) => r.is_seven && r.structure_family && r.structure_family === fam);
        if (!similar.length) { await reply(`Aucun Reel Seven avec la structure ${esc(fam || 'n/d')} pour le moment.`); return action; }
        await reply(`<b>📚 REELS SEVEN SIMILAIRES — ${esc(fam)}</b>\n\n${similar.map((r, i) => reelLine(r, this.store.get('analyses', r.id), i + 1)).join('\n')}`);
        return action;
      }
      case 'link': {
        await this.bot.answerCallback(cq.id);
        const candidates = this.store.all('ideas').slice(-8);
        if (!candidates.length) { await reply('Aucune idée Seven enregistrée à lier. Utilisez /link R_SEVEN R_SOURCE.'); return action; }
        await reply(`Choisissez la source de ce Reel Seven :`, { keyboard: candidates.map((i) => [{ text: `${i.hook}`.slice(0, 60), callback_data: `linkto:${reelId}:${i.source_reel_id}` }]) });
        return action;
      }
      case 'linkto': {
        const ok = this.radar.linkSevenReel(reelId, extra);
        await this.store.flush();
        await this.bot.answerCallback(cq.id, ok ? 'Lié' : 'Échec');
        if (ok) await reply('🔗 Relation source → Reel Seven enregistrée. La comparaison sera intégrée au prochain calcul.');
        return action;
      }
      default:
        await this.bot.answerCallback(cq.id);
        return 'noop';
    }
  }

  async sendTop(chatId, { sinceHours, title, limit = 3 }) {
    const items = this.radar.topAnalyses({ sinceHours, limit });
    if (!items.length) {
      await this.bot.sendMessage(chatId, `${title}\n\nAucun Reel analysé sur la période.`);
      return;
    }
    await this.bot.sendMessage(chatId, `<b>${esc(title)}</b>\n\n${items.map(({ reel, analysis }, i) => reelLine(reel, analysis, i + 1)).join('\n')}`);
    for (const { reel, analysis } of items.slice(0, 3)) {
      await this.bot.sendMessage(chatId, alertMessage(reel, analysis, { title: `${analysis.conversation_score}/100 — @${reel.creator_username}` }), { keyboard: reelKeyboard(reel, { saved: reel.saved }) });
    }
  }
}

export const BOT_COMMANDS = [
  { command: 'today', description: 'Meilleurs Reels détectés aujourd’hui' },
  { command: 'week', description: 'Meilleurs Reels des 7 derniers jours' },
  { command: 'watchlist', description: 'Comptes surveillés' },
  { command: 'add', description: 'Ajouter un compte : /add @username' },
  { command: 'remove', description: 'Retirer un compte : /remove @username' },
  { command: 'analyze', description: 'Analyser un Reel : /analyze URL' },
  { command: 'saved', description: 'Contenus sauvegardés' },
  { command: 'settings', description: 'Paramètres principaux' },
  { command: 'status', description: 'État du système' },
  { command: 'seven', description: 'Boucle d’apprentissage Seven' },
  { command: 'run', description: 'Lancer un cycle de collecte' },
];

export function logUpdate(update) {
  log.debug('telegram update', { id: update.update_id, type: update.message ? 'message' : update.callback_query ? 'callback' : 'other' });
}
