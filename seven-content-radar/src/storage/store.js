import { promises as fs } from 'node:fs';
import path from 'node:path';

// Collections are arrays of records with a unique `id`. Each collection is
// persisted as one JSON document (file locally, key in an Apify Key-Value
// Store in production). Volumes for this product (a few thousand reels, a few
// hundred analyses) stay far below the limits of that approach, and it keeps
// the whole system dependency-free.
export const COLLECTIONS = [
  'creators',
  'reels',
  'snapshots',
  'comments',
  'analyses',
  'ideas',
  'structure_library',
  'hook_dna_seven',
  'errors',
  'settings',
  'alerts',
  'runs',
  'clusters',
];

export class BaseStore {
  constructor() {
    this.cache = new Map();
    this.dirty = new Set();
  }

  async init() {
    for (const name of COLLECTIONS) {
      const rows = await this.load(name);
      this.cache.set(name, Array.isArray(rows) ? rows : []);
    }
    return this;
  }

  all(name) {
    this.assert(name);
    return this.cache.get(name);
  }

  get(name, id) {
    return this.all(name).find((r) => r.id === id) || null;
  }

  find(name, pred) {
    return this.all(name).filter(pred);
  }

  upsert(name, record) {
    if (!record || !record.id) throw new Error(`upsert(${name}): record needs an id`);
    const rows = this.all(name);
    const idx = rows.findIndex((r) => r.id === record.id);
    if (idx >= 0) rows[idx] = { ...rows[idx], ...record };
    else rows.push(record);
    this.dirty.add(name);
    return idx >= 0 ? rows[idx] : record;
  }

  remove(name, id) {
    const rows = this.all(name);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx >= 0) {
      rows.splice(idx, 1);
      this.dirty.add(name);
    }
    return idx >= 0;
  }

  replace(name, rows) {
    this.assert(name);
    this.cache.set(name, rows);
    this.dirty.add(name);
  }

  // Settings are a single-document collection: {id:'main', ...}
  settings() {
    return this.get('settings', 'main') || { id: 'main' };
  }

  setSettings(patch) {
    return this.upsert('settings', { id: 'main', ...this.settings(), ...patch });
  }

  async flush() {
    for (const name of this.dirty) {
      await this.persist(name, this.cache.get(name));
    }
    this.dirty.clear();
  }

  assert(name) {
    if (!this.cache.has(name)) throw new Error(`Unknown collection ${name}`);
  }

  // eslint-disable-next-line no-unused-vars
  async load(name) { throw new Error('not implemented'); }

  // eslint-disable-next-line no-unused-vars
  async persist(name, rows) { throw new Error('not implemented'); }
}

export class MemoryStore extends BaseStore {
  async load() { return []; }

  async persist() {}
}

export class FileStore extends BaseStore {
  constructor(dir) {
    super();
    this.dir = dir;
  }

  file(name) {
    return path.join(this.dir, `${name}.json`);
  }

  async load(name) {
    try {
      const txt = await fs.readFile(this.file(name), 'utf8');
      return JSON.parse(txt);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
  }

  async persist(name, rows) {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = `${this.file(name)}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(rows, null, 2));
    await fs.rename(tmp, this.file(name));
  }
}

// Apify named Key-Value Store adapter (production). One key per collection.
export class ApifyKvStore extends BaseStore {
  constructor(kvStore) {
    super();
    this.kv = kvStore;
  }

  async load(name) {
    const v = await this.kv.getValue(name);
    return v || [];
  }

  async persist(name, rows) {
    await this.kv.setValue(name, rows);
  }
}
