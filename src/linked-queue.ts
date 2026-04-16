

export type LinkedQueueOptions<T> = {
  pipe?: (item: T) => T
  chain?: () => LinkedQueue<T>
}

export type LinkedQueueItem<T> = {
  next?: LinkedQueueItem<T>
  prev?: LinkedQueueItem<T>
  data?: T
}

export class LinkedQueue<T> {

  public size: number
  public maxSize: number
  public first: LinkedQueueItem<T>
  public last: LinkedQueueItem<T>
  private pipe: (item: T) => T
  private chain: () => LinkedQueue<T> 

  constructor(maxSize: number = Number.POSITIVE_INFINITY, options: LinkedQueueOptions<T> = {}) {
    this.size = 0;
    this.maxSize = maxSize;
    this.pipe = options.hasOwnProperty('pipe') ? options.pipe : (i) => i;
    this.chain = options.hasOwnProperty('chain') ? options.chain : () => new LinkedQueue<T>();
  }

  isEmpty() : boolean {
    return this.length < 1; 
  }

  prepend(data: T) {
    let results = [];
    let next: LinkedQueueItem<T> = {};
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

  concat(other: LinkedQueue<T>) {
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

  push(...datum: T[]) {
    let results: LinkedQueue<T> = this.chain();
    for (let data of datum) {
      let next: LinkedQueueItem<T> = {};
      next.data = data;

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

    return results;
  }

  * readHead(n = this.size) : Generator<T> {
    let next = this.first;
    let iterations = 0;
    while ((next !== null || next !== undefined) && (iterations < n)) {
      yield next.data;
      iterations += 1;
      next = next.next;
    }
    return;
  }

  * readTail(n = this.size) : Generator<T> {
    let next = this.last;
    let iterations = 0;
    while ((next !== null || next !== undefined) && (iterations < n)) {
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

  clear() : LinkedQueue<T> {
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

  [Symbol.iterator]() {
    return this.readHead(this.size);
  };


  static describes(item: any) {
    return item instanceof LinkedQueue;
  }


  static fromArray<T>(arr: T[]): LinkedQueue<T> {
    let q = new LinkedQueue<T>();
    for (let item of arr) {
      q.push(item);
    }
    return q;
  }

  static of<T>(...args: T[]): LinkedQueue<T> {
    let q = new LinkedQueue<T>();
    q.push(...args);
    return q;
  }
}
