// The coloring engine (ADR 0004): three stacked canvases (paper, paint, lines), bucket fill, brush and eraser
// with one stroke per finger, stay in the lines, and undo.
import type { ColoringMode } from '../../../shell/types';
import { RAINBOW, RAINBOW_STOPS } from '../../../ui/palette';
import { UndoHistory, makeStep, stepBytes, stepPixels, type UndoStep } from './undo';
import { RegionClient, type RegionMask } from './workerProtocol';

export const PAGE_WIDTH = 2048;
export const PAGE_HEIGHT = 1536;

export type Tool = 'bucket' | 'brush' | 'eraser';

/** Brush diameters in page pixels for the small, medium and big dots. */
export const BRUSH_SIZES = [40, 80, 130] as const;

/** At most this many fingers paint at once (ADR 0003). */
export const MAX_STROKES = 4;

/** A touch reported wider than this (CSS px) is a palm, and is ignored (ADR 0003). */
export const PALM_CSS_PX = 80;

interface Point {
  x: number;
  y: number;
}

/** Half-open rectangle in page pixels. */
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Stroke {
  tool: 'brush' | 'eraser';
  color: string;
  size: number;
  mode: ColoringMode;
  state: 'waiting' | 'drawing' | 'blocked';
  mask: RegionMask | null;
  pending: Point[];
  last: Point | null;
  distance: number;
  bbox: Rect | null;
  ready: Promise<void>;
}

export interface EngineEvents {
  /** After every finished action (stroke, fill, undo, start over): time to schedule an autosave. */
  onChange?: () => void;
  /** A touch that had nothing to do: undo with an empty history, a fill on a line. */
  onNothing?: () => void;
  onFill?: () => void;
}

function canvas(className: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = PAGE_WIDTH;
  c.height = PAGE_HEIGHT;
  c.className = className;
  return c;
}

function ctx2d(c: HTMLCanvasElement, willReadFrequently = false): CanvasRenderingContext2D {
  const ctx = c.getContext('2d', { willReadFrequently });
  if (!ctx) throw new Error('Canvas 2D is not available');
  return ctx;
}

function union(a: Rect | null, b: Rect): Rect {
  if (!a) return { ...b };
  return { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) };
}

export class ColoringEngine {
  readonly root: HTMLDivElement;
  tool: Tool = 'brush';
  color = '#4cc9f0';
  size: number = BRUSH_SIZES[1];
  mode: ColoringMode = 'free';

  private readonly paper = canvas('layer layer-paper');
  private readonly paint = canvas('layer layer-paint');
  private readonly lines = canvas('layer layer-lines');
  /** The paint layer as of the last finished action: where "before" pixels for undo come from. */
  private readonly committed = canvas('committed');
  private readonly scratch = document.createElement('canvas');
  private readonly paintCtx = ctx2d(this.paint);
  private readonly committedCtx = ctx2d(this.committed, true);
  private readonly scratchCtx = ctx2d(this.scratch);
  private readonly regions = new RegionClient();
  private readonly strokes = new Map<number, Stroke>();
  private readonly history = new UndoHistory<UndoStep>(stepBytes);
  private loaded = false;

  constructor(private readonly events: EngineEvents = {}) {
    this.root = document.createElement('div');
    this.root.className = 'coloring-page';
    this.root.append(this.paper, this.paint, this.lines);
    const paperCtx = ctx2d(this.paper);
    paperCtx.fillStyle = '#ffffff';
    paperCtx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    this.root.addEventListener('pointerdown', (e) => this.onDown(e));
    this.root.addEventListener('pointermove', (e) => this.onMove(e));
    this.root.addEventListener('pointerup', (e) => this.onUp(e));
    this.root.addEventListener('pointercancel', (e) => this.onUp(e));
    this.root.addEventListener('lostpointercapture', (e) => this.onUp(e));
  }

