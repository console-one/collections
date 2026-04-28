/**
 * Ordered key-value map utility.
 *
 *   SingleEntryObject<V>      ordered Map<K,V> that refuses duplicates;
 *                             iteration order is comparator-controlled
 *                             (defaults to djb2-hash for strings, identity for numbers).
 *
 *   AutoIndexed<V>            wrapper that derives the key from V via an extractor,
 *                             so callers do `.set(value)` instead of `.set(key, value)`.
 *
 *   KeyOrder<K, M>             the sorted index that backs the above; exported in case
 *                             a caller wants the ordering machinery on its own.
 *
 *   WrappedKey<K, M>           a (key, metadata) pair stored inside KeyOrder.
 */

type KeyT = string | number;

export class WrappedKey<K extends KeyT, M = unknown> {
  constructor(public key: K, public metadata: M | undefined = undefined) {}
}

export type OrderPolicy<K extends KeyT, M = unknown> = {
  wrapper: (key: K, metadata?: M) => WrappedKey<K, M>;
  comparator: (a: WrappedKey<K, M>, b: WrappedKey<K, M>) => number;
};

export type PartialOrderPolicy<K extends KeyT, M = unknown> = Partial<OrderPolicy<K, M>>;

export class KeyOrder<K extends KeyT, M = unknown> {
  order: WrappedKey<K, M>[] = [];

  constructor(
    public policy: OrderPolicy<K, M>,
    keys: Array<K | [K, M?]> = [],
  ) {
    for (const item of keys) {
      if (Array.isArray(item)) {
        this.order.push(this.policy.wrapper(item[0], item[1]));
      } else {
        this.order.push(this.policy.wrapper(item));
      }
    }
    this.order.sort(this.policy.comparator);
  }

  set(key: K, metadata?: M): void {
    this.order.push(this.policy.wrapper(key, metadata));
    this.order.sort(this.policy.comparator);
  }

  remove(key: K): boolean {
    const i = this.order.findIndex(w => w.key === key);
    if (i === -1) return false;
    this.order.splice(i, 1);
    return true;
  }

  has(key: K): boolean {
    return this.order.some(w => w.key === key);
  }

  list(): K[] {
    return this.order.map(w => w.key);
  }

  get length(): number {
    return this.order.length;
  }
}

function stringToHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function keyToNum(key: KeyT): number {
  return typeof key === 'string' ? stringToHashCode(key) : key;
}

export const DefaultOrderWrapper = <K extends KeyT, M = unknown>(
  key: K,
  metadata?: M,
): WrappedKey<K, M> => new WrappedKey(key, metadata);

export const DefaultComparator = <K extends KeyT, M = unknown>(
  a: WrappedKey<K, M>,
  b: WrappedKey<K, M>,
): number => keyToNum(a.key) - keyToNum(b.key);

type SafeResult<V> = { ok: true; value: V } | { ok: false; value: Error };

export class SingleEntryObject<V = unknown> {
  private items = new Map<KeyT, V>();
  order: KeyOrder<KeyT, { value: V }>;

  constructor(
    initial: { [k: string]: V } | { [k: number]: V } = {},
    orderPolicy: PartialOrderPolicy<KeyT, { value: V }> = {},
  ) {
    const policy: OrderPolicy<KeyT, { value: V }> = {
      wrapper: orderPolicy.wrapper ?? (DefaultOrderWrapper as OrderPolicy<KeyT, { value: V }>['wrapper']),
      comparator: orderPolicy.comparator ?? (DefaultComparator as OrderPolicy<KeyT, { value: V }>['comparator']),
    };
    this.order = new KeyOrder(policy, []);
    for (const [k, v] of Object.entries(initial)) {
      this.setSafe(k, v as V);
    }
  }

  get(key: KeyT): V | undefined {
    return this.items.get(key);
  }

  getExpected(key: KeyT): V {
    const r = this.getExpectedSafe(key);
    if (!r.ok) throw r.value;
    return r.value;
  }

  getExpectedSafe(key: KeyT): SafeResult<V> {
    if (!this.items.has(key)) {
      return { ok: false, value: new Error(`Attempted to get item with key "${key}" but it does not exist.`) };
    }
    return { ok: true, value: this.items.get(key)! };
  }

  has(key: KeyT): boolean {
    return this.items.has(key);
  }

  delete(key: KeyT): boolean {
    const had = this.items.delete(key);
    if (had) this.order.remove(key);
    return had;
  }

  keys(): KeyT[] {
    return this.order.list();
  }

  values(): V[] {
    const out: V[] = [];
    for (const k of this.keys()) {
      if (this.items.has(k)) out.push(this.items.get(k) as V);
    }
    return out;
  }

  entries(): Array<[KeyT, V]> {
    const out: Array<[KeyT, V]> = [];
    for (const k of this.keys()) {
      if (this.items.has(k)) out.push([k, this.items.get(k) as V]);
    }
    return out;
  }

