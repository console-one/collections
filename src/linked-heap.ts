export type Comparator<Data> = (a: HeapNode<Data>, b: HeapNode<Data>) => number

type HeapEvent<Data> = { eventName: 'push' | 'pop' | 'remove'; node: HeapNode<Data> }

/**
 * A stable handle for an item inside a {@link LinkedHeap}.
 *
 * Unlike a raw value returned from a typical heap, a HeapNode keeps its
 * identity (`id`, `data`, attachment state) across heap rebalances. That
 * makes it safe to hold references externally, update priorities in-place,
 * or iterate neighbors asynchronously.
 */
export class HeapNode<Data> {
  public heap: LinkedHeap<Data>
  public data: Data
  public id: string
  public index: number
  public isAttached: boolean
  public wasExecuted: boolean

  constructor(heap: LinkedHeap<Data>, data: Data, index: number) {
    this.heap = heap
    this.data = data
    this.index = index
    this.isAttached = true
    this.wasExecuted = false
    this.id = ''
  }

  /**
   * Logically detach this node. Does not reshape the heap — useful for
   * marking an item cancelled/terminal before the heap re-sorts around it.
   */
  remove(executed?: boolean): void {
    if (!this.isAttached) {
      throw new Error('Cannot operate on a detached node!')
    }
    this.isAttached = false
    if (executed !== undefined) {
      this.wasExecuted = executed
    }
  }

  /**
   * Replace this node's payload and re-insert to maintain heap order.
   * Safer than `remove + push` because identity (`id`) is preserved.
   */
  update(data: Data): void {
    if (!this.isAttached) {
      throw new Error('Cannot operate on a detached node!')
    }
    this.heap.remove(this.id)
    this.heap.push(data, this.id)
  }

  /**
   * Yields all currently-present nodes at a higher array index, then
   * awaits future `push` events with index >= the last seen one.
   */
  async *nextNode(): AsyncGenerator<HeapNode<Data>> {
    let nextIndex = this.index + 1
    while (nextIndex < this.heap.length) {
      const result = this.heap.atIndex(nextIndex)
      if (result !== undefined) yield result
      nextIndex++
    }

    while (true) {
      const { eventName, node } = await this.heap.nextChange()
      if (eventName === 'push' && node.index >= nextIndex) {
        yield node
        nextIndex = node.index + 1
      }
    }
  }

  /**
   * Yields all currently-present nodes at a lower array index (diagnostics).
   * Backward semantics in a heap are less precise than forward — intended
   * for inspection, not strict algorithmic use.
   */
  async *prevNode(): AsyncGenerator<HeapNode<Data>> {
    let prevIndex = this.index - 1
    while (prevIndex >= 0) {
      const result = this.heap.atIndex(prevIndex)
      if (result !== undefined) yield result
      prevIndex--
    }

    while (true) {
      const { eventName, node } = await this.heap.nextChange()
      if (eventName === 'push' && node.index === 0 && prevIndex >= 0) {
        yield node
      }
    }
  }
}

/**
 * A key-addressable binary heap whose items are exposed as {@link HeapNode}
 * handles. Callers can update, detach, look up by key, or asynchronously
 * iterate neighbors while the heap rebalances.
 *
 * Suitable for schedulers, priority queues whose priorities change,
 * incremental planners, and UI models where identity matters.
 *
 * @typeParam Data   Stored value type.
 * @typeParam Labels Optional label shape passed through to `mapper`.
 */
export class LinkedHeap<Data, Labels = any> {
  private heap: HeapNode<Data>[]
  public nodeMap: Map<string, HeapNode<Data>>
  private comparator: Comparator<Data>
  public _size: number

  private eventListeners: Array<{
    resolver: (val: HeapEvent<Data>) => void
    rejector: (err: any) => void
  }> = []