  /** Loads a page's line art and, when continuing a picture, its paint layer. */
  async load(pageUrl: string, paint?: Blob): Promise<void> {
    const img = new Image();
    img.src = pageUrl;
    await img.decode();
    const art = canvas('art');
    const artCtx = ctx2d(art, true);
    artCtx.drawImage(img, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    const pixels = artCtx.getImageData(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    const { lines } = await this.regions.init(pixels.data.buffer, PAGE_WIDTH, PAGE_HEIGHT);
    ctx2d(this.lines).putImageData(new ImageData(new Uint8ClampedArray(lines), PAGE_WIDTH, PAGE_HEIGHT), 0, 0);

    if (paint) {
      const bitmap = await createImageBitmap(paint);
      this.paintCtx.drawImage(bitmap, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
      this.committedCtx.drawImage(bitmap, 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
      bitmap.close();
    }
    this.loaded = true;
    this.root.dataset.ready = 'true';
  }

  /** Undoes the last action. Returns false when there was nothing to undo. */
  undo(): boolean {
    const step = this.history.pop();
    if (!step) {
      this.events.onNothing?.();
      return false;
    }
    const image = new ImageData(stepPixels(step), step.width, step.height);
    this.paintCtx.putImageData(image, step.x, step.y);
    this.committedCtx.putImageData(image, step.x, step.y);
    this.events.onChange?.();
    return true;
  }

  /** Clears the paint layer as one undoable step (ADR 0003 rule 6). */
  startOver(): void {
    this.paintCtx.clearRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);
    this.commit({ x0: 0, y0: 0, x1: PAGE_WIDTH, y1: PAGE_HEIGHT });
  }

  get undoSteps(): number {
    return this.history.length;
  }

  exportPaint(): Promise<Blob> {
    return new Promise((resolve, reject) =>
      this.paint.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the picture'))), 'image/png'),
    );
  }

  destroy(): void {
    this.regions.destroy();
    this.strokes.clear();
    this.history.clear();
  }

  // ---- Input ----

  private toPage(e: PointerEvent): Point {
    const r = this.root.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * PAGE_WIDTH,
      y: ((e.clientY - r.top) / r.height) * PAGE_HEIGHT,
    };
  }

  private isPalm(e: PointerEvent): boolean {
    return e.pointerType === 'touch' && Math.max(e.width, e.height) > PALM_CSS_PX;
  }

  private onDown(e: PointerEvent): void {
    if (!this.loaded || e.button > 0 || this.isPalm(e)) return;
    e.preventDefault();
    const p = this.toPage(e);
    if (this.tool === 'bucket') {
      void this.fillAt(p);
      return;
    }
    if (this.strokes.size >= MAX_STROKES || this.strokes.has(e.pointerId)) return;
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      // Not capturable (synthetic events): moves still arrive while the finger stays on the page.
    }

    const stroke: Stroke = {
      tool: this.tool,
      color: this.color,
      size: this.size,
      mode: this.mode,
      state: this.mode === 'lines' ? 'waiting' : 'drawing',
      mask: null,
      pending: [],
      last: null,
      distance: 0,
      bbox: null,
      ready: Promise.resolve(),
    };
    if (stroke.state === 'waiting') {
      // Stay in the lines: the region under the starting point clips the whole stroke (ADR 0004). Points that
      // arrive before the worker answers are kept and drawn once it does.
      stroke.ready = this.regions.maskAt(p.x, p.y).then(
        (mask) => {
          if (!mask) {
            stroke.state = 'blocked';
            return;
          }
          stroke.mask = mask;
          stroke.state = 'drawing';
          for (const q of stroke.pending) this.drawTo(stroke, q);
          stroke.pending = [];
        },
        () => {
          stroke.state = 'blocked';
        },
      );
    }
    this.strokes.set(e.pointerId, stroke);
    this.addPoint(stroke, p);
  }

  private onMove(e: PointerEvent): void {
    const stroke = this.strokes.get(e.pointerId);
    if (!stroke) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) this.addPoint(stroke, this.toPage(ev));
  }

  private onUp(e: PointerEvent): void {
    const stroke = this.strokes.get(e.pointerId);
    if (!stroke) return;
    this.strokes.delete(e.pointerId);
    void stroke.ready.then(() => {
      if (stroke.bbox) this.commit(stroke.bbox);
    });
  }

  // ---- Drawing ----

  private addPoint(stroke: Stroke, p: Point): void {
    if (stroke.state === 'waiting') stroke.pending.push(p);
    else if (stroke.state === 'drawing') this.drawTo(stroke, p);
  }

  private strokeColor(stroke: Stroke): string {
    if (stroke.tool === 'eraser') return '#000000';
    if (stroke.color !== RAINBOW) return stroke.color;
    // Rainbow cycles hue along the stroke (ADR 0004).
    const hue = Math.round(stroke.distance / 4) % 360;
    return `hsl(${hue} 90% 55%)`;
  }

