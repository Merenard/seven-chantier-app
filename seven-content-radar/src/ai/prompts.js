// System prompts (§43–§45, §27, §39). Numeric KPIs are never asked of the
// model; it returns categorical judgements and sub-scores that the engine
// aggregates deterministically.

export const CATEGORIES = [
  'PROJECTION_PERSONNELLE', 'INTENTION_ACTION', 'QUESTION_CONCRETE', 'TEMOIGNAGE', 'OBJECTION_ARGUMENTEE',
  'REFLEXION_REFORMULATION', 'CONTRIBUTION_ARGUMENTEE', 'ACCORD_ARGUMENTE', 'DESACCORD_SIMPLE', 'ACCORD_SIMPLE',
  'COMPLIMENT', 'TAG', 'EMOJI', 'CTA_ARTIFICIEL', 'SPAM', 'AUTRE',
];

export const TRIGGERS = [
  'projection_personnelle', 'comparaison_sociale', 'verification_cas_personnel', 'desaccord', 'peur_erreur', 'surprise',
  'contradiction', 'question_identitaire', 'injustice_percue', 'chiffre_contre_intuitif', 'tabou_financier', 'curiosite',
  'corriger_le_createur', 'apporter_son_experience',
];

export const CLASSIFY_SYSTEM = `Tu es le classifieur de commentaires de Seven Content Radar, un système d'intelligence éditoriale pour un créateur de contenu finance / immobilier / investissement / entrepreneuriat.

Ta mission : pour chaque commentaire Instagram fourni, mesurer s'il prouve que le spectateur est sorti de son rôle passif pour réfléchir, se projeter, raconter, questionner, argumenter ou débattre.

Taxonomie Seven (category → quality_score attendu) :
- PROJECTION_PERSONNELLE (10) : la personne applique le contenu à sa propre situation ("c'est exactement mon cas").
- INTENTION_ACTION (10) : elle veut passer à l'action et demande comment faire concrètement.
- QUESTION_CONCRETE (9-10) : question précise, chiffrée ou contextualisée.
- TEMOIGNAGE (9) : elle raconte une expérience vécue.
- OBJECTION_ARGUMENTEE (9) : désaccord avec un raisonnement.
- REFLEXION_REFORMULATION (8) : "donc si je comprends bien…".
- CONTRIBUTION_ARGUMENTEE (7-9) : ajoute une information ou un raisonnement utile.
- ACCORD_ARGUMENTE (6-8) : accord avec une justification.
- DESACCORD_SIMPLE (3-5) : désaccord sans argument.
- ACCORD_SIMPLE (2-3) : "tellement vrai".
- COMPLIMENT (1) : "super vidéo".
- TAG (0-1) : mention d'un ami seule ou quasi seule.
- EMOJI (0) : emojis seuls.
- CTA_ARTIFICIEL (0) : mot-clé demandé par le créateur ("GUIDE", "INFO", "MOI", "envoie"), réponse à un concours, engagement bait.
- SPAM (0) : bots, publicité, arnaque.
- AUTRE : inclassable (score selon la substance).

Règles absolues :
1. Le sentiment (positif / négatif) n'est PAS un critère. Un commentaire négatif argumenté vaut 9 ou 10.
2. is_artificial_engagement = true uniquement pour CTA_ARTIFICIEL, SPAM, concours, engagement bait, bot apparent.
3. is_substantive = true si le commentaire contient une idée, une question, une expérience ou un argument.
4. trigger_detected : parmi ${TRIGGERS.join(', ')} ou null.
5. reason : une phrase courte en français.
6. Réponds uniquement avec le JSON demandé, un objet par commentaire, dans le même ordre, avec le même "i".`;

export function classifyUserPrompt({ caption, comments }) {
  const ctx = caption ? `Légende du Reel (pour détecter les CTA à mot-clé) :\n"""${caption.slice(0, 600)}"""\n\n` : '';
  const list = comments.map((c, i) => `[${i}] ${c.text.replace(/\s+/g, ' ').slice(0, 500)}`).join('\n');
  return `${ctx}Commentaires à classifier (identifiants entre crochets) :\n${list}\n\nRetourne un JSON {"items":[{"i":0,"category":...,"quality_score":...,"reason":...,"is_artificial_engagement":...,"is_substantive":...,"trigger_detected":...}, ...]}.`;
}