  constructor(
    comparator: Comparator<Data>,
    public mapper?: (data: Data, labels?: Labels) => string | number,
  ) {
    this.heap = []
    this.nodeMap = new Map<string, HeapNode<Data>>()
    this.comparator = comparator
    this._size = 0
  }

  public get length(): number {
    return this._size
  }

  public size(): number {
    return this._size
  }

  public push(data: Data, key?: string): HeapNode<Data> {
    if (this.mapper !== undefined && key === undefined) {
      key = String(this.mapper(data))
    }
    if (key && this.nodeMap.has(key)) {
      throw new Error(`Duplicate key: ${key}`)
    }
    const node = new HeapNode(this, data, this.heap.length)
    node.id = key ?? `heapKey-${this.heap.length}-${Date.now()}`

    this.heap.push(node)
    this.nodeMap.set(node.id, node)
    this.heapifyUp(this.heap.length - 1)
    this._size++
    this.broadcast('push', node)
    return node
  }

  public pop(): HeapNode<Data> | null {
    if (this.heap.length === 0) return null
    const rootNode = this.heap[0]
    const lastNode = this.heap.pop()
    if (this.heap.length > 0 && lastNode) {
      this.heap[0] = lastNode
      lastNode.index = 0
      this.heapifyDown(0)
    }
    if (rootNode.id !== undefined) {
      this.nodeMap.delete(rootNode.id)
    }
    this._size--
    this.broadcast('pop', rootNode)
    return rootNode
  }

  public atIndex(i: number): HeapNode<Data> | undefined {
    if (i >= this.heap.length || i < 0) return undefined
    return this.heap[i]
  }

  public get(key: string): HeapNode<Data> | undefined {
    return this.nodeMap.get(key)
  }

  public remove(key: string): Data | null {
    const node = this.nodeMap.get(key)
    if (!node) return null
    const index = node.index
    const lastNode = this.heap.pop()
    if (this.heap.length > 0 && lastNode && lastNode !== node) {
      this.heap[index] = lastNode
      lastNode.index = index
      this.heapifyDown(index)
      this.heapifyUp(index)
    }
    this.nodeMap.delete(key)
    this._size--
    this.broadcast('remove', node)
    return node.data
  }

  public peak(): Data | null {
    if (this.heap.length === 0) return null
    return this.heap[0].data
  }

  public get startNode(): HeapNode<Data> | undefined {
    return this.heap[0]
  }

  public get endNode(): HeapNode<Data> | undefined {
    return this.heap[this.heap.length - 1]
  }

  public broadcast(eventName: HeapEvent<Data>['eventName'], node: HeapNode<Data>): void {
    if (this.eventListeners.length > 0) {
      const { resolver } = this.eventListeners.shift()!
      resolver({ eventName, node })
    }
  }

  public nextChange(): Promise<HeapEvent<Data>> {
    return new Promise((resolve, reject) => {
      this.eventListeners.push({ resolver: resolve, rejector: reject })
    })
  }

  private swap(i: number, j: number): void {
    ;[this.heap[i], this.heap[j]] = [this.heap[j], this.heap[i]]
    this.heap[i].index = i
    this.heap[j].index = j
  }

  private heapifyUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)
      if (this.comparator(this.heap[index], this.heap[parentIndex]) < 0) {
        this.swap(index, parentIndex)
        index = parentIndex
      } else {
        break
      }
    }
  }

  private heapifyDown(index: number): void {
    const length = this.heap.length
    while (true) {
      const leftIndex = 2 * index + 1
      const rightIndex = 2 * index + 2
      let smallestIndex = index
      if (leftIndex < length && this.comparator(this.heap[leftIndex], this.heap[smallestIndex]) < 0) {
        smallestIndex = leftIndex
      }
      if (rightIndex < length && this.comparator(this.heap[rightIndex], this.heap[smallestIndex]) < 0) {
        smallestIndex = rightIndex
      }
      if (smallestIndex !== index) {
        this.swap(index, smallestIndex)
        index = smallestIndex
      } else {
        break
      }
    }
  }
}
