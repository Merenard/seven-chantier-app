# Seven Content Radar

Système d'intelligence éditoriale propriétaire : veille Instagram conversationnelle (Apify), analyse qualitative des commentaires (Claude), scoring déterministe, adaptation éditoriale Seven, piloté depuis Telegram.

État : **moteur complet construit et testé hors ligne (38 tests, données fictives contrôlées). Le test réel de bout en bout (§51) reste à exécuter** : il exige les tokens Apify / Telegram / Anthropic et un accès réseau vers ces plateformes depuis l'environnement d'exécution (voir « Reste à faire » en bas).

---

## 1. Architecture réellement construite

```
Instagram public
   → Apify  (apify/instagram-reel-scraper, apify/instagram-comment-scraper, apify/instagram-scraper)
   → Radar Engine  (Node 22, ce dépôt — déployé comme Actor Apify en mode Standby)
        ├─ stockage persistant : Apify Key-Value Store nommé « seven-content-radar » (une clé JSON par collection)
        ├─ moteur IA : Claude (claude-opus-5 analyse/adaptation, claude-sonnet-5 classification en lot) — sorties JSON strictes validées
        ├─ calculs : 100 % déterministes dans src/engine/scoring.js (jamais confiés au LLM)
        └─ HTTP : /telegram (webhook), /jobs/tick|digest|weekly (ordonnanceur), /jobs/status
   → Telegram  (bot « Seven Content Radar », inline keyboards + callback queries)
Make : scénario Scheduler (07:00 / 13:00 / 19:00 / 23:00 Europe/Paris → POST /jobs/tick), blueprint importable dans make/.
```

Décision d'architecture (franche) : la logique métier ne vit **pas** dans des dizaines de modules Make. Médianes, percentiles, nettoyage de 150 commentaires, calibrage, boucle Seven… en Make, ce serait 10+ scénarios fragiles et des milliers d'opérations par jour. Le moteur est un seul processus Node, testable, versionné, hébergé sur Apify (plateforme déjà nécessaire). Make garde le rôle qui lui va bien : **ordonnanceur + journal** (et, en option, relais du webhook Telegram). Zéro perte fonctionnelle par rapport au cahier des charges ; gain massif en fiabilité et en coût.

Un seul processus écrit dans le stockage (mode Standby) ; les jobs planifiés appellent l'instance Standby par HTTP (`mode: trigger` de l'Actor, ou Make). Tous les jobs sont sérialisés (`Radar.exclusive`).

## 2. Arborescence

| Fichier | Rôle |
|---|---|
| `src/config.js` | constantes, seuils, poids, watchlist initiale, `SEVEN_INSTAGRAM_HANDLE = stephane.mdg` |
| `src/engine/scoring.js` | **toutes les formules** (§11–§22, §29, §36) |
| `src/engine/cleaning.js` | filtre anti-faux-engagement (§15) |
| `src/engine/seven.js` | Seven Success Rate, Predictive Score, Hook DNA Seven, bibliothèque de structures, matrice (§31–§38) |
| `src/engine/radar.js` | orchestrateur : tick, snapshots, pré-filtre, analyse, alertes, digest, hebdo, boucle Seven, adaptation |
| `src/apify/mapping.js` / `client.js` / `probe.js` | mapping des champs avec noms candidats, appels Actors avec retry, sonde réelle (§48) |
| `src/ai/prompts.js` / `client.js` | 5 prompts système + schémas JSON ; validation + retry des sorties invalides |
| `src/telegram/api.js` / `format.js` / `handlers.js` | Bot API, gabarits de messages (§28, §41), commandes et boutons |
| `src/server.js`, `src/main.js`, `src/cli.js` | serveur HTTP, entrée Actor Apify, CLI locale |
| `make/*.blueprint.json` | scénarios Make importables |
| `test/` | 38 tests (`npm test`) — voir `docs/TEST_EVIDENCE.md` |
| `scripts/e2e.js` | **test réel de bout en bout** (§51) |

## 3. Modèle de données (collections du Key-Value Store)

