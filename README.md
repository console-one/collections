# @console-one/collections

A home for collection data structures with different referencing and observation techniques. Package grows over time as new queue variants and collection types are needed.

## Current contents

| Class | File | Purpose |
|---|---|---|
| `LinkedQueue<T>` | `src/linked-queue.ts` | Plain doubly-linked FIFO queue. No events, no insert-at-node. Use when you just want a fast queue. |
| `ObservableQueue<T>` | `src/observable-queue.ts` | Doubly-linked FIFO queue with `on(event, handler)` push listeners and `insert(data).before(node)` / `.after(node)` for positional insertion. Use when you need to react to pushes or splice items by node reference. |
| `IndexMap<T>` | `src/index-map.ts` | Map keyed by a monotonic counter — keys are unique and never reused. `lock()` reserves a key before the value is ready; `set(key, value)` fills it later. Useful for subscription IDs, allocation slots, or any case where you need a stable handle before the value exists. |
| `LinkedHeap<T>` | `src/linked-heap.ts` | Key-addressable binary heap whose items are exposed as `HeapNode` handles. Callers can `update(data)` in-place (preserving identity across rebalance), `remove(key)` by key, detach a node without reshaping, and async-iterate neighbors via `nextNode()` / `prevNode()`. Suitable for schedulers, priority queues whose priorities change, and reactive UIs. |

Future variants planned: different backing structures (array ring, chunked), different reference techniques (weak refs, handle-based), different observation models (per-item subscriptions, batched flush events).

## Install

```bash
npm install @console-one/collections
```

## Usage

### LinkedQueue — the minimal case

```ts
import { LinkedQueue } from '@console-one/collections'

const q = LinkedQueue.of(1, 2, 3)
q.shift()   // 1
q.shift()   // 2
q.peak()    // 3 (peek without removing)
q.length    // 1
```

### ObservableQueue — when you need push hooks or node-positional inserts

```ts
import { ObservableQueue } from '@console-one/collections'

const q = new ObservableQueue<string>()

// React to pushes
q.on('push', (unsub) => (newNodes, queue) => {
  console.log('pushed', newNodes.length, 'items; queue size:', queue.length)
})

q.push('alpha')
q.push('beta', 'gamma')

// Splice by node reference
q.push(1, 2, 4)  // [1, 2, 4]
const lastNode = q.last!
q.insert(3).before(lastNode)  // [1, 2, 3, 4]
```

### IndexMap — stable handles before values exist

```ts
import { IndexMap } from '@console-one/collections'

const subs = new IndexMap<(msg: string) => void>()
const id = subs.store((msg) => console.log(msg))
// ... later
subs.delete(id)   // keys are never reused — safe to hand to external code

// Reserve a slot, fill it later:
const slot = subs.lock()
// ... wiring happens, the handler is built
subs.set(slot, (msg) => console.log('late', msg))
```

### LinkedHeap — priority queue with stable handles

```ts
import { LinkedHeap, HeapNode } from '@console-one/collections'

const heap = new LinkedHeap<{ id: string; priority: number }>(
  (a, b) => a.data.priority - b.data.priority,
  (data) => data.id,   // mapper: derive the key from the value
)

const job = heap.push({ id: 'job-1', priority: 5 })
heap.push({ id: 'job-2', priority: 1 })

heap.peak()             // { id: 'job-2', priority: 1 }
job.update({ id: 'job-1', priority: 0 })  // in-place reprioritize
heap.peak()             // { id: 'job-1', priority: 0 }

// Async neighbor iteration — yields existing then future pushes
for await (const neighbor of heap.startNode!.nextNode()) {
  console.log('neighbor', neighbor.data)
}
```

### Subpath imports

You can import each class directly if you want to avoid loading the others:

```ts
import { LinkedQueue } from '@console-one/collections/linked-queue'
import { ObservableQueue } from '@console-one/collections/observable-queue'
import { IndexMap } from '@console-one/collections/index-map'
import { LinkedHeap, HeapNode } from '@console-one/collections/linked-heap'
```

## Shared API

Both queues implement the same base FIFO interface. They only differ in the extras that `ObservableQueue` adds.

### Common methods

| Method | Description |
|---|---|
| `push(...items)` | Append one or more items to the tail. Returns a queue of any items that were flushed due to `maxSize` overflow. |
| `prepend(item)` | Insert an item at the head. |
| `shift()` / `pull()` | Remove and return the head item. Applies `pipe` option if configured. Throws if empty. |
| `remove()` | Like `shift()` but without applying `pipe`. Throws if empty. |
| `peak()` | Return the head item without removing it. Throws if empty. |
| `isEmpty()` | True iff there are no items. |
| `length` / `size` | Current number of items. |
| `concat(other)` | Append all items from another queue. |
| `clear()` | Remove everything. Chainable. |
| `toArray()` | Materialize as a JS array, head first. |
| `toString()` | Pretty-printed JSON of `toArray()`. |
| `headIs(pred)` | Safe predicate check on the head; returns `false` if empty. |
| `flush(n)` | Generator that pops up to `n` items. |
| `readHead(n?)` | Generator over head-first items without consuming. |
| `readTail(n?)` | Generator over tail-first items without consuming. |
| `[Symbol.iterator]()` | Iterable, head first. |
| `static describes(x)` | Type guard for instances of this queue class. |
| `static fromArray(arr)` | Construct from an array. |
| `static of(...items)` | Construct from varargs. |

### Constructor options

Both queues accept the same options:

```ts
new LinkedQueue<T>(maxSize?: number, { pipe?, chain? })
```

- `maxSize` — bound the queue. Items past the bound are flushed from the head. Default `Number.POSITIVE_INFINITY`.
- `pipe` — transform applied on `shift()` / `pull()`. Leaves `remove()` untouched.
- `chain` — factory for the "overflow" queue returned by `push()` when a bounded queue discards items.

### ObservableQueue extras

| Method | Description |
|---|---|
| `on(event, create)` | Subscribe to a queue event (`'push'`). `create(unsub)` must return the actual handler; you get an unsubscribe function to close over. |
| `insert(data).before(node)` / `.after(node)` | Splice a new item at a specific node position. Takes a `QueueItem` reference (from `q.first`, `q.last`, or walking `.next` / `.prev`). |

## Known quirks

- **`nodes()` and some iterator loops use a `!==` vs `||` mix** that can look infinite at a glance. They terminate because `next` becomes `undefined`. Don't use `nodes()` as a general-purpose iterator — use `readHead()` / `[Symbol.iterator]` instead.
- **`maxSize` overflow** pushes into a secondary "chain" queue rather than silently dropping. The chain is created fresh on each `push()` call, so you don't accumulate one global overflow buffer.
- **`pipe` only runs on `shift()` / `pull()`**, not on `remove()` or iterators.

## Tests

```bash
npm test
```

43 tests covering FIFO semantics, insertion, options, overflow, event hooks, index-map lock/set/delete, and linked-heap push/pop/update/remove/async iteration.