  set(key: KeyT, item: V): void {
    const err = this.setSafe(key, item);
    if (err) throw err;
  }

  setSafe(key: KeyT, item: V): Error | void {
    if (this.items.has(key)) return new Error(`Item already exists for key "${key}".`);
    this.items.set(key, item);
    this.order.set(key, { value: item });
  }

  /** Overwrite (or insert) the value at `key`. Returns true if a value was replaced. */
  forceSet(key: KeyT, item: V): boolean {
    const existed = this.items.has(key);
    if (existed) this.order.remove(key);
    this.items.set(key, item);
    this.order.set(key, { value: item });
    return existed;
  }

  setAll(added: { [k: string]: V } | { [k: number]: V }): void {
    const err = this.setAllSafe(added);
    if (err) throw err;
  }

  setAllSafe(added: { [k: string]: V } | { [k: number]: V }): Error | void {
    const errors: string[] = [];
    for (const [k, v] of Object.entries(added)) {
      const err = this.setSafe(k, v as V);
      if (err) errors.push(err.message);
    }
    if (errors.length > 0) return new Error(errors.join('\n'));
  }

  copy(): SingleEntryObject<V> {
    return new SingleEntryObject(this.objectCopy());
  }

  objectCopy(): { [k: string]: V } {
    const out: { [k: string]: V } = {};
    for (const [k, v] of this.entries()) out[String(k)] = v;
    return out;
  }

  override(other: { [k: string]: V } | { [k: number]: V } | SingleEntryObject<V>): SingleEntryObject<V> {
    const merged: { [k: string]: V } = this.objectCopy();
    const source = other instanceof SingleEntryObject ? other.objectCopy() : other;
    for (const [k, v] of Object.entries(source)) merged[k] = v as V;
    return new SingleEntryObject(merged);
  }

  index(num: number): V | undefined {
    const wrapped = this.order.order[num];
    if (!wrapped) return undefined;
    return this.items.get(wrapped.key);
  }

  get length(): number {
    return this.items.size;
  }

  static create<V>(item: { [k: string]: V } | { [k: number]: V } = {}): SingleEntryObject<V> {
    return new SingleEntryObject(item);
  }
}

export class AutoIndexed<V> {
  private dataMap: SingleEntryObject<V>;
  private forced: Set<KeyT>;

  constructor(
    public extractor: (item: V) => KeyT,
    public inputOrderPolicy?: PartialOrderPolicy<KeyT, { value: V }>,
  ) {
    this.dataMap = new SingleEntryObject<V>({}, this.inputOrderPolicy);
    this.forced = new Set<KeyT>();
  }

  setAll(items: V[]): void {
    for (const it of items) this.set(it);
  }

  /**
   * Insert with an explicit key. If `errorIfExists` is true and the key
   * is already present, throws. Otherwise overwrites silently.
   * Returns whether a previous value was replaced.
   */
  forceSet(key: KeyT, item: V, errorIfExists: boolean = false): boolean {
    if (errorIfExists && this.dataMap.has(key)) {
      throw new Error(`Item already exists for key "${key}".`);
    }
    const replaced = this.dataMap.forceSet(key, item);
    this.forced.add(key);
    return replaced;
  }

  /** Insert by extracting the key from the value. `input` may be a value or a thunk. */
  set(input: V | (() => V)): KeyT {
    const item: V = typeof input === 'function' ? (input as () => V)() : input;
    const key = this.extractor(item);
    this.dataMap.forceSet(key, item);
    return key;
  }

  get(key: KeyT): V | undefined {
    return this.dataMap.get(key);
  }

  has(key: KeyT): boolean {
    return this.dataMap.has(key);
  }

  delete(key: KeyT): boolean {
    this.forced.delete(key);
    return this.dataMap.delete(key);
  }

  index(num: number): V | undefined {
    return this.dataMap.index(num);
  }

  copy(opts: { copyOrder?: boolean } = {}): AutoIndexed<V> {
    const next = new AutoIndexed<V>(this.extractor, this.inputOrderPolicy);
    for (const [key, value, forced] of this.entries()) {
      if (forced || opts.copyOrder) next.forceSet(key, value);
      else next.set(value);
    }
    return next;
  }

  *keys(): Generator<KeyT> {
    for (const key of this.dataMap.keys()) yield key;
  }

  *values(): Generator<V> {
    for (const key of this.keys()) {
      const item = this.dataMap.get(key);
      if (item !== undefined) yield item;
    }
  }

  *entries(): Generator<[KeyT, V, boolean]> {
    for (const key of this.dataMap.keys()) {
      const item = this.dataMap.get(key);
      if (item === undefined) continue;
      yield [key, item, this.forced.has(key)];
    }
  }

  get length(): number {
    return this.dataMap.length;
  }

  [Symbol.iterator](): Generator<[KeyT, V, boolean]> {
    return this.entries();
  }
}
