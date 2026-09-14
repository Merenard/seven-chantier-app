# Mapping des champs Apify → modèle Radar

Statut : **PROVISOIRE — à confirmer par la sonde réelle** (`mode: probe` de l'Actor ou `npm run apify:probe`). Le mapping lit chaque champ à travers une liste de noms candidats (`src/apify/mapping.js`) ; un champ absent est stocké `null`, jamais inventé (§48).

## Reels — `apify/instagram-reel-scraper` (input `{ username: [...], resultsLimit }`)

| Champ Radar | Noms candidats (ordre) | Statut |
|---|---|---|
| instagram_media_id | id, pk, mediaId | à confirmer |
| shortcode | shortCode, shortcode, code | à confirmer |
| url | url, postUrl | à confirmer |
| caption | caption, text | à confirmer |
| transcript | transcript, videoTranscript | absent chez l'Actor officiel (attendu null) |
| published_at | timestamp, takenAtTimestamp | à confirmer |
| views | videoPlayCount, videoViewCount, playCount, viewCount | à confirmer (priorité au play count) |
| comments_count | commentsCount, commentCount | à confirmer |
| likes | likesCount, likeCount | stocké, hors score |
| shares | sharesCount, shareCount, reshareCount | souvent absent → null |
| duration | videoDuration, duration | à confirmer |
| creator_username | ownerUsername, owner.username | à confirmer |
| followers_count | ownerFollowersCount, owner.followersCount | souvent absent → profile-scraper |

## Commentaires — `apify/instagram-comment-scraper` (input `{ directUrls: [url], resultsLimit: 150, includeNestedComments: true }`)

| Champ Radar | Noms candidats | Statut |
|---|---|---|
| comment_id | id, pk | à confirmer |
| username | ownerUsername, owner.username | utilisé uniquement pour détecter le créateur, **non stocké** |
| text | text | à confirmer |
| timestamp | timestamp, createdAt | à confirmer |
| likes | likesCount, likeCount | à confirmer |
| reply_count | repliesCount, replyCount, childCommentCount | à confirmer |
| parent_comment_id | parentCommentId | posé par le mapping pour les réponses imbriquées |
| replies | replies, childComments | à confirmer |

## Post unitaire (`/analyze URL`) — `apify/instagram-scraper` (input `{ directUrls: [url], resultsType: 'posts' }`)

Mêmes candidats que les Reels.

## Procédure de validation

1. Lancer la sonde : `{"mode":"probe","usernames":["stephane.mdg"],"reelUrl":"https://www.instagram.com/reel/<code>/"}`.
2. Lire `OUTPUT.reels.raw_keys`, `OUTPUT.reels.unmapped`, `OUTPUT.comments.raw_keys`, `OUTPUT.comments.unmapped`.
3. Pour chaque champ `unmapped` : ajouter le vrai nom dans `src/apify/mapping.js`, relancer, puis figer ce document (remplacer « à confirmer » par « confirmé le <date> »).
