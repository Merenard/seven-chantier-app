import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiEngine, validate, extractJson, AiInvalidOutputError } from '../src/ai/client.js';
import { CLASSIFY_SCHEMA, ANALYZE_SCHEMA } from '../src/ai/prompts.js';

const ok = (text) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 5 } });

function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    messages: {
      async create(req) {
        calls.push(req);
        const next = responses.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    },
  };
}

test('validate() rejects wrong enum, missing field, out-of-range score', () => {
  const good = { items: [{ i: 0, category: 'QUESTION_CONCRETE', quality_score: 9, reason: 'x', is_artificial_engagement: false, is_substantive: true, trigger_detected: null }] };
  assert.deepEqual(validate(CLASSIFY_SCHEMA, good), []);
  assert.ok(validate(CLASSIFY_SCHEMA, { items: [{ ...good.items[0], category: 'NOPE' }] }).length > 0);
  assert.ok(validate(CLASSIFY_SCHEMA, { items: [{ ...good.items[0], quality_score: 11 }] }).length > 0);
  const { reason, ...missing } = good.items[0];
  assert.ok(validate(CLASSIFY_SCHEMA, { items: [missing] }).length > 0);
  assert.ok(validate(ANALYZE_SCHEMA, { primary_comment_trigger: 'x' }).length > 0);
});

test('extractJson tolerates fences and prose around the object', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Voici : {"a":1} merci'), { a: 1 });
  assert.throws(() => extractJson('pas de json'), AiInvalidOutputError);
});

test('§50 invalid AI answer → retried once with a stricter reminder, then accepted', async () => {
  const client = fakeClient([
    ok('{"items":[{"i":0,"category":"BANANA"}]}'),
    ok('{"items":[{"i":0,"category":"QUESTION_CONCRETE","quality_score":9,"reason":"ok","is_artificial_engagement":false,"is_substantive":true,"trigger_detected":null}]}'),
  ]);
  const ai = new AiEngine({ client, cfg: { model: 'm', classifierModel: 'c', classifierBatchSize: 40, maxRetries: 2 } });
  const res = await ai.classifyComments([{ text: 'Et si on a 50 000 € ?' }]);
  assert.equal(res[0].category, 'QUESTION_CONCRETE');
  assert.equal(client.calls.length, 2);
  assert.match(client.calls[1].messages[0].content, /invalide/);
  assert.equal(client.calls[0].output_config.format.type, 'json_schema');
});

test('§50 invalid AI answer after all retries → comments left unclassified, no throw', async () => {
  const client = fakeClient([ok('garbage'), ok('garbage'), ok('garbage')]);
  const ai = new AiEngine({ client, cfg: { model: 'm', classifierModel: 'c', classifierBatchSize: 40, maxRetries: 2 } });
  const res = await ai.classifyComments([{ text: 'a' }, { text: 'b' }]);
  assert.deepEqual(res, [null, null]);
  assert.equal(client.calls.length, 3);
});

test('batching: 90 comments → 3 calls of 40/40/10 and index mapping preserved', async () => {
  const client = {
    calls: [],
    messages: {
      async create(req) {
        client.calls.push(req);
        const n = (req.messages[0].content.match(/^\[\d+\]/gm) || []).length;
        const items = Array.from({ length: n }, (_, i) => ({ i, category: 'ACCORD_SIMPLE', quality_score: 3, reason: 'r', is_artificial_engagement: false, is_substantive: false, trigger_detected: null }));
        return ok(JSON.stringify({ items }));
      },
    },
  };
  const ai = new AiEngine({ client, cfg: { model: 'm', classifierModel: 'c', classifierBatchSize: 40, maxRetries: 0 } });
  const res = await ai.classifyComments(Array.from({ length: 90 }, (_, i) => ({ text: `comment ${i}` })));
  assert.equal(client.calls.length, 3);
  assert.equal(res.filter(Boolean).length, 90);
});

test('refusal stop reason is surfaced as invalid output', async () => {
  const client = fakeClient([{ stop_reason: 'refusal', stop_details: { category: 'x' }, content: [] }]);
  const ai = new AiEngine({ client, cfg: { model: 'm', classifierModel: 'c', classifierBatchSize: 40, maxRetries: 0 } });
  await assert.rejects(() => ai.analyzeReel({ reel: {}, metrics: {}, distribution: {}, sampleComments: [] }), AiInvalidOutputError);
});
