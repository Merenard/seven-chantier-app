# Preuves de tests — suite automatisée

Exécuté le 2026-09-14T03:52:30Z avec `npm test` (Node v22.22.2). Données fictives contrôlées, fakes Apify / IA / Telegram.

```
ok 1 - validate() rejects wrong enum, missing field, out-of-range score
ok 2 - extractJson tolerates fences and prose around the object
ok 3 - §50 invalid AI answer → retried once with a stricter reminder, then accepted
ok 4 - §50 invalid AI answer after all retries → comments left unclassified, no throw
ok 5 - batching: 90 comments → 3 calls of 40/40/10 and index mapping preserved
ok 6 - refusal stop reason is surfaced as invalid output
ok 7 - §15 CTA keyword extracted from caption ("Écris GUIDE et je t’envoie le document")
ok 8 - §15 CTA comments, emoji, mentions, duplicates, spam and creator replies are neutralised
ok 9 - §15 without a CTA in the caption, short words are not treated as CTA keywords
ok 10 - tick: new reels detected, existing reels never duplicated, T0 snapshot recorded
ok 11 - snapshots T+6h / T+24h / T+72h with deltas, T+7j only for the Seven account
ok 12 - full chain: pre-filter → comments → cleaning → classification → KPIs → alert → buttons
ok 13 - Telegram commands: /today /week /watchlist /add /remove /analyze /saved /settings /status /seven
ok 14 - daily digest: max 3 items, nothing sent when nothing is interesting, sent once per day
ok 15 - Apify failure on reels: tick still completes, error journaled, /status shows it
ok 16 - Apify failure on comments for one reel does not block the others
ok 17 - AI analysis failure: deterministic KPIs are still stored, ai_available=false, no crash
ok 18 - analysis cache: same comment dataset is not re-analysed
ok 19 - Seven loop: Seven reel analysed at T+24h, success vs median, source comparison, failure hypothesis, libraries
ok 20 - scheduled 07:00 Paris tick sends the digest, Monday adds the weekly report
ok 21 - §11 comment density: 963 comments / 74 800 views = 12.87 per 1000
ok 22 - §11 density is unavailable when views = 0 or unknown
ok 23 - §12 baseline = median of the last 20 exploitable reels, reliable from 8
ok 24 - §12 lift = 12.9 / 3.2 = 4.03
ok 25 - §13 pre-filter conditions
ok 26 - §17/§18 CCR estimation from a sample
ok 27 - §17 qualified comment = score ≥ 7 and not artificial
ok 28 - §19 quality score = mean/10×100 over organic audience comments only
ok 29 - §20 thread depth score does not reward creator-only replies
ok 30 - §28 category distribution groups
ok 31 - §21 cold-start normalisation and panel percentile switch at 30 reels
ok 32 - §21 conversation score weights 60/20/15/5
ok 33 - §22 adaptability score = sub-scores capped, penalties applied, never merged with conversation score
ok 34 - §29 sufficient data for an immediate alert
ok 35 - §10 snapshot deltas and velocity
ok 36 - §36 predictive score components and confidence tiers
ok 37 - stats helpers
ok 38 - HTTP: readiness, job auth, tick with wait, telegram webhook secret
# tests 38
# pass 38
# fail 0
```
