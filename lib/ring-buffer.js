export class RingBuffer {
  constructor(capacity = 100 * 1024) {
    this.capacity = capacity;
    this.buffer = Buffer.alloc(capacity);
    this.length = 0;   // bytes currently stored
    this.offset = 0;   // next write position (wraps around)
  }

  write(chunk) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

    if (buf.length >= this.capacity) {
      // Chunk alone fills the entire buffer — keep only the tail
      buf.copy(this.buffer, 0, buf.length - this.capacity);
      this.offset = 0;
      this.length = this.capacity;
      return;
    }

    const spaceAtEnd = this.capacity - this.offset;

    if (buf.length <= spaceAtEnd) {
      buf.copy(this.buffer, this.offset);
    } else {
      // Wrap around
      buf.copy(this.buffer, this.offset, 0, spaceAtEnd);
      buf.copy(this.buffer, 0, spaceAtEnd);
    }

    this.offset = (this.offset + buf.length) % this.capacity;
    this.length = Math.min(this.length + buf.length, this.capacity);
  }

  read() {
    if (this.length === 0) {
      return '';
    }

    if (this.length < this.capacity) {
      // Haven't wrapped yet — data starts at 0
      return this.buffer.toString('utf8', 0, this.length);
    }

    // Buffer is full — data starts at this.offset (oldest byte)
    const start = this.offset; // oldest byte position
    const head = this.buffer.subarray(start, this.capacity);
    const tail = this.buffer.subarray(0, start);
    return Buffer.concat([head, tail]).toString('utf8');
  }

  clear() {
    this.length = 0;
    this.offset = 0;
  }
}
