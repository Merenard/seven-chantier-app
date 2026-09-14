// Telegram message templates (§28, §41, digest, weekly). HTML parse mode.
import { esc } from './api.js';
import { fmtInt, fmtNum } from '../util/misc.js';

const GROUP_LABELS = {
  projection_personnelle: 'projection personnelle',
  questions_concretes: 'questions concrètes',
  debat_argumente: 'débat argumenté',
  temoignages: 'témoignages',
  faible_valeur: 'faible valeur',
};

export function reelKeyboard(reel, { saved = false } = {}) {
  const id = reel.id;
  return [
    [{ text: '▶️ VOIR LE REEL', url: reel.url }],
    [{ text: '🎯 ADAPTER À SEVEN', callback_data: `adapt:${id}` }],
    [{ text: '🧠 POURQUOI ÇA MARCHE', callback_data: `why:${id}` }, { text: '❓ VOIR LES QUESTIONS', callback_data: `questions:${id}` }],
    [{ text: saved ? '✅ GARDÉ' : '💾 GARDER', callback_data: `save:${id}` }, { text: '🗑 IGNORER', callback_data: `ignore:${id}` }],
  ];
}

export function adaptKeyboard(reel) {
  return [
    [{ text: '📝 CRÉER LE SCRIPT', callback_data: `script:${reel.id}` }],
    [{ text: '🔁 AUTRE HOOK', callback_data: `hook:${reel.id}` }, { text: '📚 REELS SEVEN SIMILAIRES', callback_data: `similar:${reel.id}` }],
  ];
}

export function alertMessage(reel, analysis, { title = '🔥 SEVEN RADAR — PÉPITE DÉTECTÉE' } = {}) {
  const g = analysis.distribution?.groups || {};
  const lines = [
    `<b>${esc(title)}</b>`,
    '',
    `@${esc(reel.creator_username)}`,
    '',
    `<b>Conversation Score :</b> ${analysis.conversation_score ?? 'n/d'}/100`,
    `<b>Adaptabilité Seven :</b> ${analysis.adaptability_score ?? 'n/d'}/100`,
    '',
    `Vues : ${fmtInt(analysis.views)}`,
    `Commentaires : ${fmtInt(analysis.comments_count)}`,
    `Commentaires / 1 000 vues : ${fmtNum(analysis.comment_density, 1)}`,
    `Baseline créateur : ${analysis.baseline_median !== null && analysis.baseline_median !== undefined ? fmtNum(analysis.baseline_median, 1) : 'n/d'}${analysis.baseline_reliable === false ? ' (provisoire)' : ''}`,
    `Lift : ${analysis.lift !== null && analysis.lift !== undefined ? `×${fmtNum(analysis.lift, 1)}` : 'n/d'}`,
    `CCR ${analysis.ccr_estimated ? 'estimé' : 'observé'} : ${fmtNum(analysis.ccr, 1)} commentaires qualifiés / 1 000 vues`,
    `Qualité des commentaires : ${analysis.quality_score !== null ? Math.round(analysis.quality_score) : 'n/d'}/100`,
    '',
    '<b>POURQUOI LES GENS COMMENTENT</b>',
    ...Object.entries(GROUP_LABELS).map(([k, label]) => `${g[k] ?? 0} % ${label}`),
    '',
    '<b>DÉCLENCHEUR PRINCIPAL</b>',
    esc(analysis.why_people_comment || analysis.primary_trigger || 'n/d'),
    '',
    '<b>MÉCANIQUE</b>',
    esc(analysis.abstract_structure || 'n/d'),
  ];
  if (analysis.calibration === 'cold_start') lines.push('', '<i>Normalisation provisoire (cold start, moins de 30 Reels analysés).</i>');
  return lines.join('\n');
}

