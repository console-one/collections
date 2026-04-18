/**
 * A map keyed by a monotonically increasing counter, so keys are unique
 * and never reused.
 *
 * `store(item)` assigns the next counter value and returns it.
 *
 * `lock()` reserves a key without a value — useful when you need a stable
 * identifier (to hand out externally, or to establish back-references)
 * before the value is available. Call `set(key, value)` later to fill it.
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
    const existed = this.map[key] !== undefined
    if (existed) {
      delete this.map[key]
      this.size -= 1
    }
    return existed
  }

  lock(): number {
    const count = this.counter
    this.available.add(count)
    this.counter += 1
    this.size += 1
    return count
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
