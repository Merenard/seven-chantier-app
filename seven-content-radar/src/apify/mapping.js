// Field mapping between Apify actor outputs and the Radar data model.
// Actors evolve: every field is read through a list of candidate names, and
// `npm run apify:probe` dumps the real keys so docs/APIFY_MAPPING.md can be
// kept truthful. A missing field is stored as null — never invented.

const pick = (obj, names) => {
  for (const n of names) {
    const v = n.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
};
const num = (v) => {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const iso = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v).toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export const REEL_FIELDS = {
  instagram_media_id: ['id', 'pk', 'mediaId', 'media_id'],
  shortcode: ['shortCode', 'shortcode', 'code'],
  url: ['url', 'postUrl', 'link'],
  caption: ['caption', 'text', 'title'],
  transcript: ['transcript', 'videoTranscript', 'audioTranscript'],
  published_at: ['timestamp', 'takenAtTimestamp', 'taken_at', 'publishedAt'],
  views: ['videoPlayCount', 'videoViewCount', 'playCount', 'viewCount', 'plays', 'views', 'igPlayCount'],
  comments_count: ['commentsCount', 'commentCount', 'comment_count', 'comments'],
  likes: ['likesCount', 'likeCount', 'like_count', 'likes'],
  shares: ['sharesCount', 'shareCount', 'reshareCount', 'share_count'],
  duration: ['videoDuration', 'duration', 'video_duration'],
  creator_username: ['ownerUsername', 'owner.username', 'username', 'user.username'],
  followers_count: ['ownerFollowersCount', 'owner.followersCount', 'followersCount'],
  type: ['type', 'productType', 'product_type', 'mediaType'],
};

export const COMMENT_FIELDS = {
  comment_id: ['id', 'pk', 'commentId'],
  username: ['ownerUsername', 'owner.username', 'username', 'user.username'],
  text: ['text', 'comment', 'content'],
  timestamp: ['timestamp', 'createdAt', 'created_at', 'takenAt'],
  likes: ['likesCount', 'likeCount', 'like_count', 'likes'],
  reply_count: ['repliesCount', 'replyCount', 'childCommentCount', 'child_comment_count'],
  parent_comment_id: ['parentCommentId', 'parent_comment_id', 'parentId'],
  replies: ['replies', 'childComments', 'child_comments'],
};

export const PROFILE_FIELDS = {
  username: ['username', 'userName'],
  followers_count: ['followersCount', 'followerCount', 'followers', 'edge_followed_by.count'],
};

export function mapReel(item) {
  const r = {};
  for (const [k, names] of Object.entries(REEL_FIELDS)) r[k] = pick(item, names);
  r.published_at = iso(r.published_at);
  for (const k of ['views', 'comments_count', 'likes', 'shares', 'duration', 'followers_count']) r[k] = num(r[k]);
  if (r.instagram_media_id !== null) r.instagram_media_id = String(r.instagram_media_id);
  if (!r.url && r.shortcode) r.url = `https://www.instagram.com/reel/${r.shortcode}/`;
  if (r.creator_username) r.creator_username = String(r.creator_username).toLowerCase();
  const t = String(r.type || '').toLowerCase();
  r.is_video = t === '' ? null : /video|reel|clips|igtv/.test(t);
  return r;
}

export function mapComment(item, depth = 0) {
  const c = {};
  for (const [k, names] of Object.entries(COMMENT_FIELDS)) c[k] = pick(item, names);
  c.timestamp = iso(c.timestamp);
  c.likes = num(c.likes);
  c.reply_count = num(c.reply_count);
  if (c.comment_id !== null) c.comment_id = String(c.comment_id);
  if (c.parent_comment_id !== null) c.parent_comment_id = String(c.parent_comment_id);
  if (c.username) c.username = String(c.username).toLowerCase();
  c.text = c.text === null ? '' : String(c.text);
  const replies = Array.isArray(c.replies) ? c.replies : [];
  c.replies = depth < 1 ? replies.map((r) => ({ ...mapComment(r, depth + 1), parent_comment_id: c.comment_id })) : [];
  if (c.reply_count === null && replies.length) c.reply_count = replies.length;
  return c;
}

export function mapProfile(item) {
  const p = {};
  for (const [k, names] of Object.entries(PROFILE_FIELDS)) p[k] = pick(item, names);
  p.followers_count = num(p.followers_count);
  return p;
}

// Which model fields could not be resolved on a sample — used by the probe.
export function unmappedFields(item, FIELDS) {
  return Object.entries(FIELDS).filter(([, names]) => pick(item, names) === null).map(([k]) => k);
}