export function whyMessage(reel, analysis) {
  const lines = [
    `<b>🧠 POURQUOI ÇA MARCHE — @${esc(reel.creator_username)}</b>`,
    '',
    `<b>Déclencheur principal :</b> ${esc(analysis.primary_trigger)}`,
    `<b>Déclencheurs secondaires :</b> ${esc((analysis.secondary_triggers || []).join(', ') || 'aucun')}`,
    '',
    `<b>Mécanisme psychologique</b>\n${esc(analysis.psychological_mechanism)}`,
    '',
    `<b>Pourquoi les gens commentent</b>\n${esc(analysis.why_people_comment)}`,
    '',
    '<b>Reverse engineering</b>',
    `• Hook : ${esc(analysis.hook_type)} (${esc(analysis.hook_family)})`,
    `• Ouverture : ${esc(analysis.opening_pattern)}`,
    `• Tension : ${esc(analysis.tension_mechanism)}`,
    `• Preuve : ${esc(analysis.proof_mechanism)}`,
    `• Payoff : ${esc(analysis.payoff)}`,
    `• Déclencheur de conversation : ${esc(analysis.conversation_trigger)}`,
    `• CTA : ${esc(analysis.cta_type)}`,
    '',
    `<b>Structure abstraite</b>\n${esc(analysis.abstract_structure)}`,
    '',
    `<b>Adaptabilité Seven : ${analysis.adaptability_score}/100</b>\n${esc(analysis.adaptability_explanation || '')}`,
    `Risque réputationnel : ${esc(analysis.reputation_risk || 'n/d')}`,
  ];
  if (analysis.suggested_seven_angles?.length) lines.push('', '<b>Angles Seven suggérés</b>', ...analysis.suggested_seven_angles.map((a) => `• ${esc(a)}`));
  return lines.join('\n');
}

