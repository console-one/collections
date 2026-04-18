import { describe, it, expect } from 'vitest'
import { IndexMap } from '../src/index-map'

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
})
