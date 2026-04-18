/**
 * A handle returned by {@link IndexMap.indexLock}. Pairs the reserved
 * index with a reference back to the map so a holder can call
 * {@link IndexLock.set} / {@link IndexLock.remove} without capturing
 * both separately.
 *
 * Primary use case: listener registration where the callback needs to
 * un-register itself from inside its own body. The callback closes over
 * the IndexLock, not over the (map, id) pair.
 *
 * ```ts
 * const subs = new IndexMap<Callback>()
 * const lock = subs.indexLock()
 * lock.set((data) => {
 *   if (isDone(data)) lock.remove()   // self-cleanup from inside the callback
 *   else handle(data)
 * })
 * ```
 */
export class IndexLock<T> {
  constructor(
    public index: number,
    public map: IndexMap<T>,
  ) {}

  set(value: T): void {
    this.map.set(this.index, value)
  }

  remove(): boolean {
    return this.map.delete(this.index)
  }

  get(): T | undefined {
    return this.map.get(this.index)
  }
}

/**
 * A map keyed by a monotonically increasing counter, so keys are unique
 * and never reused.
 *
 * `store(item)` assigns the next counter value and returns it.
 *
 * `lock()` reserves a key without a value — useful when you need a stable
 * identifier (to hand out externally, or to establish back-references)
 * before the value is available. Call `set(key, value)` later to fill it.
 *
 * `indexLock()` is the same reservation but returns an {@link IndexLock}
 * handle that carries a back-reference to the map, so a self-removing
 * subscriber can clean itself up from inside its own closure.
 */
export class IndexMap<T> {
  map: { [key: string | number]: T }
  counter: number
  size: number
  available: Set<string | number>

  constructor() {
    this.map = {}
    this.counter = 0
    this.available = new Set<string | number>()
    this.size = 0
  }

  store(item: T): number {
    const count = this.counter
    this.counter += 1
    this.map[count] = item
    this.size += 1
    return count
  }

  get(key: string | number): T | undefined {
    return this.map[key]
  }

  has(key: string | number): boolean {
    return this.map[key] !== undefined
  }

  delete(key: string | number): boolean {
    const existedInMap = this.map[key] !== undefined
    const existedInAvailable = this.available.has(key)
    if (existedInMap) {
      delete this.map[key]
      this.size -= 1
    } else if (existedInAvailable) {
      this.available.delete(key)
      this.size -= 1
    }
    return existedInMap || existedInAvailable
  }

  lock(): number {
    const count = this.counter
    this.available.add(count)
    this.counter += 1
    this.size += 1
    return count
  }

  indexLock(): IndexLock<T> {
    return new IndexLock(this.lock(), this)
  }

  set(count: string | number, value: T): void {
    if (!this.available.has(count) || this.map[count] !== undefined) {
      throw new Error('Setting on forbidden or claimed key of ' + count)
    }
    this.available.delete(count)
    this.map[count] = value
  }

  entries(): [string, T][] {
    return Array.from(Object.entries(this.map))
  }

  values(): T[] {
    return Array.from(Object.values(this.map))
  }

  keys(): string[] {
    return Array.from(Object.keys(this.map))
  }
}
