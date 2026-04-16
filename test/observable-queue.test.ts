import { describe, it, expect, vi } from 'vitest'
import { ObservableQueue } from '../src/observable-queue'

describe('ObservableQueue', () => {
  it('behaves like a FIFO queue by default', () => {
    const q = new ObservableQueue<number>()
    q.push(1, 2, 3)
    expect(q.shift()).toBe(1)
    expect(q.shift()).toBe(2)
    expect(q.shift()).toBe(3)
    expect(q.isEmpty()).toBe(true)
  })

  it('supports prepend + peak + remove semantics', () => {
    const q = new ObservableQueue<number>()
    q.push(2, 3)
    q.prepend(1)
    expect(q.peak()).toBe(1)
    expect(q.remove()).toBe(1)
    expect(q.peak()).toBe(2)
  })

  it('notifies push listeners of newly-added nodes', () => {
    const q = new ObservableQueue<number>()
    const handler = vi.fn()
    q.on('push', (_unsub) => handler)
    q.push(1)
    expect(handler).toHaveBeenCalledOnce()
    const [emittedNodes, queueRef] = handler.mock.calls[0]
    expect(emittedNodes).toHaveLength(1)
    expect(emittedNodes[0].data).toBe(1)
    expect(queueRef).toBe(q)
  })

  it('push listener unsubscribe removes the handler', () => {
    const q = new ObservableQueue<number>()
    const handler = vi.fn()
    let unsubscribe: (() => void) | undefined
    q.on('push', (unsub) => { unsubscribe = unsub; return handler })
    q.push(1)
    expect(handler).toHaveBeenCalledTimes(1)
    unsubscribe!()
    q.push(2)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('static fromArray + static of work like LinkedQueue', () => {
    const q = ObservableQueue.fromArray([1, 2, 3])
    expect(q.toArray()).toEqual([1, 2, 3])
    const q2 = ObservableQueue.of('a', 'b')
    expect(q2.toArray()).toEqual(['a', 'b'])
  })

  it('insert().before places a node before a given item', () => {
    const q = ObservableQueue.of(1, 2, 4)
    const fourNode = q.last
    q.insert(3).before(fourNode!)
    expect(q.toArray()).toEqual([1, 2, 3, 4])
  })

  it('insert().after places a node after a given item', () => {
    const q = ObservableQueue.of(1, 2, 4)
    const twoNode = q.last?.prev
    q.insert(3).after(twoNode!)
    expect(q.toArray()).toEqual([1, 2, 3, 4])
  })

  it('clear empties and resets the queue', () => {
    const q = ObservableQueue.of(1, 2, 3)
    q.clear()
    expect(q.isEmpty()).toBe(true)
    expect(q.length).toBe(0)
  })

  it('toArray preserves head-to-tail order', () => {
    const q = new ObservableQueue<string>()
    q.push('a')
    q.push('b')
    q.push('c')
    expect(q.toArray()).toEqual(['a', 'b', 'c'])
  })

  it('headIs guards correctly on empty queue', () => {
    const q = new ObservableQueue<number>()
    expect(q.headIs(h => h === 1)).toBe(false)
    q.push(1)
    expect(q.headIs(h => h === 1)).toBe(true)
  })

  it('static describes identifies instances', () => {
    expect(ObservableQueue.describes(new ObservableQueue())).toBe(true)
    expect(ObservableQueue.describes([])).toBe(false)
  })

  it('pipe option transforms values on dequeue', () => {
    const q = new ObservableQueue<number>(Number.POSITIVE_INFINITY, {
      pipe: (n) => n + 100,
    })
    q.push(1, 2)
    expect(q.shift()).toBe(101)
    expect(q.shift()).toBe(102)
  })
})
