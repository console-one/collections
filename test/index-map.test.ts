import { describe, it, expect } from 'vitest'
import { IndexMap, IndexLock } from '../src/index-map'

describe('IndexMap', () => {
  it('stores and retrieves by generated key', () => {
    const m = new IndexMap<string>()
    const k = m.store('first')
    expect(m.get(k)).toBe('first')
    expect(m.size).toBe(1)
  })

  it('generates unique monotonic keys', () => {
    const m = new IndexMap<number>()
    const k1 = m.store(10)
    const k2 = m.store(20)
    expect(k2).toBeGreaterThan(k1)
    expect(m.get(k1)).toBe(10)
    expect(m.get(k2)).toBe(20)
  })

  it('delete returns true once then false', () => {
    const m = new IndexMap<string>()
    const k = m.store('gone')
    expect(m.delete(k)).toBe(true)
    expect(m.size).toBe(0)
    expect(m.delete(k)).toBe(false)
  })

  it('lock reserves a key that set() fills later', () => {
    const m = new IndexMap<{ hello: string }>()
    const k = m.lock()
    expect(m.size).toBe(1)
    expect(m.get(k)).toBeUndefined()

    m.set(k, { hello: 'world' })
    expect(m.get(k)).toEqual({ hello: 'world' })
  })

  it('set rejects unlocked and already-claimed keys', () => {
    const m = new IndexMap<number>()
    const k = m.lock()
    m.set(k, 1)
    expect(() => m.set(k, 2)).toThrow(/forbidden or claimed/)
    expect(() => m.set(9999, 1)).toThrow(/forbidden or claimed/)
  })

  it('keys are not reused after delete', () => {
    const m = new IndexMap<string>()
    const k1 = m.store('a')
    m.delete(k1)
    const k2 = m.store('b')
    expect(k2).not.toBe(k1)
  })

  it('delete releases a locked-but-unset key', () => {
    const m = new IndexMap<string>()
    const k = m.lock()
    expect(m.size).toBe(1)
    expect(m.delete(k)).toBe(true)
    expect(m.size).toBe(0)
    expect(() => m.set(k, 'late')).toThrow(/forbidden or claimed/)
  })
})

describe('IndexLock', () => {
  it('indexLock() returns a handle that can set, get, and remove', () => {
    const m = new IndexMap<{ n: number }>()
    const lock = m.indexLock()
    expect(lock).toBeInstanceOf(IndexLock)
    expect(lock.map).toBe(m)
    expect(lock.get()).toBeUndefined()

    lock.set({ n: 1 })
    expect(lock.get()).toEqual({ n: 1 })
    expect(m.get(lock.index)).toEqual({ n: 1 })

    expect(lock.remove()).toBe(true)
    expect(m.size).toBe(0)
    expect(lock.remove()).toBe(false)
  })

  it('self-unsubscribe pattern: callback removes itself via closure', () => {
    type Cb = (data: string) => void
    const subs = new IndexMap<Cb>()
    const received: string[] = []

    const lock = subs.indexLock()
    lock.set((data) => {
      received.push(data)
      if (data === 'done') lock.remove()
    })

    // simulate a broadcaster
    const broadcast = (data: string) => subs.values().forEach((cb) => cb(data))
    broadcast('a')
    broadcast('b')
    broadcast('done')
    broadcast('after-done')

    expect(received).toEqual(['a', 'b', 'done'])
    expect(subs.size).toBe(0)
  })
})