  private drawTo(stroke: Stroke, p: Point): void {
    const a = stroke.last ?? p;
    stroke.last = p;
    stroke.distance += Math.hypot(p.x - a.x, p.y - a.y);

    const pad = stroke.size / 2 + 2;
    const rect: Rect = {
      x0: Math.max(0, Math.floor(Math.min(a.x, p.x) - pad)),
      y0: Math.max(0, Math.floor(Math.min(a.y, p.y) - pad)),
      x1: Math.min(PAGE_WIDTH, Math.ceil(Math.max(a.x, p.x) + pad)),
      y1: Math.min(PAGE_HEIGHT, Math.ceil(Math.max(a.y, p.y) + pad)),
    };
    const mask = stroke.mask;
    if (mask) {
      rect.x0 = Math.max(rect.x0, mask.x);
      rect.y0 = Math.max(rect.y0, mask.y);
      rect.x1 = Math.min(rect.x1, mask.x + mask.width);
      rect.y1 = Math.min(rect.y1, mask.y + mask.height);
    }
    if (rect.x1 <= rect.x0 || rect.y1 <= rect.y0) return;
    stroke.bbox = union(stroke.bbox, rect);

    const color = this.strokeColor(stroke);
    const op: GlobalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';

    if (!mask) {
      // Free coloring: straight onto the paint layer.
      this.paintCtx.save();
      this.paintCtx.globalCompositeOperation = op;
      line(this.paintCtx, a, p, stroke.size, color);
      this.paintCtx.restore();
      return;
    }

    // Stay in the lines: draw the segment on scratch, keep only the part inside the region, then composite.
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    const s = this.scratchFor(w, h);
    s.save();
    s.translate(-rect.x0, -rect.y0);
    line(s, a, p, stroke.size, color);
    s.restore();
    s.save();
    s.globalCompositeOperation = 'destination-in';
    s.drawImage(mask.bitmap, mask.x - rect.x0, mask.y - rect.y0);
    s.restore();
    this.paintCtx.save();
    this.paintCtx.globalCompositeOperation = op;
    this.paintCtx.drawImage(this.scratch, 0, 0, w, h, rect.x0, rect.y0, w, h);
    this.paintCtx.restore();
  }

  private async fillAt(p: Point): Promise<void> {
    // The color is the one picked when the finger touched, even if another is picked before the worker answers.
    const color = this.color;
    let mask: RegionMask | null;
    try {
      mask = await this.regions.maskAt(p.x, p.y);
    } catch {
      return;
    }
    if (!mask) {
      this.events.onNothing?.();
      return;
    }
    const { x, y, width: w, height: h } = mask;
    const s = this.scratchFor(w, h);
    s.drawImage(mask.bitmap, 0, 0);
    s.save();
    s.globalCompositeOperation = 'source-in';
    if (color === RAINBOW) {
      const g = s.createLinearGradient(0, 0, w, 0);
      RAINBOW_STOPS.forEach((c, i) => g.addColorStop(i / (RAINBOW_STOPS.length - 1), c));
      s.fillStyle = g;
    } else {
      s.fillStyle = color;
    }
    s.fillRect(0, 0, w, h);
    s.restore();
    this.paintCtx.drawImage(this.scratch, 0, 0, w, h, x, y, w, h);
    this.commit({ x0: x, y0: y, x1: x + w, y1: y + h });
    this.events.onFill?.();
  }

  /** A cleared scratch area of at least w x h, origin top-left. */
  private scratchFor(w: number, h: number): CanvasRenderingContext2D {
    if (this.scratch.width < w || this.scratch.height < h) {
      this.scratch.width = Math.max(this.scratch.width, w);
      this.scratch.height = Math.max(this.scratch.height, h);
    }
    this.scratchCtx.clearRect(0, 0, w, h);
    return this.scratchCtx;
  }

  /**
   * Records the before pixels of `rect` as one undo step, then brings the committed copy up to date.
   * Known limit: when two fingers paint at once and the first lifts while the second is still down, the copy
   * taken here includes the part of the second stroke inside the first one's box, so undoing the second stroke
   * later leaves that part behind.
   */
  private commit(rect: Rect): void {
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    if (w <= 0 || h <= 0) return;
    const before = this.committedCtx.getImageData(rect.x0, rect.y0, w, h);
    this.history.push(makeStep(rect.x0, rect.y0, w, h, before.data));
    this.committedCtx.clearRect(rect.x0, rect.y0, w, h);
    this.committedCtx.drawImage(this.paint, rect.x0, rect.y0, w, h, rect.x0, rect.y0, w, h);
    this.events.onChange?.();
  }
}

function line(ctx: CanvasRenderingContext2D, a: Point, b: Point, width: number, color: string): void {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  if (a.x === b.x && a.y === b.y) {
    ctx.beginPath();
    ctx.arc(a.x, a.y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}