`creators` (creator_id=username, active, date_added, baseline_comment_density, baseline_count, baseline_reliable, reels_analyzed, is_seven) · `reels` (id court `R_XXXXXXXX`, instagram_media_id, shortcode, url, creator_username, caption, transcript, published_at, first_seen, views, comments_count, likes, shares, duration, followers_count, status new|candidate|analyzed|ignored|error, saved, conversation_score, adaptability_score, predictive_score, structure_family, hook_family, source_inspiration_reel_id, script_id) · `snapshots` (reel_id, checkpoint T0/T+6h/T+24h/T+72h/T+168h, timestamp, views, comments_count, comment_density, delta_views, delta_comments, comments_velocity) · `comments` (reel_id, text, quality_category, quality_score, artificial_engagement, reply_count, likes — **sans username**) · `analyses` (tous les KPI + sortie IA, `dataset_hash` pour le cache) · `ideas` (source_reel_id, hooks, angle, script, cta, final_questions, ab_test, status proposed|published) · `structure_library` · `hook_dna_seven` · `clusters` · `errors` · `runs` · `alerts` · `settings`.

Identifiant primaire d'un Reel : `instagram_media_id`, fallback `shortcode`, fallback URL. Dédoublonnage testé.

## 4. Formules implémentées

| KPI | Formule | Code |
|---|---|---|
| Commentaires / 1 000 vues | `comments / views × 1000` ; `null` si views = 0 | `commentDensity` |
| Baseline créateur | médiane des 20 derniers Reels exploitables (views > 0), fiable à partir de 8 | `creatorBaseline` |
| Lift | `density / baseline` | `lift` |
| Pré-filtre | ≥ 30 commentaires (Reel ≤ 72 h) **ou** lift ≥ 1,5 (baseline fiable) **ou** top 30 % du panel (Reel ≤ 72 h, panel ≥ 10) **ou** z-score robuste (MAD) ≥ 2,5 ; `/analyze` ignore le filtre ; max 6 analyses par run, priorisées par lift × densité | `prefilter`, `selectCandidates` |
| Commentaire qualifié | `quality_score ≥ 7 && !is_artificial_engagement` | `isQualified` |
| CCR | `qualified_ratio = qualifiés / organiques analysés` ; `audience = comments_count × (1 − part des réponses du créateur dans l'échantillon)` ; `CCR = audience × ratio / views × 1000` ; flag `ccr_estimated` dès que l'échantillon < audience, affiché « CCR estimé » | `ccr` |
| Quality Score | `moyenne(quality_score) / 10 × 100` sur les organiques (spam, artificiels, doublons, réponses créateur exclus) | `qualityScore` |
| Thread Depth | `50·min(1, %avec réponses/0,3) + 30·min(1, réponses moy./1,5) + 20·min(1, fils multi-participants/0,1)` ; réponses du créateur comptées ×0,5 | `threadDepthScore` |
| Conversation Score | `0,60·Quality + 0,20·norm(CCR) + 0,15·norm(Lift) + 0,05·Depth` ; cold start : ancres linéaires (CCR 0→0, 2→55, 6→88, 10→100 ; Lift 1→25, 2→60, 3→78, 5→92) ; ≥ 30 Reels analysés : rang percentile du panel ; composante manquante → repondération, jamais de modification des données brutes | `conversationScore` |
| Adaptability Score | somme des sous-scores IA plafonnés (25/25/20/20/10) − pénalités déterministes (célébrité −15, scandale −20, actualité −15, giveaway −25, polémique −25), borné 0–100, **jamais fusionné** avec le Conversation Score | `adaptabilityScore` |
| Alerte immédiate | score ≥ 90 **et** ≥ 30 commentaires organiques analysés **et** ≥ 3 000 vues ; une seule fois par Reel | `maybeImmediateAlert` |
| Digest | 07:00 Paris, max 3, score ≥ 70, hors Reels déjà alertés, rien si vide | `dailyDigest` |
| Réussite Seven | CCR > médiane des 20 derniers Reels Seven | `sevenSuccessThreshold` |
| Predictive Score | `0,30·score source + 0,25·historique structure Seven + 0,20·qualité source + 0,15·famille de hook Seven + 0,10·compatibilité thème` ; confiance FAIBLE < 20 Reels Seven, MOYENNE 20–49, ÉLEVÉE ≥ 50 | `predictiveScore` |
| Matrice structure × audience | niveaux relatifs aux médianes (≥1,8× très élevé, ≥1,2× élevé, ≥0,8× moyen) ; répétabilité par nombre de créateurs ; priorité PRIORITAIRE / À TESTER / FAIBLE / ÉVITER | `buildStructureLibrary` |

