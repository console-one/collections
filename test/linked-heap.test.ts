import { describe, it, expect } from 'vitest'
import { LinkedHeap, HeapNode } from '../src/linked-heap'

const minComparator = (a: HeapNode<number>, b: HeapNode<number>) => a.data - b.data

describe('LinkedHeap basics', () => {
  it('push + peak returns the smallest', () => {
    const h = new LinkedHeap<number>(minComparator)
    h.push(10, 'ten')
    h.push(5, 'five')
    h.push(20, 'twenty')
    expect(h.peak()).toBe(5)
    expect(h.size()).toBe(3)
  })

  it('pop drains in heap order', () => {
    const h = new LinkedHeap<number>(minComparator)
    h.push(10, 'ten')
    h.push(5, 'five')
    h.push(20, 'twenty')
    expect(h.pop()?.data).toBe(5)
    expect(h.pop()?.data).toBe(10)
    expect(h.pop()?.data).toBe(20)
    expect(h.pop()).toBeNull()
  })

  it('get() returns the stable handle', () => {
    const h = new LinkedHeap<number>(minComparator)
    h.push(10, 'ten')
    h.push(5, 'five')
    expect(h.get('ten')?.data).toBe(10)
    expect(h.get('nope')).toBeUndefined()
  })

  it('remove(key) re-heapifies', () => {
    const h = new LinkedHeap<number>(minComparator)
    h.push(10, 'ten')
    h.push(5, 'five')
    h.push(20, 'twenty')
    h.push(1, 'one')
    expect(h.remove('one')).toBe(1)
    expect(h.peak()).toBe(5)
    expect(h.remove('nope')).toBeNull()
  })

  it('duplicate keys are rejected', () => {
    const h = new LinkedHeap<number>(minComparator)
    h.push(10, 'k')
    expect(() => h.push(5, 'k')).toThrow(/Duplicate key/)
  })

  it('HeapNode.update() re-inserts preserving identity', () => {
    const h = new LinkedHeap<number>(minComparator)
    const ten = h.push(10, 'ten')
    h.push(5, 'five')
    h.push(20, 'twenty')
    ten.update(1)
    expect(h.peak()).toBe(1)
    expect(h.get('ten')?.data).toBe(1)
    expect(h.size()).toBe(3)
  })

  it('HeapNode.remove() detaches, forbids further ops', () => {
    const h = new LinkedHeap<number>(minComparator)
    const n = h.push(10, 'ten')
    expect(n.isAttached).toBe(true)
    n.remove()
    expect(n.isAttached).toBe(false)
    expect(() => n.update(5)).toThrow(/detached node/i)
  })

  it('mapper derives key from data', () => {
    const h = new LinkedHeap<{ id: string; pri: number }>(
      (a, b) => a.data.pri - b.data.pri,
      (data) => data.id,
    )
    h.push({ id: 'job-1', pri: 5 })
    h.push({ id: 'job-2', pri: 1 })
    expect(h.get('job-2')?.data.pri).toBe(1)
    expect(h.peak()?.id).toBe('job-2')
  })
})

describe('HeapNode async navigation', () => {
  it('nextNode() yields existing higher indices then future pushes', async () => {
    const h = new LinkedHeap<number>(minComparator)
    h.push(5, 'a')
    h.push(10, 'b')
    h.push(20, 'c')

    const start = h.startNode!
    const iter = start.nextNode()
    const collected: number[] = []
    const toConsume = h.length - (start.index + 1)
    for (let i = 0; i < toConsume; i++) {
      const { value } = await iter.next()
      collected.push(value!.data)
    }
    expect(collected.sort((a, b) => a - b)).toEqual([10, 20])

    queueMicrotask(() => h.push(30, 'd'))
    const { value: future } = await iter.next()
    expect(future?.data).toBe(30)
  })
})