export function questionsMessage(reel, analysis) {
  const clusters = analysis.recurring_questions || [];
  if (!clusters.length) return `<b>❓ QUESTIONS — @${esc(reel.creator_username)}</b>\n\nAucun cluster de questions/objections exploitable n'a été identifié sur ce Reel.`;
  const lines = [`<b>❓ QUESTIONS ET OBJECTIONS RÉCURRENTES — @${esc(reel.creator_username)}</b>`, ''];
  for (const c of clusters) {
    lines.push(`<b>${esc(c.id)}</b> (${esc(c.type)}) — ${c.count} commentaire${c.count > 1 ? 's' : ''}`);
    lines.push(esc(c.label));
    lines.push(`<i>Ex. : ${esc(c.example)}</i>`);
    lines.push(`→ Sujet Seven : ${esc(c.seven_hook)}`);
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function sevenHistoryBlock(analysis, history, predictive) {
  const lines = ['<b>🔥 PERFORMANCE HISTORIQUE CHEZ SEVEN</b>', '', `Structure : ${esc(analysis.abstract_structure)}`, ''];
  if (!history?.available) {
    lines.push('Cette structure n\'a pas encore été utilisée sur le compte Seven.');
  } else {
    lines.push(`Utilisée : ${history.uses} fois`);
    lines.push(`CCR moyen Seven : ${fmtNum(history.mean_ccr, 1)}`);
    lines.push(`Médiane Seven globale : ${fmtNum(history.global_median_ccr, 1)}`);
    lines.push(`Surperformance historique : ${history.overperformance !== null ? `×${fmtNum(history.overperformance, 1)}` : 'n/d'}`);
    lines.push(`Seven Success Rate : ${history.success_rate !== null && history.success_rate !== undefined ? `${history.success_rate} %` : 'n/d'}`);
  }
  if (predictive) {
    lines.push('', `Predictive Score : ${predictive.score}/100`, `Confiance : ${predictive.confidence}`);
  }
  return lines.join('\n');
}

export function adaptationMessage(reel, idea) {
  const lines = [
    `<b>🎯 ADAPTATION SEVEN — inspirée de @${esc(reel.creator_username)}</b>`,
    '',
    '<b>3 hooks originaux</b>',
    ...idea.hooks.map((h, i) => `${i + 1}. ${esc(h.text)} <i>(${esc(h.hook_family)})</i>`),
    '',
    `<b>Angle recommandé</b>\n${esc(idea.recommended_angle)}`,
    '',
    `<b>Script 30–45 s</b>\n${esc(idea.script)}`,
    '',
    `<b>CTA conversationnel</b>\n${esc(idea.cta)}`,
    '',
    '<b>Questions finales</b>',
    ...idea.final_questions.map((q) => `• ${esc(q)}`),
    '',
    `<b>Test A/B recommandé</b>\nA : ${esc(idea.ab_test.version_a)}\nB : ${esc(idea.ab_test.version_b)}\nHypothèse : ${esc(idea.ab_test.hypothesis)}`,
    '',
    `<b>Pourquoi ça devrait générer des commentaires qualitatifs</b>\n${esc(idea.why_it_should_work)}`,
    '',
    `<i>Idée ${esc(idea.id)} enregistrée. Rien n'est publié automatiquement.</i>`,
  ];
  return lines.join('\n');
}

export function reelLine(reel, analysis, i) {
  const s = analysis?.conversation_score ?? '–';
  const a = analysis?.adaptability_score ?? '–';
  return `${i}. @${esc(reel.creator_username)} — Conv. ${s}/100 · Adapt. ${a}/100 · ${fmtNum(analysis?.comment_density, 1)} comm./1k vues · <a href="${esc(reel.url)}">voir</a>`;
}

export function digestMessage(items, { title = '☀️ SEVEN RADAR — DIGEST DU JOUR' } = {}) {
  const lines = [`<b>${esc(title)}</b>`, ''];
  items.forEach(({ reel, analysis }, i) => {
    lines.push(reelLine(reel, analysis, i + 1));
    lines.push(`   ${esc(analysis.why_people_comment || '')}`.slice(0, 220));
    lines.push('');
  });
  return lines.join('\n').trim();
}

export function weeklyMessage(report) {
  const L = [`<b>📊 SEVEN RADAR — RAPPORT HEBDOMADAIRE</b>`, `<i>${esc(report.period)}</i>`, ''];
  L.push('<b>TOP 10 REELS CONVERSATIONNELS</b>');
  if (!report.topReels.length) L.push('Aucun Reel analysé cette semaine.');
  report.topReels.forEach(({ reel, analysis }, i) => L.push(reelLine(reel, analysis, i + 1)));
  const section = (title, rows, fmt) => {
    L.push('', `<b>${title}</b>`);
    if (!rows.length) L.push('n/d');
    rows.forEach((r) => L.push(fmt(r)));
  };
  section('TOP STRUCTURES', report.topStructures, (r) => `• ${esc(r.structure_family)} — score médian ${r.median_score ?? 'n/d'}, ${r.occurrences} Reel(s), ${r.creators_count} créateur(s)${r.creators_count >= 2 ? ' ⭐ multi-créateurs' : ''}`);
  section('TOP DÉCLENCHEURS PSYCHOLOGIQUES', report.topTriggers, (r) => `• ${esc(r.name)} — ${r.count} Reel(s), score médian ${r.median_score ?? 'n/d'}`);
  section('TOP HOOKS', report.topHooks, (r) => `• ${esc(r.hook_family)} — ${r.count} Reel(s), score médian ${r.median_score ?? 'n/d'}`);
  section('QUESTIONS LES PLUS FRÉQUENTES', report.topQuestions, (r) => `• ${esc(r.label)} (${r.count})`);
  section('NOUVELLES IDÉES SEVEN', report.newIdeas, (r) => `• ${esc(r.hook)}`);
  section('CRÉATEURS LES PLUS INTÉRESSANTS', report.topCreators, (r) => `• @${esc(r.username)} — ${r.count} Reel(s) analysé(s), score médian ${r.median_score ?? 'n/d'}`);
  section('STRUCTURES PERFORMANTES CHEZ PLUSIEURS CRÉATEURS', report.crossCreatorStructures, (r) => `• ${esc(r.structure_family)} — ${r.creators_count} créateurs, CCR médian ${fmtNum(r.median_source_ccr, 1)}${r.median_seven_ccr !== null ? `, CCR Seven ${fmtNum(r.median_seven_ccr, 1)}` : ''} → ${esc(r.priority)}`);
  if (report.sevenSection) {
    L.push('', '<b>BOUCLE SEVEN (@' + esc(report.sevenSection.handle) + ')</b>');
    L.push(`Reels Seven analysés : ${report.sevenSection.count} · CCR médian ${fmtNum(report.sevenSection.median_ccr, 1)} · seuil de réussite ${fmtNum(report.sevenSection.threshold, 1)}`);
    report.sevenSection.matrix.forEach((r) => L.push(`• ${esc(r.structure_family)} — créateurs ${esc(r.ccr_creators_level || 'n/d')} / Seven ${esc(r.ccr_seven_level || 'n/d')} / répétabilité ${esc(r.repeatability)} → <b>${esc(r.priority)}</b>`));
  }
  return L.join('\n');
}

export function statusMessage(s) {
  const L = ['<b>⚙️ SEVEN CONTENT RADAR — ÉTAT</b>', ''];
  L.push(`Dernier run : ${s.lastRun ? `${esc(s.lastRun.finished_at || s.lastRun.started_at)} (${esc(s.lastRun.status)})` : 'jamais'}`);
  if (s.lastRun?.summary) L.push(`  ${esc(JSON.stringify(s.lastRun.summary))}`);
  L.push(`Créateurs surveillés : ${s.creators}`);
  L.push(`Reels connus : ${s.reels} · analysés : ${s.analyses} · Seven : ${s.sevenReels}`);
  L.push(`Idées générées : ${s.ideas} · sauvegardés : ${s.saved}`);
  L.push(`Calibration : ${s.calibration}`);
  L.push(`Erreurs (24 h) : ${s.errors24h}`);
  if (s.recentErrors?.length) {
    L.push('', '<b>Dernières erreurs</b>');
    s.recentErrors.forEach((e) => L.push(`• ${esc(e.ts)} [${esc(e.stage)}] ${esc(e.message).slice(0, 160)}`));
  }
  L.push('', `Prochains runs (Europe/Paris) : ${s.schedule.join(', ')}`);
  return L.join('\n');
}

export function settingsMessage(settings, cfg) {
  return [
    '<b>⚙️ PARAMÈTRES</b>', '',
    `Compte Seven : @${esc(cfg.sevenHandle)}`,
    `Fuseau : ${cfg.timezone}`,
    `Runs : ${cfg.schedule.join(' · ')}`,
    `Digest quotidien : ${String(cfg.digestHourParis).padStart(2, '0')}:00 (max ${cfg.thresholds.digestMaxItems}, score ≥ ${cfg.thresholds.digestMinScore})`,
    `Alerte immédiate : score ≥ ${cfg.thresholds.immediateAlertScore}`,
    `Pré-filtre : ≥ ${cfg.thresholds.prefilterMinComments} commentaires ou lift ≥ ${cfg.thresholds.prefilterLiftMin}× ou top ${Math.round(cfg.thresholds.prefilterTopPanelShare * 100)} % du panel`,
    `Baseline : médiane des ${cfg.thresholds.baselineWindow} derniers Reels (min ${cfg.thresholds.baselineMinReels})`,
    `Commentaires par Reel : ${cfg.apify.commentsPerReel}`,
    `Alertes : ${settings.alerts_enabled === false ? 'désactivées' : 'activées'}`,
    '',
    '<i>Modifier : /settings alerts on|off</i>',
  ].join('\n');
}

export function helpMessage() {
  return [
    '<b>Seven Content Radar</b>', '',
    '/today — meilleurs Reels détectés aujourd\'hui',
    '/week — meilleurs Reels des 7 derniers jours',
    '/watchlist — comptes surveillés',
    '/add @username — ajouter un compte',
    '/remove @username — retirer un compte',
    '/analyze URL — analyser un Reel immédiatement',
    '/saved — contenus sauvegardés',
    '/settings — paramètres principaux',
    '/status — état du système',
    '/seven — boucle d\'apprentissage Seven (success rate, Hook DNA, matrice)',
    '/run — lancer un cycle de collecte maintenant',
  ].join('\n');
}
