import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanComments, extractCtaKeywords, cleaningSummary } from '../src/engine/cleaning.js';

test('§15 CTA keyword extracted from caption ("Écris GUIDE et je t’envoie le document")', () => {
  assert.deepEqual(extractCtaKeywords('Écris GUIDE et je t’envoie le document.'), ['GUIDE']);
  assert.ok(extractCtaKeywords('Commente « INFO » pour recevoir le lien').includes('INFO'));
  assert.ok(extractCtaKeywords('Comment "LINK" below and I will DM you').includes('LINK'));
  assert.deepEqual(extractCtaKeywords('Voici pourquoi le rendement compte plus que le prix.'), []);
});

test('§15 CTA comments, emoji, mentions, duplicates, spam and creator replies are neutralised', () => {
  const comments = [
    { comment_id: '1', username: 'a', text: 'GUIDE' },
    { comment_id: '2', username: 'b', text: 'guide 🙏' },
    { comment_id: '3', username: 'c', text: '🔥🔥🔥' },
    { comment_id: '4', username: 'd', text: '@paul @marie' },
    { comment_id: '5', username: 'e', text: 'Et si on dispose de 50 000 €, le raisonnement reste le même ?' },
    { comment_id: '6', username: 'f', text: 'Et si on dispose de 50 000 €, le raisonnement reste le même ?' },
    { comment_id: '7', username: 'creator', text: 'Oui exactement, même raisonnement.' },
    { comment_id: '8', username: 'g', text: 'DM me for crypto signals profit guaranteed' },
    { comment_id: '9', username: 'h', text: 'Je ne suis pas d’accord car tu oublies l’inflation.' },
    { comment_id: '10', username: 'i', text: 'MOI' },
  ];
  const cleaned = cleanComments(comments, { creatorUsername: 'creator', caption: 'Écris GUIDE et je t’envoie le document.' });
  const by = Object.fromEntries(cleaned.map((c) => [c.comment_id, c]));
  assert.equal(by['1'].artificial_reason, 'cta_keyword');
  assert.equal(by['2'].artificial_reason, 'cta_keyword');
  assert.equal(by['3'].artificial_reason, 'emoji_only');
  assert.equal(by['4'].artificial_reason, 'mention_only');
  assert.equal(by['5'].organic, true);
  assert.equal(by['6'].artificial_reason, 'duplicate');
  assert.equal(by['7'].is_creator, true);
  assert.equal(by['7'].organic, false);
  assert.equal(by['8'].artificial_reason, 'spam');
  assert.equal(by['9'].organic, true);
  assert.equal(by['10'].artificial_reason, 'low_value_token');
  const summary = cleaningSummary(cleaned);
  assert.equal(summary.organic, 2);
  assert.equal(summary.creator_reply, 1);
  assert.equal(summary.cta_keyword, 2);
});

test('§15 without a CTA in the caption, short words are not treated as CTA keywords', () => {
  const cleaned = cleanComments([{ comment_id: '1', username: 'a', text: 'Merci pour ce guide très clair' }], { creatorUsername: 'x', caption: 'Un Reel sans appel à mot-clé.' });
  assert.equal(cleaned[0].organic, true);
});
