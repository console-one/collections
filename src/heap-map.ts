import { LinkedHeap, HeapNode } from './linked-heap.js'

type ValueComparator<T> = (a: T, b: T) => number

/**
 * Heap-backed map: items live in a sorted heap indexed by a primary key derived
 * from each value. Combines O(1) lookup-by-key with O(log n) heap ordering.
 *
 * Re-inserting a value with a key that already exists *updates in place* (via
 * HeapNode.update), preserving node identity and re-heapifying.
 *
 * @template PKey  Primary-key type (string or number).
 * @template Value Value type stored in the heap.
 */
export class HeapMap<PKey extends string | number, Value> {
  private heap: LinkedHeap<Value>
  private pkeyOf: (value: Value) => PKey

  /**
   * @param pkeyOf     Function that derives a stable key from a value.
   * @param comparator Comparator over values (min-heap if it returns negative when a<b).
   *
   * Internally we adapt the value-comparator to a node-comparator (`node.data`).
   * We also pass `pkeyOf` as the heap's `mapper` so pushes auto-derive keys.
   */
  constructor(pkeyOf: (value: Value) => PKey, comparator: ValueComparator<Value>) {
    this.pkeyOf = pkeyOf

    const nodeComparator = (a: HeapNode<Value>, b: HeapNode<Value>) =>
      comparator(a.data, b.data)

    this.heap = new LinkedHeap<Value, unknown>(nodeComparator, pkeyOf as (data: Value) => string | number)
  }

  /**
   * Insert or upsert a value. If an item with the same primary key already
   * exists, it is updated in-place (via HeapNode.update) so the heap rebalances
   * accordingly without changing identity.
   */
  insert(value: Value): void {
    const key = String(this.pkeyOf(value))
    const existing = this.heap.get(key)
    if (existing) {
      existing.update(value)
    } else {
      this.heap.push(value)
    }
  }

  /** Remove by primary key. Returns true if something was removed. */
  remove(pkey: PKey): boolean {
    const removed = this.heap.remove(String(pkey))
    return removed !== null
  }

  /** Pop and return the top value (or null if empty). */
  pop(): Value | null {
    const node = this.heap.pop()
    return node ? node.data : null
  }

  /** Peek the top value without removing (or null if empty). */
  peek(): Value | null {
    return this.heap.peak()
  }

  /** Get a value by primary key (undefined if absent). */
  get(pkey: PKey): Value | undefined {
    const node = this.heap.get(String(pkey))
    return node?.data
  }

  /** Get the underlying HeapNode by primary key (undefined if absent). */
  getNode(pkey: PKey): HeapNode<Value> | undefined {
    return this.heap.get(String(pkey))
  }

  /** Whether a key exists. */
  has(pkey: PKey): boolean {
    return this.heap.get(String(pkey)) !== undefined
  }

  /** Current number of items. */
  size(): number {
    return this.heap.size()
  }

  /** True when empty. */
  isEmpty(): boolean {
    return this.size() === 0
  }

  get startNode(): HeapNode<Value> | undefined {
    return this.heap.startNode
  }

  get endNode(): HeapNode<Value> | undefined {
    return this.heap.endNode
  }

  /**
   * Snapshot of the heap's current internal array contents (values).
   * Order is the heap-array order (not sorted).
   */
  toArray(): Value[] {
    const out: Value[] = []
    for (let i = 0; i < this.heap.length; i++) {
      const node = this.heap.atIndex(i)
      if (node) out.push(node.data)
    }
    return out
  }
}
