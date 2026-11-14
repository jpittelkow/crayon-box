// Undo history (ADR 0004): each action stores the "before" pixels of its bounding box, run-length compressed.
// Capped at 20 steps or about 150 MB, whichever comes first; the oldest step is dropped.

export const MAX_UNDO_STEPS = 20;
export const MAX_UNDO_BYTES = 150 * 1024 * 1024;

/** Run-length encodes 32-bit pixels as [count, value] pairs. */
export function rleEncode(pixels: Uint32Array): Uint32Array {
  if (pixels.length === 0) return new Uint32Array(0);
  const out: number[] = [];
  let value = pixels[0];
  let count = 1;
  for (let i = 1; i < pixels.length; i++) {
    const p = pixels[i];
    if (p === value) {
      count++;
    } else {
      out.push(count, value);
      value = p;
      count = 1;
    }
  }
  out.push(count, value);
  return Uint32Array.from(out);
}

export function rleDecode(rle: Uint32Array, length: number): Uint32Array<ArrayBuffer> {
  const out = new Uint32Array(length);
  let o = 0;
  for (let i = 0; i < rle.length; i += 2) {
    const count = rle[i];
    const value = rle[i + 1];
    if (o + count > length) throw new Error('RLE data longer than expected');
    out.fill(value, o, o + count);
    o += count;
  }
  if (o !== length) throw new Error('RLE data shorter than expected');
  return out;
}

/** The pixels under one action's bounding box, before the action. */
export interface UndoStep {
  x: number;
  y: number;
  width: number;
  height: number;
  rle: Uint32Array;
}

export function makeStep(x: number, y: number, width: number, height: number, rgba: Uint8ClampedArray): UndoStep {
  const pixels = new Uint32Array(rgba.buffer, rgba.byteOffset, width * height);
  return { x, y, width, height, rle: rleEncode(pixels) };
}

export function stepPixels(step: UndoStep): Uint8ClampedArray<ArrayBuffer> {
  const pixels = rleDecode(step.rle, step.width * step.height);
  return new Uint8ClampedArray(pixels.buffer);
}

export function stepBytes(step: UndoStep): number {
  return step.rle.byteLength;
}

export class UndoHistory<T> {
  private steps: T[] = [];
  private bytes = 0;

  constructor(
    private readonly sizeOf: (step: T) => number,
    private readonly maxSteps = MAX_UNDO_STEPS,
    private readonly maxBytes = MAX_UNDO_BYTES,
  ) {}

  push(step: T): void {
    this.steps.push(step);
    this.bytes += this.sizeOf(step);
    // Drop the oldest until both caps hold. The newest step always stays, so the last action can be undone.
    while (this.steps.length > 1 && (this.steps.length > this.maxSteps || this.bytes > this.maxBytes)) {
      const dropped = this.steps.shift()!;
      this.bytes -= this.sizeOf(dropped);
    }
  }

  pop(): T | undefined {
    const step = this.steps.pop();
    if (step) this.bytes -= this.sizeOf(step);
    return step;
  }

  clear(): void {
    this.steps = [];
    this.bytes = 0;
  }

  get length(): number {
    return this.steps.length;
  }

  get totalBytes(): number {
    return this.bytes;
  }
}
