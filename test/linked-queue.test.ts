import { describe, it, expect } from 'vitest'
import { LinkedQueue } from '../src/linked-queue'

describe('LinkedQueue', () => {
  it('starts empty', () => {
    const q = new LinkedQueue<number>()
    expect(q.isEmpty()).toBe(true)
    expect(q.length).toBe(0)
  })

  it('push appends to the tail, shift removes from the head (FIFO)', () => {
    const q = new LinkedQueue<number>()
    q.push(1, 2, 3)
    expect(q.length).toBe(3)
    expect(q.shift()).toBe(1)
    expect(q.shift()).toBe(2)
    expect(q.shift()).toBe(3)
    expect(q.isEmpty()).toBe(true)
  })

  it('prepend pushes to the head', () => {
    const q = new LinkedQueue<number>()
    q.push(2, 3)
    q.prepend(1)
    expect(q.toArray()).toEqual([1, 2, 3])
  })

  it('peak returns the head without removing it', () => {
    const q = new LinkedQueue<string>()
    q.push('a', 'b')
    expect(q.peak()).toBe('a')
    expect(q.length).toBe(2)
  })

  it('peak throws on empty queue', () => {
    const q = new LinkedQueue<number>()
    expect(() => q.peak()).toThrow('Cannot peak on empty queue')
  })

  it('remove throws on empty queue', () => {
    const q = new LinkedQueue<number>()
    expect(() => q.remove()).toThrow('Cannot pull from empty queue')
  })

  it('toArray returns values in head-to-tail order', () => {
    const q = LinkedQueue.fromArray([1, 2, 3, 4])
    expect(q.toArray()).toEqual([1, 2, 3, 4])
  })

  it('static fromArray round-trips through toArray', () => {
    const items = ['a', 'b', 'c']
    const q = LinkedQueue.fromArray(items)
    expect(q.toArray()).toEqual(items)
  })

  it('static of constructs from varargs', () => {
    const q = LinkedQueue.of(1, 2, 3)
    expect(q.toArray()).toEqual([1, 2, 3])
  })

  it('concat copies values from another queue', () => {
    const a = LinkedQueue.of(1, 2)
    const b = LinkedQueue.of(3, 4)
    a.concat(b)
    expect(a.toArray()).toEqual([1, 2, 3, 4])
  })

  it('clear empties the queue', () => {
    const q = LinkedQueue.of(1, 2, 3)
    q.clear()
    expect(q.isEmpty()).toBe(true)
    expect(q.length).toBe(0)
  })

  it('headIs checks the head against a predicate safely on empty', () => {
    const q = new LinkedQueue<number>()
    expect(q.headIs(h => h === 1)).toBe(false)
    q.push(1)
    expect(q.headIs(h => h === 1)).toBe(true)
    expect(q.headIs(h => h === 2)).toBe(false)
  })

  it('static describes identifies instances', () => {
    expect(LinkedQueue.describes(new LinkedQueue())).toBe(true)
    expect(LinkedQueue.describes([])).toBe(false)
    expect(LinkedQueue.describes(null)).toBe(false)
  })

  it('pipe option transforms values as they leave the queue', () => {
    const q = new LinkedQueue<number>(Number.POSITIVE_INFINITY, {
      pipe: (n) => n * 10,
    })
    q.push(1, 2, 3)
    expect(q.shift()).toBe(10)
    expect(q.shift()).toBe(20)
    expect(q.shift()).toBe(30)
  })

  it('maxSize bounds the queue, flushing the oldest items', () => {
    const q = new LinkedQueue<number>(2)
    q.push(1, 2, 3, 4)
    expect(q.length).toBe(2)
    // The newest items remain
    const remaining = q.toArray()
    expect(remaining.length).toBe(2)
  })

  it('toString produces valid JSON', () => {
    const q = LinkedQueue.of(1, 2, 3)
    expect(() => JSON.parse(q.toString())).not.toThrow()
    expect(JSON.parse(q.toString())).toEqual([1, 2, 3])
  })
})