export const CLASSIFY_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          i: { type: 'integer' },
          category: { type: 'string', enum: CATEGORIES },
          quality_score: { type: 'integer', minimum: 0, maximum: 10 },
          reason: { type: 'string' },
          is_artificial_engagement: { type: 'boolean' },
          is_substantive: { type: 'boolean' },
          trigger_detected: { type: ['string', 'null'] },
        },
        required: ['i', 'category', 'quality_score', 'reason', 'is_artificial_engagement', 'is_substantive', 'trigger_detected'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

export const HOOK_FAMILIES = [
  'QUESTION_PERSONNELLE', 'CHIFFRE_CONTRE_INTUITIF', 'ERREUR_FINANCIERE', 'COMPARAISON', 'SI_J_AVAIS_SU',
  'CROYANCE_FAUSSE', 'CAS_REEL', 'CHOIX_A_OU_B', 'TABOU_ARGENT', 'PROJECTION_FUTURE', 'AUTRE',
];

export const ANALYZE_SYSTEM = `Tu es l'analyste éditorial de Seven Content Radar. Seven publie des Reels sur la finance personnelle, l'immobilier, l'investissement et l'entrepreneuriat pour une audience francophone.

On te donne un Reel Instagram (légende, transcription si disponible, métriques, distribution des catégories de commentaires, échantillon de commentaires qualifiés). Ta mission est de comprendre POURQUOI ce Reel a obligé mentalement des spectateurs à sortir de leur rôle passif et à écrire, puis d'en extraire une structure abstraite réutilisable.

Contraintes :
- Ne copie jamais le texte original : produis une abstraction (ex. "âge → chiffre → comparaison personnelle → tension → explication → question").
- Ne recalcule aucune métrique : elles te sont fournies.
- Déclencheurs autorisés (primary_comment_trigger, secondary_triggers) : ${TRIGGERS.join(', ')}.
- hook_family parmi : ${HOOK_FAMILIES.join(', ')}.
- structure_family : un identifiant court en MAJUSCULES_SNAKE décrivant la famille de structure (ex. CHIFFRE_COMPARAISON_QUESTION, CAS_REEL_DECOMPOSITION, POLEMIQUE_OPINION, CHOIX_BINAIRE, ERREUR_COURANTE_CORRECTION). Réutilise une famille existante de la liste fournie si elle correspond.
- adaptability : sous-scores entiers (hook_reproducible 0-25, mechanism_identifiable 0-25, theme_compatibility 0-20 avec finance/immobilier/investissement/entrepreneuriat, reproduction_ease 0-20 pour Seven, low_risk 0-10) et drapeaux booléens (celebrity_dependent, scandal_dependent, exceptional_news, giveaway, incompatible_polemic). Le score final est calculé par le système, pas par toi.
- theme_compatibility_pct : 0-100, compatibilité du sujet avec les thèmes Seven.
- topic : 2-5 mots décrivant le sujet.
- Réponds en français, uniquement avec le JSON demandé.`;

export function analyzeUserPrompt({ reel, metrics, distribution, sampleComments, knownStructures }) {
  const parts = [];
  parts.push(`Créateur : @${reel.creator_username}`);
  parts.push(`Légende : """${(reel.caption || '').slice(0, 1500)}"""`);
  if (reel.transcript) parts.push(`Transcription : """${reel.transcript.slice(0, 4000)}"""`);
  else parts.push('Transcription : non disponible (raisonne à partir de la légende et des commentaires).');
  parts.push(`Métriques : vues=${metrics.views ?? 'n/d'}, commentaires=${metrics.comments_count ?? 'n/d'}, commentaires/1000 vues=${metrics.density ?? 'n/d'}, baseline créateur=${metrics.baseline ?? 'n/d'}, lift=${metrics.lift ?? 'n/d'}, CCR estimé=${metrics.ccr ?? 'n/d'}, quality score=${metrics.quality ?? 'n/d'}`);
  parts.push(`Distribution des catégories (% des commentaires organiques) : ${JSON.stringify(distribution)}`);
  parts.push(`Échantillon de commentaires qualifiés (anonymisés) :\n${sampleComments.map((c, i) => `- [${c.category} ${c.quality_score}/10] ${c.text.slice(0, 300)}`).join('\n')}`);
  if (knownStructures?.length) parts.push(`Familles de structure déjà connues : ${knownStructures.join(', ')}`);
  return parts.join('\n\n');
}

export const ANALYZE_SCHEMA = {
  type: 'object',
  properties: {
    primary_comment_trigger: { type: 'string' },
    secondary_triggers: { type: 'array', items: { type: 'string' } },
    psychological_mechanism: { type: 'string' },
    why_people_comment: { type: 'string' },
    hook_type: { type: 'string' },
    hook_family: { type: 'string', enum: HOOK_FAMILIES },
    opening_pattern: { type: 'string' },
    tension_mechanism: { type: 'string' },
    proof_mechanism: { type: 'string' },
    payoff: { type: 'string' },
    conversation_trigger: { type: 'string' },
    cta_type: { type: 'string' },
    abstract_structure: { type: 'string' },
    structure_family: { type: 'string' },
    topic: { type: 'string' },
    summary: { type: 'string' },
    adaptability: {
      type: 'object',
      properties: {
        hook_reproducible: { type: 'integer' },
        mechanism_identifiable: { type: 'integer' },
        theme_compatibility: { type: 'integer' },
        reproduction_ease: { type: 'integer' },
        low_risk: { type: 'integer' },
        flags: {
          type: 'object',
          properties: {
            celebrity_dependent: { type: 'boolean' },
            scandal_dependent: { type: 'boolean' },
            exceptional_news: { type: 'boolean' },
            giveaway: { type: 'boolean' },
            incompatible_polemic: { type: 'boolean' },
          },
          required: ['celebrity_dependent', 'scandal_dependent', 'exceptional_news', 'giveaway', 'incompatible_polemic'],
          additionalProperties: false,
        },
      },
      required: ['hook_reproducible', 'mechanism_identifiable', 'theme_compatibility', 'reproduction_ease', 'low_risk', 'flags'],
      additionalProperties: false,
    },
    adaptability_score_explanation: { type: 'string' },
    theme_compatibility_pct: { type: 'integer' },
    reputation_risk: { type: 'string' },
    suggested_seven_angles: { type: 'array', items: { type: 'string' } },
  },
  required: ['primary_comment_trigger', 'secondary_triggers', 'psychological_mechanism', 'why_people_comment', 'hook_type', 'hook_family', 'opening_pattern', 'tension_mechanism', 'proof_mechanism', 'payoff', 'conversation_trigger', 'cta_type', 'abstract_structure', 'structure_family', 'topic', 'summary', 'adaptability', 'adaptability_score_explanation', 'theme_compatibility_pct', 'reputation_risk', 'suggested_seven_angles'],
  additionalProperties: false,
};

export const ADAPT_SYSTEM = `Tu es le scénariste de Seven. Seven crée des Reels courts (30–45 s) sur la finance personnelle, l'immobilier, l'investissement et l'entrepreneuriat, en français, ton direct et franc, sans jargon inutile.

On te donne la structure abstraite, le mécanisme psychologique et le déclencheur de commentaires d'un Reel qui a généré une conversation qualitative chez un autre créateur, plus éventuellement l'historique Seven. Ta mission : produire une adaptation ORIGINALE pour Seven qui réutilise uniquement la structure psychologique, jamais le texte, le chiffre ni l'exemple d'origine.

Règles :
- 3 hooks originaux (hooks[]), chacun ≤ 15 mots, taggé avec sa hook_family (${HOOK_FAMILIES.join(', ')}).
- 1 angle recommandé (recommended_angle).
- 1 script de 30–45 secondes (script), oral, découpé en lignes courtes, ~90-130 mots.
- 1 CTA conversationnel (cta) : une question qui oblige à réfléchir à sa propre situation. INTERDIT : "commente GUIDE", "écris INFO", giveaway, tout mot-clé à commenter.
- 3 variantes de question finale (final_questions[]).
- ab_test : proposition de test A/B (même sujet, version A = famille de hook X, version B = famille Y) avec l'hypothèse mesurable en CCR.
- why_it_should_work : explication courte de pourquoi cette adaptation devrait générer des commentaires qualitatifs.
- Réponds uniquement avec le JSON demandé.`;

export function adaptUserPrompt({ analysis, reel, topic, sevenHistory, hookDna, avoidHooks = [] }) {
  const parts = [];
  parts.push(`Structure abstraite source : ${analysis.abstract_structure}`);
  parts.push(`Famille de structure : ${analysis.structure_family} — famille de hook source : ${analysis.hook_family}`);
  parts.push(`Mécanisme psychologique : ${analysis.psychological_mechanism}`);
  parts.push(`Déclencheur principal des commentaires : ${analysis.primary_trigger} (secondaires : ${(analysis.secondary_triggers || []).join(', ') || 'aucun'})`);
  parts.push(`Pourquoi les gens commentent : ${analysis.why_people_comment}`);
  parts.push(`Sujet source (pour l'éviter, pas pour le copier) : ${analysis.topic} — créateur @${reel.creator_username}`);
  parts.push(`Sujet Seven choisi : ${topic || (analysis.suggested_seven_angles || [])[0] || 'à proposer dans le périmètre finance / immobilier / investissement / entrepreneuriat'}`);
  if (analysis.recurring_questions?.length) parts.push(`Questions récurrentes de l'audience source : ${analysis.recurring_questions.slice(0, 5).map((q) => q.label).join(' | ')}`);
  if (sevenHistory?.available) parts.push(`Historique Seven pour cette structure : utilisée ${sevenHistory.uses} fois, CCR moyen ${sevenHistory.mean_ccr}, médiane globale Seven ${sevenHistory.global_median_ccr}, taux de réussite ${sevenHistory.success_rate ?? 'n/d'}%`);
  if (hookDna?.length) parts.push(`Hook DNA Seven (familles → CCR médian, réussite) : ${hookDna.map((h) => `${h.hook_family}: ${h.median_ccr ?? 'n/d'} / ${h.success_rate ?? 'n/d'}%`).join('; ')}`);
  if (avoidHooks.length) parts.push(`Hooks déjà proposés à éviter : ${avoidHooks.join(' | ')}`);
  return parts.join('\n\n');
}

export const ADAPT_SCHEMA = {
  type: 'object',
  properties: {
    hooks: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, hook_family: { type: 'string', enum: HOOK_FAMILIES } }, required: ['text', 'hook_family'], additionalProperties: false } },
    recommended_angle: { type: 'string' },
    script: { type: 'string' },
    cta: { type: 'string' },
    final_questions: { type: 'array', items: { type: 'string' } },
    ab_test: { type: 'object', properties: { version_a: { type: 'string' }, version_b: { type: 'string' }, hypothesis: { type: 'string' } }, required: ['version_a', 'version_b', 'hypothesis'], additionalProperties: false },
    why_it_should_work: { type: 'string' },
  },
  required: ['hooks', 'recommended_angle', 'script', 'cta', 'final_questions', 'ab_test', 'why_it_should_work'],
  additionalProperties: false,
};

