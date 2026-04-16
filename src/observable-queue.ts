
export type ObservableQueueOptions<T> = {
  pipe?: (item: T) => T
  chain?: () => ObservableQueue<T>
}

export type ObservableQueueItem<T> = {
  next?: ObservableQueueItem<T>
  prev?: ObservableQueueItem<T>
  data?: T
}

export type ObservableQueueEventHandler<T> = ((data: any, state: ObservableQueue<T>) => void)

export type ObservableQueueListeners<T> = {
  [key: string | number]: {
    ids: number,
    handlers: { [key: string | number]: ObservableQueueEventHandler<T> }
  }
}

export class ObservableQueue<T> {

  public size: number
  public maxSize: number
  public first: ObservableQueueItem<T> | undefined
  public last: ObservableQueueItem<T> | undefined
  private pipe: (item: T) => T
  private chain: () => ObservableQueue<T> 
  private listeners: ObservableQueueListeners<T>
  private ids: number

  constructor(maxSize: number = Number.POSITIVE_INFINITY, options: ObservableQueueOptions<T> = {}) {
    this.size = 0;
    this.maxSize = maxSize;
    this.pipe = options['pipe'] ? options.pipe : (i) => i;
    this.chain = options['chain'] ? options.chain : () => new ObservableQueue<T>();
    this.listeners = {};
    this.ids = 0;
  }

  isEmpty() : boolean {
    return this.length < 1; 
  }

  prepend(data: T) {
    let results = [];
    let next: ObservableQueueItem<T> = {};
    next.data = data;
    if (!this.isEmpty()) {
      next.next = this.first;
      this.first.prev = next;
      this.first = next;
    } else {
      this.first = next;
      this.last = next;
    }
    this.size += 1;
    if (this.size > this.maxSize) {
      for (let item of this.flush(this.size - this.maxSize)) {
        results.push(item);
      }
    }
    return this;
  }

  concat(other: ObservableQueue<T>) {
    for (let data of other.toArray()) {
      this.push(data);
    }
    return this;
  }

  peak() : T {
    if (!this.isEmpty()) return this.first.data;
    throw new Error('Cannot peak on empty queue');
  }

  remove() : T {
    if (this.isEmpty()) throw new Error('Cannot pull from empty queue');
    let result = this.first.data;
    this.size-=1;
    this.first = this.first.next;

    if (this.first !== null && this.first !== undefined && (this.first.next === null || this.first.next === undefined)) {
      this.last = this.first;
    } else if (this.first === null || this.first === undefined) {
      this.last = this.first;
    }

    return result;
  }

  pull() : T {
    return this.pipe(this.remove());
  }

  * nodes() {
    let next = this.first;
    let iterations = 0;
    while ((next !== null || next !== undefined)) {
      yield next;
      iterations += 1;
      next = next.next;
    }
    return;
  }

  on(method: string, create: (unsub: () => any) => ObservableQueueEventHandler<T>) {
    if (this.listeners[method] === undefined) {
      this.listeners[method] = {
        ids: 0,
        handlers: {}
      }
    }
    let listenerID = this.listeners[method].ids;
    this.listeners[method].ids += 1;
    this.listeners[method].handlers[listenerID] = create(() => {
      delete this.listeners[method].handlers[listenerID];
    });
  }

  push(...datum: T[]) {

    let results: ObservableQueue<T> = this.chain();

    let emitted: ObservableQueueItem<T>[] = [];

    for (let data of datum) {
      let next: ObservableQueueItem<T> = {};
      next.data = data;
      emitted.push(next);
      if (!this.isEmpty()) {
        next.prev = this.last;
        this.last.next = next;
        this.last = next;
      } else {
        this.first = next;
        this.last = next;
      }
      this.size+=1;
      if (this.size > this.maxSize) {
        for (let item of this.flush(this.size - this.maxSize)) {
          results.push(item);
        }
      }
    }

    if (this.listeners['push'] !== undefined) {
      for (let handler of Object.values(this.listeners['push'].handlers)) {
        handler(emitted, this);
      }
    }

    return results;
  }

  * readHead(n = this.size) : Generator<T> {
    let next = this.first;
    let iterations = 0;
    while ((next !== null && next !== undefined) && (iterations < n)) {
      yield next.data;
      iterations += 1;
      next = next.next;
    }
    return;
  }

  * readTail(n = this.size) : Generator<T> {
    let next = this.last;
    let iterations = 0;
    while ((next !== null && next !== undefined) && (iterations < n)) {
      yield next.data;
      iterations += 1;
      next = next.prev;
    }
    return;
  }

  atIndex(n = this.size) {
    let next;
    if (n < 0) {
      next = this.last;
      n = n * -1;
    } else {
      next = this.first;
    }
    let iterations = 0;
    while ((next !== null || next !== undefined) && (iterations < n)) {
      iterations += 1;
      next = next.prev;
    }
    return next.data;
  }

  read(cb: (item: T) => void) : void {
    for (let item of this.readHead()) {
      cb(item);
    }
  }

  get length () : number {
    return this.size;
  }

  shift() : T {
    return this.pull();
  }

  toArray() : T[] {
    let result = [];
    for (let item of this.readHead()) result.push(item);
    return result;
  }

  clear() : ObservableQueue<T> {
    this.size = 0;
    this.first = null;
    this.last = null;
    return this;
  }

  * flush(n: number = this.maxSize) : Generator<T> {
    let iterations = Math.min(Math.max(n, 0), this.size);
    let count = 0;
    while (count < iterations) {
      yield this.pull();
      count += 1;
    }
    return;
  }

  headIs(pred: (head: T) => boolean) {
    return (!this.isEmpty() && pred(this.peak()));
  }

  toString() {
    return JSON.stringify(this.toArray(), null, 1);
  }

  insert(data: any): { before(next: ObservableQueueItem<T>): void; after(prev: ObservableQueueItem<T>): void } {
    let _this = this;
    return {
      
      before(next: ObservableQueueItem<T>) {
        let node: ObservableQueueItem<T> = {};
        node.data = data;
        node.prev = next.prev;
        if (node.prev !== undefined) node.prev.next = node;
        else (_this.first = node);
        node.next = next;
        next.prev = node;
        _this.size += 1;
        return _this;
      },

      after(node: ObservableQueueItem<T>) {
        let next: ObservableQueueItem<T> = {};
        next.data = data;
        next.prev = node;
        next.next = node.next;
        node.next = next;
        if (next.next !== undefined) next.next.prev = next;
        else (_this.last = next);
        _this.size += 1;
        return _this;
      }
    }
  }

  [Symbol.iterator]() {
    return this.readHead(this.size);
  };

  static describes(item: any) {
    return item instanceof ObservableQueue;
  }

  static fromArray<T>(arr: T[]): ObservableQueue<T> {
    let q = new ObservableQueue<T>();
    for (let item of arr) {
      q.push(item);
    }
    return q;
  }

  static of<T>(...args: T[]): ObservableQueue<T> {
    let q = new ObservableQueue<T>();
    q.push(...args);
    return q;
  }
}