Snapshots : à chaque run, tout checkpoint atteint (âge ≥ 6 h / 24 h / 72 h, + 168 h pour @stephane.mdg) et non encore enregistré est capturé avec les métriques du run, avec deltas et vélocité (commentaires/heure). Les Reels Seven sont analysés à T+24 h dès 5 commentaires, sans pré-filtre.

## 5. Prompts IA (src/ai/prompts.js)

1. **Classification des commentaires** (§43) — taxonomie Seven complète, règle « le sentiment n'est pas un critère », `is_artificial_engagement`, `trigger_detected`, lots de 40, sortie `{items:[{i, category, quality_score, reason, is_artificial_engagement, is_substantive, trigger_detected}]}`.
2. **Analyse du Reel** (§44) — entrées : légende, transcription si disponible, métriques calculées, distribution, échantillon de commentaires qualifiés anonymisés, familles connues ; sortie : déclencheurs, mécanisme, reverse engineering (hook_type, opening_pattern, tension, preuve, payoff, conversation_trigger, cta_type), `abstract_structure`, `structure_family`, `hook_family`, sous-scores d'adaptabilité + drapeaux de risque, angles Seven.
3. **Adaptation Seven** (§45) — 3 hooks originaux taggés par famille, angle, script 30–45 s, CTA conversationnel (mots-clés interdits), 3 questions finales, **test A/B recommandé** (§40), justification ; interdiction de copier la source ; historique Seven et Hook DNA injectés (§41).
4. **Clusters de questions/objections** (§27) — le modèle attribue des indices, **le code compte**.
5. **Hypothèse d'échec** (§39) — comparaison source vs Reel Seven sous-performant (CCR < 70 % de la source).

Toute sortie est validée contre un schéma JSON ; une sortie invalide déclenche un rappel strict puis un nouvel essai (2 retries) ; un lot de classification définitivement invalide laisse les commentaires non classés sans casser l'analyse. Aucun identifiant de commentateur ni aucun secret n'est envoyé au modèle.

## 6. Telegram

Commandes : `/today`, `/week`, `/watchlist`, `/add @u`, `/remove @u` (le compte Seven est protégé), `/analyze URL`, `/saved`, `/settings` (+ `/settings alerts on|off`), `/status`, `/seven` (success rate, Hook DNA, matrice), `/link R_SEVEN R_SOURCE`, `/run`, `/digest`, `/weekly`, `/help`. Le bot n'obéit qu'au `TELEGRAM_CHAT_ID` configuré.

Boutons de chaque carte Reel : `VOIR LE REEL` (URL) · `ADAPTER À SEVEN` (`adapt:R_x`) · `POURQUOI ÇA MARCHE` (`why:R_x`) · `VOIR LES QUESTIONS` (`questions:R_x`) · `GARDER` (`save:R_x`, le clavier passe à « GARDÉ ») · `IGNORER` (`ignore:R_x`).
Après ADAPTER À SEVEN : bloc « PERFORMANCE HISTORIQUE CHEZ SEVEN » (utilisations, CCR moyen, médiane Seven, surperformance, success rate, predictive score, confiance) puis l'adaptation, avec `CRÉER LE SCRIPT` · `AUTRE HOOK` (évite les hooks déjà proposés) · `VOIR LES REELS SEVEN SIMILAIRES`. Les Reels Seven analysés reçoivent un bouton `LIER À UNE SOURCE`. Rien n'est jamais publié automatiquement.

