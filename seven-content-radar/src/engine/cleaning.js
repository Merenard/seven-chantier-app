// Anti-fake-engagement filter (spec §15). Purely rule based, runs before the
// AI classifier and its verdicts take precedence over the model's.

const EMOJI_ONLY = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}‍️\s!?.…]+$/u;
const MENTION_ONLY = /^(?:@[\w.]+\s*)+$/;
const URL = /(https?:\/\/|www\.)\S+/i;
const SPAM_PATTERNS = [
  /\b(dm|mp)\s*(me|moi)\b/i,
  /\b(crypto|forex|bitcoin|signal|trading)\b.*\b(profit|gagn|earn|garanti)/i,
  /\b(follow|abonne)[- ]?(back|toi|moi)\b/i,
  /\b(promo|discount|code)\s*[:=]?\s*[A-Z0-9]{4,}/,
  /\btelegram\b.*\b(join|rejoins|canal|channel)\b/i,
  /\b(whatsapp|wa\.me)\b/i,
];
const GIVEAWAY = /\b(concours|giveaway|tirage|gagner|cadeau|participe)\b/i;

// Words that a caption asks the audience to comment ("Écris GUIDE et je t'envoie...")
const CTA_VERBS = '(?:écris|ecris|écrivez|ecrivez|commente|commentez|comment|mets|met|tape|tapez|envoie|envoyez|write|type|drop)';

export function extractCtaKeywords(caption) {
  const text = String(caption || '');
  const keywords = new Set();
  // Explicit "commente GUIDE", "écris « INFO »", 'comment "LINK"'
  const re = new RegExp(`${CTA_VERBS}\\s*(?:le mot|the word|moi|-moi|nous)?\\s*[«"“'‘]?\\s*([A-Za-zÀ-ÿ0-9]{2,20})\\s*[»"”'’]?`, 'gi');
  let m;
  while ((m = re.exec(text)) !== null) {
    const w = m[1];
    if (/^(le|la|les|un|une|des|en|moi|nous|vous|ton|ta|tes|ci|dessous|dans|pour|sur|que|qui|et|the|your|below|in|a|an|si|ce|cette|ça|ca|je|tu|il|on)$/i.test(w)) continue;
    keywords.add(w.toUpperCase());
  }
  // Standalone uppercase tokens near a CTA verb ("Écris GUIDE en commentaire")
  const upper = text.match(/\b[A-Z]{3,15}\b/g) || [];
  if (new RegExp(CTA_VERBS, 'i').test(text)) {
    for (const w of upper) if (!/^(CTA|PDF|OK|USA|IA|AI)$/.test(w)) keywords.add(w);
  }
  return [...keywords];
}

export function normalizeText(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Returns the comment array annotated with rule verdicts:
// artificial_reason (string|null), is_creator, is_duplicate, organic (bool)
export function cleanComments(comments, { creatorUsername, caption } = {}) {
  const ctaWords = extractCtaKeywords(caption).map((w) => w.toLowerCase());
  const creator = String(creatorUsername || '').toLowerCase();
  const seen = new Map();
  const out = [];
  for (const c of comments) {
    const text = String(c.text || '').trim();
    const norm = normalizeText(text);
    const isCreator = !!creator && String(c.username || '').toLowerCase() === creator;
    let reason = null;
    if (!text) reason = 'empty';
    else if (EMOJI_ONLY.test(text)) reason = 'emoji_only';
    else if (MENTION_ONLY.test(text)) reason = 'mention_only';
    else if (ctaWords.length && ctaWords.includes(norm)) reason = 'cta_keyword';
    else if (ctaWords.length && norm.split(' ').length <= 3 && ctaWords.some((w) => norm.split(' ').includes(w))) reason = 'cta_keyword';
    else if (URL.test(text) && norm.split(' ').length <= 12) reason = 'spam_link';
    else if (SPAM_PATTERNS.some((p) => p.test(text))) reason = 'spam';
    else if (GIVEAWAY.test(text) && norm.split(' ').length <= 8) reason = 'giveaway';
    else if (norm.length > 0 && norm.split(' ').length <= 2 && /^(moi|me|info|guide|oui|yes|ok|top|first|premier|link|lien)$/.test(norm)) reason = 'low_value_token';

    let duplicate = false;
    if (!reason && norm.length >= 8) {
      const count = seen.get(norm) || 0;
      if (count >= 1) {
        duplicate = true;
        reason = 'duplicate';
      }
      seen.set(norm, count + 1);
    }

    out.push({
      ...c,
      text,
      is_creator: isCreator,
      is_duplicate: duplicate,
      artificial_reason: reason,
      // organic = an audience comment that can be used to measure conversation
      organic: !isCreator && !reason,
    });
  }
  return out;
}

export function cleaningSummary(cleaned) {
  const counts = {};
  for (const c of cleaned) {
    const k = c.is_creator ? 'creator_reply' : (c.artificial_reason || 'organic');
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
}
