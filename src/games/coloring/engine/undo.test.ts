import { describe, expect, it } from 'vitest';
import { MAX_UNDO_BYTES, MAX_UNDO_STEPS, UndoHistory, makeStep, rleDecode, rleEncode, stepBytes, stepPixels } from './undo';

describe('run-length encoding', () => {
  it('round-trips mixed pixels', () => {
    const pixels = Uint32Array.from([0, 0, 0, 7, 7, 0xff00ff00, 0, 0]);
    const rle = rleEncode(pixels);
    expect([...rle]).toEqual([3, 0, 2, 7, 1, 0xff00ff00, 2, 0]);
    expect([...rleDecode(rle, pixels.length)]).toEqual([...pixels]);
  });

  it('compresses an empty full page to a few bytes', () => {
    const page = new Uint32Array(2048 * 1536);
    const rle = rleEncode(page);
    expect(rle.byteLength).toBe(8);
    expect(rleDecode(rle, page.length).length).toBe(page.length);
  });

  it('handles empty input and rejects data of the wrong length', () => {
    expect(rleEncode(new Uint32Array(0)).length).toBe(0);
    expect(() => rleDecode(Uint32Array.from([5, 1]), 4)).toThrow();
    expect(() => rleDecode(Uint32Array.from([3, 1]), 4)).toThrow();
  });

  it('keeps the before pixels of a step exactly', () => {
    const rgba = new Uint8ClampedArray(3 * 2 * 4);
    rgba.set([255, 0, 0, 255], 4);
    rgba.set([0, 0, 255, 128], 16);
    const step = makeStep(10, 20, 3, 2, rgba);
    expect(step).toMatchObject({ x: 10, y: 20, width: 3, height: 2 });
    expect([...stepPixels(step)]).toEqual([...rgba]);
  });
});

describe('UndoHistory', () => {
  const sized = (bytes: number) => ({ bytes });
  const make = (maxSteps?: number, maxBytes?: number) =>
    new UndoHistory<{ bytes: number }>((s) => s.bytes, maxSteps, maxBytes);

  it('pops in reverse order and reports empty', () => {
    const h = make();
    const a = sized(1);
    const b = sized(2);
    h.push(a);
    h.push(b);
    expect(h.pop()).toBe(b);
    expect(h.pop()).toBe(a);
    expect(h.pop()).toBeUndefined();
    expect(h.totalBytes).toBe(0);
  });

  it('keeps at most 20 steps by default, dropping the oldest', () => {
    expect(MAX_UNDO_STEPS).toBe(20);
    const h = make();
    const steps = Array.from({ length: 25 }, () => sized(1));
    steps.forEach((s) => h.push(s));
    expect(h.length).toBe(20);
    const popped = [];
    for (let s = h.pop(); s; s = h.pop()) popped.push(s);
    expect(popped.at(-1)).toBe(steps[5]);
  });

  it('drops the oldest steps once the memory cap is passed', () => {
    expect(MAX_UNDO_BYTES).toBe(150 * 1024 * 1024);
    const fullPage = 2048 * 1536 * 4; // about 12.6 MB, an uncompressible full-page action
    const h = make();
    for (let i = 0; i < 15; i++) h.push(sized(fullPage));
    expect(h.totalBytes).toBeLessThanOrEqual(MAX_UNDO_BYTES);
    expect(h.length).toBe(Math.floor(MAX_UNDO_BYTES / fullPage));
  });

  it('always keeps the newest step, even when it alone is over the cap', () => {
    const h = make(20, 100);
    h.push(sized(10));
    h.push(sized(500));
    expect(h.length).toBe(1);
    expect(h.pop()?.bytes).toBe(500);
  });

  it('measures steps by their compressed size', () => {
    const step = makeStep(0, 0, 4, 4, new Uint8ClampedArray(64));
    expect(stepBytes(step)).toBe(8);
  });
});