## 7. Gestion des erreurs

Retry exponentiel sur Apify (2 relances, 5 s ×2), Anthropic (429/5xx/réseau + sorties invalides), Telegram (4 relances, 4xx non relancés). Journal `errors` (300 dernières) visible dans `/status`. Un échec Apify sur la collecte n'empêche ni les snapshots ni les analyses ; un Reel dont le scraping échoue (supprimé, privé) passe en `status: error` sans bloquer les autres ; views = 0 → densité « n/d » ; IA indisponible → KPI déterministes stockés avec `ai_available: false` ; format Apify modifié → champs `null` + sonde `npm run apify:probe` ; cache d'analyse par hash du dataset (jamais de réanalyse identique) ; Telegram répond 200 immédiatement au webhook et traite en arrière-plan (pas de doublon sur retry) ; secret sur le webhook et sur `/jobs/*`.

## 8. Déploiement

1. **Secrets** (jamais dans le code) : `APIFY_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ANTHROPIC_API_KEY`, `RADAR_JOBS_SECRET` (chaîne aléatoire), `TELEGRAM_WEBHOOK_SECRET` (chaîne aléatoire). Sur Apify : Actor → Settings → Environment variables (cocher *Secret*).
2. **Bot** : @BotFather → `/newbot` → nom « Seven Content Radar » → token. Envoyer un message au bot puis récupérer le chat id (`/status` répond « Ce bot est privé. Votre chat id : … » avant configuration).
3. **Actor** : `apify push` depuis ce dossier (ou Actor depuis GitHub, dossier `seven-content-radar`). Standby activé (`.actor/actor.json`). URL standby : `https://<username>--seven-content-radar.apify.actor`.
4. **Sonde réelle** : run de l'Actor avec `{"mode":"probe","usernames":["stephane.mdg"],"reelUrl":"<un Reel>"}` → sortie `OUTPUT` = clés réelles + champs non mappés → mettre à jour `docs/APIFY_MAPPING.md` et, si besoin, `src/apify/mapping.js`.
5. **Webhook + commandes** : run `{"mode":"setup"}` avec `RADAR_STANDBY_URL` renseigné → `setWebhook`, `setMyCommands`, message de bienvenue.
6. **Planification** : Make → importer `make/scenario-scheduler.blueprint.json`, remplir URL + secret, planifier 07:00/13:00/19:00/23:00 Europe/Paris. Alternative sans Make : Apify Schedule 4×/jour lançant l'Actor avec `{"mode":"trigger","job":"tick"}`.
7. **Test réel** : `node scripts/e2e.js <url de Reel>` (voir §10).

Local : `cp .env.example .env` n'existe pas volontairement — exporter les variables, puis `npm run poll` (long polling Telegram, aucune URL publique) et `npm run tick`.

## 9. Coûts (ordre de grandeur)

Collecte : 1 run Apify reel-scraper × 15 comptes × 4/jour (≈ 0,5–1 $/jour). Commentaires : uniquement les candidats (≤ 6/run). IA : ≈ 150 commentaires classés (sonnet-5, ~0,05 $) + 1 analyse + 1 clustering (opus-5, ~0,15 $) par Reel candidat ; adaptation ≈ 0,10 $. Budget typique : 3–8 $/jour selon l'activité du panel.

## 10. Reste à faire (bloqué par des éléments externes)

- Test réel §51 : nécessite les 4 tokens ci-dessus **et** un environnement d'où `api.apify.com`, `api.telegram.org` et `*.make.com` sont joignables. Procédure : `scripts/e2e.js` (écrit `data/e2e-evidence.json` et `data/apify-probe.json`).
- `docs/APIFY_MAPPING.md` : à figer à partir de la sonde réelle.
- Transcription : non fournie par les Actors officiels ; le champ `transcript` est prévu (`APIFY_TRANSCRIPT_ACTOR` à brancher si souhaité). L'analyse fonctionne à partir de la légende + commentaires.
