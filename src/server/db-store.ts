import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function resolveWritableDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), '.data'),
    path.join(os.tmpdir(), 'logeasi-data'),
  ];
  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // Try next candidate
    }
  }
  return candidates[1];
}

const DATA_DIR = resolveWritableDataDir();
const DB_FILE = path.join(DATA_DIR, 'logeasi-db.json');

type DocData = Record<string, any>;
type StoreShape = Record<string, Record<string, DocData>>;

let memoryStore: StoreShape | null = null;

function ensureLoaded(): StoreShape {
  if (memoryStore) return memoryStore;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      memoryStore = JSON.parse(raw) as StoreShape;
      return memoryStore;
    }
  } catch (err) {
    console.warn('Initializing fresh persistent store:', err);
  }
  memoryStore = {};
  return memoryStore;
}

function persistStore() {
  if (!memoryStore) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload = JSON.stringify(memoryStore, null, 2);
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, payload, 'utf8');
    try {
      fs.renameSync(tmp, DB_FILE);
    } catch {
      fs.writeFileSync(DB_FILE, payload, 'utf8');
      try {
        fs.unlinkSync(tmp);
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val));
}

class DocSnapshot {
  constructor(
    public readonly id: string,
    private readonly _data: DocData | undefined,
    public readonly ref: DocRef
  ) {}

  get exists(): boolean {
    return this._data !== undefined;
  }

  data(): DocData | undefined {
    return this._data ? deepClone(this._data) : undefined;
  }
}

class QueryDocSnapshot {
  constructor(
    public readonly id: string,
    private readonly _data: DocData,
    public readonly ref: DocRef
  ) {}

  get exists(): boolean {
    return true;
  }

  data(): DocData {
    return deepClone(this._data);
  }
}

class QuerySnapshot {
  constructor(public readonly docs: QueryDocSnapshot[]) {}

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }
}

class DocRef {
  constructor(
    private readonly collectionPath: string,
    public readonly id: string
  ) {}

  collection(subCollection: string): CollectionRef {
    return new CollectionRef(`${this.collectionPath}/${this.id}/${subCollection}`);
  }

  async get(): Promise<DocSnapshot> {
    const store = ensureLoaded();
    const col = store[this.collectionPath] || {};
    return new DocSnapshot(this.id, col[this.id], this);
  }

  async set(data: DocData, options?: { merge?: boolean }): Promise<void> {
    const store = ensureLoaded();
    if (!store[this.collectionPath]) {
      store[this.collectionPath] = {};
    }
    if (options?.merge && store[this.collectionPath][this.id]) {
      store[this.collectionPath][this.id] = {
        ...store[this.collectionPath][this.id],
        ...deepClone(data),
      };
    } else {
      store[this.collectionPath][this.id] = deepClone(data);
    }
    persistStore();
  }

  async update(data: DocData): Promise<void> {
    const store = ensureLoaded();
    if (!store[this.collectionPath]) {
      store[this.collectionPath] = {};
    }
    const existing = store[this.collectionPath][this.id] || {};
    store[this.collectionPath][this.id] = {
      ...existing,
      ...deepClone(data),
    };
    persistStore();
  }

  async delete(): Promise<void> {
    const store = ensureLoaded();
    if (store[this.collectionPath]) {
      delete store[this.collectionPath][this.id];
      persistStore();
    }
  }
}

interface FilterClause {
  field: string;
  op: string;
  value: any;
}

class QueryRef {
  constructor(
    protected readonly collectionPath: string,
    protected readonly filters: FilterClause[] = [],
    protected readonly limitCount?: number
  ) {}

  where(field: string, op: string, value: any): QueryRef {
    return new QueryRef(
      this.collectionPath,
      [...this.filters, { field, op, value }],
      this.limitCount
    );
  }

  limit(n: number): QueryRef {
    return new QueryRef(this.collectionPath, this.filters, n);
  }

  async get(): Promise<QuerySnapshot> {
    const store = ensureLoaded();
    const col = store[this.collectionPath] || {};
    let entries = Object.entries(col).filter(([, doc]) => {
      return this.filters.every((f) => {
        const val = doc[f.field];
        if (f.op === '==') return val === f.value;
        if (f.op === '!=') return val !== f.value;
        if (f.op === '>') return val > f.value;
        if (f.op === '>=') return val >= f.value;
        if (f.op === '<') return val < f.value;
        if (f.op === '<=') return val <= f.value;
        return true;
      });
    });

    if (this.limitCount !== undefined) {
      entries = entries.slice(0, this.limitCount);
    }

    const docs = entries.map(
      ([id, doc]) => new QueryDocSnapshot(id, doc, new DocRef(this.collectionPath, id))
    );
    return new QuerySnapshot(docs);
  }
}

class CollectionRef extends QueryRef {
  constructor(collectionPath: string) {
    super(collectionPath, [], undefined);
  }

  doc(id: string): DocRef {
    return new DocRef(this.collectionPath, id);
  }
}

class WriteBatch {
  private ops: Array<() => Promise<void>> = [];

  set(ref: DocRef, data: DocData, options?: { merge?: boolean }) {
    this.ops.push(() => ref.set(data, options));
  }

  update(ref: DocRef, data: DocData) {
    this.ops.push(() => ref.update(data));
  }

  delete(ref: DocRef) {
    this.ops.push(() => ref.delete());
  }

  async commit(): Promise<void> {
    for (const op of this.ops) {
      await op();
    }
  }
}

export const serverDb = {
  collection(name: string): CollectionRef {
    return new CollectionRef(name);
  },
  batch(): WriteBatch {
    return new WriteBatch();
  },
};
