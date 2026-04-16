# @console-one/collections

A home for collection data structures with different referencing and observation techniques. Package grows over time as new queue variants and collection types are needed.

## Current contents

| Class | File | Purpose |
|---|---|---|
| `LinkedQueue<T>` | `src/linked-queue.ts` | Plain doubly-linked FIFO queue. No events, no insert-at-node. Use when you just want a fast queue. |
| `ObservableQueue<T>` | `src/observable-queue.ts` | Doubly-linked FIFO queue with `on(event, handler)` push listeners and `insert(data).before(node)` / `.after(node)` for positional insertion. Use when you need to react to pushes or splice items by node reference. |

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

### Subpath imports

You can import either class directly if you want to avoid loading both:

```ts
import { LinkedQueue } from '@console-one/collections/linked-queue'
import { ObservableQueue } from '@console-one/collections/observable-queue'
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

## Known behavior inherited from the source

Both queues are ported verbatim from the parent monorepo with renamed exports. The underlying logic has a few quirks to know about:

- **`nodes()` and some iterator loops use `!==` vs `||` mix** that can look infinite at a glance. They terminate because `next` becomes `undefined` and the body's `next = next.next` throws silently in a few paths. Don't use `nodes()` as a general-purpose iterator — use `readHead()` / `[Symbol.iterator]` instead.
- **`maxSize` overflow behavior** pushes into a secondary "chain" queue rather than silently dropping. The chain is created fresh on each `push()` call, so you don't accumulate one global overflow buffer.
- **`pipe` only runs on `shift()` / `pull()`**, not on `remove()` or iterators.

## Fixed during extraction

The source versions of these queues had two latent bugs that tests surfaced immediately. Both were dead-on-arrival in the monorepo — no caller was successfully using the affected methods. Fixed in this extraction:

1. **`ObservableQueue.on(event, create)` never fired.** The source stored handlers under a per-call numeric `id` (incrementing `this.ids`) but the push loop did a lookup by the string `'push'`. The two keyspaces never intersected, so registered handlers were unreachable. And if they had intersected, the `while` loop around the dispatch would have been infinite. Fixed: handlers are now keyed by the `method` string (as the API clearly intended), and the dispatch is a single `if` not a `while`.

2. **`ObservableQueue.insert(data).before(node)` / `.after(node)` corrupted the size.** The splice correctly relinked the doubly-linked list but never incremented `this.size`. Since `toArray()`, `readHead()`, and the `Symbol.iterator` all iterate exactly `this.size` times from `first`, inserted nodes were invisible to any consumer. Fixed: both `before()` and `after()` now increment `_this.size`.

If you were relying on the broken behavior, you weren't — neither method worked. These fixes are strictly additive to what the source allowed.

## Tests

```bash
npm test
```

28 tests covering FIFO semantics, insertion, options, overflow, and event hooks.
