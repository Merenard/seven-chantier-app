import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { log } from '../util/log.js';
import { retry } from '../util/misc.js';
import {
  CLASSIFY_SYSTEM, classifyUserPrompt, CLASSIFY_SCHEMA, CATEGORIES,
  ANALYZE_SYSTEM, analyzeUserPrompt, ANALYZE_SCHEMA,
  ADAPT_SYSTEM, adaptUserPrompt, ADAPT_SCHEMA,
  CLUSTER_SYSTEM, clusterUserPrompt, CLUSTER_SCHEMA,
  FAILURE_SYSTEM, FAILURE_SCHEMA,
} from './prompts.js';

export class AiInvalidOutputError extends Error {
  constructor(message, raw) {
    super(message);
    this.name = 'AiInvalidOutputError';
    this.raw = raw;
  }
}

// Minimal JSON-schema validator (types, required, enum, additionalProperties,
// integer bounds) — enough to reject a malformed model answer deterministically.
export function validate(schema, value, path = '$') {
  const errors = [];
  const t = schema.type;
  const types = Array.isArray(t) ? t : [t];
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
  const typeOk = types.some((ty) => (ty === 'integer' ? Number.isInteger(value) : ty === 'number' ? typeof value === 'number' : ty === actual));
  if (t && !typeOk) return [`${path}: expected ${types.join('|')}, got ${actual}`];
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: value not in enum`);
  if (Number.isFinite(schema.minimum) && value < schema.minimum) errors.push(`${path}: below minimum`);
  if (Number.isFinite(schema.maximum) && value > schema.maximum) errors.push(`${path}: above maximum`);
  if (actual === 'object' && schema.properties) {
    for (const k of schema.required || []) if (!(k in value)) errors.push(`${path}.${k}: missing`);
    for (const [k, v] of Object.entries(value)) {
      if (schema.properties[k]) errors.push(...validate(schema.properties[k], v, `${path}.${k}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${k}: unexpected`);
    }
  }
  if (actual === 'array' && schema.items) value.forEach((v, i) => errors.push(...validate(schema.items, v, `${path}[${i}]`)));
  return errors;
}

export function extractJson(text) {
  const trimmed = String(text).trim();
  try { return JSON.parse(trimmed); } catch { /* fallthrough */ }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch { /* fallthrough */ } }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(trimmed.slice(start, end + 1)); } catch { /* fallthrough */ } }
  throw new AiInvalidOutputError('No JSON object found in model output', trimmed.slice(0, 500));
}

export class AiEngine {
  // `client` is injectable (tests pass a fake with messages.create)
  constructor({ client, apiKey = config.anthropicApiKey, cfg = config.ai } = {}) {
    if (!client && !apiKey) throw new Error('ANTHROPIC_API_KEY missing');
    this.client = client || new Anthropic({ apiKey });
    this.cfg = cfg;
    this.usage = { input_tokens: 0, output_tokens: 0, calls: 0 };
  }

  async json({ system, user, schema, model = this.cfg.model, maxTokens = 8000, effort = 'medium' }) {
    return retry(async (attempt) => {
      const res = await this.client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: attempt === 0 ? user : `${user}\n\n(Réponse précédente invalide : renvoie STRICTEMENT le JSON conforme au schéma.)` }],
        output_config: { effort, format: { type: 'json_schema', schema } },
      });
      this.usage.calls += 1;
      this.usage.input_tokens += res.usage?.input_tokens || 0;
      this.usage.output_tokens += res.usage?.output_tokens || 0;
      if (res.stop_reason === 'refusal') throw new AiInvalidOutputError(`Model refused: ${res.stop_details?.category || 'unknown'}`);
      if (res.stop_reason === 'max_tokens') throw new AiInvalidOutputError('Model output truncated (max_tokens)');
      const text = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
      const parsed = extractJson(text);
      const errors = validate(schema, parsed);
      if (errors.length) throw new AiInvalidOutputError(`Schema violations: ${errors.slice(0, 5).join('; ')}`, text.slice(0, 500));
      return parsed;
    }, {
      retries: this.cfg.maxRetries,
      baseMs: 1500,
      shouldRetry: (err) => err instanceof AiInvalidOutputError || err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError || err instanceof Anthropic.APIConnectionError,
      onRetry: (err, attempt, delay) => log.warn('ai retry', { attempt, delay, error: err.message }),
    });
  }

  // §16/§43 — classify comments in batches. Comments whose classification is
  // invalid after retries are returned with category null (excluded downstream).
  async classifyComments(comments, { caption } = {}) {
    const out = new Array(comments.length).fill(null);
    const size = this.cfg.classifierBatchSize;
    for (let start = 0; start < comments.length; start += size) {
      const batch = comments.slice(start, start + size);
      try {
        const res = await this.json({
          system: CLASSIFY_SYSTEM,
          user: classifyUserPrompt({ caption, comments: batch }),
          schema: CLASSIFY_SCHEMA,
          model: this.cfg.classifierModel,
          maxTokens: 12000,
          effort: 'low',
        });
        for (const item of res.items) {
          if (Number.isInteger(item.i) && item.i >= 0 && item.i < batch.length && CATEGORIES.includes(item.category)) out[start + item.i] = item;
        }
      } catch (err) {
        log.error('classification batch failed', { start, size: batch.length, error: err.message });
      }
    }
    return out;
  }

  async analyzeReel(input) {
    return this.json({ system: ANALYZE_SYSTEM, user: analyzeUserPrompt(input), schema: ANALYZE_SCHEMA, maxTokens: 6000, effort: 'high' });
  }

  async adaptForSeven(input) {
    return this.json({ system: ADAPT_SYSTEM, user: adaptUserPrompt(input), schema: ADAPT_SCHEMA, maxTokens: 6000, effort: 'high' });
  }

  async clusterComments(input) {
    return this.json({ system: CLUSTER_SYSTEM, user: clusterUserPrompt(input), schema: CLUSTER_SCHEMA, maxTokens: 4000, effort: 'medium' });
  }

  async failureHypothesis(user) {
    return this.json({ system: FAILURE_SYSTEM, user, schema: FAILURE_SCHEMA, maxTokens: 3000, effort: 'medium' });
  }
}