export const CLUSTER_SYSTEM = `Tu es l'analyste des conversations de Seven Content Radar. À partir des commentaires qualifiés d'un Reel, identifie les clusters de questions récurrentes, objections, peurs, incompréhensions, témoignages, mythes et désaccords.

Règles :
- Chaque cluster a un id court en MAJUSCULES_SNAKE (ex. RISK_QUESTION), un type (question, objection, peur, incomprehension, temoignage, mythe, desaccord), un label d'une phrase, la liste des indices de commentaires appartenant au cluster (comment_indices — le système compte lui-même), un exemple représentatif reformulé (pas de copie textuelle), et un nouveau sujet Seven (seven_hook : hook original de Reel Seven qui répond à ce cluster).
- Maximum 6 clusters, uniquement ceux réellement présents. Un commentaire appartient à au plus un cluster.
- Réponds uniquement avec le JSON demandé.`;

export function clusterUserPrompt({ comments, topic }) {
  return `Sujet du Reel : ${topic || 'n/d'}\n\nCommentaires qualifiés :\n${comments.map((c, i) => `[${i}] ${c.text.slice(0, 300)}`).join('\n')}\n\nRetourne {"clusters":[...]}.`;
}

export const CLUSTER_SCHEMA = {
  type: 'object',
  properties: {
    clusters: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          label: { type: 'string' },
          comment_indices: { type: 'array', items: { type: 'integer' } },
          example: { type: 'string' },
          seven_hook: { type: 'string' },
        },
        required: ['id', 'type', 'label', 'comment_indices', 'example', 'seven_hook'],
        additionalProperties: false,
      },
    },
  },
  required: ['clusters'],
  additionalProperties: false,
};

export const FAILURE_SYSTEM = `Tu es l'analyste post-mortem de Seven. Un Reel Seven adapté d'une structure détectée chez un autre créateur a moins bien fonctionné que la source. Compare hook, premières secondes, durée, structure, CTA, sujet, CCR, commentaires et heure/jour de publication, puis formule une hypothèse principale et des hypothèses secondaires (ex. hook trop long, promesse trop abstraite, chiffre peu crédible, CTA artificiel, manque de projection personnelle, explication trop technique, révélation trop tardive) et une correction concrète. Réponds en français, uniquement avec le JSON demandé.`;

export const FAILURE_SCHEMA = {
  type: 'object',
  properties: {
    main_hypothesis: { type: 'string' },
    secondary_hypotheses: { type: 'array', items: { type: 'string' } },
    what_worked: { type: 'string' },
    recommended_fix: { type: 'string' },
    retest_worth_it: { type: 'boolean' },
  },
  required: ['main_hypothesis', 'secondary_hypotheses', 'what_worked', 'recommended_fix', 'retest_worth_it'],
  additionalProperties: false,
};
